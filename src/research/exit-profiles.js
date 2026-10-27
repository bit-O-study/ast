// 결과 조회 전에 고정한 청산·재진입 가설. 위험 한도와 초기 손절은 유지한다.
export const EXIT_PROFILES = [
  { id: 'score', label: '기존', env: {} },
  { id: 'cooldown', label: '손실 후6봉 대기', env: { LOSS_COOLDOWN_BARS: '6' } },
  { id: 'patient', label: '보유 경계120봉', env: { MAX_HOLD_BARS: '120' } },
  { id: 'runner', label: '1차25%·2차8R·120봉', env: { MAX_HOLD_BARS: '120', T1_SELL_RATIO: '.25', T2_R: '8' } },
  { id: 'combined', label: '추세 보유+6봉 대기', env: { MAX_HOLD_BARS: '120', T1_SELL_RATIO: '.25', T2_R: '8', LOSS_COOLDOWN_BARS: '6' } },
];
