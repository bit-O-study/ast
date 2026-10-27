import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConfig } from '../src/config.js';
import { ENTRY_FILTERS, entryFilter } from '../src/research/entry-filters.js';
import { PERSISTENT_STRATEGIES, PERSISTENT_PROFILES } from '../src/research/persistent-profiles.js';

const make = wave => Array.from({ length: 240 }, (_, i) => {
  const c = 1000 + (wave ? Math.sin(i) * 20 : i);
  return { t: i * 14400000, c, o: c - 1, h: c + 3, l: c - 3, v: 100 + i % 11 };
});
const candidate = PERSISTENT_STRATEGIES.research_persistentEfficient;

test('조합 진입: 지속 신호 또는 효율성 하나만 충족하면 거부', () => {
  const low = buildConfig({ ENTRY_SCORE: '-100' });
  const rising = candidate.prepare(make(false)), choppy = candidate.prepare(make(true));
  const i = 180;
  assert.equal(ENTRY_FILTERS.research_persistence.evaluate(choppy, i, low).enter, true);
  assert.equal(entryFilter('efficiency', choppy, i, low), false);
  assert.equal(candidate.evaluate(choppy, i, low).enter, false);
  const high = buildConfig({ ENTRY_SCORE: '100' });
  assert.equal(entryFilter('efficiency', rising, i, high), true);
  assert.equal(candidate.evaluate(rising, i, high).enter, false);
  assert.equal(candidate.evaluate(rising, i, low).enter, true);
});

test('조합 진입: 미래 봉 변경·절단에도 과거 신호 유지, 원본 전략 보존', () => {
  const d = make(true), cfg = buildConfig({ ENTRY_SCORE: '-100' }), i = 180;
  const original = ENTRY_FILTERS.research_persistence.evaluate;
  const expected = candidate.evaluate(candidate.prepare(d), i, cfg);
  const changed = d.map((b, j) => j <= i ? b : { ...b, c: b.c * 10, h: b.h * 10, v: b.v * 100 });
  assert.deepEqual(candidate.evaluate(candidate.prepare(changed), i, cfg), expected);
  assert.deepEqual(candidate.evaluate(candidate.prepare(d.slice(0, i + 1)), i, cfg), expected);
  assert.equal(ENTRY_FILTERS.research_persistence.evaluate, original);
  assert.equal(ENTRY_FILTERS.research_persistence.id, 'research_persistence');
});

test('모든 연구 프로필은 최초 위험·자금·손절 한도를 유지한다', () => {
  const baseline = buildConfig({});
  for (const p of PERSISTENT_PROFILES) {
    const cfg = buildConfig({ STRATEGY: p.strategy, ...p.env });
    for (const key of ['risk', 'paperKrw', 'maxPositionKrw', 'stopAtr', 'breachAtr']) assert.equal(cfg[key], baseline[key]);
    assert.equal(cfg.mode, 'paper');
    assert.equal(cfg.scaleIn, false);
  }
});
