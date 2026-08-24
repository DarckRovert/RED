@echo off
setlocal
set "ADB=C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"
set "APK=d:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk"
set "ASSETS=d:\PROYECTO RED\release-assets"

echo.
echo ====================================================
echo   RED v61.0.0 — Despliegue Limpio en Dispositivos
echo ====================================================

echo.
echo [1/2] MOTO G22 (ZT322B386P)
echo Desinstalando version anterior...
%ADB% -s ZT322B386P uninstall f.red.app >nul 2>&1
echo Instalando APK v61.0.0 limpia...
%ADB% -s ZT322B386P install -r -g "%APK%"
if %ERRORLEVEL% EQU 0 (echo   [OK] Moto G22 instalado v61.0.0) else (echo   [FAIL] Moto G22)

echo.
echo [2/2] TABLET TB305XU (HA2CHKZ2)
echo Desinstalando version anterior...
%ADB% -s HA2CHKZ2 uninstall f.red.app >nul 2>&1
echo Instalando APK v61.0.0 limpia...
%ADB% -s HA2CHKZ2 install -r -g "%APK%"
if %ERRORLEVEL% EQU 0 (echo   [OK] Tablet instalada v61.0.0) else (echo   [FAIL] Tablet)

echo.
echo === Verificando versiones instaladas ===
echo Moto G22:
%ADB% -s ZT322B386P shell dumpsys package f.red.app | findstr versionName
echo Tablet:
%ADB% -s HA2CHKZ2 shell dumpsys package f.red.app | findstr versionName

echo.
echo === Iniciando app en dispositivos activos ===
%ADB% -s ZT322B386P shell am start -n f.red.app/.MainActivity
%ADB% -s HA2CHKZ2 shell am start -n f.red.app/.MainActivity

echo.
echo === Despliegue completado ===
endlocal
