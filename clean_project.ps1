$oldFiles = Get-ChildItem -Path "d:\PROYECTO RED" -Include "*.apk","*.aab" -Recurse -File -ErrorAction SilentlyContinue
foreach ($f in $oldFiles) {
    if ($f.FullName -notmatch "node_modules|\.cargo") {
        Write-Host "Eliminando: " $f.FullName
        Remove-Item -Path $f.FullName -Force -ErrorAction SilentlyContinue
    }
}

if (Test-Path "d:\PROYECTO RED\client\app\.next") {
    Write-Host "Eliminando .next"
    Remove-Item -Path "d:\PROYECTO RED\client\app\.next" -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path "d:\PROYECTO RED\client\app\out") {
    Write-Host "Eliminando out"
    Remove-Item -Path "d:\PROYECTO RED\client\app\out" -Recurse -Force -ErrorAction SilentlyContinue
}

$androidPath = "d:\PROYECTO RED\client\app\android"
if (Test-Path "$androidPath\gradlew.bat") {
    Set-Location $androidPath
    $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
    $env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH
    .\gradlew.bat --stop
    .\gradlew.bat clean
}

if (Test-Path "$androidPath\app\build") {
    Write-Host "Eliminando app\build"
    Remove-Item -Path "$androidPath\app\build" -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path "$androidPath\build") {
    Write-Host "Eliminando android\build"
    Remove-Item -Path "$androidPath\build" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "CLEAN_COMPLETED_SUCCESSFULLY"
