import { indicators } from '../indicators.js';
import { structureAt } from '../analysis/structure.js';

export default {
  id: 'structure', name: '구조·수급 확인', minBars: 80,
  prepare(d) { return { d, I: indicators(d) }; },
  evaluate(ctx, i) {
    if (i < this.minBars) return { enter: false, add: false, score: 0, parts: [], trend: false, adx: 0, rsi: 50, note: '구조 판단 봉 부족' };
    const analysis = structureAt(ctx.d, ctx.I, i);
    const parts = analysis.checks.map(c => ({ k: c.k, label: c.label, s: c.ok ? 1 : -1, on: true, pts: c.ok ? 20 : -20 }));
    const enter = analysis.ready && analysis.checks.every(c => c.ok);
    const missing = analysis.checks.filter(c => !c.ok).map(c => c.label);
    return { enter, add: enter && (analysis.breakout || analysis.wave.stage === '재상승 확인'),
      score: parts.reduce((s, p) => s + p.pts, 0), parts, trend: analysis.checks[0].ok,
      adx: Number.isFinite(ctx.I.adx[i]) ? ctx.I.adx[i] : 0, rsi: Number.isFinite(ctx.I.rsi[i]) ? ctx.I.rsi[i] : 50, analysis,
      note: !analysis.ready ? '유효 지표·거래량 부족' : enter ? '추세·수급·가격 구조 확인 (성공 확률 아님)' : `관망: ${missing.join(' · ')} 미충족` };
  },
};
