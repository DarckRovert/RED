(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,61384,t=>{"use strict";class e{static async generateDataUrl(e,o={}){if(!e)return"";let i=o.width||260,n=void 0!==o.margin?o.margin:1,a=o.darkColor||"#00E676",l=o.lightColor||"#04060A";try{let o=await t.A(73378),r=o.default||o;if("function"==typeof r?.toDataURL){let t=await r.toDataURL(e,{width:i,margin:n,color:{dark:a,light:l}});if(t&&t.startsWith("data:image/"))return t}}catch(t){console.warn("[OfflineQrEngine] Fallo renderizado Canvas PNG, intentando SVG:",t)}try{let o=await t.A(73378),i=o.default||o;if("function"==typeof i?.toString){let t=await i.toString(e,{type:"svg",margin:n,color:{dark:a,light:l}});if(t&&t.includes("<svg"))return`data:image/svg+xml;utf8,${encodeURIComponent(t)}`}}catch(t){console.warn("[OfflineQrEngine] Fallo renderizado SVG qrcode:",t)}return this.generateAutonomousFallbackSvg(e,i,a,l)}static generateAutonomousFallbackSvg(t,e,o,i){let n=t.length>36?`${t.slice(0,36)}...`:t,a=`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${e} ${e}" width="${e}" height="${e}">
  <rect width="100%" height="100%" fill="${i}" rx="12"/>
  <rect x="12" y="12" width="${e-24}" height="${e-24}" fill="none" stroke="${o}" stroke-width="2" stroke-dasharray="4,4" rx="8"/>
  <text x="50%" y="35%" dominant-baseline="middle" text-anchor="middle" fill="${o}" font-family="monospace" font-weight="bold" font-size="14">
    RED QR OFFLINE
  </text>
  <rect x="${e/2-24}" y="${e/2-24}" width="48" height="48" fill="${o}" opacity="0.2" rx="6"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${o}" font-family="monospace" font-weight="bold" font-size="20">
    ⚡
  </text>
  <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" fill="${o}" font-family="monospace" font-size="10">
    ${n}
  </text>
  <text x="50%" y="85%" dominant-baseline="middle" text-anchor="middle" fill="#888888" font-family="monospace" font-size="8">
    MODO SOBERANO SIN RED
  </text>
</svg>`.trim();return`data:image/svg+xml;utf8,${encodeURIComponent(a)}`}}t.s(["OfflineQrEngine",()=>e])},62794,t=>{"use strict";async function e(t){if(navigator.clipboard&&(window.isSecureContext||"localhost"===window.location.hostname||"127.0.0.1"===window.location.hostname))try{return await navigator.clipboard.writeText(t),!0}catch{}try{let e=document.createElement("textarea");e.value=t,e.setAttribute("readonly",""),e.style.position="fixed",e.style.top="-9999px",e.style.left="-9999px",e.style.opacity="0",document.body.appendChild(e),e.focus(),e.select();let o=document.execCommand("copy");return document.body.removeChild(e),o}catch{return!1}}t.s(["copyToClipboard",()=>e])},73378,t=>{t.v(e=>Promise.all(["static/chunks/0cbbe76af706843a.js"].map(e=>t.l(e))).then(()=>e(73134)))}]);