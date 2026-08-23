$adb = "C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$apk = "d:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk"

Write-Host "Instalando en Tablet HA2CHKZ2..."
& $adb -s HA2CHKZ2 install -r "$apk"
& $adb -s HA2CHKZ2 shell am start -n f.red.app/.MainActivity

Write-Host "Instalando en Moto G22 ZT322B386P..."
& $adb -s ZT322B386P install -r "$apk"
& $adb -s ZT322B386P shell am start -n f.red.app/.MainActivity

Write-Host "Despliegue completado con exito en ambos dispositivos."
