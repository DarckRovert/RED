(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,61384,t=>{"use strict";class e{static async generateDataUrl(e,i={}){if(!e)return"";let n=i.width||260,a=void 0!==i.margin?i.margin:1,o=i.darkColor||"#00E676",l=i.lightColor||"#04060A";try{let i=await t.A(73378),r=i.default||i;if("function"==typeof r?.toDataURL){let t=await r.toDataURL(e,{width:n,margin:a,color:{dark:o,light:l}});if(t&&t.startsWith("data:image/"))return t}}catch(t){console.warn("[OfflineQrEngine] Fallo renderizado Canvas PNG, intentando SVG:",t)}try{let i=await t.A(73378),n=i.default||i;if("function"==typeof n?.toString){let t=await n.toString(e,{type:"svg",margin:a,color:{dark:o,light:l}});if(t&&t.includes("<svg"))return`data:image/svg+xml;utf8,${encodeURIComponent(t)}`}}catch(t){console.warn("[OfflineQrEngine] Fallo renderizado SVG qrcode:",t)}return this.generateAutonomousFallbackSvg(e,n,o,l)}static generateAutonomousFallbackSvg(t,e,i,n){let a=t.length>36?`${t.slice(0,36)}...`:t,o=`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${e} ${e}" width="${e}" height="${e}">
  <rect width="100%" height="100%" fill="${n}" rx="12"/>
  <rect x="12" y="12" width="${e-24}" height="${e-24}" fill="none" stroke="${i}" stroke-width="2" stroke-dasharray="4,4" rx="8"/>
  <text x="50%" y="35%" dominant-baseline="middle" text-anchor="middle" fill="${i}" font-family="monospace" font-weight="bold" font-size="14">
    RED QR OFFLINE
  </text>
  <rect x="${e/2-24}" y="${e/2-24}" width="48" height="48" fill="${i}" opacity="0.2" rx="6"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${i}" font-family="monospace" font-weight="bold" font-size="20">
    ⚡
  </text>
  <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" fill="${i}" font-family="monospace" font-size="10">
    ${a}
  </text>
  <text x="50%" y="85%" dominant-baseline="middle" text-anchor="middle" fill="#888888" font-family="monospace" font-size="8">
    MODO SOBERANO SIN RED
  </text>
</svg>`.trim();return`data:image/svg+xml;utf8,${encodeURIComponent(o)}`}}t.s(["OfflineQrEngine",()=>e])},73378,t=>{t.v(e=>Promise.all(["static/chunks/0cbbe76af706843a.js"].map(e=>t.l(e))).then(()=>e(73134)))}]);