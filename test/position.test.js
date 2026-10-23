import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPosition, priceAction, applyExit, onCandleClose, toTrade } from '../src/position.js';
import { planEntry } from '../src/strategy.js';
import { buildConfig } from '../src/config.js';

const cfg = buildConfig({});
const plan = { stop: 95_000, t1: 110_000, t2: 120_000, R: 5_000 };
const fresh = () => openPosition({ at: 0, price: 100_000, qty: 1, cost: 100_250, plan, signal: { score: 50, parts: [] } });
const ctx = (over = {}) => ({ at: 1, close: 100_000, prevClose: 100_000, atr: 2_000, s20: 99_000, prevS20: 99_000, score: 0, barsHeld: 1, ...over });

test('손절가 위에서는 팔지 않고, 손절가 이하가 되면 전량 매도', () => {
  const p = fresh();
  assert.equal(priceAction(p, 95_001, cfg), null);
  const a = priceAction(p, 95_000, cfg);
  assert.equal(a.qty, 1);
  assert.equal(a.reason, '손절가 도달');
});

test('이탈 신호가 나와도 바로 팔지 않고, 손절가를 정해 추가 하락 시에만 매도', () => {
  const p = fresh();
  // 20이평 하향 이탈 봉: 종가 98,000, ATR 2,000, BREACH_ATR 1.0 → 손절가 96,000
  const notes = onCandleClose(p, ctx({ close: 98_000, prevClose: 100_000, s20: 99_000, prevS20: 99_500 }), cfg);
  assert.equal(notes.length, 1);
  assert.equal(p.stopType, 'breach');
  assert.equal(p.stop, 96_000);
  assert.ok(p.warn);
  assert.equal(priceAction(p, 97_000, cfg), null, '이탈 직후 가격에서는 매도하지 않음');
  const a = priceAction(p, 96_000, cfg);
  assert.equal(a.reason, '이탈 후 손절가 도달');
});

test('점수 이탈(≤ -EXIT_SCORE)도 같은 방식으로 손절가만 올린다', () => {
  const p = fresh();
  onCandleClose(p, ctx({ close: 101_000, score: -25 }), cfg);
  assert.equal(p.stop, 101_000 - cfg.breachAtr * 2_000);
  assert.equal(priceAction(p, 100_000, cfg), null);
});

test('손절가는 절대 내려가지 않는다', () => {
  const p = fresh();
  onCandleClose(p, ctx({ close: 98_000, prevClose: 100_000, prevS20: 99_500 }), cfg); // 96,000
  onCandleClose(p, ctx({ close: 96_500, prevClose: 99_500, s20: 99_000, prevS20: 99_000, score: -30 }), cfg); // 후보 94,500 < 96,000
  assert.equal(p.stop, 96_000);
});

test('1차 목표가에서 절반 매도 후 손절가를 본전으로, 2차 목표가에서 나머지 매도', () => {
  const p = fresh();
  const a1 = priceAction(p, 110_000, cfg);
  assert.equal(a1.kind, 't1');
  assert.equal(a1.qty, 0.5);
  const closed = applyExit(p, { at: 2, price: 110_000, qty: a1.qty, proceeds: 54_862.5, reason: a1.reason, kind: a1.kind }, cfg);
  assert.equal(closed, false);
  assert.equal(p.stopType, 'breakeven');
  assert.ok(p.stop > 100_000 && p.stop < 101_000);
  assert.equal(priceAction(p, 115_000, cfg), null);
  const a2 = priceAction(p, 120_000, cfg);
  assert.equal(a2.kind, 't2');
  assert.equal(applyExit(p, { at: 3, price: 120_000, qty: a2.qty, proceeds: 59_850, reason: a2.reason, kind: a2.kind }, cfg), true);
  const t = toTrade(p);
  assert.equal(t.result, '성공');
  assert.equal(Math.round(t.pnl), Math.round(54_862.5 + 59_850 - 100_250));
});

test('1차 목표 이후에는 최고 종가 기준으로 추적 손절가가 올라간다', () => {
  const p = fresh();
  p.t1Done = true;
  onCandleClose(p, ctx({ close: 115_000, atr: 2_000 }), cfg);
  assert.equal(p.stopType, 'trail');
  assert.equal(p.stop, 115_000 - cfg.stopAtr * 2_000);
});

test('나눠 팔면 최소 주문금액 미만이 되는 소액 포지션은 1차 목표가에서 전량 매도', () => {
  const p = openPosition({ at: 0, price: 100_000, qty: 0.08, cost: 8_020, plan, signal: null });
  const a = priceAction(p, 110_000, cfg);
  assert.equal(a.qty, 0.08);
});

test('수수료 때문에 손실이면 실패로 판정', () => {
  const p = fresh();
  applyExit(p, { at: 1, price: 100_200, qty: 1, proceeds: 100_200 * (1 - cfg.fee), reason: '테스트', kind: 'manual' }, cfg);
  assert.equal(toTrade(p).result, '실패');
});

test('planEntry: 손절가는 최소 1 ATR 아래, 저항선이 가까우면 진입 보류', () => {
  const d = Array.from({ length: 70 }, (_, i) => ({ t: i, o: 100, h: 101, l: 99, c: 100, v: 1 }));
  const I = { atr: Array(70).fill(2) };
  const ok = planEntry(d, I, 69, 100, cfg);
  assert.ok(ok.ok);
  assert.ok(ok.stop <= 98);
  assert.equal(ok.t1, 100 + cfg.t1R * ok.R);

  d[40].h = 103; // 진입가 위 1.5 ATR 에 저항선
  const blocked = planEntry(d, I, 69, 100, cfg);
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /저항선/);

  d[40].h = 108; // 멀리 있는 저항선 → 1차 목표가를 저항선 아래로
  const capped = planEntry(d, I, 69, 100, cfg);
  assert.ok(capped.ok);
  assert.ok(capped.t1 < 108 && capped.t1 <= 100 + cfg.t1R * capped.R);
});
