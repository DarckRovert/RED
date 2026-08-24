@echo off
setlocal
set "ADB=C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"
set "APK=d:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk"
set "ASSETS=d:\PROYECTO RED\release-assets"

echo.
echo === Copiando APK a release-assets ===
copy "%APK%" "%ASSETS%\red-v60.0.0-latest.apk"
copy "%APK%" "%ASSETS%\red-latest.apk"
echo COPY OK

echo.
echo ====================================================
echo   RED v60.0.0 — Despliegue Limpio en 3 Dispositivos
echo ====================================================

echo.
echo [1/3] MOTO G22 (ZT322B386P)
%ADB% -s ZT322B386P uninstall f.red.app
%ADB% -s ZT322B386P install -r "%APK%"
if %ERRORLEVEL% EQU 0 (echo   [OK] Moto G22 instalado v60.0.0) else (echo   [FAIL] Moto G22)

echo.
echo [2/3] TABLET TB305XU (HA2CHKZ2)
%ADB% -s HA2CHKZ2 uninstall f.red.app
%ADB% -s HA2CHKZ2 install -r "%APK%"
if %ERRORLEVEL% EQU 0 (echo   [OK] Tablet instalada v60.0.0) else (echo   [FAIL] Tablet)

echo.
echo [3/3] NOTE14 XIAOMI (6dife65ls485fega)
%ADB% -s 6dife65ls485fega uninstall f.red.app
%ADB% -s 6dife65ls485fega install -r "%APK%"
if %ERRORLEVEL% EQU 0 (echo   [OK] Note14 instalado v60.0.0) else (echo   [FAIL] Note14)

echo.
echo === Verificando versiones instaladas ===
echo Moto G22:
%ADB% -s ZT322B386P shell dumpsys package f.red.app | findstr versionName
echo Tablet:
%ADB% -s HA2CHKZ2 shell dumpsys package f.red.app | findstr versionName
echo Note14:
%ADB% -s 6dife65ls485fega shell dumpsys package f.red.app | findstr versionName

echo.
echo === Iniciando app en todos los dispositivos ===
%ADB% -s ZT322B386P shell am start -n f.red.app/.MainActivity
%ADB% -s HA2CHKZ2 shell am start -n f.red.app/.MainActivity
%ADB% -s 6dife65ls485fega shell am start -n f.red.app/.MainActivity

echo.
echo === Despliegue completado ===
endlocal
