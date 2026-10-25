const labels = {
  buy: '매수', sell: '매도', close: '청산', stop: '손절가 변경',
  error: '오류', kill: '킬 스위치', pause: '일시정지', resume: '재개',
  ops: '운영', skip: '진입 보류', start: '시작',
};
const defaultTypes = ['buy', 'sell', 'close', 'stop', 'error', 'kill', 'pause', 'resume', 'ops'];
const maxTimer = 2147483647;

export function formatEvent(event, { prefix = '[AST]' } = {}) {
  const at = new Date(event.at + 9 * 3600000).toISOString().slice(5, 16).replace('T', ' ');
  const label = Object.hasOwn(labels, event.type) ? labels[event.type] : event.type;
  const text = `${prefix} ${label} · ${at}\n${event.msg}`;
  if (text.length <= 4096) return text;
  // UTF-16 서로게이트 쌍을 중간에서 자르지 않는다.
  return text.slice(0, 4095).replace(/[\uD800-\uDBFF]$/, '') + '…';
}

export function createTelegramNotifier({
  token, chatId, types = defaultTypes, fetchImpl = globalThis.fetch,
  onError = () => {}, minIntervalMs = 1000, maxQueue = 50,
  prefix = '[AST]', timeoutMs = 10000,
} = {}) {
  const queue = [];
  const recentErrors = new Map();
  const timers = new Set();
  const waiters = new Set();
  let closed = false;
  let running = false;
  let reporting = false;
  let cancelDelay;
  let nextAt = 0;
  const botToken = typeof token === 'string' ? token.trim() : '';
  const target = typeof chatId === 'number' && Number.isSafeInteger(chatId) ? String(chatId) :
    typeof chatId === 'string' ? chatId.trim() : '';
  let enabled = Boolean(botToken && target);
  let allowed;

  function report(error) {
    if (closed || reporting) return;
    reporting = true;
    try {
      let message = error instanceof Error ? error.message : String(error);
      if (botToken) {
        message = message.split(botToken).join('[토큰 숨김]');
        message = message.split(encodeURIComponent(botToken)).join('[토큰 숨김]');
      }
      Promise.resolve(onError(new Error(message))).catch(() => {});
    } catch { /* 오류 처리기의 실패도 격리한다. */ }
    finally { reporting = false; }
  }

  try {
    if (!Array.isArray(types) || types.some((type) => typeof type !== 'string') ||
        !Number.isFinite(minIntervalMs) || minIntervalMs < 0 || minIntervalMs > maxTimer ||
        !Number.isSafeInteger(maxQueue) || maxQueue < 1 ||
        !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > maxTimer ||
        typeof prefix !== 'string' || (enabled && typeof fetchImpl !== 'function')) {
      throw new Error('텔레그램 알림 설정이 올바르지 않습니다');
    }
    allowed = new Set(types);
  } catch (error) { enabled = false; report(error); }

  function timer(fn, ms) {
    const handle = setTimeout(() => { timers.delete(handle); fn(); }, ms);
    timers.add(handle);
    if (!waiters.size) handle.unref?.();
    return handle;
  }

  function clear(handle) {
    clearTimeout(handle);
    timers.delete(handle);
  }

  function settle() {
    if (!closed && (running || queue.length)) return;
    for (const done of [...waiters]) done();
  }

  async function delayUntilReady() {
    while (!closed && nextAt > Date.now()) {
      await new Promise((resolve) => {
        const handle = timer(() => { cancelDelay = undefined; resolve(); }, Math.min(nextAt - Date.now(), maxTimer));
        cancelDelay = () => { clear(handle); cancelDelay = undefined; resolve(); };
      });
    }
  }

  async function request(text) {
    const controller = new AbortController();
    let handle;
    const deadline = new Promise((_, reject) => {
      handle = timer(() => {
        reject(new Error(`텔레그램 응답 없음 (${timeoutMs}ms)`));
        controller.abort();
      }, timeoutMs);
    });
    try {
      return await Promise.race([
        deadline,
        (async () => {
          const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id: target, text, link_preview_options: { is_disabled: true } }),
            signal: controller.signal,
          });
          const data = await response.json();
          return { response, data };
        })(),
      ]);
    } finally { clear(handle); }
  }

  async function send(text) {
    for (let attempt = 0; attempt < 2 && !closed; attempt++) {
      await delayUntilReady();
      if (closed) return;
      nextAt = Date.now() + minIntervalMs;
      const { response, data } = await request(text);
      if (closed) return;
      if (response.status === 429 || data?.error_code === 429) {
        const seconds = data?.parameters?.retry_after;
        const retryMs = Number.isFinite(seconds) && seconds >= 0 && seconds <= Number.MAX_SAFE_INTEGER / 1000
          ? seconds * 1000 : 1000;
        nextAt = Math.max(nextAt, Date.now() + retryMs);
        if (attempt === 0) continue;
      }
      if (!response.ok || data?.ok !== true) {
        throw new Error(`텔레그램 전송 실패 (HTTP ${response.status}, API ${data?.error_code ?? '응답 오류'})`);
      }
      return;
    }
  }

  function start() {
    if (running || closed || !queue.length) return;
    running = true;
    Promise.resolve().then(async () => {
      while (!closed && queue.length) {
        await delayUntilReady();
        if (closed) break;
        const item = queue.shift();
        try { await send(item); } catch (error) { report(error); }
      }
    }).catch(report).finally(() => {
      running = false;
      settle();
      if (!closed && queue.length) start();
    });
  }

  function notify(event) {
    if (!enabled || closed) return;
    try {
      if (!event || typeof event.type !== 'string') throw new Error('알림 이벤트 형식이 올바르지 않습니다');
      if (!allowed.has(event.type)) return;
      if (!Number.isFinite(event.at) || typeof event.msg !== 'string') {
        throw new Error('알림 이벤트 시각 또는 메시지가 올바르지 않습니다');
      }
      const text = formatEvent(event, { prefix });
      const now = Date.now();
      for (const [msg, at] of recentErrors) if (now - at >= 60000) recentErrors.delete(msg);
      if (event.type === 'error') {
        if (recentErrors.has(event.msg)) return;
        recentErrors.set(event.msg, now);
      }
      const overflow = queue.length >= maxQueue;
      if (overflow) queue.shift();
      queue.push(text);
      if (overflow) report(new Error('텔레그램 대기열 초과: 가장 오래된 대기 알림을 버렸습니다'));
      start();
    } catch (error) { report(error); }
  }

  function flush(options = {}) {
    if (!enabled || closed || (!running && !queue.length)) return Promise.resolve();
    const limit = options?.timeoutMs;
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 0 || limit > maxTimer)) {
      report(new Error('텔레그램 flush 제한시간이 올바르지 않습니다'));
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let handle;
      const done = () => {
        clear(handle);
        waiters.delete(done);
        if (!waiters.size) for (const pending of timers) pending.unref?.();
        resolve();
      };
      waiters.add(done);
      for (const pending of timers) pending.ref?.();
      if (limit !== undefined) {
        handle = timer(() => {
          report(new Error('텔레그램 flush 제한시간 초과: 미전송 알림이 남아 있습니다'));
          done();
        }, limit);
      }
    });
  }

  function close() {
    closed = true;
    queue.length = 0;
    recentErrors.clear();
    cancelDelay?.();
    settle();
  }

  return { notify, flush, close, get enabled() { return enabled && !closed; } };
}
