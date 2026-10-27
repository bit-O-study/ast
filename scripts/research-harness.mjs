import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';
import { STRATEGIES } from '../src/strategies/index.js';
import { ENTRY_FILTERS } from '../src/research/entry-filters.js';
import { segments, assess } from '../src/research/experiment.js';
import { verify, verifyReport } from '../src/sim/replay.js';

// 고정 연구 조건을 재사용한다. 후보와 판정 기준은 실행 전에 명세에 기록한다.
export async function runResearch({ id, slug, title, candidates, specification }) {
  const markets = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'], hashes = {}, data = {};
  for (const market of markets) {
    const raw = fs.readFileSync(`logs/T018-${market}-candles.json`);
    hashes[market] = createHash('sha256').update(raw).digest('hex');
    data[market] = segments(JSON.parse(raw.toString('utf8')));
  }
  for (const market of markets) for (let k = 0; k < 3; k++) {
    if (data[market][k].from !== data['KRW-BTC'][k].from || data[market][k].to !== data['KRW-BTC'][k].to) throw new Error('종목별 구간 불일치');
  }
  const registry = { research_persistence: ENTRY_FILTERS.research_persistence, ...candidates };
  const original = Object.fromEntries(Object.keys(registry).map(key => [key, STRATEGIES[key]]));
  const config = (market, strategy, cost = '기본') => buildConfig({ MODE: 'paper', MARKET: market, STRATEGY: strategy,
    SCALE_IN: 'false', FEE_RATE: cost === '기본' ? '.0004' : '.0025', SLIPPAGE: cost === '기본' ? '.0005' : '.001' });
  const rows = [], replays = [];
  const report = `docs/verify/2026-10-26_${slug}.md`;
  Object.assign(STRATEGIES, registry);
  try {
    for (const market of markets) for (let k = 0; k < 3; k++) {
      for (const cost of ['기본', '스트레스']) for (const strategy of ['score', ...Object.keys(registry)]) {
        const r = backtest(data[market][k].d, config(market, strategy, cost), { btc: data['KRW-BTC'][k].d, signalFrom: 200 });
        rows.push({ market, segment: data[market][k].name, cost, strategy, ...r.stats });
      }
    }
    const decisions = Object.keys(candidates).map(strategy => {
      const decision = assess(rows, strategy), vsPersistence = [];
      for (const r of rows.filter(r => r.strategy === strategy && r.cost === '기본' && r.segment !== '초기')) {
        const find = key => rows.find(b => b.strategy === key && b.market === r.market && b.segment === r.segment && b.cost === r.cost);
        if (!(r.ret > 0 && r.ret > find('score').ret)) decision.reasons.push(`${r.segment}/${r.market}: 양수·기존 초과 동시 미충족`);
        vsPersistence.push({ market: r.market, segment: r.segment, delta: r.ret - find('research_persistence').ret });
      }
      return { ...decision, pass: decision.reasons.length === 0, vsPersistence };
    });
    fs.writeFileSync(`logs/${id}-results.json`, JSON.stringify({ hashes, rows, decisions }, null, 2));
    const lines = [`# ${title} · 2026-10-26`, '',
      `${id} 사전 고정${Object.keys(candidates).length}후보/2비교군·${rows.length}개 비교. T018 고정시세/3연속구간/준비200봉. 별도1천만원 계좌·매수100만원 상한, 최초손절/청산 동일. 기본 편도 비용0.04%+슬리피지0.05%, 스트레스0.25%+0.10%(계정 요율 가정). 구간별 현금 재시작/끝 청산, 공백 보간 없음. 단일진입 백테스트 일일/누적손실 차단 미적용 제한 유지.`, '',
      `이미 관찰한 데이터의 후속 탐색이며 독립 검증이 아니다. 후반 두 기간 전종목 양수·score 초과/평균MDD/스트레스/30거래 기준을 모두 요구한다. 상세 명세: ${specification}.`, '',
      ...decisions.map(d => `- ${d.id}: **${d.pass ? '추가 검증 대상' : '탈락'}**. ${d.reasons.join(' / ')}`), '',
      '| 종목 | 구간 | 비용 | 후보 | 거래 | 수익률 | MDD | PF |', '|---|---|---|---|---:|---:|---:|---:|',
      ...rows.map(r => `| ${r.market} | ${r.segment} | ${r.cost} | ${r.strategy} | ${r.trades} | ${r.ret.toFixed(3)}% | ${r.mdd.toFixed(3)}% | ${r.pf === null ? '∞' : r.pf.toFixed(3)} |`), '',
      '## 지속 신호 비교군 대비 차이', '', '| 후보 | 종목 | 구간 | 차이(%p) |', '|---|---|---|---:|',
      ...decisions.flatMap(d => d.vsPersistence.map(r => `| ${d.id} | ${r.market} | ${r.segment} | ${r.delta.toFixed(3)} |`)), '',
      `원본 및 입력 SHA256: logs/${id}-results.json. 운영 변경/배포 없음.`, ''];
    fs.writeFileSync(report, lines.join('\n'));
    console.log(JSON.stringify(decisions, null, 2));
    if (process.argv.includes('--replay')) {
      fs.appendFileSync(report, '\n## 공통 Trader 리플레이\n\n');
      for (const market of markets) for (const strategy of Object.keys(candidates)) {
        const d = data[market][2].d, cfg = config(market, strategy);
        const v = await verify(d, cfg, { btc: data['KRW-BTC'][2].d });
        const r = { market, strategy, pass: v.pass, entry: v.entryMatch, route: v.routeMatch, trades: v.replay.trades, errors: v.replay.errors.length };
        replays.push(r);
        fs.writeFileSync(`docs/verify/2026-10-26_${slug}-${market}-${strategy}.md`, verifyReport(v, d, cfg));
        fs.appendFileSync(report, `- ${market}/${strategy}: ${r.pass ? '일치' : '불일치'}, ${r.trades}거래, 진입${(r.entry * 100).toFixed(1)}%/청산${(r.route * 100).toFixed(1)}%, 오류${r.errors}.\n`);
        if (!v.pass) process.exitCode = 1;
        console.log(JSON.stringify(r));
      }
      fs.writeFileSync(`logs/${id}-replay.json`, JSON.stringify(replays, null, 2));
    }
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete STRATEGIES[key]; else STRATEGIES[key] = value;
    }
  }
}
