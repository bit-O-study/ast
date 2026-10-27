import { buildRegime } from '../regime.js';
import { computeStats } from '../backtest.js';

// 연구 전용: 마감 판정 이후 다음 시가 체결, 총지출 상한 유지.
export function cappedHold(d, btc, cfg, { daily = true, hold = false, start = 201 } = {}) {
  const regime = buildRegime(btc, cfg), unitMs = cfg.unit * 60000;
  let target = false, cash = cfg.paperKrw, qty = 0, entryCost = 0;
  const equity = [cash], trades = [], fills = [];
  const sell = (i, raw) => {
    const proceeds = qty * raw * (1 - cfg.slip) * (1 - cfg.fee);
    cash += proceeds;
    trades.push({ pnl: proceeds - entryCost });
    fills.push({ i, side: 'sell', qty, proceeds });
    qty = 0;
  };
  for (let i = 0; i < d.length; i++) {
    if (i >= start) {
      if (target && !qty) {
        entryCost = Math.min(cfg.maxPositionKrw, cash);
        qty = entryCost / (d[i].o * (1 + cfg.slip) * (1 + cfg.fee));
        cash -= entryCost;
        fills.push({ i, side: 'buy', qty, cost: entryCost });
      } else if (!target && qty) sell(i, d[i].o);
      // 비교군과 같은 매도 수수료 차감 평가액.
      equity.push(cash + qty * d[i].c * (1 - cfg.fee));
    }
    const closeAt = d[i].t + unitMs;
    if (hold) target = true;
    else if (!daily || new Date(closeAt + 9 * 3600e3).getUTCHours() === 8) target = regime.isBull(closeAt);
  }
  if (qty) { sell(d.length - 1, d.at(-1).c); equity[equity.length - 1] = cash; }
  return { stats: computeStats(trades, equity, cfg.paperKrw), equity, trades, fills };
}
