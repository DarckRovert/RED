# RED — Sovereign Tactical Mesh OS v55.0.0
> **Build Code:** 55000 | **Release Channel:** stable-p2p | **Protocol Version:** RED/55.0-SOVEREIGN-TACTICAL-MESH

RED v55.0.0 es la versión definitiva y ultra-optimizada del sistema operativo táctico de comunicaciones en malla fuera de red (Off-Grid). Esta entrega resuelve la ergonomía de navegación y el layout visual a través de un sistema de scroll universal, desacopla completamente los flujos de escaneo de cámara (Contactos P2P vs Sincronización Web PC) y optimiza la distribución de imágenes y elementos multimedia en cualquier factor de forma.

---

## 🌟 Novedades Principales en v55.0.0

### 1. Sistema de Scroll Universal & Modales Adaptativos (.modal-card-scrollable)
- **Contención de Viewport Dinámico (100dvh):** Todas las tarjetas flotantes y modales (max-height: calc(100dvh - 32px)) ahora cuentan con scroll vertical táctil suave (overflow-y: auto, overscroll-behavior: contain, 	ouch-action: pan-y).
- **Resiliencia ante Teclado Virtual:** Los botones de acción, campos de texto y códigos QR ya no se cortan ni quedan inaccesibles en pantallas compactas o cuando el teclado virtual de Android se despliega.
- **Modales Optimizados:** *Agregar Contacto / Nuevo Chat*, *Autorización de Vinculación Web*, *Generador de QR Companion*, *Entrada Manual de Enlace*, *Auditoría de Bloques Merkle*, *Búsqueda Global*, *Confirmación de Purga de Pánico*.

### 2. Desacoplamiento de Flujos de Escaneo de Cámara
- **Escáner 1: Contacto P2P (Malla Móvil & Nodos de Campo):**
  - Identidad visual verde esmeralda (#00E676) con retícula de contacto y haz láser verde-cian.
  - Título y orientación explícitos: 🤝 ESCÁNER DE CONTACTO P2P.
  - Acceso directo desde el modal de agregar contacto y desde el Radar táctico.
- **Escáner 2: Vinculación con RED Web (PC):**
  - Identidad visual azul cian neón (#00E5FF) y púrpura bóveda (#B388FF).
  - Título y orientación explícitos: 💻 VINCULAR SESIÓN RED WEB (PC).
  - Acceso exclusivo desde el botón de ordenador en la cabecera superior.
- **Cierre Atómico de Cámara:** Liberación inmediata de la vista nativa de cámara (BarcodeScanner.stopScan(), BarcodeScanner.showBackground()) previniendo solapamiento o fugas de proceso.

### 3. Distribución Responsiva de Imágenes & Medios en Chat
- **Contención de Burbuja Multimedia (.chat-media-container, .chat-media-img):** Las fotos y videos ahora respetan límites adaptativos (max-height: min(260px, 42vh), max-width: min(320px, 78vw) con object-fit: cover).
- **Navegación Táctica sin Obstrucción:** Padding de descompresión inferior en la lista de chats (28px) y en el Centro de Control lateral (36px) para garantizar acceso al último elemento sin colisionar con el Dock Táctico inferior.

### 4. Estética Cyber-Tactical UX & Balizas de Presencia en Malla
- **Indicadores LED Pulsantes (eaconPulse):** Respiración verde esmeralda en tiempo real en los avatares de contactos conectados a la malla física.
- **Estación Holográfica de Ciberseguridad (cyberShieldGlow):** Estados vacíos de chat con tarjetas cuánticas interactivas (Safety Number, Brújula Táctica y Radar Malla).
- **Badge de Versión Dinámico:** Muestra siempre 55.0 derivado de la fuente única de verdad del sistema.

---

## 📦 Binarios Oficiales

| Archivo | Plataforma | Arquitectura |
| :--- | :--- | :--- |
| **ed-v55.0.0.apk** | Android 7.0+ | ARM64 (rm64-v8a) |
| **ed-latest.apk** | Android 7.0+ | ARM64 (rm64-v8a) |

> **Web App Companion:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
