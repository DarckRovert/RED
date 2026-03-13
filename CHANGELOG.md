# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [5.0.0] - 2026-03-13

### Añadido — Rediseño "Solid UI" & Hardware Real (Fases 25-33)

**Nueva Identidad Visual "Solid/Clean"**
- **Adiós Glassmorphism:** Eliminación global de transparencias y efectos de desenfoque (`backdrop-filter`) en favor de un diseño sólido, profesional y de alto contraste inspirado en WhatsApp y Telegram.
- **Burbujas con Estilo:** Mensajes con "colas" direccionales y nueva jerarquía visual de timestamps y ticks de lectura.
- **Input Capsular:** Rediseño del pie de chat en forma de píldora con iconos de adjuntos integrados y botón de voz/enviar flotante.
- **Avatares Dinámicos:** Sistema de generación de avatares automáticos (Iniciales + Color Hash) para todos los contactos y grupos.
- **Wallpaper de Chat:** Integración de texturas de fondo sutiles para una experiencia de chat inmersiva.

**Conectividad & Hardware (Real P2P)**
- **BLE Peripheral Real:** Implementación nativa en Java (`RedNodeService.java`) del rol de Anunciante (Advertiser), permitiendo que el dispositivo sea descubierto por otros sin necesidad de escaneo activo constante.
- **Radar Nearby Live:** El panel de dispositivos cercanos ahora utiliza hardware real para detectar y conectar pares mediante BLE y WiFi Direct.
- **Estabilidad Android 14:** Corrección de fallos críticos de servicios en primer plano mediante la implementación de `FOREGROUND_SERVICE_TYPE_DATA_SYNC` y manejo de excepciones en el bootstrap del nodo Rust.

**Integración de Datos Reales**
- **Fin de los Mocks:** Saneamiento completo de las vistas de Administración de Grupos, Multidispositivo y Estadísticas, conectándolas directamente al estado real del nodo Rust y Zustand.
- **Auditoría Visual Global:** Revisión y pulido de más de 12 vistas secundarias (Cripto, Status, Perfil, Nodos) para asegurar una consistencia visual del 100%.

---

## [4.0.0] - 2026-03-09

### Añadido — Suite de Seguridad Total (Fases D, F, G, E, H)

**Seguridad Activa & Anti-Forense**
- Bloqueo avanzado de captura y grabación de pantalla (FLAG_SECURE a nivel de OS).
- PIN de Pánico (Wipe Lockscreen): Destrucción automática criptográfica bajo coacción.
- Disfraz de Aplicación: Icono y nombre de "Calculadora" en el sistema operativo.
- Dead Man's Switch: Purga cronometrada automática configurable de cuenta y base de datos local por inactividad.

**Anonimato & Trazabilidad**
- Burner Chats (RAM-Only): Conversaciones efímeras ultraseguras mantenidas puramente en estado volátil.
- Compartir Ubicación en Vivo (Live Tracking E2E): Emisión de coordenadas y mapas interactivos que se autodestruyen.
- Auditoría del Secure Enclave: Detección mockeada de Root, Jailbreak y emuladores hostiles dentro de los paneles criptográficos y HUD.

**UI/UX Overhaul (Premium)**
- Transición general a Modo "True Black" para displays OLED.
- Tipografía global _JetBrains Mono_ priorizada para datos sensibles, hashes, DIDs y direcciones IP.
- Landing Page reescrita: Integración de **Globe.gl** y **Three.js** mostrando un globo terráqueo interactivo en 3D para ilustrar la red P2P global en tiempo real.
- HUD Táctico permanente informando si el tráfico corre vía Mesh Local, BLE, o red Global de Internet.

---

## [3.0.0] - 2026-02-26

### Añadido — Fases 14-36 (WhatsApp Parity + RED Exclusive)

**Mensajería avanzada**
- Estados/Stories de 24h con compose de texto e imagen, selector de fondo, progress bar animada
- Mensajes guardados (⭐) con página dedicada y unstar
- Vista previa automática de URLs (LinkPreview.tsx sin trackers)
- Encuestas interactivas en grupos (PollBubble + PollComposer, hasta 6 opciones)
- Mensajes efímeros por conversación (setDisappearingTimer)
- Mensajes programados con setTimeout (scheduleMessage/cancelScheduled)
- Reenviar mensaje a cualquier conversación (forwardMessage)

**Red & Dispositivos**
- Multi-dispositivo por QR SVG procedural (/multidevice)
- Sincronización de contactos por deeplink `red://add-contact/...` (/contactsync)
- RED Nearby: UI de descubrimiento LAN/BLE con animación de pulso
- Exportar chat como .txt o .json con Blob/URL API (/export)
- Mapa de nodos RED animado en tiempo real (SVG, 8 nodos, aristas pulsantes) (/nodemap)

**Perfil & Presencia**
- Historial de llamadas con filtro perdidas/todas (/calls)
- Perfil de contacto detallado: 4 pestañas (Info, Multimedia, Archivos, Links) (/contactprofile)
- Códigos QR por DID con Web Share API (/contactqr)
- Estadísticas de uso con 3 períodos y gráfico de barras (/stats)

**Admin & Grupos**
- Panel de admin de grupo: promover/demote/silenciar/expulsar con toasts (/groupadmin)
- Listas de difusión: crear, seleccionar contactos, envío masivo (/broadcast)
- Búsqueda global de mensajes con resaltado del término (/search via Sidebar 🔍)

**Seguridad**
- Panel de criptografía: vista de claves DH/Ed25519, renegociación DH, verificación de integridad (/crypto)

**UX & Personalización**
- Tema claro/oscuro con variables CSS y persistencia en localStorage
- Fondos de conversación: 6 gradientes por chat (WallpaperPicker.tsx)
- Etiquetas de chat: 6 tipos con colores (ChatLabels.tsx)
- Notificaciones por chat: silenciar, tono, vibración, media preview (ChatNotifSettings.tsx)
- Indicador offline con reconexión automática (OfflineIndicator.tsx)

### Estadísticas v3.0
- **21 rutas de producción** (eran 8 en v1.0)
- **16 componentes** reutilizables
- **36 fases** completadas
- **~52 KB** de CSS (components.css)
- Build: `exit code 0` ✅

---

## [2.0.0] - 2026-02-25

### Añadido — Fases 9-13 (Mensajería Real & Calls)
- Reply a mensaje con cita visual en burbuja
- Reacciones emoji (6 opciones, menú contextual)
- Eliminar mensaje, estado entrega (✓ ✓✓ azul)
- Media: imágenes, audio (MediaRecorder), archivos (FileReader base64)
- DisplayName + avatar persistentes en localStorage
- Typing indicator animado ("escribiendo...")
- Service Worker + Notification API (Push)
- CallScreen.tsx: WebRTC, controles mute/cámara/speaker, timer

---

## [1.0.0] - 2026-02-25

### Añadido
- **Producción Ready**: Lanzamiento oficial del protocolo RED.
- **Multiplataforma**: Soporte completo para iOS, Android y Navegadores (Capacitor).
- **Grupos Descentralizados**: Salas de chat cifradas sin servidores centrales.
- **Explorador Blockchain**: Dashboard técnico para monitorear la salud de la red P2P.
- **Onboarding Interactivo**: Flujo de bienvenida para generación segura de identidades DID.
- **Libreta de Contactos**: Directorio funcional con búsqueda global y gestión de identidades.
- **UX Premium**: Sistema de notificaciones Toast, indicadores de entrega (ticks) y visuales de multimedia.
- **Emergency Mobile Polish**: Eliminación de solapamientos visuales, corrección de z-index en móviles y optimización de legibilidad de textos.
- **Demo Mode**: Sistema de persistencia de datos mock para demostraciones de funcionalidad sin nodo local.
- **Documentación Completa**: Manual de Usuario, Manual de Administrador y especificaciones actualizadas.

---

## [0.2.0-beta] - 2026-02-15

### Añadido
- Interfaz gráfica (Web UI) con Next.js y Zustand.
- Integración real con el nodo Rust mediante HTTP API y SSE.
- Sistema de búsqueda en tiempo real.
- Optimización de áreas seguras para dispositivos móviles.

---

## [0.1.0-alpha] - 2026-02-01

### Añadido

#### Core Criptográfico
- Implementación de X25519 para intercambio de claves
- Implementación de Ed25519 para firmas digitales
- Cifrado ChaCha20-Poly1305 (AEAD)
- Hashing con BLAKE3
- Derivación de claves con HKDF
- Protocolo Double Ratchet completo
  - Ratchet DH
  - Ratchet de cadena
  - Manejo de mensajes fuera de orden
  - Forward secrecy

#### Sistema de Identidad
- Generación de identidades anónimas
- Rotación de identidad (unlinkability)
- Hash de identidad con nonce aleatorio
- Exportación/importación cifrada de identidades

#### Red P2P
- Configuración de red básica
- Estructura de peers
- Onion routing (3 capas)
- Generador de tráfico dummy (distribución Poisson)
- Protocolo Gossip para propagación

#### Protocolo de Mensajería
- Mensajes de texto cifrados
- Conversaciones 1:1
- Mensajería grupal (Sender Keys)
- Metadatos cifrados

#### Blockchain
- Estructura de bloques
- Cadena de bloques básica
- Transacciones de identidad
- Consenso Proof of Stake (básico)

#### Almacenamiento
- Almacenamiento local cifrado
- Política de borrado automático (30 días)

#### Pruebas Zero-Knowledge
- Pruebas de membresía Merkle
- Sistema de nullifiers

#### Especificaciones Formales
- Especificación TLA+ del protocolo
- Modelos ProVerif para verificación de seguridad
- Pruebas de anonimato en ProVerif

#### Bindings
- Bindings Python (PyO3)
- Bindings JavaScript/TypeScript (WASM)

#### Documentación
- README principal
- Especificación matemática
- Arquitectura del sistema
- Referencia de API
- Informe de auditoría de seguridad

### Seguridad
- Parámetro de seguridad: 128 bits
- Borrado seguro de claves (zeroize)
- Validación de entradas criptográficas

### Limitaciones Conocidas
- Red P2P aún no conectada a libp2p real
- Blockchain sin persistencia completa
- Sin cliente móvil/desktop
- Sin llamadas de voz/video

---

## Roadmap

### [0.2.0] - Planificado Q2 2026
- Integración completa con libp2p
- Cliente CLI funcional
- Tests de integración end-to-end
- Mejoras de rendimiento

### [0.3.0] - Planificado Q3 2026
- Cliente móvil (Flutter)
- Cliente desktop (Tauri)
- Sincronización multi-dispositivo
- Grupos grandes (1000+ miembros)

### [0.4.0] - Planificado Q4 2026
- Llamadas de voz cifradas
- Transferencia de archivos grandes
- Auditoría de seguridad externa
- Optimizaciones de batería (móvil)

### [1.0.0] - Planificado 2027
- Lanzamiento público estable
- Apps en stores oficiales
- Documentación completa
- Soporte empresarial

---

## Tipos de Cambios

- **Añadido** para nuevas funcionalidades.
- **Cambiado** para cambios en funcionalidades existentes.
- **Obsoleto** para funcionalidades que serán eliminadas próximamente.
- **Eliminado** para funcionalidades eliminadas.
- **Corregido** para corrección de bugs.
- **Seguridad** para vulnerabilidades corregidas.
