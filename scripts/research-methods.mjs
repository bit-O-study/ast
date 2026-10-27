import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { BithumbClient } from '../src/bithumb/client.js';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';
import { STRATEGIES } from '../src/strategies/index.js';
import { CANDIDATES } from '../src/research/candidates.js';
import { validateCandles, segments, assess } from '../src/research/experiment.js';
import { verify, verifyReport } from '../src/sim/replay.js';

// .env/계좌키/운영 저장소를 읽지 않는다. 공개 시세와 격리 모의 코드만 사용한다.
const cached = process.argv.includes('--cached');
const client = new BithumbClient(), markets = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'];
const costs = [{ name: '기본', fee: .0004, slip: .0005 }, { name: '스트레스', fee: .0025, slip: .001 }];
const strategies = ['score', 'defensive', 'breakout', ...Object.keys(CANDIDATES)];
const data = {}, manifest = [], rows = [], replays = [];
fs.mkdirSync('logs', { recursive: true });
fs.mkdirSync('docs/verify', { recursive: true });
for (const market of markets) {
  const file = `logs/T018-${market}-candles.json`;
  const d = cached ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : (await client.candlesRange(market, 240, 6001)).filter(b => b.t + 240 * 60000 <= Date.now()).slice(-6000);
  try { segments(d); }
  catch (error) {
    fs.writeFileSync(`logs/T018-${market}-rejected.json`, JSON.stringify(d));
    const gaps = d.flatMap((b, i) => i && b.t - d[i - 1].t !== 14400000
      ? [{ index: i, before: new Date(d[i - 1].t).toISOString(), after: new Date(b.t).toISOString(), hours: (b.t - d[i - 1].t) / 3600000 }] : []);
    console.error(JSON.stringify({ market, gaps, error: error.message }));
    throw error;
  }
  if (d.length !== 6000) throw new Error(`${market}: 6000개 마감봉 미확보`);
  if (!cached) fs.writeFileSync(file, JSON.stringify(d));
  data[market] = d;
  manifest.push({ market, count: d.length, from: d[0].t, to: d.at(-1).t,
    sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
  console.log(`${market} 마감봉 ${d.length}개 검증 완료`);
}
if (!markets.every(m => data[m][0].t === data['KRW-BTC'][0].t && data[m].at(-1).t === data['KRW-BTC'].at(-1).t)) throw new Error('종목 간 기간 불일치');
for (const market of markets) {
  if (JSON.stringify(segments(data[market]).map(s => [s.from, s.to])) !== JSON.stringify(segments(data['KRW-BTC']).map(s => [s.from, s.to]))) throw new Error('종목 간 공백 경계 불일치');
}
fs.writeFileSync('logs/T018-manifest.json', JSON.stringify(manifest, null, 2));
Object.assign(STRATEGIES, CANDIDATES);
try {
  for (const market of markets) for (const segment of segments(data[market])) {
    for (const cost of costs) for (const strategy of strategies) {
      const cfg = buildConfig({ MARKET: market, STRATEGY: strategy, SCALE_IN: 'false', FEE_RATE: String(cost.fee), SLIPPAGE: String(cost.slip) });
      const btc = data['KRW-BTC'].filter(b => b.t >= segment.d[0].t && b.t <= segment.to);
      const r = backtest(segment.d, cfg, { btc, signalFrom: segment.signalFrom });
      const deployed = Math.min(cfg.paperKrw, cfg.maxPositionKrw);
      const buy = segment.d[201].o * (1 + cfg.slip), sell = segment.d.at(-1).c * (1 - cfg.slip);
      const holdPnl = deployed / (buy * (1 + cfg.fee)) * sell * (1 - cfg.fee) - deployed;
      rows.push({ market, segment: segment.name, from: segment.from, to: segment.to,
        strategy, cost: cost.name, fee: cfg.fee, slip: cfg.slip, ...r.stats,
        averageTrade: r.trades.length ? r.trades.reduce((s,t) => s + t.pct, 0) / r.trades.length : null,
        exposure: r.trades.reduce((s,t) => s + t.exitIdx - t.entryIdx + 1, 0) / (segment.d.length - 200) * 100,
        holdMatchedRet: holdPnl / cfg.paperKrw * 100 });
    }
    console.log(`${market} ${segment.name} 비용2종·전략6개 완료`);
  }
  const decisions = Object.keys(CANDIDATES).map(id => assess(rows, id));
  fs.writeFileSync('logs/T018-results.json', JSON.stringify({ manifest, rows, decisions }, null, 2));
  const kst = t => new Date(t + 9 * 3600000).toISOString().slice(0,16).replace('T', ' ');
  const lines = ['# 공개 분석법 비교 연구 · 2026-10-26', '',
    'T-018에 후보3개와 평가기준을 성과 조회 전에 고정했습니다. 원전의 복제가 아닌 진입 가설이며 기존 앱의 청산/위험/국면 규칙과 결합합니다. 조건 재조정이나 사후 종목 제외는 하지 않았습니다.', '',
    '초기 1천만원, 최대 포지션 100만원, 현물 매수만, BTC 국면 필터 사용. 마감봉6000개 수집 중 2025-03-24/2026-03-30 KST에 각각4시간봉1개가 없는 공백을 확인했습니다. 성과 조회 전에60/20/20 설계를 중단하고 연속된3구간(초기/중기/최근)으로 변경했습니다. 가짜 시세를 보간하지 않았습니다. 각 구간은 최초200봉 준비 뒤 현금으로 시작, 마지막 봉에서 비용 포함 청산합니다. 공백 직전 청산은 연구 경계 평가이며 중단 예측 전략이 아닙니다. 최근 구간은 이전 연구에서 본 기간과 겹치므로 순수 미관찰 검증이 아닙니다. 후보/임계치/비용/평가기준은 변경하지 않았습니다.', '',
    '기본 비용: 편도 수수료0.04%+슬리피지0.05%. 스트레스: 수수료0.25%+슬리피지0.10%. 계정 실수수료를 확인한 값이 아닙니다. 평균값은 별도 계좌3개의 단순 평균이며 포트폴리오 성과가 아닙니다.', '',
    '매수보유 열은 같은100만원만 투입하고 나머지900만원은 현금인 계좌 수익률입니다. 시장노출은 보유 봉 비율 근사값입니다. 종목 생존편향(현재 주요3개), 봉 내부 경로/체결 단순화, 고정 비용, 과거 기간 재사용의 한계가 있습니다. 백테스트의 기존 daily/kill 제한은 분할매수 경로에 한정되므로 본 단일진입 연구는 해당 보호가 발동한 실운용의 손익을 보장하지 않습니다.', '',
    ...manifest.map(m => `- ${m.market}: ${kst(m.from)} ~ ${kst(m.to)} KST, SHA256 ${m.sha256}`), '',
    ...segments(data['KRW-BTC']).map(s => `- ${s.name} 평가: ${kst(s.from)} ~ ${kst(s.to)} KST, 준비 제외${s.d.length-200}봉`), '',
    '## 고정 기준 평가', '',
    ...decisions.map(d => `- ${d.id}: **${d.pass ? '제한 모의 검토 후보' : '미충족'}**. 후반 거래${d.trades}건. ${d.reasons.join(' / ') || '필요조건 통과. 미래 수익 보장이나 운영 승격 아님.'}`), '',
    '## 전체 비교', '', '| 종목 | 구간 | 비용 | 전략 | 거래 | 계좌수익률 | MDD | PF | 거래당 순수익률 | 보유봉 비율 | 동일금액 매수보유 |',
    '|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|'];
  for (const r of rows) lines.push(`| ${r.market} | ${r.segment} | ${r.cost} | ${r.strategy} | ${r.trades} | ${r.ret.toFixed(2)}% | ${r.mdd.toFixed(2)}% | ${r.pf === null ? '∞' : r.pf.toFixed(2)} | ${r.averageTrade === null ? '표본 없음' : r.averageTrade.toFixed(2)+'%'} | ${r.exposure.toFixed(1)}% | ${r.holdMatchedRet.toFixed(2)}% |`);
  lines.push('', '## 공개 원전과 차이', '',
    '- [NBER 암호화폐 모멘텀](https://www.nber.org/papers/w24877), [AQR 시계열 모멘텀](https://www.aqr.com/Insights/Research/Journal-Article/Time-Series-Momentum): 자체7일·21일 동시 양수 가설의 동기이며 원전 성과 재현 주장 아님.',
    '- [Turtle 규칙](https://www.turtletrader.com/rules/): 가격 돌파 원칙 참고. 55봉은 원전55일과 다르며 청산은 기존 앱 규칙.',
    '- [John Bollinger 규칙](https://www.bollingerbands.com/bollinger-band-rules): 수축·확장/밴드 밖 지속 관측. 하위20%·상대거래량1.2는 자체 고정 가설.',
    '- [백테스트 과적합 연구](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf): 여러 시도 중 최고 결과 선택의 위험. 본 연구는 정식 과적합확률 추정이나 통계적 유의성 입증이 아님.', '',
    '재현: node scripts/research-methods.mjs --cached. 최초 공개 시세 수집: --cached 생략. 실행 중 전략 등록은 해당 연구 프로세스에만 적용되며 운영 설정은 바뀌지 않습니다. 원본 및 수치: logs/T018-*.json.', '', '## 모의 실행 대조', '');
  fs.writeFileSync('docs/verify/2026-10-26_methods-research.md', lines.join('\n')+'\n');
  console.log(JSON.stringify(decisions, null, 2));
  for (const market of markets) for (const strategy of Object.keys(CANDIDATES)) {
    const segment = segments(data[market])[2];
    const cfg = buildConfig({ MARKET: market, STRATEGY: strategy, SCALE_IN: 'false', FEE_RATE: '.0004' });
    const btc = data['KRW-BTC'].filter(b => b.t >= segment.d[0].t && b.t <= segment.to);
    const v = await verify(segment.d, cfg, { btc });
    const file = `docs/verify/2026-10-26_methods-${market}-${strategy}.md`;
    fs.writeFileSync(file, verifyReport(v, segment.d, cfg));
    const row = { market, strategy, pass: v.pass, trades: v.replay.trades, entry: v.entryMatch, route: v.routeMatch, errors: v.replay.errors.length };
    replays.push(row); console.log(JSON.stringify(row));
    fs.appendFileSync('docs/verify/2026-10-26_methods-research.md', `- ${market} ${strategy}: ${v.pass ? '일치' : '불일치'}, 거래${row.trades}건, 진입${(row.entry*100).toFixed(0)}%/청산${(row.route*100).toFixed(0)}%, 오류${row.errors}.\n`);
    if (!v.pass) process.exitCode = 1;
  }
  fs.writeFileSync('logs/T018-replay.json', JSON.stringify(replays, null, 2));
} finally {
  for (const id of Object.keys(CANDIDATES)) delete STRATEGIES[id];
}
