# RED v108.0.0 — "Sincronización P2P Soberana, Consentimiento QR & Persistencia Limpia" 🔴

**Fecha de release:** 2026-09-17  
**Build Code:** 108000  
**Plataformas:** Android 9+ (ARM64) · Web SPA (GitHub Pages) · Binario Nativo Windows/Linux (x86_64)

---

## Resumen Ejecutivo

RED v108.0.0 resuelve cuellos de botella arquitectónicos en el flujo de consentimientos P2P, la persistencia en base de datos nativa y la gobernanza de higiene del proyecto:

1. **Protocolo de Consentimiento QR Bidireccional en Web & Móvil:** Unificación del listener `meshRouter.onLocalDelivery` en el frontend web SPA ([`https://darckrovert.github.io/RED/`](https://darckrovert.github.io/RED/)) y soporte de deserialización multi-nivel en el despachador de mensajes. Escanear un código QR desde un teléfono móvil hacia la aplicación Web ahora despliega de forma determinista el modal de solicitud de contacto (`IncomingContactRequestModal`), respetando el consentimiento del usuario antes de añadir un contacto.
2. **Eliminación Atómica de Contactos en Rust (`DELETE /api/contacts/:hash`):** Implementación de endpoints REST `DELETE` en los daemons de Rust tanto para desktop (`node/src/api.rs`) como para Android JNI (`red_mobile/src/api.rs`), eliminando las entradas directamente en la base de datos Sled y erradicando la reaparición de contactos en polling o SSE.
3. **Erradicación de Auto-Inserción No Consentida:** Eliminación de la lógica que reinsertaba automáticamente contactos ante mensajes entrantes residuales en la malla, garantizando que la presencia de un par en la topología de red nunca sustituya el consentimiento explícito del operador.
4. **Higiene, Poda & Linter Zero-Warnings:** Poda de release notes obsoletas previas a v105, simplificación de expresiones booleanas en el túnel DNS (`node/src/dns_tunnel.rs`) y aprobación estricta de `cargo clippy --workspace -- -D warnings` con 0 advertencias.

---

## Novedades & Mejoras Técnicas

### 🤝 1. Protocolo de Consentimiento & Handshake de Contactos
- **Unificación de Entrega Local:** `authSlice.ts` ahora inicializa `registerMeshLocalDeliveryListener` de manera idempotente tanto en contexto nativo (Capacitor) como en el navegador Web (SPA).
- **Desempaquetado Recursivo de Payloads:** Soporte para tramas con metadatos anidados en `content` serializado, extrayendo transparentemente `sender_name`, `sender_pk` y asignando `msg_type: 'contact_request'`.
- **Broadcast Canónico QR:** `ContactQrModal.tsx` emite tramas de broadcast estructuradas con identificador unívoco de mensaje, remitente y destinatario para enrutamiento directo e inundación controlada.

### 🗑️ 2. Persistencia y Eliminación Definitiva en Backend Rust
- **Método `Node::remove_contact`:** Implementado en `core/src/network/node.rs` con delegación directa a `Storage::remove_contact` sobre el árbol de contactos de Sled.
- **Rutas Axum REST:**
  - `DELETE /api/contacts/:hash` en `node/src/api.rs`.
  - `DELETE /api/contacts/:hash` en `red_mobile/src/api.rs` (tanto en router síncrono como en el manejador asíncrono de fallback).
- **Purga de Caché en Frontend:** `contactsSlice.ts` limpia en cascada `red_web_messages_*`, `red_outbound_contact_requests`, `meshRouter.peers` y ejecuta las peticiones REST tanto para el contacto como para el vaciado de conversación.

### ⚡ 3. Optimización de Red & Clippy
- **Túnel DNS (`node/src/dns_tunnel.rs`):** Simplificación del filtrado de etiquetas de subdominios Base32 sin expresiones booleanas redundantes, cumpliendo con la directiva `-D warnings`.

---

## Verificación en Hardware Físico Real

| Dispositivo | Serial / ID | Plataforma | Prueba | Resultado |
|---|---|---|---|---|
| Motorola Moto G22 | `ZT322B386P` | Android 12 (API 31) | Instalación limpia APK v108.0.0, carga JNI `libred_mobile.so`, eliminación de contacto en Sled | ✅ Operacional (0 crashes) |
| Tablet Lenovo TB305XU | `HA2CHKZ2` | Android 11 (API 30) | Instalación limpia APK v108.0.0, escaneo QR, recepción de solicitud P2P | ✅ Operacional (0 crashes) |
| Web SPA Soberana | GitHub Pages | Navegador / HTTPS | Conexión WebRTC / MQTT Blind Relay, renderizado de modal de contacto | ✅ 100% Verificado |

---

## Criptografía & Certificación

- **Keystore de Firma:** RSA 4096-bit (`red-release.keystore`) con algoritmo de firma SHA256withRSA.
- **Gobernanza SSOT:** Sincronización al 100% de 22 archivos maestros de versión (`v108.0.0` / `108000`).
