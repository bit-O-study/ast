import { test } from 'node:test';
import assert from 'node:assert/strict';
import score from '../src/strategies/score.js';
import { buildConfig } from '../src/config.js';
import { ENTRY_FILTERS, entryFilter } from '../src/research/entry-filters.js';

const cfg = buildConfig({});
const candles = () => Array.from({ length: 240 }, (_, i) => ({ t: i * 14400000,
  o: 1000 + i, c: 1001 + i, h: 1003 + i, l: 998 + i, v: 100 + i % 7 }));

test('진입 필터: 미래 봉 변경과 절단이 과거 신호에 영향을 주지 않는다', () => {
  const d = candles(), i = 180;
  const changed = d.map((b, j) => j <= i ? b : { ...b, c: b.c * 100, h: b.h * 100, v: b.v * 100 });
  for (const candidate of Object.values(ENTRY_FILTERS)) {
    const original = candidate.evaluate(candidate.prepare(d), i, cfg);
    assert.deepEqual(candidate.evaluate(candidate.prepare(d.slice(0, i + 1)), i, cfg), original);
    assert.deepEqual(candidate.evaluate(candidate.prepare(changed), i, cfg), original);
    assert.equal(candidate.evaluate(candidate.prepare(d), 124, cfg).enter, false);
  }
});

test('효율성 필터: 횡보·하락 거부, 상승 허용, 0.3 경계 포함', () => {
  const d = candles();
  assert.equal(entryFilter('efficiency', { d }, 180, cfg), true);
  const flat = d.map(b => ({ ...b, c: 100 }));
  assert.equal(entryFilter('efficiency', { d: flat }, 180, cfg), false);
  assert.equal(entryFilter('efficiency', { d: d.map((b, i) => ({ ...b, c: 2000 - i })) }, 180, cfg), false);
  const boundary = flat.map(b => ({ ...b }));
  boundary[161].c = 106.5;
  for (let i = 162; i <= 180; i++) boundary[i].c = 103;
  assert.equal(entryFilter('efficiency', { d: boundary }, 180, cfg), true);
  boundary[180].c = 102.99;
  assert.equal(entryFilter('efficiency', { d: boundary }, 180, cfg), false);
});

test('신호 지속성: 현재만 충족하면 거부하고 연속3봉을 요구한다', () => {
  const ctx = score.prepare(candles()), i = 180;
  const points = [i - 2, i - 1, i].map(j => score.evaluate(ctx, j, cfg).score);
  assert.equal(entryFilter('persistence', ctx, i, { ...cfg, entryScore: Math.min(...points) }), true);
  assert.equal(entryFilter('persistence', ctx, i, { ...cfg, entryScore: Math.max(...points) + 1 }), false);
  const copy = { ...ctx, I: { ...ctx.I, hist: [...ctx.I.hist] } };
  copy.I.hist[i - 2] = -1e6;
  copy.I.hist[i] = 1e6;
  const threshold = (score.evaluate(copy, i - 2, cfg).score + score.evaluate(copy, i, cfg).score) / 2;
  assert.equal(score.evaluate(copy, i, { ...cfg, entryScore: threshold }).enter, true);
  assert.equal(entryFilter('persistence', copy, i, { ...cfg, entryScore: threshold }), false);
});

test('장기 추세: 평균 아래 또는 하락 추세는 진입하지 않는다', () => {
  assert.equal(entryFilter('longTrend', { d: candles() }, 180, cfg), true);
  const falling = candles().map((b, i) => ({ ...b, c: 2000 - i }));
  assert.equal(entryFilter('longTrend', { d: falling }, 180, cfg), false);
});
