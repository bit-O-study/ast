import { indicators } from '../indicators.js';
import { WARM, scoreAt } from '../strategy.js';

const LOOKBACK = 20, VOL_MULT = 1.5, MIN_ADX = 20;

// 직전 20봉 고가 돌파 + 거래량 1.5배 + ADX 20 초과면 진입. 점수는 화면 표시용으로 함께 계산
export default {
  id: 'breakout',
  name: '고가 돌파',
  minBars: WARM,
  prepare(d) {
    return { d, I: indicators(d) };
  },
  evaluate(ctx, i) {
    const { d, I } = ctx;
    const s = scoreAt(d, I, i);
    let hh = -Infinity;
    for (let j = Math.max(0, i - LOOKBACK); j < i; j++) hh = Math.max(hh, d[j].h);
    const broke = d[i].c > hh, volOk = d[i].v > VOL_MULT * I.vavg[i], adxOk = I.adx[i] > MIN_ADX;
    const miss = [!broke && `${LOOKBACK}봉 고가 미돌파`, !volOk && '거래량 부족', !adxOk && `ADX ${I.adx[i].toFixed(0)}`].filter(Boolean);
    return { ...s, enter: broke && volOk && adxOk, note: miss.length ? miss.join(' · ') : `${LOOKBACK}봉 고가 돌파 + 거래량` };
  },
};
