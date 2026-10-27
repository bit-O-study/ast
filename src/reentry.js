// 청산 직전에 알려져 있던 마감봉을 기준으로 대기한다. 틱 시각 차이에 영향받지 않는다.
export function reentryAllowed(lastLossSignalAt, signalAt, cfg) {
  const bars = cfg.lossCooldownBars ?? 0;
  if (!bars || !Number.isFinite(lastLossSignalAt)) return true;
  return Number.isFinite(signalAt) && signalAt >= lastLossSignalAt + bars * cfg.unit * 60000;
}
