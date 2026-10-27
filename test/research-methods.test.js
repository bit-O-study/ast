import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANDIDATES } from '../src/research/candidates.js';
import { validateCandles, segments, assess } from '../src/research/experiment.js';
import { STRATEGIES } from '../src/strategies/index.js';

const bars = (n = 1000) => Array.from({ length: n }, (_, i) => {
  const c = 100 + i * .1 + Math.sin(i / 3) * .1;
  return { t: i * 14400000, o: c - .2, c, h: c + .3, l: c - .3, v: 100 };
});

test('연구 후보: 운영 전략 목록을 변경하지 않으며 미래 데이터 불변', () => {
  const d = bars(250);
  for (const s of Object.values(CANDIDATES)) {
    assert.equal(STRATEGIES[s.id], undefined);
    assert.equal(s.evaluate(s.prepare(d), 129).enter, false);
    assert.deepEqual(s.evaluate(s.prepare(d), 200), s.evaluate(s.prepare(d.slice(0, 201)), 200));
  }
});

test('모멘텀 후보: 7일/21일 및 이평 기울기 모두 필요', () => {
  const s = CANDIDATES.research_momentum, d = bars(250), ctx = s.prepare(d);
  assert.equal(s.evaluate(ctx, 200).enter, true);
  ctx.d[74].c = 1000;
  assert.equal(s.evaluate(ctx, 200).enter, false);
  ctx.d[74].c = 100;
  ctx.I.s60[194] = 1000;
  assert.equal(s.evaluate(ctx, 200).enter, false);
});

test('돌파 후보: 이전55봉 고가 및 현재 제외 거래량 기준', () => {
  const s = CANDIDATES.research_channel, d = bars(250);
  d[200].c = 130; d[200].h = 131;
  assert.equal(s.evaluate(s.prepare(d), 200).enter, true);
  d[200].v = 99;
  assert.equal(s.evaluate(s.prepare(d), 200).enter, false);
  d[200].v = 100; d[145].h = 140;
  assert.equal(s.evaluate(s.prepare(d), 200).enter, false);
});

test('수축 후보: 이전폭 하위20%와 현재 확장·거래량 모두 필요', () => {
  const s = CANDIDATES.research_squeeze, d = bars(250), ctx = s.prepare(d);
  ctx.I.bw.fill(.04); ctx.I.bw[199] = .01; ctx.I.bw[200] = .02;
  ctx.I.bbU[200] = 110; d[200].v = 120;
  assert.equal(s.evaluate(ctx, 200).enter, true);
  ctx.I.bw[199] = .05;
  assert.equal(s.evaluate(ctx, 200).enter, false);
  ctx.I.bw[199] = .01; d[200].v = 119;
  assert.equal(s.evaluate(ctx, 200).enter, false);
});

test('시세 무결성: 중복·누락·잘못된 가격 검출', () => {
  assert.doesNotThrow(() => validateCandles(bars()));
  for (const bad of [d => d[1].t = d[0].t, d => d[1].t += 1, d => d[1].h = 1, d => d[1].c = NaN, d => d[1].v = -1]) {
    const d = bars(); bad(d); assert.throws(() => validateCandles(d));
  }
});

test('공백 구간 분리: 각 구간 준비200봉, 보간 없이 독립 분석', () => {
  const d = bars(6000).map((b,i) => ({ ...b, t: b.t + (i >= 2500 ? 14400000 : 0) + (i >= 4700 ? 14400000 : 0) })), result = segments(d);
  assert.deepEqual(result.map(s => s.d.length), [2500, 2200, 1300]);
  for (let k = 0; k < 3; k++) {
    assert.equal(result[k].d[200].t, result[k].from);
    assert.equal(result[k].d.at(-1).t, result[k].to);
    if (k) assert.equal(result[k].from - result[k - 1].to, 202 * 14400000);
  }
  assert.throws(() => segments(bars(6000)), /공백2개/);
});

test('승격 필요조건: 전체 기간 평균으로 취약 구간·비용·소표본을 덮지 않음', () => {
  const rows = [];
  for (const segment of ['중기', '최근']) for (const market of ['KRW-BTC', 'KRW-ETH', 'KRW-XRP']) {
    for (const [strategy, cost, ret] of [['candidate','기본',2], ['score','기본',1], ['candidate','스트레스',1]]) {
      rows.push({ segment, market, strategy, cost, ret, pnl: ret * 1000, mdd: 1, trades: 5 });
    }
  }
  assert.equal(assess(rows, 'candidate').pass, true);
  const weak = structuredClone(rows); weak.filter(r => r.cost === '스트레스' && r.segment === '최근').forEach(r => r.ret = -1);
  assert.equal(assess(weak, 'candidate').pass, false);
  const sparse = rows.map(r => ({ ...r, trades: 1 }));
  assert.equal(assess(sparse, 'candidate').pass, false);
  assert.equal(assess(rows.slice(1), 'candidate').pass, false);
});
