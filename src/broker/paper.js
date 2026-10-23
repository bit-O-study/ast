// 모의투자 브로커: 실제 빗썸 현재가에 수수료·슬리피지를 붙여 가상 체결
export class PaperBroker {
  constructor(store, cfg) {
    this.store = store;
    this.cfg = cfg;
    if (!store.state.paper) {
      store.state.paper = { krw: cfg.paperKrw, coin: 0 };
      store.save();
    }
  }

  get name() { return '모의투자'; }

  async balance() {
    const { krw, coin } = this.store.state.paper;
    return { krw, coin };
  }

  async buyMarket(krwAmount, refPrice) {
    const p = this.store.state.paper;
    if (krwAmount > p.krw) throw new Error(`모의 잔고 부족: ${Math.round(p.krw)}원`);
    const price = refPrice * (1 + this.cfg.slip);
    const fee = krwAmount * this.cfg.fee;
    const qty = (krwAmount - fee) / price;
    p.krw -= krwAmount;
    p.coin += qty;
    this.store.save();
    return { price, qty, cost: krwAmount, fee };
  }

  async sellMarket(qty, refPrice) {
    const p = this.store.state.paper;
    qty = Math.min(qty, p.coin);
    const price = refPrice * (1 - this.cfg.slip);
    const gross = qty * price, fee = gross * this.cfg.fee;
    p.coin -= qty;
    p.krw += gross - fee;
    this.store.save();
    return { price, qty, proceeds: gross - fee, fee };
  }
}
