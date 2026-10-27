import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConfig } from '../src/config.js';
import { QUALITY_STRATEGIES, qualityGate } from '../src/research/entry-quality.js';

function context() {
  const d = Array.from({ length: 240 }, (_, i) => ({ t: i * 14400000, o: 1000 + i, c: 1001 + i, h: 1002 + i, l: 998 + i, v: 100 + i % 11 }));
  return QUALITY_STRATEGIES.research_extension.prepare(d);
}

test('과열 제한: 2ATR·RSI70 경계, 평균 아래·지표 부족 거부', () => {
  const ctx = context(), i = 180;
  ctx.I.s20[i] = 100; ctx.I.atr[i] = 10; ctx.I.rsi[i] = 70; ctx.d[i].c = 120;
  assert.equal(qualityGate('extension', ctx, i), true);
  ctx.d[i].c = 120.001;
  assert.equal(qualityGate('extension', ctx, i), false);
  ctx.d[i].c = 100;
  assert.equal(qualityGate('extension', ctx, i), false);
  ctx.d[i].c = 110; ctx.I.rsi[i] = 70.001;
  assert.equal(qualityGate('extension', ctx, i), false);
  ctx.I.rsi[i] = 60; ctx.I.atr[i] = NaN;
  assert.equal(qualityGate('extension', ctx, i), false);
});

test('종가 강도: 상위25% 경계·음봉·폭0 거부', () => {
  const ctx = context(), i = 180;
  ctx.d[i] = { o: 102, c: 103, l: 100, h: 104 };
  assert.equal(qualityGate('closeStrength', ctx, i), true);
  ctx.d[i].c = 102.999;
  assert.equal(qualityGate('closeStrength', ctx, i), false);
  ctx.d[i].c = 103; ctx.d[i].o = 103.5;
  assert.equal(qualityGate('closeStrength', ctx, i), false);
  ctx.d[i] = { o: 100, c: 100, h: 100, l: 100 };
  assert.equal(qualityGate('closeStrength', ctx, i), false);
});

test('추세 강화: 양의 MACD 증가와 ADX 비감소 모두 필요', () => {
  const ctx = context(), i = 180;
  ctx.I.hist[i] = 2; ctx.I.hist[i - 1] = 1; ctx.I.adx[i] = 25; ctx.I.adx[i - 1] = 25;
  assert.equal(qualityGate('acceleration', ctx, i), true);
  ctx.I.hist[i] = 1;
  assert.equal(qualityGate('acceleration', ctx, i), false);
  ctx.I.hist[i] = 2; ctx.I.adx[i] = 24.99;
  assert.equal(qualityGate('acceleration', ctx, i), false);
  ctx.I.hist[i] = 0; ctx.I.hist[i - 1] = -1; ctx.I.adx[i] = 26;
  assert.equal(qualityGate('acceleration', ctx, i), false);
});

test('전 후보 미래참조 없음·준비 부족 거부·기존 점수 기준 보존', () => {
  const { d } = context(), cfg = buildConfig({}), i = 180;
  for (const candidate of Object.values(QUALITY_STRATEGIES)) {
    const expected = candidate.evaluate(candidate.prepare(d), i, cfg);
    const changed = d.map((b, j) => j <= i ? b : { ...b, c: b.c * 100, h: b.h * 100, v: b.v * 100 });
    assert.deepEqual(candidate.evaluate(candidate.prepare(changed), i, cfg), expected);
    assert.deepEqual(candidate.evaluate(candidate.prepare(d.slice(0, i + 1)), i, cfg), expected);
    assert.equal(candidate.evaluate(candidate.prepare(d), 124, cfg).enter, false);
    assert.equal(candidate.evaluate(candidate.prepare(d), i, { ...cfg, entryScore: 101 }).enter, false);
  }
});
