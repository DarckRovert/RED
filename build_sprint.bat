@echo off
set JAVA_HOME=C:\Users\darck\.gradle\jdks\eclipse_adoptium-21-amd64-windows.2
set PATH=%JAVA_HOME%\bin;%PATH%
set CAPACITOR_BUILD=true

echo [1/3] Compilando Next.js...
cd /d "d:\PROYECTO RED\client\app"
call npx next build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR NEXT BUILD
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Sincronizando Capacitor Android...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo ERROR CAP SYNC
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Compilando APK Debug con Gradle...
cd /d "d:\PROYECTO RED\client\app\android"
call gradlew.bat assembleDebug --no-daemon
if %ERRORLEVEL% NEQ 0 (
    echo ERROR GRADLE ASSEMBLE
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================
echo BUILD SPRINT 1 + 2 COMPLETADO CON EXITO!
echo ========================================
