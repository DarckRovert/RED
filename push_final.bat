@echo off
cd /d "d:\PROYECTO RED"

echo === Añadiendo todos los archivos actualizados ===
git add -A

echo === Creando commit final de lanzamiento v60.0.0 ===
git commit -m "feat(release): v60.0.0 Real Connections Master Edition — complete web bundle, SHA256SUMS, and multi-device deploy"

echo === Actualizando tag v60.0.0 ===
git tag -d v60.0.0 2>nul
git tag v60.0.0

echo === Pushing a rama main y tag v60.0.0 en GitHub ===
git push origin main
git push origin v60.0.0 --force

echo === Verificando estado ===
git log --oneline -3
echo TAGS:
git tag --sort=-version:refname | findstr v60
