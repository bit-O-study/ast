param(
  [Parameter(Mandatory=$true)][string]$Release,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$Sha,
  [string]$ProjectRoot='C:\ast',
  [ValidatePattern('^(AST-Paper-Trader|AST-Test-[A-Za-z0-9-]+)$')][string]$TaskName='AST-Paper-Trader',
  [ValidateRange(1,120)][int]$HealthAttempts=60
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$ProjectRoot=(Resolve-Path -LiteralPath $ProjectRoot).Path
$Release=(Resolve-Path -LiteralPath $Release).Path
if ($Release -eq $ProjectRoot) { throw '운영 경로를 배포 원본으로 쓸 수 없습니다.' }
$mutex=[Threading.Mutex]::new($false,'Global\AST-Deploy-'+$TaskName)
$owned=$false
$observerToResume=$false
function Read-Status { Invoke-RestMethod -Uri http://127.0.0.1:8787/api/status -TimeoutSec 10 }
function Control($action) {
  Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/api/control -ContentType 'application/json' -Body (@{action=$action}|ConvertTo-Json) -TimeoutSec 10 | Out-Null
}
function Assert-Paper($status) {
  if ($status.mode -ne 'paper' -or $null -ne $status.position -or $status.balance.coin -ne 0 -or $status.lastError -or $status.killed) {
    throw '정상 무포지션 모의투자 상태에서만 배포할 수 있습니다.'
  }
}
function Stop-App {
  Disable-ScheduledTask -TaskName $TaskName | Out-Null
  Stop-ScheduledTask -TaskName $TaskName
  for ($i=0;$i -lt 30;$i++) {
    if (!(Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue)) { return }
    Start-Sleep -Seconds 1
  }
  throw '기존 AST 프로세스 종료를 확인하지 못했습니다.'
}
function Start-App {
  Enable-ScheduledTask -TaskName $TaskName | Out-Null
  Start-ScheduledTask -TaskName $TaskName
}
function Healthy($expected) {
  for ($i=0;$i -lt $HealthAttempts;$i++) {
    try {
      $s=Read-Status
      Assert-Paper $s
      if ($s.halted -ne $true -or $s.balance.krw -ne $expected.balance.krw) { throw '잔고 또는 일시정지 상태가 다릅니다.' }
      $page=Invoke-WebRequest -UseBasicParsing -Uri http://127.0.0.1:8787/ -TimeoutSec 10
      if ($page.StatusCode -ne 200) { throw '화면 응답 오류' }
      return
    } catch { if ($i -eq $HealthAttempts-1) { throw }; Start-Sleep -Seconds 1 }
  }
}
try {
  try { $owned=$mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned=$true }
  if (!$owned) { throw '이미 배포 중입니다.' }
  $manifest=Get-Content -LiteralPath "$Release\release.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($manifest.sha -cne $Sha -or !$manifest.files.Count) { throw '배포 SHA 또는 파일 목록이 올바르지 않습니다.' }
  $seen=@{}
  foreach ($file in $manifest.files) {
    $name=[string]$file.path
    if ($name -notmatch '^(src/|web/|node_modules/|package\.json$|package-lock\.json$)' -or
        $name -match '(^|/)\.\.?(/|$)|[:\\]' -or $file.sha256 -notmatch '^[a-f0-9]{64}$' -or $seen.ContainsKey($name)) {
      throw '허용되지 않은 배포 파일 경로 또는 해시입니다.'
    }
    $full=[IO.Path]::GetFullPath((Join-Path $Release $name))
    if (!$full.StartsWith($Release+'\',[StringComparison]::OrdinalIgnoreCase)) { throw '배포 경로 이탈입니다.' }
    $seen[$name]=$true
    if ((Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLower() -cne $file.sha256) { throw '배포 파일 해시가 다릅니다.' }
  }
  foreach ($required in @('src/index.js','web/index.html','node_modules/ws/package.json','package.json','package-lock.json')) {
    if (!$seen.ContainsKey($required)) { throw "필수 파일 누락: $required" }
  }
  $all=@(Get-ChildItem -LiteralPath $Release -Recurse -Force)
  if (@($all|Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw '링크 경로는 허용하지 않습니다.' }
  if (@($all|Where-Object { !$_.PSIsContainer }).Count -ne $seen.Count+1) { throw '목록에 없는 파일이 있습니다.' }
  $task=Get-ScheduledTask -TaskName $TaskName
  $runnerPath=Join-Path $ProjectRoot 'scripts\server\run-paper.ps1'
  $expected='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$runnerPath+'" -ProjectRoot "'+$ProjectRoot+'"'
  if ($task.State -ne 'Running' -or @($task.Actions).Count -ne 1 -or $task.Actions[0].Arguments -ne $expected -or $task.Actions[0].WorkingDirectory -ne $ProjectRoot) { throw 'AST 예약 작업 설정이 예상과 다릅니다.' }
  $before=Read-Status
  Assert-Paper $before
  $originalHalted=$before.halted
  $paused=$false
  $stopped=$false
  $started=$false
  $moved=[Collections.Generic.List[string]]::new()
  $items=@('src','web','node_modules','package.json','package-lock.json','release.json')
  $job=Join-Path $ProjectRoot ('logs\deploy\'+$Sha+'-'+[guid]::NewGuid().ToString('N'))
  $stage=Join-Path $job 'stage'
  $backup=Join-Path $job 'before'
  foreach ($target in @($stage,$backup)) {
    $absolute=[IO.Path]::GetFullPath($target)
    if (!$absolute.StartsWith($ProjectRoot+'\logs\deploy\',[StringComparison]::OrdinalIgnoreCase)) { throw '작업 경로 이탈입니다.' }
    New-Item -ItemType Directory -Path $absolute -Force | Out-Null
  }
  foreach ($item in $items) { Copy-Item -LiteralPath (Join-Path $Release $item) -Destination (Join-Path $stage $item) -Recurse }
  try {
    if (!$originalHalted) { Control 'pause'; $paused=$true }
    $ready=Read-Status
    Assert-Paper $ready
    if (!$ready.halted -or $ready.balance.krw -ne $before.balance.krw) { throw '배포 준비 중 상태가 바뀌었습니다.' }
    if ($TaskName -eq 'AST-Paper-Trader') {
      $observer=Get-ScheduledTask -TaskName AST-Paper-Observation -ErrorAction SilentlyContinue
      if ($observer) {
        $observerToResume=$true
        if ($observer.State -eq 'Running') { Stop-ScheduledTask -TaskName AST-Paper-Observation }
        if (Test-Path -LiteralPath "$ProjectRoot\logs\paper-observation.json") { Copy-Item -LiteralPath "$ProjectRoot\logs\paper-observation.json" -Destination "$job\observation-before.json" }
      }
    }
    $stopped=$true
    Stop-App
    foreach ($item in $items) {
      $live=Join-Path $ProjectRoot $item
      if (Test-Path -LiteralPath $live) { Move-Item -LiteralPath $live -Destination (Join-Path $backup $item) }
      $moved.Add($item)
      Move-Item -LiteralPath (Join-Path $stage $item) -Destination $live
    }
    Start-App
    $started=$true
    Healthy $before
  } catch {
    $failure=$_
    if ($moved.Count) {
      Stop-App
      $failed=Join-Path $job 'failed'
      New-Item -ItemType Directory -Path $failed | Out-Null
      foreach ($item in $moved) {
        $live=Join-Path $ProjectRoot $item
        if (Test-Path -LiteralPath $live) { Move-Item -LiteralPath $live -Destination (Join-Path $failed $item) }
        $old=Join-Path $backup $item
        if (Test-Path -LiteralPath $old) { Move-Item -LiteralPath $old -Destination $live }
      }
      Start-App
      Healthy $before
      Write-Output '이전 코드로 복구했습니다.'
    } elseif ($stopped) { Start-App }
    if ($paused) { Control 'resume'; $paused=$false }
    throw $failure
  }
  if ($paused) { Control 'resume'; $paused=$false }
  @{sha=$Sha;state='deployed';at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()} | ConvertTo-Json | Set-Content -LiteralPath "$job\result.json" -Encoding UTF8
  Write-Output "배포 성공: $Sha"
} finally {
  if ($observerToResume) { Start-ScheduledTask -TaskName AST-Paper-Observation }
  if ($owned) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
