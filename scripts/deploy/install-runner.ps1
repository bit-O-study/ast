$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$inputData=[Console]::ReadLine() | ConvertFrom-Json
$root='C:\services\Bit-O\ast'
$runner=Join-Path $root 'runner'
$archive='C:\services\Bit-O\tools\actions-runner.zip'
if (Test-Path -LiteralPath "$runner\.runner") { throw '기존 AST 러너 설정을 먼저 확인하세요.' }
if ($inputData.digest -notmatch '^sha256:[a-f0-9]{64}$' -or $inputData.url -notmatch '^https://github.com/actions/runner/releases/download/v[0-9.]+/actions-runner-win-x64-[0-9.]+\.zip$') { throw '러너 배포 정보가 올바르지 않습니다.' }
if (!(Test-Path -LiteralPath $archive)) { Invoke-WebRequest -UseBasicParsing -Uri $inputData.url -OutFile $archive }
if ((Get-FileHash -LiteralPath $archive).Hash.ToLower() -ne ($inputData.digest -replace '^sha256:','')) { throw '러너 체크섬이 다릅니다.' }
New-Item -ItemType Directory -Path $runner -Force | Out-Null
& icacls $root /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw '러너 폴더 ACL 설정 실패' }
& tar -xf $archive -C $runner
if ($LASTEXITCODE -ne 0) { throw '러너 압축 해제 실패' }
$env:ACTIONS_RUNNER_INPUT_TOKEN=$inputData.token
Push-Location $runner
try {
  & .\config.cmd --unattended --url https://github.com/bit-O-study/ast --name bito-server-ast --labels bito-ast --work _work --runasservice --windowslogonaccount 'NT AUTHORITY\SYSTEM'
  if ($LASTEXITCODE -ne 0) { throw 'AST 러너 등록 실패' }
} finally {
  Pop-Location
  Remove-Item Env:ACTIONS_RUNNER_INPUT_TOKEN -ErrorAction SilentlyContinue
  $inputData=$null
}
Get-Service -Name 'actions.runner.bit-O-study-ast.*' | Select-Object Name,Status
