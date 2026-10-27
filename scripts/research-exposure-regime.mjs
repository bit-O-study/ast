import fs from 'node:fs';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';
import { segments } from '../src/research/experiment.js';
import { REGIME_HOLD, portfolio } from '../src/research/regime-hold.js';

// T-027 구조 진단: 투입 비중, 비용, BTC 국면 보유. 운영 코드는 바꾸지 않는다.
const markets = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'], data = {};
for (const m of markets) data[m] = segments(JSON.parse(fs.readFileSync(`logs/T018-${m}-candles.json`, 'utf8')));
const f = (x, n = 2) => x.toFixed(n);

// 1. 현행 score 전략의 실제 투입 금액과 보유 시간 비율
console.log('## 1. score 투입 비중 (기본 비용)');
for (let k = 0; k < 3; k++) for (const m of markets) {
  const seg = data[m][k];
  const r = backtest(seg.d, buildConfig({ MODE: 'paper', MARKET: m, STRATEGY: 'score', SCALE_IN: 'false', FEE_RATE: '.0004', SLIPPAGE: '.0005' }), { btc: data['KRW-BTC'][k].d, signalFrom: 200 });
  const held = r.trades.reduce((a, t) => a + (t.exitIdx - t.entryIdx + 1), 0);
  const capped = r.trades.filter(t => t.cost >= 999_000).length;
  console.log(`${m} ${seg.name} 거래${r.trades.length} 100만상한 ${capped}건 보유봉 ${f(100 * held / (seg.d.length - 200), 0)}% 수익률 ${f(r.stats.ret)}% 보유 ${f(r.stats.holdRet, 1)}%`);
}

// 2. score 비용 민감도 (편도 수수료 0.04% / 0.25%)
console.log('\n## 2. score 비용 민감도 (3종목 평균 수익률)');
for (const fee of ['.0004', '.0025']) for (let k = 0; k < 3; k++) {
  const rs = markets.map(m => backtest(data[m][k].d, buildConfig({ MODE: 'paper', MARKET: m, STRATEGY: 'score', SCALE_IN: 'false', FEE_RATE: fee, SLIPPAGE: '.0005' }), { btc: data['KRW-BTC'][k].d, signalFrom: 200 }).stats);
  console.log(`수수료 ${fee} ${data['KRW-BTC'][k].name}: ${rs.map(r => f(r.ret)).join('/')} 평균 ${f(rs.reduce((a, r) => a + r.ret, 0) / 3)}% MDD ${rs.map(r => f(r.mdd, 1)).join('/')}`);
}

// 3. 국면 보유: 사전 등록 규칙(BTC 20일, 일 1회)과 비교용 4시간 판정
console.log('\n## 3. 국면 보유 3종목 동일비중 (편도 비용 = 수수료+슬리피지)');
const every4h = { ...REGIME_HOLD, decisionHourKst: null };
for (const [name, cost] of [['기본', 0.0009], ['실요율0.25', 0.003], ['스트레스', 0.0035]]) for (let k = 0; k < 3; k++) {
  const btc = data['KRW-BTC'][k].d, byMarket = Object.fromEntries(markets.map(m => [m, data[m][k].d]));
  const out = [['BTC/일 1회(등록)', REGIME_HOLD], ['BTC/4시간', every4h]].map(([label, rule]) => {
    const p = portfolio(byMarket, btc, cost, btc[200].t, rule);
    return `${label} ${f(p.ret, 1)}%/MDD${f(p.mdd, 1)}% [${p.per.map(x => f(x.ret, 0)).join('/')}] 전환${p.per[0].switches}`;
  });
  const p = portfolio(byMarket, btc, cost, btc[200].t);
  console.log(`${name} ${data['KRW-BTC'][k].name} 보유${f(p.hold.ret, 1)}%/MDD${f(p.hold.mdd, 1)}% | ${out.join(' | ')}`);
}
