<#
.SYNOPSIS
    RED Android Build Automator v1.0
    Compiles the Next.js frontend, syncs Capacitor, and builds the Rust JNI motor.

.DESCRIPTION
    This script is the professional-grade entry point for building the RED mobile project
    for Android Studio. It handles environment validation, cross-compilation, and
    artifact distribution (jniLibs).
#>

$ErrorActionPreference = "Stop"
$RED_ROOT = Get-Location
$FRONTEND_PATH = "$RED_ROOT\client\app"
$BACKEND_PATH = "$RED_ROOT\red_mobile"
$ANDROID_PATH = "$FRONTEND_PATH\android"
$JNI_LIBS_ROOT = "$ANDROID_PATH\app\src\main\jniLibs"

# Fix PATH for Sandbox Environment
$env:PATH += ";$env:USERPROFILE\.cargo\bin"

# Fix JAVA_HOME — use Android Studio's bundled JBR
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH += ";$env:JAVA_HOME\bin"

# --- Functions ---

function Write-Header {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan -BackgroundColor DarkBlue
}

function Check-Command {
    param([string]$Command, [string]$HelpUrl)
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        Write-Host "Error: '$Command' not found. Please install it: $HelpUrl" -ForegroundColor Red
        exit 1
    }
}

# --- Environment Validation ---

Write-Header "RED Android Build System - Initializing"

# Ensure JDK environment points to Android Studio's stable OpenJDK (jbr)
$AndroidStudioJbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path "$AndroidStudioJbr\bin\java.exe") {
    $env:JAVA_HOME = $AndroidStudioJbr
    $env:PATH = "$AndroidStudioJbr\bin;$env:PATH"
    Write-Host "JDK environment set to Android Studio JBR ($AndroidStudioJbr)" -ForegroundColor Gray
}

# Stop cached Gradle daemons using outdated JRE paths
if (Test-Path "$ANDROID_PATH\gradlew.bat") {
    Push-Location $ANDROID_PATH
    .\gradlew.bat --stop | Out-Null
    Pop-Location
}

Check-Command "node" "https://nodejs.org/"
Check-Command "npm" "https://nodejs.org/"
Check-Command "cargo" "https://rustup.rs/"
Check-Command "cargo-ndk" "Run 'cargo install cargo-ndk'"

# GUARD: Ensure no APKs are in public/ — they would be bundled into the APK, inflating it to 1+ GB.
$ApksInPublic = Get-ChildItem "$FRONTEND_PATH\public" -Filter "*.apk" -Recurse -ErrorAction SilentlyContinue
if ($ApksInPublic) {
    Write-Host "[FATAL] APK files found inside public/ - this would inflate the build by hundreds of MB!" -ForegroundColor Red
    $ApksInPublic | ForEach-Object { Write-Host "  -> $($_.FullName) ($([math]::Round($_.Length/1MB,1)) MB)" -ForegroundColor Red }
    Write-Host "  Remove them and retry. APKs should NOT be served as static web assets." -ForegroundColor Yellow
    exit 1
}

# --- Step 1: Pre-Build Hygiene & Frontend Build ---

Write-Header "Step 1: Pre-Build Hygiene & Frontend Build"
Set-Location $RED_ROOT
Write-Host "Running pre-flight hygiene check..." -ForegroundColor Gray
node "$RED_ROOT\scripts\pre_build_check.js"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FATAL] Pre-flight check failed. Aborting build." -ForegroundColor Red
    exit 1
}

Set-Location $FRONTEND_PATH
Write-Host "Installing dependencies..." -ForegroundColor Gray
npm install --quiet --legacy-peer-deps
Write-Host "Building web distribution (Next.js)..." -ForegroundColor Gray
npm run build

# --- Step 2: Capacitor Sync ---

Write-Header "Step 2: Synchronizing with Capacitor Android"
npx cap sync android

# --- Step 3: Rust Backend Build (JNI) --- ALWAYS recompile (cargo is incremental)

Write-Header "Step 3: Compiling Rust Core (aarch64-linux-android)"
Set-Location $BACKEND_PATH

$NDK_DIR = "$env:USERPROFILE\AppData\Local\Android\Sdk\ndk"
$NDK_VER = (Get-ChildItem $NDK_DIR -Directory | Sort-Object Name -Descending | Select-Object -First 1).Name
$NDK_BASE = "$NDK_DIR\$NDK_VER\toolchains\llvm\prebuilt\windows-x86_64"

# Pass NDK sysroot libs path so the linker finds libc++_static.a
$env:LIBRARY_PATH = "$NDK_BASE\sysroot\usr\lib\aarch64-linux-android"
$env:CXXFLAGS = "-stdlib=libc++"

Write-Host "Running cargo-ndk build (--release, static C++ STL)..." -ForegroundColor Gray
cargo ndk -t aarch64-linux-android -o "$JNI_LIBS_ROOT" build --release

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FATAL] cargo ndk failed. Aborting build." -ForegroundColor Red
    exit 1
}

# --- Step 4: Verify and distribute artifacts ---
Write-Header "Step 4: Verifying & Distributing Binary Artifacts"

$DestDir = "$JNI_LIBS_ROOT\arm64-v8a"
$BuiltSo  = "$DestDir\libred_mobile.so"

if (-not (Test-Path $BuiltSo)) {
    Write-Host "[FATAL] libred_mobile.so not found in jniLibs after build." -ForegroundColor Red
    exit 1
}

# Safety net: copy libc++_shared.so in case static linking was incomplete
$LibCppShared = "$NDK_BASE\sysroot\usr\lib\aarch64-linux-android\libc++_shared.so"
if (Test-Path $LibCppShared) {
    Copy-Item -Path $LibCppShared -Destination "$DestDir\libc++_shared.so" -Force
    Write-Host "[OK] libc++_shared.so copied to jniLibs as safety net." -ForegroundColor Green
}

# Verify the .so no longer depends on dynamic libc++ (it should now be self-contained)
$ReadElf = "$NDK_BASE\bin\llvm-readelf.exe"
if (Test-Path $ReadElf) {
    $needed = & $ReadElf -d $BuiltSo | Select-String "NEEDED"
    Write-Host "`n[INFO] libred_mobile.so runtime dependencies:" -ForegroundColor Cyan
    $needed | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
}

Write-Host "`n[OK] Rust motor injected into Android project." -ForegroundColor Green

# --- Step 5: Compile Production APK ---

Write-Header "Step 5: Compiling Signed Debug APK (assembleDebug)"
Set-Location $ANDROID_PATH
if (Test-Path "gradlew.bat") {
    Write-Host "Running Gradle build..." -ForegroundColor Gray
    cmd.exe /c "gradlew.bat assembleDebug"
    
    $ApkPath = "$ANDROID_PATH\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $ApkPath) {
        Write-Host "`n[OK] APK successfully built!" -ForegroundColor Green
        Write-Host "Path: $ApkPath" -ForegroundColor Cyan
        
        $VersionFile = "$FRONTEND_PATH\src\lib\version.ts"
        $CurrentVersion = "66.0.0"
        if (Test-Path $VersionFile) {
            $Match = Select-String -Path $VersionFile -Pattern 'RED_VERSION\s*=\s*["'']([^"'']+)["'']'
            if ($Match) { $CurrentVersion = $Match.Matches[0].Groups[1].Value }
        }

        Write-Host "Copying APK to release-assets (red-v$CurrentVersion-release.apk, red-latest.apk)..." -ForegroundColor Gray
        if (-not (Test-Path "$RED_ROOT\release-assets")) { New-Item -ItemType Directory -Path "$RED_ROOT\release-assets" | Out-Null }
        Copy-Item -Path $ApkPath -Destination "$RED_ROOT\release-assets\red-v$CurrentVersion-release.apk" -Force -ErrorAction SilentlyContinue
        Copy-Item -Path $ApkPath -Destination "$RED_ROOT\release-assets\red-latest.apk" -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "`n[!] Warning: Gradle completed but APK was not found at expected path." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "Error: gradlew.bat not found in $ANDROID_PATH" -ForegroundColor Red
    exit 1
}

# --- Step 6: Auto-install to connected device ---

Write-Header "Step 6: Auto-Install to Connected Android Device"
Set-Location $RED_ROOT

$AdbPath = "$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if (Test-Path $AdbPath) {
    $devices = & $AdbPath devices | Select-String "\tdevice$"
    if ($devices.Count -gt 0) {
        $deviceId = ($devices[0].Line -split "\t")[0].Trim()
        Write-Host "Detected device: $deviceId - installing APK..." -ForegroundColor Cyan
        & $AdbPath -s $deviceId install -r $ApkPath
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] APK installed on device $deviceId" -ForegroundColor Green
            Write-Host "Restarting RED on device to apply new assets..." -ForegroundColor Cyan
            & $AdbPath -s $deviceId shell am force-stop f.red.app
            Start-Sleep -Milliseconds 500
            & $AdbPath -s $deviceId shell am start -n f.red.app/.MainActivity
            
            # Verify the native library loaded on device using logcat
            Write-Host "Streaming logcat (5s) to verify native library load..." -ForegroundColor Gray
            $job = Start-Job {
                param($adb, $dev)
                & $adb -s $dev logcat -s RedNodePlugin:E RedNodePlugin:I -T 1 2>&1
            } -ArgumentList $AdbPath, $deviceId
            Start-Sleep 5
            Stop-Job $job
            Receive-Job $job | Select-String "red_mobile|FAILED|loaded"
            Remove-Job $job
        } else {
            Write-Host "[!] adb install failed. Transfer APK manually." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[INFO] No device connected via USB. APK ready at: $ApkPath" -ForegroundColor Yellow
    }
} else {
    Write-Host "[INFO] adb not found. APK ready at: $ApkPath" -ForegroundColor Yellow
}

# --- Finish ---

Set-Location $RED_ROOT
Write-Header "BUILD COMPLETE - RED is ready"
Write-Host "APK: $ApkPath" -ForegroundColor Green
Write-Host ""
