// 모의투자 브로커: 실제 빗썸 현재가에 수수료·슬리피지를 붙여 가상 체결
// 여러 종목 동시 운용(T-007)에서는 모든 종목이 같은 지갑(store.state.paper)의 현금을 쓴다.
// 첫 종목 코인은 기존 paper.coin, 나머지는 paper.coins[종목]에 둔다 (한 파일이라 원자적으로 저장).
export class PaperBroker {
  constructor(store, cfg, { primary = true } = {}) {
    this.store = store;
    this.cfg = cfg;
    this.market = cfg.market;
    this.primary = primary;
    const s = store.state;
    if (!s.paper) s.paper = { krw: cfg.paperKrw, coin: 0 };
    if (!primary) { s.paper.coins ??= {}; s.paper.coins[this.market] ??= 0; }
    store.save();
  }

  get name() { return '모의투자'; }

  get coin() { const p = this.store.state.paper; return this.primary ? p.coin : p.coins[this.market]; }
  set coin(v) { const p = this.store.state.paper; if (this.primary) p.coin = v; else p.coins[this.market] = v; }

  async balance() {
    return { krw: this.store.state.paper.krw, coin: this.coin };
  }

  async buyMarket(krwAmount, refPrice) {
    const p = this.store.state.paper;
    if (krwAmount > p.krw) throw new Error(`모의 잔고 부족: ${Math.round(p.krw)}원`);
    const price = refPrice * (1 + this.cfg.slip);
    const fee = krwAmount * this.cfg.fee;
    const qty = (krwAmount - fee) / price;
    p.krw -= krwAmount;
    this.coin += qty;
    this.store.save();
    return { price, qty, cost: krwAmount, fee };
  }

  async sellMarket(qty, refPrice) {
    const p = this.store.state.paper;
    qty = Math.min(qty, this.coin);
    const price = refPrice * (1 - this.cfg.slip);
    const gross = qty * price, fee = gross * this.cfg.fee;
    this.coin -= qty;
    p.krw += gross - fee;
    this.store.save();
    return { price, qty, proceeds: gross - fee, fee };
  }
}
