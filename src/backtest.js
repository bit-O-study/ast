import { WARM, planEntry } from './strategy.js';
import { getStrategy } from './strategies/index.js';
import { buildRegime } from './regime.js';
import { openPosition, priceAction, applyExit, onCandleClose, toTrade, completedHoldingBars } from './position.js';
import { firstAllocation, additionalAllocation, applyAdditional, buyQuantity } from './scale.js';
import { reentryAllowed } from './reentry.js';

// 성과 집계: 총손익, 승률, 손익비, 최대 낙폭
export function computeStats(trades, equity, capital) {
  const wins = trades.filter((t) => t.pnl > 0), losses = trades.filter((t) => t.pnl <= 0);
  const gw = wins.reduce((a, t) => a + t.pnl, 0), gl = -losses.reduce((a, t) => a + t.pnl, 0);
  let peak = -Infinity, mdd = 0;
  for (const e of equity) { if (!Number.isFinite(e)) continue; peak = Math.max(peak, e); mdd = Math.max(mdd, (peak - e) / peak); }
  const final = equity.length ? equity[equity.length - 1] : capital;
  return {
    capital, final, pnl: final - capital, ret: (final / capital - 1) * 100,
    trades: trades.length, wins: wins.length, losses: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    pf: gl > 0 ? gw / gl : gw > 0 ? null : 0, // null = 손실 거래 없음(무한대)
    mdd: mdd * 100,
  };
}

const isBtc = (market) => market === 'KRW-BTC';

// 백테스트용 시세: 대상 코인 + (국면 필터용) BTC. BTC 이동평균이 잡히도록 BTC는 더 길게 받는다
export async function loadBacktestData(client, cfg, count) {
  const now = Date.now(), unitMs = cfg.unit * 60e3;
  const d = (await client.candlesRange(cfg.market, cfg.unit, count)).filter(b => b.t + unitMs <= now);
  if (cfg.regimeFilter === 'off' || isBtc(cfg.market)) return { d, btc: null };
  const extra = Math.round((cfg.regimeDays * 1440) / cfg.unit) + 5;
  const btc = (await client.candlesRange('KRW-BTC', cfg.unit, count + extra)).filter(b => b.t + unitMs <= now);
  return { d, btc };
}

// 봉 단위 백테스트.
// - 신호는 봉 마감 후 계산하고 다음 봉 시가에 매수 (미래 데이터 참조 없음)
// - 봉 안의 순서는 보수적으로: 시가 갭 → 손절가(저가) → 목표가(고가)
// - 국면 필터: 신호 봉 마감 시각에 BTC가 하락 국면이면 진입하지 않음
// - signalFrom: 이 인덱스 이전 봉의 신호는 무시 (리플레이 검증과 시작점을 맞출 때)
export function backtest(d, cfg, { capital = cfg.paperKrw, btc = null, signalFrom = 0 } = {}) {
  const n = d.length, unitMs = cfg.unit * 60e3;
  const strategy = getStrategy(cfg.strategy);
  if (cfg.regimeFilter === 'btc' && !btc && !isBtc(cfg.market)) throw new Error('국면 필터에 쓸 BTC 시세가 필요합니다 (loadBacktestData 사용)');
  const regime = buildRegime(btc ?? d, cfg);
  const ctx = strategy.prepare(d);
  const I = ctx.I;
  const sc = d.map((_, i) => (i >= WARM ? strategy.evaluate(ctx, i, cfg) : null));
  const bull = d.map((b) => regime.isBull(b.t + unitMs));
  let cash = capital, pos = null, pending = null;
  let pendingAdd = null, day = null, dayStart = capital, killed = false;
  let lastLossSignalAt = null;
  const trades = [], skipped = [], equity = Array(n).fill(NaN);

  const sell = (i, rawPrice, act) => {
    const price = rawPrice * (1 - cfg.slip);
    const proceeds = act.qty * price * (1 - cfg.fee);
    cash += proceeds;
    if (applyExit(pos, { at: d[i].t, idx: i, price, qty: act.qty, proceeds, reason: act.reason, kind: act.kind }, cfg)) {
      const trade = toTrade(pos);
      trades.push(trade);
      if (cfg.lossCooldownBars && trade.pnl <= 0) lastLossSignalAt = d[i - 1].t;
      pos = null;
    }
  };

  for (let i = WARM; i < n; i++) {
    const b = d[i];
    const currentEquity = cash + (pos ? pos.qty * b.o : 0);
    const nextDay = new Date(b.t + 9 * 3600e3).toISOString().slice(0, 10);
    if (nextDay !== day) { day = nextDay; dayStart = currentEquity; }
    if (cfg.scaleIn && currentEquity <= capital * (1 - cfg.killSwitchLoss)) {
      if (pos) sell(i, b.o, { qty: pos.qty, reason: '킬 스위치', kind: 'manual' });
      killed = true;
    }
    const allowed = !killed && currentEquity > dayStart * (1 - cfg.dailyLossLimit);
    if (cfg.scaleIn && !allowed) pending = null;
    if (pending && !pos) {
      const price = b.o * (1 + cfg.slip);
      const plan = planEntry(d, I, i - 1, price, cfg);
      if (!plan.ok) skipped.push({ at: b.t, idx: i, reason: plan.reason, score: pending.score });
      else {
        const budget = Math.min(cash, cfg.maxPositionKrw);
        const allocation = cfg.scaleIn ? firstAllocation({ cash, equity: cash, price, plan, atr: I.atr[i - 1], signalAt: d[i - 1].t }, cfg) : null;
        const qty = cfg.scaleIn ? allocation ? buyQuantity(allocation.cost, price, cfg) : 0 : Math.min((cash * cfg.risk) / plan.R, budget / (price * (1 + cfg.fee)));
        const cost = cfg.scaleIn ? allocation?.cost ?? 0 : qty * price * (1 + cfg.fee);
        if (cost >= cfg.minOrderKrw) {
          cash -= cost;
          pos = openPosition({ at: b.t, idx: i, price, qty, cost, plan, signal: pending, strategy, scale: allocation?.scale });
        }
      }
    }
    pending = null;
    if (pos && pendingAdd) {
      const price = b.o * (1 + cfg.slip);
      const allocation = additionalAllocation(pos, { cash, price, signal: pendingAdd, signalAt: d[i - 1].t, allowed: allowed && bull[i - 1] && !priceAction(pos, b.o, cfg) }, cfg);
      if (allocation) {
        const fill = { cost: allocation.cost, price, qty: buyQuantity(allocation.cost, price, cfg) };
        cash -= fill.cost;
        applyAdditional(pos, fill, { at: b.t, signalAt: d[i - 1].t, analysis: pendingAdd.analysis ?? null });
      }
    }
    pendingAdd = null;

    if (pos) {
      if (b.o <= pos.stop) sell(i, b.o, priceAction(pos, b.o, cfg));
      else if (b.l <= pos.stop) sell(i, pos.stop, priceAction(pos, pos.stop, cfg));
      else {
        const t1Before = pos.t1Done;
        if (!pos.t1Done && b.h >= pos.t1) sell(i, pos.t1, priceAction(pos, pos.t1, cfg));
        if (pos && pos.t1Done && b.h >= pos.t2) sell(i, pos.t2, priceAction(pos, pos.t2, cfg));
        // 이 봉에서 1차 목표 후 손절가가 본전으로 올라갔고, 고가 이후 종가가 그 아래로 내려왔으면 같은 봉에서 손절
        if (pos && !t1Before && pos.t1Done && b.c <= pos.stop) sell(i, pos.stop, priceAction(pos, pos.stop, cfg));
      }
    }
    if (pos) {
      onCandleClose(pos, {
        at: b.t, close: b.c, prevClose: d[i - 1].c, atr: I.atr[i], s20: I.s20[i], prevS20: I.s20[i - 1],
        score: sc[i].score, barsHeld: completedHoldingBars(d[pos.entryIdx - 1].t, b.t, cfg.unit),
      }, cfg);
    }
    equity[i] = cash + (pos ? pos.qty * b.c * (1 - cfg.fee) : 0);
    if (!pos && i < n - 1 && i >= signalFrom && sc[i].enter) {
      if (!reentryAllowed(lastLossSignalAt, d[i].t, cfg)) skipped.push({ at: b.t, idx: i + 1, reason: '손실 청산 후 재진입 대기', score: sc[i].score });
      else if (bull[i]) pending = sc[i];
      else skipped.push({ at: b.t, idx: i + 1, reason: 'BTC 하락 국면', score: sc[i].score });
    }
    if (pos?.scale && sc[i].add) pendingAdd = sc[i];
  }
  if (pos) {
    sell(n - 1, d[n - 1].c, { qty: pos.qty, reason: '기간 종료 청산', kind: 'end' });
    equity[n - 1] = cash;
  }

  const q0 = capital / (d[WARM].o * (1 + cfg.slip) * (1 + cfg.fee));
  const hold = d.map((b, i) => (i < WARM ? NaN : q0 * b.c * (1 - cfg.fee)));
  const eq = equity.slice(WARM);
  return {
    stats: { ...computeStats(trades, eq, capital), holdRet: (hold[n - 1] / capital - 1) * 100 },
    trades, skipped, equity, hold, scores: sc, bull, I,
    strategy: { id: strategy.id, name: strategy.name }, regimeEnabled: regime.enabled,
  };
}
