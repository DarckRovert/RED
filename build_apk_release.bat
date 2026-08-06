@echo off
set JAVA_HOME=C:\Users\darck\.gradle\jdks\eclipse_adoptium-21-amd64-windows.2
set PATH=%JAVA_HOME%\bin;%PATH%

echo Using JAVA_HOME: %JAVA_HOME%
echo Java version:
"%JAVA_HOME%\bin\java.exe" -version

echo.
echo [1/4] Building Capacitor Web Assets for Android APK (empty basePath)...
cd /d "d:\PROYECTO RED\client\app"
set CAPACITOR_BUILD=true
call npx next build 2>&1
call npx cap sync android 2>&1

echo.
echo [2/4] Building Android APK Release...
cd /d "d:\PROYECTO RED\client\app\android"
call gradlew.bat assembleRelease --no-daemon 2>&1

if %ERRORLEVEL% NEQ 0 (
    echo BUILD FAILED - Check errors above
    exit /b %ERRORLEVEL%
)

echo.
echo [3/4] Copying fresh APK to public assets and Rebuilding Web Export for GitHub Pages...
powershell -Command "Copy-Item -Path 'd:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk' -Destination 'd:\PROYECTO RED\client\app\public\assets\red-v24.0.0-latest.apk' -Force"
cd /d "d:\PROYECTO RED\client\app"
set CAPACITOR_BUILD=false
set NEXT_PUBLIC_BASE_PATH=/RED
call npx next build 2>&1

echo.
echo [4/4] Synchronizing Web Export and APK binaries to workspace root...
powershell -Command "Copy-Item -Path 'd:\PROYECTO RED\client\app\out\*' -Destination 'd:\PROYECTO RED\' -Recurse -Force; Copy-Item -Path 'd:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk' -Destination 'd:\PROYECTO RED\assets\red-v24.0.0-latest.apk' -Force; Copy-Item -Path 'd:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk' -Destination 'd:\PROYECTO RED\app-release.apk' -Force"

echo.
echo ====================================
echo FULL BUILD AND SYNC COMPLETED SUCCESSFULLY!
echo ====================================
dir /s /b "d:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\*.apk" 2>&1
