import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { packageRelease } from '../scripts/deploy/package.mjs';
const exec = promisify(execFile);
const quote = s => "'" + s.replaceAll("'", "''") + "'";
for (const scenario of ['success', 'short', 'halted', 'position', 'live', 'hash', 'path', 'extra', 'rollback', 'race', 'task', 'stop']) {
  test('배포 격리 PowerShell: ' + scenario, { skip: process.platform !== 'win32', timeout: 60000 }, async t => {
    const base = await mkdtemp(join(tmpdir(), 'ast-deploy-server-'));
    t.after(async () => { assert.ok(base.startsWith(join(tmpdir(), 'ast-deploy-server-'))); await rm(base, { recursive: true, force: true }); });
    const source = join(base, 'source'), live = join(base, 'live'), release = join(base, 'release'), sha = 'a'.repeat(40);
    for (const root of [source, live]) {
      for (const file of ['src/index.js', 'web/index.html', 'node_modules/ws/package.json', 'package.json', 'package-lock.json', 'data/state.json', '.env']) {
        await mkdir(join(root, file, '..'), { recursive: true });
        await writeFile(join(root, file), root === source ? 'new' : 'old');
      }
    }
    const manifest = await packageRelease(source, release, sha);
    if (scenario === 'hash') await writeFile(join(release, 'src/index.js'), 'tampered');
    if (scenario === 'path') { manifest.files[0].path = '../outside'; await writeFile(join(release, 'release.json'), JSON.stringify(manifest)); }
    if (scenario === 'extra') await writeFile(join(release, 'unknown.txt'), 'extra');
    const out = join(base, 'result.json');
    const script = [
      "$ErrorActionPreference='Stop'",
      "$global:scenario=" + quote(scenario),
      "$global:live=" + quote(live),
      "$global:running=$true;$global:stops=0;$global:controls=@()",
      "$global:state=[pscustomobject]@{mode='paper';position=$null;balance=[pscustomobject]@{coin=0;krw=10000000};halted=$false;killed=$false;lastError=$null}",
      "if ($scenario -eq 'halted') {$global:state.halted=$true}",
      "if ($scenario -eq 'position') {$global:state.position=@{qty=1}}",
      "if ($scenario -eq 'live') {$global:state.mode='live'}",
      "function Get-ScheduledTask { param($TaskName) if ($scenario -eq 'task') {throw 'task mismatch'};return [pscustomobject]@{State='Running';Actions=@([pscustomobject]@{Arguments=('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File '+[char]34+$live+'\\scripts\\server\\run-paper.ps1'+[char]34+' -ProjectRoot '+[char]34+$live+[char]34);WorkingDirectory=$live;Execute='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'})}}",
      "function Invoke-RestMethod { param($Uri,$Method,$Body,$ContentType,$TimeoutSec)",
      " if (!$global:running) {throw 'stopped'}",
      " if ($Method -eq 'Post') { $action=($Body|ConvertFrom-Json).action;$global:controls+=@($action);$global:state.halted=($action -eq 'pause');if ($scenario -eq 'race' -and $action -eq 'pause') {$global:state.position=@{qty=1}};return @{ok=$true} }",
      " if ($scenario -eq 'rollback' -and (Get-Content -LiteralPath ($global:live+'\\src\\index.js') -Raw) -eq 'new') {throw 'new code unhealthy'}",
      " return $global:state",
      "}",
      "function Invoke-WebRequest {param($Uri,[switch]$UseBasicParsing,$TimeoutSec) return @{StatusCode=200}}",
      "function Disable-ScheduledTask {param($TaskName)}",
      "function Enable-ScheduledTask {param($TaskName)}",
      "function Stop-ScheduledTask {param($TaskName) $global:stops++;if ($scenario -ne 'stop') {$global:running=$false}}",
      "function Start-ScheduledTask {param($TaskName) $global:running=$true}",
      "function Get-NetTCPConnection {param($LocalPort,$State,$ErrorAction) if ($global:running) {return @{OwningProcess=1}}}",
      "function Start-Sleep {param($Seconds)}",
      "$errorText=$null",
      "$releasePath=" + quote(release),
      "if ($scenario -eq 'short') {$releasePath=(New-Object -ComObject Scripting.FileSystemObject).GetFolder($releasePath).ShortPath}",
      "try { & " + quote(resolve('scripts/deploy/deploy-paper.ps1')) + " -Release $releasePath -ProjectRoot " + quote(live) + " -Sha " + quote(sha) + " -TaskName AST-Test-Deploy -HealthAttempts 1 } catch {$errorText=$_.Exception.Message}",
      "@{error=$errorText;stops=$global:stops;running=$global:running;halted=$global:state.halted;controls=@($global:controls)}|ConvertTo-Json -Depth 5|Set-Content -Encoding UTF8 -LiteralPath " + quote(out),
    ].join('\r\n');
    const wrapper = join(base, 'test.ps1');
    await writeFile(wrapper, '\uFEFF' + script);
    await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', wrapper], { windowsHide: true, timeout: 50000 });
    const result = JSON.parse((await readFile(out, 'utf8')).replace(/^\uFEFF/, ''));
    const success = ['success', 'short', 'halted'].includes(scenario);
    if (success) assert.equal(result.error, null, JSON.stringify(result)); else assert.ok(result.error, JSON.stringify(result));
    assert.equal(await readFile(join(live, 'src/index.js'), 'utf8'), success ? 'new' : 'old');
    assert.equal(await readFile(join(live, '.env'), 'utf8'), 'old');
    assert.equal(await readFile(join(live, 'data/state.json'), 'utf8'), 'old');
    assert.equal(result.running, true);
    assert.equal(result.halted, scenario === 'halted', JSON.stringify(result));
    if (['position', 'live', 'hash', 'path', 'extra', 'race', 'task'].includes(scenario)) assert.equal(result.stops, 0);
    if (scenario === 'rollback') assert.equal(result.stops, 2);
  });
}
