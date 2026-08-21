@echo off
set ADB=C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe
set APK=d:\PROYECTO RED\client\app\android\app\build\outputs\apk\debug\app-debug.apk

echo Instalando en Note 14 (6dife65ls485fega)...
"%ADB%" -s 6dife65ls485fega install -r "%APK%"
if %ERRORLEVEL% NEQ 0 echo FALLO Note 14 && exit /b 1
echo OK Note 14

echo Instalando en Moto G22 (ZT322B386P)...
"%ADB%" -s ZT322B386P install -r "%APK%"
if %ERRORLEVEL% NEQ 0 echo FALLO Moto G22 && exit /b 1
echo OK Moto G22
echo INSTALACION COMPLETA
