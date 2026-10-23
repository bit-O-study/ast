import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRegime } from '../src/regime.js';

const U = 240, MS = U * 60e3;
// 1일 = 6봉(4시간봉). regimeDays 2 → 12봉 평균
const candles = (closes) => closes.map((c, i) => ({ t: i * MS, o: c, h: c, l: c, c, v: 1 }));
const cfg = { unit: U, regimeDays: 2 };

test('BTC 종가가 N일 평균 위면 상승, 아래면 하락', () => {
  const up = buildRegime(candles(Array.from({ length: 30 }, (_, i) => 100 + i)), cfg);
  assert.equal(up.len, 12);
  assert.equal(up.isBull(30 * MS), true);
  const down = buildRegime(candles(Array.from({ length: 30 }, (_, i) => 200 - i)), cfg);
  assert.equal(down.isBull(30 * MS), false);
});

test('데이터가 부족하면 보수적으로 하락(매수 안 함)', () => {
  const r = buildRegime(candles([1, 2, 3]), cfg);
  assert.equal(r.isBull(3 * MS), false);
  assert.equal(r.state(3 * MS).ma, null);
});

test('판단 시각 이후에 마감되는 봉은 보지 않는다', () => {
  // 0~19봉 상승, 20봉에서 폭락
  const closes = Array.from({ length: 20 }, (_, i) => 100 + i).concat([10]);
  const r = buildRegime(candles(closes), cfg);
  // 19번 봉 마감 시각(20*MS)에는 20번 봉(폭락)이 아직 마감 전
  assert.equal(r.state(20 * MS).close, 119);
  assert.equal(r.isBull(20 * MS), true);
  // 20번 봉 마감 후에는 하락
  assert.equal(r.isBull(21 * MS), false);
  // 마감 1ms 전에도 아직 반영 안 됨
  assert.equal(r.isBull(21 * MS - 1), true);
});

test('필터를 끄면 항상 매수 허용', () => {
  const r = buildRegime([], { ...cfg, regimeFilter: 'off' });
  assert.equal(r.enabled, false);
  assert.equal(r.isBull(0), true);
  assert.equal(r.state(0), null);
});
