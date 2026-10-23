import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Trader } from '../trader.js';
import { Store } from '../store.js';
import { PaperBroker } from '../broker/paper.js';
import { backtest } from '../backtest.js';

// 리플레이 모의투자: 과거 시세를 시간 순서대로 실제 매매 루프(Trader) + 모의 브로커에 흘려 넣는다.
// 가짜 시계 기준으로 마감된 봉만 보여 주므로 미래 데이터를 볼 수 없다.
// 봉 하나는 시가 → 저가 → 고가 → 종가 순서의 4개 가격으로 흐른다 (백테스트의 보수적 순서와 동일).
export async function replay(d, cfg, { btc = null, warm = 200 } = {}) {
  const unitMs = cfg.unit * 60e3;
  if (d.length < warm + 2) throw new Error(`리플레이에는 봉이 ${warm + 2}개 이상 필요합니다 (${d.length}개)`);
  let clock = d[warm].t + 1000;
  const closedUntil = (arr, total) => {
    let j = arr.length - 1;
    while (j >= 0 && arr[j].t + unitMs > clock) j--;
    return arr.slice(Math.max(0, j + 1 - total), j + 1);
  };
  const series = (market) => (market === cfg.market ? d : market === 'KRW-BTC' && btc ? btc : null);
  const client = {
    price: d[warm].o,
    async ticker() { return { price: this.price, at: clock }; },
    async candles(market, unit, { count = 200 } = {}) { return closedUntil(series(market), count); },
    async candlesRange(market, unit, total) { return closedUntil(series(market), total); },
  };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-replay-'));
  try {
    const store = new Store(dir);
    const trader = new Trader({ cfg, client, broker: new PaperBroker(store, cfg), store, log: () => {}, now: () => clock });
    await trader.init();

    const step = async (t, price) => { clock = t; client.price = price; await trader.tick(); };
    for (let k = warm; k < d.length; k++) {
      const b = d[k];
      // 시가 틱은 봉 시작 3초 뒤: 실매매처럼 직전 봉 마감 처리(진입·손절가 조정)가 여기서 일어난다
      await step(b.t + 3001, b.o);
      await step(b.t + unitMs * 0.25, b.l);
      await step(b.t + unitMs * 0.5, b.h);
      await step(b.t + unitMs - 5000, b.c);
    }
    // 끝까지 보유 중이면 마지막 종가로 정리 (백테스트와 같은 처리)
    if (store.state.position) {
      await trader.sell({ qty: store.state.position.qty, reason: '기간 종료 청산', kind: 'end' }, d[d.length - 1].c);
    }
    const idxOf = (t) => { let j = d.length - 1; while (j > 0 && d[j].t > t) j--; return j; };
    const trades = store.trades().map((t) => ({ ...t, entryIdx: idxOf(t.entryAt), exitIdx: idxOf(t.exitAt) }));
    const errors = store.events(100000).filter((e) => e.type === 'error');
    const bal = await trader.broker.balance();
    return { trades, errors, final: bal.krw + bal.coin * d[d.length - 1].c, startIdx: warm, events: store.events(100000).reverse() };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const route = (t) => t.exits.map((e) => e.reason).join(' → ');

// 같은 시세·설정으로 리플레이와 백테스트를 돌려 대조한다
export async function verify(d, cfg, { btc = null, warm = 200 } = {}) {
  const rp = await replay(d, cfg, { btc, warm });
  const bt = backtest(d, cfg, { btc, signalFrom: warm });
  const btTrades = bt.trades;
  const byEntry = new Map(btTrades.map((t) => [t.entryIdx, t]));
  const pairs = [], onlyReplay = [];
  for (const r of rp.trades) {
    const b = byEntry.get(r.entryIdx);
    if (b) { pairs.push({ r, b, sameExit: r.exitIdx === b.exitIdx, sameRoute: route(r) === route(b) }); byEntry.delete(r.entryIdx); }
    else onlyReplay.push(r);
  }
  const onlyBacktest = [...byEntry.values()];
  const total = Math.max(rp.trades.length, btTrades.length);
  const entryMatch = total ? pairs.length / total : 1;
  const routeMatch = pairs.length ? pairs.filter((p) => p.sameRoute).length / pairs.length : 1;
  const pnl = (arr) => arr.reduce((a, t) => a + t.pnl, 0);
  return {
    pass: entryMatch >= 0.9 && routeMatch >= 0.9 && rp.errors.length === 0,
    entryMatch, routeMatch,
    replay: { trades: rp.trades.length, pnl: pnl(rp.trades), final: rp.final, errors: rp.errors },
    backtest: { trades: btTrades.length, pnl: pnl(btTrades), final: bt.stats.final },
    pairs, onlyReplay, onlyBacktest, startIdx: warm,
  };
}

// 대조 결과 → 마크다운 보고서
export function verifyReport(v, d, cfg, { title = '리플레이 검증' } = {}) {
  const kst = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  const won = (x) => Math.round(x).toLocaleString('ko-KR');
  const pct = (x) => (x * 100).toFixed(1) + '%';
  const lines = [
    `# ${title}`,
    '',
    `- 실행: ${kst(Date.now())} KST`,
    `- 시세: ${cfg.market} ${cfg.unit}분봉 ${d.length}개 (${kst(d[0].t)} ~ ${kst(d[d.length - 1].t)} KST), 리플레이 시작 ${kst(d[v.startIdx].t)}`,
    `- 설정: 전략 ${cfg.strategy} · 국면 필터 ${cfg.regimeFilter} · 진입 ${cfg.entryScore} · 손절 ${cfg.stopAtr} ATR · 이탈 ${cfg.breachAtr} ATR · 목표 ${cfg.t1R}R/${cfg.t2R}R · 수수료 ${(cfg.fee * 100).toFixed(3)}%`,
    `- **판정: ${v.pass ? '통과' : '불일치'}** (기준: 진입 일치 90% 이상, 청산 경로 일치 90% 이상, 오류 0건)`,
    '',
    '| 항목 | 리플레이 (실매매 코드) | 백테스트 |',
    '|---|---|---|',
    `| 거래 수 | ${v.replay.trades} | ${v.backtest.trades} |`,
    `| 순손익 합계 | ${won(v.replay.pnl)}원 | ${won(v.backtest.pnl)}원 |`,
    `| 오류 이벤트 | ${v.replay.errors.length} | — |`,
    '',
    `- 진입 일치: ${pct(v.entryMatch)} (짝지어진 거래 ${v.pairs.length}건)`,
    `- 청산 경로 일치: ${pct(v.routeMatch)}`,
    '',
  ];
  const diffs = v.pairs.filter((p) => !p.sameRoute || !p.sameExit);
  if (diffs.length) {
    lines.push('## 청산이 다른 거래', '', '| 진입 | 리플레이 청산 | 백테스트 청산 | 손익 차이 |', '|---|---|---|---|');
    for (const { r, b } of diffs) lines.push(`| ${kst(d[r.entryIdx].t)} | ${kst(d[r.exitIdx].t)} ${route(r)} | ${kst(d[b.exitIdx].t)} ${route(b)} | ${won(r.pnl - b.pnl)}원 |`);
    lines.push('');
  }
  if (v.onlyReplay.length || v.onlyBacktest.length) {
    lines.push('## 한쪽에만 있는 거래', '', '| 쪽 | 진입 | 청산 경로 | 손익 |', '|---|---|---|---|');
    for (const t of v.onlyReplay) lines.push(`| 리플레이 | ${kst(d[t.entryIdx].t)} | ${route(t)} | ${won(t.pnl)}원 |`);
    for (const t of v.onlyBacktest) lines.push(`| 백테스트 | ${kst(d[t.entryIdx].t)} | ${route(t)} | ${won(t.pnl)}원 |`);
    lines.push('');
  }
  if (v.replay.errors.length) {
    lines.push('## 오류', '');
    for (const e of v.replay.errors.slice(0, 20)) lines.push(`- ${kst(e.at)} ${e.msg}`);
    lines.push('');
  }
  lines.push('손익 차이는 체결 가격 차이 때문에 생길 수 있습니다. 백테스트는 손절가·목표가에 정확히 체결하고, 리플레이는 그 가격을 넘은 시점의 틱 가격(저가·고가)으로 체결합니다.');
  return lines.join('\n') + '\n';
}
