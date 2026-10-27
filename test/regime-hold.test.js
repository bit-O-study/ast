import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIME_HOLD, regimeTargets, simulateHold, equityStats, portfolio } from '../src/research/regime-hold.js';

const H4 = 14400000;
// 시작 봉: KST 00시(UTC 15시) 시작 → 마감 KST 04/08/12/16/20/00
const T0 = Date.UTC(2026, 0, 1, 15);
const make = (n, price = (i) => 100 + i) => Array.from({ length: n }, (_, i) => {
  const c = price(i);
  return { t: T0 + i * H4, o: c, h: c + 1, l: c - 1, c, v: 1 };
});
const kstCloseHour = (b) => new Date(b.t + H4 + 9 * 3600e3).getUTCHours();

test('국면 보유: KST 08시 마감 봉에서만 판정이 바뀌고 나머지 봉은 유지', () => {
  // 상승 후 급락하는 BTC
  const btc = make(400, (i) => (i < 300 ? 100 + i : 50));
  const w = regimeTargets(btc, btc);
  for (let i = 1; i < btc.length; i++) {
    if (w[i] !== w[i - 1]) assert.equal(kstCloseHour(btc[i]), 8, `판정 봉이 아닌 ${i}에서 변경`);
  }
  assert.equal(w[200], 1);
  assert.equal(w.at(-1), 0);
  // 20일 평균(120봉)이 잡히기 전에는 현금
  assert.ok(w.slice(0, 119).every((x) => x === 0));
});

test('국면 보유: 미래 BTC 봉을 바꿔도 과거 목표 비중 불변', () => {
  const btc = make(400, (i) => 100 + Math.sin(i / 9) * 20 + i * 0.1);
  const w = regimeTargets(btc, btc);
  const i = 250;
  const changed = btc.map((b, j) => (j <= i ? b : { ...b, c: b.c * 10, o: b.o * 10, h: b.h * 10, l: b.l * 10 }));
  assert.deepEqual(regimeTargets(btc, changed).slice(0, i + 1), w.slice(0, i + 1));
  assert.deepEqual(regimeTargets(btc.slice(0, i + 1), btc.slice(0, i + 1)), w.slice(0, i + 1));
});

test('국면 보유: 다음 봉 시가 체결과 편도 비용 반영', () => {
  const d = [100, 110, 121, 121].map((c, i) => ({ t: T0 + i * H4, o: c, h: c, l: c, c }));
  // 0봉 마감 후 매수 → 1봉 시가 110, 2봉 마감 후 매도 → 3봉 시가 121
  const r = simulateHold(d, [1, 1, 0, 0], 0.01, 1);
  assert.equal(r.switches, 2);
  assert.ok(Math.abs(r.equity.at(-1) - (121 / 110) * 0.99 * 0.99) < 1e-12);
  assert.equal(r.holding, false);
  assert.deepEqual(equityStats([1, 1.2, 0.9, 1.1]), { ret: 10.000000000000009, mdd: 25 });
});

test('국면 보유: 시작 시각 이전 봉에서는 매매하지 않고 현금으로 출발', () => {
  const btc = make(400);
  const byMarket = Object.fromEntries(REGIME_HOLD.markets.map((m) => [m, btc]));
  const from = btc[300].t;
  const p = portfolio(byMarket, btc, 0.001, from);
  assert.equal(p.per[0].start, 300);
  assert.equal(p.bars, 100);
  // 시작 봉 시가에 첫 매수: 비용만큼 출발
  assert.ok(Math.abs(p.per[0].equity[0] - (0.999 * btc[300].c) / btc[300].o) < 1e-12);
  assert.throws(() => portfolio(byMarket, btc, 0.001, btc.at(-1).t + H4), /시세가 부족/);
});
