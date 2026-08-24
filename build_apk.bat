@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "ANDROID_HOME=C:\Users\darck\AppData\Local\Android\Sdk"
cd /d "d:\PROYECTO RED\client\app\android"
call gradlew.bat assembleRelease --no-daemon
echo BUILD_EXIT_CODE=%ERRORLEVEL%
