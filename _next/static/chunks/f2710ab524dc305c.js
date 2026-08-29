(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,35286,e=>{"use strict";var t=e.i(43476),a=e.i(71645),i=e.i(19439),r=e.i(26520),o=e.i(69104),n=e.i(55211),s=e.i(83036);let d={bazaar:{name:"Mi Tienda Trueque P2P",id:"org.redmesh.custombazaar",cat:"market",icon:"🛒",desc:"Tienda de suministros tácticos y trueque descentralizado con pasarela Multi-Rail integrada.",permissions:["identity","payments","mesh_pubsub","storage"],html:`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tienda Trueque P2P</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: #06070B; color: #E2E8F0; padding: 16px; }
    .header { text-align: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; }
    h1 { font-size: 1.2rem; color: #00E5FF; font-weight: 800; }
    .user-chip { font-size: 0.72rem; color: #94A3B8; font-family: monospace; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
    .card { background: rgba(18, 20, 36, 0.85); border: 1px solid rgba(0, 229, 255, 0.25); border-radius: 12px; padding: 12px; text-align: center; }
    .card-icon { font-size: 2rem; margin-bottom: 6px; }
    .card-title { font-size: 0.85rem; font-weight: 700; color: #FFF; }
    .card-price { font-size: 0.95rem; font-weight: 900; color: #00E676; margin: 6px 0; }
    button { width: 100%; background: linear-gradient(135deg, #00E676, #00B0FF); color: #000; border: none; padding: 8px; border-radius: 8px; font-weight: 800; font-size: 0.78rem; cursor: pointer; transition: opacity 0.2s; }
    button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🛒 Tienda T\xe1ctica P2P</h1>
    <div id="user" class="user-chip">Identificando nodo...</div>
  </div>
  <div class="grid">
    <div class="card">
      <div class="card-icon">📻</div>
      <div class="card-title">Radio LoRa 915MHz</div>
      <div class="card-price">$25.00</div>
      <button onclick="buy('Radio LoRa 915MHz', 25.00)">Comprar Multi-Rail</button>
    </div>
    <div class="card">
      <div class="card-icon">🔋</div>
      <div class="card-title">Bater\xeda Solar 20Ah</div>
      <div class="card-price">$45.00</div>
      <button onclick="buy('Bater\xeda Solar 20Ah', 45.00)">Comprar Multi-Rail</button>
    </div>
  </div>
  <script>
    let myDid = '';
    window.addEventListener('DOMContentLoaded', async () => {
      try {
        const profile = await window.RedSDK.identity.getProfile();
        myDid = profile.did;
        document.getElementById('user').textContent = 'Operador: ' + profile.nickname + ' (' + profile.did.slice(0, 10) + '...)';
      } catch(e) {
        document.getElementById('user').textContent = 'Modo Local Sandbox';
      }
    });

    async function buy(item, price) {
      try {
        const receipt = await window.RedSDK.payments.requestPayment({
          title: item,
          description: 'Suministro t\xe1ctico adquirido v\xeda Mini-App Sovereign',
          amount: price,
          currency: 'USD',
          merchant: { name: 'Comercio Malla RED', did: 'did:red:merchant_hq' },
          supportedRails: ['paypal', 'web3_usdt', 'lightning', 'offgrid_voucher']
        });
        window.RedSDK.ui.showToast('\xa1Pago exitoso! Tx: ' + receipt.transactionId.slice(0, 12), 'success');
      } catch(e) {
        window.RedSDK.ui.showToast('Pago no completado: ' + e.message, 'error');
      }
    }
  </script>
</body>
</html>`},game:{name:"Batalla Naval Malla P2P",id:"org.redmesh.customgame",cat:"games",icon:"🚢",desc:"Juego multijugador descentralizado sobre canales PubSub de radio.",permissions:["identity","mesh_pubsub","storage"],html:`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batalla Naval Mesh</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: monospace; }
    body { background: #020204; color: #00E5FF; padding: 16px; text-align: center; }
    h1 { font-size: 1.1rem; color: #E8213A; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; max-width: 240px; margin: 12px auto; }
    .cell { aspect-ratio: 1; background: #0e1222; border: 1px solid #00E5FF44; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; cursor: pointer; }
    .cell:hover { background: #00E5FF22; }
    .hit { background: #E8213A !important; color: #FFF; }
    .water { background: #00E5FF33 !important; }
    .log { font-size: 0.75rem; color: #94A3B8; margin-top: 10px; min-height: 24px; }
  </style>
</head>
<body>
  <h1>🚢 Radar T\xe1ctico de Batalla</h1>
  <div class="log" id="status">Dispara a las coordenadas de la cuadr\xedcula</div>
  <div class="grid" id="board"></div>
  <script>
    const board = document.getElementById('board');
    const status = document.getElementById('status');
    const ships = [2, 7, 11];

    for (let i = 0; i < 16; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.onclick = () => shoot(i, cell);
      board.appendChild(cell);
    }

    async function shoot(idx, el) {
      if (el.classList.contains('hit') || el.classList.contains('water')) return;
      if (ships.includes(idx)) {
        el.classList.add('hit');
        el.textContent = '💥';
        status.textContent = '\xa1IMPACTO DIRECTO en sector [' + idx + ']!';
        await window.RedSDK.mesh.broadcast('battleship', { action: 'HIT', sector: idx });
      } else {
        el.classList.add('water');
        el.textContent = '🌊';
        status.textContent = 'Agua en sector [' + idx + ']';
        await window.RedSDK.mesh.broadcast('battleship', { action: 'MISS', sector: idx });
      }
    }
  </script>
</body>
</html>`},notes:{name:"Bloc Criptográfico Táctico",id:"org.redmesh.customnotes",cat:"utility",icon:"🔒",desc:"Cuaderno de notas cifradas y firmadas digitalmente con tu clave de identidad Ed25519.",permissions:["identity","storage","clipboard"],html:`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bloc Criptogr\xe1fico</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: monospace; }
    body { background: #06070B; color: #FFF; padding: 16px; }
    h1 { font-size: 1rem; color: #00E676; margin-bottom: 8px; }
    textarea { width: 100%; height: 120px; background: #0c0e18; border: 1px solid rgba(0,230,118,0.3); border-radius: 8px; color: #00E676; padding: 10px; font-size: 0.8rem; margin-bottom: 8px; outline: none; }
    .btns { display: flex; gap: 8px; }
    button { flex: 1; background: #121626; border: 1px solid rgba(255,255,255,0.2); color: #FFF; padding: 8px; border-radius: 6px; font-weight: bold; font-size: 0.75rem; cursor: pointer; }
    button.primary { background: #00E676; color: #000; border: none; }
    .meta { font-size: 0.7rem; color: #94A3B8; margin-top: 8px; word-break: break-all; }
  </style>
</head>
<body>
  <h1>🔒 Bloc Criptogr\xe1fico Seguro</h1>
  <textarea id="txt" placeholder="Escribe tus coordenadas o reporte confidencial..."></textarea>
  <div class="btns">
    <button class="primary" onclick="save()">💾 Guardar</button>
    <button onclick="sign()">✍️ Firmar Ed25519</button>
  </div>
  <div class="meta" id="out"></div>
  <script>
    window.addEventListener('DOMContentLoaded', async () => {
      const saved = await window.RedSDK.storage.getItem('quick_note');
      if (saved) document.getElementById('txt').value = saved;
    });

    async function save() {
      const val = document.getElementById('txt').value;
      await window.RedSDK.storage.setItem('quick_note', val);
      window.RedSDK.ui.showToast('Nota guardada en almacenamiento aislado', 'success');
    }

    async function sign() {
      const val = document.getElementById('txt').value;
      if (!val) return;
      const res = await window.RedSDK.identity.signData(val);
      document.getElementById('out').textContent = 'Firma: ' + res.signature;
      window.RedSDK.ui.showToast('Nota firmada con clave Ed25519', 'success');
    }
  </script>
</body>
</html>`}};e.s(["SovereignAppStoreModal",0,({userDid:e,onClose:l,onLaunchApp:c})=>{let[p,x]=(0,a.useState)("catalog"),[g,m]=(0,a.useState)([]),[u,b]=(0,a.useState)("all"),[h,y]=(0,a.useState)(""),[f,v]=(0,a.useState)("bazaar"),[w,j]=(0,a.useState)(d.bazaar.name),[S,F]=(0,a.useState)(d.bazaar.id),[k,R]=(0,a.useState)(d.bazaar.desc),[C,A]=(0,a.useState)(d.bazaar.cat),[E,z]=(0,a.useState)(d.bazaar.icon),[B,I]=(0,a.useState)(d.bazaar.permissions),[P,T]=(0,a.useState)(d.bazaar.html),[D,M]=(0,a.useState)(""),W=()=>{m(i.redAppRegistry.getAllApps())};(0,a.useEffect)(()=>{W()},[]),(0,a.useEffect)(()=>{if("creator"===p){let t={manifest:{id:S||"preview.app",name:w||"Vista Previa",version:"1.0.0",description:k||"",author:{name:"Operador Local",did:e},icon:E||"⚡",category:C,permissions:B,entryPoint:"index.html",createdAt:Date.now(),updatedAt:Date.now()},files:{"index.html":P}},a=r.RedAppBundleEngine.createBlobUrl(t);return M(a),()=>{a&&URL.revokeObjectURL(a)}}},[p,P,S,w,C,B,E,e]);let L=(0,a.useMemo)(()=>g.filter(e=>{let t="all"===u||e.manifest.category===u,a=e.manifest.name.toLowerCase().includes(h.toLowerCase())||e.manifest.description.toLowerCase().includes(h.toLowerCase())||e.manifest.id.toLowerCase().includes(h.toLowerCase());return t&&a}),[g,u,h]);return(0,t.jsx)("div",{style:{position:"fixed",inset:0,zIndex:9999,background:"rgba(2, 4, 10, 0.90)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"12px",userSelect:"none"},children:(0,t.jsxs)("div",{style:{width:"100%",maxWidth:"1024px",height:"92vh",maxHeight:"880px",borderRadius:"20px",boxShadow:"0 16px 50px rgba(0,0,0,0.85), 0 0 30px rgba(0, 230, 118, 0.15)",display:"flex",flexDirection:"column",overflow:"hidden",border:"1.5px solid rgba(0, 230, 118, 0.35)",background:"linear-gradient(180deg, rgba(14,18,34,0.98) 0%, rgba(6,8,16,0.99) 100%)"},children:[(0,t.jsxs)("div",{style:{padding:"12px 16px",background:"rgba(6, 8, 16, 0.95)",borderBottom:"1px solid rgba(255, 255, 255, 0.12)",display:"flex",flexWrap:"wrap",gap:"12px",justifyContent:"space-between",alignItems:"center"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"12px"},children:[(0,t.jsx)("div",{style:{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg, rgba(0,230,118,0.2) 0%, rgba(0,229,255,0.2) 100%)",border:"1px solid rgba(0,230,118,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",boxShadow:"0 0 15px rgba(0,230,118,0.2)"},children:"🏬"}),(0,t.jsxs)("div",{children:[(0,t.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:(0,t.jsxs)("h2",{style:{fontSize:"1rem",fontWeight:900,color:"#FFFFFF",letterSpacing:"0.5px",margin:0,display:"flex",alignItems:"center",gap:"8px"},children:["SOVEREIGN APP STORE",(0,t.jsx)("span",{style:{fontSize:"0.65rem",padding:"2px 6px",background:"rgba(0, 230, 118, 0.15)",border:"1px solid rgba(0, 230, 118, 0.5)",color:"var(--accent-emerald)",borderRadius:"4px",fontFamily:"JetBrains Mono, monospace",fontWeight:800},children:"v66.0.0"})]})}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px",fontSize:"0.72rem",color:"var(--text-muted)",fontFamily:"JetBrains Mono, monospace",marginTop:"2px"},children:[(0,t.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"var(--accent-emerald)",display:"inline-block"}}),(0,t.jsx)("span",{style:{maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:e}),(0,t.jsx)("span",{children:"•"}),(0,t.jsxs)("span",{style:{color:"var(--accent-cyan)",fontWeight:700},children:[g.length," dApps"]})]})]})]}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,t.jsxs)("label",{style:{padding:"6px 12px",background:"rgba(255, 255, 255, 0.06)",border:"1px solid rgba(255, 255, 255, 0.15)",color:"#FFFFFF",borderRadius:"10px",fontSize:"0.78rem",fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:"6px"},children:[(0,t.jsx)("span",{children:"📥 Importar"}),(0,t.jsx)("input",{type:"file",accept:".json,.redapp",onChange:e=>{let t=e.target.files?.[0];if(!t)return;let a=new FileReader;a.onload=e=>{try{let t=e.target?.result;if(!t)return;if(t.startsWith("RED_APP_V1:")||t.includes('"format":"RED_APP_PACKAGE_V1"')){let e=i.redAppRegistry.importAppPackage(t);if(e.isValid&&e.bundle){i.redAppRegistry.installApp(e.bundle),W(),s.toast.success(`\xa1Mini-App '${e.bundle.manifest.name}' instalada exitosamente!`),x("catalog");return}}let a=r.RedAppBundleEngine.importBundle(t);i.redAppRegistry.installApp(a),W(),s.toast.success(`\xa1Mini-App '${a.manifest.name}' instalada exitosamente!`),x("catalog")}catch(e){s.toast.error(`Error al importar: ${e.message}`)}},a.readAsText(t)},style:{display:"none"}})]}),(0,t.jsx)("button",{type:"button",onClick:()=>x("creator"===p?"catalog":"creator"),style:{padding:"6px 14px",borderRadius:"10px",fontSize:"0.78rem",fontWeight:900,cursor:"pointer",border:"none",background:"creator"===p?"var(--accent-emerald)":"linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",color:"#000000",boxShadow:"0 0 12px rgba(0, 230, 118, 0.3)"},children:(0,t.jsx)("span",{children:"creator"===p?"📦 Ver Catálogo":"➕ Crear Mini-App"})}),(0,t.jsx)("button",{type:"button",onClick:l,style:{background:"rgba(255, 255, 255, 0.08)",border:"1px solid rgba(255, 255, 255, 0.15)",color:"#FFFFFF",width:"32px",height:"32px",borderRadius:"8px",cursor:"pointer",fontSize:"0.9rem",fontWeight:900},children:"✕"})]})]}),(0,t.jsxs)("div",{style:{padding:"8px 16px",background:"rgba(6, 8, 16, 0.6)",borderBottom:"1px solid rgba(255, 255, 255, 0.08)",display:"flex",flexWrap:"wrap",gap:"8px",alignItems:"center",justifyContent:"space-between"},children:[(0,t.jsx)("div",{style:{display:"flex",gap:"6px",overflowX:"auto"},children:[{id:"catalog",label:"📦 Catálogo Soberano",count:g.length},{id:"creator",label:"🛠️ Creador & Live Preview",count:null}].map(e=>(0,t.jsxs)("button",{type:"button",onClick:()=>x(e.id),style:{padding:"6px 12px",borderRadius:"8px",fontSize:"0.78rem",fontWeight:800,cursor:"pointer",border:p===e.id?"1px solid var(--accent-emerald)":"1px solid transparent",background:p===e.id?"rgba(0, 230, 118, 0.15)":"transparent",color:p===e.id?"var(--accent-emerald)":"var(--text-secondary)"},children:[(0,t.jsx)("span",{children:e.label}),null!==e.count&&(0,t.jsx)("span",{style:{fontSize:"0.68rem",padding:"1px 6px",background:"rgba(255,255,255,0.1)",borderRadius:"10px",marginLeft:"6px",fontFamily:"JetBrains Mono, monospace"},children:e.count})]},e.id))}),"catalog"===p&&(0,t.jsx)("div",{style:{width:"240px"},children:(0,t.jsx)("input",{type:"text",placeholder:"🔍 Buscar Mini-Apps...",value:h,onChange:e=>y(e.target.value),className:"tactical-input",style:{width:"100%",padding:"6px 10px",fontSize:"0.78rem"}})})]}),"catalog"===p&&(0,t.jsxs)("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"},children:[(0,t.jsx)("div",{style:{padding:"8px 16px",borderBottom:"1px solid rgba(255, 255, 255, 0.08)",display:"flex",gap:"6px",overflowX:"auto"},children:[{id:"all",label:"Todas las Apps"},{id:"market",label:"🛒 Mercado P2P"},{id:"utility",label:"🔧 Utilidades"},{id:"emergency",label:"🩹 Emergencia"},{id:"games",label:"🎮 Juegos"}].map(e=>(0,t.jsx)("button",{type:"button",onClick:()=>b(e.id),style:{padding:"4px 10px",borderRadius:"8px",fontSize:"0.75rem",fontWeight:800,cursor:"pointer",border:u===e.id?"1px solid var(--accent-cyan)":"1px solid rgba(255, 255, 255, 0.08)",background:u===e.id?"rgba(0, 229, 255, 0.15)":"rgba(255, 255, 255, 0.03)",color:u===e.id?"var(--accent-cyan)":"var(--text-secondary)",whiteSpace:"nowrap"},children:e.label},e.id))}),(0,t.jsx)("div",{style:{flex:1,overflowY:"auto",padding:"16px",display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:"14px"},children:L.map(a=>(0,t.jsxs)("div",{style:{background:"linear-gradient(180deg, rgba(16, 22, 44, 0.8) 0%, rgba(8, 12, 26, 0.9) 100%)",border:"1px solid rgba(255, 255, 255, 0.12)",borderRadius:"16px",padding:"14px",display:"flex",flexDirection:"column",justifyContent:"space-between",boxShadow:"0 4px 16px rgba(0, 0, 0, 0.5)"},children:[(0,t.jsxs)("div",{children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px",marginBottom:"10px"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px"},children:[(0,t.jsx)("div",{style:{width:"44px",height:"44px",borderRadius:"12px",background:"rgba(0, 0, 0, 0.6)",border:"1px solid rgba(255, 255, 255, 0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem"},children:a.manifest.icon||"📱"}),(0,t.jsxs)("div",{children:[(0,t.jsx)("h3",{style:{fontSize:"0.88rem",fontWeight:900,color:"#FFFFFF",margin:0},children:a.manifest.name}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"6px",fontSize:"0.68rem",color:"var(--text-muted)",fontFamily:"JetBrains Mono, monospace",marginTop:"2px"},children:[(0,t.jsxs)("span",{children:["v",a.manifest.version]}),(0,t.jsx)("span",{children:"•"}),(0,t.jsx)("span",{style:{textTransform:"uppercase",color:"var(--accent-emerald)",fontWeight:800},children:a.manifest.category})]})]})]}),a.isBuiltin?(0,t.jsx)("span",{style:{fontSize:"0.62rem",padding:"2px 6px",background:"rgba(0, 230, 118, 0.15)",border:"1px solid rgba(0, 230, 118, 0.5)",color:"var(--accent-emerald)",borderRadius:"6px",fontWeight:900,textTransform:"uppercase"},children:"Oficial"}):(0,t.jsx)("span",{style:{fontSize:"0.62rem",padding:"2px 6px",background:"rgba(0, 229, 255, 0.15)",border:"1px solid rgba(0, 229, 255, 0.5)",color:"var(--accent-cyan)",borderRadius:"6px",fontWeight:900,textTransform:"uppercase"},children:"Soberana"})]}),(0,t.jsx)("p",{style:{fontSize:"0.78rem",color:"var(--text-secondary)",margin:"0 0 10px 0",lineHeight:1.4},children:a.manifest.description}),(0,t.jsx)("div",{style:{display:"flex",flexWrap:"wrap",gap:"4px",marginBottom:"12px"},children:a.manifest.permissions.map(e=>(0,t.jsxs)("span",{style:{fontSize:"0.64rem",padding:"2px 6px",background:"rgba(0, 0, 0, 0.5)",border:"1px solid rgba(255, 255, 255, 0.08)",color:"var(--text-secondary)",borderRadius:"4px",fontFamily:"JetBrains Mono, monospace"},children:["🔒 ",e]},e))})]}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:"10px",borderTop:"1px solid rgba(255, 255, 255, 0.08)",marginTop:"auto"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"6px"},children:[(0,t.jsx)("button",{type:"button",onClick:()=>(t=>{try{let a=i.redAppRegistry.exportAppPackage(t.manifest.id),r={type:"MINIAPP_PACKAGE_BROADCAST",appId:t.manifest.id,manifest:t.manifest,pkg:a,authorDid:e,timestamp:Date.now()},d=new TextEncoder().encode(JSON.stringify(r));o.meshRouter.broadcast((0,n.encode)((0,n.createPacket)(e,"broadcast",d))),s.toast.success(`📡 Mini-App '${t.manifest.name}' transmitida por radio/mesh.`)}catch(e){s.toast.error(`Error al transmitir: ${e.message}`)}})(a.bundle),style:{padding:"6px 8px",background:"rgba(255, 255, 255, 0.06)",border:"1px solid rgba(255, 255, 255, 0.12)",color:"#FFFFFF",borderRadius:"8px",fontSize:"0.75rem",cursor:"pointer"},title:"Transmitir paquete por radio/malla",children:"📡"}),(0,t.jsx)("button",{type:"button",onClick:()=>{var e;let t,r,o;return e=a.bundle,t=new Blob([i.redAppRegistry.exportAppPackage(e.manifest.id)||JSON.stringify(e,null,2)],{type:"application/json"}),r=URL.createObjectURL(t),void((o=document.createElement("a")).href=r,o.download=`${e.manifest.id}.redapp`,o.click(),URL.revokeObjectURL(r),s.toast.info(`📦 Paquete firmado ${e.manifest.name} exportado.`))},style:{padding:"6px 8px",background:"rgba(255, 255, 255, 0.06)",border:"1px solid rgba(255, 255, 255, 0.12)",color:"#FFFFFF",borderRadius:"8px",fontSize:"0.75rem",cursor:"pointer"},title:"Exportar archivo .redapp",children:"💾"}),!a.isBuiltin&&(0,t.jsx)("button",{type:"button",onClick:()=>{var e;return e=a.manifest.id,void(i.redAppRegistry.uninstallApp(e)?(s.toast.info("Mini-App desinstalada."),W()):s.toast.error("No se pueden desinstalar aplicaciones nativas del sistema."))},style:{padding:"6px 8px",background:"rgba(232, 33, 58, 0.15)",border:"1px solid rgba(232, 33, 58, 0.4)",color:"var(--accent-crimson)",borderRadius:"8px",fontSize:"0.75rem",cursor:"pointer"},title:"Eliminar Mini-App local",children:"🗑️"})]}),(0,t.jsxs)("button",{type:"button",onClick:()=>c(a.bundle),style:{padding:"6px 14px",background:"linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",color:"#000000",fontWeight:900,borderRadius:"10px",fontSize:"0.78rem",border:"none",cursor:"pointer",boxShadow:"0 0 10px rgba(0, 230, 118, 0.3)",display:"flex",alignItems:"center",gap:"6px"},children:[(0,t.jsx)("span",{children:"EJECUTAR"}),(0,t.jsx)("span",{children:"➔"})]})]})]},a.manifest.id))})]}),"creator"===p&&(0,t.jsxs)("div",{style:{flex:1,display:"flex",flexDirection:"row",overflow:"hidden"},children:[(0,t.jsxs)("div",{style:{flex:1,padding:"16px",overflowY:"auto",borderRight:"1px solid rgba(255, 255, 255, 0.1)",display:"flex",flexDirection:"column",gap:"12px",fontSize:"0.78rem"},children:[(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"},children:[(0,t.jsx)("h3",{style:{fontSize:"0.88rem",fontWeight:900,color:"#FFFFFF",margin:0,display:"flex",alignItems:"center",gap:"6px"},children:(0,t.jsx)("span",{children:"🛠️ Creador & Editor de dApps"})}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,t.jsx)("span",{style:{color:"var(--text-muted)"},children:"Plantilla:"}),(0,t.jsxs)("select",{value:f,onChange:e=>{var t;let a;(a=d[t=e.target.value])&&(v(t),j(a.name),F(a.id),R(a.desc),A(a.cat),z(a.icon),I(a.permissions),T(a.html))},style:{padding:"4px 8px",background:"rgba(0,0,0,0.6)",border:"1px solid rgba(0, 230, 118, 0.4)",color:"var(--accent-emerald)",borderRadius:"8px",fontWeight:800,fontFamily:"JetBrains Mono, monospace",outline:"none"},children:[(0,t.jsx)("option",{value:"bazaar",children:"🛒 Tienda / Trueque P2P"}),(0,t.jsx)("option",{value:"game",children:"🎮 Batalla Naval Malla"}),(0,t.jsx)("option",{value:"notes",children:"🔒 Bloc Criptográfico"})]})]})]}),(0,t.jsxs)("form",{onSubmit:t=>{if(t.preventDefault(),!w.trim()||!S.trim())return void s.toast.error("El nombre y el App ID son obligatorios.");let a={id:S.trim().toLowerCase(),name:w.trim(),version:"1.0.0",description:k.trim(),author:{name:"Operador Soberano",did:e},icon:E.trim()||"📱",category:C,permissions:B,entryPoint:"index.html",createdAt:Date.now(),updatedAt:Date.now()},r={manifest:a,files:{"index.html":P}};i.redAppRegistry.installApp(r);try{let t={type:"MINIAPP_MANIFEST",appId:a.id,manifest:a,timestamp:Date.now()},i=new TextEncoder().encode(JSON.stringify(t));o.meshRouter.broadcast((0,n.encode)((0,n.createPacket)(e,"broadcast",i)))}catch{}s.toast.success(`🚀 Mini-App '${a.name}' instalada y transmitida a la malla.`),W(),x("catalog"),c(r)},style:{display:"flex",flexDirection:"column",gap:"10px"},children:[(0,t.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"},children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"Nombre de la Aplicación"}),(0,t.jsx)("input",{type:"text",required:!0,value:w,onChange:e=>j(e.target.value),placeholder:"Mi Calculadora Solar",className:"tactical-input",style:{width:"100%"}})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"App ID Único (Reverse DNS)"}),(0,t.jsx)("input",{type:"text",required:!0,value:S,onChange:e=>F(e.target.value),placeholder:"com.usuario.solar",className:"tactical-input",style:{width:"100%",fontFamily:"JetBrains Mono, monospace"}})]})]}),(0,t.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"},children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"Categoría"}),(0,t.jsxs)("select",{value:C,onChange:e=>A(e.target.value),className:"tactical-input",style:{width:"100%"},children:[(0,t.jsx)("option",{value:"utility",children:"Utilidad"}),(0,t.jsx)("option",{value:"market",children:"Mercado"}),(0,t.jsx)("option",{value:"emergency",children:"Emergencia"}),(0,t.jsx)("option",{value:"games",children:"Juegos"})]})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"Emoji / Icono"}),(0,t.jsx)("input",{type:"text",value:E,onChange:e=>z(e.target.value),className:"tactical-input",style:{width:"100%",textAlign:"center",fontSize:"1.2rem"}})]})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"Descripción"}),(0,t.jsx)("input",{type:"text",value:k,onChange:e=>R(e.target.value),placeholder:"Descripción breve de la utilidad...",className:"tactical-input",style:{width:"100%"}})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"Permisos Solicitados"}),(0,t.jsx)("div",{style:{display:"flex",flexWrap:"wrap",gap:"6px"},children:["identity","mesh_pubsub","payments","storage","ai","sensors"].map(e=>{let a=B.includes(e);return(0,t.jsxs)("button",{type:"button",onClick:()=>{B.includes(e)?I(B.filter(t=>t!==e)):I([...B,e])},style:{padding:"4px 8px",borderRadius:"6px",fontSize:"0.68rem",fontFamily:"JetBrains Mono, monospace",fontWeight:800,cursor:"pointer",border:a?"1px solid var(--accent-emerald)":"1px solid rgba(255,255,255,0.1)",background:a?"rgba(0, 230, 118, 0.2)":"rgba(0,0,0,0.4)",color:a?"var(--accent-emerald)":"var(--text-muted)"},children:[a?"✓ ":"+ "," ",e]},e)})})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"Código Fuente Sandboxed (`index.html`)"}),(0,t.jsx)("textarea",{rows:10,value:P,onChange:e=>T(e.target.value),className:"tactical-input",style:{width:"100%",color:"var(--accent-emerald)",fontFamily:"JetBrains Mono, monospace",fontSize:"0.72rem",lineHeight:1.4},spellCheck:!1})]}),(0,t.jsx)("button",{type:"submit",style:{width:"100%",padding:"10px",background:"linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",color:"#000000",fontWeight:900,borderRadius:"12px",fontSize:"0.82rem",border:"none",cursor:"pointer",boxShadow:"0 0 16px rgba(0, 230, 118, 0.35)"},children:"🚀 INSTALAR & EMITIR PAQUETE A LA MALLA"})]})]}),(0,t.jsxs)("div",{style:{flex:1,background:"rgba(0, 0, 0, 0.8)",padding:"16px",display:"flex",flexDirection:"column"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:"8px",marginBottom:"8px",borderBottom:"1px solid rgba(255, 255, 255, 0.1)"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,t.jsx)("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:"var(--accent-emerald)"}}),(0,t.jsx)("span",{style:{fontSize:"0.78rem",fontWeight:800,color:"#FFFFFF"},children:"VISTA PREVIA EN VIVO (SANDBOX)"})]}),(0,t.jsx)("span",{style:{fontSize:"0.68rem",color:"var(--accent-cyan)",fontFamily:"JetBrains Mono, monospace"},children:"window.RedSDK Activo"})]}),(0,t.jsx)("div",{style:{flex:1,background:"#020306",borderRadius:"14px",overflow:"hidden",border:"1px solid rgba(255, 255, 255, 0.12)",position:"relative"},children:D?(0,t.jsx)("iframe",{src:D,title:"Live Preview",sandbox:"allow-scripts allow-forms",style:{width:"100%",height:"100%",border:"none",background:"#020306"}}):(0,t.jsx)("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"var(--text-muted)",fontSize:"0.75rem"},children:"Generando sandbox..."})})]})]})]})})}])},18893,e=>{e.n(e.i(35286))}]);