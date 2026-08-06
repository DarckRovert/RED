@echo off
cd /d "d:\PROYECTO RED"
git add assets/red-v24.0.0-latest.apk client/app/public/assets/red-v24.0.0-latest.apk client/app/out/assets/red-v24.0.0-latest.apk app-release.apk 2>nul
git add -A
git commit -m "deploy: Incluir APK ejecutable v24.0.0 compilado con todos los arreglos para descarga directa en la web"
git push origin main
git push origin main:master --force
echo WEB_APK_DEPLOY_DONE
