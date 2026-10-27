import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmedPivots, waveAt } from '../src/analysis/structure.js';
import strategy from '../src/strategies/structure.js';
import { loadBacktestData } from '../src/backtest.js';
import { buildConfig } from '../src/config.js';

const bars = values => values.map((c, i) => ({ t: i * 14400000, o: c - .2, h: c + 1, l: c - 1, c, v: 100 + i % 5 * 10 }));
test('피벗은 오른쪽 2봉 마감 전에는 확인되지 않는다', () => {
  const d = bars([12, 11, 8, 10, 12, 15, 13, 11, 10, 12, 14]);
  assert.equal(confirmedPivots(d, 3).length, 0);
  assert.deepEqual(confirmedPivots(d, 4).map(p => [p.kind, p.at, p.confirmedAt]), [['low', d[2].t, d[4].t]]);
  const w = waveAt(d, 10);
  assert.equal(w.stage, '눌림 확인');
  assert.equal(w.valid, true);
  assert.equal(w.points.length, 3);
  d.push({ ...d.at(-1), t: 11 * 14400000, c: 17, h: 18, l: 13 });
  assert.equal(waveAt(d, 11).stage, '재상승 확인');
  d.push({ ...d.at(-1), t: 12 * 14400000, l: 8, c: 10 });
  assert.equal(waveAt(d, 12).stage, '구조 무효');
});

test('미래 봉 추가·변조가 과거 판단과 파동을 바꾸지 않는다', () => {
  const d = bars(Array.from({ length: 180 }, (_, i) => 100 + i * .1 + Math.sin(i / 5) * 3));
  const full = strategy.prepare(d);
  for (let i = 80; i < 160; i += 7) {
    const r = strategy.evaluate(full, i);
    assert.deepEqual(r, strategy.evaluate(strategy.prepare(d.slice(0, i + 1)), i));
    const changed = d.map((b, j) => j <= i ? b : { ...b, h: 99999, l: 1, c: 50000, v: 99999 });
    assert.deepEqual(r, strategy.evaluate(strategy.prepare(changed), i));
    assert.ok(r.analysis.wave.points.every(p => p.confirmedAt <= d[i].t));
  }
});

test('거래량 없는 평탄 시세와 준비 구간은 매수하지 않고 이유를 설명한다', () => {
  const d = bars(Array(120).fill(100)).map(b => ({ ...b, o: 100, h: 100, l: 100, v: 0 }));
  for (const i of [60, 80, 119]) {
    const r = strategy.evaluate(strategy.prepare(d), i);
    assert.equal(r.enter, false);
    assert.equal(r.add, false);
    assert.ok(Number.isFinite(r.score));
    assert.ok(Number.isFinite(r.adx));
    assert.ok(Number.isFinite(r.rsi));
    assert.match(r.note, /부족/);
  }
});

test('필수 조건을 모두 확인하고 중복 지표 대신 5개 판단 묶음을 제공한다', () => {
  const d = bars(Array.from({ length: 120 }, (_, i) => 100 + i * .1 + Math.sin(i / 5)));
  const r = strategy.evaluate(strategy.prepare(d), 119);
  assert.equal(r.enter, r.analysis.ready && r.analysis.checks.every(c => c.ok));
  assert.equal(r.parts.length, 5);
});

test('공개 시세 백테스트 로더는 대상·BTC 모두 진행 중 봉을 제외한다', async () => {
  const cfg = buildConfig({ MARKET: 'KRW-ETH' }), now = Date.now(), unitMs = cfg.unit * 60000;
  const rows = [{ t: now - 2 * unitMs }, { t: now - unitMs / 2 }, { t: now + unitMs }];
  const client = { async candlesRange() { return rows; } };
  const result = await loadBacktestData(client, cfg, 3);
  assert.deepEqual(result.d, [rows[0]]);
  assert.deepEqual(result.btc, [rows[0]]);
});
