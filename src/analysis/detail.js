const ratio = (a, b) => Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : NaN;
const sign = (v, up, down) => v > 0 ? up : v < 0 ? down : '보합';
const row = (key, label, value, unit, state, meaning) => ({ key, label,
  value: Number.isFinite(value) ? value : null, unit,
  state: Number.isFinite(value) ? state : '자료 부족', meaning });

// 참고 관측값이다. 이 항목 수를 매수 점수나 성공 확률로 합산하지 않는다.
export function indicatorDetail(d, I, i) {
  const b = d[i] ?? {};
  const val = (key, offset = 0) => I[key]?.[i - offset] ?? NaN;
  const maGap = (ratio(val('s20'), val('s60')) - 1) * 100;
  const slope = (ratio(val('s20'), val('s20', 3)) - 1) * 100;
  const priceGap = (ratio(b.c, val('s20')) - 1) * 100;
  const di = val('pdi') - val('ndi'), adxChange = val('adx') - val('adx', 3);
  const hist = val('hist'), histChange = hist - val('hist', 1), rsi = val('rsi');
  const previousVolume = i >= 20 ? d.slice(i - 20, i).reduce((s, x) => s + x.v, 0) / 20 : NaN;
  const relativeVolume = ratio(b.v, previousVolume);
  const obvGap = val('obv') - val('obvE');
  let cmf = NaN;
  if (i >= 19) {
    const bars = d.slice(i - 19, i + 1);
    const volume = bars.reduce((s, x) => s + x.v, 0);
    const flow = bars.reduce((s, x) => s + (x.h === x.l ? 0 : (2 * x.c - x.h - x.l) / (x.h - x.l)) * x.v, 0);
    cmf = ratio(flow, volume);
  }
  const atrPct = ratio(val('atr'), b.c) * 100, bandwidth = val('bw') * 100;
  const rangeAtr = ratio(b.h - b.l, val('atr'));
  const bandPosition = ratio(b.c - val('bbL'), val('bbU') - val('bbL')) * 100;
  const vwapGap = (ratio(b.c, val('vwap')) - 1) * 100;
  const priorHigh = i >= 20 ? Math.max(...d.slice(i - 20, i).map(x => x.h)) : NaN;
  const breakoutGap = (ratio(b.c, priorHigh) - 1) * 100;
  return { at: Number.isFinite(b.t) ? b.t : null, groups: [
    { key: 'trend', label: '추세', items: [
      row('maGap', '20·60이평 간격', maGap, '%', sign(maGap, '정배열', '역배열'), '양수는 20이평이 60이평보다 높음'),
      row('maSlope', '20이평 3봉 기울기', slope, '%', sign(slope, '상승', '하락'), '현재 20이평과 3봉 전 20이평 비교'),
      row('priceGap', '종가·20이평 거리', priceGap, '%', sign(priceGap, '이평 위', '이평 아래'), '거리가 클수록 추격 진입 여부 확인'),
    ] },
    { key: 'strength', label: '추세 강도·방향', items: [
      row('adx', 'ADX(14)', val('adx'), '', val('adx') >= 25 ? '추세 강함' : '추세 약함', '25 기준 강도 관측이며 상승 방향을 뜻하지 않음'),
      row('adxChange', 'ADX 3봉 변화', adxChange, 'p', sign(adxChange, '강도 증가', '강도 감소'), '하락 추세에서도 ADX는 증가할 수 있음'),
      row('diGap', '+DI − -DI', di, 'p', sign(di, '상승 방향 우세', '하락 방향 우세'), '양수는 +DI 우세, 음수는 -DI 우세'),
    ] },
    { key: 'momentum', label: '모멘텀', items: [
      row('rsi', 'RSI(14)', rsi, '', rsi > 70 ? '과열 구간' : rsi < 30 ? '과매도 구간' : rsi >= 50 ? '중심선 위' : '중심선 아래', '30·50·70 구간 관측. 과매도 자체는 매수 신호가 아님'),
      row('hist', 'MACD 히스토그램', hist, '원', sign(hist, '신호선 위', '신호선 아래'), 'MACD(12,26)와 신호선(9)의 차이'),
      row('histChange', '히스토그램 1봉 변화', histChange, '원', sign(histChange, '상승 가속', '하락 가속'), '양수여도 히스토그램 자체가 음수일 수 있음'),
    ] },
    { key: 'flow', label: '거래량·수급', items: [
      row('relativeVolume', '직전 20봉 대비 거래량', relativeVolume, '배', relativeVolume >= 1 ? '평균 이상' : '평균 미만', `현재 봉을 제외한 평균 대비. 현재 봉은 ${b.c > b.o ? '양봉' : b.c < b.o ? '음봉' : '보합'}`),
      row('obvGap', 'OBV·20EMA 차이', obvGap, '', sign(obvGap, '누적 거래량 우위', '누적 거래량 약세'), '상승·하락 종가에 따른 누적 거래량. 실제 순매수액 아님'),
      row('cmf', 'CMF(20)', cmf, '', sign(cmf, '종가 상단 수급', '종가 하단 수급'), '봉 내부 종가 위치와 거래량의 결합. 특정 주체 매집 확정 아님'),
    ] },
    { key: 'volatility', label: '변동성', items: [
      row('atrPct', 'ATR(14) / 종가', atrPct, '%', '변동폭 관측', '가격 대비 평균 진폭. 높을수록 손절 간격·투자금 확인'),
      row('bandwidth', '볼린저 밴드폭(20,2)', bandwidth, '%', sign(val('bw') - val('bw', 1), '확장', '수축'), '(상단−하단)/20이평. 확장은 상승·하락 모두 가능'),
      row('rangeAtr', '현재 봉 진폭 / ATR', rangeAtr, '배', rangeAtr > 1 ? '평균 진폭 초과' : '평균 진폭 이내', '고가−저가 기준. 시가 갭은 포함하지 않음'),
    ] },
    { key: 'location', label: '가격 위치', items: [
      row('bandPosition', '볼린저 밴드 위치', bandPosition, '%', bandPosition > 100 ? '상단 밖' : bandPosition < 0 ? '하단 밖' : '밴드 안', '하단 0%, 상단 100%. 접촉만으로 반전 단정 금지'),
      row('vwapGap', '20봉 VWAP 거리', vwapGap, '%', sign(vwapGap, '거래량 평균가 위', '거래량 평균가 아래'), '최근 20봉 기준이며 일중 세션 VWAP과 다름'),
      row('breakoutGap', '직전 20봉 고가 대비', breakoutGap, '%', sign(breakoutGap, '종가 돌파', '고가 아래'), '현재 봉을 제외한 20봉 최고가와 종가 비교'),
    ] },
  ] };
}
