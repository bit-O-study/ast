import test from 'node:test';
import assert from 'node:assert/strict';
import score from '../src/strategies/score.js';
import { recovered, PULLBACK_RECOVERY } from '../src/research/pullback-recovery.js';

test('눌림 회복: RSI30 경계와 교차 사건만 허용', () => {
  const ctx = { d: [{}, {}, {}, {}], I: { rsi: [29, 30, 31, 32] } };
  assert.equal(recovered(ctx, 1, 'rsi'), false);
  assert.equal(recovered(ctx, 2, 'rsi'), true);
  assert.equal(recovered(ctx, 3, 'rsi'), false);
});
test('눌림 회복: 밴드/평균은 각 봉 기준, 평균은 상승 배열 필수', () => {
  const ctx = { d: [{ c: 90 }, { c: 101 }], I: { bbL: [90, 100], s20: [90, 100], s60: [80, 99] } };
  assert.equal(recovered(ctx, 1, 'band'), true);
  assert.equal(recovered(ctx, 1, 'average'), true);
  ctx.I.s60[1] = 100;
  assert.equal(recovered(ctx, 1, 'average'), false);
  ctx.d[1].c = 100;
  assert.equal(recovered(ctx, 1, 'band'), false);
});
test('눌림 회복: 미래 봉 변경에 불변이며 공통 손절 점수 보존', () => {
  const d = Array.from({ length: 220 }, (_, i) => {
    const c = 100 + i / 10 + Math.sin(i) * 5;
    return { t: i * 14400000, o: c, c, h: c + 1, l: c - 1, v: 100 + i };
  });
  const changed = d.map((b, i) => i > 200 ? { ...b, c: b.c * 10, h: b.h * 10 } : b);
  const cfg = { entryScore: 35 };
  for (const strategy of Object.values(PULLBACK_RECOVERY)) {
    const signal = strategy.evaluate(strategy.prepare(d), 200, cfg);
    assert.deepEqual(signal, strategy.evaluate(strategy.prepare(changed), 200, cfg));
    assert.equal(signal.score, score.evaluate(score.prepare(d), 200, cfg).score);
  }
});
