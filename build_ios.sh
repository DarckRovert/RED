#!/bin/bash
set -e

echo "======================================"
echo "    RED - iOS Rust Backend Builder"
echo "======================================"

if ! command -v lipo &> /dev/null; then
    echo "Error: lipo command not found. This script must run on macOS."
    exit 1
fi

echo "[1/4] Adding Rust iOS targets..."
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim

echo "[2/4] Compiling for iOS Device (ARM64)..."
cargo build --manifest-path red_mobile/Cargo.toml --target aarch64-apple-ios --release

echo "[3/4] Compiling for iOS Simulator (X86_64 and ARM64)..."
cargo build --manifest-path red_mobile/Cargo.toml --target x86_64-apple-ios --release
cargo build --manifest-path red_mobile/Cargo.toml --target aarch64-apple-ios-sim --release

echo "[4/4] Creating Universal Library with Lipo..."
mkdir -p client/app/ios/App/App/red_mobile_lib
lipo -create -output client/app/ios/App/App/red_mobile_lib/libred_mobile.a \
    target/aarch64-apple-ios/release/libred_mobile.a \
    target/x86_64-apple-ios/release/libred_mobile.a

echo "======================================"
echo " SUCCESS: libred_mobile.a generated!  "
echo "======================================"
