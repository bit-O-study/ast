import fs from 'node:fs';
import { BithumbClient } from '../src/bithumb/client.js';
import { buildConfig } from '../src/config.js';
import { Trader } from '../src/trader.js';
import { Store } from '../src/store.js';
import { PaperBroker } from '../src/broker/paper.js';
import { STRATEGIES } from '../src/strategies/index.js';
import score from '../src/strategies/score.js';
import { FORECAST_STRATEGIES, forecast } from '../src/research/rolling-forecast.js';

const dir = fs.mkdtempSync('logs/T026-paper-'), report = { mode: 'paper', startedAt: Date.now(), dir, pass: false };
const ids = ['research_forecast6', 'history_probe'];
const old = Object.fromEntries(ids.map(id => [id, STRATEGIES[id]]));
let trader;
try {
  STRATEGIES.research_forecast6 = FORECAST_STRATEGIES.research_forecast6;
  STRATEGIES.history_probe = { ...score, id: 'history_probe', name: '준비봉 관측', minBars: 200,
    evaluate() { return { enter: false, score: 0, parts: [], trend: false, adx: 0, rsi: 50, note: '조회·마감 관측' }; },
  };
  const client = new BithumbClient();
  const cfg = buildConfig({ MODE: 'paper', STRATEGY: 'research_forecast6', REGIME_FILTER: 'off' });
  const store = new Store(`${dir}/four-hour`);
  trader = new Trader({ cfg, client, store, broker: new PaperBroker(store, cfg), log: () => {} });
  // init은 조회와 기준점 설정만 하며 매매하지 않는다.
  await trader.init();
  report.closedFourHour = trader.candles.length;
  report.forecasts = [6, 18, 42].map(h => ({ horizon: h, estimate: forecast(trader.candles, trader.candles.length - 1, h) }));
  trader.stop();
  const probeCfg = buildConfig({ MODE: 'paper', STRATEGY: 'history_probe', CANDLE_UNIT: '1', REGIME_FILTER: 'off' });
  const probeStore = new Store(`${dir}/one-minute`);
  trader = new Trader({ cfg: probeCfg, client, store: probeStore, broker: new PaperBroker(probeStore, probeCfg), log: () => {} });
  await trader.init(); report.before = probeStore.state.lastCandleT;
  const deadline = Date.now() + 100000;
  while (Date.now() < deadline && probeStore.state.lastCandleT <= report.before) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    await trader.tick();
  }
  report.after = probeStore.state.lastCandleT;
  report.closedOneMinute = trader.candles.length;
  report.errors = probeStore.events(10000).filter(e => e.type === 'error');
  report.trades = probeStore.trades().length;
  report.pass = report.closedFourHour === 200 && report.closedOneMinute === 200 && report.forecasts.every(x => x.estimate)
    && report.after > report.before && report.errors.length === 0 && report.trades === 0;
} catch (e) { report.error = e.message; }
finally {
  trader?.stop();
  for (const [id, value] of Object.entries(old)) { if (value) STRATEGIES[id] = value; else delete STRATEGIES[id]; }
  report.endedAt = Date.now();
  fs.writeFileSync('logs/T026-paper-observation.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
process.exitCode = report.pass ? 0 : 1;
