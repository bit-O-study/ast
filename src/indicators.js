// 기술 지표 계산. 입력 d: [{t,o,h,l,c,v}] (오래된 → 최신), 출력은 같은 길이의 배열 (계산 불가 구간은 NaN)
export const fin = Number.isFinite;

export function sma(a, n) {
  const o = Array(a.length).fill(NaN);
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i];
    if (i >= n) s -= a[i - n];
    if (i >= n - 1) o[i] = s / n;
  }
  return o;
}

// 앞부분 NaN을 건너뛰고 첫 n개 평균으로 시작하는 지수 평활 (wilder=true면 RMA)
function smooth(a, n, wilder) {
  const o = Array(a.length).fill(NaN);
  const k = wilder ? 1 / n : 2 / (n + 1);
  let p = NaN, s = 0, c = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (!fin(x)) continue;
    if (!fin(p)) {
      s += x; c++;
      if (c === n) { p = s / n; o[i] = p; }
    } else {
      p += (x - p) * k;
      o[i] = p;
    }
  }
  return o;
}
export const ema = (a, n) => smooth(a, n, false);
export const rma = (a, n) => smooth(a, n, true);

export function indicators(d) {
  const n = d.length;
  const c = d.map((b) => b.c), h = d.map((b) => b.h), l = d.map((b) => b.l), v = d.map((b) => b.v);

  const s20 = sma(c, 20), s60 = sma(c, 60);
  const sd = s20.map((m, i) => {
    if (!fin(m)) return NaN;
    let q = 0;
    for (let j = i - 19; j <= i; j++) q += (c[j] - m) ** 2;
    return Math.sqrt(q / 20);
  });
  const bbU = s20.map((m, i) => m + 2 * sd[i]);
  const bbL = s20.map((m, i) => m - 2 * sd[i]);
  const bw = s20.map((m, i) => (bbU[i] - bbL[i]) / m);

  const e12 = ema(c, 12), e26 = ema(c, 26);
  const macd = c.map((_, i) => e12[i] - e26[i]);
  const sig = ema(macd, 9);
  const hist = macd.map((m, i) => m - sig[i]);

  const gain = c.map((x, i) => (i ? Math.max(x - c[i - 1], 0) : NaN));
  const loss = c.map((x, i) => (i ? Math.max(c[i - 1] - x, 0) : NaN));
  const ag = rma(gain, 14), al = rma(loss, 14);
  const rsi = ag.map((g, i) => (al[i] === 0 ? 100 : 100 - 100 / (1 + g / al[i])));

  const tr = c.map((_, i) => (i ? Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])) : NaN));
  const atr = rma(tr, 14);

  const pdm = c.map((_, i) => { if (!i) return NaN; const up = h[i] - h[i - 1], dn = l[i - 1] - l[i]; return up > dn && up > 0 ? up : 0; });
  const ndm = c.map((_, i) => { if (!i) return NaN; const up = h[i] - h[i - 1], dn = l[i - 1] - l[i]; return dn > up && dn > 0 ? dn : 0; });
  const sp = rma(pdm, 14), sn = rma(ndm, 14);
  const pdi = sp.map((x, i) => (100 * x) / atr[i]);
  const ndi = sn.map((x, i) => (100 * x) / atr[i]);
  const dx = pdi.map((p, i) => { const s = p + ndi[i]; return fin(s) && s > 0 ? (100 * Math.abs(p - ndi[i])) / s : NaN; });
  const adx = rma(dx, 14);

  const obv = [0];
  for (let i = 1; i < n; i++) obv[i] = obv[i - 1] + (c[i] > c[i - 1] ? v[i] : c[i] < c[i - 1] ? -v[i] : 0);
  const obvE = ema(obv, 20), vavg = sma(v, 20);

  const tp = d.map((b) => (b.h + b.l + b.c) / 3);
  const mfi = Array(n).fill(NaN), vwap = Array(n).fill(NaN);
  for (let i = 14; i < n; i++) {
    let ps = 0, ng = 0;
    for (let j = i - 13; j <= i; j++) {
      const f = tp[j] * v[j];
      if (tp[j] > tp[j - 1]) ps += f;
      else if (tp[j] < tp[j - 1]) ng += f;
    }
    mfi[i] = ng === 0 ? 100 : 100 - 100 / (1 + ps / ng);
  }
  for (let i = 19; i < n; i++) {
    let pv = 0, vv = 0;
    for (let j = i - 19; j <= i; j++) { pv += tp[j] * v[j]; vv += v[j]; }
    vwap[i] = vv ? pv / vv : NaN;
  }

  return { s20, s60, bbU, bbL, bw, hist, rsi, atr, pdi, ndi, adx, obv, obvE, vavg, mfi, vwap };
}
