import fs from 'node:fs';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';
import { indicators } from '../src/indicators.js';
import { WARM, scoreAt } from '../src/strategy.js';
import { buildRegime } from '../src/regime.js';

// T-039 진단: score 전략 우위가 2025~2026년에 약해진 원인. 전략을 바꾸지 않고 연도별로 비교만 한다.
// 1) 신호 예측력 2) 거래 구조 3) 시장 성격. 신호·국면은 실매매와 같은 함수(scoreAt, buildRegime)로 계산한다.
const MARKETS = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'], UNIT = 14400000, CAPITAL = 10_000_000;
const data = Object.fromEntries(MARKETS.map((m) => [m, JSON.parse(fs.readFileSync(`logs/T038-${m}-candles.json`, 'utf8'))]));
const btc = data['KRW-BTC'];
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const yearOf = (t) => new Date(t + 9 * 3600e3).getUTCFullYear();
const cfg = buildConfig({ MODE: 'paper', FEE_RATE: '.0004', SLIPPAGE: '.0005' });
const regime = buildRegime(btc, cfg);
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const pct = (x, n = 2) => Number.isFinite(x) ? (x * 100).toFixed(n) + '%' : '—';
const out = [];

// 1) 신호 예측력: 진입 신호(점수 ≥ 기준, BTC 상승 국면) 다음 봉 시가에 사서 H봉 뒤 종가까지 수익률, 같은 해 전체 봉 평균과 비교
const H = [6, 24, 42]; // 1·4·7일
out.push('## 1. 신호 예측력 (진입 신호 뒤 수익률 − 같은 해 무조건 평균, 3종목 합산)\n');
out.push(`| 연도 | 신호 수 | ${H.map((h) => `${h / 6}일 신호 | ${h / 6}일 초과`).join(' | ')} | 7일 신호 승률 |`);
out.push(`|---|---:|${H.map(() => '---:|---:').join('|')}|---:|`);
const sig = {}, base = {};
for (const m of MARKETS) {
  const d = data[m], I = indicators(d);
  for (let i = WARM; i < d.length - 43; i++) {
    const y = yearOf(d[i].t), entry = d[i + 1].o;
    const fwd = H.map((h) => d[i + h].c / entry - 1);
    (base[y] ??= []).push(fwd);
    const s = scoreAt(d, I, i).score;
    if (s >= cfg.entryScore && regime.isBull(d[i].t + UNIT)) (sig[y] ??= []).push(fwd);
  }
}
for (const y of YEARS) {
  const s = sig[y] ?? [], b = base[y] ?? [];
  const cells = H.map((_, k) => { const ms = mean(s.map((f) => f[k])), mb = mean(b.map((f) => f[k])); return `${pct(ms)} | ${pct(ms - mb)}`; });
  out.push(`| ${y} | ${s.length} | ${cells.join(' | ')} | ${pct(mean(s.map((f) => (f[2] > 0 ? 1 : 0))), 0)} |`);
}

// 2) 거래 구조: 연도 구간 백테스트(1회 200만, 기본 비용)
out.push('\n## 2. 거래 구조 (1회 200만, 기본 비용, 3종목 합산)\n');
out.push('| 연도 | 거래 | 승률 | 평균 이익 | 평균 손실 | 손익비 | PF | 1차 목표 도달 | 평균 보유(봉) | 청산 사유 상위 |');
out.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
for (const y of YEARS) {
  const from = Date.UTC(y, 0, 1) - 9 * 3600e3 + (y === 2020 ? Date.UTC(2020, 6, 1) - Date.UTC(2020, 0, 1) : 0), to = Date.UTC(y + 1, 0, 1) - 9 * 3600e3;
  const trades = [];
  for (const m of MARKETS) {
    const all = data[m].filter((b) => b.t < to), s = all.findIndex((b) => b.t >= from), a = Math.max(0, s - 200);
    const r = backtest(all.slice(a), buildConfig({ MODE: 'paper', MARKET: m, STRATEGY: 'score', SCALE_IN: 'false', FEE_RATE: '.0004', SLIPPAGE: '.0005', MAX_POSITION_KRW: '2000000', RISK_PER_TRADE: '1' }),
      { btc: btc.filter((b) => b.t < to), signalFrom: Math.max(60, s - a), capital: CAPITAL });
    trades.push(...r.trades);
  }
  const win = trades.filter((t) => t.pnl > 0), loss = trades.filter((t) => t.pnl <= 0);
  const gw = win.reduce((a, t) => a + t.pnl, 0), gl = -loss.reduce((a, t) => a + t.pnl, 0);
  const reasons = {};
  for (const t of trades) reasons[t.reason] = (reasons[t.reason] ?? 0) + 1;
  const top = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${Math.round((100 * v) / trades.length)}%`).join(', ');
  const t1 = trades.filter((t) => t.exits.some((e) => e.reason === '1차 목표가 도달')).length;
  const aw = mean(win.map((t) => t.pct / 100)), al = mean(loss.map((t) => t.pct / 100));
  out.push(`| ${y} | ${trades.length} | ${pct(win.length / trades.length, 0)} | ${pct(aw)} | ${pct(al)} | ${(aw / -al).toFixed(2)} | ${gl ? (gw / gl).toFixed(2) : '∞'} | ${pct(t1 / trades.length, 0)} | ${mean(trades.map((t) => t.exitIdx - t.entryIdx)).toFixed(1)} | ${top} |`);
}

// 3) 시장 성격: 4시간 변동성, 일간 수익률 자기상관·분산비(추세 지속성), ADX≥25 비율, BTC 상승 국면 비율
out.push('\n## 3. 시장 성격 (3종목 평균, BTC 국면은 BTC 기준)\n');
out.push('| 연도 | 연환산 변동성 | ATR/가격 | 일간 자기상관 | 분산비 VR(5) | ADX≥25 비율 | BTC 상승 국면 | 일간 상승 비율 |');
out.push('|---|---:|---:|---:|---:|---:|---:|---:|');
for (const y of YEARS) {
  const per = MARKETS.map((m) => {
    const d = data[m], I = indicators(d), idx = d.map((b, i) => i).filter((i) => i >= WARM && yearOf(d[i].t) === y);
    const r4 = idx.filter((i) => d[i].t - d[i - 1].t === UNIT).map((i) => Math.log(d[i].c / d[i - 1].c));
    // KST 00시 마감 봉으로 일간 종가 (4시간봉 마감은 KST 00·04·08·12·16·20시)
    const daily = idx.filter((i) => new Date(d[i].t + UNIT + 9 * 3600e3).getUTCHours() === 0).map((i) => d[i].c);
    const r1 = daily.slice(1).map((c, k) => Math.log(c / daily[k]));
    const r5 = daily.slice(5).map((c, k) => Math.log(c / daily[k]));
    const m1 = mean(r1), ac = mean(r1.slice(1).map((x, k) => (x - m1) * (r1[k] - m1))) / mean(r1.map((x) => (x - m1) ** 2));
    return { vol: std(r4) * Math.sqrt(6 * 365), atr: mean(idx.map((i) => I.atr[i] / d[i].c)), ac, vr: std(r5) ** 2 / (5 * std(r1) ** 2),
      adx: mean(idx.map((i) => (I.adx[i] >= 25 ? 1 : 0))), up: mean(r1.map((x) => (x > 0 ? 1 : 0))) };
  });
  const bi = btc.map((b, i) => i).filter((i) => i >= WARM && yearOf(btc[i].t) === y);
  const bull = mean(bi.map((i) => (regime.isBull(btc[i].t + UNIT) ? 1 : 0)));
  const avg = (k) => mean(per.map((p) => p[k]));
  out.push(`| ${y} | ${pct(avg('vol'), 0)} | ${pct(avg('atr'))} | ${avg('ac').toFixed(3)} | ${avg('vr').toFixed(2)} | ${pct(avg('adx'), 0)} | ${pct(bull, 0)} | ${pct(avg('up'), 0)} |`);
}
const text = out.join('\n');
console.log(text);
fs.writeFileSync('logs/T039-edge-decay.log', text);
