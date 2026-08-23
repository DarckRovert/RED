# Script Automatizado de Publicacion de Release Oficial RED v58.0.0
$tag = "v58.0.0"
$title = "RED v58.0.0 — Sovereign Tactical Master Release"
$apk1 = "d:\PROYECTO RED\red-latest.apk"
$apk2 = "d:\PROYECTO RED\red-v58.0.0-latest.apk"

$notes = @'
# RED — Sovereign Mesh OS v58.0.0
> **Build Code:** `58000` | **Release Channel:** `stable-p2p` | **Protocol Version:** `RED/58.0-NOISE-PQC`

Plataforma tactica de comunicaciones descentralizadas y soberanas fuera de red (Off-Grid) con criptografia post-cuantica (Kyber-768 / Dilithium), canales E2E Noise XK, enrutamiento en malla P2P multi-transporte unificado (BLE + WiFi Direct + WebRTC + MQTT Blind Relay) y deduplicacion canonica estricta de nodos.

---

## Novedades y Mejoras Principales en v58.0.0

### 1. Deduplicacion Canonica Universal de Nodos
- **Unificacion Multi-Transporte (`UnifiedDeviceMap`):** Dispositivos detectados simultaneamente por BLE y WiFi Direct ahora se consolidan en una unica tarjeta táctica con insignias combinadas `[BLE]` y `[WIFI]`.
- **Resolucion de Hardware a DID:** Vinculacion automatica e inmediata de direcciones MAC fisicas Bluetooth hacia identidades soberanas SHA-256 de 64 caracteres.
- **Correlacion Inteligente de Nombres:** Heuristica `isNameSimilar` para asociar nombres de hardware de fabricante con alias de perfil tactico (ej. "Lenovo Tab One" y "Tab").

### 2. Prevencion de Bifurcacion de Chats y Migracion en Caliente
- **Enrutamiento Canonico Estricto:** Los mensajes entrantes y salientes se indexan exclusivamente bajo el DID canonico, eliminando la creacion de chats duplicados por MAC.
- **Auto-migracion de Mensajes:** Conversaciones y almacenes locales huérfanos creados con direcciones MAC se migran de forma transparente al DID canonico sin perdida de historial.

### 3. Sinergia de Estado en Toda la App
- **Presencia en Tiempo Real:** Deteccion precisa de estado en linea en la lista de conversaciones y contactos a traves de `getPeerByAnyId`.
- **Base de Datos Nativa Sled (Rust):** Normalizacion forzada de identificadores primarios en el arbol `discovery_nodes`.

---

## Binarios Oficiales para Descarga Directa

| Archivo | Descripcion | Plataforma |
| :--- | :--- | :--- |
| **`red-v58.0.0-latest.apk`** | Instalador Universal Oficial v58.0.0 | Android 7.0+ (ARM64) |
| **`red-latest.apk`** | Enlace canonico de ultima version | Android 7.0+ (ARM64) |

> **Web App:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
'@

$notesPath = "d:\PROYECTO RED\release_notes_v58.0.0.md"
[System.IO.File]::WriteAllText($notesPath, $notes, [System.Text.Encoding]::UTF8)

Write-Host "Notas de release generadas en $notesPath"


