import { ENTRY_FILTERS, entryFilter } from './entry-filters.js';

const persistence = ENTRY_FILTERS.research_persistence;
export const PERSISTENT_STRATEGIES = {
  research_persistence: persistence,
  research_persistentEfficient: {
    ...persistence, id: 'research_persistentEfficient', name: '연구: 지속 신호·효율성',
    evaluate(ctx, i, cfg) {
      const signal = persistence.evaluate(ctx, i, cfg);
      return { ...signal, enter: signal.enter && entryFilter('efficiency', ctx, i, cfg) };
    },
  },
};

// 성과 조회 전에 고정한 조합. 공통 청산 함수를 그대로 호출한다.
export const PERSISTENT_PROFILES = [
  { id: 'score', strategy: 'score', env: {} },
  { id: 'persistence', strategy: 'research_persistence', env: {} },
  { id: 'patient', strategy: 'research_persistence', env: { MAX_HOLD_BARS: '120' } },
  { id: 'runner', strategy: 'research_persistence', env: { MAX_HOLD_BARS: '120', T1_SELL_RATIO: '.25', T2_R: '8' } },
  { id: 'cooldown', strategy: 'research_persistence', env: { LOSS_COOLDOWN_BARS: '6' } },
  { id: 'efficient', strategy: 'research_persistentEfficient', env: {} },
];
