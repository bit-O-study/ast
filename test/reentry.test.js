import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reentryAllowed } from '../src/reentry.js';
import { buildConfig } from '../src/config.js';
import { verify } from '../src/sim/replay.js';
import { STRATEGIES } from '../src/strategies/index.js';

test('재진입 대기: 기본값 불변·마감봉 기준6봉 경계', () => {
  const cfg = buildConfig({ LOSS_COOLDOWN_BARS: '6' }), unit = cfg.unit * 60000;
  assert.equal(reentryAllowed(null, unit, cfg), true);
  assert.equal(reentryAllowed(0, unit * 5, cfg), false);
  assert.equal(reentryAllowed(0, unit * 6 - 1, cfg), false);
  assert.equal(reentryAllowed(0, unit * 6, cfg), true);
  assert.equal(reentryAllowed(0, NaN, cfg), false);
  assert.equal(reentryAllowed(unit, 0, buildConfig({})), true);
  for (const n of ['-1', '1.5', '241']) assert.throws(() => buildConfig({ LOSS_COOLDOWN_BARS: n }), /0~240/);
  assert.throws(() => buildConfig({ MODE: 'live', LOSS_COOLDOWN_BARS: '6' }), /paper/);
});

test('손실 대기 후 재진입: 백테스트와 Trader 모의 경로 일치', async () => {
  const original = STRATEGIES.score.evaluate;
  STRATEGIES.score.evaluate = () => ({ enter: true, score: 100, parts: [], trend: true, adx: 30, rsi: 55, note: '검증 신호' });
  try {
    const cfg = buildConfig({ LOSS_COOLDOWN_BARS: '6', REGIME_FILTER: 'off', MIN_RR: '.1', FEE_RATE: '.0004' });
    const d = Array.from({ length: 300 }, (_, i) => ({ t: i * 14400000, o: 100000, c: 100000,
      h: 100100, l: i % 10 === 5 ? 90000 : 99900, v: 100 }));
    const v = await verify(d, cfg);
    assert.equal(v.entryMatch, 1); assert.equal(v.routeMatch, 1);
    assert.equal(v.replay.errors.length, 0);
    assert.ok(v.pairs.length >= 2);
    assert.ok(v.pairs.every(p => p.r.pnl < 0));
    for (let i = 1; i < v.pairs.length; i++) assert.ok(v.pairs[i].r.entryIdx - v.pairs[i - 1].r.exitIdx >= 6);
  } finally { STRATEGIES.score.evaluate = original; }
});
