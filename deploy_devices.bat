@echo off
setlocal
set "ADB=C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"
set "APK=d:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk"
set "ASSETS=d:\PROYECTO RED\release-assets"

echo.
echo ====================================================
echo   RED v60.0.0 — Despliegue Limpio en 3 Dispositivos
echo ====================================================

echo.
echo [1/3] MOTO G22 (ZT322B386P)
%ADB% -s ZT322B386P install -r -g "%APK%"
if %ERRORLEVEL% EQU 0 (echo   [OK] Moto G22 instalado v60.0.0) else (echo   [FAIL] Moto G22)

echo.
echo [2/3] TABLET TB305XU (HA2CHKZ2)
%ADB% -s HA2CHKZ2 install -r -g "%APK%"
if %ERRORLEVEL% EQU 0 (echo   [OK] Tablet instalada v60.0.0) else (echo   [FAIL] Tablet)

echo.
echo [3/3] NOTE14 XIAOMI (6dife65ls485fega)
echo Enviando APK al almacenamiento interno del Note14 (/sdcard/Download/)...
%ADB% -s 6dife65ls485fega push "%APK%" /sdcard/Download/red-v60.0.0-latest.apk
%ADB% -s 6dife65ls485fega install -r -g -d "%APK%"
if %ERRORLEVEL% EQU 0 (echo   [OK] Note14 instalado v60.0.0) else (echo   [AVISO] Note14: Acepta el dialogo en la pantalla del dispositivo o instala desde /sdcard/Download/red-v60.0.0-latest.apk)

echo.
echo === Verificando versiones instaladas ===
echo Moto G22:
%ADB% -s ZT322B386P shell dumpsys package f.red.app | findstr versionName
echo Tablet:
%ADB% -s HA2CHKZ2 shell dumpsys package f.red.app | findstr versionName
echo Note14:
%ADB% -s 6dife65ls485fega shell dumpsys package f.red.app | findstr versionName

echo.
echo === Iniciando app en dispositivos activos ===
%ADB% -s ZT322B386P shell am start -n f.red.app/.MainActivity
%ADB% -s HA2CHKZ2 shell am start -n f.red.app/.MainActivity
%ADB% -s 6dife65ls485fega shell am start -n f.red.app/.MainActivity 2>nul

echo.
echo === Despliegue completado ===
endlocal
