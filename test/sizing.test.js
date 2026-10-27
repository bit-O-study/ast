import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { positionCap, boostBars } from '../src/sizing.js';
import { buildRegime } from '../src/regime.js';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';
import { Trader } from '../src/trader.js';
import { Store } from '../src/store.js';
import { PaperBroker } from '../src/broker/paper.js';

const UNIT = 4 * 3600e3;
const series = (n, price, t0 = 0) => Array.from({ length: n }, (_, i) => {
  const c = price(i);
  return { t: t0 + i * UNIT, o: c * 0.999, h: c * 1.004, l: c * 0.995, c, v: 100 + (i % 7) * 10 };
});

test('상한 규칙: 꺼짐·기준 미만·기준 이상', () => {
  const off = buildConfig({ MAX_POSITION_KRW: '2000000' });
  const on = buildConfig({ MAX_POSITION_KRW: '2000000', BOOST_POSITION_KRW: '3000000' });
  assert.equal(boostBars(on), 120);
  assert.equal(positionCap(off, 500), 2_000_000);
  assert.equal(positionCap(on, 119), 2_000_000);
  assert.equal(positionCap(on, 120), 3_000_000);
  assert.throws(() => buildConfig({ MAX_POSITION_KRW: '2000000', BOOST_POSITION_KRW: '1000000' }), /BOOST_POSITION_KRW/);
  assert.throws(() => buildConfig({ BOOST_POSITION_KRW: '3000000', MODE: 'live', BITHUMB_ACCESS_KEY: 'a', BITHUMB_SECRET_KEY: 'b', LIVE_CONFIRM: 'YES' }), /MODE=paper/);
});

test('연속 상승 국면 봉 수: 평균 아래로 내려가면 0, 미래 봉 변경에 불변', () => {
  // 300봉 상승 → 하락 1봉 → 다시 상승
  const btc = series(400, (i) => (i === 300 ? 50 : 100 + i));
  const cfg = buildConfig({});
  const r = buildRegime(btc, cfg), at = (i) => btc[i].t + UNIT;
  assert.equal(r.streak(at(118)), 0, '평균 준비 전');
  assert.equal(r.streak(at(119)), 1);
  assert.equal(r.streak(at(299)), 181);
  assert.equal(r.streak(at(300)), 0);
  assert.equal(r.streak(at(301)), 1);
  const changed = btc.map((b, j) => (j <= 250 ? b : { ...b, c: 1 }));
  assert.equal(buildRegime(changed, cfg).streak(at(250)), r.streak(at(250)));
  assert.equal(buildRegime(btc, { ...cfg, regimeFilter: 'off' }).streak(at(299)), 0);
});

test('백테스트: 꺼져 있으면 결과 동일, 켜면 긴 상승장 진입만 확대 금액', () => {
  const d = series(700, (i) => 100_000_000 * (1 + 0.002 * i + 0.03 * Math.sin(i / 9)));
  const base = { MODE: 'paper', MARKET: 'KRW-BTC', FEE_RATE: '.0004', MAX_POSITION_KRW: '2000000', RISK_PER_TRADE: '1' };
  const a = backtest(d, buildConfig(base)), b = backtest(d, buildConfig({ ...base, BOOST_POSITION_KRW: '0' }));
  assert.deepEqual(a.stats, b.stats);
  const cfg = buildConfig({ ...base, BOOST_POSITION_KRW: '3000000' });
  const c = backtest(d, cfg), regime = buildRegime(d, cfg);
  assert.ok(c.trades.length > 0);
  for (const t of c.trades) {
    const streak = regime.streak(d[t.entryIdx - 1].t + UNIT);
    const want = streak >= 120 ? 3_000_000 : 2_000_000;
    assert.ok(Math.abs(t.cost - want) < 1, `진입 ${t.entryIdx}: streak ${streak} 비용 ${t.cost}`);
  }
});

test('Trader: 긴 상승장이면 확대 금액으로 매수하고 이벤트에 기록', async () => {
  const now = Math.floor(Date.now() / UNIT) * UNIT + 60e3;
  const rows = series(200, (i) => 100_000_000 * (1 + 0.002 * i), Math.floor(now / UNIT) * UNIT - 200 * UNIT);
  const client = { price: rows[199].c, async ticker() { return { price: this.price }; }, async candles() { return rows; }, async candlesRange() { return [...series(130, () => 90_000_000, rows[0].t - 130 * UNIT), ...rows]; } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-boost-'));
  const cfg = buildConfig({ PRICE_POLL_SEC: '3600', MAX_POSITION_KRW: '2000000', BOOST_POSITION_KRW: '3000000', RISK_PER_TRADE: '1' });
  const store = new Store(dir);
  const trader = new Trader({ cfg, client, broker: new PaperBroker(store, cfg), store, log: () => {}, now: () => now });
  await trader.init();
  assert.ok(trader.regime.streak(rows[199].t + UNIT) >= 120);
  await trader.enter();
  const buy = store.events(10).find((e) => e.type === 'buy');
  assert.ok(buy, '매수');
  assert.equal(buy.cost, 3_000_000);
  assert.equal(buy.maxPositionKrw, 3_000_000);
  assert.equal(buy.boost, true);
});
