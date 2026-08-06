@echo off
cd /d "d:\PROYECTO RED"
git add .nojekyll index.html 404.html _next _not-found offline sw.js script.js styles.css 2>nul
git add -A
git commit -m "deploy: Publicar version web estatica actualizada en GitHub Pages (https://darckrovert.github.io/RED/)"
git push origin main
git push origin main:master --force
echo WEB_DEPLOY_DONE
