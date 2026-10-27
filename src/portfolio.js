// 여러 종목 동시 운용 (T-007). 종목별 Trader는 진입·청산을 각자 처리하고,
// 계좌 평가금액·일일 손실 한도·킬 스위치·일시정지는 여기서 계좌 단위로 판단한다.
const kstDay = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);

export class Portfolio {
  // wallet: 공유 현금이 있는 첫 종목 저장소 (state.paper, state.portfolio)
  constructor({ cfg, wallet, now = Date.now }) {
    Object.assign(this, { cfg, wallet, now });
    this.traders = [];
    this.killing = false;
  }

  add(trader) { this.traders.push(trader); trader.portfolio = this; return trader; }

  get state() { return (this.wallet.state.portfolio ??= {}); }

  // 공유 현금 + Σ 종목 코인 × 현재가. 가격을 아직 못 받은 종목이 있으면 NaN
  equity() {
    let eq = this.wallet.state.paper.krw;
    for (const t of this.traders) {
      const coin = t.broker.coin ?? 0;
      if (coin) eq += coin * t.price;
    }
    return eq;
  }

  ready() { return this.traders.every((t) => Number.isFinite(t.price)); }

  // 모든 Trader의 init()이 끝난 뒤 한 번 부른다
  init() {
    const eq = this.equity(), s = this.state;
    s.startEquity ??= eq;
    s.day ??= kstDay(this.now());
    s.dayStartEquity ??= eq;
    s.killed ??= false;
    this.wallet.save();
  }

  dailyBlocked() {
    if (!this.ready()) return false;
    return this.equity() <= this.state.dayStartEquity * (1 - this.cfg.dailyLossLimit);
  }

  // 각 Trader의 tick에서 부른다. 날짜가 바뀌면 일일 기준을 갱신하고, 누적 손실 한도면 전 종목 매도 후 정지
  async checkRisk() {
    if (!this.ready()) return;
    const s = this.state, eq = this.equity(), today = kstDay(this.now());
    if (s.day !== today) { s.day = today; s.dayStartEquity = eq; this.wallet.save(); }
    if (s.killed || this.killing || !(eq <= s.startEquity * (1 - this.cfg.killSwitchLoss))) return;
    this.killing = true;
    try {
      this.traders[0].emit('kill', { msg: `계좌 누적 손실 ${(this.cfg.killSwitchLoss * 100).toFixed(0)}% 도달: 전 종목 전량 매도 후 정지` });
      for (const t of this.traders) { await t.sellAll('킬 스위치'); t.state.killed = true; t.store.save(); }
      s.killed = true;
      this.wallet.save();
    } finally { this.killing = false; }
  }

  pause(reason) { for (const t of this.traders) t.pause(reason); }
  resume() { for (const t of this.traders) t.resume(); }
  async sellAll(reason) { for (const t of this.traders) await t.sellAll(reason); }

  summary() {
    const s = this.state, eq = this.equity();
    return {
      equity: eq, cash: this.wallet.state.paper.krw, startEquity: s.startEquity, dayStartEquity: s.dayStartEquity,
      killed: !!s.killed, dailyBlocked: this.dailyBlocked(),
      markets: this.traders.map((t) => {
        const pos = t.state.position, coin = t.broker.coin ?? 0;
        return {
          market: t.cfg.market, price: t.price, coin, value: coin * t.price,
          position: pos ? { entryPrice: pos.entryPrice, cost: pos.cost, stop: pos.stop, t1: pos.t1, unrealized: pos.qty * t.price * (1 - t.cfg.fee) - pos.cost * (pos.qty / pos.qtyInit) } : null,
          score: t.signal?.score ?? null, enter: !!t.signal?.enter, halted: !!t.state.halted, lastError: t.lastError,
        };
      }),
    };
  }
}
