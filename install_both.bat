@echo off
set ADB=C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe
set APK=d:\PROYECTO RED\client\app\android\app\build\outputs\apk\debug\app-debug.apk

echo === INSTALACION MULTI-DISPOSITIVO RED ===

for /f "tokens=1" %%d in ('"%ADB%" devices ^| findstr /v "List" ^| findstr "device$"') do (
    echo Instalando en %%d...
    "%ADB%" -s %%d install -r "%APK%"
    "%ADB%" -s %%d shell am start -n f.red.app/f.red.app.MainActivity
)

echo INSTALACION FINALIZADA CON EXITO.
