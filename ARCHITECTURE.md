# 🛡️ RED OS v98.0.0 — Arquitectura Técnica & Especificación Planetaria

> Documento maestro de ingeniería de software y especificación arquitectónica de **RED (Red Criptográfica Off-Grid & P2P Mesh)**. Describe en detalle la topología de capas, los protocolos criptográficos híbridos post-cuánticos, la coordinación espectral LoRa TDMA, el enrutamiento geoespacial Geohash DTN, la flota de repetidores solares autónomos ESP32-S3 y el catálogo consolidado de 62 módulos y modales tácticos.

---

## 📋 Índice General

1. [Mapa Visual 1: Topología Global del Sistema & Conexión de Capas](#1-mapa-visual-1-topología-global-del-sistema--conexión-de-capas)
2. [Mapa Visual 2: Flujo Criptográfico Híbrido Post-Cuántico (ML-KEM-768 + Double Ratchet)](#2-mapa-visual-2-flujo-criptográfico-híbrido-post-cuántico)
3. [Mapa Visual 3: Autenticación Soberana, Biometría TEE/WebAuthn & Bóveda Cifrada](#3-mapa-visual-3-autenticación-soberana-biometría-teewebauthn--bóveda-cifrada)
4. [Mapa Visual 4: Matriz de Enrutamiento Mesh Multi-Transporte & Protocolo ACKs](#4-mapa-visual-4-matriz-de-enrutamiento-mesh-multi-transporte--protocolo-acks)
5. [Mapa Visual 5: Motor de Inteligencia Artificial Offline & Guardian Security Firewall](#5-mapa-visual-5-motor-de-inteligencia-artificial-offline--guardian-security-firewall)
6. [Mapa Visual 6: Enrutamiento Geoespacial Geohash & Poda DTN (IndexedDB v2)](#6-mapa-visual-6-enrutamiento-geoespacial-geohash--poda-dtn)
7. [Mapa Visual 7: Coordinación Espectral LoRa TDMA (Supertrama 2000ms & CSMA/CA)](#7-mapa-visual-7-coordinación-espectral-lora-tdma)
8. [Mapa Visual 8: Flota de Repetidores Solares Autónomos ESP32-S3 & Hardware SX1262](#8-mapa-visual-8-flota-de-repetidores-solares-autónomos-esp32-s3)
9. [Resumen de Componentes, Crates & Firmware del Workspace](#9-resumen-de-componentes-crates--firmware-del-workspace)

---

## 1. Mapa Visual 1: Topología Global del Sistema & Conexión de Capas

El ecosistema RED opera bajo una arquitectura desacoplada de 6 capas horizontales con aislamiento estricto de memoria y enlaces de comunicación IPC seguros:

```mermaid
graph TD
    subgraph CAPA_1_PRESENTACION ["1. CAPA DE PRESENTACIÓN (Frontend UI / UX)"]
        UI_SPA["Next.js 16 SPA (Turbopack + React 19)"]
        CSS_TOKENS["Vanilla CSS Tactical Tokens (HUD Cyberpunk)"]
        MOD_CATALOG["62 Módulos & Pantallas Tácticas Consolidadas"]
        UI_SPA --> CSS_TOKENS
        UI_SPA --> MOD_CATALOG
    end

    subgraph CAPA_2_ESTADO ["2. CAPA DE GESTIÓN DE ESTADO (Zustand Slices)"]
        Z_AUTH["authSlice.ts (Sesión & Vault)"]
        Z_CHAT["chatSlice.ts (Mensajes & Hilos)"]
        Z_CONTACTS["contactsSlice.ts (Directorio Canónico)"]
        Z_EMERGENCY["emergencySlice.ts (SOS & Triaje)"]
        Z_SOCIAL["socialSlice.ts (Feed P2P & Canales)"]
        DISPATCHER["messageDispatcher.ts (Enrutador de Eventos)"]
        
        Z_AUTH --> DISPATCHER
        Z_CHAT --> DISPATCHER
        Z_CONTACTS --> DISPATCHER
        Z_EMERGENCY --> DISPATCHER
        Z_SOCIAL --> DISPATCHER
    end

    subgraph CAPA_3_PUENTE ["3. CAPA DE PUENTE NATIVO & SERVICIOS (Android / Desktop)"]
        CAP_BRIDGE["Capacitor 8.2 Runtime"]
        JNI_PLUGIN["RedNodePlugin.java (JNI Bridge)"]
        BG_SERVICE["RedNodeService.java (Foreground Service 24/7)"]
        SEC_STORE["SecureStoragePlugin (Android KeyStore / TEE)"]
        
        CAP_BRIDGE --> JNI_PLUGIN
        CAP_BRIDGE --> SEC_STORE
        BG_SERVICE --> JNI_PLUGIN
    end

    subgraph CAPA_4_SERVIDOR ["4. CAPA DE SERVIDOR LOCAL & SEGURIDAD ZERO-TRUST"]
        AXUM_SRV["Servidor Axum (Loopback 127.0.0.1:7333)"]
        AUTH_MW["validate_auth_async (X-API-Key Middleware)"]
        SSE_STREAM["Server-Sent Events (/api/events & /outbound)"]
        REST_ROUTES["Router REST (/api/messages, /contacts, etc.)"]
        
        AXUM_SRV --> AUTH_MW
        AUTH_MW --> SSE_STREAM
        AUTH_MW --> REST_ROUTES
    end

    subgraph CAPA_5_RUST_CORE ["5. NÚCLEO RUST & BASE DE DATOS CIFRADA (red_core)"]
        RUST_STORAGE["Storage Engine (Sled DB con Cifrado Simétrico)"]
        RUST_CRYPTO["Crypto Engine (ML-KEM-768 + AES-256-GCM)"]
        RUST_IDENTITY["Identity Manager (did:red: + Proof-of-Work)"]
        RUST_MESH["Mesh Router (Gossipsub + Onion Routing + Kademlia)"]
        RUST_BLOCKCHAIN["red_blockchain (PoS Validators & Mempool)"]
        
        RUST_STORAGE <--> RUST_CRYPTO
        RUST_CRYPTO <--> RUST_IDENTITY
        RUST_IDENTITY <--> RUST_MESH
        RUST_MESH <--> RUST_BLOCKCHAIN
    end

    subgraph CAPA_6_HARDWARE ["6. CAPA DE HARDWARE & TRANSMISORES DE RADIO"]
        BLE_RADIO["Bluetooth LE GATT (HCI Directo)"]
        WIFI_RADIO["WiFi Direct & WebRTC P2P DataChannels"]
        TDMA_LORA["LoRa TDMA Scheduler (SX1262 915 MHz / 868 MHz)"]
        SOLAR_FLEET["Repetidores Solares Autónomos ESP32-S3"]
        SOUND_MODEM["SoundMesh (Módem Acústico Ultrasónico 18-20 kHz)"]
        WAN_DHT["Internet WAN (Kademlia DHT + Bootstrap Peers)"]
        
        TDMA_LORA <--> SOLAR_FLEET
    end

    CAPA_1_PRESENTACION <-->|"Zustand Hooks / Dispatch"| CAPA_2_ESTADO
    CAPA_2_ESTADO <-->|"HTTP REST & SSE Events"| CAPA_4_SERVIDOR
    CAPA_3_PUENTE <-->|"Carga libred_mobile.so"| CAPA_5_RUST_CORE
    CAPA_4_SERVIDOR <-->|"Async State & Tokio Channels"| CAPA_5_RUST_CORE
    CAPA_5_RUST_CORE <-->|"Controladores de Radio & Sockets"| CAPA_6_HARDWARE
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

## 7. Mapa Visual 7: Coordinación Espectral LoRa TDMA

El planificador `LoRaTdmaSchedulerEngine` organiza el espectro sub-GHz en supertramas periódicas de 2000 ms divididas en 10 slots de 200 ms, eliminando colisiones en concentraciones masivas de operadores:

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
    Slot 8 (Baliza / Clock Sync) :1600, 1800

    section Contienda
    Slot 9 (CSMA/CA Backoff)    :1800, 2000
```

- **Slots 0–7 (Deterministas):** Asignados de forma matemáticamente reproducible según el DID del nodo. Cero colisiones entre nodos con slots distintos.
- **Slot 8 (Baliza & Sincronización):** Transmisión de metadatos de sincronización temporal y topología de red.
- **Slot 9 (Contienda Dinámica):** Acceso aleatorio mediante CSMA/CA con retroceso exponencial (*exponential backoff*) para nodos transitorios.
- **Bypass de Emergencia SOS (Prioridad >= 9):** Interrumpe de inmediato cualquier supertrama en curso y transmite ráfagas de socorro al aire sin demoras de slot.

---

## 8. Mapa Visual 8: Flota de Repetidores Solares Autónomos ESP32-S3

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
        RX_IRQ["Interrupción RX LoRa"] --> READ_HEADER["Leer Cabecera RED 96 Bytes"]
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

## 9. Resumen de Componentes, Crates & Firmware del Workspace

| Componente | Lenguaje / Framework | Responsabilidad Principal | Ubicación |
|---|---|---|---|
| **`red_core`** | Rust (1.80+) | SSOT de modelos de protocolo táctico (`red_core::protocol::tactical`), criptografía post-cuántica, enrutamiento mesh, identidades soberanas. | [core/](core/) |
| **`red_mobile`** | Rust + JNI | Biblioteca dinámica nativa (`libred_mobile.so`) para Android con servidor Axum embebido. | [red_mobile/](red_mobile/) |
| **`red_node`** | Rust | Binario ejecutable de escritorio (`red-node.exe`) con CLI, nodo validador y servidor local. | [node/](node/) |
| **`red_blockchain`** | Rust | Libro mayor distribuido, consenso Proof-of-Stake, validadores y mempool de transacciones. | [blockchain/](blockchain/) |
| **`client/app`** | Next.js 16 + React 19 | Interfaz táctica SPA (62 modales tácticos), Zustand Slices modulares, WebAuthn Passkeys, Capacitor bridge y LoRa TDMA Engine. | [client/app/](client/app/) |
| **`firmware/esp32-repeater`** | C++ (PlatformIO / RadioLib) | Firmware para repetidores solares autónomos de campo con microcontrolador ESP32-S3 y transceptor Semtech SX1262. | [firmware/esp32-repeater/](firmware/esp32-repeater/) |
| **`signaling`** | Node.js | Servidor de señalización WebRTC zero-knowledge y relé ciego para conexiones P2P. | [signaling/](signaling/) |
| **`proofs`** | ProVerif | Modelos matemáticos formales de verificación de seguridad, secreto perfecto y anonimato. | [proofs/](proofs/) |
| **`specs`** | TLA+ | Especificación formal del protocolo de consenso y tolerancia a fallos bizantinos. | [specs/](specs/) |
