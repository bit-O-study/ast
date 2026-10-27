import fs from 'node:fs';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';

// T-038 운용 종목 확대. score 전략·청산 규칙은 그대로이고, 종목 수와 종목당 1회 금액만 바꾼다.
// 종목은 research-universe-fetch.mjs의 사전 규칙(거래대금 순위)대로 앞에서부터 N개를 쓴다 (성과로 고르지 않음).
// 최대 투입액 600만 고정: 3×200만, 5×120만, 8×75만, 10×60만. 종목별 손익은 시각 기준으로 합산한다 (T-037과 같은 방법).
const CAPITAL = 10_000_000, UNIT = 14400000;
const universe = JSON.parse(fs.readFileSync('logs/T038-universe.json', 'utf8')).chosen.map((c) => c.market);
const data = Object.fromEntries(universe.map((m) => [m, JSON.parse(fs.readFileSync(`logs/T038-${m}-candles.json`, 'utf8'))]));
const btcAll = data['KRW-BTC'];
const lastT = btcAll.at(-1).t;
const periods = [['2020H2', Date.UTC(2020, 6, 1), Date.UTC(2021, 0, 1)], ['2021', Date.UTC(2021, 0, 1), Date.UTC(2022, 0, 1)],
  ['2022', Date.UTC(2022, 0, 1), Date.UTC(2023, 0, 1)], ['2023', Date.UTC(2023, 0, 1), Date.UTC(2024, 0, 1)],
  ['2024', Date.UTC(2024, 0, 1), Date.UTC(2025, 0, 1)], ['2025', Date.UTC(2025, 0, 1), Date.UTC(2026, 0, 1)], ['2026(~10월)', Date.UTC(2026, 0, 1), lastT + UNIT]];
const COSTS = { 기본: ['.0004', '.0005'], 스트레스: ['.0025', '.001'] };

const cache = new Map();
function run(m, [, from, to], size, cost) {
  const key = `${m}:${from}:${size}:${cost}`;
  if (cache.has(key)) return cache.get(key);
  const all = data[m].filter((b) => b.t < to), s = all.findIndex((b) => b.t >= from), a = Math.max(0, s - 200);
  const d = all.slice(a), signalFrom = Math.max(60, s - a);
  const [fee, slip] = COSTS[cost];
  const r = backtest(d, buildConfig({ MODE: 'paper', MARKET: m, STRATEGY: 'score', SCALE_IN: 'false', FEE_RATE: fee, SLIPPAGE: slip,
    MAX_POSITION_KRW: String(size), RISK_PER_TRADE: '1' }), { btc: btcAll.filter((b) => b.t < to), signalFrom, capital: CAPITAL });
  const pnl = new Map();
  d.forEach((b, i) => { if (b.t >= d[signalFrom].t) pnl.set(b.t, (Number.isFinite(r.equity[i]) ? r.equity[i] : CAPITAL) - CAPITAL); });
  const out = { pnl, trades: r.trades.length, ret: r.stats.ret, hold: r.stats.holdRet };
  cache.set(key, out);
  return out;
}
function combine(parts) {
  const times = [...new Set(parts.flatMap((x) => [...x.pnl.keys()]))].sort((a, b) => a - b);
  const last = parts.map(() => 0);
  let peak = CAPITAL, mdd = 0, e = CAPITAL;
  for (const t of times) {
    parts.forEach((x, k) => { if (x.pnl.has(t)) last[k] = x.pnl.get(t); });
    e = CAPITAL + last.reduce((a, v) => a + v, 0);
    peak = Math.max(peak, e); mdd = Math.max(mdd, 1 - e / peak);
  }
  return { ret: (e / CAPITAL - 1) * 100, mdd: mdd * 100, trades: parts.reduce((a, x) => a + x.trades, 0) };
}

const SETS = [[3, 2_000_000], [5, 1_200_000], [8, 750_000], [10, 600_000]];
const f = (x, n = 2) => x.toFixed(n);
const out = [`종목 순서(거래대금): ${universe.join(', ')}`];
for (const cost of Object.keys(COSTS)) {
  out.push(`\n## 비용 ${cost} · 최대 투입 600만 고정\n`);
  out.push(`| 구간 | ${SETS.map(([n, s]) => `${n}종목×${s / 1e4}만 수익 | MDD`).join(' | ')} |`);
  out.push(`|---|${SETS.map(() => '---:|---:').join('|')}|`);
  const sum = SETS.map(() => ({ ret: 0, worst: 0, pos: 0, trades: 0 }));
  for (const p of periods) {
    const cells = SETS.map(([n, size], j) => {
      const c = combine(universe.slice(0, n).map((m) => run(m, p, size, cost)));
      Object.assign(sum[j], { ret: sum[j].ret + c.ret, worst: Math.max(sum[j].worst, c.mdd), pos: sum[j].pos + (c.ret > 0), trades: sum[j].trades + c.trades });
      return `${f(c.ret)}% | ${f(c.mdd, 1)}%`;
    });
    out.push(`| ${p[0]} | ${cells.join(' | ')} |`);
  }
  out.push(`| **합계·최악MDD·양수·거래** | ${sum.map((s) => `**${f(s.ret)}%** | **${f(s.worst, 1)}%** · ${s.pos}/7 · ${s.trades}건`).join(' | ')} |`);
}
// 종목별 성과 (1회 200만 단독, 기본 비용): 어느 종목이 수익에 기여하는지
out.push('\n## 종목별 단독 성과 (1회 200만, 기본 비용, 계좌 1천만 기준 수익률 / 단순 보유)\n');
out.push(`| 종목 | ${periods.map((p) => p[0]).join(' | ')} | 합계 |`);
out.push(`|---|${periods.map(() => '---:').join('|')}|---:|`);
for (const m of universe) {
  const rs = periods.map((p) => run(m, p, 2_000_000, '기본'));
  out.push(`| ${m} | ${rs.map((r) => `${f(r.ret, 1)} / ${f(r.hold, 0)}`).join(' | ')} | **${f(rs.reduce((a, r) => a + r.ret, 0), 1)}** |`);
}
const text = out.join('\n');
console.log(text);
fs.writeFileSync('logs/T038-universe.log', text);
