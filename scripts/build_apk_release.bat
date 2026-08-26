@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%

echo Using JAVA_HOME: %JAVA_HOME%
echo Java version:
"%JAVA_HOME%\bin\java.exe" -version

echo.
echo [1/4] Cleaning public downloads and building Capacitor Web Assets (empty basePath)...
powershell -Command "if (Test-Path 'd:\PROYECTO RED\client\app\public\downloads') { Remove-Item -Recurse -Force 'd:\PROYECTO RED\client\app\public\downloads' }"
cd /d "d:\PROYECTO RED\client\app"
set CAPACITOR_BUILD=true
call npm.cmd run build
call npx.cmd cap sync android

echo.
echo [2/4] Building Android APK Release (v64.0.0)...
cd /d "d:\PROYECTO RED\client\app\android"
call gradlew.bat assembleRelease

if %ERRORLEVEL% NEQ 0 (
    echo BUILD FAILED - Check errors above
    exit /b %ERRORLEVEL%
)

echo.
echo [3/4] Synchronizing release APK binary to release-assets...
powershell -Command "Copy-Item -Path 'd:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk' -Destination 'd:\PROYECTO RED\release-assets\red-v64.0.0-release.apk' -Force; Copy-Item -Path 'd:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk' -Destination 'd:\PROYECTO RED\release-assets\red-latest.apk' -Force; (Get-FileHash 'd:\PROYECTO RED\release-assets\red-latest.apk' -Algorithm SHA256).Hash.ToUpper()"

echo.
echo ====================================
echo FULL BUILD COMPLETED SUCCESSFULLY (v64.0.0)!
echo ====================================
dir /s /b "d:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\*.apk"
