export function startHeartbeat({
  url, intervalSec = 60, fetchImpl = globalThis.fetch,
  onError = () => {}, timeoutMs = 10000,
} = {}) {
  let stopped = false;
  let interval;
  let pingTask;
  let tail = Promise.resolve();
  let endpoint;
  let enabled = typeof url === 'string' && Boolean(url.trim());

  function report(message) {
    if (stopped) return;
    try { Promise.resolve(onError(new Error(message))).catch(() => {}); } catch { /* 감시 오류 격리 */ }
  }

  try {
    if (enabled) {
      endpoint = new URL(url.trim());
      if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password ||
          !Number.isFinite(intervalSec) || intervalSec <= 0 || intervalSec * 1000 > 2147483647 ||
          !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647 || typeof fetchImpl !== 'function') {
        throw new Error();
      }
      endpoint.hash = '';
    }
  } catch { enabled = false; report('생존 감시 URL 또는 설정이 올바르지 않습니다'); }

  async function request(failure, message) {
    if (!enabled || stopped) return false;
    const target = new URL(endpoint);
    if (failure) target.pathname = target.pathname.replace(/\/$/, '') + '/fail';
    const controller = new AbortController();
    let timer;
    try {
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('생존 감시 요청 시간 초과'));
          controller.abort();
        }, timeoutMs);
      });
      await Promise.race([deadline, (async () => {
        const response = await fetchImpl(target.href, {
          method: failure ? 'POST' : 'GET', signal: controller.signal,
          ...(failure ? { body: message, headers: { 'content-type': 'text/plain; charset=utf-8' } } : {}),
        });
        if (typeof response.text === 'function') await response.text();
        if (!response.ok) throw new Error('생존 감시 HTTP 요청 실패');
      })()]);
      return !stopped;
    } catch (error) {
      // URL에 포함된 감시 토큰이나 응답 본문은 오류에 노출하지 않는다.
      report(controller.signal.aborted ? '생존 감시 요청 시간 초과' : '생존 감시 요청 실패');
      return false;
    } finally { clearTimeout(timer); }
  }

  function enqueue(failure, message) {
    const task = tail.then(() => request(failure, message));
    tail = task.catch(() => false);
    return tail;
  }

  function ping() {
    if (!enabled || stopped) return Promise.resolve(false);
    if (!pingTask) {
      pingTask = enqueue(false).finally(() => { pingTask = undefined; });
    }
    return pingTask;
  }

  function fail(message) {
    if (!enabled || stopped) return Promise.resolve(false);
    if (typeof message !== 'string') {
      report('생존 감시 실패 메시지는 문자열이어야 합니다');
      return Promise.resolve(false);
    }
    return enqueue(true, message);
  }

  function stop() { stopped = true; clearInterval(interval); }

  if (enabled) {
    void ping();
    interval = setInterval(() => { void ping(); }, intervalSec * 1000);
    interval.unref?.();
  }
  return { ping, fail, stop, get enabled() { return enabled && !stopped; } };
}
