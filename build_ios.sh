#!/usr/bin/env bash
# ==============================================================================
# RED v63.0.0 — Script de Compilación Nativa para iOS (Universal XCFramework)
# ==============================================================================
set -euo pipefail

echo "🍏 [RED-iOS] Iniciando compilación de libred_mobile.a para iOS..."

# 1. Verificar e instalar targets de Rust para iOS
rustup target add aarch64-apple-ios || true
rustup target add aarch64-apple-ios-sim || true
rustup target add x86_64-apple-ios || true

# 2. Compilar para iPhone Físico (ARM64)
echo "📦 [RED-iOS] Compilando para dispositivos iOS (aarch64-apple-ios)..."
cargo build --release -p red_mobile --target aarch64-apple-ios

# 3. Compilar para Simulador iOS (ARM64 Apple Silicon)
echo "📦 [RED-iOS] Compilando para Simulador iOS ARM64 (aarch64-apple-ios-sim)..."
cargo build --release -p red_mobile --target aarch64-apple-ios-sim

# 4. Crear estructura de salida para Capacitor / Xcode
OUTPUT_DIR="client/app/ios/App/Frameworks"
mkdir -p "$OUTPUT_DIR"

# 5. Copiar biblioteca estática compilada
cp target/aarch64-apple-ios-sim/release/libred_mobile.a "$OUTPUT_DIR/libred_mobile.a"

echo "✅ [RED-iOS] Compilación exitosa. Archivo generado en $OUTPUT_DIR/libred_mobile.a"
