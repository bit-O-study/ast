import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { packageRelease } from '../scripts/deploy/package.mjs';

export async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'ast-deploy-test-'));
  t.after(async () => { assert.ok(base.startsWith(join(tmpdir(), 'ast-deploy-test-'))); await rm(base, { recursive: true, force: true }); });
  const root = join(base, 'source');
  for (const file of ['src/index.js', 'web/index.html', 'node_modules/ws/package.json', 'package.json', 'package-lock.json', '.env', 'data/state.json', 'logs/secret.log']) {
    await mkdir(join(root, file, '..'), { recursive: true });
    await writeFile(join(root, file), file + ' fixture');
  }
  return { base, root, release: join(base, 'release'), sha: 'a'.repeat(40) };
}
test('배포 패키지는 코드와 의존성만 포함하고 해시를 검증할 수 있다', async t => {
  const f = await fixture(t);
  const m = await packageRelease(f.root, f.release, f.sha);
  assert.equal(m.sha, f.sha);
  assert.equal(m.files.length, 5);
  for (const file of m.files) {
    assert.ok(!/^(data|logs|\.env)/.test(file.path));
    assert.equal(createHash('sha256').update(await readFile(join(f.release, file.path))).digest('hex'), file.sha256);
  }
  assert.deepEqual(JSON.parse(await readFile(join(f.release, 'release.json'))), m);
});
test('잘못된 SHA와 소스 내부 출력 경로를 거부한다', async t => {
  const f = await fixture(t);
  await assert.rejects(packageRelease(f.root, f.release, 'main'), /SHA/);
  await assert.rejects(packageRelease(f.root, join(f.root, 'out'), f.sha), /소스/);
});
