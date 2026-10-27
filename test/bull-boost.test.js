import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BULL_BOOST, judge, evaluateBoost, observeBoost } from '../src/research/bull-boost.js';

const UNIT = 14400000;
const make = (n, from, price) => Array.from({ length: n }, (_, i) => {
  const c = price(i);
  return { t: from + i * UNIT, o: c * 0.999, h: c * 1.004, l: c * 0.995, c, v: 100 + (i % 7) * 10 };
});

test('T-040 판정 기준: 확대 없음은 판정 불가, 수익·MDD 조건', () => {
  assert.equal(judge({ ret: 1, mdd: 5 }, { ret: 2, mdd: 6, boosted: 0 }).verdict, '판정 불가');
  assert.equal(judge({ ret: 1, mdd: 5 }, { ret: 2, mdd: 7, boosted: 3 }).verdict, '충족');
  assert.deepEqual(judge({ ret: 3, mdd: 5 }, { ret: 2, mdd: 8, boosted: 3 }).reasons, ['확대 수익이 기본보다 낮음', '확대 MDD가 기본의 1.5배 초과']);
  assert.deepEqual(judge({ ret: 1, mdd: 12 }, { ret: 2, mdd: 16, boosted: 1 }).reasons, ['확대 MDD 15% 초과']);
});

test('T-040 전진 평가: 시작 전 봉은 매매하지 않고, 긴 상승장에서만 확대', () => {
  const from = BULL_BOOST.forwardFrom - 400 * UNIT;
  const rising = (base) => (i) => base * (1 + 0.003 * i + 0.04 * Math.sin(i / 7));
  const data = { 'KRW-BTC': make(700, from, rising(1e8)), 'KRW-ETH': make(700, from, rising(5e6)), 'KRW-XRP': make(700, from, rising(3e3)) };
  const r = evaluateBoost(data, BULL_BOOST.forwardFrom);
  assert.equal(r.base.bars, 300);
  assert.ok(r.base.trades > 0);
  assert.equal(r.base.boosted, 0);
  assert.ok(r.boost.boosted > 0, '긴 상승장에서는 확대');
  assert.ok(['충족', '미충족'].includes(r.verdict));
  assert.throws(() => evaluateBoost(data, from), /준비 봉/);
});

test('T-040 관찰: 시작 전이면 평가하지 않고, 진행 중 봉 제외', async () => {
  const from = BULL_BOOST.forwardFrom - 400 * UNIT;
  const bars = make(401, from, (i) => 1e8 + i);
  const client = { async candlesRange() { return bars; } };
  assert.equal((await observeBoost({ client, now: BULL_BOOST.forwardFrom + UNIT / 2 })).started, false);
});
