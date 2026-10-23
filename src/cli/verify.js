// 리플레이 모의투자 검증: npm run verify -- [봉 개수] [코인,코인...]
// 실매매 코드(Trader + 모의 브로커)로 과거 시세를 흘려 보내고 백테스트와 대조해 docs/verify/에 보고서를 쓴다
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, buildConfig } from '../config.js';
import { BithumbClient } from '../bithumb/client.js';
import { loadBacktestData } from '../backtest.js';
import { verify, verifyReport } from '../sim/replay.js';

loadEnv();
const count = Number(process.argv[2] || 1500);
const markets = (process.argv[3] || process.env.MARKET || 'KRW-BTC').split(',');
const client = new BithumbClient();
const outDir = path.join('docs', 'verify');
fs.mkdirSync(outDir, { recursive: true });
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

let allPass = true;
for (const market of markets) {
  const cfg = buildConfig({ ...process.env, MODE: 'paper', MARKET: market });
  const { d, btc } = await loadBacktestData(client, cfg, count);
  const v = await verify(d, cfg, { btc });
  const file = path.join(outDir, `${today}_${market}_${cfg.unit}_${cfg.strategy}_${cfg.regimeFilter}.md`);
  fs.writeFileSync(file, verifyReport(v, d, cfg, { title: `리플레이 검증 · ${market} ${cfg.unit}분봉 · ${cfg.strategy}` }));
  allPass &&= v.pass;
  console.log(`${v.pass ? '통과' : '불일치'}  ${market}  거래 리플레이 ${v.replay.trades} / 백테스트 ${v.backtest.trades}  진입 일치 ${(v.entryMatch * 100).toFixed(0)}%  청산 경로 일치 ${(v.routeMatch * 100).toFixed(0)}%  오류 ${v.replay.errors.length}  → ${file}`);
}
process.exitCode = allPass ? 0 : 1;
