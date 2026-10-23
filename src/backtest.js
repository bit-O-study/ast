import { WARM, planEntry } from './strategy.js';
import { getStrategy } from './strategies/index.js';
import { buildRegime } from './regime.js';
import { openPosition, priceAction, applyExit, onCandleClose, toTrade } from './position.js';

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
  const d = await client.candlesRange(cfg.market, cfg.unit, count);
  if (cfg.regimeFilter === 'off' || isBtc(cfg.market)) return { d, btc: null };
  const extra = Math.round((cfg.regimeDays * 1440) / cfg.unit) + 5;
  const btc = await client.candlesRange('KRW-BTC', cfg.unit, count + extra);
  return { d, btc };
}

// 봉 단위 백테스트.
// - 신호는 봉 마감 후 계산하고 다음 봉 시가에 매수 (미래 데이터 참조 없음)
// - 봉 안의 순서는 보수적으로: 시가 갭 → 손절가(저가) → 목표가(고가)
// - 국면 필터: 신호 봉 마감 시각에 BTC가 하락 국면이면 진입하지 않음
export function backtest(d, cfg, { capital = cfg.paperKrw, btc = null } = {}) {
  const n = d.length, unitMs = cfg.unit * 60e3;
  const strategy = getStrategy(cfg.strategy);
  if (cfg.regimeFilter === 'btc' && !btc && !isBtc(cfg.market)) throw new Error('국면 필터에 쓸 BTC 시세가 필요합니다 (loadBacktestData 사용)');
  const regime = buildRegime(btc ?? d, cfg);
  const ctx = strategy.prepare(d);
  const I = ctx.I;
  const sc = d.map((_, i) => (i >= Math.max(WARM, strategy.minBars) ? strategy.evaluate(ctx, i, cfg) : null));
  const bull = d.map((b) => regime.isBull(b.t + unitMs));
  let cash = capital, pos = null, pending = null;
  const trades = [], skipped = [], equity = Array(n).fill(NaN);

  const sell = (i, rawPrice, act) => {
    const price = rawPrice * (1 - cfg.slip);
    const proceeds = act.qty * price * (1 - cfg.fee);
    cash += proceeds;
    if (applyExit(pos, { at: d[i].t, idx: i, price, qty: act.qty, proceeds, reason: act.reason, kind: act.kind }, cfg)) {
      trades.push(toTrade(pos));
      pos = null;
    }
  };

  for (let i = WARM; i < n; i++) {
    const b = d[i];
    if (pending && !pos) {
      const price = b.o * (1 + cfg.slip);
      const plan = planEntry(d, I, i - 1, price, cfg);
      if (!plan.ok) skipped.push({ at: b.t, idx: i, reason: plan.reason, score: pending.score });
      else {
        const budget = Math.min(cash, cfg.maxPositionKrw);
        const qty = Math.min((cash * cfg.risk) / plan.R, budget / (price * (1 + cfg.fee)));
        const cost = qty * price * (1 + cfg.fee);
        if (cost >= cfg.minOrderKrw) {
          cash -= cost;
          pos = openPosition({ at: b.t, idx: i, price, qty, cost, plan, signal: pending });
        }
      }
    }
    pending = null;

    if (pos) {
      if (b.o <= pos.stop) sell(i, b.o, priceAction(pos, b.o, cfg));
      else if (b.l <= pos.stop) sell(i, pos.stop, priceAction(pos, pos.stop, cfg));
      else {
        if (!pos.t1Done && b.h >= pos.t1) sell(i, pos.t1, priceAction(pos, pos.t1, cfg));
        if (pos && pos.t1Done && b.h >= pos.t2) sell(i, pos.t2, priceAction(pos, pos.t2, cfg));
      }
    }
    if (pos) {
      onCandleClose(pos, {
        at: b.t, close: b.c, prevClose: d[i - 1].c, atr: I.atr[i], s20: I.s20[i], prevS20: I.s20[i - 1],
        score: sc[i].score, barsHeld: i - pos.entryIdx,
      }, cfg);
    }
    equity[i] = cash + (pos ? pos.qty * b.c * (1 - cfg.fee) : 0);
    if (!pos && i < n - 1 && sc[i].enter) {
      if (bull[i]) pending = { score: sc[i].score, parts: sc[i].parts };
      else skipped.push({ at: b.t, idx: i + 1, reason: 'BTC 하락 국면', score: sc[i].score });
    }
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
