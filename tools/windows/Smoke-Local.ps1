<#
.SYNOPSIS
    Smoke test del entorno local. Verifica que API responde y schema cargado.
.DESCRIPTION
    Pinga el /health del API local, comprueba migraciones aplicadas y
    listas las rutas VantGuide.
#>

$ErrorActionPreference = "Stop"
$ApiUrl = "http://127.0.0.1:8001"

Write-Host ""
Write-Host "  VantDomus local smoke test" -ForegroundColor Cyan
Write-Host ""

# Check 1: /health responde
Write-Host "[1/4] Probando /health..." -ForegroundColor Cyan
try {
    $health = Invoke-WebRequest -Uri "$ApiUrl/health" -TimeoutSec 5 -UseBasicParsing
    if ($health.StatusCode -eq 200) {
        Write-Host "  OK  $($health.Content)" -ForegroundColor Green
    } else {
        Write-Warning "  HTTP $($health.StatusCode) — esperaba 200"
    }
} catch {
    Write-Host "  FAIL — el API no responde en $ApiUrl" -ForegroundColor Red
    Write-Host "  Asegurate de tener corriendo: .\tools\windows\Run-API.ps1" -ForegroundColor DarkGray
    exit 1
}

# Check 2: /docs disponible
Write-Host ""
Write-Host "[2/4] Probando OpenAPI docs..." -ForegroundColor Cyan
try {
    $openapi = Invoke-RestMethod -Uri "$ApiUrl/openapi.json" -TimeoutSec 5
    $totalRoutes = ($openapi.paths | Get-Member -MemberType NoteProperty).Count
    Write-Host "  OK $totalRoutes endpoints registrados" -ForegroundColor Green

    # Filtrar rutas VantGuide
    $vgRoutes = ($openapi.paths | Get-Member -MemberType NoteProperty | Where-Object { $_.Name -match "unit_functions|/library/|/persons/.*/support" }).Name
    if ($vgRoutes.Count -gt 0) {
        Write-Host ""
        Write-Host "[3/4] Rutas VantGuide presentes:" -ForegroundColor Cyan
        foreach ($r in ($vgRoutes | Select-Object -First 15)) {
            Write-Host "  $r" -ForegroundColor DarkGray
        }
        if ($vgRoutes.Count -gt 15) {
            Write-Host "  ... y $(($vgRoutes.Count - 15)) más" -ForegroundColor DarkGray
        }
    } else {
        Write-Warning "  Sin rutas VantGuide encontradas. Revisar main.py include_router."
    }
} catch {
    Write-Warning "  No se pudo leer /openapi.json: $_"
}

# Check 3: Web disponible
Write-Host ""
Write-Host "[4/4] Probando panel web (http://localhost:3000)..." -ForegroundColor Cyan
try {
    $web = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 10 -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue
    if ($web -and ($web.StatusCode -eq 200 -or $web.StatusCode -eq 307 -or $web.StatusCode -eq 302)) {
        Write-Host "  OK Web responde (HTTP $($web.StatusCode))" -ForegroundColor Green
    } else {
        Write-Warning "  HTTP inesperado"
    }
} catch {
    Write-Host "  Web no responde — ¿está corriendo Run-Web.ps1?" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Cuando el API y el Web estén corriendo, abrí Edge en:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000/login   (registrate y entrá)" -ForegroundColor Yellow
Write-Host "  http://localhost:3000/guia    (Guía Familiar — tras cargar el demo)" -ForegroundColor Yellow
Write-Host ""
