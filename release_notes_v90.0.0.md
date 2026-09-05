# 🛡️ RED Sovereign Mesh OS — Release v90.0.0 (Modo Familiar WhatsApp & PQC Master Edition)

## 🌟 Aspectos Destacados de la Versión v90.0.0

Esta versión representa el hito más accesible y potente en la historia de **RED OS**, unificando la robustez criptográfica post-cuántica y la resistencia off-grid con una **interfaz familiar intuitiva inspirada en WhatsApp** (`uiMode: 'familiar'`) 100% funcional.

---

### 1. Modo Familiar (WhatsApp UX) Soberano & Real
- **Intercambio Instantáneo de Contactos QR (`ContactQrModal.tsx`):**
  - "Mi código": Renderizado vectorial SVG/Canvas offline sin conexiones a servicios cloud de terceros, apodo, avatar, DID y botón para compartir vía Web Share o portapapeles.
  - "Escanear código": Escaneo de cámara física nativa con Capacitor Barcode Scanner, visor verde estilo WhatsApp, linterna, soporte para fotos de la galería (`BarcodeDetector` / HTML5 Canvas), guardado automático de contacto y anuncio criptográfico en la malla.
  - Blindaje CSS `.contact-qr-scanner-overlay` contra borrado de fondos en WebViews de Android.
- **Previsualizador Multimedia WhatsApp (`MediaSendPreviewModal.tsx`):**
  - Previsualización a pantalla completa de fotos y videos tomados con la cámara o elegidos de la galería antes del envío.
  - Selector de emojis e input inferior para añadir pie de foto (`caption`), transmitido e indexado de extremo a extremo en la malla.
- **Ventana de Chat & Quick-Starters:**
  - Tarjeta de contacto no guardado (`#182229`) con acciones directas para añadir o bloquear nodo (`blockNode`).
  - Botones de inicio rápido en conversaciones vacías: `👋 Decir Hola`, `📷 Enviar foto` y `📞 Llamar`.
  - Notas de voz con ondas de audio dinámicas en colores WhatsApp `#00A884` / `#53BDEB`.
- **Novedades & Estados Efímeros (`StatusView.tsx`):**
  - Anillos de historias WhatsApp con temporizador de 24h distribuidos vía Gossipsub sin servidores centrales.
  - Botones de acción flotantes (FABs) para publicar estados de texto o multimedia.
- **Historial de Llamadas & Selector de Contactos (`CallsHistoryView.tsx`):**
  - Selector táctico-familiar con buscador en tiempo real y disparo directo de llamadas WebRTC de voz (`📞`) y video (`📹`).
- **Ajustes Familiares & Alternancia Inmediata (`FamiliarSettingsView.tsx`):**
  - Perfil del operador con acceso directo al código QR soberano.
  - Switch interactivo para alternar en caliente entre Modo Familiar (WhatsApp) y Modo Táctico C4ISR.

---

### 2. Certificación Empírica Tri-Hardware
Despliegue en limpio y verificación concurrente mediante `adb logcat` con **0 crashes**:
- **Xiaomi Redmi Note 14 5G** (`6dife65ls485fega` / Android 15 / HyperOS)
- **Lenovo Tab** (`TB305XU` / Android 14)
- **Motorola Moto G22** (`ZT322B386P` / Android 12)
- Enlace P2P verificado: establecimiento de conexiones libp2p en TCP 7331 y descubrimiento de vecinos por mDNS multicast.

---

### 3. Binarios Oficiales para Descarga Directa
- `red-v90.0.0-release.apk` (58.06 MB / 60,878,999 bytes) — SHA256: `97819E2199C008CBDED240AD54086FE7086C1C399F9199B79C3782BC4E25E2A7`
- `red-latest.apk` (58.06 MB / 60,878,999 bytes) — SHA256: `97819E2199C008CBDED240AD54086FE7086C1C399F9199B79C3782BC4E25E2A7`
- `SHA256SUMS.txt`

> **Web App & Descarga:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
