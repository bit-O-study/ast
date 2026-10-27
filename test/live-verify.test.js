import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Trader } from '../src/trader.js';
import { Store } from '../src/store.js';
import { PaperBroker } from '../src/broker/paper.js';
import { buildConfig } from '../src/config.js';
import { Settings } from '../src/settings.js';
import { LiveVerifier, checkBuy, checkSell, checkPlan } from '../src/verify/live.js';

const UNIT = 4 * 3600e3, MIN = 60e3;

// 봉 경계 1분 뒤에서 시작하는 시계와, 그 시계 기준 마감 봉 200개를 주는 가짜 클라이언트
function setup({ dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-verify-')), clock } = {}) {
  clock ??= { t: Math.floor(Date.now() / UNIT) * UNIT + MIN };
  const start = Math.floor(clock.t / UNIT) * UNIT - 200 * UNIT;
  const rows = Array.from({ length: 200 }, (_, i) => {
    const c = 100_000_000 * (1 + 0.001 * i + 0.01 * Math.sin(i / 5));
    return { t: start + i * UNIT, o: c * 0.998, h: c * 1.004, l: c * 0.995, c, v: 100 + (i % 7) * 10 };
  });
  const client = {
    price: rows[199].c, rows, fail: null,
    async ticker() { if (this.fail) throw new Error(this.fail); return { price: this.price }; },
    async candles() { return this.rows; },
    async candlesRange() { return this.rows; },
  };
  const cfg = buildConfig({ PRICE_POLL_SEC: '3600', FEE_RATE: '0.0004', MAX_POSITION_KRW: '3000000', RISK_PER_TRADE: '1' });
  const store = new Store(dir), now = () => clock.t;
  const trader = new Trader({ cfg, client, broker: new PaperBroker(store, cfg), store, log: () => {}, now });
  trader.settings = new Settings({ cfg, store, now, emit: (t, d) => trader.emit(t, d), hasPosition: () => !!store.state.position });
  trader.verifier = new LiveVerifier({ cfg, store, trader, now });
  return { dir, clock, client, cfg, store, trader, verifier: trader.verifier, settings: trader.settings };
}
const events = (store, type) => store.events(500).filter((e) => e.type === type);

test('체결 대조 함수: 금액 상한·수수료·수량·대금·손절 순서', () => {
  const buy = { cost: 3_000_000, fee: 1200, feeRate: 0.0004, price: 100_000_000, qty: (3_000_000 - 1200) / 100_000_000, maxPositionKrw: 3_000_000, stop: 95e6, t1: 105e6, t2: 110e6 };
  assert.equal(checkBuy(buy), null);
  assert.match(checkBuy({ ...buy, maxPositionKrw: 1_000_000 }), /초과/);
  assert.match(checkBuy({ ...buy, fee: 7500 }), /수수료/);
  assert.match(checkBuy({ ...buy, qty: buy.qty * 1.01 }), /수량/);
  assert.match(checkBuy({ ...buy, fee: undefined }), /정보가 없습니다/);
  assert.equal(checkPlan(buy), null);
  assert.match(checkPlan({ ...buy, stop: 101e6 }), /순서/);
  const sell = { qty: 0.03, price: 100_000_000, feeRate: 0.0004, fee: 1200, proceeds: 0.03 * 100_000_000 * 0.9996 };
  assert.equal(checkSell(sell), null);
  assert.match(checkSell({ ...sell, proceeds: sell.proceeds + 100 }), /매도 대금/);
});

test('실시간 검증: 매수·매도 대조 후 기간 종료 시 통과와 보고서', async () => {
  const { clock, client, store, trader, verifier } = setup();
  await trader.init();
  verifier.start({ hours: 1 });
  assert.throws(() => verifier.start({ hours: 1 }), /이미 진행 중/);
  await trader.enter();
  await trader.tick();
  const pos = store.state.position;
  const [buy] = events(store, 'buy');
  assert.equal(buy.cost, 3_000_000, '1회 최대 금액으로 매수');
  assert.equal(buy.feeRate, 0.0004);
  client.price = pos.stop * 0.999;
  clock.t += 5 * MIN; await trader.tick();
  assert.equal(store.state.position, null);
  for (let k = 0; k < 12; k++) { clock.t += 5 * MIN; await trader.tick(); }
  const v = verifier.view().session;
  assert.equal(v.state, 'passed', JSON.stringify(v.failure));
  assert.deepEqual(v.fills.map((f) => [f.type, f.ok]), [['buy', true], ['sell', true]]);
  assert.ok(v.checks.every((c) => c.state === 'ok'), JSON.stringify(v.checks));
  assert.ok(fs.readFileSync(v.report, 'utf8').includes('통과'));
  assert.equal(events(store, 'verify')[0].state, 'passed');
  assert.equal(trader.status().verify.state, 'passed');
});

test('실시간 검증: 매매 루프 오류는 즉시 실패', async () => {
  const { client, trader, verifier, store } = setup();
  await trader.init();
  verifier.start({ hours: 24 });
  client.fail = '시세 조회 실패';
  await trader.tick();
  const s = verifier.view().session;
  assert.equal(s.state, 'failed');
  assert.equal(s.failure.key, 'errors');
  assert.match(events(store, 'verify')[0].msg, /실패/);
});

test('실시간 검증: 10분 넘는 루프 공백과 봉 마감 미처리는 실패', async () => {
  const a = setup();
  await a.trader.init();
  a.verifier.start({ hours: 24 });
  a.clock.t += 11 * MIN;
  await a.trader.tick();
  assert.equal(a.verifier.view().session.failure.key, 'loop');

  const b = setup();
  await b.trader.init();
  b.verifier.start({ hours: 24 });
  // 새 봉이 올라오지 않는 시세: 다음 봉 마감 + 10분이 지나면 실패
  for (let k = 0; k < 60 && b.verifier.session.state === 'running'; k++) { b.clock.t += 5 * MIN; await b.trader.tick(); }
  assert.equal(b.verifier.view().session.failure.key, 'candle');
});

test('실시간 검증: 재기동 후 이어서 진행하고 재시작은 경고로 기록', async () => {
  const a = setup();
  await a.trader.init();
  a.verifier.start({ hours: 24 });
  await a.trader.tick();
  a.clock.t += 2 * MIN;
  const b = setup({ dir: a.dir, clock: a.clock });
  await b.trader.init();
  await b.trader.tick();
  const s = b.verifier.view().session;
  assert.equal(s.state, 'running');
  assert.equal(s.warnings[0].msg, '매매 프로세스 재시작');
  b.verifier.stop();
  assert.equal(b.verifier.view().session.state, 'stopped');
});

test('설정 즉시 변경 + Trader: 보유 중 변경은 청산 뒤 적용, 다음 매수에 반영', async () => {
  const { clock, client, store, trader, settings, cfg } = setup();
  await trader.init();
  await trader.enter();
  const pos = store.state.position;
  assert.equal(settings.request({ fee: 0.001, maxPositionKrw: 2_000_000 }).pending, true);
  assert.equal(cfg.fee, 0.0004);
  client.price = pos.stop * 0.999;
  await trader.tick();
  const sell = events(store, 'sell')[0];
  assert.equal(sell.feeRate, 0.0004, '보유 중 매도는 기존 수수료');
  clock.t += MIN; await trader.tick();
  assert.equal(cfg.fee, 0.001);
  client.price = client.rows[199].c;
  await trader.enter();
  const [buy] = events(store, 'buy');
  assert.equal(buy.feeRate, 0.001);
  assert.equal(buy.cost, 2_000_000);
});

test('API: 설정 변경·검증 시작/중지·보고서, 잘못된 요청은 400, 기능 없으면 404', async () => {
  const { createServer } = await import('../src/server.js');
  const { cfg, store, trader, settings, verifier } = setup();
  await trader.init();
  const server = createServer({ cfg, trader, client: null, store, settings, verifier }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, body) => {
    const r = await fetch(base + p, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json() };
  };
  try {
    let r = await call('/api/settings', { changes: { maxPositionKrw: 2_000_000 } });
    assert.equal(r.status, 200);
    assert.equal(cfg.maxPositionKrw, 2_000_000);
    r = await call('/api/settings', { changes: { fee: 5 } });
    assert.equal(r.status, 400);
    r = await call('/api/settings/reset', {});
    assert.equal(cfg.maxPositionKrw, 3_000_000);
    r = await call('/api/verify', { action: 'start', hours: 999 });
    assert.equal(r.status, 400);
    r = await call('/api/verify', { action: 'start', hours: 24 });
    assert.equal(r.json.session.state, 'running');
    assert.equal((await call('/api/verify', { action: 'start', hours: 24 })).status, 409);
    assert.equal((await call('/api/status')).json.verify.state, 'running');
    assert.equal((await call('/api/verify', { action: 'stop' })).json.session.state, 'stopped');
    assert.match((await call('/api/verify/report')).json.markdown, /중단/);
  } finally { server.close(); }
  const bare = createServer({ cfg, trader, client: null, store }).listen(0, '127.0.0.1');
  await new Promise((r) => bare.once('listening', r));
  try {
    const r = await fetch(`http://127.0.0.1:${bare.address().port}/api/settings`);
    assert.equal(r.status, 404);
  } finally { bare.close(); }
});
