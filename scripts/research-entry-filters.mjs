import fs from 'node:fs';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';
import { STRATEGIES } from '../src/strategies/index.js';
import { ENTRY_FILTERS } from '../src/research/entry-filters.js';
import { segments, assess } from '../src/research/experiment.js';
import { verify, verifyReport } from '../src/sim/replay.js';

const markets = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'];
const data = Object.fromEntries(markets.map(m => [m, segments(JSON.parse(fs.readFileSync(`logs/T018-${m}-candles.json`, 'utf8')))]));
for (const m of markets) for (let i = 0; i < 3; i++) {
  if (data[m][i].from !== data['KRW-BTC'][i].from || data[m][i].to !== data['KRW-BTC'][i].to) throw new Error('종목별 구간 불일치');
}
const rows = [];
Object.assign(STRATEGIES, ENTRY_FILTERS);
try {
  for (const market of markets) for (let k = 0; k < 3; k++) {
    const segment = data[market][k];
    for (const cost of ['기본', '스트레스']) for (const strategy of ['score', ...Object.keys(ENTRY_FILTERS)]) {
      const cfg = buildConfig({ MODE: 'paper', MARKET: market, STRATEGY: strategy, SCALE_IN: 'false',
        FEE_RATE: cost === '기본' ? '.0004' : '.0025', SLIPPAGE: cost === '기본' ? '.0005' : '.001' });
      const r = backtest(segment.d, cfg, { btc: data['KRW-BTC'][k].d, signalFrom: 200 });
      rows.push({ market, segment: segment.name, cost, strategy, ...r.stats });
    }
    console.log(`${market} ${segment.name} 완료`);
  }
} finally {
  for (const id of Object.keys(ENTRY_FILTERS)) delete STRATEGIES[id];
}
const decisions = Object.keys(ENTRY_FILTERS).map(id => {
  const d = assess(rows, id);
  for (const r of rows.filter(r => r.strategy === id && r.cost === '기본' && r.segment !== '초기')) {
    const baseline = rows.find(b => b.strategy === 'score' && b.market === r.market && b.segment === r.segment && b.cost === r.cost);
    if (!(r.ret > 0 && r.ret > baseline.ret)) d.reasons.push(`${r.segment}/${r.market}: 양수·기존 초과 동시 미충족`);
  }
  return { ...d, pass: d.reasons.length === 0 };
});
fs.writeFileSync('logs/T020-results.json', JSON.stringify({ rows, decisions }, null, 2));
const lines = ['# 진입 지속성 연구 · 2026-10-26', '',
  'T020 사전 고정3가설·72개 비교. T018의 이미 관찰한 시세를 재사용한 탐색이며 독립 검증이 아니다. 종목별 별도1천만원 계좌/매수100만원 상한, 동일 공통 청산. 각 구간200봉 준비 후 현금으로 시작하고 끝에서 청산한다. 공백 보간 없음. 단일진입 백테스트 일일/누적손실 차단 미적용이라는 기존 제한도 유지된다.', '',
  '기본 비용은 편도 수수료0.04%+슬리피지0.05%, 스트레스0.25%+0.10%. 계정 요율 가정. 수익률은 계좌 대비다. 기존 평균 기준에 추가해 후반 두 구간에서 모든 종목이 양수이며 기존 초과여야 통과한다.', '',
  ...decisions.map(d => `- ${d.id}: **${d.pass ? '추가 검증 필요' : '탈락'}**. ${d.reasons.join(' / ')}`), '',
  '| 종목 | 구간 | 비용 | 후보 | 거래수 | 수익률 | MDD | PF |', '|---|---|---|---|---:|---:|---:|---:|',
  ...rows.map(r => `| ${r.market} | ${r.segment} | ${r.cost} | ${r.strategy} | ${r.trades} | ${r.ret.toFixed(3)}% | ${r.mdd.toFixed(3)}% | ${r.pf === null ? '∞' : r.pf.toFixed(3)} |`), '',
  '재현: node scripts/research-entry-filters.mjs. 조건: docs/tasks/T-020-entry-persistence.md. 전체 수치: logs/T020-results.json. 운영 배포 없음.', ''];
fs.writeFileSync('docs/verify/2026-10-26_entry-filters.md', lines.join('\n'));
console.log(JSON.stringify(decisions, null, 2));

if (process.argv.includes('--replay')) {
  const replays = [];
  Object.assign(STRATEGIES, ENTRY_FILTERS);
  try {
    for (const market of markets) for (const strategy of Object.keys(ENTRY_FILTERS)) {
      const cfg = buildConfig({ MODE: 'paper', MARKET: market, STRATEGY: strategy, SCALE_IN: 'false', FEE_RATE: '.0004', SLIPPAGE: '.0005' });
      const d = data[market][2].d;
      const v = await verify(d, cfg, { btc: data['KRW-BTC'][2].d });
      const result = { market, strategy, pass: v.pass, entry: v.entryMatch, route: v.routeMatch, errors: v.replay.errors.length, trades: v.replay.trades };
      replays.push(result);
      fs.writeFileSync(`docs/verify/2026-10-26_entry-filters-${market}-${strategy}.md`, verifyReport(v, d, cfg));
      if (!v.pass) process.exitCode = 1;
      console.log(JSON.stringify(result));
    }
  } finally {
    for (const id of Object.keys(ENTRY_FILTERS)) delete STRATEGIES[id];
  }
  fs.writeFileSync('logs/T020-replay.json', JSON.stringify(replays, null, 2));
}
