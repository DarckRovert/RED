@echo off
setlocal
set "ADB=C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"

echo.
echo === Limpiando buffer logcat en Moto G22 y Tablet ===
%ADB% -s ZT322B386P logcat -c
%ADB% -s HA2CHKZ2 logcat -c

echo Esperando 5s para que la app genere nuevo log...
timeout /t 5 /nobreak >nul

echo.
echo === LOGCAT FRESCO — MOTO G22 (v60.0.0 con fix) ===
%ADB% -s ZT322B386P logcat -d -v time *:E 2>nul > "%TEMP%\new_motog22.txt"
findstr /i "FATAL AndroidRuntime f.red.app ANR" "%TEMP%\new_motog22.txt" 2>nul
echo Errores FATAL Moto G22:
find /c "FATAL" "%TEMP%\new_motog22.txt"

echo.
echo === LOGCAT FRESCO — TABLET (v60.0.0 con fix) ===
%ADB% -s HA2CHKZ2 logcat -d -v time *:E 2>nul > "%TEMP%\new_tablet.txt"
findstr /i "FATAL AndroidRuntime f.red.app ANR" "%TEMP%\new_tablet.txt" 2>nul
echo Errores FATAL Tablet:
find /c "FATAL" "%TEMP%\new_tablet.txt"

echo.
echo === Verificacion de PIDs activos ===
echo Moto G22 PID:
%ADB% -s ZT322B386P shell pidof f.red.app
echo Tablet PID:
%ADB% -s HA2CHKZ2 shell pidof f.red.app

endlocal
