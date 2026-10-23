import { sma } from './indicators.js';

// BTC 국면 필터: BTC 종가가 N일 이동평균 위면 상승 국면.
// 판단 시각 T(마감 시각, UTC ms)에 대해 T까지 마감된 BTC 봉만 사용한다 (미래 참조 없음).
export function buildRegime(btc, { unit, regimeDays, regimeFilter = 'btc' }) {
  if (regimeFilter === 'off') {
    return { enabled: false, isBull: () => true, state: () => null };
  }
  const unitMs = unit * 60e3;
  const len = Math.round((regimeDays * 1440) / unit);
  const ma = sma(btc.map((b) => b.c), len);

  // 마감 시각이 T 이하인 마지막 BTC 봉 인덱스 (이진 탐색)
  const lastClosed = (T) => {
    let lo = 0, hi = btc.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (btc[mid].t + unitMs <= T) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  };

  const state = (T) => {
    const j = lastClosed(T);
    if (j < 0 || !Number.isFinite(ma[j])) return { bull: false, close: null, ma: null, at: null, reason: 'BTC 데이터 부족' };
    return { bull: btc[j].c > ma[j], close: btc[j].c, ma: ma[j], at: btc[j].t, days: regimeDays };
  };

  return { enabled: true, len, isBull: (T) => state(T).bull, state };
}
