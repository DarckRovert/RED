# RED v117.0.0 — Resiliencia Táctica & Blindaje P2P de Grado Militar

**Fecha de Release:** 2026-09-21  
**Build Code:** 117000  
**SHA-256:** (ver SHA256SUMS.txt)

---

## 🛡️ Nuevas Capacidades y Fortalecimiento Arquitectónico

### Blindaje P2P de Grado Militar & Resiliencia de Enjambre
- **Normalización Canónica de Identidades:** Unificación del espacio de direcciones P2P (`peer_`, MAC addresses, IPs loopback y Device Names) eliminando particionamiento en enjambres heterogéneos.
- **WebRTC Perfect Negotiation con Gracia Transitoria:** Eliminación de colisiones de ofertas SDP en enlaces bidireccionales con ventana de gracia de 5 segundos para reconexiones instantáneas sin pérdida de canal.
- **BLE Mesh MTU Adaptativo:** Negociación dinâmica de fragmentos MTU con retroceso automático para interoperabilidad total en hardware Android periférico.
- **TDMA Clock Skew PLL v117.0.0:** Sincronización precisa de ranuras de tiempo LoRa a prueba de derivas de reloj y fluctuaciones de temperatura.
- **Geohash Spatial Pruning:** Enrutamiento espacial con corrección de continuidad en fronteras de celdas para evitar pérdida de paquetes en límites de cuadrante.

### Navegación Táctica & Cero Falsos Saltos (PDR)
- **Erradicación de "Null Island" (0,0):** Inicialización segura en `PdrEngine.ts` evitando saltos anómalos a coordenadas cero ante pérdidas momentáneas de GNSS.
- **Filtro de Kalman Resiliente:** Prevención de inflación de matriz de covarianza durante periodos de inmovilidad estática con deadband cinemático.
- **Renderizado Táctico a 60 FPS:** Visualización fluida en `NodeMap.tsx` con clustering eficiente de nodos sin sobrecargar la GPU en terminales de recursos limitados.

### Comunicaciones Críticas, Audio Táctico & SOS
- **Audio de Voz Mesh No Bloqueante:** Procesamiento asíncrono en buffers de audio que previene congelamiento del hilo UI durante transmisiones PTT en ráfaga.
- **Jitter Buffer Adaptativo:** Supresión de microcortes y desfases en ráfagas de audio táctico `P2P_VOICE_BURST`.
- **Inmutabilidad de Alertas SOS:** Registro criptográfico y persistencia atómica en `MeshSosBeaconEngine.ts`, asegurando propagación garantizada a todos los nodos del enjambre sin duplicados.

### Inteligencia Local & Ciberdefensa
- **RAG Local Sub-5ms con Cuantización INT8:** Búsqueda vectorial semántica ultra-rápida en memoria para consultas tácticas y de supervivencia sin acceso a internet.
- **Negación Plausible (Deniable Duress):** Aislamiento estricto y almacenamiento señuelo ante coerción, preservando las claves raíz soberanas en bóveda cifrada.
- **Defensa Anti-Replay Ed25519:** Verificación matemática de marcas de tiempo y noce único en cada paquete táctico recibido por radio.

---

## 🐛 Registro de 20 Correcciones Críticas (BUG-01 a BUG-20)

| ID | Componente | Descripción de la Causa Raíz y Solución |
|----|------------|------------------------------------------|
| **BUG-01** | `wifiDirectTransport.ts` | Normalización de identificadores de nodo para prevenir partición de malla. |
| **BUG-02** | `wifiDirectTransport.ts` | Control de concurrencia y prevención de bucles de reconexión infinita. |
| **BUG-03** | `wifiDirectTransport.ts` | Cierre higiénico de sockets TCP/UDP evitando fugas de descriptores de archivo. |
| **BUG-04** | `PdrEngine.ts` | Supresión de coordenadas (0,0) cuando no hay fix GNSS válido. |
| **BUG-05** | `KalmanFilter.ts` | Límite superior a la matriz de covarianza para evitar singularidades numéricas. |
| **BUG-06** | `MeshSosBeaconEngine.ts` | Persistencia inmutable de eventos SOS en disco y RedStore. |
| **BUG-07** | `EmergencyBanner.tsx` | Desuscripción higiénica de listeners evitando memory leaks y fugas de contexto. |
| **BUG-08** | `AudioStreamEngine.ts` | Procesamiento fuera del hilo principal para compresión de ráfagas PTT. |
| **BUG-09** | `VoiceMeshEngine.ts` | Compensación de fluctuaciones temporales mediante Jitter Buffer adaptativo. |
| **BUG-10** | `StoreAndForward.ts` | Purga FIFO bajo umbral de memoria para prevenir saturación en colas de reenvío. |
| **BUG-11** | `meshProtocol.ts` | Alineación estricta de ordenamiento de bytes (Endianness) en serialización. |
| **BUG-12** | `TdmaScheduler.ts` | Corrección de desfases de ranuras temporales LoRa mediante PLL de software. |
| **BUG-13** | `GeohashRouter.ts` | Enrutamiento perimetral continuo en vecindades de cuadrantes Geohash. |
| **BUG-14** | `WebRtcTransport.ts` | Resolución determinista de colisión de ofertas SDP con gracia de 5 segundos. |
| **BUG-15** | `BleMeshTransport.ts` | Ajuste elástico de MTU BLE previniendo cierres abruptos de conexión GATT. |
| **BUG-16** | `RagVectorStore.ts` | Optimización de vectores tácticos con enteros de 8 bits para latencia sub-5ms. |
| **BUG-17** | `SatelliteBridge.ts` | Cálculo de desplazamiento Doppler y propagación orbital LEO sin desbordamiento. |
| **BUG-18** | `DuressPlausibleDeniability.ts` | Cifrado y regeneración atómica del entorno de coacción. |
| **BUG-19** | `NodeMap.tsx` | Optimización de pintado reactivo y minimización de re-renders innecesarios. |
| **BUG-20** | `SecurityAuditEngine.ts` | Validación criptográfica de firmas Ed25519 y rechazo estricto de paquetes retransmitidos. |

---

## ✅ Suite de Verificación de Integridad

| Verificación | Estado |
|--------------|--------|
| `pre_build_check.js` | **100% Paridad (17/17 SSOT @ v117.0.0)** |
| `check_release_integrity.js` | **27/27 Pasados (0 Errores, 0 Advertencias)** |
| TypeScript Compiler (`tsc --noEmit`) | **0 Errores** |
| Compilación APK Release | **Compilado y firmado con `red-release.keystore` (4096-bit)** |
| Integridad SHA-256 | **Sincronizado en `SHA256SUMS.txt` y `version.ts`** |

---

## 📦 Despliegue e Instalación

```bash
# Instalación directa en Android mediante ADB:
adb install -r -d release-assets/red-v117.0.0-release.apk

# Acceso Web Soberano (PWA / SPA):
https://darckrovert.github.io/RED/
```

**Checksum SHA-256 Canónico:** Ver `SHA256SUMS.txt` adjunto.
