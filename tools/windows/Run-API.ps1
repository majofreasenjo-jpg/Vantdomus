<#
.SYNOPSIS
    Arranca el API VantDomus en http://127.0.0.1:8001
.NOTES
    Requiere haber corrido Setup-LocalDev.ps1 al menos una vez.
    CTRL+C para detener.
#>

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ApiDir   = Join-Path $RepoRoot "apps\api"
$venv     = Join-Path $ApiDir ".venv\Scripts\Activate.ps1"

if (-not (Test-Path $venv)) {
    Write-Error "No hay virtualenv en apps/api/.venv. Corré primero: .\tools\windows\Setup-LocalDev.ps1"
}

Push-Location $ApiDir
try {
    Write-Host ""
    Write-Host "  VantDomus API local" -ForegroundColor Cyan
    Write-Host "  URL: http://127.0.0.1:8001" -ForegroundColor Yellow
    Write-Host "  Health: http://127.0.0.1:8001/health" -ForegroundColor DarkGray
    Write-Host "  Docs:  http://127.0.0.1:8001/docs" -ForegroundColor DarkGray
    Write-Host "  CTRL+C para detener" -ForegroundColor DarkGray
    Write-Host ""

    . $venv
    python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
} finally {
    Pop-Location
}
