@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0..\.."
set "ADB=C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"

set "APK=%ROOT_DIR%\client\app\android\app\build\outputs\apk\release\app-release.apk"
if not exist "%APK%" set "APK=%ROOT_DIR%\release-assets\red-latest.apk"
if not exist "%APK%" set "APK=%ROOT_DIR%\release-assets\red-v96.0.0-release.apk"

echo.
echo ================================================================
echo   RED v96.0.0 — Despliegue Limpio en Moto G22 y Tablet Lenovo
echo ================================================================
echo APK a desplegar: %APK%

if not exist "%APK%" (
    echo [ERROR] No se encontro el archivo APK para desplegar.
    echo Asegurate de compilarlo primero con scripts\windows\build_apk.bat
    exit /b 1
)

echo.
echo === Verificando dispositivos ADB conectados ===
"%ADB%" devices -l

set "MOTO_ID=ZT322B386P"
set "TABLET_ID=HA2CHKZ2"
set "REDMI_ID=6dife65ls485fega"

rem ── 1. DESPLIEGUE EN MOTO G22 ───────────────────────────────────────────────
echo.
echo [1/2] Desplegando en MOTO G22 (%MOTO_ID%)...
"%ADB%" -s %MOTO_ID% get-state >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   -> Removiendo version antigua de f.red.app para instalacion limpia...
    "%ADB%" -s %MOTO_ID% uninstall f.red.app >nul 2>&1
    echo   -> Instalando APK v96.0.0 limpia...
    "%ADB%" -s %MOTO_ID% install -r -d "%APK%"
    if %ERRORLEVEL% EQU 0 (
        echo   [OK] Moto G22 instalado exitosamente.
        echo   -> Otorgando permisos de sensores, GNSS, camara y audio...
        "%ADB%" -s %MOTO_ID% shell pm grant f.red.app android.permission.ACCESS_FINE_LOCATION >nul 2>&1
        "%ADB%" -s %MOTO_ID% shell pm grant f.red.app android.permission.ACCESS_COARSE_LOCATION >nul 2>&1
        "%ADB%" -s %MOTO_ID% shell pm grant f.red.app android.permission.RECORD_AUDIO >nul 2>&1
        "%ADB%" -s %MOTO_ID% shell pm grant f.red.app android.permission.CAMERA >nul 2>&1
        "%ADB%" -s %MOTO_ID% shell pm grant f.red.app android.permission.POST_NOTIFICATIONS >nul 2>&1
        "%ADB%" -s %MOTO_ID% shell pm grant f.red.app android.permission.BLUETOOTH_SCAN >nul 2>&1
        "%ADB%" -s %MOTO_ID% shell pm grant f.red.app android.permission.BLUETOOTH_CONNECT >nul 2>&1
        "%ADB%" -s %MOTO_ID% shell pm grant f.red.app android.permission.BLUETOOTH_ADVERTISE >nul 2>&1
    ) else (
        echo   [FAIL] Error al instalar en Moto G22.
    )
) else (
    echo   [AVISO] Moto G22 no detectado.
)

rem ── 2. DESPLIEGUE EN TABLET LENOVO ──────────────────────────────────────────
echo.
echo [2/2] Desplegando en TABLET LENOVO - %TABLET_ID%...
"%ADB%" -s %TABLET_ID% get-state >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   -> Removiendo version antigua de f.red.app para instalacion limpia...
    "%ADB%" -s %TABLET_ID% uninstall f.red.app >nul 2>&1
    echo   -> Instalando APK v96.0.0 limpia...
    "%ADB%" -s %TABLET_ID% install -r -d "%APK%"
    if %ERRORLEVEL% EQU 0 (
        echo   [OK] Tablet Lenovo instalada exitosamente.
        echo   -> Otorgando permisos de sensores, GNSS, camara y audio...
        "%ADB%" -s %TABLET_ID% shell pm grant f.red.app android.permission.ACCESS_FINE_LOCATION >nul 2>&1
        "%ADB%" -s %TABLET_ID% shell pm grant f.red.app android.permission.ACCESS_COARSE_LOCATION >nul 2>&1
        "%ADB%" -s %TABLET_ID% shell pm grant f.red.app android.permission.RECORD_AUDIO >nul 2>&1
        "%ADB%" -s %TABLET_ID% shell pm grant f.red.app android.permission.CAMERA >nul 2>&1
        "%ADB%" -s %TABLET_ID% shell pm grant f.red.app android.permission.POST_NOTIFICATIONS >nul 2>&1
        "%ADB%" -s %TABLET_ID% shell pm grant f.red.app android.permission.BLUETOOTH_SCAN >nul 2>&1
        "%ADB%" -s %TABLET_ID% shell pm grant f.red.app android.permission.BLUETOOTH_CONNECT >nul 2>&1
        "%ADB%" -s %TABLET_ID% shell pm grant f.red.app android.permission.BLUETOOTH_ADVERTISE >nul 2>&1
    ) else (
        echo   [FAIL] Error al instalar en Tablet Lenovo.
    )
) else (
    echo   [AVISO] Tablet Lenovo no detectada por ADB.
)

rem ── 3. DISPOSITIVO ADICIONAL (SI ESTA CONECTADO) ────────────────────────────
"%ADB%" -s %REDMI_ID% get-state >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [ADICIONAL] Desplegando en Xiaomi Redmi Note 14 - %REDMI_ID%...
    "%ADB%" -s %REDMI_ID% install -r -d "%APK%" >nul 2>&1
)

rem ── 4. VERIFICACION DE VERSIONES INSTALADAS ────────────────────────────────
echo.
echo ================================================================
echo   VERIFICACION DE VERSIONES INSTALADAS VIA DUMPSYS
echo ================================================================
echo Moto G22 (%MOTO_ID%):
"%ADB%" -s %MOTO_ID% shell dumpsys package f.red.app 2>nul | findstr versionName
echo Tablet Lenovo (%TABLET_ID%):
"%ADB%" -s %TABLET_ID% shell dumpsys package f.red.app 2>nul | findstr versionName

rem ── 5. LANZAMIENTO DE ACTIVIDAD PRINCIPAL ──────────────────────────────────
echo.
echo === Iniciando aplicacion RED en dispositivos activos ===
"%ADB%" -s %MOTO_ID% shell am start -n f.red.app/.MainActivity >nul 2>&1
"%ADB%" -s %TABLET_ID% shell am start -n f.red.app/.MainActivity >nul 2>&1

echo.
echo ================================================================
echo   DESPLIEGUE v96.0.0 FINALIZADO CON EXITO
echo ================================================================
endlocal
