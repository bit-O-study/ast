import { randomUUID } from 'node:crypto';
import NodeWebSocket from 'ws';

const noop = () => {};

// 숫자 토큰만 변환하여 큰 체결 ID를 반올림 없이 보존한다.
function parseMessage(text) {
  const safe = text.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (token) => {
    if (token[0] !== '"' && /^-?(?:0|[1-9]\d*)$/.test(token) && !Number.isSafeInteger(Number(token))) {
      return JSON.stringify(token);
    }
    return token;
  });
  return JSON.parse(safe);
}

async function decode(data) {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data.text();
  throw new Error('지원하지 않는 체결 메시지 형식');
}

export function createTradeStream({
  markets, onTrade = noop, onStatus = noop,
  WebSocketImpl = globalThis.WebSocket ?? NodeWebSocket,
  url = 'wss://ws-api.bithumb.com/websocket/v1', staleMs = 60000,
  backoffMs = [1000, 2000, 5000, 10000, 30000], timeoutMs = 10000,
  pingIntervalMs = 30000,
} = {}) {
  const validDuration = (n) => Number.isFinite(n) && n > 0 && n <= 2147483647;
  if (!Array.isArray(markets) || markets.some((m) => typeof m !== 'string' || !/^[A-Z0-9]+-[A-Z0-9]+$/.test(m)) ||
      !validDuration(staleMs) || !validDuration(timeoutMs) || !validDuration(pingIntervalMs) ||
      !Array.isArray(backoffMs) || !backoffMs.length || !backoffMs.every(validDuration) ||
      typeof WebSocketImpl !== 'function' || typeof onTrade !== 'function' || typeof onStatus !== 'function' ||
      !['ws:', 'wss:'].includes(new URL(url).protocol)) {
    throw new Error('실시간 체결가 연결 설정이 올바르지 않습니다');
  }
  const codes = [...new Set(markets)];
  const subscribed = new Set(codes);
  const latest = new Map();
  const seen = new Map();
  let stopped = false;
  let state = 'closed';
  let current;
  let retryTimer;
  let retryIndex = 0;
  let connectedOnce = false;

  function callback(fn, ...args) {
    if (stopped) return;
    try { Promise.resolve(fn(...args)).catch(noop); } catch { /* 수신 콜백 오류 격리 */ }
  }

  function emit(status, info = {}) {
    state = status;
    callback(onStatus, status, info);
  }

  function active(ctx) { return !stopped && ctx === current && ctx.active; }

  function clearTimers(ctx) {
    if (!ctx) return;
    for (const key of ['connectTimer', 'staleTimer']) {
      if (ctx[key] !== undefined) clearTimeout(ctx[key]);
      ctx[key] = undefined;
    }
    if (ctx.pingTimer !== undefined) clearInterval(ctx.pingTimer);
    ctx.pingTimer = undefined;
  }

  function shutdown(ctx) {
    clearTimers(ctx);
    if (!ctx?.socket) return;
    try {
      if (typeof ctx.socket.terminate === 'function') ctx.socket.terminate();
      else ctx.socket.close();
    } catch { /* 이미 닫힌 연결 */ }
  }

  function scheduleRetry() {
    if (stopped || retryTimer) return;
    const delay = backoffMs[Math.min(retryIndex++, backoffMs.length - 1)];
    retryTimer = setTimeout(() => { retryTimer = undefined; connect(); }, delay);
    retryTimer.unref?.();
  }

  function fail(ctx, status, info) {
    if (!active(ctx)) return;
    ctx.active = false;
    clearTimers(ctx);
    emit(status, info);
    shutdown(ctx);
    scheduleRetry();
  }

  function received(ctx) {
    if (!active(ctx)) return;
    if (ctx.staleTimer !== undefined) clearTimeout(ctx.staleTimer);
    ctx.staleTimer = setTimeout(() => { ctx.staleTimer = undefined; fail(ctx, 'stale', { reason: '시세 연결 응답 지연' }); }, staleMs);
    ctx.staleTimer.unref?.();
  }

  function bind(ctx, name, handler) {
    if (typeof ctx.socket.addEventListener === 'function') {
      ctx.socket.addEventListener(name, handler);
      ctx.cleanup.push(() => ctx.socket.removeEventListener(name, handler));
    } else {
      ctx.socket.on(name, handler);
      ctx.cleanup.push(() => ctx.socket.off(name, handler));
    }
  }

  function process(ctx, text) {
    if (!active(ctx)) return;
    let row;
    try { row = parseMessage(text); } catch { return; }
    if (!row || typeof row !== 'object') return;
    if (row.error) {
      fail(ctx, 'closed', { reason: '체결가 구독 요청 거절' });
      return;
    }
    if (row.type !== 'trade' || !subscribed.has(row.code) ||
        !Number.isFinite(row.trade_price) || row.trade_price <= 0 ||
        !Number.isFinite(row.trade_volume) || row.trade_volume < 0 ||
        !Number.isSafeInteger(row.trade_timestamp) || row.trade_timestamp < 0) return;
    const id = row.sequential_id;
    if (!(typeof id === 'string' && /^\d+$/.test(id)) && !(Number.isSafeInteger(id) && id >= 0)) return;
    const key = `${row.code}:${id}`;
    if (seen.has(key)) return;
    seen.set(key, true);
    if (seen.size > 1000) seen.delete(seen.keys().next().value);
    const trade = { market: row.code, price: row.trade_price, volume: row.trade_volume, at: row.trade_timestamp };
    const previous = latest.get(trade.market);
    if (!previous || trade.at >= previous.at) latest.set(trade.market, { ...trade });
    callback(onTrade, trade);
  }

  function connect() {
    if (stopped || !codes.length) return;
    const ctx = { active: true, socket: null, cleanup: [], chain: Promise.resolve() };
    current = ctx;
    try {
      ctx.socket = new WebSocketImpl(url);
      // ws는 error 리스너가 없으면 프로세스를 종료시킬 수 있다.
      if (typeof ctx.socket.on === 'function') ctx.socket.on('error', noop);
      try { ctx.socket.binaryType = 'arraybuffer'; } catch {}
      bind(ctx, 'open', () => {
        if (!active(ctx)) { shutdown(ctx); return; }
        if (ctx.connectTimer !== undefined) clearTimeout(ctx.connectTimer);
        ctx.connectTimer = undefined;
        try {
          ctx.socket.send(JSON.stringify([
            { ticket: `ast-${randomUUID()}` },
            { type: 'trade', codes, isOnlyRealtime: true },
            { format: 'DEFAULT' },
          ]));
        } catch { fail(ctx, 'closed', { reason: '체결가 구독 전송 실패' }); return; }
        retryIndex = 0;
        received(ctx);
        ctx.pingTimer = setInterval(() => {
          if (!active(ctx)) return;
          try {
            if (typeof ctx.socket.ping === 'function') ctx.socket.ping();
            else ctx.socket.send('PING');
          } catch { fail(ctx, 'closed', { reason: '체결가 연결 유지 실패' }); }
        }, pingIntervalMs);
        ctx.pingTimer.unref?.();
        const reconnect = connectedOnce;
        connectedOnce = true;
        emit('open', { reconnect });
      });
      bind(ctx, 'message', (event) => {
        if (!active(ctx)) return;
        received(ctx);
        const data = event && typeof event === 'object' && 'data' in event ? event.data : event;
        // Blob 비동기 디코딩으로 수신 순서가 바뀌지 않도록 직렬화한다.
        ctx.chain = ctx.chain.then(async () => {
          if (active(ctx)) process(ctx, await decode(data));
        }).catch(noop);
      });
      bind(ctx, 'close', (event, reason) => {
        const code = typeof event === 'number' ? event : event?.code;
        const message = typeof event === 'number' ? String(reason ?? '') : String(event?.reason ?? '');
        fail(ctx, 'closed', { code, reason: message });
        for (const cleanup of ctx.cleanup.splice(0)) cleanup();
      });
      bind(ctx, 'error', () => fail(ctx, 'closed', { reason: '체결가 연결 오류' }));
      if (typeof ctx.socket.on === 'function') {
        const pong = () => received(ctx);
        ctx.socket.on('pong', pong);
        ctx.cleanup.push(() => ctx.socket.off('pong', pong));
      }
      ctx.connectTimer = setTimeout(() => { ctx.connectTimer = undefined; fail(ctx, 'closed', { reason: '체결가 연결 시간 초과' }); }, timeoutMs);
      ctx.connectTimer.unref?.();
    } catch { fail(ctx, 'closed', { reason: '체결가 연결 시작 실패' }); }
  }

  function close() {
    if (stopped) return;
    stopped = true;
    state = 'closed';
    if (retryTimer !== undefined) clearTimeout(retryTimer);
    retryTimer = undefined;
    if (current) {
      current.active = false;
      shutdown(current);
    }
  }

  // 생성자 반환 전에 콜백이 실행되지 않도록 연결 시작을 미룬다.
  queueMicrotask(connect);
  return {
    close,
    lastPrice: (market) => latest.get(market)?.price ?? null,
    lastAt: (market) => latest.get(market)?.at ?? null,
    status: () => state,
  };
}
