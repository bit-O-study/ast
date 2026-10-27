import { test } from 'node:test';
import assert from 'node:assert/strict';
import score from '../src/strategies/score.js';
import { STRATEGIES } from '../src/strategies/index.js';
import { buildConfig } from '../src/config.js';
import { verify } from '../src/sim/replay.js';

for (const gap of [0, 2]) test(`보유기간 경계: 첫 보유봉 마감은1봉, 공백${gap}봉도 실제 시각으로 일치`, async () => {
  const unit = 14400000;
  const d = Array.from({ length: 212 }, (_, i) => ({ t: (i + (i >= 202 ? gap : 0)) * unit,
    o: 100, c: 100, h: 100.1, l: i === 203 ? 99.85 : 99.9, v: 100 }));
  const id = 'holding_probe', previous = STRATEGIES[id];
  STRATEGIES[id] = { ...score, id, name: '보유기간 경계 검증',
    evaluate({ d }, i) { return { enter: d[i].t === 200 * unit, score: 50, parts: [], trend: true, adx: 30, rsi: 50, note: '경계 검증' }; },
  };
  try {
    const cfg = buildConfig({ MODE: 'paper', STRATEGY: id, REGIME_FILTER: 'off', MAX_HOLD_BARS: String(2 + gap),
      FEE_RATE: '0', SLIPPAGE: '0', MIN_RR: '.1' });
    const v = await verify(d, cfg);
    assert.equal(v.replay.errors.length, 0);
    assert.equal(v.pairs.length, 1);
    assert.equal(v.pairs[0].r.entryIdx, 201);
    assert.equal(v.pairs[0].r.exitIdx, 203);
    assert.equal(v.pairs[0].b.exitIdx, 203);
    assert.equal(v.pairs[0].sameRoute, true);
    assert.equal(v.pass, true);
  } finally {
    if (previous) STRATEGIES[id] = previous; else delete STRATEGIES[id];
  }
});
