import score from './score.js';
import { scoreAt } from '../strategy.js';

const fmt = n => Number.isFinite(n) ? n.toFixed(2) : '자료 부족';

// 서로 다른 필수 조건을 점수 합계로 상쇄하지 않는다.
export default {
  id: 'defensive', name: '방어형 추세 확인', minBars: 63,
  prepare: score.prepare,
  evaluate({ d, I }, i, cfg) {
    const empty = { enter: false, score: 0, parts: [], trend: false, adx: 0, rsi: 50, note: '방어형 판단 자료 부족' };
    if (i < this.minBars) return empty;
    const s = scoreAt(d, I, i), previous = scoreAt(d, I, i - 1);
    const ready = [s.score, previous.score, d[i].c, I.s20[i], I.s60[i], I.s20[i - 3], I.atr[i], I.adx[i], I.pdi[i], I.ndi[i], I.rsi[i]].every(Number.isFinite)
      && I.atr[i] > 0 && d[i].v > 0 && d[i - 1].v > 0;
    const distance = (d[i].c - I.s20[i]) / I.atr[i];
    const checks = [
      { k: 'confirmation', label: '2봉 연속 확인', ok: ready && s.score >= cfg.entryScore && previous.score >= cfg.entryScore,
        reason: `현재 ${fmt(s.score)} / 이전 ${fmt(previous.score)}, 모두 ${cfg.entryScore} 이상` },
      { k: 'trend', label: '상승 추세', ok: ready && d[i].c > I.s20[i] && I.s20[i] > I.s60[i] && I.s20[i] > I.s20[i - 3],
        reason: `종가 ${fmt(d[i].c)} > 20이평 ${fmt(I.s20[i])} > 60이평 ${fmt(I.s60[i])}, 20이평 3봉 전 ${fmt(I.s20[i - 3])}보다 상승` },
      { k: 'direction', label: '추세 강도·방향', ok: ready && I.adx[i] >= 25 && I.pdi[i] > I.ndi[i],
        reason: `ADX ${fmt(I.adx[i])} ≥ 25, +DI ${fmt(I.pdi[i])} > -DI ${fmt(I.ndi[i])}` },
      { k: 'extension', label: '과열·추격 제한', ok: ready && I.rsi[i] >= 50 && I.rsi[i] <= 70 && distance <= 2,
        reason: `RSI ${fmt(I.rsi[i])} (50~70), 20이평 거리 ${fmt(distance)} ATR (2 이하)` },
    ];
    const enter = ready && checks.every(c => c.ok);
    return { ...(ready ? s : empty), enter, analysis: { kind: 'defensive', checks },
      note: enter ? '필수 조건 충족 · 주문 직전 비용·갭·저항 재검사' : `관망: ${checks.filter(c => !c.ok).map(c => c.label).join(' · ')}` };
  },
};
