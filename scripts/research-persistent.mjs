import fs from 'node:fs';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';
import { STRATEGIES } from '../src/strategies/index.js';
import { segments, assess } from '../src/research/experiment.js';
import { PERSISTENT_PROFILES as profiles, PERSISTENT_STRATEGIES } from '../src/research/persistent-profiles.js';
import { verify, verifyReport } from '../src/sim/replay.js';

const markets = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'];
const data = Object.fromEntries(markets.map(m => [m, segments(JSON.parse(fs.readFileSync(`logs/T018-${m}-candles.json`, 'utf8')))]));
for (const market of markets) for (let k = 0; k < 3; k++) {
  if (data[market][k].from !== data['KRW-BTC'][k].from || data[market][k].to !== data['KRW-BTC'][k].to) throw new Error('종목 구간 불일치');
}
const config = (market, p, cost = '기본') => buildConfig({ MODE: 'paper', MARKET: market, STRATEGY: p.strategy,
  SCALE_IN: 'false', FEE_RATE: cost === '기본' ? '.0004' : '.0025', SLIPPAGE: cost === '기본' ? '.0005' : '.001', ...p.env });
const rows = [], ledger = [], replays = [];
const original = Object.fromEntries(Object.keys(PERSISTENT_STRATEGIES).map(id => [id, STRATEGIES[id]]));
Object.assign(STRATEGIES, PERSISTENT_STRATEGIES);
try {
  // 신규 후보를 실행하기 전에 기존 지속 신호의 모든 거래를 원인별로 기록한다.
  for (const market of markets) for (let k = 0; k < 3; k++) {
    const segment = data[market][k], cfg = config(market, profiles[1]);
    const r = backtest(segment.d, cfg, { btc: data['KRW-BTC'][k].d, signalFrom: 200 });
    for (const trade of r.trades) ledger.push({ market, segment: segment.name, ...trade });
  }
  const groups = [];
  for (const market of markets) for (const segment of ['초기', '중기', '최근']) {
    const trades = ledger.filter(t => t.market === market && t.segment === segment);
    for (const reason of new Set(trades.map(t => t.reason))) {
      const selected = trades.filter(t => t.reason === reason);
      groups.push({ market, segment, reason, count: selected.length, losses: selected.filter(t => t.pnl <= 0).length,
        pnl: selected.reduce((s, t) => s + t.pnl, 0), bars: selected.reduce((s, t) => s + t.exitIdx - t.entryIdx + 1, 0) / selected.length });
    }
  }
  fs.writeFileSync('logs/T021-diagnosis.json', JSON.stringify({ groups, ledger }, null, 2));
  console.log(JSON.stringify(groups.filter(g => g.market === 'KRW-BTC' && g.segment === '중기'), null, 2));
  if (!process.argv.includes('--compare')) {
    console.log('진단 완료. 신규 후보 비교는 --compare로 실행합니다.');
  } else {
    for (const market of markets) for (let k = 0; k < 3; k++) {
      const segment = data[market][k];
      for (const cost of ['기본', '스트레스']) for (const p of profiles) {
        const cfg = config(market, p, cost);
        const r = backtest(segment.d, cfg, { btc: data['KRW-BTC'][k].d, signalFrom: 200 });
        rows.push({ market, segment: segment.name, strategy: p.id, cost, ...r.stats });
      }
    }
    const decisions = profiles.slice(2).map(p => {
      const d = assess(rows, p.id);
      const vsPersistence = [];
      for (const r of rows.filter(r => r.strategy === p.id && r.cost === '기본' && r.segment !== '초기')) {
        const baseline = rows.find(b => b.strategy === 'score' && b.market === r.market && b.segment === r.segment && b.cost === r.cost);
        const control = rows.find(b => b.strategy === 'persistence' && b.market === r.market && b.segment === r.segment && b.cost === r.cost);
        if (!(r.ret > 0 && r.ret > baseline.ret)) d.reasons.push(`${r.segment}/${r.market}: 양수·기존 초과 동시 미충족`);
        vsPersistence.push({ market: r.market, segment: r.segment, delta: r.ret - control.ret });
      }
      return { ...d, pass: d.reasons.length === 0, vsPersistence };
    });
    fs.writeFileSync('logs/T021-results.json', JSON.stringify({ profiles, rows, decisions }, null, 2));
    const lines = ['# 지속 신호·청산 조합 연구 · 2026-10-26', '',
      'T021 사전 고정4후보와2비교군, 총108개. 기존 T018 시세 재사용/3연속구간/준비200봉. 별도 계좌1천만원·포지션100만원·최초손절 불변. 기본 편도 수수료0.04%+슬리피지0.05%, 스트레스0.25%+0.10%. 계정 요율 가정. 초기 위험·투자액 확대 없음. 구간마다 현금 재시작/종료 청산. 일일·누적손실 차단 미적용인 기존 단일진입 백테스트의 제한 유지.', '',
      '이미 관찰한 진입/청산 가설을 조합한 후속 탐색으로 독립 검증이 아니다. 두 후반 구간 모두 모든 종목 양수·score 초과, 평균MDD 한도/비용/거래수 기준 충족 시에만 별도 과거 검증 대상으로 삼는다.', '',
      ...decisions.map(d => `- ${d.id}: **${d.pass ? '추가 검증 대상' : '탈락'}**. ${d.reasons.join(' / ')}`), '',
      '## 기존 지속 신호의 청산 원인 진단', '',
      '| 종목 | 구간 | 최종 청산 이유 | 거래 | 손실 거래 | 순손익(원) | 평균 보유봉 |', '|---|---|---|---:|---:|---:|---:|',
      ...groups.map(g => `| ${g.market} | ${g.segment} | ${g.reason} | ${g.count} | ${g.losses} | ${g.pnl.toFixed(0)} | ${g.bars.toFixed(1)} |`), '',
      '최종 청산 이유별 집계에는 앞선 분할청산 손익도 포함된다. 원인별 손익은 기술적 분류이며 인과관계를 증명하지 않는다. 전 거래 원장 logs/T021-diagnosis.json.', '',
      '## 전체 비교', '', '| 종목 | 구간 | 비용 | 프로필 | 거래 | 수익률 | MDD | PF |', '|---|---|---|---|---:|---:|---:|---:|',
      ...rows.map(r => `| ${r.market} | ${r.segment} | ${r.cost} | ${r.strategy} | ${r.trades} | ${r.ret.toFixed(3)}% | ${r.mdd.toFixed(3)}% | ${r.pf === null ? '∞' : r.pf.toFixed(3)} |`), '',
      '## 지속 신호 비교군 대비 수익률 차이', '', '| 후보 | 종목 | 구간 | 차이(%p) |', '|---|---|---|---:|',
      ...decisions.flatMap(d => d.vsPersistence.map(r => `| ${d.id} | ${r.market} | ${r.segment} | ${r.delta.toFixed(3)} |`)), '',
      '재현: node scripts/research-persistent.mjs --compare --replay. 원본 logs/T021-results.json. 운영 배포 없음.', ''];
    fs.writeFileSync('docs/verify/2026-10-26_persistent-research.md', lines.join('\n'));
    console.log(JSON.stringify(decisions, null, 2));
  }
  if (process.argv.includes('--replay')) {
    for (const market of markets) for (const p of profiles.slice(2)) {
      const d = data[market][2].d, cfg = config(market, p);
      const v = await verify(d, cfg, { btc: data['KRW-BTC'][2].d });
      const r = { market, profile: p.id, pass: v.pass, entry: v.entryMatch, route: v.routeMatch, errors: v.replay.errors.length, trades: v.replay.trades };
      replays.push(r);
      fs.writeFileSync(`docs/verify/2026-10-26_persistent-${market}-${p.id}.md`, verifyReport(v, d, cfg));
      if (!v.pass) process.exitCode = 1;
      console.log(JSON.stringify(r));
    }
    fs.writeFileSync('logs/T021-replay.json', JSON.stringify(replays, null, 2));
  }
} finally {
  for (const [id, value] of Object.entries(original)) {
    if (value === undefined) delete STRATEGIES[id]; else STRATEGIES[id] = value;
  }
}
