import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTelegramNotifier, formatEvent } from '../src/notify/telegram.js';
import { Store } from '../src/store.js';

const at = Date.UTC(2026, 9, 23, 7);
const event = (msg = '테스트', type = 'buy') => ({ at, type, msg });
const response = (status = 200, data = { ok: true }) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
function setup(t, options = {}, handler = async () => response()) {
  const calls = [];
  const errors = [];
  const n = createTelegramNotifier({ token: '123:fake-token', chatId: '-42', minIntervalMs: 0,
    fetchImpl: async (url, init) => {
      calls.push({ url, ...init, data: JSON.parse(init.body), time: performance.now() });
      return handler(url, init, calls.length);
    }, onError: (error) => errors.push(error), ...options });
  t.after(() => n.close());
  return { n, calls, errors };
}

test('토큰 또는 chatId가 없으면 비활성이고 요청하지 않음', async (t) => {
  for (const options of [{ token: '' }, { chatId: '' }, { token: '  ' }, { chatId: undefined }]) {
    const { n, calls } = setup(t, options);
    n.notify(event());
    await n.flush();
    assert.equal(n.enabled, false);
    assert.equal(calls.length, 0);
  }
});

test('KST 시각과 한국어 라벨을 사용하고 본문은 보존', () => {
  assert.equal(formatEvent(event('매수 109,128,000원 × 0.00916'), { prefix: '[AST]' }),
    '[AST] 매수 · 10-23 16:00\n매수 109,128,000원 × 0.00916');
  assert.match(formatEvent({ ...event('재개', 'resume'), at: Date.UTC(2026, 9, 23, 23) }), /재개 · 10-24 08:00/);
  for (const [type, label] of Object.entries({ sell: '매도', close: '청산', stop: '손절가 변경', error: '오류', kill: '킬 스위치', pause: '일시정지', ops: '운영', skip: '진입 보류', start: '시작' })) {
    assert.ok(formatEvent(event('본문', type)).includes(label));
  }
});

test('메시지 한도를 지키고 이모지 서로게이트를 자르지 않음', () => {
  const text = formatEvent(event('😀'.repeat(5000)));
  assert.ok(text.length <= 4096);
  assert.ok(text.endsWith('…'));
  assert.equal(text.isWellFormed(), true);
});

test('타입 필터, POST JSON, 수신자, 텍스트 전달', async (t) => {
  const { n, calls } = setup(t, { types: ['buy'], chatId: -123 });
  n.notify(event('제외', 'skip'));
  n.notify(event('<b>문자 그대로</b>'));
  await n.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.telegram.org/bot123:fake-token/sendMessage');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers['content-type'], 'application/json');
  assert.equal(calls[0].data.chat_id, '-123');
  assert.match(calls[0].data.text, /<b>문자 그대로<\/b>/);
  assert.equal(calls[0].data.parse_mode, undefined);
  assert.deepEqual(calls[0].data.link_preview_options, { is_disabled: true });
  assert.ok(calls[0].signal instanceof AbortSignal);
});

test('비동기 요청은 한 번에 하나씩 FIFO로 전송하고 간격 보장', async (t) => {
  let active = 0;
  let maxActive = 0;
  const { n, calls } = setup(t, { minIntervalMs: 30 }, async () => {
    active++;
    maxActive = Math.max(active, maxActive);
    await sleep(5);
    active--;
    return response();
  });
  n.notify(event('첫째'));
  n.notify(event('둘째'));
  n.notify(event('셋째'));
  await n.flush();
  assert.deepEqual(calls.map((c) => c.data.text.split('\n')[1]), ['첫째', '둘째', '셋째']);
  assert.equal(maxActive, 1);
  assert.ok(calls[1].time - calls[0].time >= 25);
  assert.ok(calls[2].time - calls[1].time >= 25);
});

test('429는 retry_after 이후 한 번 재시도하고 다음 알림 순서를 보존', async (t) => {
  const { n, calls, errors } = setup(t, {}, async (_, __, count) => count === 1
    ? response(429, { ok: false, parameters: { retry_after: 0.03 } }) : response());
  n.notify(event('첫째'));
  n.notify(event('둘째'));
  await n.flush();
  assert.deepEqual(calls.map((c) => c.data.text.split('\n')[1]), ['첫째', '첫째', '둘째']);
  assert.ok(calls[1].time - calls[0].time >= 25);
  assert.equal(errors.length, 0);
});

test('429 반복은 두 번까지만 시도하고 다음 알림도 cooldown 준수', async (t) => {
  const { n, calls, errors } = setup(t, {}, async (_, __, count) => count <= 2
    ? response(429, { ok: false, error_code: 429, parameters: { retry_after: 0.03 } }) : response());
  n.notify(event('실패'));
  n.notify(event('다음'));
  await n.flush();
  assert.equal(calls.length, 3);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /429/);
  assert.ok(calls[2].time - calls[1].time >= 25);
});

test('네트워크 실패·HTTP 오류·API 오류·잘못된 JSON 뒤에도 다음 건 처리', async (t) => {
  const { n, calls, errors } = setup(t, {}, async (_, __, count) => {
    if (count === 1) throw new Error('네트워크 오류');
    if (count === 2) return response(503, { ok: false });
    if (count === 3) return response(200, { ok: false, error_code: 400 });
    if (count === 4) return { status: 200, ok: true, json: async () => { throw new Error('JSON 오류'); } };
    return response();
  });
  for (let i = 0; i < 5; i++) n.notify(event(String(i)));
  await n.flush();
  assert.equal(calls.length, 5);
  assert.equal(errors.length, 4);
});

test('onError의 동기 예외와 비동기 reject를 격리하고 토큰 숨김', async (t) => {
  for (const onError of [() => { throw new Error('처리기 오류'); }, async () => { throw new Error('비동기 처리기 오류'); }]) {
    const { n } = setup(t, { onError }, async () => { throw new Error('전송 실패'); });
    assert.doesNotThrow(() => n.notify(event()));
    await n.flush();
  }
  const { n, errors } = setup(t, {}, async (url) => { throw new Error(url + ' 123%3Afake-token'); });
  n.notify(event());
  await n.flush();
  assert.equal(errors.length, 1);
  assert.ok(!errors[0].message.includes('fake-token'));
  await sleep(0);
});

test('같은 오류는 수신 시각 기준 60초 억제, 다른 오류·매매는 유지', async (t) => {
  let now = 100000;
  t.mock.method(Date, 'now', () => now);
  const { n, calls } = setup(t);
  n.notify(event('동일', 'error'));
  await n.flush();
  now += 59999;
  n.notify({ ...event('동일', 'error'), at: at + 120000 });
  n.notify(event('다른', 'error'));
  n.notify(event('동일', 'buy'));
  await n.flush();
  assert.equal(calls.length, 3);
  now++;
  n.notify(event('동일', 'error'));
  await n.flush();
  assert.equal(calls.length, 4);
});

test('대기열 초과 시 가장 오래된 대기 건만 버리고 전송 중 항목 보존', async (t) => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const { n, calls, errors } = setup(t, { maxQueue: 2 }, async (_, __, count) => {
    if (count === 1) await pending;
    return response();
  });
  n.notify(event('전송 중'));
  await sleep(0);
  n.notify(event('버림'));
  n.notify(event('유지1'));
  n.notify(event('유지2'));
  release();
  await n.flush();
  assert.deepEqual(calls.map((c) => c.data.text.split('\n')[1]), ['전송 중', '유지1', '유지2']);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /대기열 초과/);
});

test('요청 타임아웃은 AbortSignal을 끊고 abort를 무시하는 fetch도 대기 해제', async (t) => {
  const { n, calls, errors } = setup(t, { timeoutMs: 20 }, () => new Promise(() => {}));
  n.notify(event());
  await n.flush();
  assert.equal(calls[0].signal.aborted, true);
  assert.match(errors[0].message, /응답 없음/);
});

test('응답 본문 읽기에도 타임아웃 적용', async (t) => {
  const { n, errors } = setup(t, { timeoutMs: 20 }, async () => ({ status: 200, ok: true, json: () => new Promise(() => {}) }));
  n.notify(event());
  await n.flush();
  assert.match(errors[0].message, /응답 없음/);
});

test('flush는 전송 중 요청까지 기다리고 제한시간은 오류 보고 후 resolve', async (t) => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const { n, errors } = setup(t, {}, async () => { await pending; return response(); });
  n.notify(event());
  await n.flush({ timeoutMs: 10 });
  assert.match(errors[0].message, /flush 제한시간 초과/);
  let flushed = false;
  const flush = n.flush().then(() => { flushed = true; });
  await sleep(5);
  assert.equal(flushed, false);
  release();
  await flush;
  assert.equal(flushed, true);
});

test('close는 재시도 타이머와 대기열을 취소하고 이후 notify를 무시', async (t) => {
  const { n, calls } = setup(t, {}, async () => response(429, { ok: false, parameters: { retry_after: 10 } }));
  n.notify(event('첫째'));
  n.notify(event('둘째'));
  await sleep(5);
  const flushing = n.flush();
  n.close();
  n.close();
  n.notify(event('종료 후'));
  await flushing;
  await sleep(10);
  assert.equal(calls.length, 1);
  assert.equal(n.enabled, false);
});

test('close 이후 진행 중 요청 실패는 결과 콜백을 호출하지 않음', async (t) => {
  let reject;
  const pending = new Promise((_, fail) => { reject = fail; });
  const { n, errors, calls } = setup(t, {}, () => pending);
  n.notify(event());
  await sleep(0);
  n.close();
  reject(new Error('늦은 오류'));
  await sleep(0);
  assert.equal(calls.length, 1);
  assert.equal(errors.length, 0);
});

test('잘못된 설정·이벤트·flush 인자는 호출자를 중단시키지 않음', async (t) => {
  const invalid = setup(t, { maxQueue: 0 });
  assert.equal(invalid.n.enabled, false);
  assert.equal(invalid.errors.length, 1);
  const { n, errors } = setup(t, {}, async () => { await sleep(10); return response(); });
  for (const item of [null, {}, { ...event(), at: NaN }, { ...event(), at: 1e100 }, { ...event(), msg: 5 }]) {
    assert.doesNotThrow(() => n.notify(item));
  }
  n.notify(event());
  await n.flush({ timeoutMs: -1 });
  await n.flush();
  assert.equal(errors.length, 6);
});

test('Store 구독과 연결해도 전송 실패가 이벤트 기록을 막지 않음', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-notify-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  const { n, calls } = setup(t, {}, async () => { throw new Error('전송 실패'); });
  const off = store.onEvent((e) => n.notify(e));
  store.event('buy', { msg: '모의 매수' });
  store.event('sell', { msg: '모의 매도' });
  await n.flush();
  off();
  store.event('close', { msg: '종료' });
  assert.equal(store.events().length, 3);
  assert.equal(calls.length, 2);
});

test('flush하지 않은 백그라운드 타이머는 프로세스 종료를 막지 않음', async () => {
  const module = new URL('../src/notify/telegram.js', import.meta.url).href;
  const code = `import { createTelegramNotifier } from ${JSON.stringify(module)};
    const n = createTelegramNotifier({token:'fake',chatId:'1',fetchImpl:()=>new Promise(()=>{})});
    n.notify({at:Date.now(),type:'buy',msg:'test'});`;
  await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], { timeout: 5000 });
});
