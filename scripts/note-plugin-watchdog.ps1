param(
  [int]$Port = 4181,
  [string]$HostName = "127.0.0.1",
  [string]$WorkspaceId = "note:yinxiang_import"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$LogRoot = Join-Path $ProjectRoot "logs"
$LogPath = Join-Path $LogRoot "note-plugin-watchdog.log"

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null

function Write-WatchdogLog {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"
  Add-Content -LiteralPath $LogPath -Value "[$timestamp] $Message"
}

function Test-PortListening {
  param([int]$ListenPort)
  $connection = Get-NetTCPConnection -LocalPort $ListenPort -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -eq $HostName -or $_.LocalAddress -eq "0.0.0.0" -or $_.LocalAddress -eq "::" } |
    Select-Object -First 1
  return [bool]$connection
}

if (Test-PortListening -ListenPort $Port) {
  Write-WatchdogLog "Note plugin already listening on ${HostName}:${Port}"
  exit 0
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-WatchdogLog "node executable not found; cannot start Note plugin"
  exit 2
}

$env:HOST = $HostName
$env:PORT = [string]$Port
$env:NOTE_APP_WORKSPACE_ID = $WorkspaceId
$env:NOTE_DB_PATH = Join-Path $ProjectRoot "data\note.sqlite3"

Start-Process -FilePath $nodeCommand.Source `
  -ArgumentList @("scripts\note-server.js") `
  -WorkingDirectory $ProjectRoot `
  -WindowStyle Hidden

Start-Sleep -Seconds 2

if (Test-PortListening -ListenPort $Port) {
  Write-WatchdogLog "Started Note plugin on ${HostName}:${Port}"
  exit 0
}

Write-WatchdogLog "Start attempted but Note plugin is still not listening on ${HostName}:${Port}"
exit 1
