@echo off
setlocal
set "ADB=C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"
set "APK=d:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk"

echo.
echo === Reintento: NOTE14 XIAOMI (6dife65ls485fega) ===
echo Acepta el dialogo de instalacion en el Note14 ahora...
%ADB% -s 6dife65ls485fega install -r "%APK%"
if %ERRORLEVEL% EQU 0 (
    echo   [OK] Note14 instalado v60.0.0
    %ADB% -s 6dife65ls485fega shell dumpsys package f.red.app | findstr versionName
    %ADB% -s 6dife65ls485fega shell am start -n f.red.app/.MainActivity
) else (
    echo   [FAIL] Note14 - revisa el dispositivo fisicamente
)
endlocal
