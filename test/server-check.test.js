import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPaper, formatCheck } from '../scripts/server/check-paper.mjs';

const at = 1_000_000;
const status = { mode: 'paper', price: 100, balance: { krw: 1000, coin: 0 }, position: null, signal: { at: 900_000 }, nextCandleAt: 1_100_000, lastError: null, halted: false, killed: false };
const report = { state: 'running', samples: 2, startedAt: 900_000, lastSampleAt: at, deadline: 1_200_000, issues: [] };
const run = (s = {}, r = {}, extra = {}) => checkPaper({
  now: () => at,
  fetchImpl: async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8787/api/status');
    assert.ok(options.signal);
    return { ok: true, json: async () => ({ ...status, ...s }) };
  },
  readReport: async () => JSON.stringify({ ...report, ...r }), ...extra,
});

test('정상 모의투자와 진행 중 관측을 구분해 출력', async () => {
  const r = await run();
  assert.equal(r.exitCode, 0);
  assert.match(formatCheck(r), /진행 중/);
  assert.match(formatCheck(r), /KST/);
});
test('갱신 중단과 관측 기한 초과를 검출', async () => {
  const r = await run({}, { lastSampleAt: 900_000, deadline: 999_999 });
  assert.equal(r.exitCode, 2);
  assert.equal(r.warnings.length, 2);
});
test('과거 관측 통과가 현재 서버 장애를 덮지 않음', async () => {
  const r = await run({ lastError: { message: '비밀' } }, { state: 'passed', initialSignalAt: 100, lastSignalAt: 200, expectedCandleAt: 950_000, finishedAt: at });
  assert.equal(r.exitCode, 1);
  assert.match(formatCheck(r), /이전 관측 통과/);
  assert.doesNotMatch(JSON.stringify(r), /비밀/);
});
for (const [name, s] of [
  ['실거래', { mode: 'live' }], ['봉 처리 지연', { nextCandleAt: 600_000 }],
  ['킬 스위치', { killed: true }], ['잘못된 시세', { price: null }], ['누락된 상태', { position: undefined }],
]) {
  test(`${name} 상태는 오류`, async () => assert.equal((await run(s)).exitCode, 1));
}
test('일시정지는 주의로 표시', async () => assert.equal((await run({ halted: true })).exitCode, 2));
test('연결 오류 원문을 노출하지 않음', async () => {
  const r = await run({}, {}, { fetchImpl: async () => { throw new Error('secret-token'); } });
  assert.equal(r.exitCode, 1);
  assert.doesNotMatch(JSON.stringify(r), /secret-token/);
});
test('보고서 누락은 관측 경고', async () => {
  assert.equal((await run({}, {}, { readReport: async () => { throw new Error('ENOENT'); } })).exitCode, 2);
});
for (const [name, r] of [
  ['실패', { state: 'failed', finishedAt: at }], ['완료 시각 누락', { state: 'passed' }],
  ['미래 시각', { lastSampleAt: at + 10_000 }],
  ['통과 근거 누락', { state: 'passed', finishedAt: at }],
]) {
  test(`보고서 ${name} 검출`, async () => assert.equal((await run({}, r)).exitCode, 2));
}
