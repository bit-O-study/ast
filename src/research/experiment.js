export function validateCandles(d, unit = 240) {
  if (!Array.isArray(d) || d.length < 1000) throw new Error('연구 시세 1000봉 이상 필요');
  for (let i = 0; i < d.length; i++) {
    const b = d[i];
    if (!['t', 'o', 'h', 'l', 'c', 'v'].every(k => Number.isFinite(b[k]))
      || Math.min(b.o, b.h, b.l, b.c) <= 0 || b.v < 0
      || b.h < Math.max(b.o, b.c, b.l) || b.l > Math.min(b.o, b.c, b.h)) throw new Error(`OHLCV 오류: ${i}`);
    if (i && b.t - d[i - 1].t !== unit * 60000) throw new Error(`시세 간격·중복 오류: ${i}`);
  }
}

export function segments(d) {
  const gaps = [];
  for (let i = 1; i < d.length; i++) {
    const delta = d[i].t - d[i - 1].t;
    if (delta <= 0 || delta % 14400000 !== 0) throw new Error('시세 정렬·간격 오류');
    if (delta > 14400000) gaps.push(i);
  }
  if (gaps.length !== 2) throw new Error('사전 기록한 공백2개와 다른 시세: 연구 중단');
  const cuts = [0, ...gaps, d.length];
  return ['초기', '중기', '최근'].map((name, k) => {
    const part = d.slice(cuts[k], cuts[k + 1]);
    validateCandles(part);
    return { name, d: part, signalFrom: 200, from: part[200].t, to: part.at(-1).t };
  });
}

// 세 종목의 별도 계좌 수익률 평균이다. 포트폴리오 백테스트가 아니다.
export function assess(rows, id) {
  const reasons = [], evidence = [];
  const avg = (a, key) => a.reduce((s, r) => s + r[key], 0) / a.length;
  let count = 0;
  for (const segment of ['중기', '최근']) {
    const select = (strategy, cost) => rows.filter(r => r.strategy === strategy && r.cost === cost && r.segment === segment);
    const candidate = select(id, '기본'), baseline = select('score', '기본'), stress = select(id, '스트레스');
    if ([candidate, baseline, stress].some(a => a.length !== 3 || new Set(a.map(r => r.market)).size !== 3)) {
      reasons.push(`${segment}: 종목 자료 부족`); continue;
    }
    count += candidate.reduce((s, r) => s + r.trades, 0);
    const result = { segment, return: avg(candidate, 'ret'), baseline: avg(baseline, 'ret'),
      mdd: avg(candidate, 'mdd'), baselineMdd: avg(baseline, 'mdd'), stress: avg(stress, 'ret') };
    evidence.push(result);
    if (!(result.return > result.baseline)) reasons.push(`${segment}: 기존 대비 평균 수익률 개선 부족`);
    if (candidate.filter(r => r.pnl > 0).length < 2) reasons.push(`${segment}: 수익 종목 2개 미만`);
    if (!(result.mdd <= result.baselineMdd * 1.2)) reasons.push(`${segment}: 평균 낙폭 한도 초과`);
    if (!(result.stress > 0)) reasons.push(`${segment}: 비용 스트레스 평균 수익률 비양수`);
  }
  if (count < 30) reasons.push(`후반 거래 ${count}건: 최소 30건 미달`);
  return { id, pass: reasons.length === 0, trades: count, evidence, reasons };
}
