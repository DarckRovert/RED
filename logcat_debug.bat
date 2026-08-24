@echo off
setlocal
set "ADB=C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"

echo.
echo === LOGCAT MOTO G22 (ZT322B386P) ===
%ADB% -s ZT322B386P logcat -d -v brief *:E 2>&1 > "%TEMP%\logcat_motog22.txt"
findstr /i "f.red FATAL AndroidRuntime ANR" "%TEMP%\logcat_motog22.txt" 2>nul
echo --- Moto G22 scan completo ---

echo.
echo === LOGCAT TABLET (HA2CHKZ2) ===
%ADB% -s HA2CHKZ2 logcat -d -v brief *:E 2>&1 > "%TEMP%\logcat_tablet.txt"
findstr /i "f.red FATAL AndroidRuntime ANR" "%TEMP%\logcat_tablet.txt" 2>nul
echo --- Tablet scan completo ---

echo.
echo === LOGCAT NOTE14 (6dife65ls485fega) ===
%ADB% -s 6dife65ls485fega logcat -d -v brief *:E 2>&1 > "%TEMP%\logcat_note14.txt"
findstr /i "f.red FATAL AndroidRuntime ANR" "%TEMP%\logcat_note14.txt" 2>nul
echo --- Note14 scan completo ---

echo.
echo === CONTEO DE ERRORES CRITICOS ===
echo Moto G22 errores:
find /c "FATAL" "%TEMP%\logcat_motog22.txt" 2>nul
echo Tablet errores:
find /c "FATAL" "%TEMP%\logcat_tablet.txt" 2>nul
echo Note14 errores:
find /c "FATAL" "%TEMP%\logcat_note14.txt" 2>nul

echo.
echo === FIN SESION DEPURACION ===
endlocal
