@echo off
setlocal enabledelayedexpansion

echo ================================================================
echo   RED v60.0.0 — PIPELINE MAESTRO DE COMPILACION Y DISTRIBUCION
echo ================================================================

echo.
echo [1/6] Compilando Next.js para Exportacion Mobile (basePath='')...
cd /d "d:\PROYECTO RED\client\app"
call npm run build:mobile
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo npm run build:mobile
    exit /b 1
)

echo.
echo [2/6] Sincronizando Capacitor Android (16 plugins)...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo npx cap sync android
    exit /b 1
)

echo.
echo [3/6] Compilando APK Release Nativo con Gradle...
cd /d "d:\PROYECTO RED"
call "d:\PROYECTO RED\build_apk.bat"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo Gradle assembleRelease
    exit /b 1
)

echo.
echo [4/6] Actualizando binarios locales y release-assets...
set "SRC_APK=d:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk"
copy /Y "%SRC_APK%" "d:\PROYECTO RED\release-assets\red-v60.0.0-latest.apk"
copy /Y "%SRC_APK%" "d:\PROYECTO RED\release-assets\red-latest.apk"
copy /Y "%SRC_APK%" "d:\PROYECTO RED\red-v60.0.0-latest.apk"
copy /Y "%SRC_APK%" "d:\PROYECTO RED\red-latest.apk"
copy /Y "%SRC_APK%" "d:\PROYECTO RED\app-release.apk"

echo Calculando checksum SHA-256...
powershell -Command "$hash = (Get-FileHash 'd:\PROYECTO RED\release-assets\red-v60.0.0-latest.apk' -Algorithm SHA256).Hash.ToLower(); \"$hash  red-v60.0.0-latest.apk`n$hash  red-latest.apk`n6fccb4c061e1febb95add54b7458b693215cc69ac5f631ff0c8406697c50586b  red-node.exe\" | Out-File -Encoding ascii 'd:\PROYECTO RED\SHA256SUMS.txt'"

echo.
echo [5/6] Compilando Next.js para GitHub Pages (basePath='/RED')...
cd /d "d:\PROYECTO RED\client\app"
call npm run build:gh
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo npm run build:gh
    exit /b 1
)

echo.
echo [6/6] Desplegando bundle web a la raiz del repositorio para GitHub Pages...
xcopy /E /Y /I "d:\PROYECTO RED\client\app\out\*" "d:\PROYECTO RED\"

echo.
echo ================================================================
echo   PIPELINE MAESTRO COMPLETADO CON EXITO
echo ================================================================
endlocal
