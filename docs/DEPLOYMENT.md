# 🚀 Guía de Despliegue - RED (v31.0.0 Sovereign Master)

Esta guía cubre el despliegue de la infraestructura de RED en dispositivos móviles y servidores, optimizada para la versión 31.0.0 Sovereign Master.

---

## 📱 Despliegue Móvil Nativo (Capacitor & OpenJDK 21)

RED se despliega como una aplicación híbrida de alto rendimiento con backend local embebido en Rust.

### Compilación Automatizada del APK (Recomendado)
Para compilar automáticamente todo el frontend Next.js 16 Turbopack, sincronizarlo con Capacitor y empaquetar el APK nativo usando Gradle con OpenJDK 21:

```bash
cd client/app
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```
El archivo APK resultante estará en `client/app/android/app/build/outputs/apk/debug/app-debug.apk`.

### Instalación Directa en Dispositivos por ADB
```bash
adb install -r -d app/build/outputs/apk/debug/app-debug.apk
```

---

## ⚙️ Configuraciones Críticas de Android 15 (API 35)

Para garantizar la estabilidad del nodo P2P:
- **Foreground Service:** En `AndroidManifest.xml`:
  ```xml
  <service android:name=".RedNodeService" 
           android:foregroundServiceType="connectedDevice|dataSync" />
  ```
- **Control de Energía:** Conectado al `KineticDutyGovernor.ts` para ajustar automáticamente el intervalo de escaneo BLE y prolongar la batería hasta 48 horas continuas.

---

## 🖥️ Despliegue de Nodo Servidor (Relay/Bootstrap)

Si deseas montar un nodo de apoyo en la red global libp2p:

### Compilación desde Fuente
```bash
git clone https://github.com/DarckRovert/RED
cd RED
cargo build --release --package red-node
```

### Puertos de Red
- **7331 (P2P):** Para la comunicación libp2p Kademlia entre nodos.
- **7333 (API Local):** Solo accesible desde el dispositivo (`127.0.0.1`).

---

**RED Docs v31.0.0** — Desplegando libertad bit a bit.
