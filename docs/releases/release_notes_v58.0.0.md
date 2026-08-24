# RED — Sovereign Mesh OS v58.0.0
> **Build Code:** `58000` | **Release Channel:** `stable-p2p` | **Protocol Version:** `RED/58.0-NOISE-PQC-BIO`

Plataforma táctica de comunicaciones descentralizadas y soberanas fuera de red (Off-Grid) con criptografía post-cuántica (ML-KEM-768 / FIPS 203), canales E2E Double Ratchet, enrutamiento en malla P2P multi-radio (BLE + WiFi Direct + WebRTC + LoRa + SoundMesh), llaves biométricas universales y seguridad Zero-Trust de nivel militar.

---

## [58.0.0-canonical-mesh-dedup] - 2026-08-23

### Sovereign Tactical Master Edition — Universal Biometric Sentinel, Zero-Trust Hardening & Canonical Mesh Deduplication

**Sistema Universal de Llaves Biométricas & Passkeys Multiplataforma**
- `BiometricLockEngine.ts`: Detección en vivo de hardware biométrico (Huella dactilar, Reconocimiento facial, Escáner de iris, Windows Hello, Touch ID / Face ID y Passkeys WebAuthn). Integración con Web Crypto API (`navigator.credentials`) y retos criptográficos locales vinculados al `master_pin`.
- `AuthWall.tsx`: Teclado táctico inteligente con botón biométrico dedicado, auto-disparo configurable, asistente de enrolamiento post-onboarding en 1 clic y conmutación fluida al PIN de 6 dígitos ante cancelaciones o bloqueos del OS.
- `PrivacyTab.tsx`: Insignia de hardware en vivo, selector de tiempo de auto-bloqueo por inactividad (`Inmediato`, `1m`, `5m`, `15m`) e interruptor para deshabilitar auto-prompt como medida anti-coacción.
- `AndroidManifest.xml`: Declaración de permisos `USE_BIOMETRIC` y `USE_FINGERPRINT` con características de hardware opcionales (`fingerprint`, `biometrics.face`, `biometrics.iris`).

**Seguridad Zero-Trust & Blindaje de Almacén Criptográfico en Rust**
- `core/src/storage/mod.rs` & `red_mobile/src/lib.rs`: Implementación de `try_get_identity` y `has_raw_entry`. Si la base de datos Sled contiene una identidad y la clave derivada del PIN no la desencripta, el nodo aborta con error fatal (`FATAL: Storage decryption failed — Incorrect PIN`), erradicando la creación de identidades efímeras.
- `red_mobile/src/lib.rs` & `node/src/main.rs`: Enlace estricto del servidor Axum a Loopback `127.0.0.1:7333`, imposibilitando accesos externos desde la red LAN.
- `network_security_config.xml`: Restricción global de tráfico en texto plano exclusivamente a `127.0.0.1` y `localhost`.
- `meshRouter.ts`: Exigencia de coincidencia estricta de `message_id` y `nonce` en el procesamiento de confirmaciones de entrega (`DELIVERY_ACK`).
- `sensors.ts` & `economy.ts`: Erradicación total de valores simulados/mocks en lecturas de sensores y saldos de billetera.

**Deduplicación Canónica Universal de Nodos & Normalización de Identidades**
- `meshRouter.ts`: Normalización integral de identificadores (`clean.toLowerCase()`, prefijos `did:red:` y hardware MACs). Implementación de la heurística `isNameSimilar` para correlacionar nombres Bluetooth de fabricante con alias de perfil táctico.
- `localTransport.ts`: Deduplicación case-insensitive de balizas BLE en `performBleScan()`, vinculación proactiva `autoAssociateBlePeer()` y resolución de pares con `getPeerByAnyId()`.
- `NearbyDevicesPanel.tsx`: Sustitución de listas separadas por `UnifiedDeviceMap` de pase único con insignias `[BLE]` y `[WIFI]`, botón `💬 Chat` y navegación directa al DID canónico.
- `RadarWindow.tsx`: Enrutamiento estricto al DID canónico de 64 caracteres SHA-256 en `handleAddPeer`.

**Optimización Extrema de IA, Compresión de Assets & Gobernador Cinemático**
- `aaptOptions`: Compresión de activos estáticos y pesos neuronales en Gradle, reduciendo el binario APK en más de 67 MB sin eliminar ninguna de las 3 inteligencias locales (RAG semántico, Guardian firewall y Copilot conversacional).
- `fec.rs`: Implementación de Forward Error Correction (FEC) con matriz generadora Cauchy sobre GF(256) para fragmentación de llaves post-cuánticas ML-KEM-768 (1,184 bytes), permitiendo reconstrucción matemática completa con hasta un 25% de pérdida de paquetes en el aire.
- `KineticDutyGovernor.ts` & `localTransport.ts`: Gobernador cinemático que modula el ciclo de escaneo BLE según el acelerómetro de hardware (1 sondeo/30s en reposo vs 1 sondeo/3s en movimiento), extendiendo la autonomía hasta 48 horas continuas.

---

## Binarios Oficiales para Descarga Directa

| Archivo | Descripción | Plataforma | Suma SHA-256 |
| :--- | :--- | :--- | :--- |
| **`red-v58.0.0-latest.apk`** | Instalador Universal Oficial v58.0.0 (Sideloading + P2P Transfer + Neural HUD) | Android 7.0+ (ARM64) | `83b91389857367ee6e7d344e9a950285ad793b4ec1d198543fff793d87d3525e` |
| **`red-latest.apk`** | Enlace canónico de última versión | Android 7.0+ (ARM64) | `83b91389857367ee6e7d344e9a950285ad793b4ec1d198543fff793d87d3525e` |
| **`red-node.exe`** | Binario de Escritorio (Desktop Node) | Windows x64 | `7c4f5e8666eaab56c4d9a0afb0ca123c150c2662f075d3381bef62ce2d6b902f` |

> **Web App Oficial:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
