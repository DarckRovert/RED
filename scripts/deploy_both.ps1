$ErrorActionPreference = "Continue"
$adb = "C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$apk = "d:\PROYECTO RED\release-assets\red-latest.apk"
# Obtener dispositivos conectados dinamicamente
$rawDevices = & $adb devices
$devices = @()
foreach ($line in $rawDevices) {
    if ($line -match '^([a-zA-Z0-9_-]+)\s+device$') {
        $devices += $matches[1]
    }
}

if ($devices.Count -eq 0) {
    Write-Error "No se encontraron dispositivos Android conectados por ADB."
    exit 1
}

Write-Host "Dispositivos detectados: $($devices -join ', ')"
$perms = @(
    "android.permission.RECORD_AUDIO",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.CAMERA",
    "android.permission.BLUETOOTH_SCAN",
    "android.permission.BLUETOOTH_ADVERTISE",
    "android.permission.BLUETOOTH_CONNECT",
    "android.permission.POST_NOTIFICATIONS"
)

foreach ($dev in $devices) {
    Write-Host "====================================================="
    Write-Host "Iniciando despliegue en dispositivo: $dev"
    
    Write-Host "1. Desinstalando version previa..."
    & $adb -s $dev uninstall f.red.app

    Write-Host "2. Instalando APK v103.0.0 limpia ($apk)..."
    & $adb -s $dev install -r -d $apk

    Write-Host "3. Otorgando permisos de sistema..."
    foreach ($p in $perms) {
        & $adb -s $dev shell pm grant f.red.app $p 2>$null
    }

    Write-Host "4. Purgando logcat previo..."
    & $adb -s $dev logcat -c

    Write-Host "5. Lanzando MainActivity..."
    & $adb -s $dev shell am start -n f.red.app/.MainActivity
    Write-Host "Completado despliegue en $dev"
}

Write-Host "====================================================="
Write-Host "DESPLIEGUE EN AMBOS DISPOSITIVOS FINALIZADO"
