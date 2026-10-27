// 1회 매수 금액 상한 (T-040). 백테스트와 Trader가 같은 함수를 쓴다.
// BTC 종가가 국면 평균 위에 국면 기간(REGIME_DAYS)만큼 연속으로 있었으면 BOOST_POSITION_KRW, 아니면 MAX_POSITION_KRW.
// BOOST_POSITION_KRW=0(기본)이면 항상 MAX_POSITION_KRW.
export function boostBars(cfg) {
  return Math.round((cfg.regimeDays * 1440) / cfg.unit);
}

export function positionCap(cfg, streak) {
  return cfg.boostPositionKrw > 0 && streak >= boostBars(cfg) ? cfg.boostPositionKrw : cfg.maxPositionKrw;
}
