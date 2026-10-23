import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CandleStore, toKst } from '../src/data/candleStore.js';

const minute = 60000;
const base = Date.UTC(2026, 9, 1);
const candle = (i) => ({ t: base + i * minute, o: 100, h: 110, l: 90, c: 105, v: 2, value: 210 });
function setup(t, size = 601) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-candles-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let rows = Array.from({ length: size }, (_, i) => candle(i));
  let now = base + size * minute;
  const calls = [];
  const client = { async candles(market, unit, options) {
    calls.push({ market, unit, ...options });
    const before = options.to ? Date.parse(options.to + '+09:00') : Infinity;
    return rows.filter((r) => r.t < before).slice(-options.count);
  } };
  const store = new CandleStore({ dir, client, now: () => now, sleepMs: 0 });
  return { store, dir, client, calls, setRows: (r) => { rows = r; }, setNow: (n) => { now = n; } };
}

test('빈 저장소에서 KST 배타적 커서로 과거 페이지 수집', async (t) => {
  const { store, calls } = setup(t);
  assert.deepEqual(store.load('KRW-BTC', 1), []);
  const rows = await store.update('KRW-BTC', 1, { minBars: 450 });
  assert.equal(rows.length, 600);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].to, toKst(candle(401).t));
  assert.equal(calls[2].to, toKst(candle(201).t));
  assert.deepEqual(store.load('KRW-BTC', 1), rows);
});

test('새 봉만 생기면 두 번째 갱신은 최신 요청 한 번', async (t) => {
  const f = setup(t);
  await f.store.update('KRW-BTC', 1, { minBars: 450 });
  const before = f.calls.length;
  f.setRows(Array.from({ length: 603 }, (_, i) => candle(i)));
  f.setNow(base + 603 * minute);
  const rows = await f.store.update('KRW-BTC', 1, { minBars: 450 });
  assert.equal(f.calls.length - before, 1);
  assert.equal(rows.length, 602);
  assert.equal(rows.at(-1).t, candle(602).t);
});

test('캐시보다 많은 새 봉과 더 긴 과거 요청을 모두 수집', async (t) => {
  const f = setup(t, 300);
  await f.store.update('KRW-BTC', 1, { minBars: 100 });
  f.setRows(Array.from({ length: 801 }, (_, i) => candle(i)));
  f.setNow(base + 801 * minute);
  const rows = await f.store.update('KRW-BTC', 1, { minBars: 800 });
  assert.equal(rows.length, 801);
  assert.deepEqual(f.store.gaps('KRW-BTC', 1), []);
});

test('마감 경계는 포함, 미완성은 제외, 중복은 마지막 값으로 병합', async (t) => {
  const f = setup(t, 5);
  f.setNow(candle(4).t);
  f.setRows([candle(0), candle(1), candle(2), { ...candle(2), c: 106 }, candle(3), candle(4)]);
  const rows = await f.store.update('KRW-BTC', 1, { minBars: 1 });
  assert.equal(rows.length, 4);
  assert.equal(rows[2].c, 106);
  assert.equal(rows.at(-1).t, candle(3).t);
});

test('짧은 페이지 다음에도 빈 응답까지 수집하고 부족한 길이를 반환', async (t) => {
  const f = setup(t, 3);
  const rows = await f.store.update('KRW-BTC', 1, { minBars: 100 });
  assert.equal(rows.length, 3);
  assert.equal(f.calls.length, 2);
});

test('처음부터 빈 응답이면 빈 배열 저장', async (t) => {
  const f = setup(t, 0);
  assert.deepEqual(await f.store.update('KRW-BTC', 1), []);
  assert.equal(f.calls.length, 1);
});

test('KST 변환은 날짜 경계를 처리', () => {
  assert.equal(toKst(Date.UTC(2026, 9, 22, 23)), '2026-10-23T08:00:00');
});

test('누락 구간은 첫 누락부터 마지막 누락까지 보고', async (t) => {
  const f = setup(t, 7);
  f.setRows([candle(0), candle(3), candle(4), candle(6)]);
  await f.store.update('KRW-BTC', 1, { minBars: 1 });
  assert.deepEqual(f.store.gaps('KRW-BTC', 1), [
    { from: candle(1).t, to: candle(2).t, missing: 2 },
    { from: candle(5).t, to: candle(5).t, missing: 1 },
  ]);
});

test('잘못된 응답과 반복 페이지는 기존 파일을 보존', async (t) => {
  const f = setup(t, 5);
  await f.store.update('KRW-BTC', 1, { minBars: 1 });
  const file = f.store.file('KRW-BTC', 1);
  const original = fs.readFileSync(file, 'utf8');
  for (const patch of [{ h: 1 }, { c: NaN }, { v: -1 }, { t: base + 1 }, { value: -1 }]) {
    f.client.candles = async () => [{ ...candle(5), ...patch }];
    await assert.rejects(f.store.update('KRW-BTC', 1, { minBars: 1 }), /캔들/);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
  }
  f.client.candles = async () => [candle(10)];
  await assert.rejects(f.store.update('KRW-BTC', 1), /과거로 진행/);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.deepEqual(fs.readdirSync(f.dir), ['KRW-BTC_1.jsonl']);
});

test('손상된 캐시는 오류로 반환하고 덮어쓰지 않음', async (t) => {
  const f = setup(t);
  const file = f.store.file('KRW-BTC', 1);
  fs.writeFileSync(file, '{broken');
  await assert.rejects(f.store.update('KRW-BTC', 1), /캐시/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
  assert.equal(f.calls.length, 0);
});

test('동일 파일의 다른 인스턴스도 직렬화하고 실패 뒤 재시도 가능', async (t) => {
  const f = setup(t, 5);
  const second = new CandleStore({ dir: f.dir, client: f.client, now: () => base + 5 * minute, sleepMs: 0 });
  let active = 0;
  let maximum = 0;
  const original = f.client.candles;
  f.client.candles = async (...args) => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return original(...args);
  };
  const result = await Promise.all([f.store.update('KRW-BTC', 1, { minBars: 1 }), second.update('KRW-BTC', 1, { minBars: 1 })]);
  assert.equal(maximum, 1);
  assert.deepEqual(result[0], result[1]);
  f.client.candles = async () => { throw new Error('테스트 네트워크 오류'); };
  await assert.rejects(f.store.update('KRW-BTC', 1), /네트워크/);
  f.client.candles = original;
  assert.equal((await f.store.update('KRW-BTC', 1, { minBars: 1 })).length, 5);
});

test('잘못된 경로와 요청 수는 파일 및 네트워크 접근 전 거절', (t) => {
  const f = setup(t);
  assert.throws(() => f.store.load('../KRW-BTC', 1), /마켓/);
  assert.throws(() => f.store.load('KRW-BTC', 2), /분봉/);
  assert.throws(() => f.store.update('KRW-BTC', 1, { minBars: -1 }), /최소/);
  assert.equal(f.calls.length, 0);
});

test('240분봉은 KST 경계로 검증하고 UTC 정각 착오를 거절', async (t) => {
  const f = setup(t);
  const aligned = { ...candle(0), t: Date.UTC(2026, 9, 1, 3) };
  f.setRows([aligned]);
  assert.equal((await f.store.update('KRW-BTC', 240, { minBars: 1 })).length, 1);
  f.setRows([{ ...aligned, t: Date.UTC(2026, 9, 1, 4) }]);
  await assert.rejects(f.store.update('KRW-BTC', 240, { minBars: 1 }), /캔들 데이터/);
});

test('인스턴스의 서로 다른 종목도 요청 간격을 공유', async (t) => {
  const f = setup(t, 1);
  const times = [];
  f.client.candles = async () => { times.push(performance.now()); return [candle(0)]; };
  const store = new CandleStore({ dir: f.dir, client: f.client, now: () => base + minute, sleepMs: 30 });
  await Promise.all(['KRW-BTC', 'KRW-ETH'].map((market) => store.update(market, 1, { minBars: 1 })));
  assert.equal(times.length, 2);
  assert.ok(times[1] - times[0] >= 25);
});

test('파일 교체 실패 시 기존 캐시 보존 및 임시 파일 정리', async (t) => {
  const f = setup(t, 1);
  await f.store.update('KRW-BTC', 1, { minBars: 1 });
  const file = f.store.file('KRW-BTC', 1);
  const original = fs.readFileSync(file, 'utf8');
  f.setRows([candle(0), candle(1)]);
  f.setNow(base + 2 * minute);
  t.mock.method(fs, 'renameSync', () => { throw new Error('테스트 파일 교체 실패'); });
  await assert.rejects(f.store.update('KRW-BTC', 1, { minBars: 1 }), /교체 실패/);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.deepEqual(fs.readdirSync(f.dir), ['KRW-BTC_1.jsonl']);
});

test('수집 중간 요청 실패 시 새 봉도 부분 저장하지 않음', async (t) => {
  const f = setup(t, 2);
  await f.store.update('KRW-BTC', 1, { minBars: 1 });
  const original = f.store.load('KRW-BTC', 1);
  let count = 0;
  f.setNow(base + 500 * minute);
  f.client.candles = async () => {
    if (++count === 2) throw new Error('테스트 두 번째 요청 실패');
    return Array.from({ length: 200 }, (_, i) => candle(300 + i));
  };
  await assert.rejects(f.store.update('KRW-BTC', 1, { minBars: 1 }), /두 번째/);
  assert.deepEqual(f.store.load('KRW-BTC', 1), original);
});
