import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const exec=promisify(execFile);
const quote=(s)=>"'"+s.replaceAll("'","''")+"'";
for (const scenario of ['create','exists','missing','mismatch','update']) {
  test('예약 작업 검증: '+scenario,{skip:process.platform!=='win32',timeout:45000},async(t)=>{
    const root=await mkdtemp(join(tmpdir(),'ast-task-test-'));
    t.after(async()=>{assert.ok(root.startsWith(join(tmpdir(),'ast-task-test-')));await rm(root,{recursive:true,force:true});});
    await mkdir(join(root,'scripts','server'),{recursive:true});
    await writeFile(join(root,'scripts','server','run-paper.ps1'),'');
    const out=join(root,'result.json');
    const lines=[
      "$ErrorActionPreference='Stop'",
      "$global:calls=@();$global:triggers=@()",
      "function Get-ScheduledTask { param($TaskName,$ErrorAction)",
      "if ("+quote(scenario)+" -in @('create','missing')) { return $null }",
      "$runner=Join-Path "+quote(root)+" 'scripts\\server\\run-paper.ps1'",
      "$arg='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"'+$runner+'\"'",
      "if ("+quote(scenario)+" -eq 'mismatch') {$arg='unrelated'}",
      "return [pscustomobject]@{TaskName=$TaskName;State='Running';Actions=@([pscustomobject]@{Execute='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';Arguments=$arg;WorkingDirectory="+quote(root)+"});Principal=[pscustomobject]@{UserId='SYSTEM'};Settings=[pscustomobject]@{MultipleInstances=2}}",
      "}",
      "function New-ScheduledTaskTrigger {param([switch]$AtStartup,[switch]$Once,$At,$RepetitionInterval);return [pscustomobject]@{boot=[bool]$AtStartup;repeat=$RepetitionInterval.TotalSeconds}}",
      "function New-ScheduledTaskAction {param($Execute,$Argument,$WorkingDirectory);return @{}}",
      "function New-ScheduledTaskPrincipal {param($UserId,$LogonType);return @{}}",
      "function New-ScheduledTaskSettingsSet {return @{}}",
      "function Register-ScheduledTask {param($TaskName,$Action,$Trigger,$Principal,$Settings,$Description);$global:calls+='register';$global:triggers=$Trigger}",
      "function Start-ScheduledTask {param($TaskName);$global:calls+='start'}",
      "function Set-ScheduledTask {param($TaskName,$Trigger);$global:calls+='update';$global:triggers=$Trigger}",
      "$failed=$false",
      "try { & "+quote(resolve('scripts/server/install-paper-task.ps1'))+" -ProjectRoot "+quote(root)+" -TaskName AST-Test-Installer "+(['missing','mismatch','update'].includes(scenario)?'-UpdateExisting':'')+" | Out-Null } catch {$failed=$true}",
      "[pscustomobject]@{failed=$failed;calls=@($global:calls);triggers=@($global:triggers)} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath "+quote(out)+" -Encoding UTF8",
    ];
    const script=join(root,'harness.ps1');
    await writeFile(script,'\uFEFF'+lines.join('\n'));
    await exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{windowsHide:true,timeout:35000});
    const r=JSON.parse((await readFile(out,'utf8')).replace(/^\uFEFF/,''));
    assert.equal(r.failed,!['create','update'].includes(scenario));
    assert.deepEqual(r.calls,scenario==='create'?['register','start']:scenario==='update'?['update']:[]);
    if (!r.failed) {assert.equal(r.triggers.length,2);assert.equal(r.triggers[0].boot,true);assert.equal(r.triggers[1].repeat,60);}
  });
}
