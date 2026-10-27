import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indicators } from '../src/indicators.js';
import { indicatorDetail } from '../src/analysis/detail.js';
import { getStrategy } from '../src/strategies/index.js';
import score from '../src/strategies/score.js';
import breakout from '../src/strategies/breakout.js';
import structure from '../src/strategies/structure.js';
import defensive from '../src/strategies/defensive.js';
import { buildConfig } from '../src/config.js';
import { decisionHtml } from '../web/decision.js';

const bars = (n = 150) => Array.from({ length: n }, (_, i) => {
  const c = 100 + i / 10 + Math.sin(i / 3);
  return { t: i * 14400000, o: c - .2, h: c + 1, l: c - 2, c, v: 100 + i };
});
const items = result => Object.fromEntries(result.groups.flatMap(g => g.items).map(r => [r.key, r]));

test('지표 6분류18항목: 거래량 기준에서 현재 봉 제외, CMF·고가 위치 수식', () => {
  const d = bars(100); d[99].v = 10000;
  const r = indicatorDetail(d, indicators(d), 99), rows = items(r);
  assert.equal(r.groups.length, 6); assert.equal(Object.keys(rows).length, 18);
  const avg = d.slice(79, 99).reduce((s, b) => s + b.v, 0) / 20;
  assert.equal(rows.relativeVolume.value, 10000 / avg);
  assert.ok(Math.abs(rows.cmf.value - 1 / 3) < 1e-12);
  assert.equal(rows.breakoutGap.value, (d[99].c / Math.max(...d.slice(79,99).map(b=>b.h)) - 1) * 100);
});

test('지표 상세: 미래 봉으로 과거 관측값이 바뀌지 않음', () => {
  const d = bars(), cut = d.slice(0, 101);
  assert.deepEqual(indicatorDetail(d, indicators(d), 100), indicatorDetail(cut, indicators(cut), 100));
});

test('지표 상세: 준비 부족과 분모0을 중립·충족으로 표시하지 않음', () => {
  const d = bars(100).map(b => ({ ...b, o: 100, h: 100, l: 100, c: 100, v: 0 }));
  const r = indicatorDetail(d, indicators(d), 99), rows = items(r);
  for (const key of ['relativeVolume', 'cmf', 'diGap', 'bandPosition', 'vwapGap', 'rangeAtr']) {
    assert.equal(rows[key].value, null, key); assert.equal(rows[key].state, '자료 부족', key);
  }
  assert.equal(items(indicatorDetail(d, indicators(d), 3)).breakoutGap.value, null);
  assert.equal(JSON.stringify(r).includes('NaN'), false);
});

test('모든 전략: 상세 관측 추가 전후 매수·점수·기존 분석 불변', () => {
  const d = bars();
  for (const raw of [score, breakout, structure, defensive]) {
    const cfg = buildConfig({ STRATEGY: raw.id }), wrapped = getStrategy(raw.id), ctx = wrapped.prepare(d);
    for (let i = 60; i < d.length; i++) {
      const original = raw.evaluate(ctx, i, cfg), decorated = wrapped.evaluate(ctx, i, cfg);
      const { details, ...oldAnalysis } = decorated.analysis;
      assert.equal(details.groups.length, 6);
      if (original.analysis) decorated.analysis = oldAnalysis;
      else delete decorated.analysis;
      assert.deepEqual(decorated, original, `${raw.id} ${i}`);
    }
  }
});

test('지표 상세 화면: 구형 응답 호환·6분류·이스케이프·참고용 설명', () => {
  const d = bars(), details = indicatorDetail(d, indicators(d), 100);
  const html = decisionHtml({ kind: 'indicators', details });
  assert.equal((html.match(/<details>/g) || []).length, 6);
  assert.match(html, /18항목/); assert.match(html, /참고 관측/);
  details.groups[0].items[0].meaning = '<img src=x onerror=alert(1)>';
  assert.ok(!decisionHtml({ kind: 'indicators', details }).includes('<img'));
  assert.equal(decisionHtml({ kind: 'indicators' }), '');
});
