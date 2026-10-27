import fs from 'node:fs';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';
import { segments, assess } from '../src/research/experiment.js';
import { EXIT_PROFILES } from '../src/research/exit-profiles.js';
import { verify, verifyReport } from '../src/sim/replay.js';

const markets = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'];
const data = Object.fromEntries(markets.map(m => [m, JSON.parse(fs.readFileSync(`logs/T018-${m}-candles.json`, 'utf8'))]));
const costs = [{ name: '기본', fee: .0004, slip: .0005 }, { name: '스트레스', fee: .0025, slip: .001 }];
const rows = [], replays = [];
const config = (market, profile, cost = costs[0]) => buildConfig({ MODE: 'paper', STRATEGY: 'score', SCALE_IN: 'false',
  MARKET: market, FEE_RATE: String(cost.fee), SLIPPAGE: String(cost.slip), ...profile.env });

for (const market of markets) for (const segment of segments(data[market])) {
  const btc = data['KRW-BTC'].filter(b => b.t >= segment.d[0].t && b.t <= segment.to);
  for (const cost of costs) for (const profile of EXIT_PROFILES) {
    const cfg = config(market, profile, cost), r = backtest(segment.d, cfg, { btc, signalFrom: 200 });
    const losses = r.trades.filter(t => t.pnl <= 0);
    rows.push({ market, segment: segment.name, strategy: profile.id, cost: cost.name, ...r.stats,
      averageTrade: r.trades.length ? r.trades.reduce((s,t) => s + t.pct,0) / r.trades.length : null,
      averageBars: r.trades.length ? r.trades.reduce((s,t) => s + t.exitIdx-t.entryIdx+1,0) / r.trades.length : null,
      turnover: r.trades.reduce((s,t) => s+t.cost,0) / cfg.paperKrw,
      lossAverage: losses.length ? losses.reduce((s,t) => s+t.pct,0) / losses.length : null,
      waiting: r.skipped.filter(s => s.reason === '손실 청산 후 재진입 대기').length });
  }
  console.log(`${market} ${segment.name} 완료`);
}
const decisions = EXIT_PROFILES.slice(1).map(p => assess(rows, p.id));
fs.writeFileSync('logs/T019-results.json', JSON.stringify({ profiles: EXIT_PROFILES, rows, decisions }, null, 2));
const lines = ['# 재진입·청산 비교 · 2026-10-26', '',
  'T019 사전 명세에 고정한4개 후보. T018에서 이미 본6000봉3종목을 공백 기준3연속구간으로 분리/각200봉 준비. 재사용한 탐색 자료이며 독립 검증이 아닙니다. score 진입과 최초손절/위험2%/초기1000만원/포지션100만원/국면필터 동일. 비용 기본0.04%+슬리피지0.05%, 스트레스0.25%+0.10%(각 편도). 계정 요율 미확인 가정.', '',
  '보유 경계는 강제 청산 시각이 아니라 손절을 종가-0.5ATR로 좁히는 시점입니다. 120봉으로 늘려도 초기손절은 내리지 않습니다. 회전율은 누적 매수금액/초기자금입니다. 모든 구간은 현금 재시작/끝에서 비용 포함 청산하며 공백을 가짜 봉으로 보간하지 않았습니다. 단일진입 백테스트의 기존 일일/누적손실 차단 미적용 제한은 T018과 동일합니다.', '',
  ...EXIT_PROFILES.map(p => `- ${p.id}: ${p.label}`), '', '## 고정 기준 평가', '',
  ...decisions.map(d => `- ${d.id}: **${d.pass ? '추가 검증 후보' : '미충족'}**, 후반${d.trades}건. ${d.reasons.join(' / ') || '미관찰 과거 기간과 모의 실행 확인 필요'}`), '',
  '| 종목 | 구간 | 비용 | 프로필 | 거래 | 수익률 | MDD | PF | 거래당 순수익률 | 평균 보유봉 | 회전율 | 대기 신호 |',
  '|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|'];
const fmt = x => x === null ? '표본 없음' : x.toFixed(2);
for (const r of rows) lines.push(`| ${r.market} | ${r.segment} | ${r.cost} | ${r.strategy} | ${r.trades} | ${fmt(r.ret)}% | ${fmt(r.mdd)}% | ${r.pf===null?'∞':fmt(r.pf)} | ${fmt(r.averageTrade)}% | ${fmt(r.averageBars)} | ${fmt(r.turnover)} | ${r.waiting} |`);
lines.push('', '참고: [Man AHL의 거래 속도와 비용](https://www.man.com/insights/need-for-speed-trend-following), [Turtle 규칙](https://www.turtletrader.com/rules/). 본6봉 대기/분할 비율의 수익성을 원전이 보장하지 않습니다.', '', '재현: node scripts/research-exits.mjs. 원본: logs/T018-*-candles.json, 수치: logs/T019-results.json.', '', '## 모의 실행 대조', '');
fs.writeFileSync('docs/verify/2026-10-26_exits-research.md',lines.join('\n')+'\n');
console.log(JSON.stringify(decisions,null,2));
for (const market of markets) for (const profile of EXIT_PROFILES.slice(1)) {
  const segment = segments(data[market])[2], cfg = config(market, profile);
  const btc = data['KRW-BTC'].filter(b => b.t >= segment.d[0].t && b.t <= segment.to);
  const v = await verify(segment.d,cfg,{btc});
  const row = { market, profile:profile.id, pass:v.pass, trades:v.replay.trades, entry:v.entryMatch, route:v.routeMatch, errors:v.replay.errors.length };
  replays.push(row); console.log(JSON.stringify(row));
  fs.writeFileSync(`docs/verify/2026-10-26_exits-${market}-${profile.id}.md`,verifyReport(v,segment.d,cfg));
  fs.appendFileSync('docs/verify/2026-10-26_exits-research.md',`- ${market} ${profile.id}: ${row.pass?'일치':'불일치'}, ${row.trades}건, 진입${(row.entry*100).toFixed(0)}%/청산${(row.route*100).toFixed(0)}%, 오류${row.errors}.\n`);
  if (!v.pass) process.exitCode=1;
}
fs.writeFileSync('logs/T019-replay.json',JSON.stringify(replays,null,2));
