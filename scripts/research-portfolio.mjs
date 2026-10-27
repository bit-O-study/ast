import fs from 'node:fs';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';
import { segments } from '../src/research/experiment.js';

// T-037 3종목 동시 운용. score 전략·청산 규칙은 그대로이고, 1회 매수 금액(원)과 운용 종목만 바꾼다.
// 금액이 고정이라 종목별 손익을 시각 기준으로 더하면 한 계좌 동시 운용과 같다 (3×300만 ≤ 1천만, 현금 부족 없음).
// 단일 진입 백테스트의 일일 손실 한도·킬 스위치 미적용 제한은 그대로다.
const markets = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'], CAPITAL = 10_000_000;
const t018 = Object.fromEntries(markets.map((m) => [m, segments(JSON.parse(fs.readFileSync(`logs/T018-${m}-candles.json`, 'utf8')))]));
const hist = Object.fromEntries(markets.map((m) => [m, JSON.parse(fs.readFileSync(`logs/T027-${m}-history.json`, 'utf8'))]));
const t018Start = JSON.parse(fs.readFileSync('logs/T018-KRW-BTC-candles.json', 'utf8'))[0].t;

const periods = [];
for (const [name, from, to] of [['2020H2', Date.UTC(2020, 6, 1), Date.UTC(2021, 0, 1)], ['2021', Date.UTC(2021, 0, 1), Date.UTC(2022, 0, 1)],
  ['2022', Date.UTC(2022, 0, 1), Date.UTC(2023, 0, 1)], ['2023', Date.UTC(2023, 0, 1), t018Start]]) {
  periods.push({ name, get: (m) => {
    const d = hist[m].filter((b) => b.t < to), s = d.findIndex((b) => b.t >= from), a = Math.max(0, s - 200);
    return { d: d.slice(a), btc: hist['KRW-BTC'].filter((b) => b.t < to), signalFrom: Math.max(60, s - a) };
  } });
}
for (let k = 0; k < 3; k++) periods.push({ name: `${t018['KRW-BTC'][k].name}(${new Date(t018['KRW-BTC'][k].from).toISOString().slice(0, 7)})`, get: (m) => ({ d: t018[m][k].d, btc: t018['KRW-BTC'][k].d, signalFrom: 200 }) });

const COSTS = { 기본: ['.0004', '.0005'], 스트레스: ['.0025', '.001'] };
function run(p, m, size, cost) {
  const { d, btc, signalFrom } = p.get(m);
  const [fee, slip] = COSTS[cost];
  const r = backtest(d, buildConfig({ MODE: 'paper', MARKET: m, STRATEGY: 'score', SCALE_IN: 'false', FEE_RATE: fee, SLIPPAGE: slip,
    MAX_POSITION_KRW: String(size), RISK_PER_TRADE: '1' }), { btc, signalFrom, capital: CAPITAL });
  const from = d[signalFrom].t;
  // 평가 시작 이후 시각별 손익(원)과 보유 여부
  const pnl = new Map(), held = new Map();
  d.forEach((b, i) => { if (b.t >= from) pnl.set(b.t, (Number.isFinite(r.equity[i]) ? r.equity[i] : CAPITAL) - CAPITAL); });
  for (const t of r.trades) for (const b of d) if (b.t >= t.entryAt && b.t <= t.exitAt) held.set(b.t, true);
  return { pnl, held, trades: r.trades };
}

// 시각 합집합 위에서 직전 값을 이어 붙여 합산
function combine(parts) {
  const times = [...new Set(parts.flatMap((x) => [...x.pnl.keys()]))].sort((a, b) => a - b);
  const last = parts.map(() => 0);
  let peak = CAPITAL, mdd = 0, maxHeld = 0;
  const eq = times.map((t) => {
    parts.forEach((x, k) => { if (x.pnl.has(t)) last[k] = x.pnl.get(t); });
    const e = CAPITAL + last.reduce((a, v) => a + v, 0);
    peak = Math.max(peak, e); mdd = Math.max(mdd, 1 - e / peak);
    maxHeld = Math.max(maxHeld, parts.filter((x) => x.held.get(t)).length);
    return e;
  });
  return { ret: (eq.at(-1) / CAPITAL - 1) * 100, mdd: mdd * 100, maxHeld, trades: parts.reduce((a, x) => a + x.trades.length, 0) };
}

// 일 단위 손익 상관 (분산 효과 확인용)
function dailyCorr(a, b) {
  const day = (x) => { const m = new Map(); let prev = 0; for (const [t, v] of [...x.pnl].sort((p, q) => p[0] - q[0])) { const k = Math.floor((t + 9 * 3600e3) / 86400e3); m.set(k, (m.get(k) ?? 0) + v - prev); prev = v; } return m; };
  const da = day(a), db = day(b), keys = [...da.keys()].filter((k) => db.has(k));
  const xs = keys.map((k) => da.get(k)), ys = keys.map((k) => db.get(k));
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length, mx = mean(xs), my = mean(ys);
  const cov = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0), vx = xs.reduce((s, x) => s + (x - mx) ** 2, 0), vy = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  return vx && vy ? cov / Math.sqrt(vx * vy) : 0;
}

const SETS = [
  ['A BTC 300만(현행)', [['KRW-BTC', 3e6]]],
  ['B 3종목×300만', markets.map((m) => [m, 3e6])],
  ['C BTC 900만', [['KRW-BTC', 9e6]]],
  ['D 3종목×100만', markets.map((m) => [m, 1e6])],
  ['E 3종목×200만', markets.map((m) => [m, 2e6])],
];
const f = (x, n = 2) => x.toFixed(n);
const out = [];
for (const cost of Object.keys(COSTS)) {
  out.push(`\n## 비용 ${cost} (편도 수수료 ${COSTS[cost][0]} + 슬리피지 ${COSTS[cost][1]})\n`);
  out.push(`| 구간 | ${SETS.map(([n]) => `${n} 수익 | MDD | 수익/MDD`).join(' | ')} |`);
  out.push(`|---|${SETS.map(() => '---:|---:|---:').join('|')}|`);
  const sum = SETS.map(() => ({ ret: 0, worstMdd: 0, pos: 0 }));
  for (const p of periods) {
    const cache = new Map();
    const get = (m, size) => { const k = `${m}:${size}`; if (!cache.has(k)) cache.set(k, run(p, m, size, cost)); return cache.get(k); };
    const cells = SETS.map(([, legs], j) => {
      const c = combine(legs.map(([m, size]) => get(m, size)));
      sum[j].ret += c.ret; sum[j].worstMdd = Math.max(sum[j].worstMdd, c.mdd); if (c.ret > 0) sum[j].pos++;
      return `${f(c.ret)}% | ${f(c.mdd, 1)}% | ${c.mdd ? f(c.ret / c.mdd) : '—'}`;
    });
    out.push(`| ${p.name} | ${cells.join(' | ')} |`);
    if (cost === '기본') {
      const b = get('KRW-BTC', 3e6), e = get('KRW-ETH', 3e6), x = get('KRW-XRP', 3e6);
      p.corr = `BTC-ETH ${f(dailyCorr(b, e))} · BTC-XRP ${f(dailyCorr(b, x))} · ETH-XRP ${f(dailyCorr(e, x))} · 동시 보유 최대 ${combine([b, e, x]).maxHeld}종목`;
    }
  }
  out.push(`| **7구간 합계·최악MDD·양수 구간** | ${sum.map((s) => `**${f(s.ret)}%** | **${f(s.worstMdd, 1)}%** | ${s.pos}/7`).join(' | ')} |`);
}
out.push('\n## 일 단위 손익 상관 (기본 비용, 300만)\n');
for (const p of periods) out.push(`- ${p.name}: ${p.corr}`);
const text = out.join('\n');
console.log(text);
fs.writeFileSync('logs/T037-portfolio.log', text);
