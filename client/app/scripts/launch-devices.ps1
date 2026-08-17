$adb = "C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$devices = @("ZT322B386P", "HA2CHKZ2")
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
    Write-Host "Configuring device $dev..."
    & $adb -s $dev logcat -c
    foreach ($p in $perms) {
        & $adb -s $dev shell pm grant f.red.app $p 2>$null
    }
    & $adb -s $dev shell am start -n f.red.app/.MainActivity
}
