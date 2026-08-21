# 🔴 RED — Guía de Inicio Rápido (v52.0.0 Autonomous Mesh & P2P Live Sync Edition)

RED es el sistema de comunicaciones tácticas, descentralizadas y cifradas de grado militar más avanzado del mundo, diseñado para operar tanto en redes globales descentralizadas como en aislamiento total fuera de línea (Off-Grid).

---

## 🛠️ Requisitos del Sistema

- **Node.js**: v20+
- **Rust Toolchain**: 1.80+ y Cargo
- **Android SDK**: 35 con OpenJDK 21

---

## 🚀 Inicio Rápido

### 1. Compilación Web y de Nodo Rust
```bash
# Instalar dependencias del cliente
cd client/app
npm install

# Compilación de producción estricta
npm run build
```

### 2. Sincronización y Compilación Android
```bash
# Sincronizar assets con Capacitor
npx cap sync android

# Compilar APK con Gradle
cd android
./gradlew assembleDebug
```

### 3. Instalación en Dispositivos
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## 🔑 Primeros Pasos en la Aplicación

1. **Creación de PIN Maestro**: Al abrir la app, establece tu PIN seguro de 6 dígitos.
2. **Generación de Identidad Soberana**: El motor Rust genera localmente tu `did:red:<identity_hash>`.
3. **Selección de Canales**: Accede a canales locales o chatea punto a punto mediante la red de malla.
4. **Comunicaciones Tácticas**:
   - **Walkie-Talkie HQ**: Activa el códec Vocoder (1.6–3.2 kbps) para hablar con bajísimo consumo de ancho de banda.
   - **Batería Eco-Mesh**: Deja que el gobernador cinemático optimice la batería de tu dispositivo (hasta 48h).
   - **Conectividad Global**: Al conectarte a internet, el nodo se enlaza automáticamente a los bootstrap peers de libp2p.
