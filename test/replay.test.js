import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verify, verifyReport } from '../src/sim/replay.js';
import { Trader } from '../src/trader.js';
import { buildConfig } from '../src/config.js';

// 재현 가능한 가상 시세 (backtest.test.js와 같은 생성기)
function synth(seed, n = 600) {
  let a = seed;
  const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const g = () => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
  const out = []; let p = 100_000_000, left = 0, drift = 0;
  const t0 = Date.UTC(2026, 0, 1);
  for (let i = 0; i < n; i++) {
    if (left-- <= 0) { const x = r(); drift = (x < 0.4 ? 1 : x < 0.66 ? -1 : 0) * 0.011 * (0.12 + r() * 0.22); left = 25 + Math.floor(r() * 55); }
    const o = p, c = o * Math.exp(drift + 0.011 * g());
    out.push({ t: t0 + i * 4 * 3600e3, o, h: Math.max(o, c) * (1 + Math.abs(g()) * 0.005), l: Math.min(o, c) * (1 - Math.abs(g()) * 0.005), c, v: 100 * (1 + Math.abs(g())) });
    p = c;
  }
  return out;
}

const cfg = buildConfig({ MAX_POSITION_KRW: '10000000' });

test('리플레이(실매매 코드)와 백테스트가 같은 거래를 낸다', async () => {
  for (const seed of [1, 2, 3]) {
    const v = await verify(synth(seed), cfg);
    assert.ok(v.replay.trades > 0, `seed ${seed}: 거래 없음`);
    assert.equal(v.replay.errors.length, 0, JSON.stringify(v.replay.errors[0]));
    assert.ok(v.pass, `seed ${seed}: 진입 ${v.entryMatch}, 청산 ${v.routeMatch}`);
  }
});

test('돌파 전략·국면 필터 끔에서도 일치', async () => {
  const bo = buildConfig({ MAX_POSITION_KRW: '10000000', STRATEGY: 'breakout', REGIME_FILTER: 'off' });
  const v = await verify(synth(4), bo);
  assert.ok(v.pass, `진입 ${v.entryMatch}, 청산 ${v.routeMatch}`);
});

test('실매매 코드에 버그가 있으면 불일치로 잡아낸다', async () => {
  const orig = Trader.prototype.checkPosition;
  Trader.prototype.checkPosition = async function () {}; // 손절가·목표가 감시가 고장난 상황
  try {
    const v = await verify(synth(1), cfg);
    assert.equal(v.pass, false);
  } finally {
    Trader.prototype.checkPosition = orig;
  }
});

test('보고서에 판정과 거래 수가 들어간다', async () => {
  const d = synth(2);
  const v = await verify(d, cfg);
  const md = verifyReport(v, d, cfg);
  assert.match(md, /판정: 통과/);
  assert.match(md, new RegExp(`\\| 거래 수 \\| ${v.replay.trades} \\| ${v.backtest.trades} \\|`));
});
