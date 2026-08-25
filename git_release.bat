@echo off
cd /d "d:\PROYECTO RED"
git commit -m "feat(release): v62.0.0 Hardened P2P & Unified Protocol Edition"
git tag v62.0.0
git push origin main
git push origin v62.0.0
echo.
echo === Push completado ===
echo Verificando ultimo commit:
git log --oneline -3
