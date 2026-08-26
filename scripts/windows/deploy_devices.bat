@echo off
setlocal
set "ADB=C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"
set "APK=d:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk"
if not exist "%APK%" set "APK=d:\PROYECTO RED\release-assets\red-v64.0.0-release.apk"
set "ASSETS=d:\PROYECTO RED\release-assets"

echo.
echo ====================================================
echo   RED v64.0.0 — Despliegue Limpio en Dispositivos
echo ====================================================

echo.
echo [1/2] MOTO G22 (ZT322B386P)
echo Instalando APK v64.0.0 limpia...
%ADB% -s ZT322B386P install -r -d "%APK%"
if %ERRORLEVEL% EQU 0 (echo   [OK] Moto G22 instalado v64.0.0) else (echo   [FAIL] Moto G22)

echo.
echo [2/2] XIAOMI REDMI NOTE 14 5G / TABLET (6dife65ls485fega / HA2CHKZ2)
echo Instalando APK v64.0.0 limpia...
%ADB% -s 6dife65ls485fega install -r -d "%APK%" >nul 2>&1
%ADB% -s HA2CHKZ2 install -r -d "%APK%" >nul 2>&1

echo.
echo === Verificando versiones instaladas ===
echo Moto G22:
%ADB% -s ZT322B386P shell dumpsys package f.red.app | findstr versionName
echo Xiaomi Redmi Note 14:
%ADB% -s 6dife65ls485fega shell dumpsys package f.red.app | findstr versionName

echo.
echo === Iniciando app en dispositivos activos ===
%ADB% -s ZT322B386P shell am start -n f.red.app/.MainActivity
%ADB% -s 6dife65ls485fega shell am start -n f.red.app/.MainActivity

echo.
echo Despliegue v64.0.0 finalizado.
echo === Despliegue completado ===
endlocal
