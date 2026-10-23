import { loadEnv, buildConfig } from './config.js';
import { BithumbClient } from './bithumb/client.js';
import { Store } from './store.js';
import { PaperBroker } from './broker/paper.js';
import { LiveBroker } from './broker/live.js';
import { Trader } from './trader.js';
import { createServer } from './server.js';

loadEnv();
const cfg = buildConfig();
const client = new BithumbClient({ accessKey: cfg.accessKey, secretKey: cfg.secretKey });
// 모의/실거래 기록이 섞이지 않도록 저장 폴더를 나눈다
const store = new Store(cfg.mode === 'live' ? 'data/live' : 'data/paper');
const broker = cfg.mode === 'live' ? new LiveBroker(client, cfg) : new PaperBroker(store, cfg);
const trader = new Trader({ cfg, client, broker, store });

if (cfg.mode === 'live') console.log('⚠ 실거래 모드: 실제 주문이 나갑니다. 1회 최대 매수 금액', cfg.maxPositionKrw.toLocaleString('ko-KR'), '원');

await trader.start();
createServer({ cfg, trader, client, store }).listen(cfg.port, cfg.host, () => {
  console.log(`대시보드: http://${cfg.host}:${cfg.port}`);
});

const shutdown = () => { trader.stop(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
