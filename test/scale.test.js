import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConfig } from '../src/config.js';
import { firstAllocation, additionalAllocation, applyAdditional, buyQuantity } from '../src/scale.js';
import { openPosition, priceAction, applyExit, toTrade } from '../src/position.js';

const cfg = buildConfig({ STRATEGY: 'structure', FEE_RATE: '0.001', SLIPPAGE: '0.001' });
const plan = { stop: 90000, t1: 130000, t2: 150000, R: 10000 };
function fresh() {
  const a = firstAllocation({ cash: 10000000, equity: 10000000, price: 100000, plan, atr: 2000, signalAt: 1 }, cfg);
  return openPosition({ at: 2, price: 100000, qty: buyQuantity(a.cost, 100000, cfg), cost: a.cost, plan, scale: a.scale });
}
const context = (over = {}) => ({ cash: 9000000, price: 106000, signal: { add: true }, signalAt: 3, allowed: true, ...over });

test('분할 설정은 명시적이며 실거래·잘못된 범위를 거부한다', () => {
  assert.equal(buildConfig({}).scaleIn, false);
  assert.equal(cfg.scaleIn, true);
  assert.equal(buildConfig({ STRATEGY: 'structure', SCALE_IN: 'false' }).scaleIn, false);
  for (const values of [{ MODE: 'live' }, { FIRST_BUY_RATIO: '1' }, { SCALE_IN: 'yes' }, { FEE_RATE: '-1' }, { RISK_PER_TRADE: '2' }]) {
    assert.throws(() => buildConfig({ STRATEGY: 'structure', ...values }));
  }
});

test('1차 40%와 2차 잔여 예산, 비용 포함 위험·평균단가·손익 보존', () => {
  const p = fresh();
  assert.equal(p.cost, 400000);
  const a = additionalAllocation(p, context(), cfg);
  assert.ok(a);
  assert.equal(a.cost, 600000);
  const fill = { cost: a.cost, price: 106000, qty: buyQuantity(a.cost, 106000, cfg) };
  applyAdditional(p, fill, { at: 4, signalAt: 3, analysis: null });
  assert.equal(p.scale.stage, 2);
  assert.equal(p.entries.length, 2);
  assert.equal(p.cost, 1000000);
  assert.ok(p.entryPrice > 100000 && p.entryPrice < 106000);
  assert.ok(p.cost - p.qty * p.stop * (1 - cfg.fee) * (1 - cfg.slip) <= p.scale.riskBudget);
  assert.equal(p.stop, plan.stop);
  assert.equal(p.t1, plan.t1);
  assert.equal(additionalAllocation(p, context({ signalAt: 5 }), cfg), null);
  for (const price of [p.t1, p.t2]) {
    const act = priceAction(p, price, cfg);
    applyExit(p, { at: price, price, qty: act.qty, proceeds: act.qty * price * (1 - cfg.fee), reason: act.reason, kind: act.kind }, cfg);
  }
  const t = toTrade(p);
  assert.equal(t.exits.length, 2);
  assert.equal(t.pnl, t.exits.reduce((s, e) => s + e.proceeds, 0) - 1000000);
  assert.equal(t.entries.length, 2);
  p.entries[0].cost = 0;
  assert.equal(t.entries[0].cost, 400000);
});

test('새 신호·상승·위험 한도·구조 조건 중 하나라도 실패하면 추가하지 않는다', () => {
  for (const over of [{ allowed: false }, { signalAt: 1 }, { signal: { add: false } }, { price: 99000 }, { price: 130000 }, { cash: 1000 }, { signal: { add: true, analysis: { wave: { stage: '구조 무효' } } } }]) {
    assert.equal(additionalAllocation(fresh(), context(over), cfg), null, JSON.stringify(over));
  }
  const p = fresh(); p.scale.riskBudget = 1;
  assert.equal(additionalAllocation(p, context(), cfg), null);
  const old = fresh(); delete old.scale;
  assert.equal(additionalAllocation(old, context(), cfg), null);
});

test('부분 매도 후 추가 금지 및 비용·슬리피지를 포함한 본전', () => {
  const p = fresh(), a = priceAction(p, p.t1, cfg);
  applyExit(p, { at: 4, price: p.t1, qty: a.qty, proceeds: a.qty * p.t1 * (1 - cfg.fee), reason: a.reason, kind: a.kind }, cfg);
  assert.equal(additionalAllocation(p, context(), cfg), null);
  assert.ok(Math.abs(p.stop * (1 - cfg.fee) * (1 - cfg.slip) - p.cost / p.qtyInit) < 1e-8);
});

test('고변동 시 총 예산을 위험 한도로 축소하고 비용 때문에 손익비 부족하면 보류', () => {
  const a = firstAllocation({ cash: 1000000, equity: 1000000, price: 100000, plan, atr: 2000, signalAt: 1 }, cfg);
  assert.ok(a.scale.budget < cfg.maxPositionKrw);
  assert.ok(a.scale.budget - buyQuantity(a.scale.budget, 100000, cfg) * plan.stop * (1 - cfg.fee) * (1 - cfg.slip) <= a.scale.riskBudget + 1e-6);
  assert.equal(firstAllocation({ cash: 10000, equity: 10000, price: 100000, plan, atr: 2000, signalAt: 1 }, cfg), null);
  assert.equal(firstAllocation({ cash: 1000000, equity: 1000000, price: 100000, plan: { ...plan, t1: 100010 }, atr: 2000, signalAt: 1 }, cfg), null);
});
