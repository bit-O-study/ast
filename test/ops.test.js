import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { startHeartbeat } from '../src/ops/heartbeat.js';
import { createIpWatcher } from '../src/ops/ipWatcher.js';

const ok = (text = 'OK') => ({ ok: true, text: async () => text });
function heartbeat(t, options = {}) {
  const h = startHeartbeat({ url: 'https://hc-ping.com/test', intervalSec: 60, fetchImpl: async () => ok(), ...options });
  t.after(() => h.stop());
  return h;
}
function watcher(t, options = {}) {
  const w = createIpWatcher({ sources: ['https://ip.example/a', 'https://ip.example/b'], intervalSec: 300, fetchImpl: async () => ok('203.0.113.1'), ...options });
  t.after(() => w.stop());
  return w;
}

test('빈 URL은 생존 감시 비활성화', async (t) => {
  let calls = 0;
  const h = heartbeat(t, { url: '', fetchImpl: () => { calls++; } });
  assert.equal(h.enabled, false);
  assert.equal(await h.ping(), false);
  assert.equal(await h.fail('오류'), false);
  assert.equal(calls, 0);
});

test('생존 감시 즉시·주기 ping, 중복 호출 병합, stop 후 중단', async (t) => {
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const h = heartbeat(t, { intervalSec: 0.015, fetchImpl: async (_, options) => {
    calls++; active++; maxActive = Math.max(maxActive, active);
    assert.equal(options.method, 'GET');
    await sleep(20);
    active--;
    return ok();
  } });
  const first = h.ping();
  assert.equal(h.ping(), first);
  assert.equal(await first, true);
  await sleep(40);
  h.stop();
  const count = calls;
  await sleep(40);
  assert.ok(count >= 2);
  assert.equal(calls, count);
  assert.equal(maxActive, 1);
  assert.equal(await h.ping(), false);
});

test('fail은 ping 이후 POST하고 경로·쿼리·본문 보존', async (t) => {
  const calls = [];
  const h = heartbeat(t, { url: 'https://hc-ping.com/test/?rid=x', fetchImpl: async (url, options) => {
    calls.push({ url, ...options });
    return ok();
  } });
  assert.equal(await h.fail('킬 스위치'), true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://hc-ping.com/test/fail?rid=x');
  assert.equal(calls[1].method, 'POST');
  assert.equal(calls[1].body, '킬 스위치');
});

test('생존 감시 네트워크·HTTP 실패와 오류 처리기 예외 격리', async (t) => {
  for (const fetchImpl of [async () => { throw new Error('secret url'); }, async () => ({ ok: false, text: async () => 'error' })]) {
    const errors = [];
    const h = heartbeat(t, { fetchImpl, onError: (error) => { errors.push(error); throw new Error('처리기 오류'); } });
    assert.equal(await h.ping(), false);
    assert.equal(errors.length, 1);
    assert.ok(!errors[0].message.includes('secret'));
  }
});

test('생존 감시 요청·응답 본문 시간 초과, abort 무시에도 반환', async (t) => {
  for (const bodyHang of [false, true]) {
    const errors = [];
    let signal;
    const h = heartbeat(t, { timeoutMs: 15, onError: (error) => errors.push(error), fetchImpl: async (_, options) => {
      signal = options.signal;
      return bodyHang ? { ok: true, text: () => new Promise(() => {}) } : new Promise(() => {});
    } });
    assert.equal(await h.ping(), false);
    assert.equal(signal.aborted, true);
    assert.match(errors[0].message, /시간 초과/);
  }
});

test('생존 감시 stop 뒤 지연된 실패 콜백과 대기 fail은 실행하지 않음', async (t) => {
  let reject;
  let calls = 0;
  let errors = 0;
  const pending = new Promise((_, fail) => { reject = fail; });
  const h = heartbeat(t, { fetchImpl: () => { calls++; return pending; }, onError: () => errors++ });
  const ping = h.ping();
  const fail = h.fail('대기');
  await sleep(0);
  h.stop();
  reject(new Error('늦은 오류'));
  assert.equal(await ping, false);
  assert.equal(await fail, false);
  assert.equal(calls, 1);
  assert.equal(errors, 0);
});

test('IP 첫 응답은 onInitial, 변경만 onChange, 같은 값은 무시', async (t) => {
  let ip = '203.0.113.1';
  const initial = [];
  const changes = [];
  const w = watcher(t, { fetchImpl: async () => ok(' ' + ip + '\n'), onInitial: (v) => initial.push(v), onChange: (...args) => changes.push(args) });
  assert.equal(await w.check(), '203.0.113.1');
  await w.check();
  ip = '203.0.113.2';
  await w.check();
  assert.deepEqual(initial, ['203.0.113.1']);
  assert.deepEqual(changes, [['203.0.113.1', '203.0.113.2']]);
  assert.equal(w.current(), '203.0.113.2');
});

test('IP 소스 fallback은 잘못된 IPv4/HTTP/네트워크 응답을 건너뜀', async (t) => {
  for (const first of ['999.1.1.1', '<html>오류</html>', '127.0.0.1 extra']) {
    const calls = [];
    const errors = [];
    const w = watcher(t, { fetchImpl: async (url) => { calls.push(url); return ok(url.endsWith('/a') ? first : '203.0.113.2'); }, onError: (e) => errors.push(e) });
    assert.equal(await w.check(), '203.0.113.2');
    assert.equal(calls.length, 2);
    assert.equal(errors.length, 0);
  }
});

test('IP 전체 소스 실패는 기존 값을 보존하고 오류 한 번 보고', async (t) => {
  let failed = false;
  const errors = [];
  const w = watcher(t, { fetchImpl: async () => {
    if (failed) throw new Error('연결 실패');
    return ok('203.0.113.1');
  }, onError: (e) => errors.push(e) });
  await w.check();
  failed = true;
  assert.equal(await w.check(), null);
  assert.equal(w.current(), '203.0.113.1');
  assert.equal(errors.length, 1);
});

test('IPv6 표기 차이는 변경이 아니며 zone ID는 거절', async (t) => {
  let ip = '2001:0DB8:0000:0000:0000:0000:0000:0001';
  const changes = [];
  const w = watcher(t, { fetchImpl: async () => ok(ip), onChange: (...args) => changes.push(args) });
  assert.equal(await w.check(), '2001:db8::1');
  ip = '2001:db8::1';
  await w.check();
  assert.equal(changes.length, 0);
  ip = 'fe80::1%eth0';
  assert.equal(await w.check(), null);
  assert.equal(w.current(), '2001:db8::1');
});

test('IP 타임아웃 후 다음 소스 사용 및 본문 타임아웃', async (t) => {
  let signal;
  const w = watcher(t, { timeoutMs: 15, fetchImpl: async (url, options) => {
    if (url.endsWith('/a')) {
      signal = options.signal;
      return { ok: true, text: () => new Promise(() => {}) };
    }
    return ok('203.0.113.3');
  } });
  assert.equal(await w.check(), '203.0.113.3');
  assert.equal(signal.aborted, true);
});

test('IP 주기 요청은 중첩하지 않고 stop 이후 새 요청 차단', async (t) => {
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const w = watcher(t, { intervalSec: 0.01, fetchImpl: async () => {
    calls++; active++; maxActive = Math.max(maxActive, active);
    await sleep(25);
    active--;
    return ok('203.0.113.1');
  } });
  const first = w.check();
  assert.equal(first, w.check());
  await first;
  await sleep(30);
  w.stop();
  const count = calls;
  await sleep(40);
  assert.equal(calls, count);
  assert.equal(maxActive, 1);
  assert.equal(await w.check(), null);
});

test('IP stop 이후 응답은 값 변경/콜백/다음 소스를 실행하지 않음', async (t) => {
  for (const rejectResponse of [false, true]) {
    let resolve, reject;
    const pending = new Promise((pass, fail) => { resolve = pass; reject = fail; });
    let calls = 0;
    let callbacks = 0;
    const w = watcher(t, { fetchImpl: () => { calls++; return pending; }, onInitial: () => callbacks++, onError: () => callbacks++ });
    const check = w.check();
    w.stop();
    if (rejectResponse) reject(new Error('늦은 오류'));
    else resolve(ok('203.0.113.5'));
    assert.equal(await check, null);
    assert.equal(w.current(), null);
    assert.equal(callbacks, 0);
    assert.equal(calls, 1);
  }
});

test('IP 콜백의 예외와 비동기 reject는 격리', async (t) => {
  const w = watcher(t, {
    onInitial: async () => { throw new Error('콜백 실패'); },
    onError: async () => { throw new Error('오류 콜백 실패'); },
  });
  assert.equal(await w.check(), '203.0.113.1');
  await sleep(0);
});

test('빈 IP sources와 잘못된 설정은 외부 요청하지 않음', async (t) => {
  let calls = 0;
  const w = watcher(t, { sources: [], fetchImpl: () => calls++ });
  assert.equal(await w.check(), null);
  const h = heartbeat(t, { intervalSec: 0, fetchImpl: () => calls++ });
  assert.equal(h.enabled, false);
  assert.equal(await h.ping(), false);
  const bad = watcher(t, { sources: ['file:///secret'], fetchImpl: () => calls++ });
  assert.equal(await bad.check(), null);
  assert.equal(calls, 0);
});
