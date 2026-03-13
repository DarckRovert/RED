# 🚀 Guía de Despliegue - RED (v5.0)

Esta guía cubre el despliegue de la infraestructura de RED en dispositivos móviles y servidores, optimizada para la versión 5.0 "Solid Gold".

---

## 📱 Despliegue Móvil Nativo (Capacitor 8)

RED se despliega como una aplicación híbrida de alto rendimiento.

### 1. Preparación del Frontend
El frontend en `client/app` debe compilarse como un export estático:
```bash
npm run build # Genera la carpeta /out
```

### 2. Sincronización con Android
```bash
npx cap sync android
npx cap open android # Abre Android Studio
```

### 3. Configuraciones Críticas de Android 14 (API 34)
Para garantizar la estabilidad del nodo P2P:
- **Foreground Service:** El archivo `AndroidManifest.xml` debe incluir:
  ```xml
  <service android:name=".RedNodeService" 
           android:foregroundServiceType="dataSync" />
  ```
- **Energía:** Es recomendable solicitar al usuario el permiso `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.

---

## 🖥️ Despliegue de Nodo Servidor (Relay/Bootstrap)

Si deseas montar un nodo de apoyo en la red global:

### Compilación desde Fuente
```bash
git clone https://github.com/DarckRovert/RED
cd RED
cargo build --release --package red-node
```

### Configuración del Firewall
Asegura que los siguientes puertos estén abiertos:
- **7331 (P2P):** Para la comunicación libp2p entre nodos.
- **7333 (API Local):** Solo accesible desde el dispositivo (localhost).

---

## 🔐 Seguridad y Post-Instalación

- **Firma de APK:** Siempre genera APKs firmadas para producción para habilitar las APIs de Google/Android seguras.
- **Detección de Root:** El sistema detectará automáticamente si el dispositivo es inseguro y lo notificará en el panel de Criptografía.

---

**RED Docs v5.0** — Desplegando libertad bit a bit.
