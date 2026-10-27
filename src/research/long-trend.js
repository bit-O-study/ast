import { ENTRY_FILTERS } from './entry-filters.js';
import { sma } from '../indicators.js';

const persistence = ENTRY_FILTERS.research_persistence;
export function longTrendGate(kind, { d, month20, month30 }, i) {
  if (kind === 'slopeMonth') return Number.isFinite(month20[i - 30]) && Number.isFinite(month20[i]) && month20[i] > month20[i - 30];
  if (kind === 'aboveMonth') return Number.isFinite(month30[i]) && Number.isFinite(d[i]?.c) && d[i].c > month30[i];
  if (kind === 'alignedMonth') return Number.isFinite(month20[i]) && Number.isFinite(month30[i]) && month20[i] > month30[i];
  throw new Error('알 수 없는 장기 추세 조건');
}

export const LONG_TREND_STRATEGIES = Object.fromEntries(['slopeMonth', 'aboveMonth', 'alignedMonth'].map(kind => {
  const id = `research_${kind}`;
  return [id, { ...persistence, id, name: `연구 월간 추세: ${kind}`, minBars: kind === 'slopeMonth' ? 150 : 180,
    prepare(d) {
      const c = d.map(b => b.c);
      return { ...persistence.prepare(d), month20: sma(c, 120), month30: sma(c, 180) };
    },
    evaluate(ctx, i, cfg) {
      const signal = persistence.evaluate(ctx, i, cfg);
      return { ...signal, enter: signal.enter && longTrendGate(kind, ctx, i), note: '월간 추세 연구 · 수익성 미검증' };
    },
  }];
}));
