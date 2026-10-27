// 분할매수의 예산·위험·체결 반영. 백테스트와 모의 매매가 같은 함수를 사용한다.
const netExit = (price, cfg) => price * (1 - cfg.slip) * (1 - cfg.fee);
export const buyQuantity = (cost, price, cfg) => cost * (1 - cfg.fee) / price;

export function firstAllocation({ cash, equity, price, plan, atr, signalAt }, cfg) {
  const perWonLoss = 1 - buyQuantity(1, price, cfg) * netExit(plan.stop, cfg);
  if (!(price > plan.stop && plan.stop > 0 && perWonLoss > 0 && atr > 0)) return null;
  const perWonProfit = buyQuantity(1, price, cfg) * netExit(plan.t1, cfg) - 1;
  if (perWonProfit / perWonLoss < cfg.minRR) return null;
  const riskBudget = equity * cfg.risk;
  const budget = Math.min(cash * 0.999, cfg.maxPositionKrw, riskBudget / perWonLoss);
  const cost = budget * cfg.firstBuyRatio;
  if (!Number.isFinite(cost) || cost < cfg.minOrderKrw || budget - cost < cfg.minOrderKrw) return null;
  return { cost, scale: { budget, riskBudget, firstPrice: price, atr, firstRatio: cfg.firstBuyRatio, lastSignalAt: signalAt, stage: 1 } };
}

export function additionalAllocation(pos, { cash, price, signal, signalAt, allowed }, cfg) {
  const s = pos.scale;
  if (!cfg.scaleIn || !s || s.stage !== 1 || pos.exits.length || pos.t1Done || !allowed) return null;
  if (!(signalAt > s.lastSignalAt) || !signal?.add || signal.analysis?.wave?.stage === '구조 무효') return null;
  if (!(price >= s.firstPrice + 0.5 * s.atr && price < pos.t1 && price > pos.stop)) return null;
  if (!(pos.qty * netExit(price / (1 + cfg.slip), cfg) > pos.cost)) return null;
  const remainingRisk = s.riskBudget - (pos.cost - pos.qty * netExit(pos.stop, cfg));
  const perWonLoss = 1 - buyQuantity(1, price, cfg) * netExit(pos.stop, cfg);
  if (!(perWonLoss > 0)) return null;
  const cost = Math.min(cash * 0.999, s.budget - pos.cost, cfg.maxPositionKrw - pos.cost, remainingRisk / perWonLoss);
  if (!Number.isFinite(cost) || cost < cfg.minOrderKrw) return null;
  const qty = pos.qty + buyQuantity(cost, price, cfg), total = pos.cost + cost;
  const loss = total - qty * netExit(pos.stop, cfg), profit = qty * netExit(pos.t1, cfg) - total;
  if (!(loss > 0 && profit / loss >= cfg.minRR)) return null;
  return { cost, signalAt };
}

export function applyAdditional(pos, fill, { at, signalAt, analysis }) {
  if (!pos.scale || pos.scale.stage !== 1 || pos.exits.length) throw new Error('추가 매수 단계가 올바르지 않습니다');
  const oldQty = pos.qtyInit;
  pos.entryPrice = (pos.entryPrice * oldQty + fill.price * fill.qty) / (oldQty + fill.qty);
  pos.qty += fill.qty; pos.qtyInit += fill.qty; pos.cost += fill.cost;
  pos.scale.stage = 2; pos.scale.lastSignalAt = signalAt;
  pos.entries.push({ at, signalAt, price: fill.price, qty: fill.qty, cost: fill.cost, stage: 2, analysis });
}
