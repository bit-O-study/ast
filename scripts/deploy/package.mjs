import { readdir, lstat, readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function packageRelease(root, output, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('커밋 SHA가 올바르지 않습니다.');
  root = resolve(root); output = resolve(output);
  if (root === output || !relative(root, output).startsWith('..')) throw new Error('출력은 소스 폴더 밖이어야 합니다.');
  await mkdir(output, { recursive: false });
  const files = [];
  async function visit(name) {
    const from = join(root, name);
    const stat = await lstat(from);
    if (stat.isSymbolicLink()) throw new Error('심볼릭 링크는 배포하지 않습니다: ' + name);
    if (stat.isDirectory()) {
      for (const child of await readdir(from)) {
        if (child.startsWith('.')) continue;
        await visit(name + '/' + child);
      }
    } else if (stat.isFile()) {
      const dest = join(output, name);
      await mkdir(resolve(dest, '..'), { recursive: true });
      await copyFile(from, dest);
      files.push({ path: name, sha256: createHash('sha256').update(await readFile(from)).digest('hex') });
    } else throw new Error('일반 파일만 배포할 수 있습니다.');
  }
  for (const name of ['src', 'web', 'node_modules', 'package.json', 'package-lock.json']) await visit(name);
  const manifest = { sha, files };
  await writeFile(join(output, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const manifest = await packageRelease(process.cwd(), process.argv[2], process.env.GITHUB_SHA);
  console.log('배포 패키지: ' + manifest.sha + ' · ' + manifest.files.length + '개 파일');
}
