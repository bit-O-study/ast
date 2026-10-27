import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { BithumbClient } from '../src/bithumb/client.js';

// T-038 종목 선정 (성과 조회 전 고정 규칙):
// 1) 빗썸 KRW 마켓, 스테이블코인 제외 2) 현재 24시간 거래대금 상위 3) 4시간봉 2020-07-01 이전부터 시세 있음
// 상위 10개까지 시세를 받아 logs/T038-<종목>-candles.json에 저장한다. 공개 시세만 조회한다.
const STABLE = new Set(['USDT', 'USDC', 'DAI', 'TUSD', 'USDE', 'USDS', 'USD1', 'FDUSD', 'PYUSD']);
const NEED_FROM = Date.UTC(2020, 6, 1), BARS = 14000, TOP = 10;
const get = async (p) => {
  const r = await fetch('https://api.bithumb.com' + p, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${p} HTTP ${r.status}`);
  return r.json();
};
const all = (await get('/v1/market/all')).map((m) => m.market).filter((m) => m.startsWith('KRW-') && !STABLE.has(m.slice(4)));
const tickers = [];
for (let i = 0; i < all.length; i += 50) {
  tickers.push(...await get('/v1/ticker?markets=' + all.slice(i, i + 50).join(',')));
  await new Promise((r) => setTimeout(r, 150));
}
const ranked = tickers.map((t) => ({ market: t.market, value24h: t.acc_trade_price_24h })).sort((a, b) => b.value24h - a.value24h);
const client = new BithumbClient(), now = Date.now(), chosen = [], skipped = [];
for (const r of ranked) {
  if (chosen.length >= TOP) break;
  const d = (await client.candlesRange(r.market, 240, BARS)).filter((b) => b.t + 14400000 <= now);
  if (!d.length || d[0].t > NEED_FROM) { skipped.push({ ...r, firstBar: d[0]?.t ?? null }); continue; }
  const raw = JSON.stringify(d);
  fs.writeFileSync(`logs/T038-${r.market}-candles.json`, raw);
  chosen.push({ ...r, bars: d.length, firstBar: d[0].t, lastBar: d.at(-1).t, sha256: createHash('sha256').update(raw).digest('hex') });
  console.log(`선정 ${chosen.length}: ${r.market} 24h ${Math.round(r.value24h / 1e8)}억 ${d.length}봉 ${new Date(d[0].t).toISOString().slice(0, 10)}~`);
}
fs.writeFileSync('logs/T038-universe.json', JSON.stringify({ at: now, rule: '빗썸 KRW·스테이블 제외·24h 거래대금 상위·4h 시세 2020-07-01 이전 시작', chosen, skipped }, null, 2));
console.log(`제외(시세 부족): ${skipped.map((s) => s.market).join(', ')}`);
