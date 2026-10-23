import { BithumbClient } from '../bithumb/client.js';
import { CandleStore, toKst } from '../data/candleStore.js';

try {
  const [marketsArg, unitArg = '240', barsArg = '1000', ...extra] = process.argv.slice(2);
  const unit = Number(unitArg);
  const minBars = Number(barsArg);
  if (!marketsArg || extra.length || !Number.isSafeInteger(minBars) || minBars < 1) {
    throw new Error('사용법: npm run fetch -- KRW-BTC,KRW-ETH 240 1000');
  }
  let requests = 0;
  const client = new BithumbClient({ fetchImpl: (url, options) => {
    requests++;
    return fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  } });
  const store = new CandleStore({ client });
  const markets = [...new Set(marketsArg.split(',').map((market) => market.trim()))];
  for (const market of markets) store.file(market, unit);
  for (const market of markets) {
    const before = store.load(market, unit).length;
    const count = requests;
    const start = Date.now();
    console.log(`${market} ${unit}분봉 수집 시작 (기존 ${before}개, 최소 ${minBars}개)`);
    const rows = await store.update(market, unit, { minBars });
    const period = rows.length ? `${toKst(rows[0].t)} ~ ${toKst(rows.at(-1).t)} KST` : '없음';
    console.log(`${market}: 저장 ${rows.length}개, 증가 ${rows.length - before}개, API 요청 ${requests - count}회, 소요 ${Date.now() - start}ms`);
    console.log(`기간: ${period}, 빠진 구간 ${store.gaps(market, unit).length}개`);
    if (rows.length < minBars) console.log(`요청한 최소 봉 수보다 적습니다: ${rows.length}/${minBars}`);
  }
} catch (error) {
  console.error(`캔들 수집 실패: ${error.message}`);
  process.exitCode = 1;
}
