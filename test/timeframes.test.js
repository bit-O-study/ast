import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateClosed, higherSignal, TIMEFRAME_STRATEGIES } from '../src/research/timeframes.js';
import { buildConfig } from '../src/config.js';

const BASE = 14400000, start = Date.UTC(2025, 0, 1) - 9 * 3600000;
const make = (n = 450) => Array.from({ length: n }, (_, i) => {
  const c = 1000 + i / 2 + Math.sin(i / 9) * 25;
  return { t: start + i * BASE, o: c - 1, c, h: c + 3, l: c - 4, v: 100 + i % 7 };
});

test('집계: KST0시 경계와 OHLCV, 미완성 최초·마지막 묶음 제외', () => {
  const d = make(8), r = aggregateClosed(d, 3);
  assert.equal(r.bars.length, 2);
  assert.deepEqual([...r.atClose], [[2, 0], [5, 1]]);
  assert.deepEqual(r.bars[0], { t: start, o: d[0].o, h: Math.max(...d.slice(0, 3).map(b => b.h)),
    l: Math.min(...d.slice(0, 3).map(b => b.l)), c: d[2].c, v: d[0].v + d[1].v + d[2].v });
  assert.equal(aggregateClosed(d.slice(1), 3).bars.length, 1);
  assert.equal(aggregateClosed(d.slice(0, 2), 3).bars.length, 0);
});

test('집계: 공백 묶음 미사용·중복/역순/정렬 오류 거부', () => {
  const d = make(9);
  assert.deepEqual(aggregateClosed(d.filter((_, i) => i !== 1), 3).bars.map(b => b.t), [start + 3 * BASE, start + 6 * BASE]);
  assert.throws(() => aggregateClosed([d[0], d[0]], 2), /시세 오류/);
  assert.throws(() => aggregateClosed([...d].reverse(), 2), /시세 오류/);
  assert.throws(() => aggregateClosed([{ ...d[0], t: start + 1 }], 2), /시세 오류/);
  assert.throws(() => aggregateClosed(d, 4), /배수/);
});

test('집계 신호: 마감 때만 진입·63봉 준비·중간 공백은 신호 차단', () => {
  const strategy = TIMEFRAME_STRATEGIES.research_h12_c3, d = make(), cfg = buildConfig({ ENTRY_SCORE: '-1000' });
  const ctx = strategy.prepare(d);
  assert.equal(strategy.evaluate(ctx, 185, cfg).enter, false);
  assert.equal(strategy.evaluate(ctx, 188, cfg).enter, true);
  assert.equal(strategy.evaluate(ctx, 189, cfg).enter, false);
  const hole = d.filter((_, i) => i !== 90), g = strategy.prepare(hole);
  assert.equal(higherSignal(g, 199, 3, -1000).enter, false);
});

test('집계 신호:200봉 창·전체 이력·잘린 이력·미래 변경 결과 동일', () => {
  const d = make(), cfg = buildConfig({});
  for (const strategy of Object.values(TIMEFRAME_STRATEGIES)) {
    const full = strategy.prepare(d), confirmation = strategy.id.endsWith('c3') ? 3 : 1;
    for (let i = 199; i < d.length; i++) {
      const expected = higherSignal(full, i, confirmation, cfg.entryScore);
      const window = strategy.prepare(d.slice(i - 199, i + 1));
      assert.deepEqual(higherSignal(window, 199, confirmation, cfg.entryScore), expected);
    }
    const i = 299, expected = strategy.evaluate(full, i, cfg);
    assert.deepEqual(strategy.evaluate(strategy.prepare(d.slice(0, i + 1)), i, cfg), expected);
    const changed = d.map((b, j) => j <= i ? b : { ...b, o: b.o * 100, c: b.c * 100, h: b.h * 100, l: b.l * 100, v: b.v * 100 });
    assert.deepEqual(strategy.evaluate(strategy.prepare(changed), i, cfg), expected);
  }
});
