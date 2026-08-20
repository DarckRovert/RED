# 🏗️ Especificación Arquitectónica de RED v38.0.0 (Sovereign Master)

Este documento contiene la especificación arquitectónica detallada de **RED**, incluyendo la estructura del motor Rust nativo, la capa de bindings JNI para Android, los transportes de radio de hardware, el motor de respaldo soberano 1-Toque, la suite Web3 MetaMask y los 38 módulos tácticos.

---

## 📋 Tabla de Contenidos

1. [Visión General de Capas](#1-visión-general-de-capas)
2. [Capa Nativa Android & Actuadores Hardware](#2-capa-nativa-android--actuadores-hardware)
3. [Motores de Infraestructura Táctica](#3-motores-de-infraestructura-táctica)
4. [Motor Criptográfico Nativo & Post-Cuántica (PQC)](#4-motor-criptográfico-nativo--post-cuántica-pqc)
5. [Suite de Respaldo Soberano & Sincronización Automática](#5-suite-de-respaldo-soberano--sincronización-automática)
6. [Puente Web3, Tokenomics DePIN & MetaMask](#6-puente-web3-tokenomics-depin--metamask)
7. [Capa de Red Mesh Multi-Radio & Conectividad Global](#7-capa-de-red-mesh-multi-radio--conectividad-global)
8. [Desglose de los 38 Módulos Tácticos](#8-desglose-de-los-38-módulos-tácticos)
9. [Interoperabilidad PC Web SPA y Nodos Móviles](#9-interoperabilidad-pc-web-spa-y-nodos-móviles)

---

## 1. Visión General de Capas

```
+-----------------------------------------------------------------------+
|                    CAPA DE PRESENTACIÓN (FRONTEND)                    |
|      Next.js 16 SPA (Turbopack) + React 19 + Zustand Store + CSS      |
|           38 Módulos de Interfaz Táctica & Visualización UI           |
+-----------------------------------------------------------------------+
                                   │
              HTTP REST / SSE (http://127.0.0.1:7333/api)
                                   ▼
+-----------------------------------------------------------------------+
|                    CAPA NATIVA ANDROID (MIDDLEWARE)                   |
|       RedNodeService.java (Foreground) + RedNodePlugin.java (JNI)     |
|   Camera2 API (Flash LED Morse SOS) + Sensors (Barometer, Compass)    |
|   SecureStoragePlugin (Keystore TEE) + Share + Filesystem SAF         |
+-----------------------------------------------------------------------+
                                   │
                          JNI Bindings (Rust C-ABI)
                                   ▼
+-----------------------------------------------------------------------+
|                      MOTOR NATIVO RUST (CORE)                         |
|     red_mobile (Axum REST API + SSE) + red_core (Protocol Engine)    |
|   Noise XK Handshake + Ed25519 Signatures + ChaCha20-Poly1305 E2E     |
|     red-blockchain (Proof-of-Stake & Slashing) + SQLite Storage       |
+-----------------------------------------------------------------------+
                                   │
              TRANSPORTE MULTI-RADIO AD-HOC OFF-GRID & GLOBAL
       +---------------------+---------------+--------------------+
       | BLE GATT (Physical) | WiFi Direct   | LoRa 915MHz / Sound|
       +---------------------+---------------+--------------------+
       | libp2p Kademlia DHT | Circuit Relay | DoH / SNI Tunnels  |
       +---------------------+---------------+--------------------+
```

---

## 2. Capa Nativa Android & Actuadores Hardware

- **`RedNodeService.java`**: Servicio en primer plano (*Foreground Service*) que registra un canal de notificaciones persistente (`f.red.app.NODE_SERVICE`) para evitar que el sistema operativo suspenda el nodo en segundo plano.
- **`RedNodePlugin.java`**: Expone la interfaz JNI a `libred_mobile.so`, monitorea el acelerómetro (`Sensor.TYPE_ACCELEROMETER`) para agitación destructiva (*Shake-to-Destroy*) y modula el Flash LED en código Morse.
- **`RedDisguisePlugin.java`**: Permite cambiar dinámicamente el icono y nombre de la aplicación a una Calculadora funcional mediante `Activity-Alias` en tiempo de ejecución.
- **`SecureStoragePlugin`**: Almacena el PIN Maestro y claves de sesión en el chip de seguridad **Android KeyStore (StrongBox / TEE)**.

---

## 3. Motores de Infraestructura Táctica

1. **`LowBitrateVocoder.ts`**: Procesamiento de señal digital (DSP) que digitaliza audio a 8kHz IMA-ADPCM (1.6 a 3.2 kbps), logrando un **-97.9% de compresión** para transmitir notas de voz por radio Bluetooth.
2. **`MeshProofOfWork.ts`**: Prueba de trabajo Hashcash SHA-256 descentralizada en cada paquete para mitigar ataques Sybil y DDoS sin servidores.
3. **`KineticDutyGovernor.ts`**: Gobernador cinético que adapta los intervalos de baliza BLE al nivel de batería, extendiendo la autonomía hasta **48 horas continuas**.
4. **`StateIntegrityEngine.ts`**: Verificación Merkle SHA-256 local para garantizar la consistencia de los datos en disco tras cortes repentinos de energía.

---

## 4. Motor Criptográfico Nativo & Post-Cuántica (PQC)

- **ML-KEM-768 (FIPS 203)**: Encapsulamiento post-cuántico basado en retículos algebraicos (M-LWE) con 256 bits de seguridad cuántica.
- **Noise XK Dual Hybrid**: Combina ML-KEM-768 con Diffie-Hellman elíptico (X25519) en cada sesión.
- **Cifrado Simétrico Autenticado**: AES-256-GCM y ChaCha20-Poly1305.
- **Firmas Digitales**: Ed25519.

---

## 5. Suite de Respaldo Soberano & Sincronización Automática

- **Derivación de Clave Zero-Friction**: Genera la clave simétrica AES-256-GCM a partir del PIN Maestro del Keystore y sal criptográfica sin requerir contraseñas adicionales.
- **Sincronización Inteligente**: Guarda snapshots cifrados en segundo plano en Google Drive mediante Android Storage Access Framework (SAF) y `@capacitor/share`.
- **Anclaje IPFS Web3**: Calcula el CIDv1 determinista SHA-256 (`bafybeic...`) para custodia en redes descentralizadas.
- **Frase Semilla BIP-39**: Genera 12 palabras mnemónicas para restauración matemática sin archivos.

---

## 6. Puente Web3, Tokenomics DePIN & MetaMask

- **EIP-1193 / EIP-712**: Vinculación criptográfica bidireccional entre la identidad soberana `did:red:<hash>` y direcciones públicas EVM (`0x...`).
- **Proof-of-Relay (PoR)**: Recompensas en micro-créditos $RED por retransmitir paquetes en la malla.
- **Vouchers Offline Ed25519**: Vales de pago firmados digitalmente para transaccionar sin internet con prevención de doble gasto.
- **Liquidez Fiat**: Ruta de conversión a Dólares Digitales (USDT) en Uniswap y a Soles Peruanos (PEN) vía P2P (Yape/Plin/BCP).

---

## 7. Capa de Red Mesh Multi-Radio & Conectividad Global

- **Malla Local Off-Grid**: Bluetooth LE 5.0 (GATT Client/Server) + Wi-Fi Direct.
- **Malla Global**: Nodos Bootstrap oficiales de Libp2p/IPFS (`bootstrap.libp2p.io`), Kademlia DHT y relés Circuit v2 para cruce de NAT celular.

---

## 8. Desglose de los 38 Módulos Tácticos

1. `ChatWindow`: Mensajería P2P cifrada E2EE.
2. `Sidebar`: Navegación y radar de contactos.
3. `SecurityPanel`: Estado de seguridad y claves.
4. `RadarWindow`: Visualización de nodos en malla.
5. `CallScreen`: Llamadas de voz WebRTC de baja tasa de bits.
6. `BroadcastPanel`: Mensajes de difusión masiva.
7. `CryptoPanel`: Cifrado PQC y firmas.
8. `GroupsPanel`: Grupos de comunicación cerrados.
9. `StatusView`: Estado del nodo y telemetría.
10. `BlockchainExplorer`: Explorador de bloques y transacciones.
11. `AuthWall`: Bloqueo biométrico y primer arranque.
12. `NodeMap`: Mapa de geolocalización de nodos.
13. `NetworkPanel`: Configuración de IP y multiaddrs.
14. `OnboardingProfile`: Creación de identidad.
15. `DMSSettings`: Interruptor de hombre muerto.
16. `AmberAdminPanel`: Alertas de emergencia comunitarias.
17. `GuardianStatusPanel`: Cortafuegos de paquetes.
18. `P2PCompassModal`: Brújula táctica hacia peers.
19. `PublicChannelsPanel`: Canales públicos por radio.
20. `SocialFeedPanel`: Tablón de anuncios descentralizado.
21. `P2PWalkieTalkieModal`: Walkie-Talkie Push-to-Talk.
22. `WeatherAlertPanel`: Barómetro y alertas meteorológicas.
23. `IdentityVaultModal`: Bóveda DID soberana.
24. `ProximityWaveModal`: Radar de proximidad ultra-cercana.
25. `LiveCanvasModal`: Pizarra táctica colaborativa en vivo.
26. `EcoMeshPanel`: Monitoreo de ahorro de batería.
27. `ProximitySettingsModal`: Ajustes de radio BLE.
28. `AICopilotModal`: Asistente de IA offline en dispositivo.
29. `NearbyDevicesPanel`: Detección de dispositivos vecinos.
30. `LiveStreamBroadcaster`: Transmisión de video P2P.
31. `OffGridCompassModal`: Navegación sin satélites GPS.
32. `VitalScanModal`: Triaje START y signos vitales.
33. `SurvivalBeaconModal`: Baliza de rescate acústica y óptica.
34. `RfSpectrumModal`: Analizador de espectro electromagnético.
35. `StegoVaultModal`: Esteganografía en imágenes.
36. `RedP2PPayModal`: Pagos P2P y vouchers offline.
37. `BackupRestoreModal`: Respaldo en 1 toque y nube.
38. `Web3VaultModal`: Conexión MetaMask y Tokenomics.

---

## 9. Interoperabilidad PC Web SPA y Nodos Móviles

- La versión Web SPA ([RedShowcaseLanding.tsx](file:///d:/PROYECTO%20RED/client/app/src/components/RedShowcaseLanding.tsx)) permite a usuarios en navegadores de PC (Chrome, Firefox, Edge, Safari) ingresar con un alias rápido y conectarse a la red mediante WebRTC DataChannels y pasarelas de señalización, manteniendo comunicación bidireccional en tiempo real con usuarios en dispositivos móviles Android.
