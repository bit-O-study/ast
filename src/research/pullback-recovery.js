import score from '../strategies/score.js';

export function recovered(ctx, i, kind) {
  if (i < 1) return false;
  const { d, I } = ctx, prev = i - 1;
  if (kind === 'rsi') return I.rsi[prev] <= 30 && I.rsi[i] > 30;
  if (kind === 'band') return d[prev].c <= I.bbL[prev] && d[i].c > I.bbL[i];
  if (kind === 'average') return I.s20[i] > I.s60[i] && d[prev].c <= I.s20[prev] && d[i].c > I.s20[i];
  throw new Error('알 수 없는 회복 조건');
}
export const PULLBACK_RECOVERY = Object.fromEntries(['rsi', 'band', 'average'].map(kind => {
  const id = `research_recovery_${kind}`;
  return [id, { ...score, id, name: `눌림 회복 ${kind}`,
    evaluate(ctx, i, cfg) {
      const signal = score.evaluate(ctx, i, cfg), enter = recovered(ctx, i, kind);
      return { ...signal, enter, note: enter ? '마감봉 회복 확인·국면 및 공통 손절 계획 검사' : '회복 교차 대기' };
    },
  }];
}));
