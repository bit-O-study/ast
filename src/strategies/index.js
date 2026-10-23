import score from './score.js';
import breakout from './breakout.js';

// 전략 목록. 새 전략은 CONTRACTS.md C4 형식으로 만들어 여기에 등록한다.
export const STRATEGIES = { [score.id]: score, [breakout.id]: breakout };

export function getStrategy(id) {
  const s = STRATEGIES[id];
  if (!s) throw new Error(`STRATEGY=${id} 는 없는 전략입니다. 사용 가능: ${Object.keys(STRATEGIES).join(', ')}`);
  return s;
}
