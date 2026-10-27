import { runFixed, combinePnl } from './fixed-portfolio.js';

// T-040 상승장 투입 확대 전진 판정 (2026-10-27 사전 등록, 값 변경 금지)
export const BULL_BOOST = Object.freeze({
  markets: Object.freeze(['KRW-BTC', 'KRW-ETH', 'KRW-XRP']),
  unit: 240,
  base: 2_000_000,
  boost: 3_000_000,
  env: Object.freeze({ FEE_RATE: '.0004', SLIPPAGE: '.0005' }),
  forwardFrom: Date.UTC(2026, 9, 27, 15), // 2026-10-28 00:00 KST 시작 봉부터
  decideAt: Date.UTC(2027, 3, 25, 15), // 2027-04-26 00:00 KST (180일)
  warmBars: 400, // 지표·연속 국면 계산 준비 봉 (평가 전용)
});

// 판정 기준: ① 확대 수익 ≥ 기본 ② 확대 MDD ≤ 기본 × 1.5 ③ 확대 MDD ≤ 15%. 확대가 한 번도 없으면 판정 불가
export function judge(base, boost) {
  if (!boost.boosted) return { verdict: '판정 불가', reasons: ['확대 조건이 아직 한 번도 켜지지 않음'] };
  const reasons = [];
  if (!(boost.ret >= base.ret)) reasons.push('확대 수익이 기본보다 낮음');
  if (!(boost.mdd <= Math.max(base.mdd * 1.5, 0))) reasons.push('확대 MDD가 기본의 1.5배 초과');
  if (!(boost.mdd <= 15)) reasons.push('확대 MDD 15% 초과');
  return { verdict: reasons.length ? '미충족' : '충족', reasons };
}

// dataByMarket: 종목별 마감 4시간봉(평가 시작 전 준비 봉 포함). fromAt 이후 봉만 평가한다
export function evaluateBoost(dataByMarket, fromAt, rule = BULL_BOOST) {
  const btc = dataByMarket['KRW-BTC'];
  const result = Object.fromEntries([['base', 0], ['boost', rule.boost]].map(([name, boost]) => {
    const parts = rule.markets.map((m) => {
      const d = dataByMarket[m], s = d.findIndex((b) => b.t >= fromAt);
      if (s < 60) throw new Error(`${m}: 평가 시작 전 준비 봉이 부족합니다`);
      const r = runFixed({ d, btc, signalFrom: s, market: m, env: { ...rule.env, MAX_POSITION_KRW: String(rule.base), BOOST_POSITION_KRW: String(boost) } });
      return { ...r, boosted: r.trades.filter((t) => t.cost > rule.base + 1).length };
    });
    return [name, { ...combinePnl(parts), boosted: parts.reduce((a, x) => a + x.boosted, 0) }];
  }));
  return { ...result, ...judge(result.base, result.boost) };
}

// 공개 시세로 전진 구간 평가. client.candlesRange(market, unit, count)
export async function observeBoost({ client, now = Date.now(), rule = BULL_BOOST }) {
  const unitMs = rule.unit * 60e3;
  const count = Math.max(0, Math.floor((now - rule.forwardFrom) / unitMs)) + rule.warmBars;
  const data = {};
  for (const m of rule.markets) data[m] = (await client.candlesRange(m, rule.unit, count)).filter((b) => b.t + unitMs <= now);
  const closed = data['KRW-BTC'].filter((b) => b.t >= rule.forwardFrom).length;
  if (closed < 2) return { started: false, closed };
  return { started: true, closed, to: data['KRW-BTC'].at(-1).t + unitMs, final: now >= rule.decideAt, ...evaluateBoost(data, rule.forwardFrom, rule) };
}
