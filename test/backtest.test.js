import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backtest } from '../src/backtest.js';
import { buildConfig } from '../src/config.js';

// 재현 가능한 가상 시세 (추세·횡보 구간 반복)
function synth(seed, n = 600) {
  let a = seed;
  const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const g = () => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
  const out = []; let p = 100_000_000, left = 0, drift = 0;
  for (let i = 0; i < n; i++) {
    if (left-- <= 0) { const x = r(); drift = (x < 0.4 ? 1 : x < 0.66 ? -1 : 0) * 0.011 * (0.12 + r() * 0.22); left = 25 + Math.floor(r() * 55); }
    const o = p, c = o * Math.exp(drift + 0.011 * g());
    out.push({ t: i * 4 * 3600e3, o, h: Math.max(o, c) * (1 + Math.abs(g()) * 0.005), l: Math.min(o, c) * (1 - Math.abs(g()) * 0.005), c, v: 100 * (1 + Math.abs(g())) });
    p = c;
  }
  return out;
}

const cfg = buildConfig({ MAX_POSITION_KRW: '10000000', REGIME_FILTER: 'off' });

test('모든 거래에 손절가·목표가가 있고, 손익 합계가 최종 자산 변화와 일치', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = backtest(synth(seed), cfg);
    assert.ok(r.trades.length > 0, `seed ${seed} 거래 없음`);
    for (const t of r.trades) {
      assert.ok(t.initialStop < t.entryPrice && t.entryPrice < t.t1 && t.t1 < t.t2);
      assert.equal(t.result, t.pnl > 0 ? '성공' : '실패');
    }
    const sum = r.trades.reduce((a, t) => a + t.pnl, 0);
    assert.ok(Math.abs(sum - r.stats.pnl) < 1, `seed ${seed}: ${sum} vs ${r.stats.pnl}`);
  }
});

test('거래당 손실은 대략 자본의 RISK_PER_TRADE 안쪽 (갭 하락 제외 여유 1.5배)', () => {
  const r = backtest(synth(7), cfg);
  for (const t of r.trades) assert.ok(t.pnl > -cfg.paperKrw * cfg.risk * 1.5, `${t.pnl}`);
});

test('미래 시세를 바꿔도 그 이전의 매매는 바뀌지 않는다 (미래 참조 없음)', () => {
  const d = synth(11);
  const cut = 400;
  const a = backtest(d, cfg);
  const d2 = d.map((b, i) => (i > cut ? { ...b, o: b.o * 1.3, h: b.h * 1.3, l: b.l * 1.3, c: b.c * 1.3 } : b));
  const b = backtest(d2, cfg);
  const before = (r) => r.trades.filter((t) => t.exitIdx < cut).map((t) => [t.entryIdx, t.exitIdx, Math.round(t.pnl)]);
  assert.deepEqual(before(a), before(b));
});

test('BTC 하락 국면에서는 신규 매수하지 않고, 막힌 신호를 기록한다', () => {
  const on = buildConfig({ MAX_POSITION_KRW: '10000000', REGIME_FILTER: 'btc' });
  for (const seed of [1, 2, 3]) {
    const d = synth(seed);
    const r = backtest(d, on);
    for (const t of r.trades) assert.equal(r.bull[t.entryIdx - 1], true, `seed ${seed}: 하락 국면 진입`);
    const off = backtest(d, cfg);
    assert.ok(r.trades.length <= off.trades.length);
    assert.ok(r.skipped.some((s) => s.reason === 'BTC 하락 국면'));
  }
});

test('BTC가 아닌 코인은 BTC 시세 없이 국면 필터를 쓸 수 없다', () => {
  const eth = buildConfig({ MARKET: 'KRW-ETH', REGIME_FILTER: 'btc' });
  assert.throws(() => backtest(synth(1), eth), /BTC 시세/);
  const r = backtest(synth(1), eth, { btc: synth(2) });
  assert.ok(r.regimeEnabled);
});

test('돌파 전략도 같은 손절가·목표가 규칙으로 백테스트된다', () => {
  const bo = buildConfig({ MAX_POSITION_KRW: '10000000', REGIME_FILTER: 'off', STRATEGY: 'breakout' });
  const r = backtest(synth(4), bo);
  assert.equal(r.strategy.id, 'breakout');
  for (const t of r.trades) assert.ok(t.initialStop < t.entryPrice && t.entryPrice < t.t1);
});
