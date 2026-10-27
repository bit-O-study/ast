import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decisionHtml, scaleHtml } from '../web/decision.js';
test('판단·분할매수는 기존 데이터와 호환되고 텍스트를 이스케이프한다', () => {
  assert.equal(decisionHtml(null), '');
  assert.equal(scaleHtml({}), '');
  const html = decisionHtml({ wave: { stage: '<script>', retracement: null }, accumulation: '<img>', checks: [{ ok: false, label: '<x>', reason: '조건 없음' }] });
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /성공 확률이 아닙니다/);
  const p = { scale: { stage: 1, budget: 1000000 }, cost: 400000, entries: [{ stage: 1, price: 100000, cost: 400000 }], exits: [] };
  assert.match(scaleHtml(p), /1차 매수 완료/);
  assert.match(scaleHtml(p), /1,000,000원/);
  p.exits.push({});
  assert.match(scaleHtml(p), /매도 시작 후 추가 매수하지 않습니다/);
});
