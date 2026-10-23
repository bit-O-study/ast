import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRATEGIES, getStrategy } from '../src/strategies/index.js';
import { buildConfig } from '../src/config.js';

const cfg = buildConfig({});
const base = (n) => Array.from({ length: n }, (_, i) => {
  const c = 100 + Math.sin(i / 3) * 2 + i * 0.05;
  return { t: i, o: c - 0.3, h: c + 0.5, l: c - 0.8, c, v: 100 };
});

test('모든 전략이 C4 인터페이스를 따른다', () => {
  const d = base(120);
  for (const s of Object.values(STRATEGIES)) {
    assert.equal(typeof s.id, 'string');
    assert.equal(typeof s.name, 'string');
    assert.ok(s.minBars >= 60);
    const ctx = s.prepare(d);
    assert.ok(ctx.I && ctx.I.atr && ctx.I.s20, `${s.id}: ctx.I 필요`);
    const r = s.evaluate(ctx, 119, cfg);
    for (const k of ['enter', 'score', 'parts', 'trend', 'note']) assert.ok(k in r, `${s.id}: ${k} 없음`);
    assert.equal(typeof r.enter, 'boolean');
  }
});

test('없는 전략 이름은 사용 가능한 목록과 함께 오류', () => {
  assert.throws(() => getStrategy('nope'), /score, breakout/);
});

test('score 전략: 점수가 기준 이상일 때만 진입', () => {
  const s = getStrategy('score'), d = base(120), ctx = s.prepare(d);
  for (let i = 60; i < 120; i++) {
    const r = s.evaluate(ctx, i, cfg);
    assert.equal(r.enter, r.score >= cfg.entryScore);
  }
});

test('breakout 전략: 20봉 고가를 거래량과 함께 돌파하면 진입', () => {
  const s = getStrategy('breakout');
  const d = base(120);
  // 마지막 봉: 강한 상승 + 거래량 3배
  const last = d[119];
  Object.assign(last, { o: 104, c: 112, h: 112.5, l: 103.8, v: 300 });
  const r = s.evaluate(s.prepare(d), 119, cfg);
  const I = s.prepare(d).I;
  if (I.adx[119] > 20) assert.equal(r.enter, true, r.note);
  // 거래량이 평소 수준이면 진입하지 않음
  last.v = 100;
  const r2 = s.evaluate(s.prepare(d), 119, cfg);
  assert.equal(r2.enter, false);
  assert.match(r2.note, /거래량 부족/);
});
