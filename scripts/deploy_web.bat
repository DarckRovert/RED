@echo off
setlocal enabledelayedexpansion
echo ===================================================
echo   RED SOVEREIGN MESH - LOCAL WEB DEPLOYMENT (GH-PAGES)
echo ===================================================
echo [1/3] Compilando bundle estatico optimizado para GitHub Pages...
cd /d "%~dp0..\client\app"
call npm run build:gh
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la compilacion de Next.js
    exit /b %errorlevel%
)

echo [2/3] Generando archivos de enrutamiento estatico (.nojekyll, 404.html)...
copy /Y out\index.html out\404.html >nul
type nul > out\.nojekyll

echo [3/3] Publicando directamente en la rama gh-pages...
call npx -y gh-pages -d out -b gh-pages
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la publicacion a gh-pages
    exit /b %errorlevel%
)

echo ===================================================
echo   DEPLOY EXITOSO: https://darckrovert.github.io/RED/
echo ===================================================
