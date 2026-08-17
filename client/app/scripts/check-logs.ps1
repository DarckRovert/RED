$adb = "C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"

Write-Host "=================== MOTO G22 (ZT322B386P) ==================="
$motoLogs = & $adb -s ZT322B386P logcat -d
$motoLogs | Select-String "f.red.app|Capacitor|RedNode|Console|chromium|AndroidRuntime" | Select-Object -Last 35 | ForEach-Object { $_.Line }

Write-Host "=================== TABLET (HA2CHKZ2) ==================="
$tabLogs = & $adb -s HA2CHKZ2 logcat -d
$tabLogs | Select-String "f.red.app|Capacitor|RedNode|Console|chromium|AndroidRuntime" | Select-Object -Last 35 | ForEach-Object { $_.Line }
