import fs from 'node:fs';
import { buildConfig } from '../src/config.js';
import { backtest } from '../src/backtest.js';
import { getStrategy } from '../src/strategies/index.js';
const rows = [], audits = [], ranges = [];
for (const market of ['KRW-BTC', 'KRW-ETH', 'KRW-XRP']) {
  const { d, btc } = JSON.parse(fs.readFileSync(`logs/T015-${market}-candles.json`, 'utf8'));
  ranges.push({ market, bars: d.length, from: d[0].t, to: d.at(-1).t });
  for (const fee of [0.0004, 0.0025]) for (const strategy of ['score', 'defensive']) {
    const cfg = buildConfig({ MARKET: market, STRATEGY: strategy, FEE_RATE: String(fee) });
    for (const segment of ['전체', '후반30%']) {
      const r = backtest(d, cfg, { btc, signalFrom: segment === '전체' ? 200 : Math.floor(d.length * .7) });
      const reasons = {};
      for (const t of r.trades.filter(t => t.pnl <= 0)) reasons[t.reason] = (reasons[t.reason] || 0) + 1;
      const averagePct = r.trades.reduce((s,t) => s + t.pct, 0) / (r.trades.length || 1);
      rows.push({ market, fee, strategy, segment, ...r.stats, averagePct, reasons });
      if (segment === '전체') {
        const skipped = {};
        for (const x of r.skipped) { const reason = x.reason.replace(/\d+(\.\d+)?/g, '#'); skipped[reason] = (skipped[reason] || 0) + 1; }
        audits.push({ market, fee, strategy, skipped, lossReasons: reasons });
      }
    }
  }
  const cfg = buildConfig({ STRATEGY: 'defensive' }), s = getStrategy('defensive'), ctx = s.prepare(d), gates = {};
  for (let i = 200; i < d.length; i++) for (const c of s.evaluate(ctx, i, cfg).analysis.checks) if (!c.ok) gates[c.label] = (gates[c.label] || 0) + 1;
  audits.push({ market, gates });
}
fs.writeFileSync('logs/T016-research.json', JSON.stringify({ ranges, rows, audits }, null, 2));
const lines = ['# 방어형 진입 비교 · 2026-10-26', '',
  '조건을 결과 조회 전에 고정했지만 이 시세 구간은 T-015에서 이미 관찰했습니다. 독립 검증이 아니며 임계치 최적화는 하지 않았습니다. 4시간 마감봉, 준비 200봉, 초기 1천만 원, 포지션 한도 100만 원, 편도 슬리피지 0.05%. 두 전략은 같은 투자 규모/위험/청산 규칙. 후반30%는 현금으로 새로 시작하며 이전 자료는 지표 준비에만 사용합니다.', '',
  '수수료0.04%는 계정 미확인 가정, 0.25%는 비용 스트레스입니다. 낮은 거래 수/낙폭만으로 판단 개선을 주장하지 않습니다. 총손익뿐 아니라 거래당 순수익률도 봅니다. 체결·시장 충격·호가 스프레드는 단순 슬리피지 모형의 한계입니다.', '',
  ...ranges.map(r => `- ${r.market}: ${r.bars}봉, UTC ${new Date(r.from).toISOString()} ~ ${new Date(r.to).toISOString()}`), '',
  '| 종목 | 수수료 | 전략 | 구간 | 거래 | 손실률 | 순손익(원) | 거래당 순수익률 | MDD |', '|---|---|---|---|---:|---:|---:|---:|---:|---:|'];
for (const r of rows) lines.push(`| ${r.market} | ${(r.fee*100).toFixed(2)}% | ${r.strategy} | ${r.segment} | ${r.trades} | ${r.trades ? (100-r.winRate).toFixed(1)+'%' : '표본 없음'} | ${Math.round(r.pnl)} | ${r.averagePct.toFixed(2)}% | ${r.mdd.toFixed(2)}% |`);
lines.push('', '## 거절·손실 원인', '', '조건 미충족 봉은 동시에 여러 항목에 집계될 수 있습니다. 주문 계획 거절은 포지션이 없는 신호만 집계합니다.', '', '```json', JSON.stringify(audits, null, 2), '```', '', '재현: node scripts/research-defensive.mjs (T015 공개 시세 캐시 필요). 원본 수치: logs/T016-research.json.');
fs.writeFileSync('docs/verify/2026-10-26_defensive-research.md', lines.join('\n')+'\n');
console.log(JSON.stringify(rows.filter(r=>r.fee===.0004),null,2));
