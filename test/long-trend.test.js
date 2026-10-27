import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LONG_TREND_STRATEGIES, longTrendGate } from '../src/research/long-trend.js';
import { buildConfig } from '../src/config.js';

const make = () => Array.from({ length: 500 }, (_, i) => {
  const c = 1000 + i + Math.sin(i / 7) * 10;
  return { t: i * 14400000, c, o: c - 1, h: c + 3, l: c - 4, v: 100 + i % 13 };
});

test('월간 추세: 준비 전 거부, 평균 동일 경계 거부, 상승 허용', () => {
  const d = make();
  for (const kind of ['slopeMonth', 'aboveMonth', 'alignedMonth']) {
    const candidate = LONG_TREND_STRATEGIES[`research_${kind}`];
    const ctx = candidate.prepare(d), first = kind === 'slopeMonth' ? 149 : 179;
    assert.equal(longTrendGate(kind, ctx, first - 1), false);
    assert.equal(longTrendGate(kind, ctx, first), true);
    if (kind === 'slopeMonth') ctx.month20[first] = ctx.month20[first - 30];
    if (kind === 'aboveMonth') ctx.month30[first] = ctx.d[first].c;
    if (kind === 'alignedMonth') ctx.month30[first] = ctx.month20[first];
    assert.equal(longTrendGate(kind, ctx, first), false);
  }
});

test('월간 추세: 전체 이력과 실제200봉 창의 필터가 일치', () => {
  const d = make();
  for (const kind of ['slopeMonth', 'aboveMonth', 'alignedMonth']) {
    const candidate = LONG_TREND_STRATEGIES[`research_${kind}`], ctx = candidate.prepare(d);
    for (let i = 199; i < d.length; i++) {
      const window = candidate.prepare(d.slice(i - 199, i + 1));
      assert.equal(longTrendGate(kind, window, 199), longTrendGate(kind, ctx, i));
    }
  }
});

test('월간 추세: 미래 봉 변경·절단에도 과거 판단 불변', () => {
  const d = make(), cfg = buildConfig({}), i = 350;
  for (const candidate of Object.values(LONG_TREND_STRATEGIES)) {
    const expected = candidate.evaluate(candidate.prepare(d), i, cfg);
    const changed = d.map((b, j) => j <= i ? b : { ...b, c: b.c * 100, h: b.h * 100, v: b.v * 100 });
    assert.deepEqual(candidate.evaluate(candidate.prepare(changed), i, cfg), expected);
    assert.deepEqual(candidate.evaluate(candidate.prepare(d.slice(0, i + 1)), i, cfg), expected);
    assert.equal(candidate.evaluate(candidate.prepare(d), i, { ...cfg, entryScore: 101 }).enter, false);
  }
});
