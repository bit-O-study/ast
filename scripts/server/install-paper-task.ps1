param(
  [string]$ProjectRoot = 'C:\ast',
  [ValidatePattern('^(AST-Paper-Trader|AST-Test-[A-Za-z0-9-]+)$')][string]$TaskName = 'AST-Paper-Trader',
  [switch]$UpdateExisting
)
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$runner = Join-Path $ProjectRoot 'scripts\server\run-paper.ps1'
if (!(Test-Path -LiteralPath $runner)) { throw '모의투자 실행 스크립트가 없습니다.' }
$execute = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$oldArgument = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $runner + '"'
$argument = $oldArgument + ' -ProjectRoot "' + $ProjectRoot + '"'
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing -and !$UpdateExisting) { throw '기존 작업이 있습니다. 확인 후 UpdateExisting으로 갱신하세요.' }
if (!$existing -and $UpdateExisting) { throw '갱신할 기존 작업이 없습니다.' }
if ($existing) {
  $actions = @($existing.Actions)
  if ($actions.Count -ne 1 -or $actions[0].Execute -ne $execute -or
      @($argument, $oldArgument) -notcontains $actions[0].Arguments -or
      $actions[0].WorkingDirectory -ne $ProjectRoot -or
      @('SYSTEM', 'S-1-5-18') -notcontains $existing.Principal.UserId -or
      $existing.Settings.MultipleInstances -ne 2) {
    throw '기존 작업의 실행 경로/계정/중복 실행 설정이 다릅니다. 자동 갱신하지 않습니다.'
  }
}
$triggers = @(
  New-ScheduledTaskTrigger -AtStartup
  New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
)
if ($existing) {
  # 실행 중인 프로세스를 건드리지 않고 트리거만 갱신한다.
  Set-ScheduledTask -TaskName $TaskName -Trigger $triggers | Out-Null
} else {
  $action = New-ScheduledTaskAction -Execute $execute -Argument $argument -WorkingDirectory $ProjectRoot
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description 'AST 모의투자: 부팅 및 1분 반복 기동, 실행 중 중복 무시.' | Out-Null
  Start-ScheduledTask -TaskName $TaskName
}
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State
