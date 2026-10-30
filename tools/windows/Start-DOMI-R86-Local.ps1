<#
.SYNOPSIS
  DOMI R86 — start real local API and Web with a separate synthetic-only DB.
.DESCRIPTION
  Dev-only loopback pilot; no Render, Neon, credentials, real family data,
  public DNS, model provider, or production changes. Works with the existing
  apps and dependencies; does not install or update packages.
  Run Setup-LocalDev.ps1 once first (inspect it before execution).
  Only invented identities and activities are permitted for this experiment.
#>

[CmdletBinding()]
param([switch]$NoBrowser)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
    throw "R86 only supports a Windows workstation."
}
if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw "A per-user LOCALAPPDATA folder is required."
}

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ApiDir = Join-Path $RepoRoot "apps\api"
$WebDir = Join-Path $RepoRoot "apps\web"
$ApiRunner = Join-Path $PSScriptRoot "Run-API.ps1"
$WebRunner = Join-Path $PSScriptRoot "Run-DOMI-R86-Web.ps1"

foreach ($required in @(
    (Join-Path $ApiDir ".venv\Scripts\Activate.ps1"),
    (Join-Path $ApiDir ".env"),
    (Join-Path $WebDir "node_modules"),
    (Join-Path $WebDir ".env.local"),
    $ApiRunner,
    $WebRunner
)) {
    if (-not (Test-Path $required)) {
        throw "Prerequisite missing. Run .\tools\windows\Setup-LocalDev.ps1 and check $required"
    }
}

function Test-LoopbackPort([int] $Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync("127.0.0.1", $Port)
        return ($task.Wait(350) -and $client.Connected)
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

# Never attach this launcher to an arbitrary existing API or browser server.
foreach ($port in @(8001, 3000)) {
    if (Test-LoopbackPort $port) {
        throw "Port $port is in use. Stop the existing local server before starting isolated R86."
    }
}

# Isolated, durable PER-USER local SQLite database. Never reuse the usual
# apps/api/vantdomus.db or a Neon/Render database.
$PilotDir = Join-Path $env:LOCALAPPDATA "DOMI\R86-SyntheticOnly"
New-Item -ItemType Directory -Path $PilotDir -Force | Out-Null
$env:APP_ENV = "local"
$env:DB_PATH = Join-Path $PilotDir "domi-r86-fictional.sqlite"
$env:DATABASE_URL = ""
$env:VANTDOMUS_ALLOWED_HOSTS = "127.0.0.1,localhost"
$env:CORS_ALLOWED_ORIGINS = "http://127.0.0.1:3000,http://localhost:3000"
$env:VANTDOMUS_APP_PUBLIC_URL = "http://127.0.0.1:3000"
$env:VANTDOMUS_ALLOW_DEMO_SEED = "false"
$env:VANTDOMUS_PUBLIC_REGISTRATION = "true"
$env:VANTDOMUS_ENABLE_PUBLIC_UPLOADS = "false"
$env:ASSISTANT_PROVIDER_MODE = "mock"
$env:ASSISTANT_REAL_PROVIDER_ENABLED = "false"
$env:ASSISTANT_SHADOW_MODE = "false"
$env:ASSISTANT_EXTERNAL_CALLS_ALLOWED = "false"
$env:OPENAI_API_KEY = ""
$env:NEXT_PUBLIC_API_BASE = "http://127.0.0.1:8001"

Write-Host ""
Write-Host "DOMI R86 — ensayo local aislado" -ForegroundColor Cyan
Write-Host "Solo datos ficticios. No usar información de la familia real." -ForegroundColor Yellow
Write-Host "Backend: http://127.0.0.1:8001 | Web: http://127.0.0.1:3000" -ForegroundColor Cyan
Write-Host "Las dos ventanas deben mantenerse abiertas. CTRL+C para detener." -ForegroundColor DarkGray

# Each child inherits the forced loopback endpoints and separate database.
# No environment files, secrets or URLs are uploaded or written to the repo.
$apiArgs = '-NoProfile -NoExit -File "' + $ApiRunner + '"'
$webArgs = '-NoProfile -NoExit -File "' + $WebRunner + '"'
$ApiProcess = Start-Process -FilePath "powershell.exe" -ArgumentList $apiArgs -WorkingDirectory $RepoRoot -PassThru

$apiHealthy = $false
for ($i = 0; $i -lt 45; $i++) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8001/health" -TimeoutSec 2
        if ($health.ok -eq $true -and $health.service -eq "vantdomus-core") {
            $apiHealthy = $true
            break
        }
    } catch {
        # Keep local health probing; no cloud fallback.
    }
    Start-Sleep -Milliseconds 800
}
if (-not $apiHealthy) {
    Write-Warning "Local API did not meet the expected health contract. Inspect its terminal."
    throw "R86_BACKEND_HEALTH_NOT_READY"
}
Write-Host "API local: health contract passed." -ForegroundColor Green

$WebProcess = Start-Process -FilePath "powershell.exe" -ArgumentList $webArgs -WorkingDirectory $RepoRoot -PassThru
$webHealthy = $false
for ($i = 0; $i -lt 45; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/login" -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            $webHealthy = $true
            break
        }
    } catch {
        # Browser login page may still be compiling in Next dev.
    }
    Start-Sleep -Milliseconds 800
}
if (-not $webHealthy) {
    Write-Warning "Web login did not return HTTP 200. Inspect the web terminal."
    throw "R86_WEB_NOT_READY"
}
Write-Host "Web local: login page responds." -ForegroundColor Green

Write-Host "Local pilot is reachable. Use /local-first-run for fictional account and household." -ForegroundColor Yellow
Write-Host "Local data stays on THIS Windows user profile; it does not sync with a phone." -ForegroundColor Yellow

if (-not $NoBrowser) {
    Start-Process "http://127.0.0.1:3000/local-first-run"
}
