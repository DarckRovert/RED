@echo off
cd /d "d:\PROYECTO RED"
git add -A
git commit -m "deploy: Actualizar plataforma y sitio web RED en main (v64.0.0)"
git push origin main
echo WEB_DEPLOY_DONE
