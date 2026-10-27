import test from 'node:test';
import assert from 'node:assert/strict';
import { cappedHold } from '../src/research/capped-hold.js';
const cfg = { paperKrw: 10000, maxPositionKrw: 1000, fee: .0004, slip: .0005, unit: 240, regimeDays: 1 };
const candles = values => values.map((c, i) => ({ t: i * 14400000, o: c, c, h: c, l: c, v: 1 }));
test('국면 보유: 총지출 한도와 정밀 왕복비용·종료 청산', () => {
  const d = candles([100, 100, 100]);
  const r = cappedHold(d, d, cfg, { hold: true, start: 1 });
  const final = 9000 + 1000 * (1 - cfg.slip) * (1 - cfg.fee) / ((1 + cfg.slip) * (1 + cfg.fee));
  assert.ok(Math.abs(r.stats.final - final) < 1e-9);
  assert.equal(r.fills[0].cost, 1000);
  assert.equal(r.fills.at(-1).side, 'sell');
  assert.equal(r.stats.trades, 1);
  assert.ok(r.stats.mdd > 0);
});
test('국면 보유: 초기자산에서 발생한 첫 손실을 MDD에 포함', () => {
  const d = candles([100, 100]); d[1].c = 50;
  const r = cappedHold(d, d, { ...cfg, fee: 0, slip: 0 }, { hold: true, start: 1 });
  assert.ok(Math.abs(r.stats.ret + 5) < 1e-10);
  assert.equal(r.stats.mdd, 5);
});
test('국면 보유: 신호 봉에서는 거래하지 않고 다음 봉 시가 체결', () => {
  const d = candles([100, 100, 100, 100, 100, 110, 120]);
  const r = cappedHold(d, d, cfg, { daily: false, start: 1 });
  assert.equal(r.fills[0].i, 6);
  assert.ok(Math.abs(r.fills[0].qty - 1000 / (120 * 1.0005 * 1.0004)) < 1e-12);
  const prefix = cappedHold(d.slice(0, 6), d.slice(0, 6), cfg, { daily: false, start: 1 });
  assert.equal(prefix.fills.length, 0);
});
test('국면 보유: KST08시 마감에서만 일일 목표를 갱신', () => {
  const d = candles([100, 100, 100, 100, 100, 100, 110, 120, 130]);
  for (const b of d) b.t += Date.UTC(2026, 0, 1, 15);
  const daily = cappedHold(d, d, cfg, { daily: true, start: 1 });
  const frequent = cappedHold(d, d, cfg, { daily: false, start: 1 });
  assert.equal(daily.fills[0].i, 8);
  assert.equal(frequent.fills[0].i, 7);
  const prefix = cappedHold(d.slice(0, 8), d.slice(0, 8), cfg, { daily: true, start: 1 });
  assert.equal(prefix.fills.length, 0);
});
