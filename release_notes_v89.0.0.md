# 🛡️ RED Sovereign Mesh OS — Release v89.0.0 (WebAssembly Worker Off-Thread & Tri-Hardware Master Edition)

### 🚀 Hitos Arquitectónicos y Mejoras Principales:

- **Inferencia WebAssembly ONNX Off-Thread en Web Worker:**
  - **`localAiWorker.ts` Operativo:** Traslado completo de la inferencia neuronal ONNX (`toxic-bert`, Whisper ASR y pipelines generativos) fuera del hilo principal de JavaScript a un Web Worker dedicado, liberando la interfaz gráfica de cualquier congelamiento durante la inferencia local.
  - **Puente Bidireccional en `LocalAIEngineClass`:** Inicialización perezosa de Worker con recarga automática ante fallos, timeouts de seguridad y fallback transparente al path inline sin bloquear la UI.
  - **Protección de Memoria:** Terminación atómica del Worker y liberación de tensores en `disposePipelines()` al alternar modelos o liberar memoria.

- **Detección Dinámica de Capacidades de Hardware (Copiloto IA):**
  - **Integración de `probeHardwareCapabilities`:** Mapeo de WebGPU, núcleos de CPU y memoria RAM disponible directamente en la pestaña de modelos de `AICopilotModal.tsx`.
  - **Recomendación Inteligente en UI:** Badge dorado "RECOMENDADO ★" en la tarjeta del modelo óptimo para el dispositivo actual con botón de escaneo "🔬 Detectar Hardware".

- **Blindaje del Pipeline de Transcripción Whisper:**
  - **Decodificación PCM 16kHz en Hilo Principal:** Decodificación de audio comprimido mediante Web Audio API antes del despacho al Worker, permitiendo que Whisper WASM ejecute sin requerir AudioContext en hilos secundarios.
  - **Contingencia Robusta:** Reutilización inmediata del búfer Float32Array en el hilo principal si el Worker se encuentra ocupado o agotado por timeout.

- **Auditoría de Seguridad y Clasificación RED Guardian:**
  - **Evaluación Multietiqueta:** Configuración `{ topk: null }` y umbral estricto 0.60 en las 6 categorías de hostilidad en el Worker, erradicando falsos positivos y falsos negativos.
  - **Eliminación de Respuestas Mock:** Erradicación total de textos simulados; reporte de errores honestos y transición limpia a RAG Vectorial INT8 y protocolos oficiales.

- **Hardening de Android Keystore y Resiliencia en Reinstalación:**
  - **`android:allowBackup="false"`:** Prevención de restauración de SharedPreferences huérfanas tras reinstalación limpia sin claves Keystore.
  - **Auto-purga en `getSecureStored`:** Detección de `IllegalBlockSizeException` y saneamiento automático de claves corruptas con fallback a almacenamiento local seguro.

- **Certificación Empírica Tri-Hardware:**
  - Despliegue en limpio y ejecución concurrente certificada con 0 crashes en:
    - **Redmi Note 14 Pro 5G** (`24116RACCG` / Android 15 / HyperOS)
    - **Lenovo Tab** (`TB305XU` / Android 14)
    - **Motorola Moto G22** (`moto_g22` / Android 12)
  - Malla P2P activa con transporte BLE GATT, mDNS MulticastLock y Wi-Fi radio en modo de alto rendimiento.

- **Validación Automatizada 100% PASS:**
  - TypeScript estricto con 0 errores (`tsc --noEmit`).
  - Prerender estático completo en `next build`.
  - 9 Suites de Pruebas de Resiliencia al 100% PASS (67/67 pruebas exitosas).

### 📦 Binarios Oficiales para Descarga Directa:
- `red-v89.0.0-release.apk` (58.06 MB / 60,877,352 bytes) — SHA256: `4EC5526339F78D8BD69E16A5D32AD925A6A8E6252A4D8E466EE533C1B54FE239`
- `red-latest.apk` (58.06 MB / 60,877,352 bytes) — SHA256: `4EC5526339F78D8BD69E16A5D32AD925A6A8E6252A4D8E466EE533C1B54FE239`
- `SHA256SUMS.txt`

> **Web App:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
