import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIME_HOLD, observeForward } from '../src/research/regime-hold.js';

const H4 = 14400000;
const fakeClient = (bars) => ({
  calls: [],
  async candlesRange(market, unit, count) {
    this.calls.push({ market, unit, count });
    return bars.slice(-count);
  },
});
const series = (from, n) => Array.from({ length: n }, (_, i) => {
  const c = 100 + i;
  return { t: from + i * H4, o: c, h: c + 1, l: c - 1, c, v: 1 };
});

test('전진 관찰: 등록 시각 전에는 평가하지 않음', async () => {
  const now = REGIME_HOLD.forwardFrom + H4 / 2;
  const bars = series(REGIME_HOLD.forwardFrom - 200 * H4, 201);
  const r = await observeForward({ client: fakeClient(bars), now });
  assert.equal(r.started, false);
});

test('전진 관찰: 진행 중인 봉 제외, 등록 이후 봉만 평가, 3종목 조회', async () => {
  const start = REGIME_HOLD.forwardFrom - 200 * H4;
  const bars = series(start, 260);
  const now = bars.at(-1).t + H4 / 2; // 마지막 봉은 아직 진행 중
  const client = fakeClient(bars);
  const r = await observeForward({ client, now });
  assert.equal(r.started, true);
  assert.equal(r.closed, 59);
  assert.equal(r.to, bars.at(-2).t + H4);
  assert.deepEqual(client.calls.map((c) => c.market), REGIME_HOLD.markets);
  assert.ok(client.calls.every((c) => c.unit === 240 && c.count >= 59 + 120));
  assert.equal(r.results.기본.bars, 59);
  assert.ok(r.results.기본.ret > r.results.스트레스.ret);
});
