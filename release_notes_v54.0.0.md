# RED — Sovereign Tactical Mesh OS v54.0.0
> **Build Code:** `54000` | **Release Channel:** `stable-p2p` | **Protocol Version:** `RED/54.0-SOVEREIGN-TACTICAL-MESH`

RED v54.0.0 es la versión más completa, cohesiva y robusta hasta la fecha del sistema operativo táctico de comunicaciones en malla fuera de red (Off-Grid). Esta actualización unifica la arquitectura P2P, acelera el motor de inferencia local de IA, blinda la privacidad de la libreta de contactos y eleva toda la experiencia visual y operativa táctica.

---

## 🌟 Novedades Principales en v54.0.0

### 1. Aislamiento Estricto de Contactos & Consentimiento P2P Soberano
- **Descubrimiento Desacoplado:** Los anuncios de presencia en la malla (`IDENTITY_ANNOUNCE`, `IDENTITY_RESPONSE`) y señales de control actualizan metadatos en memoria sin inyectar contactos no autorizados en la base de datos de contactos guardados.
- **Libreta Protegida:** La libreta de contactos ahora es 100% explícita y soberana; solo se agregan contactos mediante escaneo QR, confirmación intencional o ingreso manual de DID.

### 2. Sanitización Integral de Protocolo y Filtro de Fugas de Señalización
- **Filtro Anti-Fuga en Chat:** Bloqueo de 28 tipos de paquetes de señalización interna (`read_up_to`, `delivery_ack`, `webrtc_signal`, `pqc_handshake`, etc.) para que ninguna trama de control JSON cruda se renderice accidentalmente en las burbujas o en la vista previa del último mensaje.

### 3. Motores de IA 100% Offline, Acelerados y Blindados
- **RAG Semántico con Caché Vectorial (`kbVectorCache`):** La búsqueda semántica en la base de conocimiento de supervivencia pasó de ~2.5s a **<120ms (aceleración 20x)** mediante pre-vectorización estática en memoria.
- **Clasificador Semántico Contextual de 8 Dominios:** Medicina de combate, supervivencia, telecomunicaciones, criptografía, navegación off-grid, economía soberana y protocolos de desastre.
- **Guardian IA con Distancia Hamming 64-Bit:** Detección en tiempo real de esteganografía hostil y patrones maliciosos en mensajes e imágenes entrantes de la malla.
- **Binarios Locales Empaquetados:** Modelos ONNX (`toxic-bert`, `all-MiniLM-L6-v2`) integrados físicamente en el APK sin necesidad de conexión externa.

### 4. Sinergia Funcional & Elevación Visual/UX Total
- **Traducción In-Place en Burbuja (🌐):** Opción de traducción táctica instantánea mediante IA local directamente en cada mensaje con pillbox desmontable.
- **Consulta Contextual a Copiloto (🤖):** Delegación de mensajes desde el chat al Copiloto IA con contexto preconfigurado.
- **Asistente de Redacción IA (✨):** Botón flotante en la barra de entrada para transformar mensajes a formato militar (`[SITREP]`), traducir a inglés o aplicar camuflaje leetspeak.
- **Brújula Táctica P2P (🧭):** Acceso directo desde la cabecera de chat para apuntar azimut hacia las coordenadas del par.
- **Fichas Médicas de Triaje START (`vital_sign`):** Envío directo de signos vitales (BPM, SpO2) y triage por código de color al chat activo y a la malla con cifrado E2E.
- **Dock Táctico HUD Inferior:** Barra de navegación fija con micro-animaciones, conteo en vivo de nodos en el Radar y geometría adaptativa para Android e iOS.

---

## 📦 Binarios Oficiales

| Archivo | Plataforma | Arquitectura |
| :--- | :--- | :--- |
| **`red-v54.0.0.apk`** | Android 7.0+ | ARM64 (`arm64-v8a`) |
| **`red-latest.apk`** | Android 7.0+ | ARM64 (`arm64-v8a`) |

> **Web App Companion:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
