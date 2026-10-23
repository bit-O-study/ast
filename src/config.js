import fs from 'node:fs';

// .env 파일을 읽어 process.env에 채운다 (이미 설정된 환경변수가 우선)
export function loadEnv(path = '.env') {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const num = (env, key, def) => {
  const v = env[key];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`설정값 ${key}=${v} 는 숫자가 아닙니다`);
  return n;
};

export function buildConfig(env = process.env) {
  const cfg = {
    mode: (env.MODE || 'paper').toLowerCase(),
    liveConfirm: env.LIVE_CONFIRM === 'YES',
    accessKey: env.BITHUMB_ACCESS_KEY || '',
    secretKey: env.BITHUMB_SECRET_KEY || '',
    market: env.MARKET || 'KRW-BTC',
    unit: num(env, 'CANDLE_UNIT', 240),
    strategy: env.STRATEGY || 'score',
    regimeFilter: (env.REGIME_FILTER || 'btc').toLowerCase(),
    regimeDays: num(env, 'REGIME_DAYS', 20),
    fee: num(env, 'FEE_RATE', 0.0025),
    slip: num(env, 'SLIPPAGE', 0.0005),
    paperKrw: num(env, 'PAPER_KRW', 10_000_000),
    entryScore: num(env, 'ENTRY_SCORE', 35),
    exitScore: num(env, 'EXIT_SCORE', 20),
    stopAtr: num(env, 'STOP_ATR', 2.5),
    breachAtr: num(env, 'BREACH_ATR', 1.0),
    t1R: num(env, 'T1_R', 2),
    t2R: num(env, 'T2_R', 4),
    t1SellRatio: num(env, 'T1_SELL_RATIO', 0.5),
    minRR: num(env, 'MIN_RR', 1.5),
    maxHoldBars: num(env, 'MAX_HOLD_BARS', 40),
    risk: num(env, 'RISK_PER_TRADE', 0.02),
    maxPositionKrw: num(env, 'MAX_POSITION_KRW', 1_000_000),
    minOrderKrw: num(env, 'MIN_ORDER_KRW', 5000),
    dailyLossLimit: num(env, 'DAILY_LOSS_LIMIT', 0.03),
    killSwitchLoss: num(env, 'KILL_SWITCH_LOSS', 0.15),
    pollSec: num(env, 'PRICE_POLL_SEC', 5),
    host: env.HOST || '127.0.0.1',
    port: num(env, 'PORT', 8787),
  };
  if (!['paper', 'live'].includes(cfg.mode)) throw new Error(`MODE는 paper 또는 live 여야 합니다 (현재 ${cfg.mode})`);
  if (![1, 3, 5, 10, 15, 30, 60, 240].includes(cfg.unit)) throw new Error(`CANDLE_UNIT ${cfg.unit} 은 빗썸이 지원하지 않습니다`);
  if (cfg.t2R <= cfg.t1R) throw new Error('T2_R은 T1_R보다 커야 합니다');
  if (!['btc', 'off'].includes(cfg.regimeFilter)) throw new Error(`REGIME_FILTER는 btc 또는 off 여야 합니다 (현재 ${cfg.regimeFilter})`);
  if (cfg.mode === 'live') {
    if (!cfg.accessKey || !cfg.secretKey) throw new Error('live 모드에는 BITHUMB_ACCESS_KEY, BITHUMB_SECRET_KEY가 필요합니다');
    if (!cfg.liveConfirm) throw new Error('live 모드로 실제 주문을 내려면 LIVE_CONFIRM=YES 로 설정하세요');
  }
  return cfg;
}

// 대시보드에 노출해도 되는 설정만 추린다 (키 제외)
export function publicConfig(cfg) {
  const { accessKey, secretKey, liveConfirm, ...rest } = cfg;
  return rest;
}
