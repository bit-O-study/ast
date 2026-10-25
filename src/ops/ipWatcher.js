import { isIP } from 'node:net';

export function createIpWatcher({
  intervalSec = 300, sources = ['https://api.ipify.org', 'https://ifconfig.me/ip'],
  fetchImpl = globalThis.fetch, onInitial = () => {}, onChange = () => {},
  onError = () => {}, timeoutMs = 10000,
} = {}) {
  let stopped = false;
  let interval;
  let inFlight;
  let value = null;
  let urls = [];

  function report(message) {
    if (stopped) return;
    try { Promise.resolve(onError(new Error(message))).catch(() => {}); } catch { /* 감시 오류 격리 */ }
  }

  function callback(fn, ...args) {
    if (stopped) return;
    try {
      Promise.resolve(fn(...args)).catch(() => report('IP 감시 콜백 처리 실패'));
    } catch { report('IP 감시 콜백 처리 실패'); }
  }

  try {
    if (!Array.isArray(sources) || !Number.isFinite(intervalSec) || intervalSec <= 0 || intervalSec * 1000 > 2147483647 ||
        !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647 || typeof fetchImpl !== 'function') {
      throw new Error();
    }
    urls = sources.map((source) => {
      const url = new URL(source);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      return url.href;
    });
  } catch { stopped = true; /* 아래에서 설정 오류만 한 번 보고 */
    try { Promise.resolve(onError(new Error('IP 감시 설정이 올바르지 않습니다'))).catch(() => {}); } catch {}
  }

  async function read(source) {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        new Promise((_, reject) => {
          timer = setTimeout(() => { reject(new Error('IP 조회 시간 초과')); controller.abort(); }, timeoutMs);
        }),
        (async () => {
          const response = await fetchImpl(source, { signal: controller.signal });
          if (!response.ok) throw new Error('IP 조회 HTTP 오류');
          const ip = (await response.text()).trim();
          const family = isIP(ip);
          if (!family || ip.includes('%')) throw new Error('IP 응답 형식 오류');
          return family === 6 ? new URL(`http://[${ip}]/`).hostname.slice(1, -1) : ip;
        })(),
      ]);
    } finally { clearTimeout(timer); }
  }

  async function run() {
    for (const source of urls) {
      if (stopped) return null;
      try {
        const next = await read(source);
        if (stopped) return null;
        const previous = value;
        value = next;
        if (previous === null) callback(onInitial, next);
        else if (previous !== next) callback(onChange, previous, next);
        return next;
      } catch { /* 다음 소스로 재시도 */ }
    }
    if (urls.length) report('공인 IP 조회 실패: 모든 소스에 연결할 수 없거나 응답이 올바르지 않습니다');
    return null;
  }

  function check() {
    if (stopped || !urls.length) return Promise.resolve(null);
    if (!inFlight) inFlight = run().finally(() => { inFlight = undefined; });
    return inFlight;
  }

  function stop() { stopped = true; clearInterval(interval); }
  if (!stopped && urls.length) {
    void check();
    interval = setInterval(() => { void check(); }, intervalSec * 1000);
    interval.unref?.();
  }
  return { check, current: () => value, stop };
}
