# Script Automatizado de Publicación de Release Oficial RED v100.0.0
$tag = "v100.0.0"
$title = "RED v100.0.0 - Sovereign Mesh OS: Centurion Edition (62 Tactical Modules & Resilient Web Companion)"
$releaseAssets = "d:\PROYECTO RED\release-assets"
$apk1 = "$releaseAssets\red-latest.apk"
$apk2 = "$releaseAssets\red-v100.0.0-release.apk"
$sums = "$releaseAssets\SHA256SUMS.txt"
$notesPath = "d:\PROYECTO RED\release_notes_v100.0.0.md"

Write-Host "Publicando release $tag en GitHub..."
gh release create $tag $apk1 $apk2 $sums --title $title --notes-file $notesPath --latest
Write-Host "Release $tag publicada exitosamente."
