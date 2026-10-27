import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Settings, validateChanges } from '../src/settings.js';
import { Store } from '../src/store.js';
import { buildConfig } from '../src/config.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ast-settings-'));
function setup({ env = {}, dir = tmp(), position = false } = {}) {
  const cfg = buildConfig({ FEE_RATE: '0.0004', MAX_POSITION_KRW: '1000000', ...env });
  const store = new Store(dir), events = [];
  const state = { position };
  const settings = new Settings({ cfg, store, now: () => 1000, emit: (type, data) => events.push({ type, ...data }), hasPosition: () => state.position });
  return { cfg, store, settings, events, state, dir };
}

test('설정 변경: 범위 검증과 전부 아니면 전부', () => {
  const cfg = buildConfig({});
  assert.equal(validateChanges({ fee: 0.0004, maxPositionKrw: 3_000_000 }, cfg).ok, true);
  for (const bad of [{ fee: -0.1 }, { fee: 0.5 }, { risk: 0 }, { maxPositionKrw: 1000 }, { maxPositionKrw: 2_000_000.5 },
    { maxPositionKrw: cfg.paperKrw + 1 }, { entryScore: 101 }, { stopAtr: 3 }, { fee: 'abc' }, {}, null]) {
    assert.equal(validateChanges(bad, cfg).ok, false, JSON.stringify(bad));
  }
  const { cfg: c, settings } = setup();
  assert.throws(() => settings.request({ fee: 0.001, risk: 5 }), /거래당 위험 비율/);
  assert.equal(c.fee, 0.0004, '하나라도 틀리면 아무것도 바꾸지 않음');
  // 문자열 숫자 허용
  settings.request({ maxPositionKrw: '3000000' });
  assert.equal(c.maxPositionKrw, 3_000_000);
});

test('설정 변경: 포지션 없으면 즉시 적용·이벤트·이력', () => {
  const { cfg, settings, events, store } = setup();
  const r = settings.request({ fee: 0.001, maxPositionKrw: 3_000_000 }, { reason: '시험' });
  assert.deepEqual([r.applied, r.pending], [true, false]);
  assert.equal(cfg.fee, 0.001);
  assert.equal(events.at(-1).type, 'config');
  assert.deepEqual(events.at(-1).changes.fee, { from: 0.0004, to: 0.001 });
  assert.deepEqual(store.state.settings.overrides, { fee: 0.001, maxPositionKrw: 3_000_000 });
  const v = settings.view();
  assert.equal(v.items.find((i) => i.key === 'fee').base, 0.0004);
  assert.equal(v.history[0].reason, '시험');
});

test('설정 변경: 보유 중에는 대기했다가 청산 뒤 적용', () => {
  const { cfg, settings, state, events } = setup({ position: true });
  const r = settings.request({ fee: 0.001 });
  assert.deepEqual([r.applied, r.pending], [false, true]);
  assert.equal(cfg.fee, 0.0004, '보유 중 수수료 유지');
  settings.request({ maxPositionKrw: 2_000_000 });
  assert.equal(settings.applyPending(), false, '아직 보유 중');
  state.position = false;
  assert.equal(settings.applyPending(), true);
  assert.equal(cfg.fee, 0.001);
  assert.equal(cfg.maxPositionKrw, 2_000_000, '대기 요청은 합쳐서 적용');
  assert.equal(events.at(-1).status, 'applied-after-close');
  assert.equal(settings.view().pending, null);
  assert.equal(settings.applyPending(), false, '두 번 적용하지 않음');
});

test('설정 변경: 재기동 후 유지, 되돌리기, live 거부', () => {
  const a = setup();
  a.settings.request({ fee: 0.001 });
  const b = setup({ dir: a.dir });
  assert.equal(b.cfg.fee, 0.001, '저장된 변경값이 .env보다 우선');
  assert.equal(b.settings.view().items.find((i) => i.key === 'fee').base, 0.0004);
  b.settings.reset(['fee']);
  assert.equal(b.cfg.fee, 0.0004);
  assert.deepEqual(b.store.state.settings.overrides, {});

  const c = setup({ dir: a.dir });
  const live = buildConfig({ MODE: 'live', BITHUMB_ACCESS_KEY: 'a', BITHUMB_SECRET_KEY: 'b', LIVE_CONFIRM: 'YES' });
  c.store.state.settings.overrides = { fee: 0.002 };
  const s = new Settings({ cfg: live, store: c.store });
  assert.equal(live.fee, 0.0025, 'live에서는 저장값을 적용하지 않음');
  assert.throws(() => s.request({ fee: 0.001 }), /모의투자/);
});
