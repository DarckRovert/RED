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

Check-Command "node" "https://nodejs.org/"
Check-Command "npm" "https://nodejs.org/"
Check-Command "cargo" "https://rustup.rs/"
Check-Command "cargo-ndk" "Run 'cargo install cargo-ndk'"

# --- Step 1: Frontend Build ---

Write-Header "Step 1: Compiling React/Next.js Frontend"
Set-Location $FRONTEND_PATH
Write-Host "Installing dependencies..." -ForegroundColor Gray
npm install --quiet --legacy-peer-deps
Write-Host "Building web distribution (Next.js)..." -ForegroundColor Gray
npm run build

# --- Step 2: Capacitor Sync ---

Write-Header "Step 2: Synchronizing with Capacitor Android"
npx cap sync android

# --- Step 3: Rust Backend Build (JNI) ---

Write-Header "Step 3: Compiling Rust Core (aarch64-linux-android)"
Set-Location $BACKEND_PATH
Write-Host "Running cargo-ndk build..." -ForegroundColor Gray
cargo ndk -t aarch64-linux-android build --release

# --- Step 4: JNI Artifact Distribution ---

Write-Header "Step 4: Distributing Binary Artifacts"

$SourceSo = "$RED_ROOT\target\aarch64-linux-android\release\libred_mobile.so"
$DestDir = "$JNI_LIBS_ROOT\arm64-v8a"

if (-not (Test-Path $SourceSo)) {
    Write-Host "Critical Failure: libred_mobile.so not found at $SourceSo" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $DestDir)) {
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
}

Copy-Item -Path $SourceSo -Destination "$DestDir\libred_mobile.so" -Force
Write-Host "Success: JNI motor injected into Android project." -ForegroundColor Green

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
        
        Write-Host "Copying APK to website/red.apk..." -ForegroundColor Gray
        Copy-Item -Path $ApkPath -Destination "$RED_ROOT\website\red.apk" -Force
    } else {
        Write-Host "`n[!] Warning: Gradle completed but APK was not found at expected path." -ForegroundColor Yellow
    }
} else {
    Write-Host "Error: gradlew.bat not found in $ANDROID_PATH" -ForegroundColor Red
}

# --- Finish ---

Set-Location $RED_ROOT
Write-Header "BUILD COMPLETE - RED is ready"
Write-Host "PRO-TIP: Your production APK is ready to deploy!" -ForegroundColor Green
Write-Host "You can find it at: $ApkPath" -ForegroundColor Yellow
Write-Host ""
