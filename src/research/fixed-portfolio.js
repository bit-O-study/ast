import { buildConfig } from '../config.js';
import { backtest } from '../backtest.js';

// 고정 금액 여러 종목 운용 계산 (T-037·T-040). 종목별 백테스트 손익을 시각 기준으로 합산한다.
// 1회 금액이 원 단위 고정이고 합계가 계좌 안이면 한 계좌 동시 운용과 같다.

// 한 종목: 평가 시작(signalFrom 봉) 이후 시각별 손익(원)
export function runFixed({ d, btc, signalFrom, market, env = {}, capital = 10_000_000 }) {
  const cfg = buildConfig({ MODE: 'paper', MARKET: market, STRATEGY: 'score', SCALE_IN: 'false', RISK_PER_TRADE: '1', ...env });
  const r = backtest(d, cfg, { btc, signalFrom, capital });
  const pnl = new Map();
  d.forEach((b, i) => { if (b.t >= d[signalFrom].t) pnl.set(b.t, (Number.isFinite(r.equity[i]) ? r.equity[i] : capital) - capital); });
  return { pnl, trades: r.trades };
}

// 여러 종목 합산: 시각 합집합 위에서 종목별 직전 손익을 이어 붙인다
export function combinePnl(parts, capital = 10_000_000) {
  const times = [...new Set(parts.flatMap((x) => [...x.pnl.keys()]))].sort((a, b) => a - b);
  const last = parts.map(() => 0);
  let peak = capital, mdd = 0, e = capital;
  for (const t of times) {
    parts.forEach((x, k) => { if (x.pnl.has(t)) last[k] = x.pnl.get(t); });
    e = capital + last.reduce((a, v) => a + v, 0);
    peak = Math.max(peak, e); mdd = Math.max(mdd, 1 - e / peak);
  }
  return { ret: (e / capital - 1) * 100, mdd: mdd * 100, bars: times.length, trades: parts.reduce((a, x) => a + x.trades.length, 0) };
}
