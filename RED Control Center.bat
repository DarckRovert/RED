@echo off
chcp 65001 >nul
title RED Sovereign Mesh — Centro de Control PC
color 0C

set "SCRIPT_DIR=%~dp0"
set "NODE_EXE="

if exist "%SCRIPT_DIR%red-node.exe" (
    set "NODE_EXE=%SCRIPT_DIR%red-node.exe"
) else if exist "%SCRIPT_DIR%release-assets\red-node.exe" (
    set "NODE_EXE=%SCRIPT_DIR%release-assets\red-node.exe"
) else if exist "%SCRIPT_DIR%target\release\red-node.exe" (
    set "NODE_EXE=%SCRIPT_DIR%target\release\red-node.exe"
) else if exist "red-node.exe" (
    set "NODE_EXE=red-node.exe"
) else if exist "release-assets\red-node.exe" (
    set "NODE_EXE=release-assets\red-node.exe"
)

:MENU
cls
echo ===============================================================================
echo   🛡️  RED SOVEREIGN MESH — CENTRO DE CONTROL DE NODO (PC / WINDOWS)
echo ===============================================================================
echo.
echo   [1] 🚀 Iniciar Nodo en Segundo Plano y Abrir Web App
echo   [2] 🖥️  Iniciar Nodo en Consola (Ver Logs Tácticos en Vivo)
echo   [3] 📊 Ver Estado del Nodo y Telemetría P2P
echo   [4] 🔑 Generar o Mostrar Identidad Criptográfica Soberana (DID)
echo   [5] 🌐 Abrir Web App en Navegador (https://darckrovert.github.io/RED/)
echo   [6] 🛑 Detener Nodo (Finalizar procesos en ejecución)
echo   [0] ❌ Salir
echo.
echo ===============================================================================
set /p opt="Seleccione una opción [0-6] y presione ENTER: "

if "%opt%"=="1" goto START_BG
if "%opt%"=="2" goto START_CONSOLE
if "%opt%"=="3" goto STATUS
if "%opt%"=="4" goto IDENTITY
if "%opt%"=="5" goto OPEN_WEB
if "%opt%"=="6" goto STOP_NODE
if "%opt%"=="0" goto EXIT
goto MENU

:CHECK_EXE
if "%NODE_EXE%"=="" (
    echo [ERROR] No se encontró el binario red-node.exe.
    pause
    goto MENU
)
goto :eof

:START_BG
cls
call :CHECK_EXE
echo [INFO] Iniciando nodo RED en segundo plano...
start "RED Node Daemon" /min "%NODE_EXE%" start
echo [OK] Nodo iniciado en puertos P2P: 7331 ^| API: 7333
timeout /t 2 >nul
echo [INFO] Abriendo Web App en navegador...
start https://darckrovert.github.io/RED/
pause
goto MENU

:START_CONSOLE
cls
call :CHECK_EXE
echo [INFO] Iniciando nodo RED en modo interactivo...
"%NODE_EXE%" start
pause
goto MENU

:STATUS
cls
call :CHECK_EXE
echo [INFO] Consultando estado del nodo...
"%NODE_EXE%" status
echo.
pause
goto MENU

:IDENTITY
cls
call :CHECK_EXE
echo ===============================================================================
echo   🔑 GESTIÓN DE IDENTIDAD CRIPTOGRÁFICA
echo ===============================================================================
echo   [1] Mostrar Identidad Actual
echo   [2] Generar Nueva Identidad (Rotar Claves)
echo   [0] Volver al Menú Principal
echo ===============================================================================
set /p idopt="Seleccione opción [0-2]: "

if "%idopt%"=="1" (
    "%NODE_EXE%" identity show
    echo.
    pause
    goto IDENTITY
)
if "%idopt%"=="2" (
    "%NODE_EXE%" identity generate
    echo.
    pause
    goto IDENTITY
)
goto MENU

:OPEN_WEB
cls
echo [INFO] Abriendo https://darckrovert.github.io/RED/ en su navegador predeterminado...
start https://darckrovert.github.io/RED/
timeout /t 2 >nul
goto MENU

:STOP_NODE
cls
echo [INFO] Deteniendo procesos de red-node.exe...
taskkill /F /IM red-node.exe >nul 2>&1
echo [OK] Procesos detenidos correctamente.
pause
goto MENU

:EXIT
cls
exit /b 0
