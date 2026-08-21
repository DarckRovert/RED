# 🛡️ RED v53.0.0 — Tactical Refinement & Optimized Binary Edition

¡Bienvenido a la versión **v53.0.0** de **RED (Sovereign Mesh OS)**! Esta versión introduce una profunda optimización de almacenamiento (-83% de peso de APK), refinamiento en la navegación de acciones rápidas y saneamiento integral de paquetes de control y borrado remoto en la malla.

---

### 🚀 Principales Mejoras y Novedades de la v53.0.0

#### 1. 📷 Diferenciación Funcional en la Barra Superior
- **Botón `📷` (Cámara)**: Disparo instantáneo de la cámara integrada para capturar y publicar **Historias Tácticas y Fotos Efímeras de 24h** (`setStoryModal("creator")`).
- **Botón `➕` (Agregar Contacto)**: Acceso directo al modal de registro manual de contactos mediante **DID Soberano, Hash Criptográfico o Alias** para iniciar chats P2P Noise E2E.

#### 2. 🧹 Saneamiento de Protocolo de Borrado Remoto y Filtrado Broadcast
- **Aislamiento de Señalización**: Los paquetes `conversation_wipe`, `message_wipe`, `profile_update` y comandos de purga remota ahora son clasificados estrictamente como paquetes de control en `lib/api.ts`, asegurando que nunca se almacenen como mensajes de texto en el historial.
- **Renderizado Táctico**: Avisos de purga remota se muestran como banners de sistema discretos (`⚠️ Historial de conversación purgado remotamente`) en `MessageBubble.tsx`.
- **Inmunidad a Conversaciones Ficticias**: `useRedStore.ts` bloquea la creación de conversaciones para direcciones de broadcast (`ffffffff...` y `00000000...`).

#### 3. 📦 Reducción Extrema del Tamaño del APK (199.36 MB)
- Saneamiento del árbol de empaquetado de Capacitor, eliminando redundancias de compilaciones previas.
- Tiempos de ensamblado de Gradle ultrarrápidos (**~17 a 25 segundos**).
- Conservación total de modelos neuronales de IA local offline (`toxic-bert` y `all-MiniLM-L6-v2`), núcleo nativo de Rust (`libred_mobile.so`) y librerías WASM SIMD.

---

### 📦 Archivos Binarios Incluidos
- **`red-v53.0.0.apk`**: Instalador APK de la versión 53.0.0 (199.36 MB).
- **`red-latest.apk`**: Enlace canónico de última versión estable.

---

### 🌐 Acceso Web PWA
- Versión Web interactiva: **[https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)**
