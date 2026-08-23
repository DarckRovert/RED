# RED — Sovereign Mesh OS v39.0.0
> **Build Code:** `39000` | **Release Channel:** `stable-p2p` | **Protocol Version:** `RED/39.0-NOISE-PQC` | **Fecha:** 20 de Agosto de 2026

Plataforma táctica de comunicaciones descentralizadas y soberanas fuera de red (Off-Grid) con criptografía post-cuántica (NIST ML-KEM-768 / Dilithium), canales cifrados Noise XK, enrutamiento en malla P2P multi-radio y **motor de inteligencia artificial soberana generativa 100% offline**.

---

## 🌟 Novedades Principales en v39.0.0

### 1. 🤖 Motor IA Soberano Generativo — Corrección de Causa Raíz

El copiloto táctico de RED pasó de respuestas estáticas a **inteligencia conversacional real**:

- **Identificadores ONNX Corregidos:** Los pipelines de Transformers.js ahora apuntan a los repositorios validados en HuggingFace:
  - `onnx-community/Qwen2.5-0.5B-Instruct` (en lugar del deprecado `Xenova/Qwen1.5-0.5B-Chat`)
  - `onnx-community/SmolLM2-360M-Instruct` (en lugar del deprecado `Xenova/SmolLM-360M-Instruct`)
  - Fallbacks: `Xenova/LaMini-GPT-124M` → `Xenova/distilgpt2`
- **Alineación en Web Workers:** `localAiWorker.ts` sincronizado con los mismos pipelines corregidos.
- **Saneamiento de Prompts:** El contexto de malla táctico ya no contamina la búsqueda semántica RAG; el texto limpio del operador se procesa de forma aislada.
- **Generación Sin Eco de Prompt:** El texto de instrucción que antecede a la respuesta del LLM se recorta automáticamente, devolviendo únicamente la respuesta generada.
- **Intenciones Conversacionales:** El motor detecta saludos (`hola`, `buenos días`), consultas de sistema (`quién eres`, `capacidades`) y responde de forma fluida y contextual aun sin modelo GGUF descargado.
- **Capa de Inferencia ARM64 Verificada:** El motor nativo Rust en `:7333` sólo se invoca si el operador tiene un modelo GGUF descargado en disco, evitando errores silenciosos de I/O.

### 2. 💾 Bóveda de Medios IndexedDB Anti-Desbordamiento

- **Nuevo módulo `indexedMediaVault.ts`:** Almacenamiento de alta capacidad libre de cuotas para fotos, notas de voz, video en chunks y adjuntos cifrados.
- **Protección Anti-QuotaExceededError:** Los mensajes entrantes con medios > 512 bytes se persisten automáticamente en `RED_MEDIA_VAULT_DB` (IndexedDB) y se referencian en `localStorage` mediante punteros virtuales `red_vault://${msgId}`.

### 3. 🧠 Catálogo de Modelos GGUF Compactos

- **SmolLM2 360M Q4** (230 MB) — Micro-modelo de lenguaje para dispositivos con 1 GB RAM.
- **Qwen 2.5 0.5B Q4** (390 MB) — Modelo capaz de razonamiento libre en español para dispositivos con 2 GB RAM.
- Descarga a un clic desde la pestaña `[Modelos]` del Copiloto, con auto-sincronización de `tokenizer.json`.

### 4. 🪙 Snippets P2P Mejorados

- La lista de chats identifica correctamente vales P2P (`🪙 Pago RED P2P`) y transferencias mesh sin depender de texto plano.

### 5. 🏗️ Build en Limpio (APK 205 MB vs. 304 MB anterior)

- Eliminación definitiva del modelo `LaMini-Flan-T5-77M` del árbol de assets públicos.
- APK de release compilado desde cero con `gradlew clean assembleRelease`.

---

## 📦 Binarios Oficiales para Descarga Directa

| Archivo | Descripción | Plataforma |
| :--- | :--- | :--- |
| **`red-v39.0.0-latest.apk`** | Instalador Universal Oficial v39.0.0 | Android 7.0+ (ARM64) |
| **`red-latest.apk`** | Enlace canónico de última versión estable | Android 7.0+ (ARM64) |

> **Web App & Descarga Oficial:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
