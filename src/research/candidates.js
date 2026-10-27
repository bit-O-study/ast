import { indicators } from '../indicators.js';
import { scoreAt } from '../strategy.js';

// 연구 프로세스에서만 등록한다. 조건 변경 없이 시간 구간별 성과를 비교한다.
export const CANDIDATES = Object.fromEntries(['momentum', 'channel', 'squeeze'].map(kind => {
  const id = `research_${kind}`;
  return [id, {
    id, name: { momentum: '연구: 7·21일 모멘텀', channel: '연구: 55봉 돌파', squeeze: '연구: 수축 후 확장' }[kind],
    minBars: 130,
    prepare(d) { return { d, I: indicators(d) }; },
    evaluate({ d, I }, i) {
      const empty = { enter: false, score: 0, parts: [], trend: false, adx: 0, rsi: 50, note: '연구 지표 준비 중' };
      if (i < 130) return empty;
      const s = scoreAt(d, I, i);
      if (!Number.isFinite(s.score) || !(I.atr[i] > 0)) return empty;
      const meanVolume = d.slice(i - 20, i).reduce((sum, b) => sum + b.v, 0) / 20;
      const relativeVolume = meanVolume > 0 ? d[i].v / meanVolume : NaN;
      let enter;
      if (kind === 'momentum') {
        enter = d[i].c > d[i - 42].c && d[i].c > d[i - 126].c
          && d[i].c > I.s60[i] && I.s60[i] > I.s60[i - 6];
      } else if (kind === 'channel') {
        enter = d[i].c > Math.max(...d.slice(i - 55, i).map(b => b.h)) && relativeVolume >= 1;
      } else {
        const widths = I.bw.slice(i - 60, i).filter(Number.isFinite).sort((a, b) => a - b);
        const threshold = widths[Math.ceil(widths.length * .2) - 1];
        enter = widths.length === 60 && I.bw[i - 1] <= threshold && d[i].c > I.bbU[i]
          && I.bw[i] > I.bw[i - 1] && relativeVolume >= 1.2;
      }
      return { ...s, enter: Boolean(enter), note: `${this.name} · ${enter ? '조건 충족' : '관망'} · 수익성 미검증` };
    },
  }];
}));
