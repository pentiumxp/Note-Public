param(
  [int]$Port = 4181,
  [string]$HostName = "0.0.0.0",
  [string]$WorkspaceId = "note:owner",
  [string]$RegistrationKeyPath = ""
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

function Resolve-RegistrationKeyPath {
  param([string]$ExplicitPath)
  $candidates = @(
    $ExplicitPath,
    $env:NOTE_REGISTRATION_KEY_PATH,
    $env:HERMES_MOBILE_NOTE_PLUGIN_OWNER_KEY_PATH,
    "C:\ProgramData\HermesMobile\data\plugin-secrets\note-owner-key.txt",
    (Join-Path $ProjectRoot "data\plugin-secrets\note-owner-key.txt")
  ) | Where-Object { $_ }
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  return ""
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
$env:NOTE_REQUIRE_APP_LAUNCH_TOKEN = "1"
$env:NOTE_DB_PATH = Join-Path $ProjectRoot "data\note.sqlite3"
$env:NOTE_ATTACHMENT_DB_PATH = Join-Path $ProjectRoot "data\attachment.sqlite3"
$env:NOTE_ATTACHMENT_ROOT = Join-Path $ProjectRoot "data\attachments"
$resolvedRegistrationKeyPath = Resolve-RegistrationKeyPath -ExplicitPath $RegistrationKeyPath
if ($resolvedRegistrationKeyPath) {
  $env:NOTE_REGISTRATION_KEY_PATH = $resolvedRegistrationKeyPath
  Write-WatchdogLog "Using Note registration key file for workspace provisioning"
} else {
  Remove-Item Env:\NOTE_REGISTRATION_KEY_PATH -ErrorAction SilentlyContinue
  Write-WatchdogLog "No Note registration key file found; workspace provisioning will fail closed"
}

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
