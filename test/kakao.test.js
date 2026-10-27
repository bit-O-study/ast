import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKakaoNotifier, formatKakao, exchangeCode, authorizeUrl, mergeToken } from '../src/notify/kakao.js';
import { buildConfig, publicConfig } from '../src/config.js';

const NOW = Date.UTC(2026, 9, 27, 3);
const baseToken = () => ({ clientId: 'CID', clientSecret: 'SEC', accessToken: 'AT1', accessExpiresAt: NOW + 3600e3, refreshToken: 'RT1', refreshExpiresAt: NOW + 50 * 86400e3 });

// 카카오 응답 흉내. sendStatus: 전송 응답 코드 목록(차례로 사용), refresh: 갱신 응답
function fake({ sendStatus = [200], refresh = { access_token: 'AT2', expires_in: 21599 }, refreshStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, opt) => {
    const body = Object.fromEntries(new URLSearchParams(opt.body.toString()));
    calls.push({ url, auth: opt.headers.authorization, body });
    if (url.endsWith('/oauth/token')) return new Response(JSON.stringify(refresh), { status: refreshStatus });
    const status = sendStatus.length > 1 ? sendStatus.shift() : sendStatus[0];
    return new Response(JSON.stringify(status === 200 ? { result_code: 0 } : { msg: 'this access token does not exist', code: -401 }), { status });
  };
  return { calls, fetchImpl };
}
function setup(opts = {}, token = baseToken()) {
  const f = fake(opts), saved = [], errors = [];
  const n = createKakaoNotifier({ tokenFile: 'x', fetchImpl: f.fetchImpl, now: () => NOW, minIntervalMs: 0,
    load: () => token, save: (_, t) => saved.push(t), onError: (e) => errors.push(e.message) });
  return { n, ...f, saved, errors };
}
const ev = (type, msg = '내용', at = NOW) => ({ type, msg, at });

test('카카오: 메시지 형식과 200자 제한', () => {
  assert.equal(formatKakao(ev('buy', '매수 100원')), '[AST] 매수 · 10-27 12:00\n매수 100원');
  const long = formatKakao(ev('error', '가'.repeat(500)));
  assert.equal(long.length, 200);
  assert.ok(long.endsWith('…'));
  assert.match(authorizeUrl({ clientId: 'CID', redirectUri: 'http://localhost:8790/kakao' }), /scope=talk_message/);
});

test('카카오: 나에게 보내기 요청 형식과 종류 필터', async () => {
  const { n, calls } = setup();
  n.notify(ev('buy', '매수'));
  n.notify(ev('stop', '손절가 변경은 기본 제외'));
  await n.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://kapi.kakao.com/v2/api/talk/memo/default/send');
  assert.equal(calls[0].auth, 'Bearer AT1');
  const tpl = JSON.parse(calls[0].body.template_object);
  assert.equal(tpl.object_type, 'text');
  assert.match(tpl.text, /매수/);
});

test('카카오: 접근 토큰 만료 전 갱신·저장, 새 갱신 토큰으로 교체', async () => {
  const t = { ...baseToken(), accessExpiresAt: NOW + 60e3 };
  const { n, calls, saved } = setup({ refresh: { access_token: 'AT2', expires_in: 21599, refresh_token: 'RT2', refresh_token_expires_in: 5183999 } }, t);
  n.notify(ev('close', '성공'));
  await n.flush();
  assert.deepEqual(calls.map((c) => c.url.split('/').pop()), ['token', 'send']);
  assert.deepEqual(calls[0].body, { grant_type: 'refresh_token', client_id: 'CID', refresh_token: 'RT1', client_secret: 'SEC' });
  assert.equal(calls[1].auth, 'Bearer AT2');
  assert.equal(saved[0].refreshToken, 'RT2');
  assert.equal(saved[0].accessExpiresAt, NOW + 21599e3);
});

test('카카오: 401이면 갱신 후 1회 재시도, 갱신 응답에 refresh_token 없으면 기존 유지', async () => {
  const { n, calls, saved, errors } = setup({ sendStatus: [401, 200] });
  n.notify(ev('sell', '매도'));
  await n.flush();
  assert.deepEqual(calls.map((c) => c.url.split('/').pop()), ['send', 'token', 'send']);
  assert.equal(saved[0].refreshToken, 'RT1');
  assert.deepEqual(errors, []);
});

test('카카오: 갱신 토큰 만료는 알림을 끄고, 오류에 토큰·키를 노출하지 않음', async () => {
  const { n, errors } = setup({ sendStatus: [401], refresh: { error: 'invalid_grant', error_code: 'KOE322' }, refreshStatus: 400 });
  n.notify(ev('kill', '정지'));
  await n.flush();
  assert.equal(n.enabled, false);
  assert.match(errors[0], /다시 로그인/);
  await assert.rejects(n.test(), /꺼져 있습니다/);
  for (const e of errors) for (const secret of ['AT1', 'RT1', 'SEC', 'CID']) assert.ok(!e.includes(secret));
});

test('카카오: 같은 오류는 30분에 한 번, 토큰 파일 없으면 꺼짐', async () => {
  const { n, calls } = setup();
  for (let k = 0; k < 5; k++) n.notify(ev('error', '시세 조회 실패'));
  n.notify(ev('error', '다른 오류'));
  await n.flush();
  assert.equal(calls.length, 2);
  const errors = [];
  const off = createKakaoNotifier({ tokenFile: 'x', load: () => { const e = new Error('없음'); e.code = 'ENOENT'; throw e; }, onError: (e) => errors.push(e.message) });
  assert.equal(off.enabled, false);
  off.notify(ev('buy'));
  assert.match(errors[0], /kakao-login/);
});

test('카카오: 인가 코드 교환과 토큰 병합', async () => {
  const { calls, fetchImpl } = fake({ refresh: { access_token: 'AT', expires_in: 100, refresh_token: 'RT', refresh_token_expires_in: 1000 } });
  const t = await exchangeCode({ clientId: 'CID', redirectUri: 'http://localhost:8790/kakao', code: 'C0DE', fetchImpl, now: () => NOW });
  assert.deepEqual(calls[0].body, { grant_type: 'authorization_code', client_id: 'CID', redirect_uri: 'http://localhost:8790/kakao', code: 'C0DE' });
  assert.deepEqual([t.clientId, t.accessToken, t.refreshToken, t.accessExpiresAt, t.refreshExpiresAt], ['CID', 'AT', 'RT', NOW + 100e3, NOW + 1000e3]);
  assert.equal('clientSecret' in t, false);
  assert.equal(mergeToken(t, { access_token: 'B', expires_in: 1 }, NOW).refreshToken, 'RT');
});

test('카카오: 설정 기본 꺼짐, 잘못된 값 거부, 대시보드 설정에 키 없음', () => {
  assert.equal(buildConfig({}).notifyKakao, 'off');
  assert.equal(buildConfig({ NOTIFY_KAKAO: 'ON' }).notifyKakao, 'on');
  assert.throws(() => buildConfig({ NOTIFY_KAKAO: 'yes' }), /NOTIFY_KAKAO/);
  const pub = JSON.stringify(publicConfig(buildConfig({ NOTIFY_KAKAO: 'on' })));
  assert.ok(!/token"|secret|clientId/i.test(pub.replace('kakaoTokenFile', '')));
});

test('카카오: API 테스트 전송과 꺼진 상태', async () => {
  const { createServer } = await import('../src/server.js');
  const { n, calls } = setup();
  const cfg = buildConfig({ NOTIFY_KAKAO: 'on' });
  const serve = async (notifier, fn) => {
    const server = createServer({ cfg, trader: {}, client: null, store: {}, notifier }).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    try { await fn(`http://127.0.0.1:${server.address().port}/api/notify`); } finally { server.close(); }
  };
  await serve(n, async (url) => {
    assert.deepEqual(await (await fetch(url)).json(), { kakao: { configured: true, enabled: true } });
    assert.equal((await fetch(url, { method: 'POST' })).status, 200);
    assert.match(JSON.parse(calls[0].body.template_object).text, /테스트/);
  });
  await serve(null, async (url) => assert.equal((await fetch(url, { method: 'POST' })).status, 409));
});
