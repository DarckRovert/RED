# Script Automatizado de Publicación de Release Oficial RED v98.0.0
$tag = "v98.0.0"
$title = "RED v98.0.0 — Sovereign Mesh OS: Tactical Vector Architecture & Zero-Echo Sync Edition"
$releaseAssets = "d:\PROYECTO RED\release-assets"
$apk1 = "$releaseAssets\red-latest.apk"
$apk2 = "$releaseAssets\red-v98.0.0-release.apk"
$sums = "$releaseAssets\SHA256SUMS.txt"
$notesPath = "d:\PROYECTO RED\release_notes_v98.0.0.md"

Write-Host "Publicando release $tag en GitHub..."
gh release create $tag $apk1 $apk2 $sums --title $title --notes-file $notesPath --clobber
Write-Host "Release $tag publicada exitosamente."
