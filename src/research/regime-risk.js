import score from '../strategies/score.js';

// BTC 국면과 손절·목표가는 기존 공통 실행 경로가 처리한다.
function make(id, daily) {
  return {
    ...score, id, name: daily ? '국면·일일 진입' : '국면·매봉 진입',
    evaluate(ctx, i, cfg) {
      const signal = score.evaluate(ctx, i, cfg);
      const closeAt = ctx.d[i].t + cfg.unit * 60000;
      const eligible = !daily || new Date(closeAt + 9 * 3600e3).getUTCHours() === 8;
      return { ...signal, enter: eligible && Number.isFinite(ctx.I.atr[i]) && ctx.I.atr[i] > 0,
        note: eligible ? '국면 통과 시 공통 손절 계획으로 진입' : '일일 판정시각 대기' };
    },
  };
}
export const REGIME_RISK = {
  research_regimeEvery: make('research_regimeEvery', false),
  research_regimeDaily: make('research_regimeDaily', true),
};
