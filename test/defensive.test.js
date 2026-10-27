import { test } from 'node:test';
import assert from 'node:assert/strict';
import defensive from '../src/strategies/defensive.js';
import { planEntry } from '../src/strategy.js';
import { buildConfig } from '../src/config.js';
import { decisionHtml } from '../web/decision.js';

const cfg = buildConfig({ STRATEGY: 'defensive', FEE_RATE: '0.0004' });
const fixture = () => {
  const d = Array.from({ length: 100 }, (_, i) => ({ t: i * 14400000, o: 99, c: 100, l: 97, h: 101, v: 100 }));
  const values = { s20: 98, s60: 95, atr: 2, adx: 30, pdi: 30, ndi: 15, rsi: 60, hist: 1,
    bbL: 90, bbU: 110, bw: 20, obv: 200, obvE: 100, vavg: 100, mfi: 60, vwap: 98 };
  const I = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Array(100).fill(v)]));
  I.s20[96] = 97;
  return { d, I };
};

test('방어형: 높은 점수만으로 약세 방향·과열·단발 신호를 통과시키지 않음', () => {
  const ctx = fixture();
  assert.equal(defensive.evaluate(ctx, 99, cfg).enter, true);
  for (const [key, value] of [['adx', 24.9], ['ndi', 40], ['s60', 101], ['rsi', 71], ['atr', .1], ['hist', NaN]]) {
    const x = fixture(); x.I[key][99] = value;
    assert.equal(defensive.evaluate(x, 99, cfg).enter, false, key);
  }
  const x = fixture(); x.I.hist[98] = -20; x.I.rsi[98] = 0; x.I.obv[98] = 0;
  assert.equal(defensive.evaluate(x, 99, cfg).analysis.checks[0].ok, false);
});

test('방어형: 미래 봉 추가와 무관하며 결측·평탄 시세는 유한한 관망 결과', () => {
  const d = Array.from({ length: 140 }, (_, i) => ({ t: i, o: 100+i*.1, c: 101+i*.1, h: 102+i*.1, l: 99+i*.1, v: 100+i }));
  assert.deepEqual(defensive.evaluate(defensive.prepare(d), 90, cfg), defensive.evaluate(defensive.prepare(d.slice(0, 91)), 90, cfg));
  const flat = d.map(b => ({ ...b, o: 100, c: 100, h: 100, l: 100, v: 0 }));
  const r = defensive.evaluate(defensive.prepare(flat), 99, cfg);
  assert.equal(r.enter, false);
  assert.ok(Number.isFinite(r.score));
  assert.ok(Number.isFinite(r.adx));
});

test('방어형 주문: 갭·이평 이탈·가까운 저항 차단, 기존 전략 유지', () => {
  const { d, I } = fixture();
  assert.match(planEntry(d, I, 99, 102, cfg).reason, /추격/);
  assert.match(planEntry(d, I, 99, 98, cfg).reason, /이평/);
  d[90].h = 100.5;
  d.forEach(b => { b.h = 100.5; });
  assert.equal(planEntry(d, I, 99, 100, cfg).ok, false);
  assert.equal(planEntry(d, I, 99, 100, { ...cfg, strategy: 'score' }).ok, true);
});

test('방어형 주문: 비용 포함 순손익비와 유효성 검사', () => {
  const { d, I } = fixture(); d.forEach(b => { b.h = 100; });
  const p = planEntry(d, I, 99, 100, cfg);
  assert.equal(p.ok, true);
  assert.ok(p.netRR >= cfg.minRR && p.netRR < cfg.t1R);
  assert.equal(planEntry(d, I, 99, 100, { ...cfg, fee: .02 }).ok, false);
  assert.equal(planEntry(d, I, 99, NaN, cfg).ok, false);
  assert.equal(planEntry(d, I, 99, 100, { ...cfg, fee: -1 }).ok, false);
});

test('방어형 화면: 필수 기준 수치와 관망 이유, HTML 이스케이프', () => {
  const r = defensive.evaluate(fixture(), 99, cfg);
  const html = decisionHtml(r.analysis);
  assert.match(html, /2봉 연속/); assert.match(html, /30.00/); assert.match(html, /성공 확률이 아닙니다/);
  r.analysis.checks[0].reason = '<script>악성</script>';
  assert.ok(!decisionHtml(r.analysis).includes('<script>'));
});
