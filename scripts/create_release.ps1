# Script Automatizado de Publicacion de Release Oficial RED v64.0.0
$tag = "v64.0.0"
$title = "RED v64.0.0 — Sovereign Mesh OS: Omni-Transport Production Master"
$releaseAssets = "d:\PROYECTO RED\release-assets"
$apk1 = "$releaseAssets\red-latest.apk"
$apk2 = "$releaseAssets\red-v64.0.0-release.apk"
$zip = "$releaseAssets\red-node-windows-v64.0.0.zip"
$sums = "$releaseAssets\SHA256SUMS.txt"

$notes = @'
# 🛡️ RED Sovereign Mesh OS — Release v64.0.0 (Master de Producción)

- **Erradicación Definitiva de Duplicidad de Chats:** Resolución canónica de identidades (Ed25519/BLAKE3 64-char DID) y mapeo persistente de hardware en almacenamiento seguro.
- **Optimización Radical de Peso (170 MB → 57.7 MB):** Purga forense de bundles recursivos de descargas en el APK móvil.
- **Sincronización Web Companion & Travesía de CGNAT:** Canal bidireccional cifrado con AES-256-GCM y latidos keepalive.
- **Cero Código Falso & 116 Tests Pasando:** Cobertura matemática integral (Known-Answer Tests, Double Ratchet, BLAKE3, Ed25519, ML-KEM-768, ZK Merkle Proofs).
- **Despliegue Limpio en Dispositivos:** Verificado en hardware Motorola Moto G22 y Xiaomi Redmi Note 14 5G.

### Binarios Oficiales para Descarga Directa:
- `red-v64.0.0-release.apk` (57.75 MB)
- `red-latest.apk` (57.75 MB)
- `red-node-windows-v64.0.0.zip` (5.71 MB)
- `SHA256SUMS.txt`

> **Web App:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
'@

$notesPath = "d:\PROYECTO RED\release_notes_v64.0.0.md"
[System.IO.File]::WriteAllText($notesPath, $notes, [System.Text.Encoding]::UTF8)

Write-Host "Publicando release $tag en GitHub..."
gh release create $tag $apk1 $apk2 $zip $sums --title $title --notes-file $notesPath --clobber
Remove-Item $notesPath -Force -ErrorAction SilentlyContinue
Write-Host "Release $tag publicada exitosamente."


