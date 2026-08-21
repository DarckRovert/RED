@echo off
set JAVA_HOME=C:\Users\darck\.gradle\jdks\eclipse_adoptium-21-amd64-windows.2
set PATH=%JAVA_HOME%\bin;%PATH%
echo JAVA_HOME: %JAVA_HOME%
"%JAVA_HOME%\bin\java.exe" -version
cd /d "d:\PROYECTO RED\client\app\android"
call gradlew.bat assembleDebug --no-daemon 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo GRADLE_FAILED
    exit /b %ERRORLEVEL%
)
echo GRADLE_OK
