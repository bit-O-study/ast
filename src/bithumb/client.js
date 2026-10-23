import { buildToken, toQueryString } from './auth.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 빗썸 응답 캔들 → 내부 형식 (t = 봉 시작 시각, UTC ms)
export function mapCandle(c) {
  return {
    t: Date.parse(c.candle_date_time_utc + 'Z'),
    o: c.opening_price,
    h: c.high_price,
    l: c.low_price,
    c: c.trade_price,
    v: c.candle_acc_trade_volume,
    value: c.candle_acc_trade_price,
  };
}

export class BithumbClient {
  constructor({ accessKey = '', secretKey = '', fetchImpl = globalThis.fetch, base = 'https://api.bithumb.com', timeoutMs = 10000 } = {}) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.fetch = fetchImpl;
    this.base = base;
    this.timeoutMs = timeoutMs;
  }

  async request(method, path, params = {}, auth = false) {
    const qs = toQueryString(params);
    let url = this.base + path;
    const headers = { accept: 'application/json' };
    let body;
    if (method === 'GET' || method === 'DELETE') {
      if (qs) url += '?' + qs;
    } else {
      body = JSON.stringify(params);
      headers['content-type'] = 'application/json; charset=utf-8';
    }
    if (auth) {
      if (!this.accessKey || !this.secretKey) throw new Error('빗썸 API 키가 설정되지 않았습니다');
      headers.authorization = 'Bearer ' + buildToken(this.accessKey, this.secretKey, qs);
    }
    // 모든 요청에 타임아웃 (CONTRACTS C3). 주문 요청이 타임아웃되면 체결 여부를 알 수 없으므로 T-006에서 조회로 확인한다
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res, text;
    try {
      res = await this.fetch(url, { method, headers, body, signal: ctrl.signal });
      text = await res.text();
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(`빗썸 API 응답 없음 (${this.timeoutMs / 1000}초) ${method} ${path}`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
      const err = data && data.error ? `${data.error.name}: ${data.error.message}` : String(text).slice(0, 200);
      const e = new Error(`빗썸 API ${res.status} ${method} ${path} - ${err}`);
      e.status = res.status;
      e.body = data;
      throw e;
    }
    return data;
  }

  // ── 시세 (공개) ──
  // 결과는 오래된 → 최신 순으로 정렬해 돌려준다 (빗썸 원본은 최신순)
  async candles(market, unit, { count = 200, to } = {}) {
    const rows = await this.request('GET', `/v1/candles/minutes/${unit}`, { market, count, to });
    return rows.map(mapCandle).reverse();
  }

  // count개를 200개씩 나눠 과거로 거슬러 받는다
  async candlesRange(market, unit, total) {
    let out = [];
    let to;
    while (out.length < total) {
      const rows = await this.request('GET', `/v1/candles/minutes/${unit}`, { market, count: Math.min(200, total - out.length), to });
      if (!rows.length) break;
      out = rows.map(mapCandle).reverse().concat(out);
      to = rows[rows.length - 1].candle_date_time_kst; // 이 시각의 봉은 제외되고 그 이전 봉이 온다
      if (rows.length < 200) break;
      await sleep(120);
    }
    return out;
  }

  async ticker(market) {
    const [row] = await this.request('GET', '/v1/ticker', { markets: market });
    return { price: row.trade_price, at: row.trade_timestamp };
  }

  // ── 계좌·주문 (인증 필요) ──
  accounts() {
    return this.request('GET', '/v1/accounts', {}, true);
  }

  // order_type: limit | price(시장가 매수, price=원화 총액) | market(시장가 매도, volume=수량)
  placeOrder({ market, side, order_type, price, volume, client_order_id }) {
    const params = { market, side, order_type };
    if (price !== undefined) params.price = String(price);
    if (volume !== undefined) params.volume = String(volume);
    if (client_order_id) params.client_order_id = client_order_id;
    return this.request('POST', '/v2/orders', params, true);
  }

  getOrder(orderId) {
    return this.request('GET', '/v1/order', { uuid: orderId }, true);
  }

  cancelOrder(orderId) {
    return this.request('DELETE', '/v2/order', { order_id: orderId }, true);
  }
}
