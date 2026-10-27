// 확정된 피벗만 사용한다. 오른쪽 봉은 확인 시점까지 기다리고 과거 신호에 소급하지 않는다.
export function confirmedPivots(d, i, radius = 2, lookback = 80) {
  const out = [];
  for (let j = Math.max(radius, i - lookback); j <= i - radius; j++) {
    let low = true, high = true;
    for (let k = j - radius; k <= j + radius; k++) {
      if (k === j) continue;
      low &&= d[j].l < d[k].l;
      high &&= d[j].h > d[k].h;
    }
    // 한 봉이 고점·저점이면 봉 안의 선후를 알 수 없어 제외한다.
    if (low === high) continue;
    const p = { kind: low ? 'low' : 'high', price: low ? d[j].l : d[j].h, at: d[j].t, confirmedAt: d[j + radius].t, idx: j };
    const prev = out.at(-1);
    if (prev?.kind === p.kind) {
      if (p.kind === 'low' ? p.price < prev.price : p.price > prev.price) out[out.length - 1] = p;
    } else out.push(p);
  }
  return out;
}

export function waveAt(d, i) {
  const pivots = confirmedPivots(d, i);
  let points = null;
  for (let k = pivots.length - 3; k >= 0; k--) {
    if (pivots[k].kind === 'low' && pivots[k + 1].kind === 'high' && pivots[k + 2].kind === 'low') {
      points = pivots.slice(k, k + 3); break;
    }
  }
  if (!points) return { stage: '구조 대기', valid: false, points: [], retracement: null, support: null, resistance: null };
  const [a, b, c] = points, span = b.price - a.price;
  const retracement = span > 0 ? (b.price - c.price) / span : null;
  const broken = c.price <= a.price || d.slice(c.idx + 1, i + 1).some(x => x.l <= c.price);
  const recent = i - c.idx <= 20;
  const valid = !broken && recent && retracement >= 0.236 && retracement <= 0.786;
  const stage = broken ? '구조 무효' : !recent ? '오래된 구조' : valid ? d[i].c > b.price ? '재상승 확인' : '눌림 확인' : '되돌림 관찰';
  return { stage, valid, points, retracement, support: c.price, resistance: b.price };
}

// 거래량 지표는 매집의 대용 관측치이며 실제 보유 주체·자금 유입을 증명하지 않는다.
export function structureAt(d, I, i) {
  const b = d[i], wave = waveAt(d, i), prev = d.slice(i - 20, i);
  const resistance = Math.max(...prev.map(x => x.h));
  const support = Math.min(...prev.map(x => x.l));
  const volumeBase = prev.reduce((s, x) => s + x.v, 0) / prev.length;
  const relativeVolume = volumeBase > 0 ? b.v / volumeBase : 0;
  const recent = d.slice(i - 19, i + 1);
  const volume = recent.reduce((s, x) => s + x.v, 0);
  const cmf = volume > 0 ? recent.reduce((s, x) => s + (x.h > x.l ? (2 * x.c - x.h - x.l) / (x.h - x.l) : 0) * x.v, 0) / volume : 0;
  const anchor = wave.points[0]?.idx ?? i - 19;
  const anchored = d.slice(anchor, i + 1), av = anchored.reduce((s, x) => s + x.v, 0);
  const avwap = av > 0 ? anchored.reduce((s, x) => s + ((x.h + x.l + x.c) / 3) * x.v, 0) / av : null;
  const breakout = b.c > resistance && relativeVolume >= 1.2;
  const spring = b.l < support && b.c > support && b.c > b.o && relativeVolume >= 1.2;
  const pullback = wave.valid && b.c > d[i - 1].h && b.c > b.o && b.c > avwap;
  const ready = [I.s20[i], I.s60[i], I.s20[i - 3], I.adx[i], I.pdi[i], I.ndi[i], I.rsi[i], I.hist[i], I.hist[i - 1], I.obvE[i], I.atr[i], avwap].every(Number.isFinite) && I.atr[i] > 0 && volumeBase > 0;
  const trend = ready && b.c > I.s60[i] && I.s20[i] > I.s20[i - 3] && I.adx[i] >= 20 && I.pdi[i] > I.ndi[i];
  const momentum = ready && I.rsi[i] >= 45 && I.rsi[i] <= 72 && I.hist[i] >= I.hist[i - 1];
  const flow = ready && cmf > 0 && I.obv[i] > I.obvE[i] && (relativeVolume >= 1.2 || cmf >= 0.1);
  const structure = ready && (breakout || pullback);
  const extension = ready && b.c - I.s20[i] <= 3 * I.atr[i];
  const checks = [
    { k: 'trend', label: '추세·방향', ok: trend, reason: '60이평 위·20이평 상승·ADX 20 이상·상승 DI 우세' },
    { k: 'momentum', label: '모멘텀', ok: momentum, reason: 'RSI 45~72·MACD 히스토그램 개선' },
    { k: 'flow', label: '거래량·수급', ok: flow, reason: 'CMF 양수·OBV 우세·거래량 또는 종가 매수 압력' },
    { k: 'structure', label: '가격 구조', ok: structure, reason: '거래량 동반 20봉 돌파 또는 높은 저점 뒤 반등' },
    { k: 'extension', label: '추격 제한', ok: extension, reason: '20이평과 거리 3 ATR 이내' },
  ];
  return { ready, checks, wave, relativeVolume, cmf, avwap, support, resistance, breakout, spring, pullback,
    accumulation: spring ? '지지선 이탈 후 회복 관측' : flow && pullback ? '눌림 뒤 수급 회복 후보' : flow ? '매수 압력 우세 후보' : '매집 근거 부족' };
}
