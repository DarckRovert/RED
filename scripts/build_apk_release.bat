@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%

echo Using JAVA_HOME: %JAVA_HOME%

echo.
echo [1/4] Running Pre-Flight Hygiene Check and building Web Assets...
cd /d "%~dp0\.."
node scripts\pre_build_check.js
if %ERRORLEVEL% NEQ 0 (
    echo PRE-BUILD CHECK FAILED - Aborting build
    exit /b %ERRORLEVEL%
)

cd /d "%~dp0\..\client\app"
set CAPACITOR_BUILD=true
call npm.cmd run build:mobile
call npx.cmd cap sync android

echo.
echo [2/4] Building Android APK Release...
cd /d "%~dp0\..\client\app\android"
call gradlew.bat assembleRelease

if %ERRORLEVEL% NEQ 0 (
    echo BUILD FAILED - Check errors above
    exit /b %ERRORLEVEL%
)

echo.
echo [3/4] Synchronizing release APK binary to release-assets...
node "%~dp0\sync_release_apk.js"

echo.
echo ====================================
echo FULL BUILD COMPLETED SUCCESSFULLY!
echo ====================================

