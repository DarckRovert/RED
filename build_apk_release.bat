@echo off
set JAVA_HOME=C:\Users\darck\.gradle\jdks\eclipse_adoptium-21-amd64-windows.2
set PATH=%JAVA_HOME%\bin;%PATH%

echo Using JAVA_HOME: %JAVA_HOME%
echo Java version:
"%JAVA_HOME%\bin\java.exe" -version

echo.
echo Building Android APK Release...
cd /d "d:\PROYECTO RED\client\app\android"
call gradlew.bat assembleRelease --no-daemon 2>&1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================
    echo APK BUILD SUCCESS!
    echo ====================================
    dir /s /b "app\build\outputs\apk\release\*.apk" 2>&1
) else (
    echo.
    echo BUILD FAILED - Check errors above
)
