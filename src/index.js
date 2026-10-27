import { loadEnv, buildConfig } from './config.js';
import { BithumbClient } from './bithumb/client.js';
import { Store } from './store.js';
import { PaperBroker } from './broker/paper.js';
import { LiveBroker } from './broker/live.js';
import { Trader } from './trader.js';
import { Portfolio } from './portfolio.js';
import { createServer } from './server.js';
import { Settings } from './settings.js';
import { LiveVerifier } from './verify/live.js';
import { createKakaoNotifier } from './notify/kakao.js';

loadEnv();
const cfg = buildConfig();
const client = new BithumbClient({ accessKey: cfg.accessKey, secretKey: cfg.secretKey });
// 모의/실거래 기록이 섞이지 않도록 저장 폴더를 나눈다
const store = new Store(cfg.mode === 'live' ? 'data/live' : 'data/paper');

// 여러 종목 동시 운용(T-007, paper 전용): 첫 종목은 기존 저장소, 나머지는 data/paper/<종목>.
// 모든 종목이 첫 저장소의 모의 현금을 같이 쓰고, 위험 한도는 Portfolio가 계좌 단위로 판단한다
const markets = cfg.markets.length ? cfg.markets : [cfg.market];
const portfolio = markets.length > 1 ? new Portfolio({ cfg, wallet: store }) : null;
const traders = markets.map((market, k) => {
  const c = k === 0 ? cfg : { ...cfg, market };
  const s = k === 0 ? store : new Store(`data/paper/${market}`);
  const broker = cfg.mode === 'live' ? new LiveBroker(client, c) : new PaperBroker(store, c, { primary: k === 0 });
  const t = new Trader({ cfg: c, client, broker, store: s });
  if (portfolio) portfolio.add(t);
  return t;
});
const trader = traders[0];

// 모의투자에서만 설정 즉시 변경·실시간 검증을 켠다. 저장된 변경값은 매매 시작 전에 적용된다
if (cfg.mode === 'paper') {
  const settings = new Settings({ cfg, store, emit: (type, data) => trader.emit(type, data),
    hasPosition: () => traders.some((t) => !!t.state.position), mirrors: traders.slice(1).map((t) => t.cfg) });
  const verifier = new LiveVerifier({ cfg, store, trader, traders });
  for (const t of traders) { t.settings = settings; }
  trader.verifier = verifier;
}

// 카카오톡 알림: NOTIFY_KAKAO=on일 때만 외부로 보낸다. 전송 실패는 로그만 남기고 매매 루프에 영향을 주지 않는다
const kakao = cfg.notifyKakao === 'on'
  ? createKakaoNotifier({ tokenFile: cfg.kakaoTokenFile, onError: (e) => console.log(`[알림] ${e.message}`) })
  : null;
if (kakao) for (const t of traders) t.store.onEvent((e) => kakao.notify(e));

if (cfg.mode === 'live') console.log('⚠ 실거래 모드: 실제 주문이 나갑니다. 1회 최대 매수 금액', cfg.maxPositionKrw.toLocaleString('ko-KR'), '원');

// 시작 기준점(평가금액)은 모든 종목 시세를 받은 뒤 계좌 단위로 잡는다
for (const t of traders) await t.init();
portfolio?.init();
for (const t of traders) { t.timer = setInterval(() => t.tick(), cfg.pollSec * 1000); await t.tick(); }
createServer({ cfg, trader, client, store, settings: trader.settings, verifier: trader.verifier, notifier: kakao, traders, portfolio }).listen(cfg.port, cfg.host, () => {
  console.log(`대시보드: http://${cfg.host}:${cfg.port}${portfolio ? ` · ${markets.join(', ')}` : ''}`);
});

const shutdown = () => { for (const t of traders) t.stop(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
