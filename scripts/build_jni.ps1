$ErrorActionPreference = "Stop"
$env:PATH += ";$env:USERPROFILE\.cargo\bin"
$NDK_DIR = "$env:USERPROFILE\AppData\Local\Android\Sdk\ndk"
$NDK_VER = (Get-ChildItem $NDK_DIR -Directory | Sort-Object Name -Descending | Select-Object -First 1).Name
$NDK_BASE = "$NDK_DIR\$NDK_VER\toolchains\llvm\prebuilt\windows-x86_64"
$env:LIBRARY_PATH = "$NDK_BASE\sysroot\usr\lib\aarch64-linux-android"
$env:CXXFLAGS = "-stdlib=libc++"
$JNI_LIBS_ROOT = "d:\PROYECTO RED\client\app\android\app\src\main\jniLibs"

Write-Host "Building libred_mobile.so with cargo-ndk..." -ForegroundColor Cyan
Set-Location "d:\PROYECTO RED\red_mobile"
cargo ndk -t aarch64-linux-android -o "$JNI_LIBS_ROOT" build --release

$BuiltSo = "$JNI_LIBS_ROOT\arm64-v8a\libred_mobile.so"
if (Test-Path $BuiltSo) {
    Write-Host "SUCCESS: libred_mobile.so built at $BuiltSo" -ForegroundColor Green
    $LibCppShared = "$NDK_BASE\sysroot\usr\lib\aarch64-linux-android\libc++_shared.so"
    if (Test-Path $LibCppShared) {
        Copy-Item -Path $LibCppShared -Destination "$JNI_LIBS_ROOT\arm64-v8a\libc++_shared.so" -Force
        Write-Host "Copied libc++_shared.so as safety net." -ForegroundColor Green
    }
} else {
    Write-Error "Failed to locate $BuiltSo"
}
