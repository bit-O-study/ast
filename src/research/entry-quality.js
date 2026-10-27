import { ENTRY_FILTERS } from './entry-filters.js';

const persistence = ENTRY_FILTERS.research_persistence;
export function qualityGate(kind, { d, I }, i) {
  if (i < 125) return false;
  const b = d[i];
  if (!b || ![b.o, b.h, b.l, b.c].every(Number.isFinite)) return false;
  if (kind === 'extension') {
    return [I.s20[i], I.atr[i], I.rsi[i]].every(Number.isFinite) && I.atr[i] > 0
      && b.c > I.s20[i] && b.c - I.s20[i] <= 2 * I.atr[i] && I.rsi[i] <= 70;
  }
  if (kind === 'closeStrength') return b.h > b.l && b.c >= b.o && (b.c - b.l) / (b.h - b.l) >= .75;
  if (kind === 'acceleration') {
    return [I.hist[i], I.hist[i - 1], I.adx[i], I.adx[i - 1]].every(Number.isFinite)
      && I.hist[i] > 0 && I.hist[i] > I.hist[i - 1] && I.adx[i] >= I.adx[i - 1];
  }
  throw new Error('알 수 없는 진입 품질 필터');
}

export const QUALITY_STRATEGIES = Object.fromEntries(['extension', 'closeStrength', 'acceleration'].map(kind => {
  const id = `research_${kind}`;
  return [id, { ...persistence, id, name: `연구 진입 품질: ${kind}`,
    evaluate(ctx, i, cfg) {
      const signal = persistence.evaluate(ctx, i, cfg);
      return { ...signal, enter: signal.enter && qualityGate(kind, ctx, i), note: '진입 품질 연구 · 수익성 미검증' };
    },
  }];
}));
