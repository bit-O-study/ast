import fs from 'node:fs';
import { BithumbClient } from '../src/bithumb/client.js';
import { buildConfig } from '../src/config.js';
import { Trader } from '../src/trader.js';
import { Store } from '../src/store.js';
import { PaperBroker } from '../src/broker/paper.js';

// 운영 계좌와 분리한 모의 잔고로 마감 처리만 관찰한다.
const dir = fs.mkdtempSync('logs/T019-paper-');
const cfg = buildConfig({ MODE:'paper', STRATEGY:'score', LOSS_COOLDOWN_BARS:'6', CANDLE_UNIT:'1', REGIME_FILTER:'off', FEE_RATE:'.0004' });
const store = new Store(dir), client = new BithumbClient();
const trader = new Trader({cfg,store,client,broker:new PaperBroker(store,cfg),log:()=>{}});
const report = {mode:'paper',dir,startedAt:Date.now(),pass:false};
try {
  await trader.init(); report.before=store.state.lastCandleT;
  const deadline=Date.now()+100000;
  while(Date.now()<deadline && store.state.lastCandleT<=report.before) {
    await new Promise(resolve=>setTimeout(resolve,5000)); await trader.tick();
  }
  report.after=store.state.lastCandleT;
  report.errors=store.events(10000).filter(e=>e.type==='error');
  report.pass=report.after>report.before && report.errors.length===0;
} catch(e) { report.error=e.message; }
finally {
  trader.stop();report.endedAt=Date.now();
  fs.writeFileSync('logs/T019-paper-observation.json',JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report));process.exitCode=report.pass?0:1;
