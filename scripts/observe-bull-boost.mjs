import fs from 'node:fs';
import { BithumbClient } from '../src/bithumb/client.js';
import { BULL_BOOST, observeBoost } from '../src/research/bull-boost.js';

// T-040 전진 관찰. 공개 시세만 조회하고 주문은 내지 않는다. 판정일(2027-04-26) 이후 결과가 최종이다.
const kst = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const f = (x) => x.toFixed(2);
const r = await observeBoost({ client: new BithumbClient() });
if (!r.started) { console.log(`관찰 시작 전: ${kst(BULL_BOOST.forwardFrom)} KST 이후 마감 봉 ${r.closed}개`); process.exit(0); }
const lines = [`# 상승장 투입 확대 전진 관찰 · ${kst(Date.now())} KST`, '',
  `T-040 사전 등록 규칙. 관찰 ${kst(BULL_BOOST.forwardFrom)} ~ ${kst(r.to)} KST, 마감 4시간봉 ${r.closed}개. 판정일 ${kst(BULL_BOOST.decideAt)} KST${r.final ? ' (최종)' : ' (중간, 판정 아님)'}.`, '',
  '| 구성 | 수익 | MDD | 거래 | 확대 거래 |', '|---|---:|---:|---:|---:|',
  `| 기본 3종목×200만 | ${f(r.base.ret)}% | ${f(r.base.mdd)}% | ${r.base.trades} | — |`,
  `| 확대 200→300만 | ${f(r.boost.ret)}% | ${f(r.boost.mdd)}% | ${r.boost.trades} | ${r.boost.boosted} |`, '',
  `판정 기준 상태: **${r.verdict}**${r.reasons.length ? ` (${r.reasons.join(' / ')})` : ''}`, ''];
const out = `docs/verify/${kst(Date.now()).slice(0, 10)}_bull-boost-forward.md`;
fs.writeFileSync(out, lines.join('\n'));
console.log(lines.join('\n'));
console.log(`기록: ${out}`);
