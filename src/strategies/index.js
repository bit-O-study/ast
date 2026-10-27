import score from './score.js';
import breakout from './breakout.js';
import structure from './structure.js';
import defensive from './defensive.js';
import { indicatorDetail } from '../analysis/detail.js';

// 전략 목록. 새 전략은 CONTRACTS.md C4 형식으로 만들어 여기에 등록한다.
export const STRATEGIES = Object.fromEntries([score, breakout, structure, defensive].map(strategy => [strategy.id, {
  ...strategy,
  evaluate(ctx, i, cfg) {
    const result = strategy.evaluate(ctx, i, cfg);
    return { ...result, analysis: { ...(result.analysis ?? { kind: 'indicators' }), details: indicatorDetail(ctx.d, ctx.I, i) } };
  },
}]));

export function getStrategy(id) {
  const s = STRATEGIES[id];
  if (!s) throw new Error(`STRATEGY=${id} 는 없는 전략입니다. 사용 가능: ${Object.keys(STRATEGIES).join(', ')}`);
  return s;
}
