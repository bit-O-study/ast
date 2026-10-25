param(
  [string]$ProjectRoot = 'C:\ast',
  [string]$NodePath = 'C:\Program Files\nodejs\node.exe',
  [ValidateRange(1, 3600)][int]$RetrySeconds = 60,
  [string]$MutexName = 'Global\AST-Paper-Trader'
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath "$ProjectRoot\src\index.js")) { throw '프로젝트 시작 파일이 없습니다.' }
if (!(Test-Path -LiteralPath $NodePath)) { throw 'Node.js 실행 파일이 없습니다.' }

# 다른 실행과 겹치지 않도록 서버 전체에서 하나의 모의투자만 실행한다.
$mutex = [Threading.Mutex]::new($false, $MutexName)
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$entryPath = Join-Path $ProjectRoot 'src\index.js'
$entryPattern = '(?i)(?:^|[\s"])' + [regex]::Escape($entryPath) + '(?=[\s"]|$)'
$owned = $false
try {
  try { $owned = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned = $true }
  if (!$owned) { exit 0 }
  Set-Location -LiteralPath $ProjectRoot
  New-Item -ItemType Directory -Path "$ProjectRoot\logs" -Force | Out-Null
  # .env보다 프로세스 환경변수가 우선하므로 이 작업은 항상 모의투자다.
  $env:MODE = 'paper'
  $env:LIVE_CONFIRM = 'NO'
  $env:HOST = '127.0.0.1'
  $env:PORT = '8787'
  $env:TZ = 'Asia/Seoul'
  while ($true) {
    $kstDate = [DateTime]::UtcNow.AddHours(9).ToString('yyyy-MM-dd')
    $logPath = Join-Path "$ProjectRoot\logs" ('paper-' + $kstDate + '.log')
    # 실행기만 죽고 Node가 남았으면 동일 데이터에 접근하는 새 실행을 막는다.
    $existing = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
      $_.CommandLine -and ($_.CommandLine.Replace('/', '\') -match $entryPattern)
    })
    if ($existing.Count -gt 0) {
      Add-Content -LiteralPath $logPath -Value '기존 모의투자 프로세스가 남아 있어 새 실행을 대기합니다.'
      Start-Sleep -Seconds $RetrySeconds
      continue
    }
    $ErrorActionPreference = 'Continue'
    & $NodePath "$ProjectRoot\src\index.js" >> $logPath 2>&1
    $nodeExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    # 작업 스케줄러의 재시작 여부와 무관하게 자식 프로세스를 복구한다.
    Add-Content -LiteralPath $logPath -Value ("모의투자 프로세스 종료 (코드 {0}). {1}초 뒤 다시 시작합니다." -f $nodeExit, $RetrySeconds)
    Start-Sleep -Seconds $RetrySeconds
  }
} finally {
  if ($owned) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
