import fs from 'node:fs';
import { BithumbClient } from '../src/bithumb/client.js';
import { REGIME_HOLD, FORWARD_COSTS, observeForward } from '../src/research/regime-hold.js';

// T-027 전진 관찰. 공개 시세만 조회하고 주문은 내지 않는다.
const kst = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const f = (x) => x.toFixed(2);
const r = await observeForward({ client: new BithumbClient() });
if (!r.started) {
  console.log(`관찰 시작 전: ${kst(REGIME_HOLD.forwardFrom)} KST 이후 마감 봉 ${r.closed}개`);
  process.exit(0);
}
const lines = [`# 국면 보유 전진 관찰 · ${kst(r.now)} KST`, '',
  `T-027 사전 등록 규칙(BTC 20일 평균, KST 08시 마감 1회 판정, 3종목 동일 비중). 관찰 ${kst(r.from)} ~ ${kst(r.to)} KST, 마감 4시간봉 ${r.closed}개.`, '',
  '| 비용(편도) | 국면 보유 | MDD | 3종목 보유 | 보유 MDD | 종목별 | 전환 |', '|---|---:|---:|---:|---:|---|---:|',
  ...Object.entries(r.results).map(([k, p]) => `| ${k} ${(FORWARD_COSTS[k] * 100).toFixed(2)}% | ${f(p.ret)}% | ${f(p.mdd)}% | ${f(p.hold.ret)}% | ${f(p.hold.mdd)}% | ${p.per.map((x) => `${x.market.slice(4)} ${f(x.ret)}%`).join(' / ')} | ${p.per[0].switches} |`), '',
  `현재 BTC ${r.btcNow.bull ? '평균 위(보유 국면)' : '평균 아래(현금 국면)'} · 종가 ${Math.round(r.btcNow.close).toLocaleString()} / 20일 평균 ${Math.round(r.btcNow.ma).toLocaleString()}. 판정은 KST 08시 마감 봉에서만 바뀐다.`, ''];
const out = `docs/verify/${kst(r.now).slice(0, 10)}_regime-hold-forward.md`;
fs.writeFileSync(out, lines.join('\n'));
console.log(lines.join('\n'));
console.log(`기록: ${out}`);
