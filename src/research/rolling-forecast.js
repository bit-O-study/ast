import { indicators } from '../indicators.js';
import { ENTRY_FILTERS } from './entry-filters.js';

// 표준화는 학습행만으로 계산하며 절편에는 정규화 벌점을 주지 않는다.
export function ridgeFit(X, y, alpha = 10) {
  const n = X.length, p = X[0]?.length;
  if (n < 2 || !p || y.length !== n || !(alpha > 0) || !Number.isFinite(alpha)
    || !y.every(Number.isFinite) || X.some(row => row.length !== p || !row.every(Number.isFinite))) return null;
  const mean = Array.from({ length: p }, (_, k) => X.reduce((s, row) => s + row[k], 0) / n);
  const scale = mean.map((m, k) => Math.sqrt(X.reduce((s, row) => s + (row[k] - m) ** 2, 0) / n) || 1);
  const center = y.reduce((s, v) => s + v, 0) / n;
  const A = Array.from({ length: p }, (_, j) => Array.from({ length: p + 1 }, (_, k) => j === k ? alpha : 0));
  for (let i = 0; i < n; i++) {
    const z = X[i].map((v, k) => (v - mean[k]) / scale[k]);
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) A[j][k] += z[j] * z[k];
      A[j][p] += z[j] * (y[i] - center);
    }
  }
  for (let j = 0; j < p; j++) {
    let pivot = j;
    for (let k = j + 1; k < p; k++) if (Math.abs(A[k][j]) > Math.abs(A[pivot][j])) pivot = k;
    [A[j], A[pivot]] = [A[pivot], A[j]];
    const divisor = A[j][j];
    if (!Number.isFinite(divisor) || Math.abs(divisor) < 1e-12) return null;
    for (let k = j; k <= p; k++) A[j][k] /= divisor;
    for (let row = 0; row < p; row++) if (row !== j) {
      const factor = A[row][j];
      for (let k = j; k <= p; k++) A[row][k] -= factor * A[j][k];
    }
  }
  const weights = A.map(row => row[p]);
  if (![...mean, ...scale, center, ...weights].every(Number.isFinite)) return null;
  return { mean, scale, center, weights };
}

export function ridgePredict(model, x) {
  if (!model || x.length !== model.weights.length || !x.every(Number.isFinite)) return null;
  const value = model.center + x.reduce((s, v, k) => s + (v - model.mean[k]) / model.scale[k] * model.weights[k], 0);
  return Number.isFinite(value) ? value : null;
}

function features(d, I, j) {
  const c = d[j].c, volume = d.slice(j - 20, j).reduce((s, b) => s + b.v, 0) / 20;
  return [c / I.s20[j] - 1, I.s20[j] / I.s60[j] - 1, I.rsi[j] / 100,
    I.hist[j] / I.atr[j], d[j].v / volume - 1, I.atr[j] / c];
}

export function trainingSet(d, i, horizon) {
  if (![6, 18, 42].includes(horizon) || i < 199 || i >= d.length) return null;
  const window = d.slice(i - 199, i + 1);
  if (window.some((b, j) => !['t', 'o', 'h', 'l', 'c', 'v'].every(k => Number.isFinite(b[k]))
    || b.o <= 0 || b.c <= 0 || (j && b.t - window[j - 1].t !== 14400000))) return null;
  const I = indicators(window), X = [], y = [], ends = [];
  for (let j = 60; j + horizon <= 198; j++) {
    const x = features(window, I, j), target = Math.log(window[j + horizon].c / window[j + 1].o);
    if (x.every(Number.isFinite) && Number.isFinite(target)) {
      X.push(x); y.push(target); ends.push(window[j + horizon].t);
    }
  }
  const current = features(window, I, 199);
  return X.length >= 80 && current.every(Number.isFinite) ? { X, y, current, ends } : null;
}

export function forecast(d, i, horizon) {
  const set = trainingSet(d, i, horizon);
  if (!set) return null;
  const model = ridgeFit(set.X, set.y);
  const value = ridgePredict(model, set.current);
  return value === null ? null : { value, samples: set.X.length, trainedThrough: set.ends.at(-1) };
}

export function costThreshold(cfg) {
  if (![cfg.fee, cfg.slip].every(x => Number.isFinite(x) && x >= 0 && x < 1)) return Infinity;
  return Math.log((1 + cfg.fee) * (1 + cfg.slip) / ((1 - cfg.fee) * (1 - cfg.slip)));
}

const persistence = ENTRY_FILTERS.research_persistence;
export const FORECAST_STRATEGIES = Object.fromEntries([6, 18, 42].map(horizon => {
  const id = `research_forecast${horizon}`;
  return [id, { ...persistence, id, name: `연구:${horizon / 6}일 기대수익`, minBars: 200,
    evaluate(ctx, i, cfg) {
      const signal = persistence.evaluate(ctx, i, cfg);
      const estimate = signal.enter ? forecast(ctx.d, i, horizon) : null;
      return { ...signal, enter: signal.enter && estimate !== null && estimate.value > costThreshold(cfg),
        note: '과거 마감 데이터 기대수익 연구 · 수익성 미검증' };
    },
  }];
}));
