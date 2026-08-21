# 🛡️ RED v53.0.0 — Canonical Identity, Shake & Pair & Tactical Binary Edition

¡Bienvenido a la versión **v53.0.0** de **RED (Sovereign Mesh OS)**! Esta versión introduce una profunda optimización de almacenamiento (-83% de peso de APK), unificación universal de identidades criptográficas DID, protocolo nativo P2P para Shake-to-Pair y soporte verificado de modelos de lenguaje local.

---

### 🚀 Principales Mejoras y Novedades de la v53.0.0

#### 1. 🆔 Arquitectura de Identidades Canónicas Universales y Deduplicación
- **Preservación de Direcciones MAC**: Corrección integral en la sanitización de identificadores (`meshRouter.ts`, `useRedStore.ts`, `api.ts`, `ChatWindow.tsx`), evitando el truncamiento de direcciones BLE (`58:24:29:4F:33:1B`) y garantizando la vinculación bidireccional entre el ID de hardware y el DID criptográfico de 64 caracteres.
- **Fusión Inteligente de Contactos**: `addContact()` y `onIdentityResolved` detectan coincidencias por hash, clave pública, prefijo de 8 caracteres y alias no genérico, migrando conversaciones activas en caliente sin generar tarjetas duplicadas ni chats fantasma.

#### 2. 📳 Protocolo Nativo P2P para Shake-to-Pair (Acelerómetro)
- **Difusión Multi-Radio**: Sustitución del stream SSE local por paquetes binarios `SHAKE_PAIR_BROADCAST` y `SHAKE_PAIR_ACCEPT` transmitidos en tiempo real sobre BLE, Wi-Fi Direct y WebRTC.
- **Calibración Inercial & Háptica**: Detección de fuerza G vectorial dinámica (compensando la gravedad terrestre), vibración de confirmación (`navigator.vibrate`) y botón táctico de pulso manual.

#### 3. 🧠 Modelos de Lenguaje Local 100% Operativos
- **SmolLM2 360M Instruct**: Corrección de endpoint GGUF a la cuantización verificada `SmolLM2-360M-Instruct-Q4_K_M.gguf` (230 MB) con tokenizer público activo.
- **Llama 3.2 1B y Gemma 2B**: Corrección de tokenizers a repositorios públicos abiertos sin restricciones de credenciales ni error HTTP 401.

#### 4. ⚡ Desfragmentador BLE GATT y Decodificación Flexible
- **Buffer de Reensamblado**: `bluetoothTransport.ts` ensambla paquetes fragmentados por el MTU de Android antes de procesarlos en el enrutador de malla.
- **Prefijos de Longitud Dinámicos**: `meshProtocol.ts` y `meshRouter.ts` decodifican indistintamente tramas con y sin prefijo de 4 bytes.

#### 5. 📦 Optimización Extrema del APK (209 MB)
- Saneamiento completo del empaquetado y reemplazo de binarios antiguos de 1.2 GB.
- Binarios sincronizados en raíz, `assets/`, `release-assets/` y `docs/assets/`.

---

### 📦 Archivos Binarios de la Versión
- **`red-v53.0.0.apk`**: Instalador APK de la versión v53.0.0 (209.1 MB).
- **`red-latest.apk`**: Enlace canónico de última versión estable.

---

### 🌐 Acceso Web PWA
- Versión Web interactiva: **[https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)**

