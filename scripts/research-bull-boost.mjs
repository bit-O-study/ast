import fs from 'node:fs';
import { runFixed, combinePnl } from '../src/research/fixed-portfolio.js';

// T-040 과거 자료 점검 (채택 근거 아님): 사전 등록한 상승장 확대 규칙이 하락장 방어를 망가뜨리지 않는지만 본다.
// 3종목 × {기본 200만, 확대 200→300만}. 종목별 손익을 시각 기준으로 합산 (T-037 방법).
const MARKETS = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'], CAPITAL = 10_000_000, UNIT = 14400000;
const data = Object.fromEntries(MARKETS.map((m) => [m, JSON.parse(fs.readFileSync(`logs/T038-${m}-candles.json`, 'utf8'))]));
const btcAll = data['KRW-BTC'], lastT = btcAll.at(-1).t;
const kstYear = (y) => Date.UTC(y, 0, 1) - 9 * 3600e3;
const periods = [['2020H2', Date.UTC(2020, 6, 1), kstYear(2021)], ...[2021, 2022, 2023, 2024, 2025].map((y) => [String(y), kstYear(y), kstYear(y + 1)]), ['2026(~10월)', kstYear(2026), lastT + UNIT]];
const COSTS = { 기본: ['.0004', '.0005'], 스트레스: ['.0025', '.001'] };
const SETS = { 기본200만: '0', 확대300만: '3000000' };

function run(m, [, from, to], boost, cost) {
  const all = data[m].filter((b) => b.t < to), s = all.findIndex((b) => b.t >= from), a = Math.max(0, s - 200);
  const [fee, slip] = COSTS[cost];
  const r = runFixed({ d: all.slice(a), btc: btcAll.filter((b) => b.t < to), signalFrom: Math.max(60, s - a), market: m, capital: CAPITAL,
    env: { FEE_RATE: fee, SLIPPAGE: slip, MAX_POSITION_KRW: '2000000', BOOST_POSITION_KRW: boost } });
  return { ...r, boosted: r.trades.filter((t) => t.cost > 2_000_001).length };
}
const combine = (parts) => ({ ...combinePnl(parts, CAPITAL), boosted: parts.reduce((a, x) => a + x.boosted, 0) });
const f = (x, n = 2) => x.toFixed(n), out = [];
for (const cost of Object.keys(COSTS)) {
  out.push(`\n## 비용 ${cost}\n`, '| 구간 | 기본 수익 | MDD | 확대 수익 | MDD | 차이 | 확대 거래 비율 |', '|---|---:|---:|---:|---:|---:|---:|');
  const sum = { b: 0, x: 0, bw: 0, xw: 0, downB: 0, downX: 0 };
  for (const p of periods) {
    const [b, x] = Object.values(SETS).map((boost) => combine(MARKETS.map((m) => run(m, p, boost, cost))));
    sum.b += b.ret; sum.x += x.ret; sum.bw = Math.max(sum.bw, b.mdd); sum.xw = Math.max(sum.xw, x.mdd);
    if (['2022', '2025', '2026(~10월)'].includes(p[0])) { sum.downB += b.ret; sum.downX += x.ret; }
    out.push(`| ${p[0]} | ${f(b.ret)}% | ${f(b.mdd, 1)}% | ${f(x.ret)}% | ${f(x.mdd, 1)}% | ${f(x.ret - b.ret)}%p | ${x.trades ? Math.round((100 * x.boosted) / x.trades) : 0}% |`);
  }
  out.push(`| **합계·최악MDD** | **${f(sum.b)}%** | **${f(sum.bw, 1)}%** | **${f(sum.x)}%** | **${f(sum.xw, 1)}%** | ${f(sum.x - sum.b)}%p | |`);
  out.push(`\n하락장 연도(2022·2025·2026) 합계: 기본 ${f(sum.downB)}% · 확대 ${f(sum.downX)}%`);
}
const text = out.join('\n');
console.log(text);
fs.writeFileSync('logs/T040-history.log', text);
