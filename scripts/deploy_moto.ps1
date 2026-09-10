$adb = "C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$dev = "ZT322B386P"
$apk = "d:\PROYECTO RED\release-assets\red-latest.apk"

Write-Host "1. Desinstalando version previa de Moto G22 ($dev)..."
& $adb -s $dev uninstall f.red.app

Write-Host "2. Instalando APK v97.0.0 limpia ($apk)..."
& $adb -s $dev install -r -d $apk

Write-Host "3. Otorgando permisos de sensores, red y multimedia..."
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
foreach ($p in $perms) {
    & $adb -s $dev shell pm grant f.red.app $p 2>$null
}

Write-Host "4. Purgando logcat previo y lanzando aplicacion..."
& $adb -s $dev logcat -c
& $adb -s $dev shell am start -n f.red.app/.MainActivity
Write-Host "DESPLIEGUE_MOTO_COMPLETADO"
