import fs from 'node:fs';
import { BithumbClient } from '../src/bithumb/client.js';
import { buildConfig } from '../src/config.js';
import { Trader } from '../src/trader.js';
import { Store } from '../src/store.js';
import { PaperBroker } from '../src/broker/paper.js';

// 운영과 별도 저장소·1분봉으로 마감 처리만 확인한다. 4시간 전략의 수익성 검증은 아니다.
fs.mkdirSync('logs', { recursive: true });
const dir = fs.mkdtempSync('logs/T015-paper-');
const cfg = buildConfig({ MODE: 'paper', STRATEGY: 'structure', CANDLE_UNIT: '1', REGIME_FILTER: 'off', FEE_RATE: '0.0004' });
const store = new Store(dir), client = new BithumbClient();
const trader = new Trader({ cfg, store, client, broker: new PaperBroker(store, cfg), log: () => {} });
const report = { mode: 'paper', unit: 1, regimeFilter: 'off', dir, startedAt: Date.now(), pass: false };
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
  report.pass = report.after > report.before && report.errors.length === 0 && !!trader.signal.analysis;
  report.signal = trader.signal;
} catch (e) { report.error = e.message; }
finally {
  trader.stop(); report.endedAt = Date.now();
  fs.writeFileSync('logs/T015-paper-observation.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ pass: report.pass, before: report.before, after: report.after, error: report.error, dir }));
process.exitCode = report.pass ? 0 : 1;
