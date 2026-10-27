import score from '../strategies/score.js';
import { indicators } from '../indicators.js';
import { scoreAt } from '../strategy.js';

const BASE = 4 * 3600000, KST = 9 * 3600000;

// 완전한 KST 묶음만 집계하고 마지막 원본 봉 인덱스에 연결한다.
export function aggregateClosed(d, factor) {
  if (![2, 3].includes(factor)) throw new Error('집계 배수는2 또는3이어야 합니다');
  const duration = factor * BASE, bars = [], atClose = new Map();
  let members = [], start = null;
  const flush = () => {
    if (members.length !== factor || members.some((x, k) => x.b.t !== start + k * BASE)) return;
    const first = members[0].b, last = members.at(-1);
    atClose.set(last.i, bars.length);
    bars.push({ t: start, o: first.o, h: Math.max(...members.map(x => x.b.h)),
      l: Math.min(...members.map(x => x.b.l)), c: last.b.c, v: members.reduce((s, x) => s + x.b.v, 0) });
  };
  for (let i = 0; i < d.length; i++) {
    const b = d[i];
    if (!['t', 'o', 'h', 'l', 'c', 'v'].every(k => Number.isFinite(b[k]))
      || (b.t + KST) % BASE !== 0 || (i && b.t <= d[i - 1].t)
      || b.v < 0 || b.l <= 0 || b.h < Math.max(b.o, b.c, b.l) || b.l > Math.min(b.o, b.c, b.h)) throw new Error('집계 원본 시세 오류');
    const bucket = Math.floor((b.t + KST) / duration) * duration - KST;
    if (bucket !== start) { flush(); members = []; start = bucket; }
    members.push({ b, i });
  }
  flush();
  return { bars, atClose };
}

export function higherSignal(ctx, i, confirmation, threshold) {
  const h = ctx.higher.atClose.get(i);
  if (h === undefined || h < 62) return { enter: false, scores: [] };
  const d = ctx.higher.bars.slice(h - 62, h + 1);
  // 빠진 집계봉을 건너뛰어 연속 신호로 취급하지 않는다.
  if (d.some((b, j) => j && b.t - d[j - 1].t !== ctx.factor * BASE)) return { enter: false, scores: [] };
  const I = indicators(d);
  const scores = Array.from({ length: confirmation }, (_, j) => scoreAt(d, I, 62 - j).score);
  return { enter: scores.every(s => Number.isFinite(s) && s >= threshold), scores };
}

export const TIMEFRAME_STRATEGIES = Object.fromEntries([2, 3].flatMap(factor => [1, 3].map(confirmation => {
  const id = `research_h${factor * 4}_c${confirmation}`;
  return [id, { ...score, id, name: `연구:${factor * 4}시간${confirmation}봉 확인`, minBars: 63 * factor + factor - 1,
    prepare(d) { return { ...score.prepare(d), higher: aggregateClosed(d, factor), factor }; },
    evaluate(ctx, i, cfg) {
      const base = score.evaluate(ctx, i, cfg), signal = higherSignal(ctx, i, confirmation, cfg.entryScore);
      return { ...base, enter: signal.enter, note: `${factor * 4}시간 마감 신호 연구 · 수익성 미검증` };
    },
  }];
})));
