import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildToken, toQueryString } from '../src/bithumb/auth.js';
import { BithumbClient } from '../src/bithumb/client.js';

const decode = (token) => token.split('.').slice(0, 2).map((p) => JSON.parse(Buffer.from(p, 'base64url').toString()));

test('JWT 서명은 HS256, query_hash는 쿼리 문자열의 SHA512', () => {
  const token = buildToken('AK', 'SECRET', 'market=KRW-BTC', 1700000000000, 'n-1');
  const [head, body] = decode(token);
  assert.deepEqual(head, { alg: 'HS256', typ: 'JWT' });
  assert.equal(body.access_key, 'AK');
  assert.equal(body.timestamp, 1700000000000);
  assert.equal(body.query_hash, crypto.createHash('sha512').update('market=KRW-BTC').digest('hex'));
  assert.equal(body.query_hash_alg, 'SHA512');
  const [h, p, s] = token.split('.');
  assert.equal(s, crypto.createHmac('sha256', 'SECRET').update(`${h}.${p}`).digest('base64url'));
});

test('파라미터가 없으면 query_hash를 넣지 않는다', () => {
  const [, body] = decode(buildToken('AK', 'S'));
  assert.equal(body.query_hash, undefined);
});

test('배열 파라미터는 key[]=value 로 펼친다', () => {
  assert.equal(toQueryString({ market: 'KRW-BTC', uuids: ['a', 'b'], x: undefined }), 'market=KRW-BTC&uuids[]=a&uuids[]=b');
});

function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, opt) => {
    calls.push({ url, ...opt });
    const { status = 200, body } = handler(url, opt);
    return { ok: status < 400, status, text: async () => JSON.stringify(body) };
  };
  fn.calls = calls;
  return fn;
}

test('캔들은 오래된 순으로 정렬되고 시각은 UTC로 해석', async () => {
  const f = fakeFetch(() => ({ body: [
    { candle_date_time_utc: '2026-10-23T03:00:00', opening_price: 2, high_price: 3, low_price: 1, trade_price: 2.5, candle_acc_trade_volume: 10, candle_acc_trade_price: 25 },
    { candle_date_time_utc: '2026-10-22T23:00:00', opening_price: 1, high_price: 2, low_price: 1, trade_price: 2, candle_acc_trade_volume: 5, candle_acc_trade_price: 10 },
  ] }));
  const c = new BithumbClient({ fetchImpl: f });
  const rows = await c.candles('KRW-BTC', 240, { count: 2 });
  assert.equal(f.calls[0].url, 'https://api.bithumb.com/v1/candles/minutes/240?market=KRW-BTC&count=2');
  assert.equal(rows[0].t, Date.UTC(2026, 9, 22, 23));
  assert.equal(rows[1].c, 2.5);
});

test('시장가 매수 주문: POST /v2/orders, body 해시가 JWT에 들어간다', async () => {
  const f = fakeFetch(() => ({ status: 201, body: { order_id: 'X1' } }));
  const c = new BithumbClient({ accessKey: 'AK', secretKey: 'SK', fetchImpl: f });
  const r = await c.placeOrder({ market: 'KRW-BTC', side: 'bid', order_type: 'price', price: 10000 });
  assert.equal(r.order_id, 'X1');
  const call = f.calls[0];
  assert.equal(call.url, 'https://api.bithumb.com/v2/orders');
  assert.equal(call.method, 'POST');
  assert.deepEqual(JSON.parse(call.body), { market: 'KRW-BTC', side: 'bid', order_type: 'price', price: '10000' });
  const [, body] = decode(call.headers.authorization.replace('Bearer ', ''));
  assert.equal(body.query_hash, crypto.createHash('sha512').update('market=KRW-BTC&side=bid&order_type=price&price=10000').digest('hex'));
});

test('API 오류는 이름과 메시지를 담은 예외로', async () => {
  const f = fakeFetch(() => ({ status: 401, body: { error: { name: 'invalid_query_payload', message: 'bad hash' } } }));
  const c = new BithumbClient({ accessKey: 'AK', secretKey: 'SK', fetchImpl: f });
  await assert.rejects(c.accounts(), /401.*invalid_query_payload/);
});

test('키 없이 인증 API를 부르면 요청 전에 막는다', async () => {
  const c = new BithumbClient({ fetchImpl: fakeFetch(() => ({ body: [] })) });
  await assert.rejects(c.accounts(), /API 키/);
});
