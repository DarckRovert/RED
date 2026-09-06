# Script Automatizado de Publicacion de Release Oficial RED v93.0.0
$tag = "v93.0.0"
$title = "RED v93.0.0 — Sovereign Mesh OS: Tactical UI Primitives, Dynamic Portals & Hardened Mesh Sync Edition"
$releaseAssets = "d:\PROYECTO RED\release-assets"
$apk1 = "$releaseAssets\red-latest.apk"
$apk2 = "$releaseAssets\red-v93.0.0-release.apk"
$sums = "$releaseAssets\SHA256SUMS.txt"
$notesPath = "d:\PROYECTO RED\release_notes_v93.0.0.md"

Write-Host "Publicando release $tag en GitHub..."
gh release create $tag $apk1 $apk2 $sums --title $title --notes-file $notesPath --clobber
Write-Host "Release $tag publicada exitosamente."
