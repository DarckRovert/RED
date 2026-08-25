@echo off
cd /d "d:\PROYECTO RED"

echo === Añadiendo todos los archivos actualizados ===
git add -A

echo === Creando commit final de lanzamiento v62.0.0 ===
git commit -m "feat(release): v62.0.0 Hardened P2P & Unified Protocol Edition — complete web bundle, SHA256SUMS, and multi-device deploy"

echo === Actualizando tag v62.0.0 ===
git tag -d v62.0.0 2>nul
git tag v62.0.0

echo === Pushing a rama main y tag v62.0.0 en GitHub ===
git push origin main
git push origin v62.0.0 --force

echo === Verificando estado ===
git log --oneline -3
echo TAGS:
git tag --sort=-version:refname | findstr v62
