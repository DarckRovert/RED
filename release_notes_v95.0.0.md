# 🛡️ RED Sovereign Mesh OS — Release v95.0.0 (Hardened Tactical Mesh & Sovereign Resilience Edition)

## 🌟 Aspectos Destacados de la Versión v95.0.0

Esta versión consolida la estabilidad de grado táctico y operativo de **RED OS**, integrando resolución exhaustiva de fugas de recursos, sincronización estricta de localización en 12 idiomas, pila de navegación LIFO protegida contra pérdida de contexto, y certificación dual en hardware físico real (Motorola Moto G22 y Lenovo Tablet).

---

### 1. Endurecimiento Arquitectónico y Ciclo de Vida Frontend
- **Pila de Navegación LIFO & Registro Canónico de Overlays:** Exportación e integración del registro canónico `OVERLAY_SCREENS` (42 pantallas modales) en `uiSlice`, garantizando que abrir o cerrar capas superpuestas (radares, búnkeres, sensores, terminales de radio) no purgue el identificador de conversación activa (`activeConversationId`).
- **Erradicación de Fugas Asíncronas en Modales Tácticos:** Implementación de banderas de montaje atómico (`isMounted = false`) y desuscripción de flujos cinemáticos y sensoriales en desmontaje rápido para:
  - `ExtremeSurvivalHudModal`
  - `VitalScanModal`
  - `TacticalFoxhuntModal`
  - `CelestialPdrModal`
  - `AirGapStegoModal`
- **Gestión Estricta de AudioContext:** Cierre explícito de hardware de audio (`audioCtx.close()`) en `LoraTransceiverModal` para prevenir bloqueos de códec de hardware en dispositivos Android de recursos ajustados.
- **Renders Puros React 19:** Corrección de callbacks impuros y estado perezoso en `CallsHistoryView` y `CallScreen`.
- **Paridad Lingüística Absoluta (12 Idiomas):** Sincronización al 100% (737/737 claves idénticas) a través de todos los esquemas de traducción: español, inglés, alemán, francés, italiano, portugués, ruso, árabe, japonés, coreano, chino y quechua.

---

### 2. Suite de Validación de Resiliencia Táctica (87/87 Pruebas Aprobadas)
- **100% Success Rate:** La suite completa de 87 scripts de prueba automatizados en `client/app/scripts/` pasa sin fallos ni regresiones:
  - Criptografía poscuántica (Kyber/Dilithium/ML-KEM) y bóvedas Shamir Secret Sharing.
  - Puentes LoRa Meshtastic, radioesteganografía acústica, túneles encubiertos y protocolos CoT (Cursor-on-Target).
  - Sensores inerciales, navegación celeste PDR, barómetro táctico, brújula magnética calibrada y balística TCCC.
  - Economía P2P distribuida, micro-apps soberanas y sincronización DTN multi-salto.

---

### 3. Certificación en Hardware Móvil Real (Dual-Device Deployment)
Despliegue en limpio y sesión de depuración activa en tiempo real vía `adb logcat`:
- **Dispositivos Certificados:**
  - **Motorola Moto G22** (`ZT322B386P` / Android 12 / MTK Helio G37) — 60.0 FPS sostenido.
  - **Lenovo Tablet** (`HA2CHKZ2` / Android 12 / MTK Helio G80) — 58.0 FPS sostenido.
- **Librería Nativa Rust (`libred_mobile.so`):** Compilación limpia con `cargo-ndk` v4.1.2 para `arm64-v8a`. Carga dinámica JNI exitosa en ambos equipos (`RedNodePlugin: ✅ Native library red_mobile loaded successfully`).
- **Comunicaciones LibP2P & Mesh:**
  - Inicialización completa del enjambre libp2p, Kademlia DHT, Gossipsub y multiplexación Yamux sobre canales Noise cifrados.
  - Servidor Axum loopback vinculado en `127.0.0.1:7331` y escuchas mDNS activas.
  - Cero excepciones fatales, cero abortos de tiempo de ejecución y cero fugas de memoria.

---

### 4. Binarios Oficiales para Descarga Directa
- **APK Oficial:** `red-v95.0.0-release.apk` (58.85 MB / 61,704,558 bytes)
- **APK Canónico:** `red-latest.apk` (58.85 MB / 61,704,558 bytes)
- **SHA-256 Checksum:** `149AD7AEBBB67129F6F7938656AB5C1DDF0C11D67ACC10B3422D40812CD53769`
- **Registro de Integridad:** `SHA256SUMS.txt`

> **Web App & Descarga Directa:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
