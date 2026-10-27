import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Trader } from '../src/trader.js';
import { STRATEGIES } from '../src/strategies/index.js';
import { FORECAST_STRATEGIES, forecast } from '../src/research/rolling-forecast.js';
import { buildConfig } from '../src/config.js';

const unit = 14400000;
const d = Array.from({ length: 221 }, (_, i) => {
  const c = 1000 + i + Math.sin(i / 6) * 10;
  return { t: i * unit, o: c - 1, c, h: c + 2, l: c - 2, v: 100 + i % 13 };
});

test('실제 형태 응답: 진행 봉을 제외하고 모델 준비200봉 확보', async () => {
  const id = 'research_forecast6', original = STRATEGIES[id], calls = [];
  STRATEGIES[id] = FORECAST_STRATEGIES[id];
  try {
    const client = {
      async candles(m, u, { count }) { calls.push(['candles', count]); return d.slice(-count); },
      async candlesRange(m, u, count) { calls.push(['range', count]); return d.slice(-count); },
    };
    const trader = new Trader({ cfg: buildConfig({ STRATEGY: id, REGIME_FILTER: 'off' }), client,
      store: { state: {} }, broker: {}, now: () => d.at(-1).t + 1000 });
    await trader.refreshCandles();
    assert.equal(trader.candles.length, 200);
    assert.equal(trader.candles.at(-1).t, d.at(-2).t);
    assert.deepEqual(calls, [['range', 201]]);
    assert.ok(forecast(trader.candles, 199, 6));
    client.candlesRange = async () => d.slice(-100);
    await assert.rejects(trader.refreshCandles(), /마감 봉이 부족/);
  } finally {
    if (original) STRATEGIES[id] = original; else delete STRATEGIES[id];
  }
});

test('기본 전략은 기존200개 조회 유지, 진행 봉 제외', async () => {
  const calls = [];
  const client = { async candles(m, u, { count }) { calls.push(count); return d.slice(-count); } };
  const trader = new Trader({ cfg: buildConfig({ REGIME_FILTER: 'off' }), client,
    store: { state: {} }, broker: {}, now: () => d.at(-1).t + 1000 });
  await trader.refreshCandles();
  assert.deepEqual(calls, [200]);
  assert.equal(trader.candles.length, 199);
});
