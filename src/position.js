// 보유 포지션의 손절가·목표가 관리. 백테스트와 실매매가 같은 규칙을 쓴다.
//
// 매도 규칙
//  1. 현재가 ≤ 손절가            → 전량 매도
//  2. 현재가 ≥ 1차 목표가         → 일부(T1_SELL_RATIO) 매도, 손절가를 본전으로 올림
//  3. 1차 이후 현재가 ≥ 2차 목표가 → 남은 수량 전량 매도
//  4. 1차 이후에는 최고 종가 - ATR×STOP_ATR 로 손절가를 따라 올림 (추적 손절)
//  5. 이탈 신호(점수 ≤ -EXIT_SCORE 또는 20이평 하향 이탈)가 나와도 바로 팔지 않는다.
//     이탈 봉 종가 - ATR×BREACH_ATR 를 새 손절가로 정하고, 가격이 거기까지 더 떨어질 때만 판다.
//  손절가는 올리기만 하고 절대 내리지 않는다.

export const STOP_LABEL = {
  initial: '초기 손절가',
  breakeven: '본전 손절가',
  trail: '추적 손절가',
  breach: '이탈 경계 손절가',
  timeout: '보유기간 경계 손절가',
};
const SELL_REASON = {
  initial: '손절가 도달',
  breakeven: '본전 손절',
  trail: '추적 손절',
  breach: '이탈 후 손절가 도달',
  timeout: '보유기간 초과 후 손절가 도달',
};

// 진입 직전 신호봉부터 센다. 첫 보유봉 마감은1봉이며 공백도 경과 시간에 포함한다.
export function completedHoldingBars(entrySignalAt, signalAt, unitMinutes) {
  return Math.round((signalAt - entrySignalAt) / (unitMinutes * 60000));
}

function strategySnapshot(strategy) {
  if (typeof strategy?.id !== 'string' || !strategy.id.trim()) return null;
  return { id: strategy.id, name: typeof strategy.name === 'string' && strategy.name.trim() ? strategy.name : strategy.id };
}

export function openPosition({ at, idx = null, price, qty, cost, plan, signal, strategy = null, scale = null }) {
  return {
    strategy: strategySnapshot(strategy),
    ...(scale ? { scale: { ...scale }, entries: [{ at, signalAt: scale.lastSignalAt, price, qty, cost, stage: 1 }], analysis: signal?.analysis ?? null } : {}),
    entryAt: at, entryIdx: idx, entryPrice: price,
    qty, qtyInit: qty, cost,
    stop: plan.stop, stopType: 'initial', initialStop: plan.stop,
    t1: plan.t1, t2: plan.t2, R: plan.R, t1Done: false,
    high: price, planNote: plan.note || '',
    score: signal?.score ?? null, parts: signal?.parts ?? [],
    exits: [], history: [{ at, type: 'initial', stop: plan.stop, note: '진입 시 설정' }],
    warn: null,
  };
}

function raiseStop(pos, value, type, at, note) {
  if (!(value > pos.stop)) return false;
  pos.stop = value;
  pos.stopType = type;
  pos.history.push({ at, type, stop: value, note });
  return true;
}

// 가격 한 번 확인할 때 해야 할 매도. 없으면 null
export function priceAction(pos, price, cfg) {
  if (price <= pos.stop) return { qty: pos.qty, reason: SELL_REASON[pos.stopType], kind: 'stop' };
  if (!pos.t1Done && price >= pos.t1) {
    let qty = pos.qty * cfg.t1SellRatio;
    // 나눠 팔면 최소 주문금액보다 작아지는 경우 전량 매도
    if (qty * price < cfg.minOrderKrw || (pos.qty - qty) * price < cfg.minOrderKrw) qty = pos.qty;
    return { qty, reason: '1차 목표가 도달', kind: 't1' };
  }
  if (pos.t1Done && price >= pos.t2) return { qty: pos.qty, reason: '2차 목표가 도달', kind: 't2' };
  return null;
}

// 매도 체결 반영. 포지션이 모두 정리되면 true
export function applyExit(pos, { at, idx = null, price, qty, proceeds, reason, kind }, cfg) {
  pos.exits.push({ at, idx, price, qty, proceeds, reason });
  pos.qty -= qty;
  if (pos.qty * price < 1) pos.qty = 0; // 소수점 찌꺼기
  if (kind === 't1') {
    pos.t1Done = true;
    // 수수료까지 감안한 본전 가격
    const be = pos.scale ? (pos.cost / pos.qtyInit) / ((1 - cfg.fee) * (1 - cfg.slip)) : (pos.entryPrice * (1 + cfg.fee)) / (1 - cfg.fee);
    raiseStop(pos, be, 'breakeven', at, '1차 목표 달성 후 본전으로 상향');
  }
  return pos.qty === 0;
}

// 봉 마감 때 손절가 조정. ctx: { at, close, prevClose, atr, s20, prevS20, score, barsHeld }
export function onCandleClose(pos, ctx, cfg) {
  pos.high = Math.max(pos.high, ctx.close);
  const notes = [];

  if (pos.t1Done && raiseStop(pos, pos.high - cfg.stopAtr * ctx.atr, 'trail', ctx.at, '최고 종가 기준 추적')) notes.push('추적 손절가 상향');

  const scoreBreak = ctx.score <= -cfg.exitScore;
  const maBreak = ctx.close < ctx.s20 && ctx.prevClose >= ctx.prevS20;
  if (scoreBreak || maBreak) {
    const why = scoreBreak ? `점수 ${ctx.score.toFixed(0)}` : '20이평 하향 이탈';
    pos.warn = { at: ctx.at, close: ctx.close, reason: why };
    // 바로 팔지 않고, 이탈 가격에서 ATR×BREACH_ATR 더 떨어지면 팔도록 손절가를 정한다
    if (raiseStop(pos, ctx.close - cfg.breachAtr * ctx.atr, 'breach', ctx.at, `${why} → 추가 하락 시 매도`)) notes.push(`이탈 경계: ${why}`);
  }
  if (ctx.barsHeld >= cfg.maxHoldBars) {
    if (raiseStop(pos, ctx.close - 0.5 * ctx.atr, 'timeout', ctx.at, `보유 ${ctx.barsHeld}봉 초과`)) notes.push('보유기간 경계');
  }
  return notes;
}

// 청산 완료된 포지션 → 거래 기록 (성공·실패 판정 포함)
export function toTrade(pos) {
  const proceeds = pos.exits.reduce((a, e) => a + e.proceeds, 0);
  const qty = pos.exits.reduce((a, e) => a + e.qty, 0);
  const pnl = proceeds - pos.cost;
  const last = pos.exits[pos.exits.length - 1];
  return {
    positionId: pos.id ?? null,
    strategy: strategySnapshot(pos.strategy),
    ...(pos.scale ? { entries: structuredClone(pos.entries), scale: { ...pos.scale }, analysis: structuredClone(pos.analysis) } : {}),
    entryAt: pos.entryAt, exitAt: last.at,
    entryIdx: pos.entryIdx, exitIdx: last.idx ?? null,
    entryPrice: pos.entryPrice, exitPrice: qty ? pos.exits.reduce((a, e) => a + e.price * e.qty, 0) / qty : last.price,
    qty: pos.qtyInit, cost: pos.cost, proceeds, pnl, pct: (pnl / pos.cost) * 100,
    result: pnl > 0 ? '성공' : '실패',
    initialStop: pos.initialStop, t1: pos.t1, t2: pos.t2,
    exits: pos.exits, reason: last.reason,
    score: pos.score, parts: pos.parts, planNote: pos.planNote,
  };
}
