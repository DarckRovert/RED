$adb = "C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$outDir = "C:\Users\darck\.gemini\antigravity-ide\brain\47737cb9-492d-4de4-9ff3-aacd73404102"

Write-Host "Capturing Moto G22..."
& $adb -s ZT322B386P shell screencap -p /sdcard/moto.png
& $adb -s ZT322B386P pull /sdcard/moto.png "$outDir\moto_g22.png"

Write-Host "Capturing Tablet..."
& $adb -s HA2CHKZ2 shell screencap -p /sdcard/tab.png
& $adb -s HA2CHKZ2 pull /sdcard/tab.png "$outDir\tablet.png"
