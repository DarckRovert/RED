# 🛡️ RED Sovereign Mesh OS — Release v92.0.0 (Web Companion, Tri-Hardware QR & Offline Multi-Device Sync Edition)

## 🌟 Aspectos Destacados de la Versión v92.0.0

Esta versión representa la mayor evolución en interoperabilidad multidispositivo y gobernanza de identidad soberana de **RED OS**, incorporando la experiencia completa estilo WhatsApp Web para vinculación de dispositivos, desacoplamiento arquitectónico de variantes QR, flujo onboarding para nodo web independiente y certificación tri-hardware simultánea.

---

### 1. Experiencia Completa "WhatsApp Web UX" en Dispositivos Vinculados (`LinkedDevicesView.tsx`)
- **Gestión Visual de Sesiones Activas:** Visualización de sesión web conectada, plataforma, navegador, dirección IP local y estado de sincronización en tiempo real.
- **Desvinculación Remota Inmediata:** Capacidad de revocar y cerrar la sesión del cliente web de escritorio directamente desde el teléfono móvil en un toque.
- **Botón de Acción Primaria ("Vincular un dispositivo"):** Botón verde flotante con validación de seguridad previa, apertura directa de la cámara con marco de enfoque, alternador de linterna (torch) con apagado automático y soporte para subir fotos con QR desde la galería.
- **Exportación de Cápsula Criptográfica Air-Gap:** Generación de cápsulas cifradas con PBKDF2 y AES-256-GCM para emparejamiento en entornos 100% desconectados de red (Air-Gap).

---

### 2. Desacoplamiento de las 3 Variantes de Códigos QR
- **Variante A — Vinculación de Dispositivo Móvil a Web Companion:** Enlace de bóveda criptográfica P-256 + AES-256-GCM mediante canal bidireccional MQTT/WebSocket o Air-Gap (`RED_PAIR:1:`, `RED_PAIR:2:`, `RED_VAULT:1:`).
- **Variante B — Intercambio de Contacto de Identidad P2P:** Escaneo de identidades `did:red:...` con presentación de **Tarjeta de Vista Previa (Preview Card)** interactiva (Avatar, Alias, DID abreviado y botón "➕ Añadir y Chatear") antes de persistir el contacto.
- **Variante C — Nodo Web Independiente con PIN Maestro (`AuthWall.tsx`):** Pantalla de aterrizaje en escritorio (`>= 768px`) con arquitectura de dos columnas (instrucciones + QR en vivo) y selector explícito para operar como nodo web soberano independiente mediante PIN maestro de 6 dígitos sin necesidad de teléfono móvil.

---

### 3. Erradicación de Deuda Técnica y Pérdida de Carga Útil en Escáneres
- **Enrutamiento Omnicanal:** `ContactQrModal`, `NewChatModal`, `NewContactModal` y `RadarWindow` interceptan y respetan cualquier variante de token (`RED_PAIR:1:`, `RED_PAIR:2:`, `RED_PAIR:`, `RED_VAULT:1:`), abriendo instantáneamente el modal de confirmación `WebCompanionPairConfirmationModal` sin reiniciar la cámara ni descartar el código escaneado.
- **Corrección en Radar Táctico:** Eliminación quirúrgica del elemento `<video>` redundante en `RadarWindow.tsx` que sombreaba la referencia de captura en vivo.
- **Limpieza de Hardware:** El hardware de linterna/flash de la cámara se apaga incondicionalmente al cerrar el visor de escaneo o tras una lectura exitosa.

---

### 4. Certificación Tri-Hardware Concurrente
Despliegue en limpio y verificación concurrente mediante `adb logcat` con **0 crashes**:
- **Xiaomi Redmi Note 14 5G** (`6dife65ls485fega` / `24116RACCG` / Android 15 / HyperOS — Renderizado fluido a ~60 FPS)
- **Lenovo Tab M11** (`HA2CHKZ2` / `TB305XU` / Android 14 — Interfaz C4ISR Táctica en pantalla completa)
- **Motorola Moto G22** (`ZT322B386P` / `hawaiip_g` / Android 12 — Carga limpia del motor nativo Rust `libred_mobile.so`)

---

### 5. Binarios Oficiales para Descarga Directa
- `red-v92.0.0-release.apk` (58.09 MB / 60,909,456 bytes) — SHA256: `0ED7B9C1B6BCF26EC3427117D029E17C05194AC918B6F1098E8C464E883B2C1A`
- `red-latest.apk` (58.09 MB / 60,909,456 bytes) — SHA256: `0ED7B9C1B6BCF26EC3427117D029E17C05194AC918B6F1098E8C464E883B2C1A`
- `SHA256SUMS.txt`

> **Web App & Descarga:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
