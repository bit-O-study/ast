import fs from 'node:fs';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';
import { segments } from '../src/research/experiment.js';

// T-027 매수 금액 비교: score 전략은 그대로, 1회 매수 금액만 고정 100/300/500만원(계좌 10/30/50%).
// RISK_PER_TRADE=1로 두어 위험 기준 크기가 아니라 금액 상한이 항상 적용되게 한다(현행도 192건 전부 상한 적용).
const markets = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'];
const t018 = Object.fromEntries(markets.map((m) => [m, segments(JSON.parse(fs.readFileSync(`logs/T018-${m}-candles.json`, 'utf8')))]));
const hist = Object.fromEntries(markets.map((m) => [m, JSON.parse(fs.readFileSync(`logs/T027-${m}-history.json`, 'utf8'))]));
const t018Start = JSON.parse(fs.readFileSync('logs/T018-KRW-BTC-candles.json', 'utf8'))[0].t;
const periods = [];
// 미관찰(2024-01 이전): 시작 전 최대 200봉은 지표 준비에만 사용
for (const [name, from, to] of [['2020H2*', Date.UTC(2020, 6, 1), Date.UTC(2021, 0, 1)], ['2021*', Date.UTC(2021, 0, 1), Date.UTC(2022, 0, 1)],
  ['2022*', Date.UTC(2022, 0, 1), Date.UTC(2023, 0, 1)], ['2023*', Date.UTC(2023, 0, 1), t018Start]]) {
  periods.push({ name, get: (m) => {
    const d = hist[m].filter((b) => b.t < to), s = d.findIndex((b) => b.t >= from), a = Math.max(0, s - 200);
    return { d: d.slice(a), btc: hist['KRW-BTC'].filter((b) => b.t < to), signalFrom: Math.max(60, s - a) };
  } });
}
for (let k = 0; k < 3; k++) periods.push({ name: t018['KRW-BTC'][k].name, get: (m) => ({ d: t018[m][k].d, btc: t018['KRW-BTC'][k].d, signalFrom: 200 }) });

const sizes = [1_000_000, 3_000_000, 5_000_000];
console.log('* = 미관찰 구간. 3종목 별도 계좌 평균 수익률 / 최대 MDD (기본 비용 0.04%+0.05%)\n');
console.log(`| 구간 | ${sizes.map((s) => `${s / 1e4}만 수익 | MDD`).join(' | ')} |`);
console.log(`|---|${sizes.map(() => '---:|---:').join('|')}|`);
for (const p of periods) {
  const cells = sizes.map((size) => {
    const rs = markets.map((m) => {
      const { d, btc, signalFrom } = p.get(m);
      return backtest(d, buildConfig({ MODE: 'paper', MARKET: m, STRATEGY: 'score', SCALE_IN: 'false', FEE_RATE: '.0004', SLIPPAGE: '.0005',
        MAX_POSITION_KRW: String(size), RISK_PER_TRADE: '1' }), { btc, signalFrom }).stats;
    });
    return `${(rs.reduce((a, r) => a + r.ret, 0) / 3).toFixed(2)}% | ${Math.max(...rs.map((r) => r.mdd)).toFixed(1)}%`;
  });
  console.log(`| ${p.name} | ${cells.join(' | ')} |`);
}
