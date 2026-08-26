@echo off
set ADB=C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe
set APK=d:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk
if not exist "%APK%" set APK=d:\PROYECTO RED\release-assets\red-v64.0.0-release.apk

echo === INSTALACION MULTI-DISPOSITIVO RED (RELEASE v64.0.0) ===

for /f "tokens=1" %%d in ('"%ADB%" devices ^| findstr /v "List" ^| findstr "device$"') do (
    echo Instalando en %%d...
    "%ADB%" -s %%d install -r -d "%APK%"
    "%ADB%" -s %%d shell am start -n f.red.app/.MainActivity
)

echo INSTALACION FINALIZADA CON EXITO.
