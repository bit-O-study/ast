import fs from 'node:fs';
import { BithumbClient } from '../src/bithumb/client.js';
import { buildConfig } from '../src/config.js';
import { Trader } from '../src/trader.js';
import { Store } from '../src/store.js';
import { PaperBroker } from '../src/broker/paper.js';

// 별도 모의 잔고에서 마감봉 판단 경로만 확인한다.
fs.mkdirSync('logs', { recursive: true });
const dir = fs.mkdtempSync('logs/T016-paper-');
const cfg = buildConfig({ MODE: 'paper', STRATEGY: 'defensive', CANDLE_UNIT: '1', REGIME_FILTER: 'off', FEE_RATE: '0.0004' });
const store = new Store(dir), client = new BithumbClient();
const trader = new Trader({ cfg, store, client, broker: new PaperBroker(store, cfg), log: () => {} });
const report = { mode: 'paper', unit: 1, dir, startedAt: Date.now(), pass: false };
try {
  await trader.init();
  report.before = store.state.lastCandleT;
  const deadline = Date.now() + 100000;
  while (Date.now() < deadline && store.state.lastCandleT <= report.before) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    await trader.tick();
  }
  report.after = store.state.lastCandleT;
  report.errors = store.events(10000).filter(e => e.type === 'error');
  report.signal = trader.signal;
  report.pass = report.after > report.before && report.errors.length === 0 && trader.signal.analysis?.kind === 'defensive';
} catch (e) { report.error = e.message; }
finally {
  trader.stop(); report.endedAt = Date.now();
  fs.writeFileSync('logs/T016-paper-observation.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ pass: report.pass, before: report.before, after: report.after, error: report.error, dir }));
process.exitCode = report.pass ? 0 : 1;
