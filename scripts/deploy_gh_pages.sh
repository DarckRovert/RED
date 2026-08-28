#!/usr/bin/env bash
set -e

echo "🚀 Building Next.js static export for GitHub Pages..."
cd client/app
npm run build:gh

echo "🔧 Injecting .nojekyll and 404.html..."
touch out/.nojekyll
cp out/index.html out/404.html

echo "📦 Publishing to gh-pages branch..."
cd out
rm -rf .git
git init
git add -A
git commit -m "deploy: GitHub Pages production release v66.0.0"
git branch -M gh-pages
git remote add origin https://github.com/DarckRovert/RED.git
git push -f origin gh-pages
rm -rf .git

echo "✅ GitHub Pages deployment complete!"
