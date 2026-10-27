import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Trader } from '../src/trader.js';
import { Store } from '../src/store.js';
import { PaperBroker } from '../src/broker/paper.js';
import { buildConfig } from '../src/config.js';
import { verify } from '../src/sim/replay.js';
import { STRATEGIES } from '../src/strategies/index.js';

async function setup(t) {
  const cfg = buildConfig({ STRATEGY: 'structure', REGIME_FILTER: 'off', FEE_RATE: '0.0004', MIN_RR: '1' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-scale-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir), unit = 14400000;
  let clock = Date.UTC(2026, 0, 1) + 200 * unit + 3001;
  const rows = Array.from({ length: 200 }, (_, i) => {
    const c = 100000 + i * 100;
    return { t: Date.UTC(2026, 0, 1) + i * unit, o: c - 100, c, h: c + 800, l: c - 800, v: 100 };
  });
  const client = { price: rows.at(-1).c, async ticker() { return { price: this.price }; }, async candles() { return rows; }, async candlesRange() { return rows; } };
  const trader = new Trader({ cfg, client, broker: new PaperBroker(store, cfg), store, now: () => clock, log: () => {} });
  await trader.init();
  await trader.enter();
  assert.ok(store.state.position?.scale);
  const nextSignal = () => {
    clock += unit;
    rows.push({ ...rows.at(-1), t: rows.at(-1).t + unit });
    trader.candles = rows.slice(-200);
    trader.ctx = trader.strategy.prepare(trader.candles);
    trader.I = trader.ctx.I;
    trader.signal = { ...trader.signal, add: true, enter: true, analysis: null, regime: null };
    const pos = store.state.position;
    trader.price = client.price = pos.scale.firstPrice + .6 * pos.scale.atr;
  };
  return { cfg, dir, store, trader, client, nextSignal, now: () => clock };
}

test('모의 1차→2차→재시작 중복 차단→1차·2차 매도, 잔고와 손익 일치', async t => {
  const x = await setup(t);
  assert.equal(x.store.state.position.scale.stage, 1);
  x.nextSignal();
  await x.trader.addPosition();
  const p = x.store.state.position;
  assert.equal(p.scale.stage, 2);
  assert.equal(x.store.events(100).filter(e => e.type === 'buy').length, 2);
  const cost = p.cost;
  const restored = new Store(x.dir);
  const next = new Trader({ cfg: x.cfg, client: x.client, broker: new PaperBroker(restored, x.cfg), store: restored, now: x.now, log: () => {} });
  await next.init();
  next.signal.add = true;
  await next.addPosition();
  assert.equal(restored.state.position.cost, cost);
  await next.checkPosition(p.t1);
  assert.equal(restored.state.position.t1Done, true);
  await next.checkPosition(p.t2);
  assert.equal(restored.state.position, null);
  const [trade] = restored.trades();
  assert.equal(trade.entries.length, 2);
  assert.equal(trade.exits.length, 2);
  assert.ok(Math.abs(restored.state.paper.krw - x.cfg.paperKrw - trade.pnl) < 1e-6);
  assert.ok(restored.state.paper.coin < 1e-10);
});

test('일시정지·킬·일일 한도·BTC 하락에서 추가 매수하지 않는다', async t => {
  const x = await setup(t);
  x.nextSignal();
  for (const block of ['halted', 'killed', 'daily', 'regime']) {
    x.store.state.halted = block === 'halted';
    x.store.state.killed = block === 'killed';
    x.store.state.dayStartEquity = block === 'daily' ? x.cfg.paperKrw * 2 : x.cfg.paperKrw;
    x.trader.signal.regime = block === 'regime' ? { bull: false } : null;
    await x.trader.addPosition();
    assert.equal(x.store.state.position.scale.stage, 1, block);
  }
});

test('봉 마감에서 목표가 청산을 추가 매수보다 먼저 처리한다', async t => {
  const x = await setup(t);
  x.nextSignal();
  x.trader.refreshCandles = async () => true;
  x.trader.price = x.store.state.position.t1 * 1.001;
  await x.trader.onCandle();
  assert.equal(x.store.state.position.scale.stage, 1);
  assert.equal(x.store.state.position.t1Done, true);
});

test('실제 매매 루프와 백테스트의 분할 단계·신호봉 및 매도가 일치한다', async () => {
  const cfg = buildConfig({ STRATEGY: 'structure', REGIME_FILTER: 'off', FEE_RATE: '0.0004', MIN_RR: '1' });
  // 진입 신호를 고정해 분할 체결 경로를 반드시 실행한다. 구조 신호 자체는 별도 미래 참조 테스트.
  const original = STRATEGIES.structure.evaluate;
  STRATEGIES.structure.evaluate = function(ctx, i) {
    return { enter: i >= 80, add: true, score: 100, parts: [], trend: true, adx: 30, rsi: 55, note: '검증 신호' };
  };
  try {
    const d = Array.from({ length: 260 }, (_, i) => {
      const c = 100000 + i * 150;
      return { t: Date.UTC(2026, 0, 1) + i * 14400000, o: c - 150, c, h: c + 400, l: c - 500, v: 100 };
    });
    const v = await verify(d, cfg);
    assert.ok(v.pass, JSON.stringify({ entry: v.entryMatch, route: v.routeMatch, stage: v.stageMatch, errors: v.replay.errors }));
    assert.ok(v.pairs.some(p => p.r.entries.length === 2), '2차 매수 실행 필요');
    assert.equal(v.stageMatch, 1);
  } finally { STRATEGIES.structure.evaluate = original; }
});
