import { indicators } from '../indicators.js';
import { WARM, scoreAt } from '../strategy.js';

// 지표 8종 점수가 ENTRY_SCORE 이상이면 진입
export default {
  id: 'score',
  name: '지표 점수',
  minBars: WARM,
  prepare(d) {
    return { d, I: indicators(d) };
  },
  evaluate(ctx, i, cfg) {
    const s = scoreAt(ctx.d, ctx.I, i);
    return { ...s, enter: s.score >= cfg.entryScore, note: `점수 ${s.score.toFixed(0)} (기준 ${cfg.entryScore})` };
  },
};
