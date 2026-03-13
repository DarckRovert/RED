# 🔴 RED - Manual del Administrador (Node Ops v5.0)

Este manual está dirigido a operadores de nodos, desarrolladores e integradores que deseen desplegar, mantener o extender la infraestructura de RED, ahora con soporte nativo para Android 14 y comunicaciones P2P directas.

---

## 🛠️ 1. Despliegue del Nodo (red-node)

### Requisitos Mínimos
- OS: Linux (recomendado), macOS o Windows.
- RAM: 2GB (mínimo).
- Almacenamiento: SSD con al menos 10GB libres para la base de datos de la blockchain ligera y mensajes.

### Despliegue en Android (Nativo)
Para el correcto funcionamiento en dispositivos móviles con Android 14+, es obligatorio configurar el servicio en primer plano:
1. **Foreground Service:** El nodo Rust se ejecuta dentro de un `RedNodeService.java`.
2. **Foreground Type:** Se debe declarar `android:foregroundServiceType="dataSync"` en el `AndroidManifest.xml`.
3. **Optimización de Batería:** Se requiere inyectar `WAKE_LOCK` para evitar que el sistema operativo suspenda los hilos de red P2P.

### Administración del Frontend
RED utiliza **Next.js Static Export** sincronizado vía Capacitor:
1. `npm run build` en `client/app`.
2. `npx cap sync android`.
3. El build estático se inyecta en `assets/public` del contenedor Android.

---

## 🌐 2. Conectividad y Hardware P2P

### BLE Advertiser (Nuevo en v5.0)
El dispositivo ahora actúa como un Periférico GATT (Advertiser).
- **UUID de Servicio:** `00001818-0000-1000-8000-00805f9b34fb`.
- **Funcionamiento:** Emite una señal constante que permite a otros nodos descubrir la identidad del dispositivo sin necesidad de escaneos manuales intrusivos.

### WiFi Direct & Mesh
- **WiFi Direct:** Proporciona un canal de alta velocidad para ruteo local.
- **Mesh Storage:** El nodo implementa una política de *Store-and-Forward* para mensajes volátiles en la red táctica local.

---

## 📊 3. API y Sincronización de Estado

El nodo expone una API REST (puerto 7333) y eventos SSE.
- **Handshake Crítico:** Tras el inicio exitoso del node Rust, el frontend debe realizar un handshake explícito para mutar el estado a `online` en el store de Zustand.
- **Eventos SSE:** `/api/v1/events` es el canal principal para recibir mensajes entrantes e indicadores de latencia de la red mesh.

---

## 🔒 4. Hardening y Seguridad

### Cifrado de Almacenamiento
La base de datos RocksDB utiliza cifrado basado en la `identity_hash` del dispositivo. No se almacenan claves privadas en texto claro.

### Firewall
- **Port 7331 (UDP/TCP):** Tráfico P2P (libp2p).
- **Port 7333 (Local):** Acceso a la API REST (no exponer al exterior).

---

## 🚑 5. Resolución de Problemas

**El nodo se cierra inmediatamente en Android:**
- Verifica los permisos de `POST_NOTIFICATIONS` y `FOREGROUND_SERVICE` en el dispositivo. Android 14 requiere aprobación explícita del usuario.

**Fallo de Handshake (Node Offline):**
- Revisa el Logcat de Android. Si el nodo Rust falla al bindear el puerto 7333, asegúrate de que no haya otra instancia de la app corriendo en segundo plano.

---

**RED Admin Docs** — Soberanía tecnológica mediante hardware real y criptografía robusta.
