# Script Automatizado de Publicación de Release Oficial RED
$rootDir = Split-Path -Parent $PSScriptRoot
$versionTsPath = Join-Path $rootDir "client\app\src\lib\version.ts"
$versionTs = Get-Content $versionTsPath -Raw

if ($versionTs -match 'RED_VERSION\s*=\s*"([^"]+)"') {
    $version = $matches[1]
} else {
    $version = "101.0.0"
}

if ($versionTs -match 'RED_VERSION_NAME\s*=\s*"([^"]+)"') {
    $title = $matches[1]
} else {
    $title = "RED v$version - Sovereign Mesh OS: Zero-Mock & Multi-Language Field Edition"
}

$tag = "v$version"
$releaseAssets = Join-Path $rootDir "release-assets"
$apk1 = Join-Path $releaseAssets "red-latest.apk"
$apk2 = Join-Path $releaseAssets "red-v$version-release.apk"
$sums = Join-Path $releaseAssets "SHA256SUMS.txt"
$notesPath = Join-Path $rootDir "release_notes_v$version.md"

Write-Host "Publicando release $tag en GitHub ($title)..."
gh release create $tag $apk1 $apk2 $sums --title $title --notes-file $notesPath --latest
Write-Host "Release $tag publicada exitosamente."
