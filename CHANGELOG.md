# Changelog

## [57.0.0-modular-architecture] - 2026-08-22

### Sovereign Tactical Master Edition — Clean Modular Architecture, Zero-Bloat & Universal Multi-Device Synergy

**Modularización Integral de Arquitectura Frontend & Descomposición de Monolitos**
- `src/store/`: Descomposición completa del God Store monolítico `useRedStore.ts` en **Zustand Slices modulares** con tipado estricto: `uiSlice.ts`, `authSlice.ts`, `chatSlice.ts`, `contactsSlice.ts`, `callSlice.ts`, `emergencySlice.ts`, `socialSlice.ts` y despacho de eventos en tiempo real aislado en `messageDispatcher.ts`.
- `src/api/`: Reestructuración del cliente HTTP Axum en módulos especializados: `types.ts`, `core.ts`, `client.ts`, `emergency.ts`, `channels.ts`, `ai.ts`, `sensors.ts`, `economy.ts`, `index.ts`.
- `src/lib/`: Reorganización de 34 motores planos en subdirectorios temáticos de dominio: `crypto/`, `ai/`, `emergency/`, `audio/`, `sensors/`, `storage/`, `network/`.
- `src/components/showcase/`: Fragmentación de la landing page `RedShowcaseLanding.tsx` (3,175 LOC) en 10 submódulos atómicos (`LandingHeader`, `LandingHero`, `LandingBentoAndMatrix`, `LandingMeshSimulator`, `LandingModuleCatalog`, `LandingInteractiveLabs`, `LandingUseCasesAndArchitecture`, `LandingFooterAndModals`, `types.ts`, `catalogData.ts`).
- `src/components/settings/`: Fragmentación de `SettingsModal.tsx` (1,304 LOC) en 9 pestañas temáticas (`AppearanceTab`, `CallsTab`, `AudioTab`, `StorageTab`, `PrivacyTab`, `MeshTab`, `IdentityTab`, `BackupTab`, `UpdatesTab`).
- `src/components/sidebar/`: Fragmentación de `Sidebar.tsx` (1,149 LOC) en `SidebarHeader.tsx`, `ConversationList.tsx`, `ContactList.tsx` y `types.ts`.
- `src/components/call/`: Fragmentación de `CallScreen.tsx` (1,337 LOC) en `CallHeader.tsx`, `CallVideoGrid.tsx`, `CallConnectingOverlay.tsx`, `CallControls.tsx` y `CallStatsModal.tsx`.
- `src/components/chat/`: Encapsulación modular de `ChatHeader.tsx` en `ChatWindow.tsx`.

**Blindaje Nativo Rust & Estabilización de Compilación Workspace**
- `Cargo.toml`: Unificación canónica de versión `v57.0.0` (Build `57000`) en todo el workspace (`core`, `node`, `red_mobile`, `blockchain`, `client`).
- `core/src/network/node.rs`, `core/src/protocol/group.rs`, `node/src/api.rs`: Limpieza y resolución de dependencias de `libp2p_yamux` y `red_core`. Verificado con `cargo check --workspace` y unit tests con Exit Code 0.

**Validación Multi-Dispositivo en Hardware Real (Moto G + Tablet Lenovo)**
- Despliegue en limpio verificado mediante `adb` en Motorola Moto G (`ZT322B386P`) y Lenovo Tab (`HA2CHKZ2`).
- Ejecución en segundo plano con Foreground Service `RedNodeService` y carga exitosa de la biblioteca nativa `libred_mobile.so` ARM64.
- Interfaz adaptativa con soporte multi-columna en tablet y HUD táctico optimizado para navegación por gestos.

---

## [55.0.0-sovereign-tactical-mesh] - 2026-08-21

### Sovereign Tactical Mesh OS Edition — Universal Scroll, Decoupled Scanners & Responsive Media Distribution

**Sistema de Scroll Universal & Modales Adaptativos (`.modal-card-scrollable`)**
- `globals.css`: Implementada la utilidad universal `.modal-card-scrollable` que fija la altura máxima a `calc(100dvh - 32px)` con `overflow-y: auto`, `overscroll-behavior: contain` y `touch-action: pan-y`.
- `Sidebar.tsx`, `WebCompanionPairConfirmationModal.tsx`, `WebCompanionQRModal.tsx`, `WebCompanionLinkModal.tsx`, `BlockDetailsModal.tsx`, `GlobalSearchModal.tsx`, `DMSSettings.tsx`: Integración de scrolling adaptativo para garantizar que ningún botón o texto quede fuera del campo visual en pantallas compactas o con el teclado virtual abierto.

**Desacoplamiento de Flujos de Escaneo de Cámara & Temas Visuales Dedicados**
- `RadarWindow.tsx`: Visor de cámara exclusivo para contacto P2P (`🤝 ESCÁNER DE CONTACTO P2P`) con retícula verde esmeralda y haz láser esmeralda-cian.
- `WebCompanionLinkModal.tsx`: Visor de cámara exclusivo para sincronización con PC (`💻 VINCULAR SESIÓN RED WEB`) con retícula cian neón y púrpura bóveda.
- `Sidebar.tsx`: Diferenciación de accesos directos y liberación atómica de recursos de cámara en desmontaje.

**Distribución Responsiva de Imágenes & Medios en Chat**
- `MessageBubble.tsx`: Encapsulación de fotos y videos en `.chat-media-container` (`max-height: min(260px, 42vh)`, `max-width: min(320px, 78vw)`, `object-fit: cover`).
- `Sidebar.tsx`: Padding de descompresión inferior en la lista de chats (`28px`) y en el Menú Lateral (`36px`) para evitar obstrucción con el Dock Táctico inferior.

---

## [54.0.0-sovereign-tactical-mesh] - 2026-08-21

### Sovereign Tactical Mesh OS Edition — Full Synergy, Isolated Discovery & 100% Offline AI Engines

**Aislamiento Estricto de Contactos & Consentimiento Soberano P2P**
- `meshRouter.ts`: Desacoplado el descubrimiento de presencia (`IDENTITY_ANNOUNCE`, `IDENTITY_RESPONSE`) de la libreta de contactos guardados. Las balizas de balizaje ahora solo actualizan metadatos en memoria y no inyectan contactos sin consentimiento explícito.
- `useRedStore.ts`: Eliminadas inserciones automáticas de contactos fantasma en deserialización de tramas JSON y respuestas de perfiles.

**Sanitización Integral de Protocolo y Filtro de Fugas de Señalización**
- `ChatWindow.tsx`: Implementada función `isProtocolPacket` con lista de bloqueo de 28 tipos de paquetes de señalización (`read_up_to`, `delivery_ack`, WebRTC, etc.) para impedir que señales JSON crudas se rendericen en el chat.
- `Sidebar.tsx`: Sanitización de la vista previa del último mensaje para evitar snippets con JSON de control.

**Motores de IA 100% Offline Acelerados y Blindados**
- `localAiEngine.ts`: Implementado caché vectorial en memoria (`kbVectorCache`) para la base de conocimiento de supervivencia RAG, reduciendo la latencia de inferencia de 2.5s a **<120ms (aceleración 20x)**. Clasificador semántico contextual de 8 dominios.
- `guardianEngine.ts`: Comparador de distancia Hamming bitwise de 64 bits (`dist <= 4`) contra patrones maliciosos y esteganografía hostil en imágenes y textos.
- Empaquetado local de modelos ONNX (`toxic-bert`, `all-MiniLM-L6-v2`) y runtimes WASM en los assets nativos de Android.

**Sinergia Funcional & Elevación Visual/UX**
- `MessageBubble.tsx`: Traducción in-place en burbuja con IA local (🌐) y consulta contextual al Copiloto IA (🤖). Renderizador de fichas médicas `vital_sign` (Triage START con colores de prioridad, BPM, SpO2).
- `ChatInput.tsx`: Botón flotante Asistente IA (✨) con reescritura militar `[SITREP]`, traducción a inglés y camuflaje leetspeak. Acceso a Ficha VitalScan (🫀) en menú de adjuntos 📎.
- `ChatWindow.tsx`: Botón de Brújula Táctica P2P (🧭) en la cabecera del chat para apuntar rumbo físico al contacto.
- `VitalScanModal.tsx`: Transmisión de fichas de triage y signos vitales directamente al chat activo con cifrado E2E.
- `Sidebar.tsx`: Dock Táctico HUD inferior unificado (Chats, Radar con conteo de nodos en vivo, Copiloto IA, Brújula, Bóveda) con padding seguro para gestos de navegación.

---

## [53.0.0-tactical-refinement] - 2026-08-21

### Tactical Refinement, Storage Streamlining & UX Optimization Edition

**Diferenciación Funcional de Acciones en Barra Superior**
- `Sidebar.tsx`: Diferenciación funcional entre el botón de cámara `📷` (disparo directo del creador de fotos/historias efímeras tácticas de 24h `setStoryModal("creator")`) y el botón `➕` (apertura del formulario modal de registro de nuevo contacto/chat P2P soberano `setAddContactOpen(true)`).

**Saneamiento de Protocolo de Borrado Remoto y Filtrado de Broadcast**
- `lib/api.ts`: Incorporación de `conversation_wipe`, `message_wipe`, `profile_update` y el filtro de carga útil `user_remote_wipe` al conjunto `isControlMessage`, evitando la persistencia de comandos de protocolo como burbujas de texto visibles.
- `MessageBubble.tsx`: Renderizado táctico estilizado tipo banner de sistema para avisos de purga remota en lugar de exponer estructuras JSON en bruto.
- `useRedStore.ts`: Filtrado preventivo de direcciones de broadcast (`ffffffff...` y `00000000...`) y paquetes de control en el generador y cargador de conversaciones, garantizando que nunca se creen chats ficticios.

**Optimización Extrema del Tamaño del Paquete Binario (-83% de peso)**
- Saneamiento del árbol de assets públicos de Capacitor eliminando archivos `.apk` anidados recursivamente, reduciendo el peso final del APK de 1.16 GB a **199.36 MB** con tiempos de compilación de **17 segundos**.

---

## [52.0.0-autonomous-mesh] - 2026-08-21

### Autonomous Mesh & P2P Live Sync Edition — Sincronización Dinámica de Identidad y Enrutamiento Inteligente

**Sincronización Dinámica de Perfiles en Vivo (Multi-Nodo)**
- `useRedStore.ts`: Al editar nickname, bio o teléfono en la Bóveda de Identidad (`setProfile`), se emite un paquete estructurado `msg_type: 'profile_update'` por broadcast mesh (`ffffffff...`) y se envía directamente a todos los contactos registrados.
- `meshRouter.ts`: Incluye `bio` y `phone_number` dentro de las balizas `IDENTITY_ANNOUNCE` y sincroniza reactivamente la caché de contactos de `localStorage` al recibir anuncios y respuestas de identidad.
- `Sidebar.tsx` & `ChatWindow.tsx`: Función `resolvePeerName` consulta el registro de pares en caliente de `meshRouter` si el contacto tiene un nombre genérico o desactualizado.
- `ContactProfileModal.tsx`: Visualización de la Biografía/Estado y el Teléfono de Emergencia sincronizados.

**Optimizaciones de Compilación y Rendimiento**
- `gradle.properties`: Asignación de 4GB de heap a la JVM de Gradle (`-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseG1GC`) para compilación estable con modelos neuronales ONNX y pesos WASM.
- `build.gradle`: `aaptOptions.noCompress` optimizado para `onnx`, `wasm`, `gguf`, `bin`.
- `PqcCryptoEngine.ts`: Criptografía híbrida post-cuántica ML-KEM-768 + ECDH P-256 integrada y validada en tiempo real.

---

## [51.1.0-profile-sync] - 2026-08-21

### Sincronización Dinámica de Perfiles & Difusión de Identidad Multi-Nodo
- Difusión estructurada de identidad con `msg_type: 'profile_update'`.
- Actualización reactiva de `contacts`, `conversations` y `meshRouter.peers`.
- Notificaciones tácticas en pantalla al actualizar perfil.

---

## [51.0.0-smart-mesh] - 2026-08-21

### Smart Dynamic Mesh & Enrutamiento Autónomo Multi-Transporte LQS
- Fast-Path Unicast vía WebRTC DataChannel (54 Mbps, <30ms) con cancelación reactiva de emisiones redundantes por BLE/LoRa.
- Conmutación por fallo y multi-hop flood filtrado por calidad de enlace LQS (`LQS >= 20%`).
- Auto-asociación proactiva de enlaces BLE en caliente (warm links) con balizas `RED-`.
- Cola de almacenamiento DTN clasificada por 5 niveles de prioridad QoS.

---

## [40.0.0-resilient-mesh] - 2026-08-20

### Malla Resiliente — Persistencia ACID + Blindaje Antikill Android 16

**Correcciones críticas de persistencia (Causa Raíz)**
- `core/src/storage/mod.rs`: `store()` y `delete()` ahora llaman `tree.flush()` síncronamente después de cada escritura, garantizando durabilidad ACID. El `db.flush()` (fsync global) fue eliminado del hot path de mensajes (evita ANR en mallas BLE de alto tráfico) y se expuso como `flush_db()` para uso en checkpoints/cierre del nodo.
- `client/app/src/lib/api.ts`: Implementado merge bidireccional real en `getConversations()`, `getContacts()` y `getMessages()`. Los registros P2P en localStorage y los de Rust Sled se mezclan sin pérdida (clave: primeros 16 chars del peer/identity hash). Las escrituras a localStorage ahora son condicionales — solo cuando el merge produce cambios.
- `client/app/src/store/useRedStore.ts`: Restauración instantánea de chats/contactos desde localStorage al inicio de `fetchData()` ANTES de esperar al backend Rust. Persistencia inmediata de contactos P2P en localStorage ANTES de la llamada async a Rust.

**Blindaje Android (HyperOS / Android 16)**
- `AndroidManifest.xml`: Agregado `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `FOREGROUND_SERVICE_SPECIAL_USE`, `USE_EXACT_ALARM` y `SCHEDULE_EXACT_ALARM`. `foregroundServiceType` expandido a `connectedDevice|dataSync|specialUse`.
- `RedNodeService.java`: Canal de notificación renombrado a `RedMeshNode_v40` (fuerza recreación con `IMPORTANCE_HIGH` en actualizaciones). `startForeground()` en Android 14+ incluye `FOREGROUND_SERVICE_TYPE_SPECIAL_USE`.
- `MainActivity.java`: `requestBatteryExemption()` movido de `onCreate()` a `onResume()` (evita fallo silencioso en HyperOS antes de que la ventana esté lista). Agregado `requestExactAlarmPermission()` — corrige `AlarmManager: lost permission to set exact alarms` en Lenovo Tablet.

**Correcciones de seguridad Rust (JNI boundary)**
- `red_mobile/src/ai_copilot.rs`: Eliminados `unwrap()` en operaciones de tensor Candle (líneas críticas en el inference loop). Reemplazados con `match` + `break` — un modelo GGUF corrupto u OOM ya no causa crash del proceso completo.

**Versión Cargo.toml sincronizada a 40.0.0** (estaba en 38.0.0).


Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [39.0.0-sovereign-ai] - 2026-08-20

### Motor IA Soberano Generativo — Corrección Integral de Causa Raíz

**Correcciones en `localAiEngine.ts` & `localAiWorker.ts`**
- `getGenerator()` actualizado a repositorios ONNX validados en HuggingFace: `onnx-community/Qwen2.5-0.5B-Instruct` y `onnx-community/SmolLM2-360M-Instruct` (reemplazando los IDs deprecados `Xenova/Qwen1.5-0.5B-Chat` y `Xenova/SmolLM-360M-Instruct`).
- Cadena de fallbacks extendida: `LaMini-GPT-124M` → `distilgpt2` para compatibilidad máxima sin conexión.
- Saneamiento automático de `cleanQuery`: el contexto de malla inyectado por el frontend se extrae del prompt antes de la búsqueda vectorial RAG.
- Recorte del eco de prompt en la salida del LLM: `generated_text.slice(inputPrompt.length)`.
- Detección de intenciones conversacionales (`isGreeting`, `isSystemQuery`) con respuestas dinámicas y verazes.
- Motor nativo ARM64 (`:7333`) sólo invocado cuando el modelo GGUF está realmente descargado en disco.

**Correcciones en `AICopilotModal.tsx`**
- Desacoplamiento del contexto de malla: se pasa como `contextStr` separado, no fusionado al prompt.
- `modelTag` del mensaje IA refleja el motor real: `Motor RAG MiniLM (100% Offline)` o el modelo GGUF activo.
- Mensaje inicial actualizado con instrucción sobre la pestaña `[Modelos]`.

**Nuevo módulo: `indexedMediaVault.ts`**
- Bóveda IndexedDB de alta capacidad para medios pesados.
- Prevención de `QuotaExceededError` en `localStorage` de Android (límite 5 MB).
- Punteros virtuales `red_vault://${msgId}` para referenciación liviana en el store.

**Catálogo GGUF (`modelManager.ts`)**
- Modelos compactos ARM64: `SmolLM2-360M-Instruct Q4` (230 MB) y `Qwen2.5-0.5B-Instruct Q4` (390 MB).

**Build & Deploy**
- Eliminación de `LaMini-Flan-T5-77M` del árbol de assets públicos.
- APK de release en limpio: 205 MB (reducción de ~99 MB respecto a v38.0.0).
- Verificado en Motorola Moto G22 (Android 12), Lenovo TB305XU (Android 15) y Xiaomi 24116RACCG Note 14 (Android 16).

---

## [38.0.0-tactical-master] - 2026-08-19


### Añadido y Perfeccionado — RED v38.0.0 Sovereign Mesh Master Release

**Integración Web3 & Bóveda MetaMask (`Web3BridgeEngine.ts`, `Web3VaultModal.tsx`)**
- **Conectividad EIP-1193 Nativa:** Detección de billeteras inyectadas (MetaMask, Brave, Coinbase, Rabby) con reconexión reactiva y gestión de eventos (`accountsChanged`, `chainChanged`, `disconnect`).
- **Soporte Multi-Red EVM:** Conmutación y auto-configuración de Ethereum Mainnet, Polygon PoS, Arbitrum One, Base y Sepolia Testnet.
- **Atestación Criptográfica EIP-712 / DID Binding:** Vinculación bidireccional entre la dirección Ethereum y el Identificador Descentralizado soberano de RED (`did:red:<identity_hash>`) mediante firma digital de mensaje verificable sin comisiones de gas.
- **Balances en Tiempo Real:** Lector directo JSON-RPC de saldos nativos y tokens $RED on-chain.

**Escudo Global & Matriz de Ciberdefensa DEFCON (`GlobalShieldEngine.ts`, `GlobalShieldPanel.tsx`)**
- **Gobernanza DEFCON Dinámica (Niveles 4 a 1):** Conmutación táctica entre DEFCON 4 (Estándar), DEFCON 3 (Elevado), DEFCON 2 (Alta Seguridad / Domain Fronting SNI forzado) y DEFCON 1 (Apagón Táctico / DoH DNS Tunneling forzado + Bloqueo Biométrico inmediato).
- **Escalamiento PoW Anti-Sybil en Malla:** Ajuste dinámico de la dificultad PoW en `MeshProofOfWork.ts` (de 2 a 5 bits) según el nivel de amenaza activo.
- **HUD Perimetral en Vivo:** Monitorización de ataques Sybil repelidos, paquetes ofuscados, saltos Onion y autonomía de batería mesh.
- **Prueba Activa de Enrutamiento:** Disparador en tiempo real para verificar el camuflaje de tráfico a través de SNI Spoofing y DoH DNS Tunneling.

**Tokenomics & Libro Mayor Descentralizado (`TokenomicsEngine.ts`)**
- **Recompensas Proof-of-Relay:** Incentivos económicos automáticos por el reenvío de paquetes en la malla P2P y almacenamiento DTN.
- **Staking PoS:** Rendimiento estimado del 14.8% APY con penalizaciones de slashing por inactividad.
- **Vales Criptográficos Ed25519 Offline:** Emisión y canje de vales con firma digital, códigos QR (`RED_PAY:<id>:<monto>:<firma>`) y mitigación estricta de doble gasto.

---

## [36.0.0-tactical-master] - 2026-08-19

### Añadido y Perfeccionado — RED v36.0.0 Sovereign Competitive Superiority Master Release

**Mensajería Reactiva & Core Chat de Siguiente Generación (`MessageBubble.tsx`, `ChatInput.tsx`, `useRedStore.ts`)**
- **Reacciones E2E en Tiempo Real:** Selector flotante de reacciones con persistencia y sincronización bidireccional mediante paquetes de malla (`msg_type: 'reaction'`), agregando badges de conteo táctiles que alternan la reacción del usuario con un solo toque.
- **Citas Táctiles & Swipe-to-Reply:** Gesto de deslizamiento hacia la derecha en cualquier burbuja con animación elástica e indicador visual para citar mensajes de inmediato. Renderizado de caja de cita citada con salto táctil automático (`scrollIntoView` suave + resaltado flash) al mensaje original.
- **Edición y Eliminación para Todos:** Soporte de edición en vivo (`msg_type: 'message_edit'`) con marca `(editado)` y eliminación para todos (`msg_type: 'message_delete'`) redactando el contenido a nivel de protocolo y almacenamiento.
- **Confirmaciones de Lectura Criptográficas Reales:** Ciclo completo de confirmación de entrega `pending` (🕒) $\rightarrow$ `sent` (✓) $\rightarrow$ `delivered` (✓✓ verde) $\rightarrow$ `read` (✓✓ cian) transmitido punto a punto mediante paquetes `read_receipt`.
- **Estados Efímeros de Escritura y Grabación de Voz:** Transmisión en tiempo real del estado `✍️ Escribiendo...` y `🎙️ Grabando audio...` en la cabecera de chat con temporizador de reset automático a los 3.5 segundos.

**Visor Multimedia In-App a Pantalla Completa (`MediaGalleryViewer.tsx`)**
- **Galería Táctica con Zoom Multitáctil:** Visor flotante para imágenes y videos con zoom multitáctil (`pinch-to-zoom`), doble toque para ampliar, navegación lateral táctil / por teclado y swipe vertical para cerrar.
- **Guardado y Compartido Nativo:** Integración directa con `@capacitor/filesystem` para guardar archivos en el directorio de Documentos del dispositivo y `@capacitor/share` para invocar el diálogo nativo de Android.

**Videollamadas con PIP In-App & Auto-Reconexión ICE (`CallScreen.tsx`, `FloatingCallPIP.tsx`)**
- **Ventana Picture-in-Picture (PIP) Flotante:** Modo PIP arrastrable en pantalla que permite continuar chateando o navegando por la aplicación sin interrumpir la llamada activa.
- **Auto-Reconexión ICE Restart:** Detección de cambios de red o caídas de ruta con activación automática de `pc.restartIce()` sin colgar la llamada.

**Bóveda Biometría, Respaldos Cifrados & Perfil de Contacto (`BiometricLockEngine.ts`, `BackupRestoreEngine.ts`, `ContactProfileModal.tsx`)**
- **Bloqueo Biométrico Nativo & PIN de Seguridad:** Integración de `@aparajita/capacitor-biometric-auth` con temporizador de inactividad configurable (`inmediato`, `1m`, `5m`, `15m`) y pantalla de desbloqueo táctica `BiometricShieldOverlay.tsx`.
- **Copia de Seguridad Cifrada AES-256-GCM:** Exportación e importación de la base de datos completa y claves criptográficas protegidas con clave derivada mediante PBKDF2 (100,000 iteraciones SHA-256).
- **Panel de Información y Medios Compartidos:** Modal de contacto con pestañas organizadas para Fotos/Videos, Documentos, Audios y Enlaces/Coordenadas.

---

## [35.0.0-tactical-master] - 2026-08-19

### Añadido, Corregido y Optimizado — RED v35.0.0 Sovereign Tactical Master Release

**Motor Acústico Singleton & Corrección Definitiva del Timbre (`CallRingtoneEngine.ts` & `IncomingCallBanner.tsx`)**
- **Síntesis Acústica Multitono:** Generación en tiempo real de 4 timbres de llamada tácticos (*Táctico Alfa*, *Pulso Radar*, *Sintetizador Suave*, *Silencioso*) mediante Web Audio API sin dependencias externas de archivos.
- **Cancelación Atómica Garantizada:** El método `CallRingtoneEngine.stop()` asegura el apagado incondicional de osciladores, ganancias, timers de intervalos y patrones hápticos al contestar, rechazar o montar la pantalla de llamada (`CallScreen.tsx`), resolviendo el bug de timbre persistente.

**Videollamadas P2P WebRTC Resilientes (`CallScreen.tsx`)**
- **Corrección Crítica de Timestamps:** Normalización de marcas de tiempo en la cola de señales WebRTC (`itemTs = item.timestamp > 1e11 ? item.timestamp : item.timestamp * 1000`), evitando el descarte erróneo del 100% de las respuestas SDP (`answer`) y candidatos ICE remotos por disparidad de unidades (segundos vs milisegundos).
- **Matching Insensible a Mayúsculas/Minúsculas en DIDs:** Normalización de identificadores (`toLowerCase()`) en el procesamiento de colas de señalización P2P.
- **Transceivers Bidireccionales Explícitos:** Inclusión de `pc.addTransceiver('audio', { direction: 'sendrecv' })` y `pc.addTransceiver('video', { direction: 'sendrecv' })` para garantizar la negociación bidireccional de flujos de video y audio en hardware Android heterogéneo.
- **Captura de Cámara Adaptativa:** Restricciones de resolución configurables (`720p HD`, `480p SD`, `360p Eco`) con soporte de fallbacks resilientes multinivel para evitar fallos de hardware en sensores de dispositivos móviles.

**Centro Maestro de Ajustes & Configuración Soberana (`SettingsModal.tsx` & `settingsManager.ts`)**
- **8 Paneles Tácticos Especializados:** Navegación por pestañas para *Apariencia & Temas*, *Llamadas & Video*, *Sonido & Tonos*, *Almacenamiento & Caché*, *Privacidad & Biometría*, *Malla & Batería*, *Identidad & Claves* y *Actualizador OTA*.
- **Gestión Real de Almacenamiento:** Cálculo en vivo del espacio ocupado por mensajes, conversaciones y medios temporales en la bóveda local (`localStorage`), con herramienta de purga de caché de medios sin alterar contactos ni chats.
- **Configuración WebRTC Personalizable:** Servidores STUN personalizables, supresión de eco y control de altavoz predeterminado en videollamadas.

---

## [33.0.0-tactical-master] - 2026-08-18

### Añadido y Refactorizado — RED v33.0.0 Sovereign Tactical Master Release

**Reproductor Táctico de Audio Interactivo (`VoiceMessage.tsx` & `ChatInput.tsx`)**
- **Waveform Scrubber Interactivo:** Barra de forma de onda interactiva con soporte de arrastre y seeking táctil en tiempo real mediante `pointer events` y cálculo dinámico de coordenadas.
- **Selector Dinámico de Velocidad:** Conmutación fluida entre velocidades de reproducción (`1.0x` $\rightarrow$ `1.5x` $\rightarrow$ `2.0x`) con ajuste en vivo en el motor de audio HTML5.
- **Temporizador Dual Sincronizado:** Visualización precisa del tiempo transcurrido versus la duración total del mensaje de voz.
- **Grabador Táctico en Vivo:** Barra de grabación con visualizador en vivo, contador de tiempo de grabación y botones tácticos de cancelación y confirmación.

**Soporte Completo de Documentos y Archivos Genéricos (`ChatWindow.tsx`, `ChatInput.tsx` & `MessageBubble.tsx`)**
- **Selector Universal de Archivos:** Soporte nativo para PDFs, ZIPs, APKs, GPXs, DOCs y archivos binarios de hasta 25MB codificados en DataURL con preservación de nombre, tamaño y tipo MIME.
- **Tarjetas Tácticas de Documento (`DocumentCard`):** Renderizado en burbujas con icono representativo según extensión, tamaño formateado (KB/MB) y descarga directa con nombre original.

**Búsqueda Interna en Conversaciones y Mensajes Fijados (`ChatWindow.tsx` & `MessageBubble.tsx`)**
- **Buscador Táctico Overlay:** Barra integrada en el encabezado del chat con navegación hacia adelante y atrás (`▲`/`▼`), contador de coincidencias en vivo (`1/N`) y auto-scroll con resaltado ámbar en la burbuja encontrada (`data-msgid`).
- **Mensajes Fijados en Canales:** Capacidad de fijar mensajes en cualquier canal/chat, visualización de banner persistente en la cabecera del canal y salto suave al mensaje fijado.

**Tarjetas Topográficas GPS & Radar QR Unificado (`MessageBubble.tsx` & `RadarWindow.tsx`)**
- **Tarjetas Tácticas GPS:** Detección de coordenadas GPS en tiempo real con botones interactivos de copia rápida y apertura en el mapa topográfico Leaflet.
- **Visor Táctico de Escáner QR:** Interfaz unificada con visor láser, control estricto de permisos nativos en Android y eliminación de retornos redundantes.

**Audio WebRTC & Altavoz Adaptativo (`CallScreen.tsx`)**
- Enrutamiento dinámico de altavoz mediante `setSinkId` y control de ganancia de audio en el reproductor remoto persistente.

---

## [32.0.0-sovereign-master] - 2026-08-17

### Añadido y Refactorizado — RED v32.0.0 Sovereign Global P2P Master Release

**WebRTC W3C Perfect Negotiation & Dual ICE Signaling (`wifiDirectTransport.ts`)**
- **Estándar W3C de Negociación Perfecta:** Resolución determinística de colisiones (*Glare*) mediante ordenación lexicográfica de identificadores (`isPolite = myId < peerId`). Rollback seguro en nodos educados sin interrupción de DataChannels.
- **Señalización Dual (WebSocket + MQTT Blind Relay):** Ofertas SDP, respuestas y candidatos ICE propagados simultáneamente a través de WebSocket y tópicos MQTT (`red/mesh/sig/{peerId}`), garantizando conectividad directa incluso detrás de NAT simétricos o proxies celulares.
- **Calibración de STUN Servers:** Retiro de servicios obsoletos e integración de endpoints STUN de alta disponibilidad (Google, Cloudflare, NextCloud, Matrix).

**Deduplicación Multi-Criterio & Normalización Temporal UTC (`useRedStore.ts` & `MessageBubble.tsx`)**
- **Normalización UTC a Segundos:** Conversión estricta de marcas de tiempo de milisegundos a segundos UTC para eliminar desfases en encabezados diarios y burbujas de chat.
- **Deduplicación Tri-Capa:** Filtro por ID determinístico, Nonce y coincidencia semántica `(remitente + contenido)` en ventana móvil de 30 segundos.

**Calibración y Optimización de Radio BLE para Android OS (`bluetoothTransport.ts` & `localTransport.ts`)**
- **Inmunidad al Throttling de Android (5 scans / 30s):** Ciclo de trabajo duty-cycle calibrado a 14s (4s activo / 10s reposo) y mutex `isScanning` para evitar suspensiones de hardware por parte de `BtGatt.ScanHelper`.
- **Perfiles de Energía Optimizados:** Gestión adaptativa de batería en modo `high` (8s), `balanced` (14s) y `eco` (30s).

---

## [31.1.0-hybrid-mesh] - 2026-08-17

### Añadido y Refactorizado — RED v31.1.0 Hybrid 4G/5G, Persistent DTN & Autonomous Mesh Gateway Release

**Observador de Estado de Red & Ciclo de Vida (`networkWatcher.ts`)**
- **Detección Unificada Multi-Plataforma:** Monitoriza en tiempo real transiciones entre interfaces (WiFi doméstico $\leftrightarrow$ Datos Móviles 4G/5G $\leftrightarrow$ Offline) integrando eventos del navegador, `Network Information API` y el ciclo de vida de `@capacitor/app`.
- **Sondeo WAN Activo:** Verificación activa de salida real a internet mediante endpoints ultraligeros con timeout de 3.5s para certificar conectividad global y activar el rol de Pasarela.

**WebRTC DataChannels con `iceRestart` y Matriz de Señalización Redundante (`wifiDirectTransport.ts`)**
- **Soporte de `iceRestart` en Caliente:** Al conmutar de red (ej. de WiFi a 4G/5G), invoca automáticamente `pc.restartIce()` y renegocia las ofertas SDP sobre las conexiones existentes sin pérdida de sesión.
- **Matriz de Señalización con Rotación y Fallback:** Pool dinámico de endpoints de señalización y túnel *Blind WebSocket Relay* cifrado de respaldo.
- **Pool STUN de Alta Disponibilidad:** Servidores STUN distribuidos de Google, Cloudflare, Matrix y Mozilla.

**Cola Persistente DTN (Store-and-Forward) & ACKs Criptográficos (`dtnStorage.ts` & `meshRouter.ts`)**
- **Almacenamiento en Disco Tolerante a Reinicios:** Almacén persistente `red_dtn_pending_queue_v1` con retención soberana de hasta 7 días y reintentos con retroceso exponencial (*exponential backoff*).
- **Protocolo `DELIVERY_ACK`:** Emisión automática de confirmaciones de entrega firmadas por el nodo de destino, purgando el paquete de la cola DTN y actualizando el estado a `Delivered` (doble check) en la interfaz de usuario.

**Protocolo de Pasarela Autónoma (Autonomous Mesh-to-Internet Gateway / Edge Bridge)**
- **Anuncio de Capacidad de Pasarela:** Los nodos con salida a internet anuncian `is_gateway: true` y `has_internet: true` en su trama de saludo `IDENTITY_ANNOUNCE`.
- **Enrutamiento Asistido Multi-Salto:** Los nodos en clústeres locales aislados (vía BLE o WiFi Direct) delegan el uplink a la pasarela vecina más cercana para transmitir mensajes hacia la red global (WAN Relay / WebRTC), uniendo clústeres físicos distantes a nivel mundial.

**Despliegue y Verificación en Banco Real Multi-Dispositivo**
- **Despliegue Limpio y Verificado:** Desinstalación de versiones anteriores e instalación limpia en **Moto G22 (`ZT322B386P`)** y **Redmi Note 14 (`6dife65ls485fega`)**.
- **Monitorización Logcat Activa:** Validación de mDNS, gossipsub, libp2p y enlace de mensajes en vivo sobre interfaces celulares y WiFi concurrentes.

---

## [31.0.0-sovereign-master] - 2026-08-16

### Añadido y Refactorizado — RED v31.0.0 Real-Time SSE, DSP Vocoder, PQC & Hardware Resilience Release

**Motor de Voz Táctica de Ultra-Bajo Ancho de Banda (`LowBitrateVocoder.ts`)**
- **Compresión Extrema (-97.9%):** Remuestreo en tiempo real a 8000 Hz 16-bit PCM, filtrado vocal pasabanda, pre-énfasis y cuantización adaptativa IMA ADPCM de 4 bits con empaquetado de nibbles.
- **Ráfagas de Voz para LoRa y SoundMesh:** Reduce 3 segundos de audio crudo (562.5 KB) a ~11 KB de streaming continuo y <800 Bytes por ráfaga táctica, permitiendo enviar notas de voz por enlaces LoRaWAN (0.3–5.5 kbps) y Módem Acústico Ultrasónico (18.5–20.5 kHz).
- **Integración:** Conectado directamente en `P2PWalkieTalkieModal.tsx` con conmutador táctico y sintetizador directo de `AudioBuffer` mediante Web Audio API.

**Motor de Prueba de Trabajo Criptográfica Anti-Spam (`MeshProofOfWork.ts`)**
- **Blindaje Anti-DDoS sin Servidores Centrales:** Algoritmo Hashcash basado en SHA-256 con dificultad dinámica, sellado temporal y ventana de tolerancia anti-repetición (180s).
- **Integración en Despacho y Recepción:** Minado automático en `sendMessage` y verificación en `addIncomingMessage` dentro de `useRedStore.ts`.

**Gobernador Cinemático Adaptativo de Batería (`KineticDutyGovernor.ts`)**
- **Análisis de Aceleración RMS en Tiempo Real:** Detecta estados estáticos vs en movimiento mediante telemetría del acelerómetro y batería de hardware.
- **Perfiles de Malla:** Conmutación automática entre `SURVIVAL_SENTRY` (12s, ~48h de autonomía), `BALANCED_PATROL` (4s), `HIGH_PERFORMANCE` (1.5s) y `SHAKE_BOOST` (800ms disparado por sacudida física). Integrado en `EcoMeshPanel.tsx`.

**Verificador de Integridad Merkle & Self-Healing Local (`StateIntegrityEngine.ts`)**
- **Resiliencia ante Cortes Abruptos de Energía:** Generación de árbol Merkle SHA-256 sobre los almacenes locales críticos y autorreparación automática con cuarentena de registros corruptos en el arranque de la app.

**Criptografía Post-Cuántica (PQC) & Híbrida (`PqcCryptoEngine.ts`)**
- **ML-KEM-768 (FIPS 203):** Encapsulamiento de claves basado en retículos resistente a computación cuántica combinado con ECDH P-256 mediante HKDF-SHA256.

**Control de Hardware Nativo: Flash LED Morse SOS & Antorcha (`RedNodePlugin.java` & `SurvivalBeaconModal.tsx`)**
- **API `CameraManager` Nativa:** `setTorchMode` para control del Flash LED de la cámara trasera con pulsos Morse militares SOS (`... --- ...`) en hilo nativo independiente.

**Compilación y Despliegue Limpio Multi-Dispositivo**
- **JDK 21 JBR Oficial:** Configuración de OpenJDK 21 y Gradle para compatibilidad total con Android SDK 35.
- **Despliegue Verificado:** Desinstalación e instalación limpia exitosa en **Moto G22 (`ZT322B386P`)** y **Tablet Lenovo Tab M9 (`HA2CHKZ2`)**.

## [30.0.0-p2p-master] - 2026-08-07

### Añadido y Corregido — RED v30.0.0 Sovereign Master & AI Resiliencia Release

**Motor de IA Neuronal Local Off-Grid ONNX WASM (`localAiEngine.ts` & `onnxruntime-web`)**
- **Dictamen Neuronal Zero-Trust:** Integración del botón `🤖 Evaluar Resiliencia Táctica con IA (ONNX WASM)` en `SecurityReportModal.tsx` para generar evaluaciones de resiliencia en español utilizando el modelo `LaMini-Flan-T5` 100% en memoria.
- **Auditoría Criptográfica e Integridad en Tiempo Real:** Evaluación neuronal integrada en `CryptoPanel.tsx`, `NetworkPanel.tsx` y `BlockchainExplorer.tsx`.

**Seguridad Táctica Zero-Trust & Protección a Nivel de Sistema Operativo (`SecurityPanel.tsx`)**
- **Bloqueo Físico de Capturas (`FLAG_SECURE` OS):** Integración nativa de `PrivacyScreen` en Android impidiendo capturas de pantalla, grabaciones de pantalla y capturas en el selector de aplicaciones recientes.
- **Auto-Diagnóstico de Nodo Real (`SystemHealthModal.tsx`):** Benchmarks de latencia HTTP (`/api/status`), streaming SSE (`/api/events`), almacenamiento encriptado y generación de llaves `ECDSA P-256` en Web Crypto API.
- **Purga Anti-Forense y Burner Chats:** Borrado automático del directorio de caché nativo (`Directory.Cache`) y bypass de persistencia en disco SQLite retener mensajes únicamente en memoria RAM.

**Rediseño de Navegación & Botón Prominente `⚡ MÓDULOS` (`Sidebar.tsx`)**
- **Acceso Prominente Módulos:** Inclusión de la tarjeta `⚡ MÓDULOS` como primera opción destacada en la franja de Quick Actions y botón adaptativo en la barra superior navegable.
- **Stream de Telemetría SSE en Vivo (`api.rs` & `NodeLogsModal.tsx`):** Implementación de heartbeat de 3 segundos en `/api/events` para mantener viva la consola de logs del nodo Rust en tiempo real.

---

## [24.0.0-p2p-master] - 2026-08-05

### Añadido y Corregido — RED v24.0.0 Native P2P & Navigation Master Release

**Puente Nativo GATT Server & Inyección Directa (`RedNodeService.java` & `bluetoothTransport.ts`)**
- **Fix GATT Write UUID Swap:** Corrección de la validación UUID en `onCharacteristicWriteRequest` para aceptar escrituras en características `RED_BLE_RX_CHAR` y `RED_BLE_TX_CHAR`.
- **Inyección Nativa Directa a Rust:** Implementación de `injectNativeMeshPayload` en Java para realizar un POST directo de tramas mesh a `http://127.0.0.1:7333/api/mesh/receive`.
- **Listener JS Nativo:** Suscripción al evento `bleMessageReceived` de Capacitor en `bluetoothTransport.ts` para transmitir tramas físicas de radio al `MeshRouter`.

**Auto-Intercambio Recíproco de Claves Públicas (`RadarWindow.tsx` & `useRedStore.ts`)**
- **Extracción Criptográfica QR:** Corrección del escáner QR en `RadarWindow.tsx` para extraer `identity_hash` y `public_key` del formato `did:red:<hash>:<public_key>`.
- **Payload `sender_pk` Recíproco:** Inclusión automática de `sender_pk` en `contact_request` y `contact_response`, habilitando el cifrado E2E Noise XK inmediato entre pares.
- **Refresco de Fondo en Sidebar:** Actualización automática de la lista de conversaciones y el contador de no leídos (`fetchData()`) al recibir mensajes cuando la ventana del chat no está enfocada.

**Navegación SPA & Botón Retroceso Android (`useRedStore.ts` & `page.tsx`)**
- **Fix Bucle de Navegación `goBack()`:** Restablecimiento a `currentScreen: 'sidebar'` y `activeConversationId: null` para permitir salir limpiamente del chat mediante la flecha superior o la tecla física de retroceso de Android.

---

## [24.1.0] - 2026-08-02

### Añadido y Corregido — RED v24.1 Real-Data & WAN P2P Release

**Auto-Detección Atmosférica Real y Geolocalización GPS**
- **Lectura Automática de Sensores (`WeatherAlertPanel.tsx`):** Obtención de latitud/longitud vía `@capacitor/geolocation` + `navigator.geolocation` y consulta en tiempo real a Open-Meteo REST API (presión barométrica hPa, temperatura °C, humedad % y código WMO). Auto-llenado al abrir la vista y botón manual de re-escaneo.
- **Protección contra Excepciones JS:** Desempaquetado seguro de objetos JSON devueltos por `/api/weather/reports` en `api.ts` y guardas `Array.isArray()` estrictas en React.

**Comunicaciones P2P de Larga Distancia (WAN / 4G / 5G / Internet)**
- **Endpoints de Conexión de Red (`POST /api/network/connect` & `GET /api/network/ip`):** Registro de handlers en `api.rs` para marcación P2P directa mediante libp2p `Multiaddr` (`/dns4/`, `/ip4/`, `/p2p-circuit/`).
- **Integración Kademlia DHT & Circuit Relay v2:** Conexión con nodos semilla mundiales (`BOOTSTRAP_NODES`) para descubrimiento P2P e interconexión transparente a través de CGNAT (redes móviles 4G/5G) y routers domésticos.
- **Tarjeta UI Larga Distancia (`NetworkPanel.tsx`):** Formato y asistencia visual para conexiones por dominio, IP pública o relay.

**Estabilidad Nativa y SSE Mesh Bridge**
- **Hidratación SSR (`page.tsx`):** Sustitución de imports síncronos por `dynamic(() => import(...), { ssr: false })` + `<ErrorBoundary>` táctico de 2 niveles.
- **SSE Outbound Activo (`/api/network/outbound`):** Difusión en tiempo real de paquetes salientes cifrados a través del canal `msg_tx` hacia el `MeshRouter` nativo.

---

## [19.0.0] - 2026-08-01

### Añadido — RED v19.0 Zenith Guardian Release

**Sistema Alerta AMBER-RED P2P (Búsqueda Descentralizada de Personas)**
- **Red Broadcast AMBER Descentralizada:** Difusión masiva de alertas de personas desaparecidas sobre la red P2P vía topic GossipSub `amber-red-v1` y notificación push SSE instantánea.
- **Banner Flotante de Alta Prioridad (`AmberAlertBanner.tsx`):** Componente flotante de máxima prioridad naranja animado que notifica en tiempo real a todos los nodos conectados.
- **Panel de Administración para Autoridades (`AmberAdminPanel.tsx`):** Emisión de alertas con fotografía base64, coordenadas GPS, tiempo de expiración (TTL) y firmas Ed25519.
- **Reporte de Avistamientos Geolocalizados:** Permitir a cualquier usuario reportar avistamientos directamente a las autoridades.

**Guardian IA (Moderación Off-Grid & Híbrida)**
- **Motor Off-Grid Nivel 0 en Rust (`guardian.rs`):** Evaluación heurística local en `<1ms` sin internet ni dependencias externas en el nodo emisor antes del cifrado E2E.
- **Ventana de Contexto Deslizante (Anti-Grooming):** Evaluación acumulativa de los últimos 5 mensajes de la conversación para detectar patrones de acoso o grooming progresivos.
- **Auditoría Cloud Híbrida (Groq LlamaGuard 4 12B):** Clasificación semántica remota opcional con la API de Groq usando formato de conversación role-based estandarizado (`meta-llama/llama-guard-4-12b`).
- **Panel de Transparencia (`GuardianStatusPanel.tsx`):** Monitoreo en vivo de métricas (analizados/bloqueados/cache hits) y formulario de reporte manual de contenido.

---

## [16.1.0] - 2026-07-21

### Añadido — Interconexión P2P Web ↔ Mobile & Renegociación WebCrypto ECDH

**Interconexión Web-Mobile & Señalización P2P**
- **Puente P2P Web ↔ Mobile (WebRTC DataChannel):** Comunicación cifrada punto a punto directa entre cualquier navegador web (`https://darckrovert.github.io/RED/`) y la App Móvil Android sin requerir teléfono celular ni servidores centrales.
- **Cluster de Señalización Ampliado (`signaling/server.js`):** Expansión de capacidad a 50 pares P2P simultáneos por sala para mallas descentralizadas.
- **Cifrado ECDH WebCrypto en Tiempo Real:** Renegociación dinámica de claves P-256 en tiempo real en la Web SPA mediante la API criptográfica nativa del navegador.
- **Persistencia de Identidad Offline:** Carga automática de DIDs personalizados (`red_identity_hash`, `red_displayName`) desde el almacenamiento local sin sobrescribir en modo sin conexión.
- **Navegación Unificada SPA:** Corrección de botones de retorno e itinerario directo a `/RED/chat.html` desde todas las vistas avanzadas (`nodemap`, `settings`, `crypto`, `contacts`).

---

## [16.0.0] - 2026-07-20

### Añadido — RED v16.0 Zenith Master Architecture Release

**Comunicaciones P2P & Multimedia**
- **Insignias Dinámicas de Transporte Mesh:** Identificación visual clara (🌐 WAN, 📶 mDNS, 📡 BLE) en burbujas de mensaje según la ruta P2P de entrega.
- **Videollamadas P2P WebRTC con STUN Fallback:** Traversal dinámico P2P en redes 4G/5G con fallback a servidor STUN.
- **Notas de Voz Nativas:** Grabación con micro-animación de forma de onda y reproductor interactivo.
- **Visor de Fotos Fullscreen:** Visor con Zoom 1.8x y botón de descarga directa.

**Administración & Búsqueda Cifrada**
- **Administrador de Grupos P2P (`GroupAdminModal`):** Adición y expulsión de integrantes en grupos cifrados.
- **Búsqueda Global en Mensajes (`GlobalSearchModal`):** Buscador profundo por palabras clave en todo el historial cifrado.
- **Bóveda de Respaldo `.redbak` (`BackupRestoreModal`):** Exportación e importación de copias de seguridad cifradas con clave.

**Diagnósticos, Seguridad Táctica & Empaquetado Nativo**
- **Auto-Diagnóstico SSE en Vivo (`SystemHealthModal`):** Prueba de canal `EventSource('/api/events')` midiendo latencia RTT real.
- **Consola de Logs Rust (`NodeLogsModal`):** Stream estilo terminal verde-neón para auditar eventos P2P en directo.
- **Simulador de Apagón Táctico (`BlackoutSimulatorModal`):** Evaluación de resiliencia mesh ante cortes totales de internet.
- **Informe de Auditoría Exportable (`SecurityReportModal`):** Generador de fichas de postura de seguridad copiables al portapapeles.
- **Empaquetado Nativo Android APK (`app-debug.apk`):** Compilación ejecutada mediante Gradle Wrapper (`BUILD SUCCESSFUL in 24s`, 98.9 MB).

---

## [7.2.0] - 2026-07-19

### Añadido — Zero-RAM Storage Engine (Sled), Paridad de Seguridad y Compilación Automatizada

**Base de Datos & Rendimiento (Fase 1)**
- **Motor de base de datos embebida Sled:** Migración completa del almacenamiento volátil en memoria (`HashMap`) a Sled transaccional persistente, cifrando individualmente registros en disco (conversaciones, mensajes, configuración, perfiles, identidades, dispositivos y grupos).

**Seguridad y Red Descentralizada (Fase 4)**
- **Bloqueo Inbound en Capa P2P:** Los mensajes provenientes de peers bloqueados son interceptados y descartados en caliente en `node.rs` en la recepción del transporte, impidiendo que lleguen a disco o UI.
- **Cola de Reintentos Offline (Delay-Tolerant Networking):** Si un peer está offline al enviar, el mensaje se almacena temporalmente de forma persistente y un loop de 15 segundos en segundo plano reintenta la transmisión cuando el peer vuelve a estar visible en la topología local.
- **Safety Numbers & UI de Criptografía:** Pantalla de perfil de chat rediseñada con huella de seguridad (Safety Number) determinista de 20 dígitos y botones nativos para verificar y bloquear contactos con actualización de estado síncrona en React.
- **Correcciones JNI y CLI:** Saneamiento de punteros y de-referenciaciones de tipos owned tras la migración a Sled para prevenir crashes en `red_mobile` (JNI Android) y CLI de escritorio (`node/src/main.rs`).

**Automatización de Despliegue (Fase 5)**
- **Pipeline Automático de APK de Producción:** Paso 5 integrado en `build_android.ps1` que compila el frontend, sincroniza Capacitor, compila Rust NDK arm64, y ejecuta el wrapper Gradle `./gradlew.bat assembleRelease` para empaquetar el APK firmado en un solo comando de consola.

---

## [16.0.0] - 2026-03-30

### Añadido — RED P2P Mesh Networking Finalization (Offline-First)

**Core P2P & Transport Layer**
- **WebRTC Nativo (Sin STUN):** Eliminación total de dependencias de servidores STUN externos. Todo el signaling WebRTC ahora ocurre 100% offline-first a través de `/local-signal` (SSE y websockets locales) o BLE.
- **NodeMap Interactivo (Real-Data):** El mapa 3D de geometría de nodos ahora representa conexiones reales extraídas del `localTransport.allPeers`. Las coordenadas se derivan determinísticamente de los hashes Ed25519 de los nodos.
- **LoRaWAN Config Bridge:** El panel de red ahora envía la configuración de baud rate y puerto serial directamente al nodo Rust mediante el nuevo endpoint `POST /api/settings/lora` para hot-reloading del bridge de radio.

**Correcciones Críticas (Auditoría Cero-Fallas)**
- **CallScreen Telemetry:** El peer ahora recibe correctamente la señal de `hangup` (colgar) para destruir el peer connection remoto. Añadidas validaciones estrictas para evitar crashes cuando `peerHash` es null.
- **Mensajería & Estado:** Implementada deduplicación de mensajes por ID en `useRedStore` para manejar reconexiones del EventSource (SSE) sin duplicar las burbujas de chat.
- **Confirmación de Lectura (Read Receipts):** Nuevo endpoint `POST /api/conversations/{id}/read` en el nodo Rust. La interfaz ahora notifica al nodo cuando una conversación es abierta, permitiendo que el remitente vea la doble palomita azul de forma fidedigna.
- **Audio Decoding:** Corrección del parseo base64 para mensajes de voz, prefijando correctamente el tipo MIME `data:audio/ogg;base64,` antes de inyectarlo en el DOM.
- **Blockchain Explorer:** Corrección de la renderización del epoch time de las identidades registradas, y uso real de los datos del Gossip Protocol.

---

## [16.0.0] - 2026-03-21

### Añadido — Website Masterpiece Edition & Auditoría Final

**Landing Page de Nueva Generación**
- **Motor de Scroll Ultra-Fluido:** Integración corregida de GSAP + Lenis con sincronización de frames para 60FPS constantes sin stuttering.
- **Visuales 3D High-End:** Implementación isométrica de la arquitectura en CSS3 puro y tarjetas de comparación con efecto dinámico Glassmorphism.
- **Narrativa Profesional:** Revisión completa de textos (Copywriting) eliminando informalidades y adoptando un tono corporativo-militar de alta autoridad.
- **Resiliencia de Navegación:** Parche lógico en `script.js` para manejo robusto de anclas y menús móviles.

**Refinamientos de Seguridad Táctica**
- **Auditoría de Datos v16.0.0:** Sincronización de todas las métricas, versiones y características en la web y la app.
- **Bóveda de Grado Militar:** Presentación refinada de las capacidades de PIN de Pánico, Camuflaje y Secure Enclave.
- **Clean Audit:** Eliminación de archivos basura, logs redundantes y depuración del repositorio Git.

## [5.0.1] - 2026-03-20

### Añadido — Seguridad Biométrica & Keystore (Fases 34-36)

**Arquitectura de Autenticación Cero Confianza**
- **Migración a Android Keystore / iOS Secure Enclave (`SecureStoragePlugin`):** Almacenamiento criptográfico respaldado por hardware del PIN Maestro, PIN de Pánico, PIN Señuelo y Banderas de Onboarding.
- **Biometría Nativa Integrada (`BiometricAuth`):** Permite el desbloqueo rápido de la bóveda mediante Huella Dactilar o FaceID validado por el sistema operativo.
- **Onboarding Interactivo Riguroso:** Nuevo flujo de configuración donde el usuario debe crear y confirmar su PIN maestro irrecuperable.
- **Remoción de Hardcodes:** Eliminación definitiva de llaves maestras estáticas (ej. "1234", "9999"). El usuario es el único propietario del acceso.
- **SSR Hydration Anti-Crash Guard:** Prevención de "pantallas negras" en React Server Components al aislar los plugins de Capacitor hasta la completa hidratación del cliente.

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
