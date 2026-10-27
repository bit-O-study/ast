import fs from 'node:fs';

// T-042 실제 호가 기준 체결 비용 측정. 공개 호가·현재가만 조회하고 주문은 내지 않는다.
// 모의 브로커는 직전 체결가(ticker trade_price) × (1 ± SLIPPAGE)로 체결한다. 같은 기준가로
// 1회 주문 금액만큼 호가를 차례로 소진했을 때의 평균 체결가가 얼마나 불리한지 잰다.
// 사용: node scripts/measure-slippage.mjs [표본 수=20] [간격 초=15]
const MARKETS = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'], SIZES = [2_000_000, 3_000_000];
const N = Number(process.argv[2] || 20), GAP = Number(process.argv[3] || 15) * 1000;
const get = async (p) => {
  const r = await fetch('https://api.bithumb.com' + p, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`${p} HTTP ${r.status}`);
  return r.json();
};

// 금액(원)만큼 사기: 매도 호가를 낮은 가격부터 소진. 부족하면 null
export function buyVwap(units, krw) {
  let left = krw, qty = 0;
  for (const u of units) {
    const take = Math.min(left, u.ask_price * u.ask_size);
    qty += take / u.ask_price; left -= take;
    if (left <= 1e-9) return krw / qty;
  }
  return null;
}
// 수량만큼 팔기: 매수 호가를 높은 가격부터 소진
export function sellVwap(units, qty) {
  let left = qty, krw = 0;
  for (const u of units) {
    const take = Math.min(left, u.bid_size);
    krw += take * u.bid_price; left -= take;
    if (left <= 1e-12) return krw / qty;
  }
  return null;
}

const samples = [];
for (let k = 0; k < N; k++) {
  const [books, ticks] = await Promise.all([get('/v1/orderbook?markets=' + MARKETS.join(',')), get('/v1/ticker?markets=' + MARKETS.join(','))]);
  for (const m of MARKETS) {
    const ob = books.find((b) => b.market === m), last = ticks.find((t) => t.market === m).trade_price;
    const u = ob.orderbook_units, mid = (u[0].ask_price + u[0].bid_price) / 2;
    for (const size of SIZES) {
      const b = buyVwap(u, size), s = sellVwap(u, size / last);
      samples.push({ at: Date.now(), market: m, size, last, mid, spread: (u[0].ask_price - u[0].bid_price) / mid,
        buy: b && b / last - 1, sell: s && 1 - s / last, levels: u.length });
    }
  }
  if (k < N - 1) await new Promise((r) => setTimeout(r, GAP));
}
fs.writeFileSync(process.env.OUT ? process.env.OUT + '.json' : 'logs/T042-slippage.json', JSON.stringify(samples, null, 2));
const pct = (x) => (x * 100).toFixed(3) + '%';
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const lines = [`표본 ${N}회 × ${GAP / 1000}초 · 기준가 = 직전 체결가 (모의 브로커와 같음) · 가정 슬리피지 0.050%`, '',
  '| 종목 | 1회 금액 | 호가 스프레드 | 매수 불리 평균 | 최대 | 매도 불리 평균 | 최대 | 호가 부족 |', '|---|---:|---:|---:|---:|---:|---:|---:|'];
for (const m of MARKETS) for (const size of SIZES) {
  const xs = samples.filter((x) => x.market === m && x.size === size), ok = (k) => xs.map((x) => x[k]).filter((v) => v !== null);
  lines.push(`| ${m} | ${size / 1e4}만 | ${pct(avg(xs.map((x) => x.spread)))} | ${pct(avg(ok('buy')))} | ${pct(Math.max(...ok('buy')))} | ${pct(avg(ok('sell')))} | ${pct(Math.max(...ok('sell')))} | ${xs.filter((x) => x.buy === null || x.sell === null).length} |`);
}
console.log(lines.join('\n'));
fs.writeFileSync(process.env.OUT ? process.env.OUT + '.log' : 'logs/T042-slippage.log', lines.join('\n'));
