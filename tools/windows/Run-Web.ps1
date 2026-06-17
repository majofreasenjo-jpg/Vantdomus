<#
.SYNOPSIS
    Arranca el panel Web Next.js en http://localhost:3000
.NOTES
    Requiere haber corrido Setup-LocalDev.ps1 al menos una vez.
    El API debería estar corriendo en otra terminal (Run-API.ps1).
#>

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$WebDir   = Join-Path $RepoRoot "apps\web"

if (-not (Test-Path (Join-Path $WebDir "node_modules"))) {
    Write-Error "No hay node_modules en apps/web. Corré primero: .\tools\windows\Setup-LocalDev.ps1"
}

Push-Location $WebDir
try {
    Write-Host ""
    Write-Host "  VantDomus Web Panel" -ForegroundColor Cyan
    Write-Host "  URL: http://localhost:3000" -ForegroundColor Yellow
    Write-Host "  CTRL+C para detener" -ForegroundColor DarkGray
    Write-Host ""

    npm run dev
} finally {
    Pop-Location
}
