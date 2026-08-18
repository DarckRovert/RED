# Script Automatizado de Publicación de Release Oficial RED v33.0.0
$tag = "v33.0.0"
$title = "🛡️ RED v33.0.0 — Sovereign Tactical Master Release"
$apk1 = "d:\PROYECTO RED\red-latest.apk"
$apk2 = "d:\PROYECTO RED\red-v33.0.0-latest.apk"

$notes = @"
# 🛡️ RED — Sovereign Mesh OS v33.0.0
> **Build Code:** ``33000`` | **Release Channel:** ``stable-p2p`` | **Protocol Version:** ``RED/33.0-NOISE-PQC``

Plataforma táctica de comunicaciones descentralizadas y soberanas fuera de red (Off-Grid) con criptografía post-cuántica (Kyber-768 / Dilithium), canales E2E Noise XK, enrutamiento en malla P2P multi-radio (BLE + WiFi Direct + WebRTC + MQTT Blind Relay) y experiencia táctica avanzada de nivel producción.

---

## 🌟 Novedades y Mejoras Principales en v33.0.0

### 1. 🎙️ Reproductor Táctico de Audio Interactivo (Voice Scrubber & Speed)
- **Waveform Scrubber Interactivo:** Barra de forma de onda interactiva con soporte de arrastre y seeking táctil en tiempo real mediante ``pointer events`` y cálculo dinámico de coordenadas.
- **Selector Dinámico de Velocidad:** Conmutación fluida entre velocidades de reproducción (``1.0x`` -> ``1.5x`` -> ``2.0x``) con ajuste en vivo en el motor de audio HTML5.
- **Temporizador Dual Sincronizado:** Visualización precisa del tiempo transcurrido versus la duración total del mensaje de voz.
- **Grabador Táctico en Vivo:** Barra de grabación con visualizador en vivo, contador de tiempo de grabación y botones tácticos de cancelación y confirmación.

### 2. 📄 Soporte Completo de Documentos y Archivos Genéricos
- **Selector Universal de Archivos:** Soporte nativo para PDFs, ZIPs, APKs, GPXs, DOCs y archivos binarios de hasta 25MB codificados en DataURL con preservación de nombre, tamaño y tipo MIME.
- **Tarjetas Tácticas de Documento (`DocumentCard`):** Renderizado en burbujas con icono representativo según extensión, tamaño formateado (KB/MB) y descarga directa con nombre original.

### 3. 🔍 Búsqueda Interna en Conversaciones y Mensajes Fijados
- **Buscador Táctico Overlay:** Barra integrada en el encabezado del chat con navegación hacia adelante y atrás (`▲`/`▼`), contador de coincidencias en vivo (`1/N`) y auto-scroll con resaltado ámbar en la burbuja encontrada (`data-msgid`).
- **Mensajes Fijados en Canales:** Capacidad de fijar mensajes en cualquier canal/chat, visualización de banner persistente en la cabecera del canal y salto suave al mensaje fijado.

### 4. 🗺️ Tarjetas Topográficas GPS & Radar QR Unificado
- **Tarjetas Tácticas GPS:** Detección de coordenadas GPS en tiempo real con botones interactivos de copia rápida y apertura en el mapa topográfico Leaflet.
- **Visor Táctico de Escáner QR:** Interfaz unificada con visor láser, control estricto de permisos nativos en Android y eliminación de retornos redundantes.

### 5. 📞 Audio WebRTC & Altavoz Adaptativo
- Enrutamiento dinámico de altavoz mediante `setSinkId` y control de ganancia de audio en el reproductor remoto persistente.

---

## 📦 Binarios Oficiales para Descarga Directa

| Archivo | Descripción | Plataforma |
| :--- | :--- | :--- |
| **`red-v33.0.0-latest.apk`** | Instalador Universal Oficial v33.0.0 | Android 7.0+ (ARM64) |
| **`red-latest.apk`** | Enlace canónico de última versión | Android 7.0+ (ARM64) |

> **Web App:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
"@

$notesPath = "d:\PROYECTO RED\release_notes_v33.0.0.md"
[System.IO.File]::WriteAllText($notesPath, $notes, [System.Text.Encoding]::UTF8)

Write-Host "Ejecutando gh release create para $tag..."
gh release create $tag "$apk1#red-latest.apk (Universal Latest)" "$apk2#red-v33.0.0-latest.apk (v33.0.0 Standalone)" --title $title --notes-file $notesPath

