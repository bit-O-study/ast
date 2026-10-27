import { loadEnv, buildConfig } from './config.js';
import { BithumbClient } from './bithumb/client.js';
import { Store } from './store.js';
import { PaperBroker } from './broker/paper.js';
import { LiveBroker } from './broker/live.js';
import { Trader } from './trader.js';
import { createServer } from './server.js';
import { Settings } from './settings.js';
import { LiveVerifier } from './verify/live.js';
import { createKakaoNotifier } from './notify/kakao.js';

loadEnv();
const cfg = buildConfig();
const client = new BithumbClient({ accessKey: cfg.accessKey, secretKey: cfg.secretKey });
// 모의/실거래 기록이 섞이지 않도록 저장 폴더를 나눈다
const store = new Store(cfg.mode === 'live' ? 'data/live' : 'data/paper');
const broker = cfg.mode === 'live' ? new LiveBroker(client, cfg) : new PaperBroker(store, cfg);
const trader = new Trader({ cfg, client, broker, store });
// 모의투자에서만 설정 즉시 변경·실시간 검증을 켠다. 저장된 변경값은 매매 시작 전에 적용된다
if (cfg.mode === 'paper') {
  trader.settings = new Settings({ cfg, store, emit: (type, data) => trader.emit(type, data), hasPosition: () => !!store.state.position });
  trader.verifier = new LiveVerifier({ cfg, store, trader });
}

// 카카오톡 알림: NOTIFY_KAKAO=on일 때만 외부로 보낸다. 전송 실패는 로그만 남기고 매매 루프에 영향을 주지 않는다
const kakao = cfg.notifyKakao === 'on'
  ? createKakaoNotifier({ tokenFile: cfg.kakaoTokenFile, onError: (e) => console.log(`[알림] ${e.message}`) })
  : null;
if (kakao) store.onEvent((e) => kakao.notify(e));

if (cfg.mode === 'live') console.log('⚠ 실거래 모드: 실제 주문이 나갑니다. 1회 최대 매수 금액', cfg.maxPositionKrw.toLocaleString('ko-KR'), '원');

await trader.start();
createServer({ cfg, trader, client, store, settings: trader.settings, verifier: trader.verifier, notifier: kakao }).listen(cfg.port, cfg.host, () => {
  console.log(`대시보드: http://${cfg.host}:${cfg.port}`);
});

const shutdown = () => { trader.stop(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
