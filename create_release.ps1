# Script Automatizado de Publicacion de Release Oficial RED v33.0.0
$tag = "v33.0.0"
$title = "RED v33.0.0 — Sovereign Tactical Master Release"
$apk1 = "d:\PROYECTO RED\red-latest.apk"
$apk2 = "d:\PROYECTO RED\red-v33.0.0-latest.apk"

$notes = @'
# RED — Sovereign Mesh OS v33.0.0
> **Build Code:** `33000` | **Release Channel:** `stable-p2p` | **Protocol Version:** `RED/33.0-NOISE-PQC`

Plataforma tactica de comunicaciones descentralizadas y soberanas fuera de red (Off-Grid) con criptografia post-cuantica (Kyber-768 / Dilithium), canales E2E Noise XK, enrutamiento en malla P2P multi-radio (BLE + WiFi Direct + WebRTC + MQTT Blind Relay) y experiencia tactica avanzada de nivel produccion.

---

## Novedades y Mejoras Principales en v33.0.0

### 1. Reproductor Tactico de Audio Interactivo (Voice Scrubber & Speed)
- **Waveform Scrubber Interactivo:** Barra de forma de onda interactiva con soporte de arrastre y seeking tactil en tiempo real mediante `pointer events` y calculo dinamico de coordenadas.
- **Selector Dinamico de Velocidad:** Conmutacion fluida entre velocidades de reproduccion (`1.0x` -> `1.5x` -> `2.0x`) con ajuste en vivo en el motor de audio HTML5.
- **Temporizador Dual Sincronizado:** Visualizacion precisa del tiempo transcurrido versus la duracion total del mensaje de voz.
- **Grabador Tactico en Vivo:** Barra de grabacion con visualizador en vivo, contador de tiempo de grabacion y botones tacticos de cancelacion y confirmacion.

### 2. Soporte Completo de Documentos y Archivos Genericos
- **Selector Universal de Archivos:** Soporte nativo para PDFs, ZIPs, APKs, GPXs, DOCs y archivos binarios de hasta 25MB codificados en DataURL con preservacion de nombre, tamano y tipo MIME.
- **Tarjetas Tacticas de Documento (`DocumentCard`):** Renderizado en burbujas con icono representativo segun extension, tamano formateado (KB/MB) y descarga directa con nombre original.

### 3. Busqueda Interna en Conversaciones y Mensajes Fijados
- **Buscador Tactico Overlay:** Barra integrada en el encabezado del chat con navegacion hacia adelante y atras (`▲`/`▼`), contador de coincidencias en vivo (`1/N`) y auto-scroll con resaltado ambar en la burbuja encontrada (`data-msgid`).
- **Mensajes Fijados en Canales:** Capacidad de fijar mensajes en cualquier canal/chat, visualizacion de banner persistente en la cabecera del canal y salto suave al mensaje fijado.

### 4. Tarjetas Topograficas GPS & Radar QR Unificado
- **Tarjetas Tacticas GPS:** Deteccion de coordenadas GPS en tiempo real con botones interactivos de copia rapida y apertura en el mapa topografico Leaflet.
- **Visor Tactico de Escaner QR:** Interfaz unificada con visor laser, control estricto de permisos nativos en Android y eliminacion de retornos redundantes.

### 5. Audio WebRTC & Altavoz Adaptativo
- Enrutamiento dinamico de altavoz mediante `setSinkId` y control de ganancia de audio en el reproductor remoto persistente.

---

## Binarios Oficiales para Descarga Directa

| Archivo | Descripcion | Plataforma |
| :--- | :--- | :--- |
| **`red-v33.0.0-latest.apk`** | Instalador Universal Oficial v33.0.0 | Android 7.0+ (ARM64) |
| **`red-latest.apk`** | Enlace canonico de ultima version | Android 7.0+ (ARM64) |

> **Web App:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
'@

$notesPath = "d:\PROYECTO RED\release_notes_v33.0.0.md"
[System.IO.File]::WriteAllText($notesPath, $notes, [System.Text.Encoding]::UTF8)

Write-Host "Notas de release generadas en $notesPath"


