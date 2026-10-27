import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildConfig } from '../src/config.js';
import { backtest, computeStats } from '../src/backtest.js';
import { segments, assess } from '../src/research/experiment.js';
import { cappedHold } from '../src/research/capped-hold.js';

const markets = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'], data = {}, hashes = {}, rows = [];
const manifest = JSON.parse(fs.readFileSync('logs/T018-manifest.json', 'utf8'));
for (const market of markets) {
  const raw = fs.readFileSync(`logs/T018-${market}-candles.json`);
  hashes[market] = createHash('sha256').update(raw).digest('hex');
  assert.equal(hashes[market], manifest.find(m => m.market === market).sha256);
  data[market] = segments(JSON.parse(raw.toString('utf8')));
}
for (let k = 0; k < 3; k++) for (const market of markets) {
  const { d, name: segment } = data[market][k], btc = data['KRW-BTC'][k].d;
  assert.deepEqual(d.map(b => b.t), btc.map(b => b.t));
  for (const cost of ['기본', '스트레스']) {
    const cfg = buildConfig({ MODE: 'paper', MARKET: market, STRATEGY: 'score', SCALE_IN: 'false',
      FEE_RATE: cost === '기본' ? '.0004' : '.0025', SLIPPAGE: cost === '기본' ? '.0005' : '.001' });
    const base = backtest(d, cfg, { btc, signalFrom: 200 });
    rows.push({ market, segment, cost, strategy: 'score', ...computeStats(base.trades, [cfg.paperKrw, ...base.equity], cfg.paperKrw) });
    for (const strategy of ['daily', 'fourHour', 'hold']) {
      const result = cappedHold(d, btc, cfg, { daily: strategy === 'daily', hold: strategy === 'hold' });
      assert.ok(result.fills.filter(f => f.side === 'buy').every(f => f.cost <= cfg.maxPositionKrw));
      rows.push({ market, segment, cost, strategy, ...result.stats });
    }
  }
}
assert.equal(rows.length, 72);
const decisions = ['daily', 'fourHour'].map(id => {
  const result = assess(rows, id);
  for (const r of rows.filter(r => r.strategy === id && r.cost === '기본' && r.segment !== '초기')) {
    const base = rows.find(b => b.strategy === 'score' && b.market === r.market && b.segment === r.segment && b.cost === r.cost);
    if (!(r.ret > 0 && r.ret > base.ret)) result.reasons.push(`${r.segment}/${r.market}: 양수·기존 초과 미충족`);
  }
  return { ...result, pass: !result.reasons.length };
});
fs.writeFileSync('logs/T028-results.json', JSON.stringify({ hashes, rows, decisions }, null, 2));
const report = ['# 국면 보유 동일 매수 한도 비교 · 2026-10-27', '',
  'T028 사전 고정 조건. 초기1천만원/매수총지출100만원 상한, 신호200봉부터·최초체결201봉. 기본 수수료0.04%+슬리피지0.05%, 스트레스0.25%+0.10%. 정확한 왕복 비용과 기간 종료 청산, 초기자산 포함MDD. 거래 중 평가는 score와 동일하게 매도 수수료만 차감한다.', '',
  '국면 후보는 손절가가 없어 같은 위험 전략은 아니다. 고정 과거자료 재사용 탐색이며 독립 검증/실시간 경로 검증/운영 적용이 아니다. 평균은 별도 계좌 평균이며 포트폴리오 수익이 아니다.', '',
  ...decisions.map(d => `- ${d.id}: ${d.pass ? '추가 검증 필요' : '탈락'}. ${d.reasons.join(' / ')}`), '',
  '| 종목 | 기간 | 비용 | 전략 | 거래 | 수익률% | MDD% |', '|---|---|---|---|---:|---:|---:|',
  ...rows.map(r => `| ${r.market} | ${r.segment} | ${r.cost} | ${r.strategy} | ${r.trades} | ${r.ret.toFixed(3)} | ${r.mdd.toFixed(3)} |`), '',
  '원본 해시와 전체 수치: logs/T028-results.json. 운영 변경 없음.', ''];
fs.writeFileSync('docs/verify/2026-10-27_regime-comparable.md', report.join('\n'));
console.log(JSON.stringify(decisions, null, 2));
