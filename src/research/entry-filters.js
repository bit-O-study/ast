import score from '../strategies/score.js';

// 이미 마감된 봉만 사용하며 세 가설은 서로 조합하지 않는다.
export function entryFilter(kind, ctx, i, cfg) {
  const { d } = ctx;
  if (i < 125) return false;
  if (kind === 'longTrend') {
    const mean = end => d.slice(end - 119, end + 1).reduce((s, b) => s + b.c, 0) / 120;
    const current = mean(i);
    return d[i].c > current && current > mean(i - 6);
  }
  if (kind === 'efficiency') {
    let travel = 0;
    for (let j = i - 19; j <= i; j++) travel += Math.abs(d[j].c - d[j - 1].c);
    const move = d[i].c - d[i - 20].c;
    return travel > 0 && move > 0 && move / travel >= 0.3;
  }
  if (kind === 'persistence') return [i - 2, i - 1, i].every(j => score.evaluate(ctx, j, cfg).enter);
  throw new Error('알 수 없는 연구 필터');
}

export const ENTRY_FILTERS = Object.fromEntries(['longTrend', 'efficiency', 'persistence'].map(kind => {
  const id = `research_${kind}`;
  return [id, {
    ...score, id, name: `연구 진입 필터: ${kind}`, minBars: 126,
    evaluate(ctx, i, cfg) {
      const signal = score.evaluate(ctx, i, cfg);
      return { ...signal, enter: signal.enter && entryFilter(kind, ctx, i, cfg), note: '진입 지속성 연구 · 수익성 미검증' };
    },
  }];
}));
