import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Trader } from '../src/trader.js';
import { Store } from '../src/store.js';
import { PaperBroker } from '../src/broker/paper.js';
import { buildConfig } from '../src/config.js';

// 마감된 4시간봉 200개 + 현재가를 바꿀 수 있는 가짜 빗썸 클라이언트
function fakeClient() {
  const unit = 4 * 3600e3, now = Date.now(), start = Math.floor(now / unit) * unit - 200 * unit;
  const candles = Array.from({ length: 200 }, (_, i) => {
    const c = 100_000_000 * (1 + 0.001 * i + 0.01 * Math.sin(i / 5));
    return { t: start + i * unit, o: c * 0.998, h: c * 1.004, l: c * 0.995, c, v: 100 + (i % 7) * 10 };
  });
  return {
    price: candles[199].c, rows: candles,
    async ticker() { return { price: this.price }; },
    async candles() { return this.rows; },
    async candlesRange() { return this.rows; },
  };
}

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-'));
  const cfg = buildConfig({ PRICE_POLL_SEC: '3600' });
  const store = new Store(dir);
  const client = fakeClient();
  const trader = new Trader({ cfg, client, broker: new PaperBroker(store, cfg), store, log: () => {} });
  return { cfg, store, client, trader };
}

test('진입 → 손절가 위에서는 유지 → 손절가 도달 시 매도 → 실패로 기록', async () => {
  const { store, client, trader } = setup();
  await trader.start();
  trader.stop();
  await trader.enter();
  const pos = store.state.position;
  assert.ok(pos, '포지션이 열려야 함');
  assert.ok(pos.stop < pos.entryPrice && pos.t1 > pos.entryPrice);

  client.price = pos.stop * 1.001;
  await trader.tick();
  assert.ok(store.state.position, '손절가 위에서는 팔지 않음');

  client.price = pos.stop * 0.999;
  await trader.tick();
  assert.equal(store.state.position, null);
  const [t] = store.trades();
  assert.equal(t.result, '실패');
  assert.equal(t.reason, '손절가 도달');
  assert.ok(store.state.paper.coin < 1e-12);
});

test('1차 목표가 일부 매도 후 2차 목표가 전량 매도 → 성공', async () => {
  const { store, client, trader } = setup();
  await trader.start();
  trader.stop();
  await trader.enter();
  const pos = store.state.position;
  client.price = pos.t1;
  await trader.tick();
  assert.ok(store.state.position.t1Done);
  assert.equal(store.state.position.stopType, 'breakeven');
  client.price = pos.t2;
  await trader.tick();
  assert.equal(store.state.position, null);
  const [t] = store.trades();
  assert.equal(t.result, '성공');
  assert.equal(t.exits.length, 2);
  assert.ok(trader.status().summary.pnl > 0);
});

test('일시정지 중에도 손절가 매도는 작동한다', async () => {
  const { store, client, trader } = setup();
  await trader.start();
  trader.stop();
  await trader.enter();
  trader.pause();
  client.price = store.state.position.stop * 0.99;
  await trader.tick();
  assert.equal(store.state.position, null);
});

for (const legacy of [false, true]) {
  test('저장 재시작과 전략 설정 변경 후 기존 진입 기록 보존: legacy=' + legacy, async () => {
    const { cfg, store, client, trader } = setup();
    try {
      await trader.init();
      await trader.enter();
      const original = { ...store.state.position.strategy };
      assert.equal(original.id, 'score');
      if (legacy) delete store.state.position.strategy;
      client.price = store.state.position.t1;
      await trader.tick();
      assert.ok(store.state.position.t1Done);
      store.save();
      const restored = new Store(store.dir);
      const changed = { ...cfg, strategy: 'breakout' };
      const next = new Trader({ cfg: changed, client, broker: new PaperBroker(restored, changed), store: restored, log: () => {} });
      await next.init();
      client.price = restored.state.position.t2;
      await next.tick();
      assert.equal(restored.state.position, null);
      assert.deepEqual(restored.trades()[0].strategy, legacy ? null : original);
    } finally {
      trader.stop();
      fs.rmSync(store.dir, { recursive: true, force: true });
    }
  });
}
