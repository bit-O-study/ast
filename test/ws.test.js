import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createTradeStream } from '../src/bithumb/ws.js';

const drain = () => new Promise((resolve) => setImmediate(resolve));
const trade = (id = 1, extra = {}) => ({ type: 'trade', code: 'KRW-BTC', trade_price: 100, trade_volume: 2, trade_timestamp: 1000, sequential_id: id, ...extra });

function setup(t, options = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const sockets = [];
  const events = [];
  const trades = [];
  class FakeSocket extends EventEmitter {
    constructor(url) { super(); this.url = url; this.sent = []; this.ended = false; this.pings = 0; sockets.push(this); }
    send(data) { this.sent.push(data); }
    ping() { this.pings++; }
    open() { this.emit('open'); }
    message(data) { this.emit('message', data); }
    disconnect(code = 1006, reason = '끊김') { this.emit('close', code, Buffer.from(reason)); }
    terminate() { this.ended = true; this.emit('close', 1006, Buffer.from('정리')); }
  }
  const stream = createTradeStream({ markets: ['KRW-BTC'], WebSocketImpl: FakeSocket,
    onTrade: (v) => trades.push(v), onStatus: (status, info) => events.push({ status, info }),
    staleMs: 60000, ...options });
  t.after(() => stream.close());
  return { stream, sockets, events, trades, FakeSocket };
}

test('연결 시 대문자 종목·실시간 전용 구독 및 초기 상태', async (t) => {
  const f = setup(t, { markets: ['KRW-BTC', 'KRW-ETH', 'KRW-BTC'] });
  assert.equal(f.stream.status(), 'closed');
  assert.equal(f.stream.lastPrice('KRW-BTC'), null);
  await drain();
  f.sockets[0].open();
  const request = JSON.parse(f.sockets[0].sent[0]);
  assert.match(request[0].ticket, /^ast-/);
  assert.deepEqual(request[1], { type: 'trade', codes: ['KRW-BTC', 'KRW-ETH'], isOnlyRealtime: true });
  assert.deepEqual(request[2], { format: 'DEFAULT' });
  assert.equal(f.stream.status(), 'open');
  assert.deepEqual(f.events, [{ status: 'open', info: { reconnect: false } }]);
});

test('문자열·Buffer·Blob·ArrayBuffer·뷰를 수신 순서대로 변환', async (t) => {
  const f = setup(t);
  await drain(); f.sockets[0].open();
  const text = (id) => JSON.stringify(trade(id));
  const bytes = new TextEncoder().encode(text(4));
  const sliced = Buffer.from('xx' + text(5) + 'yy');
  for (const data of [text(1), Buffer.from(text(2)), new Blob([text(3)]), bytes.buffer, new Uint8Array(sliced.buffer, sliced.byteOffset + 2, sliced.length - 4)]) {
    f.sockets[0].message(data);
  }
  await drain();
  assert.equal(f.trades.length, 5);
  assert.deepEqual(f.trades[0], { market: 'KRW-BTC', price: 100, volume: 2, at: 1000 });
  assert.equal(f.stream.lastPrice('KRW-BTC'), 100);
  assert.equal(f.stream.lastAt('KRW-BTC'), 1000);
});

test('큰 정수 체결 ID를 반올림 없이 구분하며 중복만 제거', async (t) => {
  const f = setup(t);
  await drain(); f.sockets[0].open();
  const raw = (id) => JSON.stringify(trade()).replace('"sequential_id":1', '"sequential_id":' + id);
  f.sockets[0].message(raw('17259299343730000'));
  f.sockets[0].message(raw('17259299343730001'));
  f.sockets[0].message(raw('17259299343730000'));
  await drain();
  assert.equal(f.trades.length, 2);
});

test('종목별 역순 체결은 콜백만 전달하고 최신 캐시는 되돌리지 않음', async (t) => {
  const f = setup(t, { markets: ['KRW-BTC', 'KRW-ETH'] });
  await drain(); f.sockets[0].open();
  for (const row of [trade(1, { trade_price: 200, trade_timestamp: 2000 }), trade(2), trade(1, { code: 'KRW-ETH', trade_price: 50 })]) f.sockets[0].message(JSON.stringify(row));
  await drain();
  assert.equal(f.trades.length, 3);
  assert.equal(f.stream.lastPrice('KRW-BTC'), 200);
  assert.equal(f.stream.lastAt('KRW-BTC'), 2000);
  assert.equal(f.stream.lastPrice('KRW-ETH'), 50);
});

test('최근 1000개만 중복 기억하고 재연결 후에도 중복 제거', async (t) => {
  const f = setup(t);
  await drain(); f.sockets[0].open();
  for (let id = 1; id <= 1001; id++) f.sockets[0].message(JSON.stringify(trade(id)));
  await drain();
  assert.equal(f.trades.length, 1001);
  f.sockets[0].disconnect();
  t.mock.timers.tick(1000);
  f.sockets[1].open();
  f.sockets[1].message(JSON.stringify(trade(1001)));
  f.sockets[1].message(JSON.stringify(trade(1)));
  await drain();
  assert.equal(f.trades.length, 1002);
});

test('파싱 오류·다른 종목·유효하지 않은 가격·시각·ID는 무시', async (t) => {
  const f = setup(t);
  await drain(); f.sockets[0].open();
  const rows = [null, [], { status: 'UP' }, trade(1, { code: 'KRW-XRP' }), trade(1, { trade_price: -1 }),
    trade(1, { trade_volume: -1 }), trade(1, { trade_timestamp: 1.5 }), trade(null), trade(1, { type: 'ticker' })];
  for (const row of rows) f.sockets[0].message(JSON.stringify(row));
  f.sockets[0].message('bad json');
  f.sockets[0].message({ unsupported: true });
  await drain();
  assert.equal(f.trades.length, 0);
  f.sockets[0].message(JSON.stringify(trade(1)));
  await drain();
  assert.equal(f.trades.length, 1);
});

test('끊김은 단계별 백오프, 상한 반복, 성공 후 초기화와 재구독', async (t) => {
  const f = setup(t, { backoffMs: [1000, 2000], timeoutMs: 10000 });
  await drain();
  f.sockets[0].disconnect();
  t.mock.timers.tick(999); assert.equal(f.sockets.length, 1);
  t.mock.timers.tick(1); assert.equal(f.sockets.length, 2);
  f.sockets[1].disconnect();
  t.mock.timers.tick(1999); assert.equal(f.sockets.length, 2);
  t.mock.timers.tick(1); assert.equal(f.sockets.length, 3);
  f.sockets[2].disconnect();
  t.mock.timers.tick(2000); assert.equal(f.sockets.length, 4);
  f.sockets[3].open();
  f.sockets[3].disconnect();
  t.mock.timers.tick(1000); assert.equal(f.sockets.length, 5);
  f.sockets[4].open();
  assert.equal(f.sockets[4].sent.length, 1);
  assert.deepEqual(f.events.at(-1), { status: 'open', info: { reconnect: true } });
});

test('메시지가 없으면 stale, PONG은 연결 신선도만 갱신', async (t) => {
  const f = setup(t, { staleMs: 100, pingIntervalMs: 50 });
  await drain(); f.sockets[0].open();
  t.mock.timers.tick(50);
  assert.equal(f.sockets[0].pings, 1);
  f.sockets[0].emit('pong');
  t.mock.timers.tick(99);
  assert.equal(f.stream.status(), 'open');
  assert.equal(f.stream.lastAt('KRW-BTC'), null);
  t.mock.timers.tick(1);
  assert.equal(f.stream.status(), 'stale');
  assert.equal(f.sockets[0].ended, true);
  t.mock.timers.tick(1000);
  assert.equal(f.sockets.length, 2);
});

test('하나의 종목만 체결되어도 연결은 유지, 다른 종목 lastAt은 별도', async (t) => {
  const f = setup(t, { markets: ['KRW-BTC', 'KRW-ETH'], staleMs: 100 });
  await drain(); f.sockets[0].open();
  t.mock.timers.tick(90);
  f.sockets[0].message(JSON.stringify(trade(1)));
  await drain();
  t.mock.timers.tick(90);
  assert.equal(f.stream.status(), 'open');
  assert.equal(f.stream.lastAt('KRW-ETH'), null);
});

test('연결 수립이 끝나지 않으면 10초 제한 후 재연결', async (t) => {
  const f = setup(t);
  await drain();
  t.mock.timers.tick(10000);
  assert.equal(f.sockets[0].ended, true);
  assert.match(f.events[0].info.reason, /시간 초과/);
  t.mock.timers.tick(1000);
  assert.equal(f.sockets.length, 2);
});

test('error와 close가 연속 발생해도 재연결은 하나만 예약', async (t) => {
  const f = setup(t);
  await drain(); f.sockets[0].open();
  f.sockets[0].emit('error', new Error('network'));
  f.sockets[0].disconnect();
  t.mock.timers.tick(1000);
  assert.equal(f.sockets.length, 2);
  assert.equal(f.events.filter((e) => e.status === 'closed').length, 1);
});

test('명시적 close는 재연결·타이머·늦은 체결을 모두 차단', async (t) => {
  const f = setup(t);
  await drain(); f.sockets[0].open();
  f.sockets[0].disconnect();
  const count = f.events.length;
  f.stream.close(); f.stream.close();
  f.sockets[0].message(JSON.stringify(trade(1)));
  t.mock.timers.tick(100000);
  await drain();
  assert.equal(f.sockets.length, 1);
  assert.equal(f.events.length, count);
  assert.equal(f.trades.length, 0);
  assert.equal(f.stream.status(), 'closed');
});

test('생성 직후 close와 빈 종목 목록은 연결 자체를 시작하지 않음', async (t) => {
  const f = setup(t);
  f.stream.close();
  const empty = createTradeStream({ markets: [], WebSocketImpl: f.FakeSocket });
  t.after(() => empty.close());
  await drain();
  assert.equal(f.sockets.length, 0);
});

test('폐기된 연결의 늦은 Blob 완료가 새 연결의 캐시를 덮어쓰지 않음', async (t) => {
  const f = setup(t);
  await drain(); f.sockets[0].open();
  let resolve;
  class SlowBlob extends Blob { text() { return new Promise((r) => { resolve = r; }); } }
  f.sockets[0].message(new SlowBlob([]));
  await drain();
  f.sockets[0].disconnect();
  t.mock.timers.tick(1000); f.sockets[1].open();
  f.sockets[1].message(JSON.stringify(trade(2, { trade_price: 200 })));
  resolve(JSON.stringify(trade(1)));
  await drain();
  assert.equal(f.stream.lastPrice('KRW-BTC'), 200);
  assert.equal(f.trades.length, 1);
});

test('사용자 콜백 오류·reject는 격리하고 캐시 변조도 방지', async (t) => {
  const f = setup(t, { onStatus: async () => { throw new Error('status'); }, onTrade: (v) => { v.price = -1; throw new Error('trade'); } });
  await drain(); f.sockets[0].open();
  f.sockets[0].message(JSON.stringify(trade()));
  await drain();
  assert.equal(f.stream.lastPrice('KRW-BTC'), 100);
});

test('구독 거절·send 실패는 closed 후 재연결', async (t) => {
  const f = setup(t);
  await drain();
  f.sockets[0].send = () => { throw new Error('send'); };
  f.sockets[0].open();
  assert.equal(f.stream.status(), 'closed');
  t.mock.timers.tick(1000); f.sockets[1].open();
  f.sockets[1].message('{"error":{"name":"INVALID_AUTH"}}');
  await drain();
  assert.equal(f.stream.status(), 'closed');
});

test('native EventTarget WebSocket 우선 선택 및 PING 문자열 유지', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
  const sockets = [];
  class NativeFake extends EventTarget {
    constructor() { super(); this.sent = []; sockets.push(this); }
    send(data) { this.sent.push(data); }
    close() { this.dispatchEvent(new Event('close')); }
  }
  Object.defineProperty(globalThis, 'WebSocket', { value: NativeFake, configurable: true });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'WebSocket', previous); else delete globalThis.WebSocket; });
  const stream = createTradeStream({ markets: ['KRW-BTC'] });
  t.after(() => stream.close());
  await drain();
  sockets[0].dispatchEvent(new Event('open'));
  t.mock.timers.tick(30000);
  assert.equal(sockets[0].sent[1], 'PING');
  const event = Object.assign(new Event('message'), { data: JSON.stringify(trade()) });
  sockets[0].dispatchEvent(event);
  await drain();
  assert.equal(stream.lastPrice('KRW-BTC'), 100);
});

test('잘못된 설정은 연결 전 거절', () => {
  assert.throws(() => createTradeStream({ markets: ['krw-btc'] }), /설정/);
  assert.throws(() => createTradeStream({ markets: ['KRW-BTC'], backoffMs: [] }), /설정/);
  assert.throws(() => createTradeStream({ markets: ['KRW-BTC'], staleMs: 0 }), /설정/);
});

test('WebSocket 생성 실패도 백오프 후 다시 시도', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let attempts = 0;
  const states = [];
  class BrokenSocket { constructor() { attempts++; throw new Error('생성 실패'); } }
  const stream = createTradeStream({ markets: ['KRW-BTC'], WebSocketImpl: BrokenSocket, onStatus: (s) => states.push(s) });
  t.after(() => stream.close());
  await drain();
  assert.equal(attempts, 1);
  t.mock.timers.tick(1000);
  assert.equal(attempts, 2);
  t.mock.timers.tick(2000);
  assert.equal(attempts, 3);
  stream.close();
  t.mock.timers.tick(100000);
  assert.equal(attempts, 3);
  assert.deepEqual(states, ['closed', 'closed', 'closed']);
});

test('onStatus에서 즉시 종료해도 재연결이나 후속 콜백 없음', async (t) => {
  let stream;
  const f = setup(t, { onStatus: () => stream.close() });
  stream = f.stream;
  await drain(); f.sockets[0].open();
  t.mock.timers.tick(100000);
  assert.equal(f.sockets.length, 1);
  assert.equal(f.stream.status(), 'closed');
});
