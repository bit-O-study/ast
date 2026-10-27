import { buildRegime } from '../regime.js';

// T-027 국면 보유 규칙 (2026-10-27 사전 등록, 값 변경 금지)
// BTC 종가 > BTC 20일 평균이면 보유, 아니면 현금. 하루 1회 KST 08시 마감 봉에서만 판정하고 다음 봉 시가에 체결.
export const REGIME_HOLD = Object.freeze({
  markets: Object.freeze(['KRW-BTC', 'KRW-ETH', 'KRW-XRP']),
  unit: 240,
  regimeDays: 20,
  decisionHourKst: 8,
  // 전진 관찰 시작: 2026-10-28 00:00 KST 시작 봉부터
  forwardFrom: Date.UTC(2026, 9, 27, 15),
});

const kstHour = (ms) => new Date(ms + 9 * 3600e3).getUTCHours();

// 봉마다 그 봉 마감 후의 목표 비중(0/1). 판정 봉이 아니면 직전 판정을 유지한다.
// BTC 판정은 실매매 국면 필터와 같은 buildRegime을 쓴다 (마감 시각 이하 봉만 사용).
export function regimeTargets(d, btc, rule = REGIME_HOLD) {
  const unitMs = rule.unit * 60e3;
  const regime = buildRegime(btc, { unit: rule.unit, regimeDays: rule.regimeDays });
  let last = 0;
  return d.map((b) => {
    const closeAt = b.t + unitMs;
    // decisionHourKst=null은 비교용: 매 봉 판정
    if (rule.decisionHourKst === null || kstHour(closeAt) === rule.decisionHourKst) last = regime.isBull(closeAt) ? 1 : 0;
    return last;
  });
}

// 목표 비중 0/1을 다음 봉 시가에 반영. cost = 편도 수수료+슬리피지. 시작은 현금 1.
export function simulateHold(d, targets, cost, start) {
  let cash = 1, qty = 0, switches = 0;
  const equity = [];
  for (let i = Math.max(1, start); i < d.length; i++) {
    const want = targets[i - 1], held = qty > 0 ? 1 : 0;
    if (want !== held) {
      switches++;
      if (want) { qty = (cash * (1 - cost)) / d[i].o; cash = 0; } else { cash = qty * d[i].o * (1 - cost); qty = 0; }
    }
    equity.push(cash + qty * d[i].c);
  }
  return { equity, switches, holding: qty > 0 };
}

export function equityStats(equity) {
  let peak = -Infinity, mdd = 0;
  for (const e of equity) { peak = Math.max(peak, e); mdd = Math.max(mdd, 1 - e / peak); }
  return { ret: equity.length ? (equity.at(-1) - 1) * 100 : 0, mdd: mdd * 100 };
}

// 종목별 시뮬을 1/3씩 합친 포트폴리오. fromAt(UTC ms) 이후 시작 봉부터 현금으로 출발한다.
export function portfolio(dataByMarket, btc, cost, fromAt, rule = REGIME_HOLD) {
  const per = rule.markets.map((m) => {
    const d = dataByMarket[m];
    const start = d.findIndex((b) => b.t >= fromAt);
    if (start < 1) throw new Error(`${m}: 시작 시각 전후 시세가 부족합니다`);
    const sim = simulateHold(d, regimeTargets(d, btc, rule), cost, start);
    const hold = d.slice(start).map((b) => b.c / d[start].o);
    return { market: m, start, ...sim, ...equityStats(sim.equity), holdRet: (hold.at(-1) - 1) * 100, holdMdd: equityStats(hold).mdd };
  });
  const n = Math.min(...per.map((p) => p.equity.length));
  const port = Array.from({ length: n }, (_, i) => per.reduce((a, p) => a + p.equity[i], 0) / per.length);
  const holdPort = Array.from({ length: n }, (_, i) => per.reduce((a, p) => {
    const d = dataByMarket[p.market];
    return a + d[p.start + i].c / d[p.start].o;
  }, 0) / per.length);
  return { per, bars: n, ...equityStats(port), hold: equityStats(holdPort) };
}

// 전진 관찰: 등록 시각 이후 마감 봉만으로 평가한다. client는 candlesRange(market, unit, count)를 가진 객체.
export const FORWARD_COSTS = Object.freeze({ 기본: 0.0009, 스트레스: 0.0035 });

export async function observeForward({ client, now = Date.now(), rule = REGIME_HOLD }) {
  const unitMs = rule.unit * 60e3;
  const warm = Math.round((rule.regimeDays * 1440) / rule.unit) + 10;
  const count = Math.max(0, Math.floor((now - rule.forwardFrom) / unitMs)) + warm + 2;
  const data = {};
  for (const m of rule.markets) data[m] = (await client.candlesRange(m, rule.unit, count)).filter((b) => b.t + unitMs <= now);
  const btc = data['KRW-BTC'];
  const closed = btc.filter((b) => b.t >= rule.forwardFrom).length;
  if (closed < 2) return { started: false, closed, now };
  const results = Object.fromEntries(Object.entries(FORWARD_COSTS).map(([k, cost]) => [k, portfolio(data, btc, cost, rule.forwardFrom, rule)]));
  const lastAt = btc.at(-1).t + unitMs;
  const bull = buildRegime(btc, { unit: rule.unit, regimeDays: rule.regimeDays }).state(lastAt);
  return { started: true, closed, now, from: rule.forwardFrom, to: lastAt, results, holding: results.기본.per.map((p) => ({ market: p.market, holding: p.holding })), btcNow: bull };
}
