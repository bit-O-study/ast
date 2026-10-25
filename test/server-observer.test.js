import test from 'node:test';
import assert from 'node:assert/strict';
import { observePaper } from '../scripts/server/observe-paper.mjs';

async function run({ statuses, events = [], reject = false }) {
  let time = 1000, index = 0;
  const saved = [];
  const report = await observePaper({
    now: () => time,
    sleep: async (ms) => { time += ms; index++; },
    intervalMs: 100,
    save: async (value) => saved.push(structuredClone(value)),
    fetchImpl: async (url) => {
      if (reject) throw new Error('연결 실패');
      const body = url.endsWith('/events') ? events : statuses[Math.min(index, statuses.length - 1)];
      return { ok: true, json: async () => body };
    },
  });
  return { report, saved };
}
const status = (at = 500, extra = {}) => ({ mode: 'paper', signal: { at }, nextCandleAt: 1100, lastError: null, ...extra });

test('관측 중인 보고서를 저장하고 새 마감봉이 진행하면 통과', async () => {
  const { report, saved } = await run({ statuses: [status(), status(600)] });
  assert.equal(saved[0].state, 'running');
  assert.equal(report.state, 'passed');
  assert.equal(report.samples, 2);
});

test('같은 봉이나 과거 봉은 완료로 취급하지 않고 기한 초과', async () => {
  const { report } = await run({ statuses: [status(), status(400)] });
  assert.equal(report.state, 'failed');
  assert.match(report.issues[0], /기한/);
});

for (const [name, args, message] of [
  ['실거래 모드', { statuses: [status(500, { mode: 'live' })] }, /모의투자/],
  ['서버 오류', { statuses: [status(500, { lastError: { message: '오류' } })] }, /루프 오류/],
  ['관측 중 재시작', { statuses: [status()], events: [{ type: 'start', at: 1000 }] }, /재시작/],
  ['관측 중 오류 이벤트', { statuses: [status()], events: [{ type: 'error', at: 1000 }] }, /오류 이벤트/],
  ['연결 실패', { statuses: [status()], reject: true }, /연결 실패/],
  ['잘못된 봉 정보', { statuses: [status(NaN)] }, /봉 시각/],
]) {
  test(`${name}를 검출하고 실패 보고서 저장`, async () => {
    const { report, saved } = await run(args);
    assert.equal(report.state, 'failed');
    assert.match(report.issues[0], message);
    assert.equal(saved.at(-1).state, 'failed');
  });
}

test('관측 시작 전의 오류와 시작 이벤트는 이번 검증과 구분', async () => {
  const { report } = await run({ statuses: [status(), status(600)], events: [{ type: 'start', at: 900 }, { type: 'error', at: 900 }] });
  assert.equal(report.state, 'passed');
});
