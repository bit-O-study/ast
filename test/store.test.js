import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';

test('이벤트 구독: 기록될 때 호출되고, 구독 함수 오류는 무시된다', async () => {
  const store = new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'ast-')));
  const got = [];
  const off = store.onEvent((e) => got.push(e.type));
  store.onEvent(() => { throw new Error('boom'); });
  store.onEvent(async () => { throw new Error('async boom'); });
  store.event('buy', { msg: 'x' });
  off();
  store.event('sell', { msg: 'y' });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(got, ['buy']);
  assert.equal(store.events().length, 2);
});
