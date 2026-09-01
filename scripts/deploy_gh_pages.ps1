# ==============================================================================
# RED SOVEREIGN MESH - POWERSHELL WEB DEPLOYER (GH-PAGES)
# Despliegue determinista local sin dependencia de runners de GitHub Actions
# ==============================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Join-Path $ScriptDir "..\client\app"

Write-Host "[1/3] Compilando Next.js con Turbopack para GitHub Pages (/RED)..." -ForegroundColor Cyan
Push-Location $AppDir
try {
    $env:GITHUB_PAGES = "true"
    $env:NEXT_PUBLIC_BASE_PATH = "/RED"
    cmd /c "npm.cmd run build:gh"

    Write-Host "[2/3] Generando artefactos estaticos (404.html, .nojekyll)..." -ForegroundColor Cyan
    Copy-Item -Path "out\index.html" -Destination "out\404.html" -Force
    New-Item -ItemType File -Path "out\.nojekyll" -Force | Out-Null

    Write-Host "[3/3] Publicando bundle directamente en la rama gh-pages..." -ForegroundColor Cyan
    cmd /c "npx.cmd -y gh-pages -d out -b gh-pages"

    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "DESPLIEGUE EXITOSO: https://darckrovert.github.io/RED/" -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
}
finally {
    Pop-Location
}
