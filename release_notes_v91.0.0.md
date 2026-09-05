# 🛡️ RED Sovereign Mesh OS — Release v91.0.0 (Excelencia Tri-Hardware & Carrier Sense Edition)

## 🌟 Aspectos Destacados de la Versión v91.0.0

Esta versión consolida la excelencia operativa y la experiencia táctica y familiar de **RED OS**, incorporando telemetría de canal en tiempo real en Walkie-Talkie con Carrier Sense, un escáner QR universal híbrido en Radar, PIP flotante con Pointer Events multitouch, visor de historias con pausa milimétrica y blindaje anti-DoS simétrico en el núcleo Rust.

---

### 1. Walkie-Talkie Táctico P2P con Carrier Sense & Shockwaves Visuales (`P2PWalkieTalkieModal.tsx`)
- **Carrier Sense Dinámico en Tiempo Real:** Detección de portadora RF y estado del canal (Libre `#10B981`, Ocupado `#EF4444`, Transmitiendo `#3B82F6`) con lectura continua de decibelios (dBFS).
- **Ondas Expansivas Visuales (Shockwaves):** Anillos de pulso animados multicapa que reaccionan con la modulación de voz y el estado PTT (Push-to-Talk).
- **Gestión Segura de AudioContext:** Inicialización segura como singleton con recuperación automática de estados suspendidos ante gestos táctiles.

---

### 2. Escáner QR Universal Híbrido en Radar (`RadarWindow.tsx`)
- **Arquitectura Tri-Capa de Escaneo:** Escáner nativo MLKit en Android (`@capacitor-community/barcode-scanner`), fallback WebCam directo (`getUserMedia` + `BarcodeDetector`) y lector de imágenes estáticas desde galería/almacenamiento local (`HTMLCanvasElement`).
- **Resolución Inteligente de Identidades:** Extracción y enlace automático de DIDs `did:red:...`, direcciones de red y claves Ed25519 con difusión P2P de handshake en la malla.
- **Acceso Directo al Chat:** Botón para iniciar mensajería privada inmediata tras el escaneo o detección de un nodo.

---

### 3. PIP Flotante Universal con Pointer Events (`FloatingCallPIP.tsx`)
- **Soporte Multitouch & Ratón:** Arrastre continuo y fluido mediante `PointerEvents` sin desfases ni pérdidas de puntero al salir del marco.
- **Mini-onda de Audio Remoto:** Visualizador de forma de onda en tiempo real del audio entrante durante llamadas activas y alternador de micrófono directo en el widget flotante.

---

### 4. Visor de Estados WhatsApp con Pausa Milimétrica (`StoryViewer.tsx`)
- **Pausa Táctil de Alta Precisión:** Acumulador de milisegundos (`accumulatedMsRef`) en eventos `pointerdown`/`pointerup` para congelar y reanudar el progreso de la historia con exactitud matemática.
- **Modo Inmersivo Dinámico:** Ocultación instantánea de la interfaz y barra de progreso durante la pulsación mantenida, y selector rápido de reacciones emoji.

---

### 5. Blindaje Anti-DoS Simétrico en Rust JNI y CLI (`red_mobile` & `red_node`)
- **Validación Estricta de Entradas:** Detección y rechazo de cadenas hexadecimales impares, límite de búfer hex a 1MB, marco mínimo de 4 bytes y cota máxima de 512KB por mensaje, previniendo agotamiento de memoria o pánico en el motor nativo.

---

### 6. Certificación Tri-Hardware
Despliegue en limpio y verificación concurrente mediante `adb logcat` con **0 crashes**:
- **Lenovo Tab** (`HA2CHKZ2` / `TB305XU` / Android 14)
- **Motorola Moto G22** (`ZT322B386P` / `hawaiip_g` / Android 12)
- **Xiaomi Redmi Note 14 5G** (`6dife65ls485fega` / Android 15 / HyperOS)

---

### 7. Binarios Oficiales para Descarga Directa
- `red-v91.0.0-release.apk` (58.07 MB / 60,885,595 bytes) — SHA256: `472FB819EC1332C83AD3485A827AD64E30D21762161A925151E70AA68B299EC8`
- `red-latest.apk` (58.07 MB / 60,885,595 bytes) — SHA256: `472FB819EC1332C83AD3485A827AD64E30D21762161A925151E70AA68B299EC8`
- `SHA256SUMS.txt`

> **Web App & Descarga:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
