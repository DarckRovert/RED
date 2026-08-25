# RED — Sovereign Mesh OS v62.0.0
> **Build Code:** 62000 | **Release Channel:** stable-p2p | **Protocol Version:** RED/62.0-NOISE-PQC

Plataforma táctica de comunicaciones descentralizadas y soberanas fuera de red (Off-Grid) con criptografía post-cuántica (ML-KEM-768 / FIPS 203), canales E2E Double Ratchet, enrutamiento en malla P2P multi-radio (BLE + WiFi Direct + WebRTC + LoRa + SoundMesh), llaves biométricas universales y seguridad Zero-Trust de nivel militar.

---

## [62.0.0-hardened-p2p-unified-protocol] - 2026-08-25

### Hardened P2P & Unified Protocol Edition — Enrutamiento E2E de Señalización WebRTC, Deduplicación Canónica y Handshake Blindado

**1. Despacho Garantizado de Handshakes & Solicitudes de Contacto (Rust libp2p + WebRTC)**
- client.ts & 
ode/src/api.rs: Habilitación del enrutamiento directo por el backend de Rust (/messages/send) para paquetes contact_request, contact_response y profile_update. La solicitud de contacto viaja de inmediato por la malla local TCP (Wi-Fi), asegurando que el receptor reciba la notificación y el modal de aceptación IncomingContactRequestModal sin depender de que el usuario envíe un primer mensaje de texto.

**2. Unificación Canónica de Identificadores y Cero Chats Duplicados (1 Par = 1 Conversación)**
- 
ode/src/api.rs: handle_list_conversations ahora retorna siempre el hash canónico de 64 caracteres (peer), eliminando la fragmentación con identificadores legados con guiones (short1-short2).
- messageDispatcher.ts, meshRouter.ts & uthSlice.ts: Saneamiento automático en memoria y localStorage (ed_web_conversations) que normaliza cualquier identificador hacia la clave canónica del par, erradicando duplicaciones de tarjetas de chat en la barra lateral y desincronizaciones de perfiles.

**3. Enrutamiento E2E de Señalización WebRTC (Llamadas de Voz y Video 1-a-1)**
- 
ode/src/api.rs & client.ts: Desbloqueo del reenvío de paquetes webrtc_signal a través de libp2p. Las ofertas SDP, respuestas y candidatos ICE se transmiten en tiempo real sobre la malla local, activando el timbrado inmediato de llamadas (IncomingCallBanner) y la negociación P2P DTLS-SRTP.

**4. Idempotencia y Blindaje contra Duplicación Multimedia (Estándar Signal / WhatsApp)**
- meshRouter.ts: Generador de IDs de mensaje determinista e idempotente generateDeterministicMsgId() libre de aleatoriedad.
- client.ts & messageDispatcher.ts: Deduplicación profunda de paquetes por firma de contenido y almacenamiento de blobs pesados en IndexedMediaVault (IndexedDB) para prevenir errores de cuota en localStorage.

---

## Binarios Oficiales para Descarga Directa

| Archivo | Descripción | Plataforma | Suma SHA-256 |
| :--- | :--- | :--- | :--- |
| **RED-v62.0.0.apk** | Instalador Universal Oficial v62.0.0 (Sideloading + P2P Transfer + Neural HUD) | Android 7.0+ (ARM64) | 808cea3529a09084e8ff185e846988a88c1440467f4fefe2c73efbf83a9aff0b |
| **ed-latest.apk** | Enlace canónico de última versión | Android 7.0+ (ARM64) | 808cea3529a09084e8ff185e846988a88c1440467f4fefe2c73efbf83a9aff0b |
| **ed-node.exe** | Binario de Escritorio (Desktop Node) | Windows x64 | ca6fbfe6e3f59086e0f4dd86254eeb0cba317755db48f071880e3b6848a59be |

> **Web App Oficial:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
