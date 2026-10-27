import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { BithumbClient } from '../src/bithumb/client.js';
import { runFixed, combinePnl } from '../src/research/fixed-portfolio.js';

// T-041 미관찰 구간(2017H2~2020H1) 확인 검증. 가설·기준은 docs/tasks/T-041-holdout-2017.md에 실행 전 고정했다.
// 시세가 저장돼 있으면 그대로 쓰고, 없으면 받아서 저장한다 (2020-07-01 KST 이전만).
const MARKETS = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'], UNIT = 14400000, CAPITAL = 10_000_000;
const kst = (y, m, d) => Date.UTC(y, m - 1, d) - 9 * 3600e3;
const END = kst(2020, 7, 1);
const data = {}, hashes = {};
for (const m of MARKETS) {
  const file = `logs/T041-${m}-candles.json`;
  if (!fs.existsSync(file)) {
    const d = (await new BithumbClient().candlesRange(m, 240, 24000)).filter((b) => b.t + UNIT <= END);
    fs.writeFileSync(file, JSON.stringify(d));
  }
  const raw = fs.readFileSync(file);
  hashes[m] = createHash('sha256').update(raw).digest('hex');
  data[m] = JSON.parse(raw.toString('utf8'));
}
const btc = data['KRW-BTC'];
const periods = [['2017H2', kst(2017, 7, 15), kst(2018, 1, 1)], ['2018', kst(2018, 1, 1), kst(2019, 1, 1)], ['2019', kst(2019, 1, 1), kst(2020, 1, 1)], ['2020H1', kst(2020, 1, 1), END]];
const COSTS = { 기본: ['.0004', '.0005'], 스트레스: ['.0025', '.001'] };
const SETS = {
  'A BTC 600만': [['KRW-BTC', '6000000', '0']],
  'B 3종목×200만': MARKETS.map((m) => [m, '2000000', '0']),
  'C 3종목 확대': MARKETS.map((m) => [m, '2000000', '3000000']),
};
function leg(m, [, from, to], max, boost, cost) {
  const all = data[m].filter((b) => b.t < to), s = all.findIndex((b) => b.t >= from), a = Math.max(0, s - 200);
  if (s - a < 200) throw new Error(`${m} 준비 봉 부족`);
  const [fee, slip] = COSTS[cost];
  return runFixed({ d: all.slice(a), btc: btc.filter((b) => b.t < to), signalFrom: s - a, market: m, capital: CAPITAL,
    env: { FEE_RATE: fee, SLIPPAGE: slip, MAX_POSITION_KRW: max, BOOST_POSITION_KRW: boost } });
}
const holdAvg = ([, from, to]) => MARKETS.reduce((acc, m) => {
  const d = data[m].filter((b) => b.t >= from && b.t < to);
  return acc + (d.at(-1).c / d[0].o - 1) * 100;
}, 0) / MARKETS.length;

const f = (x, n = 2) => x.toFixed(n), out = [`SHA256: ${MARKETS.map((m) => `${m} ${hashes[m].slice(0, 16)}`).join(' · ')}`];
const R = {};
for (const cost of Object.keys(COSTS)) {
  out.push(`\n## 비용 ${cost}\n`, `| 구간 | 3종목 보유 | ${Object.keys(SETS).map((k) => `${k} 수익 | MDD`).join(' | ')} |`, `|---|---:|${Object.keys(SETS).map(() => '---:|---:').join('|')}|`);
  R[cost] = Object.fromEntries(Object.keys(SETS).map((k) => [k, []]));
  for (const p of periods) {
    const cells = Object.entries(SETS).map(([k, legs]) => {
      const c = combinePnl(legs.map(([m, max, boost]) => leg(m, p, max, boost, cost)), CAPITAL);
      R[cost][k].push({ ...c, hold: holdAvg(p), name: p[0] });
      return `${f(c.ret)}% | ${f(c.mdd, 1)}%`;
    });
    out.push(`| ${p[0]} | ${f(holdAvg(p), 0)}% | ${cells.join(' | ')} |`);
  }
  out.push(`| **합계·최악MDD** | | ${Object.values(R[cost]).map((rs) => `**${f(rs.reduce((a, r) => a + r.ret, 0))}%** | **${f(Math.max(...rs.map((r) => r.mdd)), 1)}%**`).join(' | ')} |`);
}

// 사전 등록 가설 판정 (기본 비용)
const B = R.기본['B 3종목×200만'], A = R.기본['A BTC 600만'], C = R.기본['C 3종목 확대'];
const sum = (rs) => rs.reduce((a, r) => a + r.ret, 0), worst = (rs) => Math.max(...rs.map((r) => r.mdd));
const y18 = B.find((r) => r.name === '2018'), bull = B.filter((r) => r.hold > 0);
const verdicts = [
  ['H1 하락장 방어', y18.ret > -10 && y18.ret - y18.hold >= 40, `2018 B ${f(y18.ret)}% · 보유 ${f(y18.hold, 0)}% · 차이 ${f(y18.ret - y18.hold, 0)}%p`],
  ['H2 상승장 수익', bull.length > 0 && sum(bull) / bull.length > 0, `보유 양수 구간 ${bull.map((r) => r.name).join(',') || '없음'} · B 평균 ${bull.length ? f(sum(bull) / bull.length) : '—'}%`],
  ['H3 전체 양수', sum(B) > 0, `B 합계 ${f(sum(B))}% (스트레스 ${f(sum(R.스트레스['B 3종목×200만']))}%, 판정 외)`],
  ['H4 분산', sum(B) / worst(B) > sum(A) / worst(A), `B ${f(sum(B))}%/${f(worst(B), 1)}% = ${f(sum(B) / worst(B))} · A ${f(sum(A))}%/${f(worst(A), 1)}% = ${f(sum(A) / worst(A))}`],
  ['H5 상승장 확대(보조)', sum(C) >= sum(B) && worst(C) <= 15, `C ${f(sum(C))}%/${f(worst(C), 1)}% · B ${f(sum(B))}%`],
];
out.push('\n## 사전 등록 가설 판정 (기본 비용)\n', '| 가설 | 결과 | 근거 |', '|---|---|---|', ...verdicts.map(([h, ok, why]) => `| ${h} | **${ok ? '통과' : '실패'}** | ${why} |`));
const text = out.join('\n');
console.log(text);
fs.writeFileSync('logs/T041-holdout.log', text);
