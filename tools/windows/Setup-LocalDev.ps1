<#
.SYNOPSIS
    Setup completo de entorno local para VantDomus (API + Web).
    Se corre UNA SOLA VEZ. Crea virtualenv, instala deps, genera .env.

.DESCRIPTION
    1. Verifica pre-requisitos (Python 3.11+, Node 18/20)
    2. Crea venv en apps/api/.venv y instala deps API
    3. Genera apps/api/.env con secretos frescos para local
    4. Instala deps web en apps/web/node_modules
    5. Genera apps/web/.env.local apuntando a 127.0.0.1:8001

.NOTES
    Después de correr este script, abrí 2 terminales separadas:
      Terminal 1: tools\windows\Run-API.ps1
      Terminal 2: tools\windows\Run-Web.ps1
    Y abrí http://localhost:3000 en Edge.
#>

[CmdletBinding()]
param(
    [switch]$SkipApiDeps,
    [switch]$SkipWebDeps,
    [switch]$RegenerateEnv
)

$ErrorActionPreference = "Stop"

# Resolver root del proyecto (este script vive en tools\windows\)
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ApiDir   = Join-Path $RepoRoot "apps\api"
$WebDir   = Join-Path $RepoRoot "apps\web"

Write-Host ""
Write-Host "  VantDomus local dev setup" -ForegroundColor Cyan
Write-Host "  Repo: $RepoRoot" -ForegroundColor DarkGray
Write-Host ""

# ============================================================================
# Pre-requisitos
# ============================================================================
Write-Host "[1/6] Verificando pre-requisitos..." -ForegroundColor Cyan

function Test-Command($name) {
    try { Get-Command $name -ErrorAction Stop | Out-Null; return $true }
    catch { return $false }
}

if (-not (Test-Command "python")) {
    Write-Error "Python no está instalado o no está en PATH. Instalalo desde https://python.org (3.11 o superior)."
}
$pyVersion = (& python --version 2>&1) -replace "Python\s+",""
Write-Host "  Python: $pyVersion" -ForegroundColor DarkGray

if (-not (Test-Command "node")) {
    Write-Error "Node.js no está instalado o no está en PATH. Instalalo desde https://nodejs.org (18 o 20)."
}
$nodeVersion = (& node --version 2>&1)
Write-Host "  Node:   $nodeVersion" -ForegroundColor DarkGray

if (-not (Test-Command "npm")) {
    Write-Error "npm no está disponible. Reinstalá Node.js para incluir npm."
}

# ============================================================================
# API: virtualenv + deps
# ============================================================================
if (-not $SkipApiDeps) {
    Write-Host ""
    Write-Host "[2/6] Configurando virtualenv del API..." -ForegroundColor Cyan
    Push-Location $ApiDir
    try {
        $venvPath = Join-Path $ApiDir ".venv"
        if (-not (Test-Path $venvPath)) {
            Write-Host "  Creando virtualenv en .venv ..." -ForegroundColor DarkGray
            python -m venv .venv
        } else {
            Write-Host "  Virtualenv ya existe en .venv (skip create)" -ForegroundColor DarkGray
        }

        Write-Host "[3/6] Instalando dependencias del API (tarda 1-3 min)..." -ForegroundColor Cyan
        # Activar venv
        $activate = Join-Path $venvPath "Scripts\Activate.ps1"
        . $activate
        python -m pip install --upgrade pip --quiet

        # Preferir requirements-local.txt (sin psycopg2-binary, versiones
        # tolerantes para Python 3.13/3.14) si está presente. Si no, caer
        # a requirements.txt (pineado, pensado para Python 3.11 + Postgres).
        $reqFile = "requirements.txt"
        if (Test-Path "requirements-local.txt") {
            $reqFile = "requirements-local.txt"
            Write-Host "  Usando requirements-local.txt (SQLite + versiones tolerantes)" -ForegroundColor DarkGray
        }

        pip install -r $reqFile --quiet
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "pip install fallo. Probar manualmente: cd $ApiDir; .\.venv\Scripts\Activate.ps1; pip install -r $reqFile"
            throw "API deps install failed"
        }
        Write-Host "  OK" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[2/6] [SKIP] Virtualenv del API" -ForegroundColor DarkGray
    Write-Host "[3/6] [SKIP] Deps del API" -ForegroundColor DarkGray
}

# ============================================================================
# API: .env
# ============================================================================
Write-Host ""
Write-Host "[4/6] Generando apps/api/.env (secretos locales)..." -ForegroundColor Cyan
$apiEnvPath = Join-Path $ApiDir ".env"
if ((Test-Path $apiEnvPath) -and (-not $RegenerateEnv)) {
    Write-Host "  apps/api/.env ya existe. Para regenerar pasá -RegenerateEnv." -ForegroundColor DarkGray
} else {
    function New-HexSecret([int]$bytes = 32) {
        $b = New-Object Byte[] $bytes
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
        # [Convert]::ToHexString existe solo en PowerShell 7+ / .NET 5+.
        # BitConverter funciona en Windows PowerShell 5.1 también.
        return ([System.BitConverter]::ToString($b) -replace '-', '').ToLower()
    }
    $jwtSecret  = New-HexSecret 32
    $mfaSecret  = New-HexSecret 32
    $backupKey  = New-HexSecret 32

    $apiEnv = @"
# Generado por tools/windows/Setup-LocalDev.ps1
# NO commitear este archivo. Está en .gitignore.
APP_ENV=local
DB_PATH=vantdomus.db
DATABASE_URL=
JWT_SECRET=$jwtSecret
VANTDOMUS_MFA_SECRET_KEY=$mfaSecret
VANTDOMUS_BACKUP_ENCRYPTION_KEY=$backupKey
VANTDOMUS_ALLOW_DEMO_SEED=true
VANTDOMUS_ALLOW_NOTIFICATION_TESTS=false
VANTDOMUS_ENABLE_PUBLIC_UPLOADS=false
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
VANTDOMUS_APP_PUBLIC_URL=http://127.0.0.1:3000
VANTDOMUS_ALLOWED_HOSTS=127.0.0.1,localhost
VANTDOMUS_MIN_PASSWORD_LENGTH=10
VANTDOMUS_AI_FEATURES_ENABLED=false
VANTDOMUS_AI_PROVIDER=openai
VANTDOMUS_AI_KEYS_MODE=platform
VANTDOMUS_SECRET_MANAGER=env
OPENAI_API_KEY=
VANTDOMUS_API_RATE_LIMIT_MODE=memory
VANTDOMUS_MALWARE_SCAN_MODE=basic
VANTDOMUS_MALWARE_FAIL_CLOSED=false
"@
    $apiEnv | Out-File -FilePath $apiEnvPath -Encoding utf8 -NoNewline
    Write-Host "  Creado apps/api/.env con secrets nuevos" -ForegroundColor Green
}

# ============================================================================
# Web: deps
# ============================================================================
if (-not $SkipWebDeps) {
    Write-Host ""
    Write-Host "[5/6] Instalando dependencias del Web (tarda 2-4 min)..." -ForegroundColor Cyan
    Push-Location $WebDir
    try {
        npm install --no-audit --no-fund 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "npm install falló. Probá manualmente: cd $WebDir; npm install"
            throw "Web deps install failed"
        }
        Write-Host "  OK" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[5/6] [SKIP] Deps del Web" -ForegroundColor DarkGray
}

# ============================================================================
# Web: .env.local
# ============================================================================
Write-Host ""
Write-Host "[6/6] Generando apps/web/.env.local..." -ForegroundColor Cyan
$webEnvPath = Join-Path $WebDir ".env.local"
$webEnv = @"
# Generado por tools/windows/Setup-LocalDev.ps1
APP_ENV=local
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001
"@
$webEnv | Out-File -FilePath $webEnvPath -Encoding utf8 -NoNewline
Write-Host "  Creado apps/web/.env.local" -ForegroundColor Green

# ============================================================================
# Cierre
# ============================================================================
Write-Host ""
Write-Host "  Setup completo." -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Terminal 1 (API):"
Write-Host "    .\tools\windows\Run-API.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Terminal 2 (Web):"
Write-Host "    .\tools\windows\Run-Web.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Browser:"
Write-Host "    http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Cuando los dos estén corriendo, registrá una cuenta y desde el"
Write-Host "dashboard hacé click en 'Cargar familia de muestra' para poblar el demo."
Write-Host ""
