# 🛡️ RED Sovereign Mesh OS — Release v96.0.0 (Hardened Tactical Compass & Multi-Bearer Sovereign Edition)

## 🌟 Aspectos Destacados de la Versión v96.0.0

Esta versión representa un salto cualitativo mayor en la soberanía operativa y conciencia situacional de **RED OS**, incorporando un motor cinemático de brújula táctica con cono de orientación en tiempo real sobre el mapa táctico, un HUD de salud de enjambre interactivo con control dinámico de portadoras, endurecimiento integral de la pila de navegación de hardware, y certificación dual en hardware físico real (Motorola Moto G22 y Lenovo Tab M8).

---

### 1. Motor de Brújula Táctica y Cono de Orientación en Mapa (`TacticalCompassEngine`)
- **Fusión Sensorial de Alta Precisión:** Integración del nuevo `TacticalCompassEngine.ts` que fusiona magnetómetro de hardware, acelerómetro de 3 ejes y rumbo GNSS sobre el terreno (Course-Over-Ground - COG).
- **Cono de Visión Dinámico a 60 FPS:** Proyección de cono de orientación táctico en tiempo real sobre `NodeMap`, con interpolación suave de rumbo, amortiguación contra ruido de alta frecuencia y prevención de bloqueo de cardán (gimbal lock).
- **Degradación Elegante Multi-Hardware:** En dispositivos sin magnetómetro físico (como la tablet Lenovo Tab M8), el motor conmuta automáticamente al rumbo cinemático por vector de movimiento o control manual asistido, sin arrojar excepciones ni degradar los FPS.

---

### 2. HUD de Salud de Enjambre y Gobernador de Portadoras Soberano
- **HUD Interactivo y Tarjetas Tácticas:** Rediseño completo de `SwarmHealthHUD.tsx` con métricas en tiempo real de latencia, tasa de transferencia, pérdida de paquetes y estado de enlace por portadora física (WiFi Direct, Bluetooth LE, LoRa Meshtastic, Satélite DTN, Acústica).
- **Control Manual y Gobernanza QoS Autónoma:** Extensión de `DynamicBearerGovernor.ts` con capacidad de conmutación manual forzada (`isManualOverride`) y retorno seguro al modo automático supervisado por QoS (`resumeAutomaticMode()`).
- **Accesos Directos de Misión:** Atajos tácticos directos a los módulos de supervivencia extrema, radiogoniometría (Foxhunt), brújula off-grid y brújula P2P sin salir del mapa de operaciones.

---

### 3. Endurecimiento de Navegación LIFO y Modales
- **Registro Canónico de BackHandler:** Garantía de desregistro estricto LIFO en todos los modales (`WebCompanionQRModal`, `WebCompanionPairConfirmationModal`, `NodeLogsModal`, `ExtremeSurvivalHudModal`), evitando handlers huérfanos o bloqueos en el botón atrás físico de Android.
- **Sincronización SSOT en Logs de Nodo:** Corrección de cadenas estáticas desfasadas en `NodeLogsModal` mediante vinculación canónica a `RED_VERSION_NAME`.

---

### 4. Certificación en Hardware Móvil Real (Dual-Device Deployment)
Despliegue en limpio y sesión de depuración activa en tiempo real vía `adb logcat`:
- **Dispositivos Certificados:**
  - **Motorola Moto G22** (`ZT322B386P` / Android 12 / MTK Helio G37) — Brújula táctica activa por magnetómetro de hardware.
  - **Lenovo Tab M8** (`HA2CHKZ2` / Android 12 / MTK Helio G80) — Conmutación automática a rumbo cinemático GPS/PDR sin anomalías.
- **Librería Nativa Rust (`libred_mobile.so`):** Carga dinámica JNI verificada en tiempo real (`RedNodePlugin: ✅ Native library red_mobile loaded successfully`).
- **Estabilidad de Ejecución:** Cero excepciones fatales, cero abortos de tiempo de ejecución y cero bloqueos de interfaz en ambos equipos.

---

### 5. Binarios Oficiales para Descarga Directa
- **APK Oficial:** `red-v96.0.0-release.apk` (58.86 MB / 61,721,234 bytes)
- **APK Canónico:** `red-latest.apk` (58.86 MB / 61,721,234 bytes)
- **SHA-256 Checksum:** `E3DB0268002CF46DA71226342D9F01161E0A66BF4BCF3C625C73C1A88B0B16B8`
- **Registro de Integridad:** `SHA256SUMS.txt`

> **Web App & Distribución P2P:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
