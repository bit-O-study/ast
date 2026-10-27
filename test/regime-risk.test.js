import test from 'node:test';
import assert from 'node:assert/strict';
import score from '../src/strategies/score.js';
import { REGIME_RISK } from '../src/research/regime-risk.js';
const d = Array.from({ length: 220 }, (_, i) => ({ t: Date.UTC(2026, 0, 1, 15) + i * 14400000,
  o: 100 + i, c: 101 + i, h: 103 + i, l: 99 + i, v: 100 + i }));
const cfg = { unit: 240, entryScore: 1000 };
test('국면 진입: 공통 손절용 점수는 유지하고 일일 판정시각만 제한', () => {
  const ctx = score.prepare(d);
  for (let i = 200; i < 212; i++) {
    const base = score.evaluate(ctx, i, cfg);
    const daily = REGIME_RISK.research_regimeDaily.evaluate(ctx, i, cfg);
    const every = REGIME_RISK.research_regimeEvery.evaluate(ctx, i, cfg);
    assert.equal(every.enter, true);
    assert.equal(base.enter, false);
    assert.equal(daily.enter, (i + 1) % 6 === 2);
    assert.equal(daily.score, base.score);
    assert.deepEqual(daily.parts, base.parts);
  }
});
test('국면 진입: 미래 봉 가격 변경이 현재 신호에 영향 없음', () => {
  const changed = d.map((b, i) => i > 200 ? { ...b, o: b.o * 10, c: b.c * 10, h: b.h * 10, l: b.l * 10 } : b);
  for (const strategy of Object.values(REGIME_RISK)) {
    assert.deepEqual(strategy.evaluate(strategy.prepare(d), 200, cfg), strategy.evaluate(strategy.prepare(changed), 200, cfg));
  }
});
