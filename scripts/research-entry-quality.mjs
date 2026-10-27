import fs from 'node:fs';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';
import { STRATEGIES } from '../src/strategies/index.js';
import { ENTRY_FILTERS } from '../src/research/entry-filters.js';
import { QUALITY_STRATEGIES } from '../src/research/entry-quality.js';
import { segments, assess } from '../src/research/experiment.js';
import { verify, verifyReport } from '../src/sim/replay.js';

const markets = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'];
const data = Object.fromEntries(markets.map(m => [m, segments(JSON.parse(fs.readFileSync(`logs/T018-${m}-candles.json`, 'utf8')))]));
for (const market of markets) for (let k = 0; k < 3; k++) {
  if (data[market][k].from !== data['KRW-BTC'][k].from || data[market][k].to !== data['KRW-BTC'][k].to) throw new Error('종목 구간 불일치');
}
const registry = { research_persistence: ENTRY_FILTERS.research_persistence, ...QUALITY_STRATEGIES };
const original = Object.fromEntries(Object.keys(registry).map(id => [id, STRATEGIES[id]]));
const config = (market, strategy, cost = '기본') => buildConfig({ MODE: 'paper', MARKET: market, STRATEGY: strategy,
  SCALE_IN: 'false', FEE_RATE: cost === '기본' ? '.0004' : '.0025', SLIPPAGE: cost === '기본' ? '.0005' : '.001' });
const rows = [], replays = [];
Object.assign(STRATEGIES, registry);
try {
  for (const market of markets) for (let k = 0; k < 3; k++) {
    for (const cost of ['기본', '스트레스']) for (const strategy of ['score', ...Object.keys(registry)]) {
      const r = backtest(data[market][k].d, config(market, strategy, cost), { btc: data['KRW-BTC'][k].d, signalFrom: 200 });
      rows.push({ market, segment: data[market][k].name, cost, strategy, ...r.stats });
    }
  }
  const decisions = Object.keys(QUALITY_STRATEGIES).map(id => {
    const d = assess(rows, id), vsPersistence = [];
    for (const r of rows.filter(r => r.strategy === id && r.cost === '기본' && r.segment !== '초기')) {
      const find = strategy => rows.find(b => b.strategy === strategy && b.market === r.market && b.segment === r.segment && b.cost === r.cost);
      if (!(r.ret > 0 && r.ret > find('score').ret)) d.reasons.push(`${r.segment}/${r.market}: 양수·기존 초과 동시 미충족`);
      vsPersistence.push({ market: r.market, segment: r.segment, delta: r.ret - find('research_persistence').ret });
    }
    return { ...d, pass: d.reasons.length === 0, vsPersistence };
  });
  fs.writeFileSync('logs/T022-results.json', JSON.stringify({ rows, decisions }, null, 2));
  const lines = ['# 진입 품질 연구 · 2026-10-26', '',
    'T022 사전 고정3가설/2비교군·90개 비교. T018 시세 재사용/3연속구간/준비200봉. 별도1천만원 계좌·매수100만원 상한, 최초손절/청산 동일. 기본 편도 비용0.04%+슬리피지0.05%, 스트레스0.25%+0.10%(계정 요율 가정). 구간별 현금 재시작/끝 청산, 공백 보간 없음. 단일진입 백테스트 일일/누적손실 차단 미적용 제한 유지.', '',
    '이미 본 데이터의 후속 탐색이며 독립 검증이 아니다. 후반 두 기간 모든 종목 양수·score 초과, 평균MDD/스트레스/거래수 조건을 동시에 요구한다. 상세 가설과 판정은 docs/tasks/T-022-entry-quality.md.', '',
    ...decisions.map(d => `- ${d.id}: **${d.pass ? '추가 검증 대상' : '탈락'}**. ${d.reasons.join(' / ')}`), '',
    '| 종목 | 구간 | 비용 | 전략 | 거래 | 수익률 | MDD | PF |', '|---|---|---|---|---:|---:|---:|---:|',
    ...rows.map(r => `| ${r.market} | ${r.segment} | ${r.cost} | ${r.strategy} | ${r.trades} | ${r.ret.toFixed(3)}% | ${r.mdd.toFixed(3)}% | ${r.pf === null ? '∞' : r.pf.toFixed(3)} |`), '',
    '## 지속 신호 대비 차이', '', '| 후보 | 종목 | 구간 | 차이(%p) |', '|---|---|---|---:|',
    ...decisions.flatMap(d => d.vsPersistence.map(r => `| ${d.id} | ${r.market} | ${r.segment} | ${r.delta.toFixed(3)} |`)), '',
    '재현: node scripts/research-entry-quality.mjs --replay. 원본 logs/T022-results.json. 운영 미배포.', ''];
  fs.writeFileSync('docs/verify/2026-10-26_entry-quality.md', lines.join('\n'));
  console.log(JSON.stringify(decisions, null, 2));
  if (process.argv.includes('--replay')) {
    for (const market of markets) for (const strategy of Object.keys(QUALITY_STRATEGIES)) {
      const d = data[market][2].d, cfg = config(market, strategy);
      const v = await verify(d, cfg, { btc: data['KRW-BTC'][2].d });
      const r = { market, strategy, pass: v.pass, entry: v.entryMatch, route: v.routeMatch, trades: v.replay.trades, errors: v.replay.errors.length };
      replays.push(r);
      fs.writeFileSync(`docs/verify/2026-10-26_entry-quality-${market}-${strategy}.md`, verifyReport(v, d, cfg));
      if (!v.pass) process.exitCode = 1;
      console.log(JSON.stringify(r));
    }
    fs.writeFileSync('logs/T022-replay.json', JSON.stringify(replays, null, 2));
  }
} finally {
  for (const [id, value] of Object.entries(original)) {
    if (value === undefined) delete STRATEGIES[id]; else STRATEGIES[id] = value;
  }
}
