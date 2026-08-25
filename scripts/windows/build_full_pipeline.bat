@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0..\.."
pushd "%ROOT_DIR%"

echo ================================================================
echo   RED v63.0.0 — PIPELINE MAESTRO DE COMPILACION Y DISTRIBUCION
echo ================================================================

echo.
echo [1/5] Compilando Next.js para Exportacion Mobile (basePath='')...
cd /d "%ROOT_DIR%\client\app"
call npm run build:mobile
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo npm run build:mobile
    popd
    exit /b 1
)

echo.
echo [2/5] Sincronizando Capacitor Android...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo npx cap sync android
    popd
    exit /b 1
)

echo.
echo [3/5] Compilando APK Release Nativo con Gradle...
call "%ROOT_DIR%\scripts\windows\build_apk.bat"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo Gradle assembleRelease
    popd
    exit /b 1
)

echo.
echo [4/5] Actualizando binarios en release-assets...
set "SRC_APK=%ROOT_DIR%\client\app\android\app\build\outputs\apk\release\app-release.apk"
if not exist "%ROOT_DIR%\release-assets" mkdir "%ROOT_DIR%\release-assets"

copy /Y "%SRC_APK%" "%ROOT_DIR%\release-assets\RED-v63.0.0.apk"
copy /Y "%SRC_APK%" "%ROOT_DIR%\release-assets\red-v63.0.0-latest.apk"
copy /Y "%SRC_APK%" "%ROOT_DIR%\release-assets\red-latest.apk"
copy /Y "%SRC_APK%" "%ROOT_DIR%\release-assets\app-release.apk"

echo Calculando checksum SHA-256...
powershell -Command "$hash = (Get-FileHash '%ROOT_DIR%\release-assets\red-v63.0.0-latest.apk' -Algorithm SHA256).Hash.ToLower(); $nodeHash = if (Test-Path '%ROOT_DIR%\release-assets\red-node.exe') { (Get-FileHash '%ROOT_DIR%\release-assets\red-node.exe' -Algorithm SHA256).Hash.ToLower() } else { 'N/A' }; \"$hash  RED-v63.0.0.apk`n$hash  red-v63.0.0-latest.apk`n$hash  red-latest.apk`n$hash  app-release.apk`n$nodeHash  red-node.exe\" | Out-File -Encoding utf8 '%ROOT_DIR%\release-assets\SHA256SUMS.txt'; Copy-Item '%ROOT_DIR%\release-assets\SHA256SUMS.txt' '%ROOT_DIR%\SHA256SUMS.txt' -Force"

echo.
echo [5/5] Compilando Next.js para GitHub Pages (basePath='/RED')...
cd /d "%ROOT_DIR%\client\app"
call npm run build:gh
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo npm run build:gh
    popd
    exit /b 1
)

echo.
echo ================================================================
echo   PIPELINE MAESTRO COMPLETADO CON EXITO (v63.0.0)
echo   Artefactos en: release-assets/ y client/app/out/
echo ================================================================
popd
endlocal
