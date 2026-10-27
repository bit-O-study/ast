import fs from 'node:fs';
import path from 'node:path';

// 카카오톡 "나에게 보내기" 알림. 인터페이스는 텔레그램 알림(C6)과 같다: notify, flush, close, enabled
// 키·토큰은 로그인 스크립트(scripts/kakao-login.mjs)가 만든 토큰 파일에만 둔다 (data/ 아래, 커밋 금지).
export const KAKAO_AUTH = 'https://kauth.kakao.com';
export const KAKAO_API = 'https://kapi.kakao.com';
export const KAKAO_DEFAULT_TYPES = ['buy', 'sell', 'close', 'error', 'kill', 'verify'];
const MAX_TEXT = 200; // 기본 텍스트 템플릿 글자 수 제한
const ERROR_REPEAT_MS = 30 * 60e3; // 같은 오류는 30분에 한 번만
const REFRESH_EARLY_MS = 5 * 60e3;

const labels = {
  buy: '매수', sell: '매도', close: '청산', stop: '손절가 변경', error: '오류', kill: '킬 스위치',
  pause: '일시정지', resume: '재개', ops: '운영', start: '시작', verify: '실시간 검증', config: '설정 변경', test: '테스트',
};

export function formatKakao(event, { prefix = '[AST]' } = {}) {
  const at = new Date(event.at + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' ');
  const coin = typeof event.market === 'string' ? ` ${event.market.replace('KRW-', '')}` : '';
  const text = `${prefix}${coin} ${labels[event.type] ?? event.type} · ${at}\n${event.msg}`;
  if (text.length <= MAX_TEXT) return text;
  return text.slice(0, MAX_TEXT - 1).replace(/[\uD800-\uDBFF]$/, '') + '…';
}

export function authorizeUrl({ clientId, redirectUri }) {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'talk_message' });
  return `${KAKAO_AUTH}/oauth/authorize?${q}`;
}

async function tokenRequest(fetchImpl, params, timeoutMs) {
  const res = await fetchImpl(`${KAKAO_AUTH}/oauth/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams(params), signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const e = new Error(`카카오 토큰 발급 실패 (HTTP ${res.status}${data.error_code ? `, ${data.error_code}` : data.error ? `, ${data.error}` : ''})`);
    e.fatal = data.error === 'invalid_grant' || data.error === 'invalid_client';
    throw e;
  }
  return data;
}

// 토큰 응답을 저장 형식으로 바꾼다. 갱신 응답에 refresh_token이 없으면 기존 값을 유지
export function mergeToken(prev, data, now) {
  return {
    ...prev,
    accessToken: data.access_token,
    accessExpiresAt: now + (data.expires_in ?? 0) * 1000,
    refreshToken: data.refresh_token ?? prev.refreshToken,
    refreshExpiresAt: data.refresh_token ? now + (data.refresh_token_expires_in ?? 0) * 1000 : prev.refreshExpiresAt,
    updatedAt: now,
  };
}

// 로그인 스크립트: 인가 코드를 토큰으로 바꾼다
export async function exchangeCode({ clientId, clientSecret, redirectUri, code, fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 10000 }) {
  const data = await tokenRequest(fetchImpl, {
    grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirectUri, code, ...(clientSecret ? { client_secret: clientSecret } : {}),
  }, timeoutMs);
  return mergeToken({ clientId, ...(clientSecret ? { clientSecret } : {}) }, data, now());
}

export function readTokenFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeTokenFile(file, token) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(token, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function createKakaoNotifier({
  tokenFile, types = KAKAO_DEFAULT_TYPES, fetchImpl = globalThis.fetch, now = Date.now,
  onError = () => {}, minIntervalMs = 1000, maxQueue = 50, prefix = '[AST]', timeoutMs = 10000,
  load = readTokenFile, save = writeTokenFile,
} = {}) {
  const queue = [], recentErrors = new Map(), waiters = new Set();
  const allowed = new Set(types);
  let token = null, closed = false, running = false, enabled = false;

  // 오류 메시지에 토큰·키가 섞이지 않게 가린다
  const report = (error) => {
    let msg = error instanceof Error ? error.message : String(error);
    for (const secret of [token?.accessToken, token?.refreshToken, token?.clientSecret, token?.clientId]) {
      if (secret) msg = msg.split(secret).join('[숨김]');
    }
    try { Promise.resolve(onError(new Error(msg))).catch(() => {}); } catch { /* 오류 처리기 실패도 격리 */ }
  };

  try {
    token = load(tokenFile);
    if (!token?.clientId || !token?.refreshToken) throw new Error('카카오 토큰 파일에 clientId·refreshToken이 없습니다');
    if (typeof fetchImpl !== 'function') throw new Error('fetch가 없습니다');
    enabled = true;
  } catch (e) {
    report(new Error(`카카오톡 알림 꺼짐: ${e.code === 'ENOENT' ? '토큰 파일이 없습니다. scripts/kakao-login.mjs로 로그인하세요' : e.message}`));
  }

  async function refresh() {
    try {
      const data = await tokenRequest(fetchImpl, {
        grant_type: 'refresh_token', client_id: token.clientId, refresh_token: token.refreshToken,
        ...(token.clientSecret ? { client_secret: token.clientSecret } : {}),
      }, timeoutMs);
      token = mergeToken(token, data, now());
      save(tokenFile, token);
    } catch (e) {
      // 갱신 토큰이 만료·취소되면 다시 로그인해야 한다
      if (e.fatal) { enabled = false; queue.length = 0; throw new Error('카카오 로그인이 만료됐습니다. scripts/kakao-login.mjs로 다시 로그인하세요'); }
      throw e;
    }
  }

  async function post(text) {
    const template = { object_type: 'text', text, link: {} };
    return fetchImpl(`${KAKAO_API}/v2/api/talk/memo/default/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.accessToken}`, 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({ template_object: JSON.stringify(template) }), signal: AbortSignal.timeout(timeoutMs),
    });
  }

  async function send(text) {
    if (!token.accessToken || now() > token.accessExpiresAt - REFRESH_EARLY_MS) await refresh();
    let res = await post(text);
    if (res.status === 401) { await refresh(); res = await post(text); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.result_code !== 0) throw new Error(`카카오톡 전송 실패 (HTTP ${res.status}${data.code ? `, ${data.code}` : ''})`);
  }

  const settle = () => { if (!running && !queue.length) for (const done of [...waiters]) done(); };

  function start() {
    if (running || closed || !queue.length) return;
    running = true;
    (async () => {
      while (!closed && enabled && queue.length) {
        const text = queue.shift();
        try { await send(text); } catch (e) { report(e); }
        if (queue.length && minIntervalMs) await new Promise((r) => setTimeout(r, minIntervalMs).unref?.());
      }
    })().catch(report).finally(() => { running = false; settle(); });
  }

  function notify(event) {
    if (!enabled || closed) return;
    try {
      if (!event || !allowed.has(event.type) || typeof event.msg !== 'string' || !Number.isFinite(event.at)) return;
      if (event.type === 'error') {
        const t = now();
        for (const [m, at] of recentErrors) if (t - at >= ERROR_REPEAT_MS) recentErrors.delete(m);
        if (recentErrors.has(event.msg)) return;
        recentErrors.set(event.msg, t);
      }
      if (queue.length >= maxQueue) { queue.shift(); report(new Error('카카오톡 대기열 초과: 가장 오래된 알림을 버렸습니다')); }
      queue.push(formatKakao(event, { prefix }));
      start();
    } catch (e) { report(e); }
  }

  // 대기 중인 알림을 다 보낼 때까지 기다린다 (테스트·종료용)
  function flush({ timeoutMs: limit } = {}) {
    if (!running && !queue.length) return Promise.resolve();
    return new Promise((resolve) => {
      let handle;
      const done = () => { clearTimeout(handle); waiters.delete(done); resolve(); };
      waiters.add(done);
      if (Number.isFinite(limit)) handle = setTimeout(done, limit);
    });
  }

  function close() { closed = true; queue.length = 0; settle(); }

  // 즉시 1건 전송하고 결과를 돌려준다 (대시보드 테스트 버튼). 실패 사유는 키·토큰을 가린 문구로 던진다
  async function test(msg = '카카오톡 알림 테스트입니다') {
    if (!enabled || closed) throw new Error('카카오톡 알림이 꺼져 있습니다');
    try { await send(formatKakao({ type: 'test', at: now(), msg }, { prefix })); } catch (e) {
      let m = e.message;
      for (const secret of [token?.accessToken, token?.refreshToken, token?.clientSecret, token?.clientId]) if (secret) m = m.split(secret).join('[숨김]');
      throw new Error(m);
    }
  }

  return { notify, flush, close, test, get enabled() { return enabled && !closed; } };
}
