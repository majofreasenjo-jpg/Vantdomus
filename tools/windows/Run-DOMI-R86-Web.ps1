<#
.SYNOPSIS
  Start the preinstalled DOMI web client strictly on localhost for R86.
#>
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$web = Join-Path $repo "apps\web"
if (-not (Test-Path (Join-Path $web "node_modules"))) {
    throw "Install the web dependencies using the existing local setup before starting R86."
}
$env:APP_ENV = "local"
$env:NEXT_PUBLIC_API_BASE = "http://127.0.0.1:8001"
Push-Location $web
try {
    npm run dev -- --hostname 127.0.0.1 --port 3000
    if ($LASTEXITCODE -ne 0) { throw "R86 web process exited with failure." }
} finally {
    Pop-Location
}
