@echo off
cd /d "d:\PROYECTO RED"
git add assets/red-v24.0.0-latest.apk client/app/public/assets/red-v24.0.0-latest.apk client/app/out/assets/red-v24.0.0-latest.apk app-release.apk 2>nul
git add -A
git commit -m "deploy: Actualizar plataforma y sitio web RED en la rama principal main"
git push origin main
echo WEB_APK_DEPLOY_DONE
