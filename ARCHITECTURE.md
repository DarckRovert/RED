# 🛡️ RED OS v122.0.0 — Arquitectura Técnica & Especificación Planetaria

> Documento maestro de ingeniería de software y especificación arquitectónica de **RED (Red Criptográfica Off-Grid & P2P Mesh)**. Describe en detalle la topología de 7 capas, los protocolos criptográficos híbridos post-cuánticos (ML-KEM-768), la coordinación espectral LoRa TDMA con sincronización Kuramoto y PLL de reloj Lamport, el enrutamiento geoespacial Geohash DTN, la flota de repetidores solares autónomos ESP32-S3, la capa bio-cibernética conectómica, el catálogo consolidado de 65 módulos tácticos, el gemelo digital interactivo Vivarium Biocibernético 3D y el Hábitat Digital Biocibernético In-Silico.

---

## 📋 Índice General

1. [Mapa Visual 1: Topología Global del Sistema & Conexión de 7 Capas](#1-mapa-visual-1-topología-global-del-sistema--conexión-de-7-capas)
2. [Mapa Visual 2: Flujo Criptográfico Híbrido Post-Cuántico (ML-KEM-768 + Double Ratchet)](#2-mapa-visual-2-flujo-criptográfico-híbrido-post-cuántico)
3. [Mapa Visual 3: Autenticación Soberana, Biometría TEE/WebAuthn & Protocolo Anti-Coacción](#3-mapa-visual-3-autenticación-soberana-biometría-teewebauthn--bóveda-cifrada)
4. [Mapa Visual 4: Matriz de Enrutamiento Mesh Multi-Transporte & Protocolo ACKs](#4-mapa-visual-4-matriz-de-enrutamiento-mesh-multi-transporte--protocolo-acks)
5. [Mapa Visual 5: Motor de Inteligencia Artificial Offline & Guardian Security Firewall](#5-mapa-visual-5-motor-de-inteligencia-artificial-offline--guardian-security-firewall)
6. [Mapa Visual 6: Enrutamiento Geoespacial Geohash & Poda DTN (IndexedDB v2)](#6-mapa-visual-6-enrutamiento-geoespacial-geohash--poda-dtn)
7. [Mapa Visual 7: Coordinación Espectral LoRa TDMA (Clock Skew PLL & Sincronización Kuramoto)](#7-mapa-visual-7-coordinación-espectral-lora-tdma)
8. [Mapa Visual 8: Capa Bio-Cibernética, Conectoma Neuronal & Reflejo de Fibra Gigante](#8-mapa-visual-8-capa-bio-cibernética-conectoma-neuronal--reflejo-de-fibra-gigante)
9. [Mapa Visual 9: Flota de Repetidores Solares Autónomos ESP32-S3 & Hardware SX1262](#9-mapa-visual-9-flota-de-repetidores-solares-autónomos-esp32-s3)
10. [Resumen de Componentes, Crates & Firmware del Workspace](#10-resumen-de-componentes-crates--firmware-del-workspace)
11. [Mapa Visual 10: Vivarium Biocibernético 3D & Gemelo Digital Táctico](#11-mapa-visual-10-vivarium-biocibernético-3d--gemelo-digital-táctico)
12. [Mapa Visual 11: Hábitat Digital Biocibernético In-Silico & Ecosistema Multi-Cerebro A-Life](#12-mapa-visual-11-hábitat-digital-biocibernético-in-silico--ecosistema-multi-cerebro-a-life)
13. [Mapa Visual 12: Motor de Ajedrez Táctico Autónomo In-Silico & Cognición Inter-Especies](#13-mapa-visual-12-motor-de-ajedrez-táctico-autónomo-in-silico--cognición-inter-especies)
14. [Mapa Visual 13: El Paraíso Biocibernético In-Silico & Aprendizaje Autónomo Permanente](#14-mapa-visual-13-el-paraíso-biocibernético-in-silico--aprendizaje-autónomo-permanente)

---

## 1. Mapa Visual 1: Topología Global del Sistema & Conexión de 7 Capas

El ecosistema RED v122.0.0 opera bajo una arquitectura desacoplada de 7 capas horizontales con aislamiento estricto de memoria y enlaces de comunicación IPC seguros:

```mermaid
graph TD
    subgraph CAPA_1_PRESENTACION ["1. CAPA DE PRESENTACIÓN (Frontend UI / UX)"]
        UI_SPA["Next.js 16 SPA (Turbopack + React 19)"]
        CSS_TOKENS["Vanilla CSS Tactical Tokens (HUD Cyberpunk)"]
        MOD_CATALOG["65 Módulos & Pantallas Tácticas Consolidadas"]
        UI_SPA --> CSS_TOKENS
        UI_SPA --> MOD_CATALOG
    end

    subgraph CAPA_2_ESTADO ["2. CAPA DE GESTIÓN DE ESTADO (Zustand Slices)"]
        Z_AUTH["authSlice.ts (Sesión, PIN & Bóveda)"]
        Z_CHAT["chatSlice.ts (Mensajes & Hilos E2E)"]
        Z_VOICE["voiceSlice.ts (Llamadas Full-Mesh & Vocoder DSP)"]
        Z_CONTACTS["contactsSlice.ts (Directorio Canónico)"]
        Z_EMERGENCY["emergencySlice.ts (SOS, Triaje & Alertas)"]
        Z_SOCIAL["socialSlice.ts (Feed P2P & Canales Malla)"]
        DISPATCHER["messageDispatcher.ts (Enrutador Desacoplado de Eventos)"]
        
        Z_AUTH --> DISPATCHER
        Z_CHAT --> DISPATCHER
        Z_VOICE --> DISPATCHER
        Z_CONTACTS --> DISPATCHER
        Z_EMERGENCY --> DISPATCHER
        Z_SOCIAL --> DISPATCHER
    end

    subgraph CAPA_7_BIOCIBERNETICA ["7. CAPA BIO-CIBERNÉTICA & DINÁMICA DE ENJAMBRE"]
        CONNECTOME["MaleCnsConnectomeHUD (WebGL 3D Atlas Somático 124k)"]
        VIVARIUM_3D["Vivarium3DEngine.ts (Gemelo Digital Three.js WebGL 3D)"]
        HABITAT_ENGINE["BiocyberneticHabitatEngine.ts (Fick PDE 2D & Estigmergia A-Life)"]
        FICK_GRID["FickDiffusionGrid.ts (Difusión Continua 64x64 & Barreras Neumann)"]
        ENTORHINAL_GRID["EntorhinalGridFloor3D.ts (MEC Hexagonal Grid 4-Scale)"]
        CPG_HEXAPOD["HexapodBody3D.ts (6-Leg Kuramoto Tripod Kinematics)"]
        GNWT_BUS["GlobalWorkspaceConsciousnessBus (Ignición & Inhibición)"]
        KURAMOTO["RingAttractorEngine (Sincronización de Fase de Enjambre)"]
        GIANT_FIBER["GiantFiberReflexEngine (Escape EMCON Silenciado < 15ms)"]
        LAMPORT_PLL["LamportMeshClockEngine (Clock Skew PLL Tracking)"]
        DURESS_WIPE["DuressWipeEngine (Purga Anti-Forense DoD 5220.22-M)"]
        
        CONNECTOME <--> VIVARIUM_3D
        VIVARIUM_3D <--> HABITAT_ENGINE
        HABITAT_ENGINE <--> FICK_GRID
        VIVARIUM_3D <--> ENTORHINAL_GRID
        VIVARIUM_3D <--> CPG_HEXAPOD
        CONNECTOME <--> GNWT_BUS
        GNWT_BUS <--> KURAMOTO
        KURAMOTO <--> LAMPORT_PLL
        GIANT_FIBER --> DURESS_WIPE
    end

    subgraph CAPA_3_PUENTE ["3. CAPA DE PUENTE NATIVO & SERVICIOS (Android / Desktop)"]
        CAP_BRIDGE["Capacitor 8.2 Runtime"]
        JNI_PLUGIN["RedNodePlugin.java (JNI Bridge)"]
        BG_SERVICE["RedNodeService.java (Foreground Service 24/7)"]
        SEC_STORE["SecureStoragePlugin (Android KeyStore / StrongBox TEE)"]
        
        CAP_BRIDGE --> JNI_PLUGIN
        CAP_BRIDGE --> SEC_STORE
        BG_SERVICE --> JNI_PLUGIN
    end

    subgraph CAPA_4_SERVIDOR ["4. CAPA DE SERVIDOR LOCAL & SEGURIDAD ZERO-TRUST"]
        AXUM_SRV["Servidor Axum (Loopback Estricto 127.0.0.1:7333)"]
        AUTH_MW["validate_auth_async (X-API-Key / Constant-Time Eq)"]
        SSE_STREAM["Server-Sent Events (/api/events & /api/network/outbound)"]
        REST_ROUTES["Router REST (/api/messages, /contacts, /hardware/lora, etc.)"]
        
        AXUM_SRV --> AUTH_MW
        AUTH_MW --> SSE_STREAM
        AUTH_MW --> REST_ROUTES
    end

    subgraph CAPA_5_RUST_CORE ["5. NÚCLEO RUST & BASE DE DATOS CIFRADA (red_core)"]
        RUST_STORAGE["Storage Engine (Sled DB con Cifrado Simétrico AES-256)"]
        RUST_CRYPTO["Crypto Engine (ML-KEM-768 + ChaCha20-Poly1305 + Double Ratchet)"]
        RUST_IDENTITY["Identity Manager (did:red: + Hashcash Proof-of-Work)"]
        RUST_MESH["Mesh Router (Gossipsub + Onion Routing 3-Hop + Kademlia)"]
        RUST_BLOCKCHAIN["red_blockchain (PoS Validators, Merkle Trees & Mempool)"]
        
        RUST_STORAGE <--> RUST_CRYPTO
        RUST_CRYPTO <--> RUST_IDENTITY
        RUST_IDENTITY <--> RUST_MESH
        RUST_MESH <--> RUST_BLOCKCHAIN
    end

    subgraph CAPA_6_HARDWARE ["6. CAPA DE HARDWARE & TRANSMISORES DE RADIO"]
        BLE_RADIO["Bluetooth LE 5.x GATT (HCI Directo)"]
        WIFI_RADIO["WiFi Direct & WebRTC P2P DataChannels"]
        TDMA_LORA["LoRa TDMA Scheduler (SX1262 915 MHz / 868 MHz)"]
        SOLAR_FLEET["Repetidores Solares Autónomos ESP32-S3"]
        SOUND_MODEM["SoundMesh (Módem Acústico Ultrasónico 18-20 kHz)"]
        WAN_DHT["Internet WAN (Kademlia DHT + Bootstrap Peers)"]
        
        TDMA_LORA <--> SOLAR_FLEET
    end

    CAPA_1_PRESENTACION <-->|"Zustand Hooks / Dispatch"| CAPA_2_ESTADO
    CAPA_2_ESTADO <-->|"Ignición & Telemetría Sincronizada"| CAPA_7_BIOCIBERNETICA
    CAPA_2_ESTADO <-->|"HTTP REST & SSE Events"| CAPA_4_SERVIDOR
    CAPA_3_PUENTE <-->|"Carga libred_mobile.so"| CAPA_5_RUST_CORE
    CAPA_4_SERVIDOR <-->|"Async State & Tokio Channels"| CAPA_5_RUST_CORE
    CAPA_5_RUST_CORE <-->|"Controladores de Radio & Sockets"| CAPA_6_HARDWARE
    CAPA_7_BIOCIBERNETICA <-->|"Sincronización de Slot & Deriva"| CAPA_6_HARDWARE
```

---

## 2. Mapa Visual 2: Flujo Criptográfico Híbrido Post-Cuántico

RED utiliza un esquema criptográfico de doble capa que combina criptografía de curva elíptica tradicional con algoritmos estandarizados por el NIST resistentes a computación cuántica (**FIPS 203 ML-KEM-768**):

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Nodo Emisor (Alice)
    participant CoreA as red_core (Alice)
    participant Mesh as Red Malla P2P (BLE/WiFi/LoRa)
    participant CoreB as red_core (Bob)
    actor Bob as Nodo Receptor (Bob)

    Note over Alice,Bob: 1. Negociación Inicial de Llaves (Key Encapsulation Mechanism)
    Alice->>CoreA: Redactar mensaje para Bob (did:red:BobHash)
    CoreA->>CoreA: Obtener Clave Pública de Bob (ECDH P-256 + ML-KEM-768 PubKey)
    CoreA->>CoreA: Generar secreto efímero clásico (ECDH Shared Secret S_cl)
    CoreA->>CoreA: Encapsular secreto post-cuántico (ML-KEM Encapsulate -> S_pq, C_pq)
    CoreA->>CoreA: Derivar Clave Maestra de Sesión: K_master = HKDF-SHA256(S_cl || S_pq)

    Note over Alice,Bob: 2. Cifrado Authenticated Encryption (AES-256-GCM)
    CoreA->>CoreA: Cifrar Payload con K_master + Nonce único + AAD (Metadata)
    CoreA->>CoreA: Computar Hashcash Proof-of-Work (Anti-Spam PoW)
    CoreA->>CoreA: Empaquetar en Cebolla Onion (3 capas de enrutamiento anónimo)

    Note over Alice,Bob: 3. Transmisión Multi-Salto por la Malla
    CoreA->>Mesh: Inyectar paquete cifrado (MeshPacket)
    Mesh->>Mesh: Reenvío Gossipsub / Flooding por nodos intermedios (Zero-Knowledge)
    Mesh->>CoreB: Entrega de paquete en destino

    Note over Alice,Bob: 4. Desencapsulación & Descifrado
    CoreB->>CoreB: Decapsular secreto post-cuántico (ML-KEM Decapsulate con Bob PrivKey)
    CoreB->>CoreB: Computar secreto clásico ECDH
    CoreB->>CoreB: Derivar K_master idéntica
    CoreB->>CoreB: Descifrar AES-256-GCM & verificar etiqueta de autenticación (AuthTag)
    CoreB->>Bob: Notificar mensaje descifrado en interfaz

    Note over Alice,Bob: 5. Retorno de Acuse de Recibo Criptográfico (DELIVERY_ACK)
    CoreB->>CoreB: Generar DELIVERY_ACK con Hash del Mensaje + Nonce firmado
    CoreB->>Mesh: Inyectar paquete DELIVERY_ACK
    Mesh->>CoreA: Retorno a Alice
    CoreA->>CoreA: Verificar firma del ACK & marcar mensaje como Entregado (Doble Check)
```

---

## 3. Mapa Visual 3: Autenticación Soberana, Biometría TEE/WebAuthn & Bóveda Cifrada

La autenticación en RED garantiza aislamiento criptográfico absoluto de la base de datos `sled`, sin contraseñas en texto plano ni puertas traseras:

```mermaid
flowchart TD
    START(["Inicio de Aplicación RED"]) --> CHECK_MODE{"¿Existe PIN Maestro Registrado?"}

    subgraph ONBOARDING ["Modo Onboarding (Primer Uso)"]
        CREATE_PIN["Usuario ingresa PIN de 6 dígitos"] --> CONFIRM_PIN["Usuario confirma PIN"]
        CONFIRM_PIN --> CHECK_MATCH{"¿PINs Coinciden?"}
        CHECK_MATCH -- No --> CREATE_PIN
        CHECK_MATCH -- Sí --> STORE_SECURE["Almacenar en Hardware KeyStore / LocalStorage"]
        STORE_SECURE --> PROMPT_BIO{"¿Hardware Biométrico Disponible?"}
        PROMPT_BIO -- Sí --> ENROLL_BIO["Vincular Huella / Rostro / Passkey WebAuthn"]
        PROMPT_BIO -- No --> INIT_RUST
        ENROLL_BIO --> INIT_RUST
    end

    subgraph UNLOCK ["Modo Desbloqueo (Usuario Recurrente)"]
        PROMPT_METHOD{"Método de Entrada"}
        PROMPT_METHOD -->|"Biometría / Passkey"| BIO_AUTH["Disparar BiometricPrompt / Windows Hello / Touch ID"]
        PROMPT_METHOD -->|"Teclado Táctico"| PIN_ENTRY["Ingresar PIN de 6 dígitos"]
        
        BIO_AUTH --> BIO_RESULT{"¿Biometría Válida?"}
        BIO_RESULT -- Sí --> RETRIEVE_PIN["Obtener PIN Maestro del KeyStore Seguro"]
        BIO_RESULT -- No / Cancelado --> PIN_ENTRY
    end

    CHECK_MODE -- No --> CREATE_PIN
    CHECK_MODE -- Sí --> PROMPT_METHOD

    PIN_ENTRY --> CHECK_PIN_TYPE{"Tipo de PIN Ingresado"}
    RETRIEVE_PIN --> INIT_RUST

    subgraph PROTOCOLOS_ESPECIALES ["Protocolos de Seguridad & Anti-Coacción"]
        CHECK_PIN_TYPE -->|"PIN de Pánico"| PANIC_WIPE["🔥 PROTOCOLO DE PÁNICO: Destrucción Total de Claves y DB"]
        CHECK_PIN_TYPE -->|"PIN Señuelo"| DECOY_VAULT["🎭 BÓVEDA SEÑUELO: Abrir entorno simulado inocente"]
        CHECK_PIN_TYPE -->|"PIN Maestro"| INIT_RUST["Inicializar Nodo Rust (JNI / red-node.exe)"]
    end

    subgraph VALIDACION_RUST ["Validación en Núcleo Rust (Storage Decryption)"]
        INIT_RUST --> DERIVE_KEY["Derivar Clave Simétrica AES-256 (Argon2id)"]
        DERIVE_KEY --> OPEN_SLED["Abrir Base de Datos Sled"]
        OPEN_SLED --> TRY_DECRYPT{"try_get_identity: ¿Desencriptación Exitosa?"}
        TRY_DECRYPT -- "Fallo (Clave Inválida)" --> FATAL_ABORT["❌ ABORTO FATAL: Clave Incorrecta / Error de Descifrado"]
        TRY_DECRYPT -- "Éxito" --> BIND_AXUM["Enlazar Axum a 127.0.0.1:7333 (Loopback)"]
        BIND_AXUM --> AUTH_SUCCESS(["✅ AUTENTICACIÓN EXITOSA: Bóveda Desbloqueada"])
    end
```

---

## 4. Mapa Visual 4: Matriz de Enrutamiento Mesh Multi-Transporte & Protocolo ACKs

RED selecciona dinámicamente el mejor medio físico de transmisión basándose en la disponibilidad de hardware, la proximidad del par y las métricas de enlace LQS (*Link Quality Score*):

```mermaid
graph LR
    subgraph EMISOR ["Nodo Emisor"]
        OUT_MSG["Mensaje Saliente"] --> PACKETIZER["Fragmentador & Enrutador LQS"]
    end

    subgraph MEDIOS_DE_TRANSMISION ["Matriz de Medios Físicos de Transporte"]
        PACKETIZER -->|"Proximidad Inmediata (<10m)"| BLE["Bluetooth LE 5.x GATT (HCI)"]
        PACKETIZER -->|"Banda Ancha Local (<100m)"| WIFI_D["WiFi Direct / WebRTC DataChannel"]
        PACKETIZER -->|"Largo Alcance Off-Grid (<15km)"| TDMA_LORA["LoRa TDMA SX1262 (915/868 MHz)"]
        PACKETIZER -->|"Repetidor Autónomo de Campo"| REPEATER["ESP32-S3 Solar Repeater Fleet"]
        PACKETIZER -->|"Radio Bloqueada / Cero RF"| SOUND["SoundMesh Acústico (18-20 kHz)"]
        PACKETIZER -->|"Enlace Satelital LEO"| SAT["Satellite Gateway (Downlink Pruned)"]
        PACKETIZER -->|"Acceso a Internet WAN"| WAN_KAD["P2P Kademlia DHT + Auto-Relay"]
    end

    subgraph RECEPTOR ["Nodo Receptor"]
        BLE --> DEPACKETIZER["Reensamblador & Deduplicador Canónico"]
        WIFI_D --> DEPACKETIZER
        TDMA_LORA --> DEPACKETIZER
        REPEATER --> DEPACKETIZER
        SOUND --> DEPACKETIZER
        SAT --> DEPACKETIZER
        WAN_KAD --> DEPACKETIZER
        DEPACKETIZER --> IN_MSG["Bandeja de Entrada"]
        IN_MSG --> ACK_GEN["Generador de DELIVERY_ACK"]
    end

    ACK_GEN -.->|"Retorno por Mejor Ruta"| PACKETIZER
```

---

## 5. Mapa Visual 5: Motor de Inteligencia Artificial Offline & Guardian Security Firewall

RED integra un modelo de lenguaje neuronal y un sistema de seguridad semántica 100% offline que se ejecuta localmente en el dispositivo mediante WebAssembly y aceleración SIMD:

```mermaid
flowchart TD
    USER_QUERY["Entrada de Usuario / Mensaje en Malla"] --> GUARDIAN_IN{"Guardian IA Firewall (64-bit Hamming Filter)"}

    subgraph GUARDIAN_ENGINE ["Sistema de Seguridad Guardian IA"]
        GUARDIAN_IN -- "Amenaza / Inyección Detectada" --> BLOCK_ACT["⛔ Bloquear Contenido & Alertar"]
        GUARDIAN_IN -- "Seguro" --> AI_PIPELINE["Pipeline de Inferencia Neuronal"]
    end

    subgraph AI_PIPELINE_ENGINE ["Pipeline Neuronal Offline"]
        AI_PIPELINE --> CLASSIFIER["Clasificador de Dominio (8 Categorías Tácticas)"]
        CLASSIFIER --> RAG["RAG Semántico Vectorial en Memoria"]
        RAG --> ONNX_RUNTIME["ONNX Runtime Web (WASM / WebGL)"]
        ONNX_RUNTIME --> MODEL_WEIGHTS["Pesos MiniLM-L6-v2 Cuantizados"]
        MODEL_WEIGHTS --> GEN_RESP["Generación de Respuesta Estructurada"]
    end

    GEN_RESP --> GUARDIAN_OUT{"Guardian Sanitizer"}
    GUARDIAN_OUT --> DELIVER_RESP["Respuesta Entregada a la Interfaz / Chatbot"]
```

---

## 6. Mapa Visual 6: Enrutamiento Geoespacial Geohash & Poda DTN

Para evitar que mulas de datos móviles y satélites LEO colapsen sus memorias transportando tráfico global irrelevante, RED implementa el enrutamiento geoespacial por cuadrantes Geohash:

```mermaid
flowchart TD
    NEW_PKT["Nuevo Paquete Generado (Lat, Lon)"] --> GEO_ENCODE["GeohashSpatialRouting.encodeGeohash(lat, lon, 6)"]
    GEO_ENCODE --> INDEX_STORAGE["Indexar en dtnStorage (IndexedDB v2: targetGeohash)"]

    subgraph CARRIER_FILTER ["Filtro de Aceptación de Portador / Mula Móvil"]
        CARRIER_POS["Posición del Portador (Vector de Desplazamiento)"]
        EVAL_DIST{"GeohashSpatialRouting.shouldCarrierAcceptPacket()"}
        INDEX_STORAGE --> EVAL_DIST
        CARRIER_POS --> EVAL_DIST
        EVAL_DIST -- "Prefijo Incompatible / Fuera de Rango" --> PRUNE["❌ Descartar Paquete (Poda Espacial)"]
        EVAL_DIST -- "En Trayectoria / Rango Manhattan Aceptable" --> ACCEPT["✅ Cargar en Custodia DTN Local"]
    end

    subgraph SATELLITE_DOWNLINK ["Descarga Satelital LEO Selectiva"]
        SAT_FOOTPRINT["Huella Terrestre Satelital (Footprint Geohash-4)"]
        SAT_FILTER{"downlinkSpatialPruning: ¿Paquete dentro de la huella?"}
        ACCEPT --> SAT_FILTER
        SAT_FOOTPRINT --> SAT_FILTER
        SAT_FILTER -- "Fuera de Huella" --> RETAIN_ORBIT["Mantener en Memoria de Órbita"]
        SAT_FILTER -- "Dentro de Huella" --> RF_DOWNLINK["Emitir Ráfaga LoRa Downlink al Terreno"]
    end
```

---

## 7. Mapa Visual 7: Coordinación Espectral LoRa TDMA (Clock Skew PLL & Sincronización Kuramoto)

El planificador `LoRaTdmaSchedulerEngine` y el sintetizador `LamportMeshClockEngine` organizan el espectro sub-GHz en supertramas periódicas de 2000 ms divididas en 10 slots de 200 ms, eliminando colisiones en concentraciones masivas de operadores mediante bucles de enganche de fase (PLL) y tiempos de guarda adaptativos:

```mermaid
gantt
    title Supertrama LoRa TDMA RED (2000 ms = 10 Slots de 200 ms)
    dateFormat X
    axisFormat %s ms

    section Nodos Fijos
    Slot 0 (FNV-1a Hash % 8)     :0, 200
    Slot 1 (FNV-1a Hash % 8)     :200, 400
    Slot 2 (FNV-1a Hash % 8)     :400, 600
    Slot 3 (FNV-1a Hash % 8)     :600, 800
    Slot 4 (FNV-1a Hash % 8)     :800, 1000
    Slot 5 (FNV-1a Hash % 8)     :1000, 1200
    Slot 6 (FNV-1a Hash % 8)     :1200, 1400
    Slot 7 (FNV-1a Hash % 8)     :1400, 1600

    section Sincronización
    Slot 8 (Baliza / Kuramoto / PLL) :1600, 1800

    section Contienda
    Slot 9 (CSMA/CA Backoff)    :1800, 2000
```

- **Slots 0–7 (Deterministas):** Asignados de forma matemáticamente reproducible según el DID del nodo ($S_{\text{node}} = \text{FNV-1a}(\text{DID}) \pmod 8$). Cero colisiones entre nodos con slots distintos.
- **Slot 8 (Baliza, Kuramoto & PLL):** Emisión de marcas de tiempo lógicas de Lamport, vectores de fase Kuramoto (`FLAG_KURAMOTO_SYNC = 0x40`) y estado espectral del enjambre.
- **Slot 9 (Contienda Dinámica):** Acceso aleatorio mediante CSMA/CA con retroceso binario exponencial (*exponential backoff*) para nodos transitorios.
- **Bypass de Emergencia SOS (Prioridad >= 9):** Interrumpe de inmediato cualquier supertrama en curso y transmite ráfagas de socorro al aire sin demoras de slot ($t = 0$).
- **Bucle de Enganche de Fase (Clock Skew PLL):** Monitorea continuamente la deriva de cristal (PPM) contra las balizas del Slot 8. Aplica compensación proporcional al reloj local para neutralizar desfasajes térmicos en osciladores de cristal no compensados (TCXO).
- **Tiempos de Guarda Adaptativos:**
  - $\text{Guard} = 15\text{ ms}$ para derivas térmicas estables ($< 20\text{ PPM}$).
  - $\text{Guard} = 25\text{ ms}$ para derivas moderadas ($20 - 50\text{ PPM}$).
  - $\text{Guard} = 35\text{ ms}$ para condiciones hostiles o alta dispersión ($> 50\text{ PPM}$).

---

## 8. Mapa Visual 8: Capa Bio-Cibernética, Conectoma Neuronal & Reflejo de Fibra Gigante

RED v121.0.0 incorpora modelos bio-físicos computacionales inspirados en el conectoma somático completo de *Drosophila melanogaster* (124,289 neuronas y ~30 millones de conexiones sinápticas) para resolver la sincronización colectiva, la ignición atencional y el silenciamiento de pánico:

```mermaid
flowchart TD
    subgraph ATENCION_GLOBAL ["Espacio de Trabajo Neuronal Global (GNWT)"]
        INPUT_EVENTS["Eventos Sensoriales / Paquetes Entrantes"] --> COMPETITION["Inhibición Lateral Competitiva (θ = 0.60)"]
        COMPETITION --> IGNITION{"¿Supera Umbral de Ignición?"}
        IGNITION -- "Ruido Sub-Umbral" --> DECAY["Desvanecimiento Exponencial (Filtro Anti-Saturación)"]
        IGNITION -- "Ignición Consciente" --> BROADCAST["Difusión a Toda la Malla (GNWT Consciousness Bus)"]
        BROADCAST --> TONONI_PHI["Cálculo de Información Integrada (Φ) & Energía Libre (F)"]
    end

    subgraph SINCRONIZACION_ENJAMBRE ["Sincronizador de Fase Kuramoto (RingAttractorEngine)"]
        BROADCAST --> ATTRACTOR["Atractor en Anillo (Ring Attractor Dynamic)"]
        ATTRACTOR --> KURAMOTO_EQ["Ecuación de Kuramoto: dθ_i/dt = ω_i + (K/N) Σ sin(θ_j - θ_i)"]
        KURAMOTO_EQ --> PHASE_LOCK["Bloqueo de Fase Colectivo & Estabilidad de Ranura TDMA"]
    end

    subgraph REFLEJO_ESCAPE ["Reflejo Monosináptico de Fibra Gigante (GiantFiberReflexEngine)"]
        EW_THREAT["Amenaza EW / Detección de Inhibidor RF / Detección de Coacción"] --> LC4_LPLC2["Neuronas Visuales de Amenaza Rápida (LC4 #10042 / LPLC2 #10043)"]
        LC4_LPLC2 --> DNP01["Interneurona Gigante Descendente (DNp01 #10001)"]
        DNP01 --> TTMN["Motoneurona de Salto Tergotrocantéreo (TTMn #10099)"]
        TTMN --> FAST_SILENCE["⚡ Silenciamiento EMCON / Corte de Emisiones en < 15 ms"]
        TTMN --> DURESS_TRIGGER{"¿Disparo por PIN de Pánico?"}
        DURESS_TRIGGER -- Sí --> DURESS_ZEROIZE["🔥 DuressWipeEngine: Sobreescritura DoD 5220.22-M 3-Pass de Claves & Sled DB"]
    end
```

- **Visualizador Somático 3D (`MaleCnsConnectomeHUD.tsx`):** Renderizado acelerado por WebGL/Canvas del atlas conectómico somático completo (124,289 neuronas y ~30 millones de sinapsis), permitiendo trazar rutas de flujo informacional táctico en tiempo real.
- **Teoría del Espacio de Trabajo Global (GNWT):** El bus `GlobalWorkspaceConsciousnessBus` previene que la interfaz y el enrutador colapsen ante avalanchas de alertas mediante competencia por inhibición lateral ($\theta = 0.60$), optimizando la energía libre variacional $F$ de la red.
- **Dinámica de Atractor en Anillo & Kuramoto:** Sincroniza la frecuencia de reloj interna de los nodos mediante acoplamiento no lineal de fases, asegurando que los operadores móviles converjan en la misma supertrama sin sincronización GPS.
- **Circuito de Escape de Fibra Gigante:** Emula el arco reflejo monosináptico de colisión para aislar la radio en menos de 15 ms ante detección de guerra electrónica o disparar la purga criptográfica anti-forense.

---

## 9. Mapa Visual 9: Flota de Repetidores Solares Autónomos ESP32-S3

Los repetidores autónomos de campo (`firmware/esp32-repeater/`) operan de manera perpetua en crestas montañosas y techos urbanos alimentados por paneles solares de bajo costo:

```mermaid
graph TD
    SOLAR["Panel Solar 5V / 10W Monocristalino"] --> TP4056["Controlador de Carga Li-Ion TP4056"]
    BATT["Celda 18650 3.7V / 3500mAh"] <--> TP4056
    TP4056 --> REG["Regulador LDO 3.3V Low-Quiescent"]
    
    REG --> MCU["ESP32-S3 (80 MHz Low-Power Sentinel Mode)"]
    MCU <-->|"SPI Bus Dedicado (SCK=9, MISO=11, MOSI=10, NSS=8)"| SX1262["Semtech SX1262 Radio Module"]
    MCU -->|"Control TCXO 1.8V"| SX1262
    
    subgraph REPEATER_LOGIC ["Lógica de Firmware Embebido C++"]
        RX_IRQ["Interrupción RX LoRa"] --> READ_HEADER["Leer Cabecera RED 96 Bytes (Magic 0x52454401)"]
        READ_HEADER --> BLOOM_CHECK{"Filtro Bloom 2048-bit: ¿Ya Procesado?"}
        BLOOM_CHECK -- "Sí (Duplicado)" --> DROP["Descartar Inmediatamente"]
        BLOOM_CHECK -- "No (Paquete Nuevo)" --> INSERT_BLOOM["Registrar Hash en Filtro Bloom"]
        INSERT_BLOOM --> DEC_TTL["Decrementar TTL & Incrementar Hop Count"]
        DEC_TTL --> TX_RELAY["Reenviar Ráfaga en Slot 9 / Bypass SOS"]
    end

    SX1262 --> RX_IRQ
    TX_RELAY --> SX1262
```

---

## 10. Resumen de Componentes, Crates & Firmware del Workspace

| Componente | Lenguaje / Framework | Responsabilidad Principal | Ubicación |
|---|---|---|---|
| **`red_core`** | Rust (1.80+) | SSOT de modelos de protocolo táctico (`red_core::protocol::tactical`), criptografía post-cuántica (ML-KEM-768), enrutamiento mesh, identidades soberanas. | [core/](core/) |
| **`red_mobile`** | Rust + JNI | Biblioteca dinámica nativa (`libred_mobile.so`) para Android con servidor Axum embebido en loopback estricto. | [red_mobile/](red_mobile/) |
| **`red_node`** | Rust | Binario ejecutable de escritorio (`red-node.exe`) con CLI, nodo validador PoS y servidor local REST/SSE. | [node/](node/) |
| **`red_blockchain`** | Rust | Libro mayor distribuido, consenso Proof-of-Stake, validadores, árboles de Merkle y mempool de transacciones. | [blockchain/](blockchain/) |
| **`client/app`** | Next.js 16 + React 19 | Interfaz táctica SPA (65 modales tácticos, Vivarium Biocibernético 3D, Hábitat Digital In-Silico), Zustand Slices modulares, WebAuthn Passkeys, Capacitor bridge, LoRa TDMA Engine, Conectoma MaleCNS y Kuramoto Sync. | [client/app/](client/app/) |
| **`firmware/esp32-repeater`** | C++ (PlatformIO / RadioLib) | Firmware para repetidores solares autónomos de campo con microcontrolador ESP32-S3 y transceptor Semtech SX1262 (BOM ~$15-20 USD). | [firmware/esp32-repeater/](firmware/esp32-repeater/) |
| **`signaling`** | Node.js | Servidor de señalización WebRTC zero-knowledge y relé ciego para conexiones P2P Web-to-Mobile. | [signaling/](signaling/) |
| **`proofs`** | ProVerif | Modelos matemáticos formales de verificación de seguridad, secreto perfecto y anonimato. | [proofs/](proofs/) |
| **`specs`** | TLA+ | Especificación formal del protocolo de consenso y tolerancia a fallos bizantinos. | [specs/](specs/) |

---

## 11. Mapa Visual 10: Vivarium Biocibernético 3D & Gemelo Digital Táctico

El **Vivarium Biocibernético 3D** (`Vivarium3DEngine.ts`) unifica los modelos neuronales, osciladores CPG y la topología física de red en un gemelo digital interactivo WebGL (Three.js):

```mermaid
graph TD
    subgraph VIVARIUM_CORE ["Motor Tridimensional Soberano (Vivarium3DEngine.ts)"]
        SCENE["Three.js Scene + Orthographic/Perspective Camera"]
        RENDERER["WebGLRenderer (Pixel Ratio acotado <= 2, ToneMapping ACES)"]
        LOOP["Adaptative Render Loop (requestAnimationFrame con Visibilidad Activa)"]
        DISPOSE["Garbage Collector Recursivo (Geometries, Materials, Textures)"]
        
        SCENE --> RENDERER
        RENDERER --> LOOP
        LOOP --> DISPOSE
    end

    subgraph SUSTRATO_MEC ["Suelo Entorrinal Multiescala (EntorhinalGridFloor3D.ts)"]
        GRID_SCALES["4 Razones de Escala MEC (lambda: 1.0, 1.42, 2.02, 2.87)"]
        HEX_CELLS["Células Procedurales Hexagonales (Simetría 60 grados en X-Z)"]
        FIRING_PEAKS["Picos de Disparo Luminosos al Paso de Entidades"]
        
        GRID_SCALES --> HEX_CELLS
        HEX_CELLS --> FIRING_PEAKS
    end

    subgraph ENTIDADES_3D ["Cinemática & Actuadores Biológicos (HexapodBody3D.ts & VivariumEntities3D.ts)"]
        CPG_OSC["Central Pattern Generator (Kuramoto-Matsuoka Delta phi = pi)"]
        TRIPOD["Marcha Trípode Alternada (Trípode A vs Trípode B en 6 Patas 3-DOF)"]
        FLY_REFLEX["Circuito Reflejo Giant Fiber (Escape Balístico < 15ms ante Looming)"]
        ROVER_NODE["Terminal / Rover Terrestre con Baliza P2P"]
        LORA_TOWERS["4 Torres de Baliza LoRa Perimetrales (Slots TDMA)"]
        LEO_SAT["Satélite LEO Orbital (Footprint Cónico Geohash-4)"]
        
        CPG_OSC --> TRIPOD
        FLY_REFLEX --> TRIPOD
    end

    VIVARIUM_CORE <--> SUSTRATO_MEC
    VIVARIUM_CORE <--> ENTIDADES_3D
```

---

## 12. Mapa Visual 11: Hábitat Digital Biocibernético In-Silico & Ecosistema Multi-Cerebro A-Life

El **Hábitat Digital Biocibernético In-Silico** (`BiocyberneticHabitatEngine.ts`) implementa un sustrato de simulación biofísica continua a 60 Hz desacoplado con resolución de ecuaciones diferenciales en derivadas parciales (EDP), percepción sensorial y etología divergente de las **5 inteligencias soberanas del proyecto**, ludoteca interactiva de mini-juegos (Gran Torneo de Glucosa, Puntero Láser Chase, Lluvia de Néctar), ciclo de vida evolutivo A-Life, bocadillos de pensamiento holográficos 3D/2D y enlace de migración P2P:

```mermaid
graph TD
    subgraph SUSTRATO_FICK ["Sustrato Continuo de Difusión de Fick 2D (FickDiffusionGrid.ts)"]
        PDE_SOLVER["Solucionador Numérico EDP (∂C/∂t = D ∇²C - v·∇C - λC)"]
        PING_PONG["Dual-Buffer Float32Array (Ping-Pong 64x64 por Sustancia)"]
        WIND_ADV["Advección Eólica Upwind de 1er Orden (vx, vy)"]
        BARRIERS["Barreras Acústicas Reflectoras (Condición Neumann Flujo Cero)"]
        
        PDE_SOLVER --> PING_PONG
        PDE_SOLVER --> WIND_ADV
        PDE_SOLVER --> BARRIERS
    end

    subgraph ESPECIES_DIVERGENTES ["5 Inteligencias Soberanas en Coexistencia Simbiótica"]
        DROSOPHILA["Drosophila: Omatidios LC4, Alas Batientes & STDP Hebbiano PAM/PPL1"]
        HUMAN_NEOCORTEX["Neocórtex Humano: Avatar Epistémico 7 Núcleos & Celdas Entorrinales"]
        GRAVITY_SENTINEL["Gravity Sentinel IA: Cuadricóptero Autónomo, Cono Escaneo & Árbitro"]
        C_ELEGANS["C. elegans: Columna Sinusoidal 10 Nodos & Klinokinesis Pierce-Shimomura"]
        FORMICIDAE["Ant Colony: Mandíbulas, Forrajeo & Estigmergia PHEROMONE_TRAIL"]
    end

    subgraph LUDOTECA_HUD ["Ludoteca & Mini-Juegos Interactivos L9"]
        SUGAR_RACE["🏆 Gran Torneo de Glucosa (Mega-Cristal 3D, Carreras & Locución IA)"]
        LASER_CHASE["🎯 Puntero Láser Juguetón (Persecución Lúdica Interactiva)"]
        NECTAR_RAIN["🍯 Lluvia de Néctar (+10 Fuentes de Glucosa Simultáneas)"]
        WIND_ACROBATICS["💨 Ráfaga Acrobática (Evasiones 360° en Enjambre)"]
        THOUGHT_BUBBLES["💬 Bocadillos Holográficos 3D/2D (Pensamientos & Ánimos en Vivo)"]
        AFFECTIVE_DECK["💖 Acciones Afectivas (Alimentar Golosina, Acariciar & Conversar)"]
    end

    subgraph CICLO_A_LIFE ["Evolución & Ciclo de Vida Ecológico In-Silico"]
        SATIETY["Detector de Saciedad Energética (ATP > 82%)"]
        MITOSIS["Reproducción / Oviposición Generacional (Gen N+1)"]
        MUTATION["Mutación Epigenética Gaussiana de Pesos Sinápticos"]
        DECAY["Biodegradación de Cadáveres en Biomasa de Nutrientes"]
        
        SATIETY --> MITOSIS
        MITOSIS --> MUTATION
        DECAY --> PDE_SOLVER
    end

    subgraph MALLA_P2P ["Migración Ecológica Inter-Dispositivo"]
        P2P_PACKET["Trama de Migración Cuantizada (72 bytes / mesh.bio.habitat.v1)"]
        LORA_BLE["Transporte de Radio LoRa SX1262 / Bluetooth LE"]
        IMMIGRANT["Desempaquetado y Colonización de Nuevas Terminales"]
        
        P2P_PACKET --> LORA_BLE
        LORA_BLE --> IMMIGRANT
    end

    SUSTRATO_FICK <--> ESPECIES_DIVERGENTES
    ESPECIES_DIVERGENTES --> CICLO_A_LIFE
    LUDOTECA_HUD <--> ESPECIES_DIVERGENTES
    LUDOTECA_HUD <--> SUSTRATO_FICK
    ESPECIES_DIVERGENTES <--> MALLA_P2P
```

---

## 13. Mapa Visual 12: Motor de Ajedrez Táctico Autónomo In-Silico & Cognición Inter-Especies

El motor soberano de ajedrez táctico in-silico (`AutonomousHabitatChessEngine.ts`) dota a los hábitats biocibernéticos (tanto la simulación interna C4ISR como la Mini-App de la Tienda Soberana) de confrontaciones cognitivas formales sin dependencias externas:

```mermaid
graph TD
    subgraph TABLERO_CANONICO ["Tablero Canónico 8x8 Determinista (Cero Dependencias)"]
        BOARD["Matriz 8x8 (64 casillas, fila 0-7, col 0-7)"]
        GEN_MOVES["Generador Exhaustivo de Movimientos Legales"]
        PROMOTION["Promoción Automática de Peones a Dama (Fila 0 / 7)"]
        KING_SAFETY["Detección de Jaque, Mate y Captura de Rey"]
        SAFE_LIMIT["Guardarraíl de 150 Jugadas (Detección de Tablas)"]
        
        BOARD --> GEN_MOVES
        GEN_MOVES --> PROMOTION
        GEN_MOVES --> KING_SAFETY
        KING_SAFETY --> SAFE_LIMIT
    end

    subgraph HEURISTICAS_COGNITIVAS ["Evaluadores Neuroanatómicos de las 5 Especies"]
        NEOCORTEX_EVAL["Human Neocortex: Minimax Alfa-Beta (Profundidad 3) + Posición Clásica"]
        SENTINEL_EVAL["Gravity Sentinel IA: Control Vectorial, Líneas de Fuego & Densidad de Amenaza"]
        DROSOPHILA_EVAL["Drosophila: Recompensa Dopaminérgica Hebbiana (PAM/PPL1) & Agresividad"]
        ANT_EVAL["Ant Colony: Falange Estigmérgica, Soporte Mutuo & Blindaje de Peones"]
        CELEGANS_EVAL["C. elegans: Klinokinesis Estocástica (Gradiente Pierce-Shimomura)"]
    end

    subgraph REFLEXIONES_HUD ["Pensamiento & Telemetría Reactiva"]
        THOUGHT_GEN["Generador de Reflexiones en Lenguaje Natural (CognitiveThoughtEntry)"]
        BUBBLES_3D["Bocadillos Holográficos Flotantes 3D / 2D"]
        HUD_MODAL["TacticalHabitatModal.tsx (Mini-Tablero 8x8, Reloj & Marcador)"]
        MINIAPP_CANVAS["biocyberneticHabitatApp.ts (Mesa Central en Mini-App)"]
        
        THOUGHT_GEN --> BUBBLES_3D
        THOUGHT_GEN --> HUD_MODAL
        THOUGHT_GEN --> MINIAPP_CANVAS
    end

    subgraph HARDWARE_3D ["Representación Física 3D (BiocyberneticHabitat3DEngine)"]
        CHESS_TABLE_3D["Pedestal Cilíndrico Táctico (R=0.7m, metalness=0.85)"]
        NEON_RING["Anillo Concéntrico Cian (#00f0ff, opacidad 70%)"]
        GRID_CELLS["64 Celdas Alternadas Tácticas (0x071526 / 0x1b324f)"]
        HOLO_CROWN["Prisma Holográfico Flotante con Rotación Continua & Levitación Sinusoidal"]
        
        CHESS_TABLE_3D --> NEON_RING
        CHESS_TABLE_3D --> GRID_CELLS
        CHESS_TABLE_3D --> HOLO_CROWN
    end

    subgraph MALLA_LORA_P2P ["Retransmisión P2P Ultraliviana (< 24 bytes)"]
        MESH_PKT["Trama 24B: Header 'RC' (0x52 0x43) + Turno + Ganador + From/To"]
        LORA_RADIO["Canal LoRa SX1262 / BLE GATT"]
        SWARM_OBS["Observabilidad del Torneo en la Red Mesh Planetaria"]
        
        MESH_PKT --> LORA_RADIO
        LORA_RADIO --> SWARM_OBS
    end

    TABLERO_CANONICO <--> HEURISTICAS_COGNITIVAS
    HEURISTICAS_COGNITIVAS --> THOUGHT_GEN
    TABLERO_CANONICO --> HARDWARE_3D
    TABLERO_CANONICO --> MESH_PKT
```

### Características Técnicas del Motor de Ajedrez Táctico:
1. **Determinismo y Rendimiento:** Ejecutado en el sub-bucle de física a 60 Hz sin bloquear el hilo principal de renderizado Three.js.
2. **Paridad de Mini-App:** Sincronizado tanto en el HUD táctico principal como en la Mini-App descentralizada del ecosistema RED.
3. **Presupuesto Espectral:** 24 bytes por jugada permiten emitir telemetría de partidas a través de enlaces LoRa de largo alcance con SF12 sin saturar el canal de radio táctico.
4. **Cumplimiento Ético Nivel 14:** Alineado con las reglas de cohabitación in-silico y respeto cognitivo de `GOVERNANCE.md`.

---

## 14. Mapa Visual 13: El Paraíso Biocibernético In-Silico & Aprendizaje Autónomo Permanente

El Paraíso Biocibernético (`BiocyberneticEdenParadiseEngine.ts`) y el Motor de Aprendizaje Permanente (`AutonomousLifelongLearningEngine.ts`) transforman el hábitat en un santuario edénico donde las 5 especies conviven, descansan y acumulan sabiduría duradera a lo largo del tiempo:

```mermaid
graph TD
    subgraph SUSTRATO_PARAISOCIBERNETICO ["1. Sustrato Edénico & Microclimas (BiocyberneticEdenParadiseEngine)"]
        CIRCADIAN["Ciclo Circadiano (180s: Día Solar Dorado ☀️ / Noche Boreal Estelar 🌙)"]
        SPRINGS_3D["3 Manantiales de Néctar Cristalino (Aurora, Metamorfosis, Sosiego)"]
        TREE_OF_LIFE["Árbol de la Vida Cuántico 3D (Santuario Central, R=2.8m)"]
        MYCELIUM_WEB["Red Micelial Fúngica (Transporte Osmótico de Glucosa & Serotonina)"]
        SOLFEGGIO["Resonancia Armónica Solfeggio Generativa (432 Hz / 528 Hz)"]
        FICK_EXT["FickDiffusionGrid: Emisión Continua de SEROTONIN & MYCELIUM_NUTRIENTS"]
        
        CIRCADIAN --> SPRINGS_3D
        CIRCADIAN --> SOLFEGGIO
        SPRINGS_3D --> MYCELIUM_WEB
        MYCELIUM_WEB --> TREE_OF_LIFE
        TREE_OF_LIFE --> FICK_EXT
    end

    subgraph APRENDIZAJE_LIFELONG ["2. Aprendizaje Autónomo Permanente (AutonomousLifelongLearningEngine)"]
        FREE_ENERGY["Inferencia Activa & Curiosidad Intrínseca (Principio de Karl Friston)"]
        TD_BELLMAN["TD-Learning / Ecuación de Bellman: Q(s,a) += α [r + γ max Q(s',a') - Q(s,a)]"]
        SLEEP_REPLAY["Sueño REM & Offline Replay (Consolidación Hipocampal / Central Complex)"]
        CHESS_OPENINGS["Libro de Aperturas Aprendido (LearnedOpeningBook por Especie)"]
        HOMEOSTASIS["Homeostasis Sináptica de Tononi (Poda de Ruido & Retención de Sabiduría)"]
        PERSISTENCE["Persistencia Atómica Perenne en Bóveda Local (red_eden_lifelong_memory_v1)"]
        
        FREE_ENERGY --> TD_BELLMAN
        TD_BELLMAN --> SLEEP_REPLAY
        SLEEP_REPLAY --> HOMEOSTASIS
        CHESS_OPENINGS --> PERSISTENCE
        HOMEOSTASIS --> PERSISTENCE
    end

    subgraph OBSERVABILIDAD_HUD ["3. Interfaz & Experiencia 3D/2D"]
        CANOPY_3D["Dosel de Partículas Bioluminiscentes & Cúpula de Auroras Boreales"]
        WISDOM_TELEMETRY["Telemetría de Sabiduría: Wisdom Level, Curiosity Score & Replay Status"]
        WEATHER_EVENTS["Clima Celestial Reactivo: Rocío de Néctar, Brisa de Serotonina & Meditación"]
        MINIAPP_EDEN["Mini-App de la Tienda Soberana con Bioma Edénico Sincronizado"]
    end

    SUSTRATO_PARAISOCIBERNETICO <--> APRENDIZAJE_LIFELONG
    APRENDIZAJE_LIFELONG --> OBSERVABILIDAD_HUD
    SUSTRATO_PARAISOCIBERNETICO --> OBSERVABILIDAD_HUD
```

### Especificaciones de la Arquitectura Edénica:
1. **Conservación de Sabiduría Intergeneracional:** Los pesos sinápticos y libros de aperturas de ajedrez persisten entre reinicios de la aplicación, permitiendo que las especies acumulen pericia táctica durante días y semanas.
2. **Ciclos de Sueño REM y Plasticidad:** Los organismos experimentan fases naturales de vigilia (exploración activa) y reposo en el Santuario (replay episódico fuera de línea), evitando la catástrofe de saturación sináptica.
3. **Química de Bienestar y Fick 5D:** La inclusión de `SEROTONIN` modula los estados afectivos hacia `SERENITY` y `TRANSCENDENCE`, reduciendo el conflicto y potenciando la inteligencia colectiva.


