$apkPath = "d:\PROYECTO RED\client\app\android\app\build\outputs\apk\release\app-release.apk"
$nodeExePath = "d:\PROYECTO RED\target\release\red-node.exe"
$releaseAssets = "d:\PROYECTO RED\release-assets"

if (-not (Test-Path $releaseAssets)) {
    New-Item -ItemType Directory -Path $releaseAssets -Force | Out-Null
}

Copy-Item -Path $apkPath -Destination "$releaseAssets\red-v64.0.0-release.apk" -Force
Copy-Item -Path $apkPath -Destination "$releaseAssets\red-latest.apk" -Force
Copy-Item -Path $nodeExePath -Destination "$releaseAssets\red-node.exe" -Force

$hashApk = (Get-FileHash "$releaseAssets\red-v64.0.0-release.apk" -Algorithm SHA256).Hash.ToUpper()
$hashNode = (Get-FileHash "$releaseAssets\red-node.exe" -Algorithm SHA256).Hash.ToUpper()

$shaContent = "$hashApk  red-v64.0.0-release.apk`n$hashApk  red-latest.apk`n$hashNode  red-node.exe"
[System.IO.File]::WriteAllText("$releaseAssets\SHA256SUMS.txt", $shaContent, [System.Text.Encoding]::UTF8)

Write-Host "Release assets packaged successfully:" -ForegroundColor Green
Get-ChildItem $releaseAssets | Select-Object Name, Length
Get-Content "$releaseAssets\SHA256SUMS.txt"
