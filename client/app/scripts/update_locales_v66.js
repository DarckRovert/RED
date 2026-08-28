const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'lib', 'i18n', 'locales');

const translations = {
  ar: { cat_miniapps: "🏪 التطبيقات المصغرة والتصفح", app_store: "متجر التطبيقات P2P", hyper_browser: "متصفح RED الشبكي" },
  de: { cat_miniapps: "🏪 Souveräne Mini-Apps & Web-Browsing", app_store: "Sovereign App Store (Mini-Apps)", hyper_browser: "RED Hyper-Browser Mesh" },
  fr: { cat_miniapps: "🏪 Mini-Apps Souveraines & Navigation Web", app_store: "Sovereign App Store (Mini-Apps)", hyper_browser: "RED Hyper-Browser Mesh" },
  it: { cat_miniapps: "🏪 Mini-App Sovrane & Navigazione Web", app_store: "Sovereign App Store (Mini-Apps)", hyper_browser: "RED Hyper-Browser Mesh" },
  ja: { cat_miniapps: "🏪 自律型ミニアプリ＆ウェブブラウジング", app_store: "Sovereign App Store（ミニアプリ）", hyper_browser: "RED Hyper-Browser Mesh" },
  ko: { cat_miniapps: "🏪 자율형 미니앱 \u0026 웹 브라우징", app_store: "Sovereign App Store (미니앱)", hyper_browser: "RED Hyper-Browser Mesh" },
  pt: { cat_miniapps: "🏪 Mini-Apps Soberanos & Navegação Web", app_store: "Sovereign App Store (Mini-Apps)", hyper_browser: "RED Hyper-Browser Mesh" },
  qu: { cat_miniapps: "🏪 Kikin Mini-Appskuna & Web Maskay", app_store: "Sovereign App Store (Mini-Apps)", hyper_browser: "RED Hyper-Browser Mesh" },
  ru: { cat_miniapps: "🏪 Суверенные мини-приложения и веб", app_store: "Суверенный магазин приложений P2P", hyper_browser: "RED Hyper-Browser Mesh" },
  zh: { cat_miniapps: "🏪 主权微应用与网页浏览", app_store: "主权应用商店 (微应用)", hyper_browser: "RED Hyper-Browser Mesh" }
};

for (const [lang, trans] of Object.entries(translations)) {
  const filePath = path.join(localesDir, `${lang}.ts`);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('cat_miniapps:')) {
    content = content.replace(
      /cat_tools_system:\s*"[^"]*",/g,
      `cat_tools_system: "...",\n        cat_miniapps: "${trans.cat_miniapps}",\n        app_store: "${trans.app_store}",\n        hyper_browser: "${trans.hyper_browser}",`
    );
    // restore cat_tools_system original line
    const origMatch = fs.readFileSync(filePath, 'utf8').match(/cat_tools_system:\s*"[^"]*",/);
    if (origMatch) {
      content = content.replace('cat_tools_system: "...",', origMatch[0]);
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${lang}.ts`);
  }
}
console.log('All locales updated successfully.');
