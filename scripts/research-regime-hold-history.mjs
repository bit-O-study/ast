import fs from 'node:fs';
import { REGIME_HOLD, FORWARD_COSTS, portfolio } from '../src/research/regime-hold.js';

// T-027 표본 외 점검: 사전 등록 규칙을 T018 자료 시작 이전(미관찰) 구간에만 적용한다. 규칙 값은 바꾸지 않는다.
const H4 = 14400000;
const t018Start = JSON.parse(fs.readFileSync('logs/T018-KRW-BTC-candles.json', 'utf8'))[0].t;
const full = Object.fromEntries(REGIME_HOLD.markets.map((m) => [m, JSON.parse(fs.readFileSync(`logs/T027-${m}-history.json`, 'utf8'))]));
const kst = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
for (const [m, d] of Object.entries(full)) {
  const gaps = d.flatMap((b, i) => (i && b.t - d[i - 1].t !== H4 && b.t < t018Start ? [`${kst(d[i - 1].t)}(${(b.t - d[i - 1].t) / H4}봉)`] : []));
  console.log(`${m} 미관찰 구간 공백: ${gaps.join(', ') || '없음'}`);
}
console.log(`T018 자료 시작 ${kst(t018Start)} 이전만 사용\n`);
// 연 단위 구간. 각 구간 시작 전 봉은 평균 준비에만 쓰고 현금에서 출발한다.
const periods = [['2020-07~12', Date.UTC(2020, 6, 1), Date.UTC(2021, 0, 1)], ['2021', Date.UTC(2021, 0, 1), Date.UTC(2022, 0, 1)],
  ['2022', Date.UTC(2022, 0, 1), Date.UTC(2023, 0, 1)], ['2023', Date.UTC(2023, 0, 1), t018Start], ['전체', Date.UTC(2020, 6, 1), t018Start]];
console.log('| 구간 | 비용 | 국면 보유 | MDD | 3종목 보유 | 보유 MDD | 종목별 BTC/ETH/XRP | 전환 | ①수익≥보유 | ②MDD≤0.7×보유 |');
console.log('|---|---|---:|---:|---:|---:|---|---:|---|---|');
for (const [name, from, to] of periods) {
  const data = Object.fromEntries(Object.entries(full).map(([m, d]) => [m, d.filter((b) => b.t < to)]));
  for (const [k, cost] of Object.entries(FORWARD_COSTS)) {
    const p = portfolio(data, data['KRW-BTC'], cost, from);
    const f = (x) => x.toFixed(1);
    console.log(`| ${name} | ${k} | ${f(p.ret)}% | ${f(p.mdd)}% | ${f(p.hold.ret)}% | ${f(p.hold.mdd)}% | ${p.per.map((x) => f(x.ret)).join('/')} | ${p.per[0].switches} | ${p.ret >= p.hold.ret ? '충족' : '미충족'} | ${p.mdd <= p.hold.mdd * 0.7 ? '충족' : '미충족'} |`);
  }
}
