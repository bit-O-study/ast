import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Trader } from '../src/trader.js';
import { Store } from '../src/store.js';
import { PaperBroker } from '../src/broker/paper.js';
import { Portfolio } from '../src/portfolio.js';
import { Settings } from '../src/settings.js';
import { LiveVerifier } from '../src/verify/live.js';
import { buildConfig } from '../src/config.js';

const UNIT = 4 * 3600e3, MIN = 60e3;
const MARKETS = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'];
const BASE = { 'KRW-BTC': 100_000_000, 'KRW-ETH': 5_000_000, 'KRW-XRP': 3_000 };

// 종목별 마감 봉 200개와 현재가를 주는 가짜 클라이언트
function fakeClient(clock) {
  const start = Math.floor(clock.t / UNIT) * UNIT - 200 * UNIT;
  const rows = Object.fromEntries(MARKETS.map((m) => [m, Array.from({ length: 200 }, (_, i) => {
    const c = BASE[m] * (1 + 0.001 * i + 0.01 * Math.sin(i / 5));
    return { t: start + i * UNIT, o: c * 0.998, h: c * 1.004, l: c * 0.995, c, v: 100 + (i % 7) * 10 };
  })]));
  const price = Object.fromEntries(MARKETS.map((m) => [m, rows[m][199].c]));
  return {
    rows, price,
    async ticker(m) { return { price: this.price[m] }; },
    async candles(m) { return this.rows[m]; },
    async candlesRange(m) { return this.rows[m]; },
  };
}

function setup({ dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-pf-')), clock = { t: Math.floor(Date.now() / UNIT) * UNIT + MIN }, env = {} } = {}) {
  const cfg = buildConfig({ MARKETS: MARKETS.join(','), PRICE_POLL_SEC: '3600', FEE_RATE: '0.0004', MAX_POSITION_KRW: '2000000', ...env });
  const client = fakeClient(clock), now = () => clock.t;
  const wallet = new Store(dir);
  const portfolio = new Portfolio({ cfg, wallet, now });
  const traders = MARKETS.map((m, k) => {
    const c = k === 0 ? cfg : { ...cfg, market: m };
    const s = k === 0 ? wallet : new Store(path.join(dir, m));
    return portfolio.add(new Trader({ cfg: c, client, broker: new PaperBroker(wallet, c, { primary: k === 0 }), store: s, log: () => {}, now }));
  });
  return { dir, clock, cfg, client, wallet, portfolio, traders, now };
}
const init = async (x) => { for (const t of x.traders) await t.init(); x.portfolio.init(); };

test('설정: MARKETS는 첫 종목을 MARKET으로 쓰고, live에서는 거부, 없으면 한 종목', () => {
  const c = buildConfig({ MARKETS: 'krw-btc, KRW-ETH,KRW-ETH' });
  assert.deepEqual(c.markets, ['KRW-BTC', 'KRW-ETH']);
  assert.equal(c.market, 'KRW-BTC');
  assert.throws(() => buildConfig({ MARKETS: 'BTC' }), /MARKETS/);
  assert.throws(() => buildConfig({ MARKETS: 'KRW-BTC,KRW-ETH', MODE: 'live', BITHUMB_ACCESS_KEY: 'a', BITHUMB_SECRET_KEY: 'b', LIVE_CONFIRM: 'YES' }), /MODE=paper/);
  assert.deepEqual(buildConfig({}).markets, []);
});

test('공유 지갑: 현금 하나를 같이 쓰고 코인은 종목별, 첫 종목은 기존 paper.coin 유지', async () => {
  const x = setup();
  await init(x);
  for (const t of x.traders) await t.enter();
  const p = x.wallet.state.paper;
  assert.ok(x.traders.every((t) => t.state.position), '세 종목 모두 진입');
  assert.ok(Math.abs(p.krw - (10_000_000 - 3 * 2_000_000)) < 1, `1회 200만 × 3 = 600만 사용 (${p.krw})`);
  assert.ok(p.coin > 0 && p.coins['KRW-ETH'] > 0 && p.coins['KRW-XRP'] > 0);
  assert.equal(p.coins['KRW-BTC'], undefined, '첫 종목은 paper.coin');
  // 계좌 평가금액 = 현금 + Σ 코인 × 현재가
  const eq = p.krw + MARKETS.reduce((a, m, k) => a + (k ? p.coins[m] : p.coin) * x.client.price[m], 0);
  assert.ok(Math.abs(x.portfolio.equity() - eq) < 1e-6);
  // 다시 열어도 그대로
  const again = new Store(x.dir);
  assert.deepEqual(again.state.paper, p);
});

test('계좌 단위 일일 손실 한도: 한 종목 손실이 전 종목 신규 진입을 막음', async () => {
  const x = setup({ env: { DAILY_LOSS_LIMIT: '0.03' } });
  await init(x);
  await x.traders[0].enter();
  await x.traders[1].enter();
  // ETH만 25% 하락 → 계좌 -5%
  x.client.price['KRW-ETH'] *= 0.75;
  x.traders[1].price = x.client.price['KRW-ETH'];
  assert.equal(x.portfolio.dailyBlocked(), true);
  assert.ok(x.traders.every((t) => t.dailyBlocked()), '모든 종목이 같은 계좌 기준');
});

test('계좌 단위 킬 스위치: 전 종목 전량 매도 후 정지, 이벤트 1건', async () => {
  const x = setup({ env: { KILL_SWITCH_LOSS: '0.05', MAX_POSITION_KRW: '3000000' } });
  await init(x);
  for (const t of x.traders) await t.enter();
  // 손절가를 피해 큰 갭 하락을 흉내: 손절가를 아주 낮춰 두고 가격만 떨어뜨린다
  for (const t of x.traders) { t.state.position.stop = 1; x.client.price[t.cfg.market] *= 0.8; }
  await x.traders[2].tick();
  for (const t of x.traders) {
    assert.equal(t.state.position, null, `${t.cfg.market} 청산`);
    assert.equal(t.state.killed, true);
    assert.throws(() => t.resume(), /킬 스위치/);
  }
  assert.equal(x.portfolio.state.killed, true);
  assert.equal(x.wallet.events(100).filter((e) => e.type === 'kill').length, 1);
  assert.ok(x.wallet.state.paper.coin < 1e-12 && Object.values(x.wallet.state.paper.coins).every((q) => q < 1e-12));
});

test('설정 즉시 변경은 모든 종목 cfg에 반영, 보유 종목이 하나라도 있으면 대기', async () => {
  const x = setup();
  await init(x);
  const settings = new Settings({ cfg: x.cfg, store: x.wallet, now: x.now, hasPosition: () => x.traders.some((t) => !!t.state.position), mirrors: x.traders.slice(1).map((t) => t.cfg) });
  for (const t of x.traders) t.settings = settings;
  await x.traders[2].enter();
  assert.equal(settings.request({ fee: 0.001 }).pending, true);
  x.client.price['KRW-XRP'] = x.traders[2].state.position.stop * 0.99;
  await x.traders[2].tick();
  await x.traders[0].tick();
  assert.deepEqual(x.traders.map((t) => t.cfg.fee), [0.001, 0.001, 0.001]);
});

test('실시간 검증: 전 종목 이벤트 대조, 종목별 봉 처리 점검', async () => {
  const x = setup();
  await init(x);
  const v = new LiveVerifier({ cfg: x.cfg, store: x.wallet, trader: x.traders[0], traders: x.traders, now: x.now });
  x.traders[0].verifier = v;
  v.start({ hours: 24 });
  await x.traders[1].enter();
  await x.traders[0].tick();
  let s = v.view().session;
  assert.equal(s.state, 'running');
  assert.deepEqual(s.fills.map((f) => [f.market, f.type, f.ok]), [['KRW-ETH', 'buy', true]]);
  assert.deepEqual(Object.keys(s.perMarket), MARKETS);
  // XRP만 봉 처리가 멈추면 실패
  x.traders[2].state.lastCandleT -= 3 * UNIT;
  x.clock.t += 5 * MIN;
  await x.traders[0].tick();
  s = v.view().session;
  assert.equal(s.failure.key, 'candle');
  assert.match(s.failure.reason, /KRW-XRP/);
});

test('API: 종목 선택, 전 종목 거래 합산, 일시정지는 전 종목, 포트폴리오 요약', async () => {
  const { createServer } = await import('../src/server.js');
  const x = setup();
  await init(x);
  await x.traders[1].enter();
  x.client.price['KRW-ETH'] = x.traders[1].state.position.stop * 0.99;
  await x.traders[1].tick();
  const server = createServer({ cfg: x.cfg, trader: x.traders[0], client: null, store: x.wallet, traders: x.traders, portfolio: x.portfolio }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (p) => (await fetch(base + p)).json();
  try {
    const st = await get('/api/status');
    assert.equal(st.market, 'KRW-BTC', '기본은 첫 종목 (배포·점검 스크립트 호환)');
    assert.deepEqual(st.markets, MARKETS);
    assert.equal(st.portfolio.markets.length, 3);
    assert.ok(Math.abs(st.portfolio.equity - x.portfolio.equity()) < 1e-6);
    assert.equal((await get('/api/status?market=KRW-ETH')).market, 'KRW-ETH');
    assert.equal((await fetch(base + '/api/status?market=KRW-DOGE')).status, 400);
    assert.equal((await get('/api/trades')).length, 1, '전 종목 합산');
    assert.equal((await get('/api/trades?market=KRW-BTC')).length, 0);
    assert.ok((await get('/api/events')).some((e) => e.market === 'KRW-ETH'));
    await fetch(base + '/api/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'pause' }) });
    assert.ok(x.traders.every((t) => t.state.halted));
  } finally { server.close(); }
});
