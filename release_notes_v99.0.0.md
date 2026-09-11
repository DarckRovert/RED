# 🛡️ RED Sovereign Mesh OS — Release v99.0.0 (Geohash Spatial DTN & TDMA Solar Repeater Edition)

## 🌟 Aspectos Destacados de la Versión v99.0.0

Esta versión histórica de **RED OS** representa la culminación del escalado táctico y planetario del sistema operativo de malla soberano. Incorpora el enrutamiento geoespacial determinista por **Geohash DTN**, el planificador de ranuras **TDMA LoRa sin colisiones** (elevando la eficiencia espectral teórica de ALOHA del 18.4% a más del 70%), el soporte nativo para **repetidores solares autónomos de ultra-bajo costo (~$15-20 USD)** basados en ESP32-S3 y Semtech SX1262, la consolidación canónica de **62 módulos tácticos** en la interfaz y la certificación de despliegue limpio en hardware físico real (Motorola Moto G22 y Lenovo Tablet).

---

### 1. Enrutamiento Geoespacial Geohash DTN & Poda Espacial
- **Motor Espacial Canónico (`GeohashSpatialRouting.ts`):** Codificación y decodificación Base32 de alta precisión sin dependencias externas, cálculo ortodrómico y distancias Manhattan entre celdas geográficas.
- **Indexación y Almacén DTN IndexedDB v2 (`dtnStorage.ts`):** Estructuración de la cola Store-and-Forward con índice espacial `targetGeohash`. Recuperación y consulta selectiva por prefijo de cuadrante para sincronización de mulas móviles y portadores tácticos.
- **Poda Espacial Orbital y Terrestre:** Filtrado predictivo de enlaces descendentes en pasarelas satelitales LEO (`SatelliteMeshGatewayEngine.ts`) según la huella terrestre del satélite, impidiendo la saturación transcontinental de paquetes locales.

---

### 2. Planificador LoRa TDMA Ranurado Estricto
- **Superframe Determinista de 2000 ms (`LoRaTdmaSchedulerEngine.ts`):** División precisa en 10 ranuras de 200 ms sincronizadas con el reloj de consenso lógico de Lamport (`LamportMeshClockEngine`).
- **Asignación Criptográfica de Ranuras:** Asignación fija para transmisiones en slots 0–7 calculada mediante dispersión $\text{slot} = (\text{FNV-1a}(\text{NodeID}) \pmod 8)$, slot 8 reservado para balizas de calibración y sincronización de red, y slot 9 asignado para contienda CSMA/CA con retroceso exponencial.
- **Bypass de Emergencia SOS:** Canalización prioritaria inmediata que elude la cola TDMA para paquetes con flag SOS/crítico (prioridad $\ge 9$), garantizando emisión en $<10\text{ ms}$.

---

### 3. Infraestructura de Repetidores Solares Autónomos ESP32-S3
- **Firmware Nativo de Grado Centinela (`firmware/esp32-repeater/`):** Diseñado para microcontroladores Heltec WiFi LoRa 32 V3 y LilyGO T-Beam con transceptor Semtech SX1262.
- **Hardware Abierto y Bajo Costo (~$15–$20 USD BOM):** Conexión de bus SPI dedicada (`SCK=9, MISO=11, MOSI=10, NSS=8`), oscilador TCXO a 1.8V para estabilidad térmica en intemperie, y consumo en reposo $< 12\text{ mA}$ a 80 MHz, ofreciendo más de 12 días de operación ininterrumpida sin sol directo mediante una sola celda 18650.
- **Deduplicación por Filtro de Bloom:** Deduplicación instantánea de 2048 bits en memoria estática que elimina bucles de retransmisión sin consumo excesivo de RAM ni almacenamiento en flash.

---

### 4. Catálogo Canónico de 62 Módulos Tácticos & UI/UX Auditada
- **Consolidación de Pantallas y Submódulos:** Catálogo completo en `catalogData.ts` y vitrina web interactiva con 62 subsistemas plenamente funcionales distribuidos en 6 pilares estratégicos.
- **Paridad Lingüística al 100%:** Localización completa en 16 idiomas con 737 claves sincronizadas sin entradas faltantes.
- **Resiliencia de Navegación:** Pila de navegación LIFO protegida contra pérdida de contexto en Android, soporte unificado de botón físico de retroceso y cierres modal controlados.

---

### 5. Certificación Físico-Empírica en Hardware Real
- **Motorola Moto G22** (`ZT322B386P` / Android 12 / MTK Helio G37):
  - Desinstalación higiénica y despliegue limpio de APK v99.0.0 firmado.
  - Concesión atómica de permisos en tiempo de ejecución (Ubicación precisa, Cámara, Micrófono, Notificaciones, BLE Scan/Connect/Advertise).
  - Verificación en caliente vía Logcat: **0 excepciones fatales**, inicialización exitosa de Capacitor y motor Rust `libred_mobile.so`.
- **Lenovo Tablet TB305XU** (`HA2CHKZ2` / Android 14):
  - Procedimiento de despliegue automatizado y soporte para degradación de rumbo cinemático asistido por GNSS en ausencia de magnetómetro físico.

---

## 📦 Artefactos de Distribución Binaria

| Archivo | Descripción | Plataforma |
|---|---|---|
| `red-v99.0.0-release.apk` | APK Compilado y Firmado Oficial v99.0.0 | Android 7.0+ (ARM64/ARMv7/x86_64) |
| `red-latest.apk` | Enlace canónico de descarga directa | Android 7.0+ |
| `SHA256SUMS.txt` | Sumas de verificación criptográfica | Universal |
