# 🔴 RED — Guía de Inicio Rápido (v126.1.0 Sovereign Mesh OS)

RED es el sistema de comunicaciones tácticas, descentralizadas y cifradas de grado militar más avanzado del mundo, diseñado para operar tanto en redes globales descentralizadas como en aislamiento total fuera de línea (Off-Grid).

---

## 🛠️ Requisitos del Sistema

- **Node.js**: v20+ (con npm)
- **Rust Toolchain**: 1.80+ y Cargo
- **Android SDK & NDK**: Android SDK 35, NDK r27+, OpenJDK 21
- **Capacitor CLI**: 8.2+

---

## 🚀 Inicio Rápido

### 1. Compilación del Frontend y Servidor Web
```bash
# Navegar al directorio del cliente
cd client/app

# Instalar dependencias de Node
npm install

# Compilación estricta de producción (Next.js 16 con Turbopack)
npm run build
```

### 2. Compilación del Núcleo Rust y Pruebas Unitarias
```bash
# Compilar todo el espacio de trabajo en modo Release
cargo build --release

# Ejecutar las 127 pruebas unitarias, KAT e integración del workspace
cargo test --workspace

# Ejecutar la verificación de integridad y SSOT (39 checks canónicos)
node client/app/scripts/check_release_integrity.js --strict
```

### 3. Sincronización y Compilación Android
```bash
# Sincronizar assets estáticos con el proyecto nativo de Android
cd client/app
npx cap sync android

# Compilar APK de Release firmado con esquema dual (v1 + v2)
cd android
./gradlew assembleRelease
```

### 4. Instalación en Dispositivos Físicos mediante ADB
```bash
# Instalación directa del APK oficial v126.1.0 desde la raíz del repositorio:
adb install -r release-assets/red-v126.1.0-release.apk

# O instalar el alias canónico:
adb install -r release-assets/red-latest.apk
```

---

## 🔑 Primeros Pasos en la Aplicación

1. **Creación de PIN Maestro**: Al abrir la app, establece tu PIN seguro de 6 dígitos.
2. **Vinculación Biométrica (Opcional)**: Acepta la vinculación de tu huella o rostro en 1 clic para acceso rápido.
3. **Generación de Identidad Soberana**: El motor Rust genera localmente tu `did:red:<identity_hash>`.
4. **Comunicaciones Tácticas Off-Grid**:
   - **Walkie-Talkie Push-To-Talk**: Activa el códec Vocoder (1.6–3.2 kbps) para hablar con mínimo consumo de banda.
   - **Batería Eco-Mesh**: El gobernador cinemático optimiza el consumo de batería de tu dispositivo (hasta 48h).
   - **Conectividad Global**: Al conectarte a internet, el nodo se enlaza automáticamente a los bootstrap peers de libp2p.
5. **Economía Soberana y Trueque Comunitario**:
   - **Guía Táctica de Economía**: Pulsa el ícono educativo en el Checkout Universal o en el Mercado Off-Grid para comprender el respaldo por salto de fe y materias primas.
   - **Cobro de Comerciante Air-Gapped**: Genera y canjea vales QR firmados con Ed25519 con verificación anti-doble gasto sin requerir internet ni bancos. Consulta la [Guía del Comerciante (docs/MERCHANT_OFFLINE_GUIDE.md)](docs/MERCHANT_OFFLINE_GUIDE.md).
