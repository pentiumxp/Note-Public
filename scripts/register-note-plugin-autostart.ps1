param(
  [int]$Port = 4181,
  [string]$HostName = "127.0.0.1",
  [string]$WorkspaceId = "note:yinxiang_import",
  [string]$TaskName = "HermesMobileNotePluginWatchdog"
)

$ErrorActionPreference = "Stop"

$WatchdogPath = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "note-plugin-watchdog.ps1")
$ProjectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")

$argument = "-NoProfile -ExecutionPolicy Bypass -File `"$WatchdogPath`" -Port $Port -HostName `"$HostName`" -WorkspaceId `"$WorkspaceId`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument -WorkingDirectory $ProjectRoot
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$minuteTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger @($logonTrigger, $minuteTrigger) `
  -Settings $settings `
  -Principal $principal `
  -Description "Keeps the Hermes Mobile Note plugin listening on ${HostName}:${Port} with current user permissions." `
  -Force | Out-Null

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $WatchdogPath -Port $Port -HostName $HostName -WorkspaceId $WorkspaceId

Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State
