@echo off
cd /d "d:\PROYECTO RED"
git commit -m "feat(release): v60.0.0 Real Connections Master Edition"
git tag v60.0.0
git push origin main
git push origin v60.0.0
echo.
echo === Push completado ===
echo Verificando ultimo commit:
git log --oneline -3
