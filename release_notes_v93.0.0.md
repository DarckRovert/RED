# 🛡️ RED Sovereign Mesh OS — Release v93.0.0 (Tactical UI Primitives, Dynamic Portals & Hardened Mesh Sync Edition)

## 🌟 Aspectos Destacados de la Versión v93.0.0

Esta versión consolida la arquitectura de interfaz de usuario de **RED OS** mediante primitivos tácticos de alto rendimiento, erradicación de cuellos de botella en apilamiento CSS (*stacking context*), física gestual fluida para mensajería, telemetría espectral RF y blindaje contra eventos de baja memoria en hardware móvil Android.

---

### 1. Primitivos UI Tácticos y Aislamiento de Stacking Context
- **`Tooltip.tsx` Desacoplado & Dinámico:** Inyección en el nodo raíz (`document.body`) mediante `createPortal` para evitar el confinamiento por contenedores padres con `transform` o `overflow: hidden`. Incorpora composición bidireccional de `ref`, subscripciones pasivas de `scroll` y `resize` para seguimiento continuo del disparador, y cálculo dinámico de `arrowOffset` que mantiene la flecha apuntando al centro exacto del elemento disparador ante clamping de pantalla.
- **`ConfirmDialog.tsx` Accesible & Anti-Bleed:** Diálogo modal montado con `createPortal`, bloqueo estricto de scroll de fondo (`document.body.style.overflow = 'hidden'`) y trampa de foco accesible (`Tab` / `Shift+Tab` y descarte con `Escape`).
- **`ContactShareModal.tsx`:** Estandarizado con `createPortal`, scroll-lock y cierre por teclado.
- **Primitivos SSOT:** `Badge`, `LoadingSpinner`, `ProgressBar`, `EmptyState`, `SkeletonCard` y `ErrorBanner` centralizados en `components/ui/index.ts`.

---

### 2. Mensajería Gestual Avanzada (`MessageBubble.tsx`)
- **Swipe-to-Reply Táctico:** Física de arrastre elástico con umbral de activación dinámico a 65px, respuesta visual con icono dinámico e inyección automática del contexto citado en el input de chat.
- **Menú Contextual Flotante & Selector de Reacciones:** Activación por pulsación prolongada (500ms) o clic derecho con selector interactivo de reacciones tácticas (`['👍', '❤️', '🔥', '😂', '😮', '⚡', '🛡️']`) y acciones rápidas (Copiar, Reenviar, Fijar).

---

### 3. Telemetría de Enjambre y Espectro RF
- **Radar Angular en `NearbyDevicesPanel.tsx`:** Posicionamiento trigonométrico de blips en vivo calculados según distancia y azimut, conectado a `GET /api/proximity` con validación rigurosa de niveles RSSI.
- **Topología Swarm en `NetworkPanel.tsx`:** Monitorización en tiempo real de enlaces (WiFi, BLE, LoRa, TCP, QUIC) y panel de telemetría espectral RF con salto de canal interactivo.
- **Integración con Guardian AI:** Estadísticas consolidadas de seguridad en tiempo real.

---

### 4. Blindaje de Memoria Android (`AndroidManifest.xml`)
- Inclusión de directivas `android:largeHeap="true"` y `android:hardwareAccelerated="true"` para prevenir la terminación prematura de procesos de renderizado WebView por el Low Memory Killer (LMK) en dispositivos con recursos compartidos.

---

### 5. Certificación Multi-Hardware Concurrente
Verificación y despliegue en limpio mediante `adb logcat` con **0 crashes**:
- **Lenovo Tab M11** (`HA2CHKZ2` / Android 14) — Arranque de motor nativo y renderizado a resolución nativa verificado.
- **Motorola Moto G22** (`ZT322B386P` / Android 12) — Carga limpia del motor nativo Rust `libred_mobile.so`, onboarding táctico y permisos sin excepciones.

---

### 6. Binarios Oficiales para Descarga Directa
- `red-v93.0.0-release.apk` (58.11 MB / 60,934,576 bytes) — SHA256: `99D47A320B28A3CE74FFD13411C67FBAF946A6E1A32B578E8308B7214271F43F`
- `red-latest.apk` (58.11 MB / 60,934,576 bytes) — SHA256: `99D47A320B28A3CE74FFD13411C67FBAF946A6E1A32B578E8308B7214271F43F`
- `SHA256SUMS.txt`

> **Web App & Descarga:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
