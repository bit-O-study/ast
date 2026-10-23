// 빗썸 실제 시세로 백테스트: npm run backtest -- [봉 개수]
import { loadEnv, buildConfig } from '../config.js';
import { BithumbClient } from '../bithumb/client.js';
import { backtest, loadBacktestData } from '../backtest.js';

loadEnv();
const cfg = { ...buildConfig({ ...process.env, MODE: 'paper' }) };
const count = Number(process.argv[2] || 1000);
const client = new BithumbClient();

const won = (x) => Math.round(x).toLocaleString('ko-KR');
const kst = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

const { d, btc } = await loadBacktestData(client, cfg, count);
console.log(`${cfg.market} ${cfg.unit}분봉 ${d.length}개 (${kst(d[0].t)} ~ ${kst(d[d.length - 1].t)} KST)`);
const r = backtest(d, cfg, { btc });
const s = r.stats;
console.log(`전략 ${r.strategy.name} · 국면 필터 ${r.regimeEnabled ? `BTC ${cfg.regimeDays}일 평균` : '끔'}`);
console.log(`\n총 손익   ${s.pnl >= 0 ? '+' : ''}${won(s.pnl)}원 (${s.ret.toFixed(2)}%)  · 단순 보유 ${s.holdRet.toFixed(2)}%`);
console.log(`거래 ${s.trades}건  성공 ${s.wins} / 실패 ${s.losses}  승률 ${s.winRate.toFixed(1)}%  손익비 ${s.pf === null ? '∞' : s.pf.toFixed(2)}  MDD ${s.mdd.toFixed(1)}%`);
const why = {};
for (const k of r.skipped) {
  const key = k.reason.startsWith('저항선') ? '저항선 손익비 부족' : k.reason;
  why[key] = (why[key] ?? 0) + 1;
}
console.log(`건너뛴 신호 ${r.skipped.length}건 ${Object.entries(why).map(([k, v]) => `${k} ${v}`).join(', ')}\n`);
for (const t of r.trades) {
  console.log(`${t.result}  ${kst(t.entryAt)} 매수 ${won(t.entryPrice)} (손절 ${won(t.initialStop)}, 목표 ${won(t.t1)}/${won(t.t2)}) → ${kst(t.exitAt)} ${t.reason}  ${t.pnl >= 0 ? '+' : ''}${won(t.pnl)}원 (${t.pct.toFixed(2)}%)`);
}
