@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%
set GITHUB_PAGES=
set NEXT_PUBLIC_BASE_PATH=
set CAPACITOR_BUILD=true

echo [1/3] Compilando Next.js Mobile Export...
cd /d "d:\PROYECTO RED\client\app"
call npm.cmd run build:mobile
if %ERRORLEVEL% NEQ 0 (
    echo ERROR NEXT BUILD MOBILE
    exit /b %ERRORLEVEL%
)

if not exist "d:\PROYECTO RED\client\app\out\index.html" (
    echo ERROR: out\index.html no fue generado!
    exit /b 1
)

echo.
echo [2/3] Sincronizando Capacitor Android...
call npx.cmd cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo ERROR CAP SYNC
    exit /b %ERRORLEVEL%
)

if not exist "d:\PROYECTO RED\client\app\android\app\src\main\assets\public\index.html" (
    echo ERROR: assets\public\index.html no fue copiado a Android!
    exit /b 1
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

