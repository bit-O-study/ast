// 실거래 브로커: 빗썸 시장가 주문 후 체결 내역으로 실제 체결가·수수료를 계산
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const floor8 = (x) => Math.floor(x * 1e8) / 1e8;

export class LiveBroker {
  constructor(client, cfg) {
    this.client = client;
    this.cfg = cfg;
    this.coin = cfg.market.split('-')[1];
  }

  get name() { return '실거래'; }

  async balance() {
    const rows = await this.client.accounts();
    const get = (cur) => Number(rows.find((r) => r.currency === cur)?.balance ?? 0);
    return { krw: get('KRW'), coin: get(this.coin) };
  }

  // 주문 후 체결 완료(done) 또는 취소(cancel)까지 최대 timeoutMs 동안 확인
  async waitFill(orderId, timeoutMs = 15000) {
    const until = Date.now() + timeoutMs;
    let o;
    while (Date.now() < until) {
      o = await this.client.getOrder(orderId);
      if (o.state === 'done' || o.state === 'cancel') break;
      await sleep(700);
    }
    const volume = Number(o.executed_volume ?? 0);
    const funds = o.trades?.length
      ? o.trades.reduce((a, t) => a + Number(t.funds), 0)
      : Number(o.executed_funds ?? 0);
    const fee = Number(o.paid_fee ?? 0);
    if (!(volume > 0)) throw new Error(`주문 ${orderId} 체결 수량 없음 (상태 ${o.state})`);
    return { volume, funds, fee, state: o.state };
  }

  async buyMarket(krwAmount) {
    const amount = Math.floor(krwAmount);
    const res = await this.client.placeOrder({ market: this.cfg.market, side: 'bid', order_type: 'price', price: amount });
    const f = await this.waitFill(res.order_id);
    return { price: f.funds / f.volume, qty: f.volume, cost: f.funds + f.fee, fee: f.fee, orderId: res.order_id };
  }

  async sellMarket(qty) {
    const volume = floor8(qty);
    const res = await this.client.placeOrder({ market: this.cfg.market, side: 'ask', order_type: 'market', volume: volume.toFixed(8) });
    const f = await this.waitFill(res.order_id);
    return { price: f.funds / f.volume, qty: f.volume, proceeds: f.funds - f.fee, fee: f.fee, orderId: res.order_id };
  }
}
