import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ridgeFit, ridgePredict, trainingSet, forecast, costThreshold, FORECAST_STRATEGIES } from '../src/research/rolling-forecast.js';
import { buildConfig } from '../src/config.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const make = () => Array.from({ length: 350 }, (_, i) => {
  const c = 1000 + i / 2 + Math.sin(i / 7) * 30;
  return { t: i * 14400000, c, o: c - 1, h: c + 3, l: c - 4, v: 100 + i % 13 };
});

test('ridge 해석적 해·절편 무규제·표준화 불변', () => {
  close(ridgePredict(ridgeFit([[-1], [1]], [-2, 2], 2), [1]), 1);
  close(ridgePredict(ridgeFit([[-1], [1]], [3, 7], 2), [1]), 6);
  close(ridgePredict(ridgeFit([[100], [300]], [3, 7], 2), [300]), 6);
  close(ridgePredict(ridgeFit([[4], [4]], [3, 7], 2), [4]), 5);
  close(ridgePredict(ridgeFit([[-1, -1], [1, 1]], [-2, 2], 2), [1, 1]), 4 / 3);
  assert.equal(ridgeFit([[NaN], [1]], [1, 2]), null);
  assert.equal(ridgeFit([[1], [2]], [1]), null);
  assert.equal(ridgeFit([[1], [2]], [1, 2], 0), null);
  assert.equal(ridgePredict(null, [1]), null);
});

test('학습 정답: 다음 봉 시가부터 고정기간 종가, 현재 봉 이전 마감만 사용', () => {
  const d = make(), i = 299;
  for (const horizon of [6, 18, 42]) {
    const set = trainingSet(d, i, horizon), offset = i - 199;
    assert.equal(set.X.length, 139 - horizon);
    assert.equal(set.ends.at(-1), d[i - 1].t);
    assert.ok(set.ends.every(t => t < d[i].t));
    close(set.y[0], Math.log(d[offset + 60 + horizon].c / d[offset + 61].o));
    const changed = structuredClone(d);
    changed[i].c *= 1.2; changed[i].h = changed[i].c + 5;
    const other = trainingSet(changed, i, horizon);
    assert.deepEqual(other.X, set.X);
    assert.deepEqual(other.y, set.y);
    assert.notDeepEqual(other.current, set.current);
  }
});

test('예측: 미래변경·절단·최근200봉 동일, 오래된 시세 미사용', () => {
  const d = make(), i = 299;
  const changed = d.map((b, j) => j <= i ? b : { ...b, c: b.c * 100, h: b.h * 100, v: b.v * 100 });
  for (const horizon of [6, 18, 42]) {
    const expected = forecast(d, i, horizon);
    assert.ok(expected && Number.isFinite(expected.value));
    assert.deepEqual(forecast(changed, i, horizon), expected);
    assert.deepEqual(forecast(d.slice(0, i + 1), i, horizon), expected);
    assert.deepEqual(forecast(d.slice(i - 199, i + 1), 199, horizon), expected);
    const oldChanged = d.map((b, j) => j < i - 199 ? { ...b, c: b.c * 100 } : b);
    assert.deepEqual(forecast(oldChanged, i, horizon), expected);
  }
  assert.equal(forecast(d, 198, 6), null);
  assert.equal(forecast(d, i, 7), null);
  const gap = structuredClone(d); gap[i - 1].t -= 1;
  assert.equal(forecast(gap, i, 6), null);
});

test('비용 문턱: 실제 왕복 비용 손익분기와 일치·증가·비유한 거부', () => {
  const cfg = buildConfig({ FEE_RATE: '.0004', SLIPPAGE: '.0005' });
  const threshold = costThreshold(cfg), ratio = Math.exp(threshold);
  close(ratio * (1 - cfg.fee) * (1 - cfg.slip) / ((1 + cfg.fee) * (1 + cfg.slip)), 1);
  assert.ok(costThreshold({ ...cfg, fee: .0025 }) > threshold);
  assert.equal(costThreshold({ fee: NaN, slip: 0 }), Infinity);
  const d = make();
  for (const candidate of Object.values(FORECAST_STRATEGIES)) {
    assert.equal(candidate.evaluate(candidate.prepare(d), 299, { ...cfg, entryScore: 101 }).enter, false);
  }
});
