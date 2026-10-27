import fs from 'node:fs';
import { BithumbClient } from '../src/bithumb/client.js';
import { buildConfig } from '../src/config.js';
import { backtest, loadBacktestData } from '../src/backtest.js';
import { verify, verifyReport } from '../src/sim/replay.js';

// 키·운영 설정을 읽지 않고 공개 시세와 모의 매매만 비교한다. 조건 최적화는 하지 않는다.
const client = new BithumbClient(), count = Number(process.argv[2] || 1500);
const date = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const rows = [], ranges = [];
fs.mkdirSync('logs', { recursive: true });
fs.mkdirSync('docs/verify', { recursive: true });
for (const market of ['KRW-BTC', 'KRW-ETH', 'KRW-XRP']) {
  const base = buildConfig({ MARKET: market });
  const { d, btc } = await loadBacktestData(client, base, count);
  fs.writeFileSync(`logs/T015-${market}-candles.json`, JSON.stringify({ d, btc }));
  ranges.push({ market, from: d[0].t, to: d.at(-1).t, bars: d.length, split: d[Math.floor(d.length * .7)].t });
  for (const fee of [0.0004, 0.0025]) {
    for (const [strategy, scaleIn] of [['score', false], ['structure', false], ['structure', true]]) {
      const cfg = buildConfig({ MARKET: market, STRATEGY: strategy, SCALE_IN: String(scaleIn), FEE_RATE: String(fee) });
      for (const segment of ['전체', '후반30%']) {
        const result = backtest(d, cfg, { btc, signalFrom: segment === '전체' ? 200 : Math.floor(d.length * .7) });
        rows.push({ market, fee, strategy, scaleIn, segment, ...result.stats, secondBuys: result.trades.filter(t => t.entries?.length === 2).length });
      }
    }
  }
  for (const strategy of ['score', 'structure']) {
    const cfg = buildConfig({ MARKET: market, STRATEGY: strategy, FEE_RATE: '0.0004' });
    const v = await verify(d, cfg, { btc });
    fs.writeFileSync(`docs/verify/${date}_${market}_240_${strategy}_fee004.md`, verifyReport(v, d, cfg));
    console.log(JSON.stringify({ market, strategy, fee: cfg.fee, pass: v.pass, trades: v.replay.trades, stages: v.stageMatch }));
    if (!v.pass) process.exitCode = 1;
  }
}
fs.writeFileSync('logs/T015-research.json', JSON.stringify({ ranges, rows }, null, 2));
const kst = t => new Date(t + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const lines = [`# 구조·분할 전략 비용 비교 · ${date}`, '',
  '공개 마감 시세, 초기 1,000만 원·포지션 최대 100만 원·슬리피지 편도 0.05%. 전체 구간은 준비 200봉 이후 진입. 후반 30%는 앞부분 지표 준비만 하고 현금으로 새로 시작. 이번에 관찰한 탐색 구간이며 독립 검증으로 주장하지 않는다.', '',
  '수수료 0.04%는 계정 적용 확인 전의 시나리오. 0.25%는 비용 스트레스 비교. 계정 요율이나 과거 이벤트 요율을 소급 확정하지 않는다. 거래 수가 적으면 승률을 일반화할 수 없다.', '',
  ...ranges.map(r => `- ${r.market}: ${r.bars}봉 ${kst(r.from)} ~ ${kst(r.to)} KST, 후반 시작 ${kst(r.split)} KST`), '',
  '| 종목 | 편도 수수료 | 전략 | 구간 | 거래 | 승률 | 순손익(원) | PF | MDD | 2차 매수 |', '|---|---|---|---|---:|---:|---:|---:|---:|---:|'];
for (const r of rows) lines.push(`| ${r.market} | ${(r.fee * 100).toFixed(2)}% | ${r.strategy}${r.scaleIn ? ' 분할' : ''} | ${r.segment} | ${r.trades} | ${r.winRate.toFixed(1)}% | ${Math.round(r.pnl)} | ${r.pf === null ? '∞' : r.pf.toFixed(2)} | ${r.mdd.toFixed(2)}% | ${r.secondBuys} |`);
lines.push('', '단일 진입과 분할 진입은 투자 노출이 다르다. 작은 손실만으로 전략 우위를 주장하지 않는다. 원본·수치: logs/T015-*-candles.json, logs/T015-research.json. 재현: node scripts/research-structure.mjs 1500.');
fs.writeFileSync(`docs/verify/${date}_structure-research.md`, lines.join('\n') + '\n');
