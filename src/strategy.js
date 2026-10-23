// 판단 점수와 진입 계획(손절가·목표가). 모두 봉 마감 데이터만 사용한다.
export const WARM = 60; // 60이평이 잡히는 최소 봉 수

export const FACTORS = [
  { k: 'ma', label: '이평선 배열', w: 15 },
  { k: 'macd', label: 'MACD', w: 15 },
  { k: 'rsi', label: 'RSI', w: 12 },
  { k: 'bb', label: '볼린저밴드', w: 10 },
  { k: 'adx', label: 'ADX/DMI', w: 12 },
  { k: 'vol', label: '거래량·OBV', w: 12 },
  { k: 'mfi', label: 'MFI', w: 6 },
  { k: 'vwap', label: 'VWAP', w: 6 },
];
export const ALL_FACTORS = new Set(FACTORS.map((f) => f.k));

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// i번째 봉(마감된 봉) 기준 판단 점수 -100 ~ +100
export function scoreAt(d, I, i, enabled = ALL_FACTORS) {
  const b = d[i], c = b.c, trend = I.adx[i] >= 25;
  const s = {};
  s.ma = c > I.s20[i] && I.s20[i] > I.s60[i] ? 1 : c < I.s20[i] && I.s20[i] < I.s60[i] ? -1 : c > I.s20[i] ? 0.3 : -0.3;
  s.macd = (I.hist[i] > 0 ? 0.6 : -0.6) + (I.hist[i] > I.hist[i - 1] ? 0.4 : -0.4);
  const r = I.rsi[i];
  s.rsi = trend
    ? (r > 72 ? -0.3 : r >= 50 ? 0.8 : r >= 30 ? -0.6 : -0.2)
    : (r < 30 ? 1 : r < 40 ? 0.5 : r > 70 ? -1 : r > 60 ? -0.5 : 0);
  const pb = (c - I.bbL[i]) / (I.bbU[i] - I.bbL[i]), widen = I.bw[i] > I.bw[i - 1];
  s.bb = trend
    ? (pb > 1 && widen ? 0.7 : pb < 0 && widen ? -0.7 : (pb - 0.5) * 0.6)
    : (pb < 0.05 ? 1 : pb < 0.2 ? 0.5 : pb > 0.95 ? -1 : pb > 0.8 ? -0.5 : 0);
  s.adx = (I.pdi[i] > I.ndi[i] ? 1 : -1) * clamp((I.adx[i] - 15) / 20, 0, 1);
  s.vol = clamp((I.obv[i] > I.obvE[i] ? 0.5 : -0.5) + (b.v > 1.8 * I.vavg[i] ? (c > b.o ? 0.5 : -0.5) : 0), -1, 1);
  const m = I.mfi[i];
  s.mfi = m < 20 ? 1 : m > 80 ? -1 : (m - 50) / 60;
  s.vwap = c > I.vwap[i] ? 0.6 : -0.6;

  let sw = 0, ss = 0;
  for (const f of FACTORS) if (enabled.has(f.k)) { sw += f.w; ss += f.w * s[f.k]; }
  const parts = FACTORS.map((f) => ({
    k: f.k, label: f.label, s: s[f.k], on: enabled.has(f.k),
    pts: sw && enabled.has(f.k) ? (100 * f.w * s[f.k]) / sw : 0,
  }));
  return { score: sw ? (100 * ss) / sw : 0, parts, trend, adx: I.adx[i], rsi: I.rsi[i] };
}

// 진입 시 손절가와 목표가(매도가)를 정한다. i = 신호가 난 마감 봉, price = 예상 체결가
export function planEntry(d, I, i, price, cfg) {
  const atr = I.atr[i];
  let swingLow = Infinity, res = -Infinity;
  for (let j = Math.max(0, i - 9); j <= i; j++) swingLow = Math.min(swingLow, d[j].l);
  for (let j = Math.max(0, i - 59); j <= i; j++) res = Math.max(res, d[j].h);

  // 손절가: ATR 기준과 최근 10봉 저점 아래 중 가까운 쪽. 단 1 ATR보다 가깝게 두지 않는다 (잡음에 털리지 않게)
  let stop = Math.max(price - cfg.stopAtr * atr, swingLow - 0.3 * atr);
  stop = Math.min(stop, price - 1.0 * atr);
  const R = price - stop;

  let t1 = price + cfg.t1R * R;
  const t2 = price + cfg.t2R * R;
  let note = '';
  // 60봉 고점(저항선)이 진입가보다 0.5 ATR 이상 위에 있으면 1차 목표를 그 아래로 당긴다
  if (res > price + 0.5 * atr) {
    const capped = res - 0.2 * atr;
    const rr = (capped - price) / R;
    if (rr < cfg.minRR) {
      return { ok: false, reason: `저항선까지 손익비 ${rr.toFixed(2)} (기준 ${cfg.minRR})`, stop, t1, t2, R, res, atr };
    }
    if (capped < t1) { t1 = capped; note = '1차 목표가를 저항선 아래로 조정'; }
  }
  return { ok: true, stop, t1, t2, R, res, atr, note };
}
