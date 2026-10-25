import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const windows = process.platform === 'win32';
const runner = resolve('scripts/server/run-paper.ps1');

function start(root, mutex) {
  const child = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', runner,
    '-ProjectRoot', root, '-NodePath', process.execPath, '-RetrySeconds', '1', '-MutexName', mutex,
  ], { windowsHide: true, stdio: 'ignore', env: { ...process.env, MODE: 'live', LIVE_CONFIRM: 'YES', HOST: '0.0.0.0', TZ: 'UTC' } });
  const ended = new Promise((done, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => done(code));
  });
  return { child, ended };
}

async function waitFor(check, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await delay(100);
  }
  throw new Error('실행 스크립트 검증 제한 시간 초과');
}

test('Windows 실행기: 실패 후 재시작, 중복 차단, 모의 모드와 KST 강제', { skip: !windows, timeout: 90_000 }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ast-runner-test-'));
  const mutex = 'Local\\AST-Test-' + randomUUID();
  const children = [];
  t.after(async () => {
    // 이 테스트가 직접 생성한 자식 트리만 종료한다.
    for (const p of children) {
      if (p.child.exitCode === null && p.child.signalCode === null && p.child.pid) {
        execFileSync('taskkill.exe', ['/PID', String(p.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        await p.ended;
      }
    }
    assert.ok(root.startsWith(join(tmpdir(), 'ast-runner-test-')));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src', 'index.js'), [
    "const fs = require('node:fs');",
    "const file = 'starts.jsonl';",
    "const count = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\\n').length : 0;",
    "fs.appendFileSync(file, JSON.stringify({ mode: process.env.MODE, confirm: process.env.LIVE_CONFIRM, host: process.env.HOST, port: process.env.PORT, tz: process.env.TZ, offset: new Date().getTimezoneOffset() }) + '\\n');",
    "if (count === 0) process.exit(7);",
    "setInterval(() => {}, 1000);",
  ].join('\n'));
  const rows = async () => {
    try { return (await readFile(join(root, 'starts.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse); }
    catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  };
  children.push(start(root, mutex));
  const records = await waitFor(async () => { const r = await rows(); return r.length >= 2 ? r : null; });
  assert.equal(records.length, 2);
  for (const r of records) assert.deepEqual(r, { mode: 'paper', confirm: 'NO', host: '127.0.0.1', port: '8787', tz: 'Asia/Seoul', offset: -540 });
  const duplicate = start(root, mutex);
  children.push(duplicate);
  await waitFor(() => duplicate.child.exitCode !== null);
  assert.equal(await duplicate.ended, 0);
  assert.equal((await rows()).length, 2);
  const date = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  assert.ok((await readdir(join(root, 'logs'))).includes('paper-' + date + '.log'));
});

test('Windows 실행기: 시작 파일이 없으면 즉시 실패', { skip: !windows, timeout: 45_000 }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ast-runner-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const p = start(root, 'Local\\AST-Test-' + randomUUID());
  assert.notEqual(await p.ended, 0);
});

test('Windows 실행기: 잔존 Node가 있으면 대기하고 종료 후 기동', { skip: !windows, timeout: 90_000 }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ast-runner-test-'));
  const children = [];
  t.after(async () => {
    for (const p of children) {
      if (p.child.exitCode === null && p.child.signalCode === null && p.child.pid) {
        execFileSync('taskkill.exe', ['/PID', String(p.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        await p.ended;
      }
    }
    assert.ok(root.startsWith(join(tmpdir(), 'ast-runner-test-')));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'src'));
  const entry = join(root, 'src', 'index.js');
  await writeFile(entry, "require('node:fs').appendFileSync('starts.txt', 'start\\n'); setInterval(() => {}, 1000);");
  const count = async () => {
    try { return (await readFile(join(root, 'starts.txt'), 'utf8')).trim().split('\n').length; }
    catch (e) { if (e.code === 'ENOENT') return 0; throw e; }
  };
  const orphan = spawn(process.execPath, [entry], { cwd: root, windowsHide: true, stdio: 'ignore' });
  const ended = new Promise((done, reject) => { orphan.once('exit', done); orphan.once('error', reject); });
  children.push({ child: orphan, ended });
  await waitFor(async () => await count() === 1);
  children.push(start(root, 'Local\\AST-Test-' + randomUUID()));
  await waitFor(async () => {
    try { return (await readdir(join(root, 'logs'))).some((x) => x.endsWith('.log')); }
    catch (e) { if (e.code === 'ENOENT') return false; throw e; }
  });
  await delay(1500);
  assert.equal(await count(), 1);
  // 이 테스트가 생성한 잔존 프로세스만 종료한다.
  orphan.kill();
  await ended;
  await waitFor(async () => await count() === 2);
  assert.equal(await count(), 2);
});