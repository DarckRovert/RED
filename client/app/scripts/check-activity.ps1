$adb = "C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"

Write-Host "=== MOTO G22 ACTIVITY ==="
$mFocus = & $adb -s ZT322B386P shell dumpsys window
$mFocus | Select-String "mCurrentFocus|mFocusedApp" | ForEach-Object { $_.Line }

Write-Host "=== TABLET ACTIVITY ==="
$tFocus = & $adb -s HA2CHKZ2 shell dumpsys window
$tFocus | Select-String "mCurrentFocus|mFocusedApp" | ForEach-Object { $_.Line }
