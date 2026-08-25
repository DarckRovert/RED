@echo off
setlocal enabledelayedexpansion
title RED Sovereign Mesh -- Centro de Control PC (v63.0.0)
color 0C

set "SCRIPT_DIR=%~dp0"
set "NODE_EXE="

if exist "%SCRIPT_DIR%red_config.env" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%SCRIPT_DIR%red_config.env") do (
        if "%%A"=="RED_PASSWORD" set "RED_PASSWORD=%%B"
    )
)

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
echo   RED SOVEREIGN MESH -- CENTRO DE CONTROL DE NODO (PC / WINDOWS v63.0.0)
echo ===============================================================================
echo.
echo   [1] Iniciar Nodo en Segundo Plano y Abrir Web App
echo   [2] Iniciar Nodo en Consola (Ver Logs Tacticos en Vivo)
echo   [3] Ver Estado del Nodo y Telemetria P2P
echo   [4] Generar o Mostrar Identidad Criptografica Soberana (DID)
echo   [5] Configurar / Cambiar Contrasena de Seguridad (RED_PASSWORD)
echo   [6] Abrir Web App en Navegador (https://darckrovert.github.io/RED/)
echo   [7] Detener Nodo (Finalizar procesos en ejecucion)
echo   [0] Salir
echo.
echo ===============================================================================
set /p opt="Seleccione una opcion [0-7] y presione ENTER: "

if "%opt%"=="1" goto START_BG
if "%opt%"=="2" goto START_CONSOLE
if "%opt%"=="3" goto STATUS
if "%opt%"=="4" goto IDENTITY
if "%opt%"=="5" goto SET_PASSWORD
if "%opt%"=="6" goto OPEN_WEB
if "%opt%"=="7" goto STOP_NODE
if "%opt%"=="0" goto EXIT
goto MENU

:CHECK_EXE
if "%NODE_EXE%"=="" (
    echo [ERROR] No se encontro el binario red-node.exe.
    pause
    goto MENU
)
goto :eof

:START_BG
cls
call :CHECK_EXE
echo [INFO] Iniciando nodo RED en segundo plano...
if defined RED_PASSWORD (
    echo [SEGURIDAD] Autenticacion activa con contrasena personalizada.
) else (
    echo [INFO] Modo desarrollo activo (Clave de boveda por defecto).
)
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
echo   GESTION DE IDENTIDAD CRIPTOGRAFICA
echo ===============================================================================
echo   [1] Mostrar Identidad Actual
echo   [2] Generar Nueva Identidad (Rotar Claves)
echo   [0] Volver al Menu Principal
echo ===============================================================================
set /p idopt="Seleccione opcion [0-2]: "

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

:SET_PASSWORD
cls
echo ===============================================================================
echo   CONFIGURACION DE CONTRASENA DE SEGURIDAD (RED_PASSWORD)
echo ===============================================================================
echo.
echo Ingresa tu contrasena personalizada para proteger la API REST y la boveda.
echo (Si lo dejas en blanco y presionas ENTER, se borrara la contrasena y volvera al modo por defecto).
echo.
set /p userpwd="Contrasena deseada: "

if "%userpwd%"=="" (
    set "RED_PASSWORD="
    if exist "%SCRIPT_DIR%red_config.env" del /f /q "%SCRIPT_DIR%red_config.env"
    echo [OK] Contrasena eliminada. Se usara el modo por defecto.
) else (
    set "RED_PASSWORD=%userpwd%"
    echo RED_PASSWORD=%userpwd%> "%SCRIPT_DIR%red_config.env"
    echo [OK] Contrasena guardada correctamente en red_config.env.
)
pause
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
