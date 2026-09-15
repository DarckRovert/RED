(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,19439,e=>{"use strict";var t=e.i(67034);let a={manifest:{id:"org.redmesh.bazaar",name:"RED Bazaar P2P",version:"1.0.0",description:"Mercado descentralizado de suministros y trueque con pagos Multi-Rail (PayPal, USDT, Vouchers).",author:{name:"RED Core Team",did:"did:red:0000000000000000000000000000000000000000000000000000000000000001"},icon:"🛒",category:"market",permissions:["identity","mesh_pubsub","payments","storage"],entryPoint:"index.html",createdAt:Date.now(),updatedAt:Date.now()},files:{"index.html":`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RED Bazaar P2P</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header class="app-header">
        <div class="header-main">
            <span class="app-icon">🛒</span>
            <div>
                <h1>RED Bazaar P2P</h1>
                <p class="subtitle">Comercio Soberano & Trueque Multi-Rail</p>
            </div>
        </div>
        <div id="user-badge" class="user-badge">Cargando identidad...</div>
    </header>

    <nav class="tab-nav">
        <button id="tab-catalog-btn" class="active" onclick="switchTab('catalog')">📦 Cat\xe1logo Local</button>
        <button id="tab-publish-btn" onclick="switchTab('publish')">➕ Publicar Oferta</button>
        <button id="tab-orders-btn" onclick="switchTab('orders')">🧾 Mis Compras</button>
    </nav>

    <!-- Tab 1: Cat\xe1logo -->
    <main id="catalog-tab" class="tab-content active">
        <div class="filter-bar">
            <input type="text" id="search-input" placeholder="Buscar suministros, radios, alimentos..." oninput="filterItems()">
            <button class="btn-refresh" onclick="refreshItems()">🔄 Actualizar Malla</button>
        </div>
        <div id="items-grid" class="items-grid"></div>
    </main>

    <!-- Tab 2: Publicar -->
    <section id="publish-tab" class="tab-content">
        <div class="card publish-card">
            <h2>📢 Publicar Oferta en la Malla P2P</h2>
            <p class="hint">Tu oferta ser\xe1 transmitida por radio/Bluetooth a todos los nodos en alcance.</p>
            
            <form id="publish-form" onsubmit="handlePublish(event)">
                <div class="form-group">
                    <label>T\xedtulo del Producto / Suministro</label>
                    <input type="text" id="pub-title" required placeholder="Ej: Radio Baofeng UV-5R con antena t\xe1ctica">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Precio Estimado (USD)</label>
                        <input type="number" id="pub-price" step="0.5" min="0.5" required placeholder="25.00">
                    </div>
                    <div class="form-group">
                        <label>Categor\xeda</label>
                        <select id="pub-category">
                            <option value="radio">📡 Comunicaciones / Radio</option>
                            <option value="energy">☀️ Energ\xeda / Solar</option>
                            <option value="medical">🩹 M\xe9dico / Botiqu\xedn</option>
                            <option value="food">🥫 Alimentos / Agua</option>
                            <option value="tools">🔧 Herramientas</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Tu Usuario de PayPal (Opcional para cobro en USD)</label>
                    <input type="text" id="pub-paypal" placeholder="ej: tu_usuario_paypal">
                </div>
                <div class="form-group">
                    <label>Tu Billetera USDT / Polygon (Opcional para cobro Cripto)</label>
                    <input type="text" id="pub-evm" placeholder="0x...">
                </div>
                <div class="form-group">
                    <label>Descripci\xf3n y Ubicaci\xf3n de Entrega</label>
                    <textarea id="pub-desc" rows="3" required placeholder="Estado del equipo, punto de encuentro o entrega por radio..."></textarea>
                </div>
                <button type="submit" class="btn-primary">📡 Emitir Oferta por la Malla</button>
            </form>
        </div>
    </section>

    <!-- Tab 3: Mis Compras / Recibos -->
    <section id="orders-tab" class="tab-content">
        <div class="card">
            <h2>🧾 Historial de Comprobantes Multi-Rail</h2>
            <div id="orders-list"></div>
        </div>
    </section>

    <script src="app.js"></script>
</body>
</html>`,"style.css":`* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { background: #0b0f19; color: #f3f4f6; padding: 12px; max-width: 900px; margin: 0 auto; }
.app-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f293d; padding-bottom: 12px; margin-bottom: 12px; }
.header-main { display: flex; align-items: center; gap: 10px; }
.app-icon { font-size: 28px; }
h1 { font-size: 18px; font-weight: 800; color: #60a5fa; }
.subtitle { font-size: 11px; color: #94a3b8; }
.user-badge { font-size: 11px; background: #1e293b; border: 1px solid #334155; padding: 4px 8px; border-radius: 6px; color: #38bdf8; }
.tab-nav { display: flex; gap: 6px; margin-bottom: 14px; }
.tab-nav button { flex: 1; padding: 8px; border: 1px solid #1e293b; background: #0f172a; color: #94a3b8; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; }
.tab-nav button.active { background: #2563eb; color: #fff; border-color: #3b82f6; }
.tab-content { display: none; }
.tab-content.active { display: block; }
.filter-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.filter-bar input { flex: 1; padding: 8px 12px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #fff; font-size: 13px; }
.btn-refresh { padding: 8px 12px; background: #1e293b; border: 1px solid #334155; color: #94a3b8; border-radius: 6px; cursor: pointer; font-size: 12px; }
.items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.item-card { background: #111827; border: 1px solid #1f293d; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; }
.item-card:hover { border-color: #3b82f6; }
.item-top { margin-bottom: 10px; }
.item-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #1e293b; color: #38bdf8; display: inline-block; margin-bottom: 6px; font-weight: 700; }
.item-title { font-size: 14px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; }
.item-desc { font-size: 12px; color: #94a3b8; line-height: 1.4; margin-bottom: 8px; }
.item-merchant { font-size: 10px; color: #64748b; font-family: monospace; }
.item-bottom { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #1e293b; padding-top: 10px; margin-top: 10px; }
.item-price { font-size: 16px; font-weight: 800; color: #10b981; }
.btn-buy { background: #10b981; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; }
.btn-buy:hover { background: #059669; }
.card { background: #111827; border: 1px solid #1f293d; border-radius: 10px; padding: 16px; }
.publish-card h2 { font-size: 15px; margin-bottom: 4px; color: #f1f5f9; }
.hint { font-size: 11px; color: #94a3b8; margin-bottom: 14px; }
.form-group { margin-bottom: 12px; }
.form-row { display: flex; gap: 10px; }
.form-row .form-group { flex: 1; }
label { display: block; font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 4px; }
input, select, textarea { width: 100%; padding: 8px 10px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #fff; font-size: 12px; }
.btn-primary { width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; }
.receipt-item { background: #1e293b; border-left: 3px solid #10b981; padding: 10px; border-radius: 6px; margin-bottom: 8px; font-size: 12px; }`,"app.js":`let currentUser = null;
let catalogItems = [
    {
        id: 'item-1',
        title: 'Radio Walkie Baofeng UV-5R T\xe1ctico',
        category: 'radio',
        price: 28.50,
        desc: 'Bater\xeda extendida 3800mAh, antena t\xe1ctica de 48cm, homologado para malla.',
        merchantName: 'Operador Delta-4',
        merchantDid: 'did:red:d4a819001b92c81726a8f1029384756a1029384756a1029384756a1029384756',
        paypal: 'operadordelta',
        evm: '0x71C836eB3f4D4e05bE7728373b9846b41295b364'
    },
    {
        id: 'item-2',
        title: 'Panel Solar Plegable 28W USB-C',
        category: 'energy',
        price: 49.00,
        desc: 'Carga ultrarr\xe1pida dual, resistente al agua IPX4, ideal para campo.',
        merchantName: 'Suministros Sierra',
        merchantDid: 'did:red:c1192837465a1029384756a1029384756a1029384756a1029384756a10293847',
        paypal: 'sierrasolar',
        evm: '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF'
    },
    {
        id: 'item-3',
        title: 'Botiqu\xedn IFAK TCCC Militar con Torniquete CAT',
        category: 'medical',
        price: 35.00,
        desc: 'Gasa hemost\xe1tica, vendaje israel\xed, parche tor\xe1cico ventilado.',
        merchantName: 'M\xe9dicos de Campa\xf1a',
        merchantDid: 'did:red:fa0192837465a1029384756a1029384756a1029384756a1029384756a10293847',
        paypal: 'medicosred',
        evm: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
    }
];

async function init() {
    try {
        currentUser = await window.RedSDK.identity.getProfile();
        document.getElementById('user-badge').textContent = '👤 ' + (currentUser.nickname || 'Operador') + ' (' + currentUser.did.slice(0, 14) + '...)';
    } catch (e) {
        document.getElementById('user-badge').textContent = '👤 Modo Invitado';
    }

    // Load persisted listings from isolated app storage
    try {
        const savedItems = await window.RedSDK.storage.getItem('bazaar_custom_items');
        if (savedItems && Array.isArray(savedItems)) {
            catalogItems = [...savedItems, ...catalogItems];
        }
    } catch (e) {}

    // Subscribe to real-time mesh broadcasts of new offers
    try {
        window.RedSDK.mesh.subscribe('bazaar_offers', (msg) => {
            if (msg.payload && msg.payload.title) {
                catalogItems.unshift(msg.payload);
                renderItems();
                window.RedSDK.ui.showToast("Nueva oferta recibida por radio: " + msg.payload.title, "info");
            }
        });
    } catch (e) {}

    renderItems();
    renderOrders();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-nav button').forEach(el => el.classList.remove('active'));
    document.getElementById(tab + '-tab').classList.add('active');
    document.getElementById('tab-' + tab + '-btn').classList.add('active');
}

function renderItems(filter = '') {
    const grid = document.getElementById('items-grid');
    grid.innerHTML = '';
    const filtered = catalogItems.filter(i => i.title.toLowerCase().includes(filter.toLowerCase()) || i.desc.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="color:#64748b; grid-column:1/-1; text-align:center; padding:20px;">No hay productos que coincidan con la b\xfasqueda.</p>';
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = \`
            <div class="item-top">
                <span class="item-badge">\${item.category.toUpperCase()}</span>
                <div class="item-title">\${item.title}</div>
                <div class="item-desc">\${item.desc}</div>
                <div class="item-merchant">Vendedor: \${item.merchantName}</div>
            </div>
            <div class="item-bottom">
                <div class="item-price">$\${item.price.toFixed(2)} <span style="font-size:10px; color:#94a3b8;">USD</span></div>
                <button class="btn-buy" onclick="buyItem('\${item.id}')">🛒 Pagar</button>
            </div>
        \`;
        grid.appendChild(card);
    });
}

function filterItems() {
    const val = document.getElementById('search-input').value;
    renderItems(val);
}

function refreshItems() {
    renderItems();
    window.RedSDK.ui.showToast("Cat\xe1logo sincronizado con la malla P2P.", "success");
}

async function buyItem(itemId) {
    const item = catalogItems.find(i => i.id === itemId);
    if (!item) return;

    try {
        // Invoke RedSDK Multi-Rail Checkout Modal
        const receipt = await window.RedSDK.payments.requestPayment({
            title: item.title,
            description: item.desc,
            amount: item.price,
            currency: 'USD',
            merchant: {
                name: item.merchantName,
                did: item.merchantDid,
                paypalUsername: item.paypal,
                evmAddress: item.evm
            },
            supportedRails: ['paypal', 'web3_usdt', 'offgrid_voucher', 'lightning']
        });

        if (receipt.success) {
            window.RedSDK.ui.showToast("\xa1Pago procesado exitosamente v\xeda " + receipt.rail.toUpperCase() + "!", "success");
            
            // Save receipt to local storage
            let orders = await window.RedSDK.storage.getItem('bazaar_orders') || [];
            orders.unshift({
                ...receipt,
                productTitle: item.title,
                date: new Date().toLocaleString()
            });
            await window.RedSDK.storage.setItem('bazaar_orders', orders);
            renderOrders();
        }
    } catch (err) {
        window.RedSDK.ui.showToast("Error en el pago: " + err.message, "error");
    }
}

async function handlePublish(event) {
    event.preventDefault();
    const title = document.getElementById('pub-title').value;
    const price = parseFloat(document.getElementById('pub-price').value);
    const category = document.getElementById('pub-category').value;
    const paypal = document.getElementById('pub-paypal').value;
    const evm = document.getElementById('pub-evm').value;
    const desc = document.getElementById('pub-desc').value;

    const newItem = {
        id: 'custom-' + Date.now(),
        title,
        price,
        category,
        paypal,
        evm,
        desc,
        merchantName: currentUser?.nickname || 'Operador Soberano',
        merchantDid: currentUser?.did || 'did:red:self'
    };

    // Save to local storage
    let saved = await window.RedSDK.storage.getItem('bazaar_custom_items') || [];
    saved.unshift(newItem);
    await window.RedSDK.storage.setItem('bazaar_custom_items', saved);

    // Broadcast through mesh radio
    try {
        await window.RedSDK.mesh.broadcast('bazaar_offers', newItem);
    } catch (e) {}

    catalogItems.unshift(newItem);
    renderItems();
    switchTab('catalog');
    window.RedSDK.ui.showToast("\xa1Oferta publicada y transmitida por la malla!", "success");
    document.getElementById('publish-form').reset();
}

async function renderOrders() {
    const list = document.getElementById('orders-list');
    if (!list) return;
    try {
        const orders = await window.RedSDK.storage.getItem('bazaar_orders') || [];
        if (orders.length === 0) {
            list.innerHTML = '<p style="color:#64748b; font-size:12px;">A\xfan no has realizado compras en el Bazaar.</p>';
            return;
        }
        list.innerHTML = orders.map(o => \`
            <div class="receipt-item">
                <div style="font-weight:700; color:#f8fafc;">\${o.productTitle} — $\${o.amount} \${o.currency}</div>
                <div style="color:#38bdf8; font-size:11px;">Riel: \${o.rail.toUpperCase()} | TX: \${o.transactionId}</div>
                <div style="color:#64748b; font-size:10px;">Fecha: \${o.date || new Date(o.timestamp).toLocaleString()}</div>
            </div>
        \`).join('');
    } catch (e) {}
}

window.addEventListener('DOMContentLoaded', init);`}},i={manifest:{id:"org.redmesh.wiki",name:"MeshWiki Táctica",version:"1.0.0",description:"Enciclopedia interactiva de supervivencia, medicina de campaña y radiocomunicaciones 100% offline.",author:{name:"RED Survival & Civil Defense Lab",did:"did:red:0000000000000000000000000000000000000000000000000000000000000002"},icon:"📚",category:"utility",permissions:["identity","storage","ai"],entryPoint:"index.html",createdAt:Date.now(),updatedAt:Date.now()},files:{"index.html":`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MeshWiki T\xe1ctica</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header class="app-header">
        <div class="header-main">
            <span class="app-icon">📚</span>
            <div>
                <h1>MeshWiki T\xe1ctica & Supervivencia</h1>
                <p class="subtitle">Base de Conocimiento 100% OFF-GRID</p>
            </div>
        </div>
    </header>

    <div class="search-box">
        <input type="text" id="wiki-search" placeholder="Buscar torniquete, agua, antenas, morse, frecuencias..." oninput="searchArticles()">
    </div>

    <div class="calc-row">
        <div class="calc-card">
            <h3>💧 Calculadora Potabilizaci\xf3n Cloro</h3>
            <p>Litros de agua turbia/clara:</p>
            <div class="calc-controls">
                <input type="number" id="liters-input" value="5" min="1" oninput="calcWater()">
                <div id="chlorine-result" class="calc-result">10 gotas (0.5 mL)</div>
            </div>
        </div>
        <div class="calc-card">
            <h3>📡 Calculadora Longitud Antena Dipolo (1/4 λ)</h3>
            <p>Frecuencia objetivo (MHz):</p>
            <div class="calc-controls">
                <input type="number" id="freq-input" value="144.390" step="0.1" oninput="calcAntenna()">
                <div id="antenna-result" class="calc-result">51.9 cm / elemento</div>
            </div>
        </div>
    </div>

    <main id="articles-container" class="articles-container"></main>

    <script src="app.js"></script>
</body>
</html>`,"style.css":`* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { background: #0b0f19; color: #f3f4f6; padding: 14px; max-width: 900px; margin: 0 auto; }
.app-header { display: flex; align-items: center; border-bottom: 1px solid #1f293d; padding-bottom: 12px; margin-bottom: 14px; }
.header-main { display: flex; align-items: center; gap: 10px; }
.app-icon { font-size: 28px; }
h1 { font-size: 18px; font-weight: 800; color: #38bdf8; }
.subtitle { font-size: 11px; color: #94a3b8; }
.search-box input { width: 100%; padding: 10px 14px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13px; margin-bottom: 14px; }
.calc-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
@media (max-width: 600px) { .calc-row { grid-template-columns: 1fr; } }
.calc-card { background: #111827; border: 1px solid #1f293d; border-radius: 8px; padding: 12px; }
.calc-card h3 { font-size: 13px; color: #f1f5f9; margin-bottom: 4px; }
.calc-card p { font-size: 11px; color: #94a3b8; margin-bottom: 8px; }
.calc-controls { display: flex; align-items: center; gap: 10px; }
.calc-controls input { width: 90px; padding: 6px 8px; background: #1e293b; border: 1px solid #334155; color: #fff; border-radius: 6px; font-size: 13px; }
.calc-result { font-size: 13px; font-weight: 700; color: #10b981; }
.articles-container { display: flex; flex-direction: column; gap: 12px; }
.article-card { background: #111827; border: 1px solid #1f293d; border-radius: 8px; padding: 14px; }
.article-card h2 { font-size: 15px; color: #60a5fa; margin-bottom: 6px; }
.article-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #1e293b; color: #a5b4fc; display: inline-block; margin-bottom: 8px; font-weight: 700; }
.article-content { font-size: 12px; color: #cbd5e1; line-height: 1.5; white-space: pre-line; }`,"app.js":`const WIKI_DB = [
    {
        id: 'tccc-tourniquet',
        tag: 'MEDICINA DE CAMPA\xd1A',
        title: 'Protocolo TCCC: Aplicaci\xf3n de Torniquete y Hemostasia',
        content: \`1. Identificar sangrado arterial exanguinante (sangre rojo brillante a chorro).
2. Colocar el torniquete (CAT / SOFT-T) 5-7 cm por encima de la herida (nunca sobre una articulaci\xf3n).
3. Si el origen no est\xe1 claro (bajo fuego), colocarlo "alto y apretado" (High and Tight) en la extremidad.
4. Girar el molinete hasta que el sangrado se detenga por completo y el pulso distal desaparezca.
5. Asegurar el molinete en el clip de retenci\xf3n.
6. Anotar la HORA EXACTA de colocaci\xf3n (ej: 'T: 14:35') en la frente o cinta del torniquete.
7. Si el sangrado persiste tras 2 minutos, aplicar un segundo torniquete proximal al primero.\`
    },
    {
        id: 'water-purification',
        tag: 'SUPERVIVENCIA & RECURSOS',
        title: 'M\xe9todos de Potabilizaci\xf3n y Filtrado de Emergencia',
        content: \`A. FILTRADO MEC\xc1NICO:
- Filtrar primero por tela de algod\xf3n densa o arena + carb\xf3n vegetal para eliminar part\xedculas y turbidez.

B. EBULLICI\xd3N:
- Hervir durante 1 minuto completo a nivel del mar (3 minutos a m\xe1s de 2000m de altitud).

C. CLORACI\xd3N (Lavandina / Lej\xeda al 5-6% sin aromas):
- Agua Clara: 2 gotas por litro (dejar reposar 30 minutos).
- Agua Turbia: 4 gotas por litro (dejar reposar 30 minutos).

D. DESINFECCI\xd3N SOLAR (SODIS):
- Botella PET transparente al sol directo por 6 horas continuas (o 2 d\xedas si est\xe1 nublado).\`
    },
    {
        id: 'radio-freqs',
        tag: 'RADIOCOMUNICACIONES',
        title: 'Frecuencias de Emergencia y Canales de Socorro VHF/UHF',
        content: \`• Canal 16 Mar\xedtimo (VHF): 156.800 MHz (Socorro mar\xedtimo y b\xfasqueda).
• Frecuencia Aeron\xe1utica de Emergencia: 121.500 MHz (VHF AM).
• Canal 9 CB Radio (Banda Ciudadana): 27.065 MHz (AM/FM).
• Frecuencia Nacional de Encuentro VHF (Radioaficionados): 146.520 MHz FM.
• Frecuencia de Llamada UHF: 446.000 MHz (PMR446 Canal 1 / Walkies est\xe1ndar).
• Frecuencia Mesh RED LoRa (Am\xe9rica): 915.000 MHz.
• Frecuencia Mesh RED LoRa (Europa): 868.000 MHz.\`
    }
];

function init() {
    renderArticles(WIKI_DB);
    calcWater();
    calcAntenna();
}

function renderArticles(list) {
    const container = document.getElementById('articles-container');
    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">No se encontraron art\xedculos.</p>';
        return;
    }
    list.forEach(art => {
        const el = document.createElement('article');
        el.className = 'article-card';
        el.innerHTML = \`
            <span class="article-tag">\${art.tag}</span>
            <h2>\${art.title}</h2>
            <div class="article-content">\${art.content}</div>
        \`;
        container.appendChild(el);
    });
}

function searchArticles() {
    const term = document.getElementById('wiki-search').value.toLowerCase();
    const filtered = WIKI_DB.filter(a => 
        a.title.toLowerCase().includes(term) || 
        a.content.toLowerCase().includes(term) ||
        a.tag.toLowerCase().includes(term)
    );
    renderArticles(filtered);
}

function calcWater() {
    const l = parseFloat(document.getElementById('liters-input').value) || 1;
    const drops = l * 2;
    const ml = (drops / 20).toFixed(2);
    document.getElementById('chlorine-result').textContent = \`\${drops} gotas (~ \${ml} mL)\`;
}

function calcAntenna() {
    const f = parseFloat(document.getElementById('freq-input').value) || 144;
    // Length in cm = 7125 / f (MHz) for 1/4 wave dipole element
    const cm = (7125 / f).toFixed(1);
    document.getElementById('antenna-result').textContent = \`\${cm} cm / elemento\`;
}

window.addEventListener('DOMContentLoaded', init);`}},r={manifest:{id:"org.redmesh.battleship",name:"Batalla Naval P2P",version:"1.0.0",description:"Juego táctico multijugador en tiempo real por radio y Bluetooth sin conexión a internet.",author:{name:"RED Tactical Gaming",did:"did:red:0000000000000000000000000000000000000000000000000000000000000003"},icon:"🚢",category:"games",permissions:["identity","mesh_pubsub","storage"],entryPoint:"index.html",createdAt:Date.now(),updatedAt:Date.now()},files:{"index.html":`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Batalla Naval P2P</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header class="app-header">
        <span class="app-icon">🚢</span>
        <div>
            <h1>Batalla Naval T\xe1ctica P2P</h1>
            <p class="subtitle">Duelo en Malla sin Internet</p>
        </div>
    </header>

    <div class="room-controls">
        <label>Canal de Sala Mesh:</label>
        <div class="room-input-group">
            <input type="text" id="room-input" value="SALA-ALFA-7">
            <button id="btn-join" class="btn-primary" onclick="joinRoom()">📡 Conectar a Sala</button>
        </div>
        <div id="game-status" class="status-bar">Esperando oponente en la malla...</div>
    </div>

    <div class="boards-container">
        <div class="board-wrapper">
            <h3>🛡️ Tu Flota (Defensa)</h3>
            <div id="my-board" class="grid-board"></div>
        </div>
        <div class="board-wrapper">
            <h3>🎯 Radar Enemigo (Ataque)</h3>
            <div id="enemy-board" class="grid-board"></div>
        </div>
    </div>

    <div class="game-log" id="game-log"></div>

    <script src="app.js"></script>
</body>
</html>`,"style.css":`* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { background: #0b0f19; color: #f3f4f6; padding: 12px; max-width: 800px; margin: 0 auto; }
.app-header { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #1f293d; padding-bottom: 10px; margin-bottom: 12px; }
.app-icon { font-size: 26px; }
h1 { font-size: 16px; font-weight: 800; color: #38bdf8; }
.subtitle { font-size: 11px; color: #94a3b8; }
.room-controls { background: #111827; border: 1px solid #1f293d; border-radius: 8px; padding: 10px; margin-bottom: 14px; }
.room-controls label { font-size: 11px; color: #94a3b8; font-weight: 600; display: block; margin-bottom: 4px; }
.room-input-group { display: flex; gap: 8px; margin-bottom: 8px; }
.room-input-group input { flex: 1; padding: 6px 10px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #fff; font-size: 12px; font-weight: 700; }
.btn-primary { padding: 6px 14px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px; }
.status-bar { font-size: 12px; font-weight: 700; color: #fbbf24; background: #1e293b; padding: 6px 10px; border-radius: 6px; }
.boards-container { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
@media (max-width: 600px) { .boards-container { grid-template-columns: 1fr; } }
.board-wrapper { background: #111827; border: 1px solid #1f293d; border-radius: 8px; padding: 10px; }
.board-wrapper h3 { font-size: 12px; color: #cbd5e1; margin-bottom: 8px; text-align: center; }
.grid-board { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; max-width: 240px; margin: 0 auto; }
.cell { aspect-ratio: 1; background: #1e293b; border: 1px solid #334155; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
.cell:hover { border-color: #60a5fa; }
.cell.ship { background: #0284c7; }
.cell.hit { background: #ef4444; color: #fff; }
.cell.miss { background: #475569; color: #cbd5e1; }
.game-log { background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 8px; max-height: 100px; overflow-y: auto; font-size: 11px; color: #94a3b8; font-family: monospace; }`,"app.js":`let myShips = [2, 8, 14, 21, 22, 23, 30]; // 6x6 grid cells
let myHits = new Set();
let myMisses = new Set();
let enemyHits = new Set();
let enemyMisses = new Set();
let currentRoom = 'SALA-ALFA-7';
let myTurn = true;
let userDid = 'did:red:player1';

async function init() {
    try {
        const profile = await window.RedSDK.identity.getProfile();
        userDid = profile.did;
    } catch(e) {}

    renderBoards();
    joinRoom();
}

function joinRoom() {
    currentRoom = document.getElementById('room-input').value.trim() || 'SALA-ALFA-7';
    log("Conectando a canal de malla: " + currentRoom);

    // Subscribe to mesh broadcasts on this channel
    window.RedSDK.mesh.subscribe(currentRoom, (msg) => {
        if (!msg.payload || msg.from === userDid) return;

        const data = msg.payload;
        if (data.type === 'ATTACK') {
            handleEnemyAttack(data.cell);
        } else if (data.type === 'RESULT') {
            handleAttackResult(data.cell, data.hit);
        }
    });

    document.getElementById('game-status').textContent = '🟢 Sala activa. \xa1Haz clic en el Radar Enemigo para disparar!';
}

function renderBoards() {
    const myGrid = document.getElementById('my-board');
    const enemyGrid = document.getElementById('enemy-board');
    myGrid.innerHTML = '';
    enemyGrid.innerHTML = '';

    for (let i = 0; i < 36; i++) {
        // My Board
        const myCell = document.createElement('div');
        myCell.className = 'cell';
        if (myShips.includes(i)) myCell.classList.add('ship');
        if (myHits.has(i)) { myCell.classList.add('hit'); myCell.textContent = '💥'; }
        if (myMisses.has(i)) { myCell.classList.add('miss'); myCell.textContent = '💧'; }
        myGrid.appendChild(myCell);

        // Enemy Board
        const enemyCell = document.createElement('div');
        enemyCell.className = 'cell';
        if (enemyHits.has(i)) { enemyCell.classList.add('hit'); enemyCell.textContent = '💥'; }
        if (enemyMisses.has(i)) { enemyCell.classList.add('miss'); enemyCell.textContent = '💧'; }
        enemyCell.onclick = () => fireAttack(i);
        enemyGrid.appendChild(enemyCell);
    }
}

async function fireAttack(cell) {
    if (enemyHits.has(cell) || enemyMisses.has(cell)) return;

    log("🎯 Disparando a coordenada " + cell + " por radio...");
    
    // Broadcast attack packet through RED mesh
    try {
        await window.RedSDK.mesh.broadcast(currentRoom, {
            type: 'ATTACK',
            cell: cell,
            from: userDid
        });
    } catch(e) {}
}

function handleEnemyAttack(cell) {
    const isHit = myShips.includes(cell);
    if (isHit) {
        myHits.add(cell);
        log("💥 \xa1Impacto enemigo en tu nave en celda " + cell + "!");
    } else {
        myMisses.add(cell);
        log("💧 Disparo enemigo al agua en celda " + cell);
    }
    renderBoards();

    // Broadcast result back
    window.RedSDK.mesh.broadcast(currentRoom, {
        type: 'RESULT',
        cell: cell,
        hit: isHit,
        from: userDid
    });
}

function handleAttackResult(cell, hit) {
    if (hit) {
        enemyHits.add(cell);
        log("💥 \xa1IMPACTO CONFIRMADO en radar enemigo celda " + cell + "!");
    } else {
        enemyMisses.add(cell);
        log("💧 Agua en coordenada " + cell);
    }
    renderBoards();
}

function log(msg) {
    const box = document.getElementById('game-log');
    const line = document.createElement('div');
    line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
}

window.addEventListener('DOMContentLoaded', init);`}},o="red_installed_miniapps_v1";class n{static instance=null;apps=new Map;constructor(){this.loadFromStorage(),this.ensureBuiltinApps()}static getInstance(){return n.instance||(n.instance=new n),n.instance}loadFromStorage(){try{let e=localStorage.getItem(o);e&&JSON.parse(e).forEach(e=>this.apps.set(e.manifest.id,e))}catch(e){console.error("[RedAppRegistry] Error loading apps from storage:",e)}}saveToStorage(){try{let e=Array.from(this.apps.values());localStorage.setItem(o,JSON.stringify(e))}catch(e){console.error("[RedAppRegistry] Error saving apps to storage:",e)}}ensureBuiltinApps(){[a,i,r].forEach(e=>{let t=this.apps.get(e.manifest.id);t?(t.manifest=e.manifest,t.bundle=e,t.isBuiltin=!0):this.apps.set(e.manifest.id,{manifest:e.manifest,bundle:e,installedAt:Date.now(),lastOpenedAt:Date.now(),grantedPermissions:e.manifest.permissions,isBuiltin:!0})}),this.saveToStorage()}getAllApps(){return Array.from(this.apps.values()).sort((e,t)=>t.lastOpenedAt-e.lastOpenedAt)}getApp(e){return this.apps.get(e)}installApp(e,t){let a={manifest:e.manifest,bundle:e,installedAt:Date.now(),lastOpenedAt:Date.now(),grantedPermissions:t||e.manifest.permissions,isBuiltin:!1};return this.apps.set(e.manifest.id,a),this.saveToStorage(),a}uninstallApp(e){let t=this.apps.get(e);if(t?.isBuiltin)return console.warn("No se pueden desinstalar aplicaciones nativas del sistema."),!1;let a=this.apps.delete(e);return a&&this.saveToStorage(),a}updatePermissions(e,t){let a=this.apps.get(e);a&&(a.grantedPermissions=t,this.saveToStorage())}touchApp(e){let t=this.apps.get(e);t&&(t.lastOpenedAt=Date.now(),this.saveToStorage())}exportAppPackage(e){let a=this.apps.get(e);if(!a)return null;let i=JSON.stringify({format:"RED_APP_PACKAGE_V1",exportedAt:Date.now(),bundle:a.bundle,manifest:a.manifest}),r="u">typeof btoa?btoa(unescape(encodeURIComponent(i))):t.Buffer.from(i).toString("base64");return`RED_APP_V1:${r}`}importAppPackage(e){try{let a=e.trim();a.startsWith("RED_APP_V1:")&&(a=a.substring(11));let i="u">typeof atob?decodeURIComponent(escape(atob(a))):t.Buffer.from(a,"base64").toString("utf8"),r=JSON.parse(i);if(!r.bundle||!r.bundle.manifest||!r.bundle.manifest.id||!r.bundle.html)return{bundle:null,isValid:!1,error:"Estructura de paquete inválida o manifiesto corrupto."};let o=r.bundle.manifest;if(!o.name||!o.version)return{bundle:null,isValid:!1,error:"El manifiesto no especifica nombre o versión."};if(!/^[a-zA-Z0-9_.-]{3,64}$/.test(o.id))return{bundle:null,isValid:!1,error:"El identificador de la aplicación debe ser alfanumérico (3-64 caracteres)."};if(!/^\d+\.\d+\.\d+/.test(o.version))return{bundle:null,isValid:!1,error:"La versión de la aplicación debe seguir el formato SemVer (ej: 1.0.0)."};return{bundle:r.bundle,isValid:!0}}catch(e){return{bundle:null,isValid:!1,error:e.message||"Error al decodificar paquete de aplicación."}}}}let s=n.getInstance();e.s(["redAppRegistry",0,s],19439)},26520,e=>{"use strict";var t=e.i(14582);class a{static getClientSDKScript(e){return`
(function() {
    if (window.RedSDK) return;

    const APP_ID = "${e}";
    const pendingRequests = new Map();
    const eventListeners = new Map();

    // Listen for responses and events from the Host Shell
    window.addEventListener('message', function(event) {
        const data = event.data;
        if (!data || data.channel !== 'RED_SDK') return;

        if (data.type === 'RED_SDK_RESPONSE') {
            const resolver = pendingRequests.get(data.requestId);
            if (resolver) {
                pendingRequests.delete(data.requestId);
                if (data.success) {
                    resolver.resolve(data.data);
                } else {
                    resolver.reject(new Error(data.error || 'SDK Request Failed'));
                }
            }
        } else if (data.type === 'RED_SDK_EVENT') {
            const handlers = eventListeners.get(data.eventName) || [];
            handlers.forEach(fn => fn(data.payload));
        }
    });

    function call(method, params) {
        return new Promise((resolve, reject) => {
            const randReq = window.crypto && window.crypto.getRandomValues ? Array.from(window.crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('') : Date.now().toString(36);
            const requestId = 'req_' + Date.now() + '_' + randReq;
            pendingRequests.set(requestId, { resolve, reject });

            window.parent.postMessage({
                channel: 'RED_SDK',
                type: 'RED_SDK_REQUEST',
                requestId: requestId,
                appId: APP_ID,
                method: method,
                params: params || {}
            }, '*');

            // Timeout after 30s
            setTimeout(() => {
                if (pendingRequests.has(requestId)) {
                    pendingRequests.delete(requestId);
                    reject(new Error("Timeout en petici\xf3n RedSDK: " + method));
                }
            }, 30000);
        });
    }

    window.RedSDK = {
        version: "1.0.0",
        appId: APP_ID,
        
        identity: {
            getProfile: () => call('identity.getProfile'),
            signData: (data) => call('identity.signData', { data }),
            verifySignature: (data, signature, publicKey) => call('identity.verifySignature', { data, signature, publicKey })
        },

        mesh: {
            broadcast: (topic, payload) => call('mesh.broadcast', { topic, payload }),
            sendDirect: (targetDID, payload) => call('mesh.sendDirect', { targetDID, payload }),
            subscribe: (topic, callback) => {
                const eventName = 'mesh.message';
                if (!eventListeners.has(eventName)) {
                    eventListeners.set(eventName, []);
                }
                eventListeners.get(eventName).push(callback);
                return call('mesh.subscribe', { topic });
            }
        },

        payments: {
            requestPayment: (intent) => call('payments.requestPayment', intent),
            getBalance: () => call('payments.getBalance')
        },

        storage: {
            getItem: (key) => call('storage.getItem', { key }),
            setItem: (key, value) => call('storage.setItem', { key, value }),
            removeItem: (key) => call('storage.removeItem', { key }),
            clear: () => call('storage.clear')
        },

        ai: {
            prompt: (query, options) => call('ai.prompt', { query, options })
        },

        sensors: {
            getLocation: () => call('sensors.getLocation')
        },

        ui: {
            showToast: (message, type) => call('ui.showToast', { message, type }),
            setHeaderTitle: (title) => call('ui.setHeaderTitle', { title })
        }
    };

    console.log("[RedSDK] Initialized inside sandbox for app:", APP_ID);
})();
`}static compileBundleToHtml(e){let t=e.manifest.entryPoint||"index.html",a=e.files[t]||"<html><body><h1>Mini-App no encontrada</h1></body></html>",i=`<script id="red-sdk-injected">
${this.getClientSDKScript(e.manifest.id)}
</script>`;return Object.entries(e.files).forEach(([e,i])=>{e.endsWith(".js")&&e!==t?a=a.replace(RegExp(`<script[^>]*src=["']\\.?/?${e}["'][^>]*>\\s*</script>`,"gi"),`<script data-inlined="${e}">
${i}
</script>`):e.endsWith(".css")&&(a=a.replace(RegExp(`<link[^>]*rel=["']stylesheet["'][^>]*href=["']\\.?/?${e}["'][^>]*>`,"gi"),`<style data-inlined="${e}">
${i}
</style>`))}),a=a.includes("<head>")?a.replace("<head>",`<head>
${i}`):a.includes("<html>")?a.replace("<html>",`<html>
<head>
${i}
</head>`):`${i}
${a}`}static createBlobUrl(e){let t=new Blob([this.compileBundleToHtml(e)],{type:"text/html;charset=utf-8"});return URL.createObjectURL(t)}static revokeBlobUrl(e){if(e&&e.startsWith("blob:"))try{URL.revokeObjectURL(e)}catch{}}static exportBundle(e,a){let i=Object.keys(a).sort(),r=new TextEncoder,o="";for(let e of i)o+=`${e}:${a[e]||""}
`;let n=Array.from((0,t.sha256)(r.encode(o))).map(e=>e.toString(16).padStart(2,"0")).join(""),s=`sha256_${n}_${i.length}`;return JSON.stringify({manifest:{...e,updatedAt:Date.now(),integrityDigest:s},files:a})}static importBundle(e){try{let a=JSON.parse(e);if(!a.manifest||!a.manifest.id||!a.files)throw Error("El archivo .redapp no tiene un manifiesto o archivos válidos.");if(a.manifest.integrityDigest){let e=Object.keys(a.files).sort(),i=new TextEncoder,r="";for(let t of e)r+=`${t}:${a.files[t]||""}
`;let o=(0,t.sha256)(i.encode(r)),n=Array.from(o).map(e=>e.toString(16).padStart(2,"0")).join(""),s=`sha256_${n}_${e.length}`;a.manifest.integrityDigest!==s&&console.warn(`[RedAppBundleEngine] Advertencia de integridad en paquete ${a.manifest.id}`)}return a}catch(e){throw Error(`Error al procesar paquete .redapp: ${e.message}`)}}}e.s(["RedAppBundleEngine",()=>a])},35286,e=>{"use strict";var t=e.i(43476),a=e.i(71645),i=e.i(97631),r=e.i(10239),o=e.i(19439),n=e.i(26520),s=e.i(69104),l=e.i(55211),d=e.i(26965),c=e.i(71164),p=e.i(83036);let m={bazaar:{name:"Mi Tienda Trueque P2P",id:"org.redmesh.custombazaar",cat:"market",icon:"🛒",desc:"Tienda de suministros tácticos y trueque descentralizado con pasarela Multi-Rail integrada.",permissions:["identity","payments","mesh_pubsub","storage"],html:`<!DOCTYPE html>
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
</html>`}};e.s(["SovereignAppStoreModal",0,({userDid:e,onClose:u,onLaunchApp:g})=>{let{t:x}=(0,i.useTranslation)(),[b,f]=(0,a.useState)("catalog"),[h,y]=(0,a.useState)([]),[v,w]=(0,a.useState)("all"),[S,A]=(0,a.useState)(""),[E,j]=(0,a.useState)([]),[C,R]=(0,a.useState)(""),[I,F]=(0,a.useState)("bazaar"),[T,k]=(0,a.useState)(m.bazaar.name),[D,B]=(0,a.useState)(m.bazaar.id),[z,P]=(0,a.useState)(m.bazaar.desc),[M,L]=(0,a.useState)(m.bazaar.cat),[O,q]=(0,a.useState)(m.bazaar.icon),[N,_]=(0,a.useState)(m.bazaar.permissions),[W,H]=(0,a.useState)(m.bazaar.html),[U,$]=(0,a.useState)(""),K=()=>{y(o.redAppRegistry.getAllApps())};(0,a.useEffect)(()=>{K()},[]);let V=(0,a.useMemo)(()=>h.filter(e=>e.isBuiltin).length,[h]),J=(0,a.useMemo)(()=>h.filter(e=>!e.isBuiltin).length,[h]);(0,a.useEffect)(()=>{let e=d.BackHandlerRegistry.register(()=>("catalog"!==b?(c.TacticalAudioEngine.playTap(),f("catalog")):(c.TacticalAudioEngine.playTap(),u()),!0)),t=e=>{"Escape"===e.key&&(e.preventDefault(),"catalog"!==b?(c.TacticalAudioEngine.playTap(),f("catalog")):(c.TacticalAudioEngine.playTap(),u()))};return window.addEventListener("keydown",t),()=>{e(),window.removeEventListener("keydown",t)}},[b,u]),(0,a.useEffect)(()=>{let e=s.meshRouter.onLocalDelivery(e=>{try{let t=new TextDecoder().decode(e.payload);if(!t.startsWith("{"))return;let a=JSON.parse(t);("MINIAPP_PACKAGE_BROADCAST"===a.type||"MINIAPP_MANIFEST"===a.type)&&a.manifest&&a.appId&&j(t=>t.some(e=>e.appId===a.appId)?t:(c.TacticalAudioEngine.playMessageReceived(),p.toast.info(`📡 dApp recibida por radio/malla: ${a.manifest.name}`),[{appId:a.appId,manifest:a.manifest,pkg:a.pkg||null,authorDid:a.authorDid||e.sender,timestamp:a.timestamp||Date.now()},...t]))}catch{}});return()=>{e()}},[]);let G=async(e,t="Texto")=>{if(c.TacticalAudioEngine.playTap(),navigator?.clipboard?.writeText)try{await navigator.clipboard.writeText(e),p.toast.info(`📋 ${t} copiado al portapapeles.`);return}catch{}try{let a=document.createElement("textarea");a.value=e,a.style.position="fixed",a.style.opacity="0",a.style.pointerEvents="none",document.body.appendChild(a),a.select(),document.execCommand("copy"),document.body.removeChild(a),p.toast.info(`📋 ${t} copiado al portapapeles.`)}catch{p.toast.error(`No se pudo copiar ${t.toLowerCase()}.`)}};(0,a.useEffect)(()=>{if("creator"===b){let t={manifest:{id:D||"preview.app",name:T||"Vista Previa",version:"1.0.0",description:z||"",author:{name:"Operador Local",did:e},icon:O||"⚡",category:M,permissions:N,entryPoint:"index.html",createdAt:Date.now(),updatedAt:Date.now()},files:{"index.html":W}},a=n.RedAppBundleEngine.createBlobUrl(t);return $(a),()=>{a&&URL.revokeObjectURL(a)}}},[b,W,D,T,M,N,O,e]);let Y=e=>{c.TacticalAudioEngine.playTap();let t=e.trim();if(!t){c.TacticalAudioEngine.playWarning(),p.toast.error("El paquete o texto está vacío.");return}try{if(t.startsWith("RED_APP_V1:")||t.includes('"format":"RED_APP_PACKAGE_V1"')){let e=o.redAppRegistry.importAppPackage(t);if(e.isValid&&e.bundle){o.redAppRegistry.installApp(e.bundle),K(),c.TacticalAudioEngine.playMessageSent(),p.toast.success(`\xa1Mini-App '${e.bundle.manifest.name}' instalada exitosamente!`),R(""),f("catalog");return}if(e.error)throw Error(e.error)}let e=n.RedAppBundleEngine.importBundle(t);o.redAppRegistry.installApp(e),K(),c.TacticalAudioEngine.playMessageSent(),p.toast.success(`\xa1Mini-App '${e.manifest.name}' instalada exitosamente!`),R(""),f("catalog")}catch(e){c.TacticalAudioEngine.playWarning(),p.toast.error(`Error al importar: ${e.message||"Formato no reconocido"}`)}},X=(0,a.useMemo)(()=>h.filter(e=>{let t="all"===v||e.manifest.category===v,a=e.manifest.name.toLowerCase().includes(S.toLowerCase())||e.manifest.description.toLowerCase().includes(S.toLowerCase())||e.manifest.id.toLowerCase().includes(S.toLowerCase());return t&&a}),[h,v,S]);return(0,t.jsx)("div",{style:{position:"fixed",inset:0,zIndex:9999,background:"rgba(2, 4, 10, 0.90)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"12px",userSelect:"none"},children:(0,t.jsxs)("div",{style:{width:"100%",maxWidth:"1040px",height:"92vh",maxHeight:"880px",borderRadius:"20px",boxShadow:"0 16px 50px rgba(0,0,0,0.85), 0 0 30px rgba(0, 230, 118, 0.15)",display:"flex",flexDirection:"column",overflow:"hidden",border:"1.5px solid rgba(0, 230, 118, 0.35)",background:"linear-gradient(180deg, rgba(14,18,34,0.98) 0%, rgba(6,8,16,0.99) 100%)"},children:[(0,t.jsxs)("div",{style:{padding:"12px 16px",background:"rgba(6, 8, 16, 0.95)",borderBottom:"1px solid rgba(255, 255, 255, 0.12)",display:"flex",flexWrap:"wrap",gap:"12px",justifyContent:"space-between",alignItems:"center"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"12px"},children:[(0,t.jsx)("div",{style:{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg, rgba(0,230,118,0.2) 0%, rgba(0,229,255,0.2) 100%)",border:"1px solid rgba(0,230,118,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",boxShadow:"0 0 15px rgba(0,230,118,0.2)"},children:"🏬"}),(0,t.jsxs)("div",{children:[(0,t.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:(0,t.jsxs)("h2",{style:{fontSize:"1rem",fontWeight:900,color:"#FFFFFF",letterSpacing:"0.5px",margin:0,display:"flex",alignItems:"center",gap:"8px"},children:[x("sovereign_store_modal.title"),(0,t.jsx)("span",{style:{fontSize:"0.65rem",padding:"2px 6px",background:"rgba(0, 230, 118, 0.15)",border:"1px solid rgba(0, 230, 118, 0.5)",color:"var(--accent-emerald)",borderRadius:"4px",fontFamily:"JetBrains Mono, monospace",fontWeight:800},children:`v${r.RED_VERSION}`})]})}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px",fontSize:"0.72rem",color:"var(--text-muted)",fontFamily:"JetBrains Mono, monospace",marginTop:"2px"},children:[(0,t.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"var(--accent-emerald)",display:"inline-block"}}),(0,t.jsx)("span",{style:{maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:e}),(0,t.jsx)("span",{children:"•"}),(0,t.jsxs)("span",{style:{color:"var(--accent-cyan)",fontWeight:700},children:[h.length," dApps"]})]})]})]}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,t.jsx)("button",{type:"button",onClick:()=>{c.TacticalAudioEngine.playTap(),f("creator"===b?"catalog":"creator")},style:{padding:"6px 14px",borderRadius:"10px",fontSize:"0.78rem",fontWeight:900,cursor:"pointer",border:"none",background:"creator"===b?"var(--accent-emerald)":"linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",color:"#000000",boxShadow:"0 0 12px rgba(0, 230, 118, 0.3)"},children:(0,t.jsx)("span",{children:"creator"===b?"📦 Ver Catálogo":"➕ Crear Mini-App"})}),(0,t.jsx)("button",{type:"button",onClick:()=>{c.TacticalAudioEngine.playTap(),u()},style:{background:"rgba(255, 255, 255, 0.08)",border:"1px solid rgba(255, 255, 255, 0.15)",color:"#FFFFFF",width:"32px",height:"32px",borderRadius:"8px",cursor:"pointer",fontSize:"0.9rem",fontWeight:900},title:"Cerrar tienda",children:"✕"})]})]}),(0,t.jsxs)("div",{style:{padding:"6px 16px",background:"rgba(3, 7, 18, 0.92)",borderBottom:"1px solid rgba(255, 255, 255, 0.08)",display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:"10px",fontSize:"0.72rem",fontFamily:"JetBrains Mono, monospace"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"},children:[(0,t.jsxs)("span",{style:{color:"#E2E8F0",display:"flex",alignItems:"center",gap:"4px"},children:["📦 ",(0,t.jsx)("strong",{style:{color:"var(--accent-emerald)"},children:h.length})," Total"]}),(0,t.jsx)("span",{style:{color:"#94A3B8"},children:"|"}),(0,t.jsxs)("span",{style:{color:"#94A3B8",display:"flex",alignItems:"center",gap:"4px"},children:["🛡️ ",(0,t.jsx)("strong",{style:{color:"var(--accent-cyan)"},children:V})," Oficiales"]}),(0,t.jsx)("span",{style:{color:"#94A3B8"},children:"|"}),(0,t.jsxs)("span",{style:{color:"#94A3B8",display:"flex",alignItems:"center",gap:"4px"},children:["⚡ ",(0,t.jsx)("strong",{style:{color:"#FFD700"},children:J})," Soberanas"]}),E.length>0&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)("span",{style:{color:"#94A3B8"},children:"|"}),(0,t.jsxs)("span",{style:{color:"var(--accent-cyan)",display:"flex",alignItems:"center",gap:"4px",background:"rgba(0, 229, 255, 0.1)",padding:"1px 6px",borderRadius:"4px",border:"1px solid rgba(0, 229, 255, 0.3)"},children:["📡 ",(0,t.jsx)("strong",{children:E.length})," en Malla"]})]})]}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"12px",color:"var(--text-muted)"},children:[(0,t.jsxs)("span",{style:{display:"flex",alignItems:"center",gap:"5px"},children:[(0,t.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#00E676"}}),(0,t.jsx)("span",{children:"Malla P2P Activa"})]}),(0,t.jsx)("span",{style:{display:"flex",alignItems:"center",gap:"5px"},children:(0,t.jsx)("span",{children:"🔒 Sandbox Iframe Aislado"})})]})]}),(0,t.jsxs)("div",{style:{padding:"8px 16px",background:"rgba(6, 8, 16, 0.6)",borderBottom:"1px solid rgba(255, 255, 255, 0.08)",display:"flex",flexWrap:"wrap",gap:"8px",alignItems:"center",justifyContent:"space-between"},children:[(0,t.jsx)("div",{style:{display:"flex",gap:"6px",overflowX:"auto"},children:[{id:"catalog",label:"📦 Catálogo Soberano",count:h.length},{id:"creator",label:"🛠️ Creador & Live Preview",count:null},{id:"import",label:"📥 Importar Paquete",count:null},{id:"mesh",label:"📡 Malla P2P",count:E.length>0?E.length:null}].map(e=>(0,t.jsxs)("button",{type:"button",onClick:()=>{c.TacticalAudioEngine.playTap(),f(e.id)},style:{padding:"6px 12px",borderRadius:"8px",fontSize:"0.78rem",fontWeight:800,cursor:"pointer",border:b===e.id?"1px solid var(--accent-emerald)":"1px solid transparent",background:b===e.id?"rgba(0, 230, 118, 0.15)":"transparent",color:b===e.id?"var(--accent-emerald)":"var(--text-secondary)",display:"flex",alignItems:"center"},children:[(0,t.jsx)("span",{children:e.label}),null!==e.count&&(0,t.jsx)("span",{style:{fontSize:"0.68rem",padding:"1px 6px",background:"rgba(255,255,255,0.1)",borderRadius:"10px",marginLeft:"6px",fontFamily:"JetBrains Mono, monospace"},children:e.count})]},e.id))}),"catalog"===b&&(0,t.jsx)("div",{style:{width:"240px"},children:(0,t.jsx)("input",{type:"text",placeholder:"🔍 Buscar Mini-Apps...",value:S,onChange:e=>A(e.target.value),className:"tactical-input",style:{width:"100%",padding:"6px 10px",fontSize:"0.78rem"}})})]}),"catalog"===b&&(0,t.jsxs)("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"},children:[(0,t.jsx)("div",{style:{padding:"8px 16px",borderBottom:"1px solid rgba(255, 255, 255, 0.08)",display:"flex",gap:"6px",overflowX:"auto"},children:[{id:"all",label:"Todas las Apps"},{id:"market",label:"🛒 Mercado P2P"},{id:"utility",label:"🔧 Utilidades"},{id:"emergency",label:"🩹 Emergencia"},{id:"games",label:"🎮 Juegos"}].map(e=>(0,t.jsx)("button",{type:"button",onClick:()=>{c.TacticalAudioEngine.playTap(),w(e.id)},style:{padding:"4px 10px",borderRadius:"8px",fontSize:"0.75rem",fontWeight:800,cursor:"pointer",border:v===e.id?"1px solid var(--accent-cyan)":"1px solid rgba(255, 255, 255, 0.08)",background:v===e.id?"rgba(0, 229, 255, 0.15)":"rgba(255, 255, 255, 0.03)",color:v===e.id?"var(--accent-cyan)":"var(--text-secondary)",whiteSpace:"nowrap"},children:e.label},e.id))}),(0,t.jsx)("div",{style:{flex:1,overflowY:"auto",padding:"16px",display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:"14px"},children:X.map(a=>(0,t.jsxs)("div",{style:{background:"linear-gradient(180deg, rgba(16, 22, 44, 0.8) 0%, rgba(8, 12, 26, 0.9) 100%)",border:"1px solid rgba(255, 255, 255, 0.12)",borderRadius:"16px",padding:"14px",display:"flex",flexDirection:"column",justifyContent:"space-between",boxShadow:"0 4px 16px rgba(0, 0, 0, 0.5)"},children:[(0,t.jsxs)("div",{children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px",marginBottom:"10px"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px"},children:[(0,t.jsx)("div",{style:{width:"44px",height:"44px",borderRadius:"12px",background:"rgba(0, 0, 0, 0.6)",border:"1px solid rgba(255, 255, 255, 0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem"},children:a.manifest.icon||"📱"}),(0,t.jsxs)("div",{children:[(0,t.jsx)("h3",{style:{fontSize:"0.88rem",fontWeight:900,color:"#FFFFFF",margin:0},children:a.manifest.name}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"6px",fontSize:"0.68rem",color:"var(--text-muted)",fontFamily:"JetBrains Mono, monospace",marginTop:"2px"},children:[(0,t.jsxs)("span",{children:["v",a.manifest.version]}),(0,t.jsx)("span",{children:"•"}),(0,t.jsx)("span",{style:{textTransform:"uppercase",color:"var(--accent-emerald)",fontWeight:800},children:a.manifest.category})]})]})]}),a.isBuiltin?(0,t.jsx)("span",{style:{fontSize:"0.62rem",padding:"2px 6px",background:"rgba(0, 230, 118, 0.15)",border:"1px solid rgba(0, 230, 118, 0.5)",color:"var(--accent-emerald)",borderRadius:"6px",fontWeight:900,textTransform:"uppercase"},children:"Oficial"}):(0,t.jsx)("span",{style:{fontSize:"0.62rem",padding:"2px 6px",background:"rgba(0, 229, 255, 0.15)",border:"1px solid rgba(0, 229, 255, 0.5)",color:"var(--accent-cyan)",borderRadius:"6px",fontWeight:900,textTransform:"uppercase"},children:"Soberana"})]}),(0,t.jsx)("p",{style:{fontSize:"0.78rem",color:"var(--text-secondary)",margin:"0 0 10px 0",lineHeight:1.4},children:a.manifest.description}),(0,t.jsx)("div",{style:{display:"flex",flexWrap:"wrap",gap:"4px",marginBottom:"12px"},children:a.manifest.permissions.map(e=>(0,t.jsxs)("span",{style:{fontSize:"0.64rem",padding:"2px 6px",background:"rgba(0, 0, 0, 0.5)",border:"1px solid rgba(255, 255, 255, 0.08)",color:"var(--text-secondary)",borderRadius:"4px",fontFamily:"JetBrains Mono, monospace"},children:["🔒 ",e]},e))})]}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:"10px",borderTop:"1px solid rgba(255, 255, 255, 0.08)",marginTop:"auto"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"6px"},children:[(0,t.jsx)("button",{type:"button",onClick:()=>(t=>{c.TacticalAudioEngine.playTap();try{let a=o.redAppRegistry.exportAppPackage(t.manifest.id),i={type:"MINIAPP_PACKAGE_BROADCAST",appId:t.manifest.id,manifest:t.manifest,pkg:a,authorDid:e,timestamp:Date.now()},r=new TextEncoder().encode(JSON.stringify(i));s.meshRouter.broadcast((0,l.encode)((0,l.createPacket)(e,"broadcast",r))),c.TacticalAudioEngine.playMessageSent(),p.toast.success(`📡 Mini-App '${t.manifest.name}' transmitida por radio/mesh.`)}catch(e){c.TacticalAudioEngine.playWarning(),p.toast.error(`Error al transmitir: ${e.message}`)}})(a.bundle),style:{padding:"6px 8px",background:"rgba(255, 255, 255, 0.06)",border:"1px solid rgba(255, 255, 255, 0.12)",color:"#FFFFFF",borderRadius:"8px",fontSize:"0.75rem",cursor:"pointer"},title:"Transmitir paquete por radio/malla",children:"📡"}),(0,t.jsx)("button",{type:"button",onClick:()=>{var e;let t,i,r;return e=a.bundle,c.TacticalAudioEngine.playTap(),t=new Blob([o.redAppRegistry.exportAppPackage(e.manifest.id)||JSON.stringify(e,null,2)],{type:"application/json"}),i=URL.createObjectURL(t),void((r=document.createElement("a")).href=i,r.download=`${e.manifest.id}.redapp`,r.click(),URL.revokeObjectURL(i),c.TacticalAudioEngine.playMessageSent(),p.toast.info(`📦 Paquete firmado ${e.manifest.name} exportado.`))},style:{padding:"6px 8px",background:"rgba(255, 255, 255, 0.06)",border:"1px solid rgba(255, 255, 255, 0.12)",color:"#FFFFFF",borderRadius:"8px",fontSize:"0.75rem",cursor:"pointer"},title:"Exportar archivo .redapp",children:"💾"}),(0,t.jsx)("button",{type:"button",onClick:()=>G(a.manifest.id,"App ID"),style:{padding:"6px 8px",background:"rgba(255, 255, 255, 0.06)",border:"1px solid rgba(255, 255, 255, 0.12)",color:"#FFFFFF",borderRadius:"8px",fontSize:"0.75rem",cursor:"pointer"},title:"Copiar App ID",children:"📋"}),!a.isBuiltin&&(0,t.jsx)("button",{type:"button",onClick:()=>{var e;return e=a.manifest.id,void(c.TacticalAudioEngine.playTap(),o.redAppRegistry.uninstallApp(e)?(p.toast.info("Mini-App desinstalada."),K()):(c.TacticalAudioEngine.playWarning(),p.toast.error("No se pueden desinstalar aplicaciones nativas del sistema.")))},style:{padding:"6px 8px",background:"rgba(232, 33, 58, 0.15)",border:"1px solid rgba(232, 33, 58, 0.4)",color:"var(--accent-crimson)",borderRadius:"8px",fontSize:"0.75rem",cursor:"pointer"},title:"Eliminar Mini-App local",children:"🗑️"})]}),(0,t.jsxs)("button",{type:"button",onClick:()=>{c.TacticalAudioEngine.playTap(),g(a.bundle)},style:{padding:"6px 14px",background:"linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",color:"#000000",fontWeight:900,borderRadius:"10px",fontSize:"0.78rem",border:"none",cursor:"pointer",boxShadow:"0 0 10px rgba(0, 230, 118, 0.3)",display:"flex",alignItems:"center",gap:"6px"},children:[(0,t.jsx)("span",{children:"EJECUTAR"}),(0,t.jsx)("span",{children:"➔"})]})]})]},a.manifest.id))})]}),"creator"===b&&(0,t.jsxs)("div",{style:{flex:1,display:"flex",flexDirection:"row",overflow:"hidden"},children:[(0,t.jsxs)("div",{style:{flex:1,padding:"16px",overflowY:"auto",borderRight:"1px solid rgba(255, 255, 255, 0.1)",display:"flex",flexDirection:"column",gap:"12px",fontSize:"0.78rem"},children:[(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"},children:[(0,t.jsx)("h3",{style:{fontSize:"0.88rem",fontWeight:900,color:"#FFFFFF",margin:0,display:"flex",alignItems:"center",gap:"6px"},children:(0,t.jsx)("span",{children:"🛠️ Creador & Editor de dApps"})}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,t.jsx)("span",{style:{color:"var(--text-muted)"},children:"Plantilla:"}),(0,t.jsxs)("select",{value:I,onChange:e=>{var t;let a;return t=e.target.value,c.TacticalAudioEngine.playTap(),void((a=m[t])&&(F(t),k(a.name),B(a.id),P(a.desc),L(a.cat),q(a.icon),_(a.permissions),H(a.html)))},style:{padding:"4px 8px",background:"rgba(0,0,0,0.6)",border:"1px solid rgba(0, 230, 118, 0.4)",color:"var(--accent-emerald)",borderRadius:"8px",fontWeight:800,fontFamily:"JetBrains Mono, monospace",outline:"none"},children:[(0,t.jsx)("option",{value:"bazaar",children:"🛒 Tienda / Trueque P2P"}),(0,t.jsx)("option",{value:"game",children:"🎮 Batalla Naval Malla"}),(0,t.jsx)("option",{value:"notes",children:"🔒 Bloc Criptográfico"})]})]})]}),(0,t.jsxs)("form",{onSubmit:t=>{if(t.preventDefault(),c.TacticalAudioEngine.playTap(),!T.trim()||!D.trim()){c.TacticalAudioEngine.playWarning(),p.toast.error("El nombre y el App ID son obligatorios.");return}let a={id:D.trim().toLowerCase(),name:T.trim(),version:"1.0.0",description:z.trim(),author:{name:"Operador Soberano",did:e},icon:O.trim()||"📱",category:M,permissions:N,entryPoint:"index.html",createdAt:Date.now(),updatedAt:Date.now()},i={manifest:a,files:{"index.html":W}};o.redAppRegistry.installApp(i);try{let t={type:"MINIAPP_MANIFEST",appId:a.id,manifest:a,timestamp:Date.now()},i=new TextEncoder().encode(JSON.stringify(t));s.meshRouter.broadcast((0,l.encode)((0,l.createPacket)(e,"broadcast",i)))}catch{}c.TacticalAudioEngine.playMessageSent(),p.toast.success(`🚀 Mini-App '${a.name}' instalada y transmitida a la malla.`),K(),f("catalog"),g(i)},style:{display:"flex",flexDirection:"column",gap:"10px"},children:[(0,t.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"},children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"Nombre de la Aplicación"}),(0,t.jsx)("input",{type:"text",required:!0,value:T,onChange:e=>k(e.target.value),placeholder:"Mi Calculadora Solar",className:"tactical-input",style:{width:"100%"}})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"App ID Único (Reverse DNS)"}),(0,t.jsx)("input",{type:"text",required:!0,value:D,onChange:e=>B(e.target.value),placeholder:"com.usuario.solar",className:"tactical-input",style:{width:"100%",fontFamily:"JetBrains Mono, monospace"}})]})]}),(0,t.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"},children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"Categoría"}),(0,t.jsxs)("select",{value:M,onChange:e=>L(e.target.value),className:"tactical-input",style:{width:"100%"},children:[(0,t.jsx)("option",{value:"utility",children:"Utilidad"}),(0,t.jsx)("option",{value:"market",children:"Mercado"}),(0,t.jsx)("option",{value:"emergency",children:"Emergencia"}),(0,t.jsx)("option",{value:"games",children:"Juegos"})]})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"Emoji / Icono"}),(0,t.jsx)("input",{type:"text",value:O,onChange:e=>q(e.target.value),className:"tactical-input",style:{width:"100%",textAlign:"center",fontSize:"1.2rem"}})]})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"Descripción"}),(0,t.jsx)("input",{type:"text",value:z,onChange:e=>P(e.target.value),placeholder:"Descripción breve de la utilidad...",className:"tactical-input",style:{width:"100%"}})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"Permisos Solicitados"}),(0,t.jsx)("div",{style:{display:"flex",flexWrap:"wrap",gap:"6px"},children:["identity","mesh_pubsub","payments","storage","ai","sensors"].map(e=>{let a=N.includes(e);return(0,t.jsxs)("button",{type:"button",onClick:()=>{c.TacticalAudioEngine.playTap(),N.includes(e)?_(N.filter(t=>t!==e)):_([...N,e])},style:{padding:"4px 8px",borderRadius:"6px",fontSize:"0.68rem",fontFamily:"JetBrains Mono, monospace",fontWeight:800,cursor:"pointer",border:a?"1px solid var(--accent-emerald)":"1px solid rgba(255,255,255,0.1)",background:a?"rgba(0, 230, 118, 0.2)":"rgba(0,0,0,0.4)",color:a?"var(--accent-emerald)":"var(--text-muted)"},children:[a?"✓ ":"+ "," ",e]},e)})})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",color:"var(--text-secondary)",fontWeight:700,marginBottom:"4px"},children:"Código Fuente Sandboxed (`index.html`)"}),(0,t.jsx)("textarea",{rows:10,value:W,onChange:e=>H(e.target.value),className:"tactical-input",style:{width:"100%",color:"var(--accent-emerald)",fontFamily:"JetBrains Mono, monospace",fontSize:"0.72rem",lineHeight:1.4},spellCheck:!1})]}),(0,t.jsx)("button",{type:"submit",style:{width:"100%",padding:"10px",background:"linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",color:"#000000",fontWeight:900,borderRadius:"12px",fontSize:"0.82rem",border:"none",cursor:"pointer",boxShadow:"0 0 16px rgba(0, 230, 118, 0.35)"},children:"🚀 INSTALAR & EMITIR PAQUETE A LA MALLA"})]})]}),(0,t.jsxs)("div",{style:{flex:1,background:"rgba(0, 0, 0, 0.8)",padding:"16px",display:"flex",flexDirection:"column"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:"8px",marginBottom:"8px",borderBottom:"1px solid rgba(255, 255, 255, 0.1)"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,t.jsx)("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:"var(--accent-emerald)"}}),(0,t.jsx)("span",{style:{fontSize:"0.78rem",fontWeight:800,color:"#FFFFFF"},children:"VISTA PREVIA EN VIVO (SANDBOX)"})]}),(0,t.jsx)("span",{style:{fontSize:"0.68rem",color:"var(--accent-cyan)",fontFamily:"JetBrains Mono, monospace"},children:"window.RedSDK Activo"})]}),(0,t.jsx)("div",{style:{flex:1,background:"#020306",borderRadius:"14px",overflow:"hidden",border:"1px solid rgba(255, 255, 255, 0.12)",position:"relative"},children:U?(0,t.jsx)("iframe",{src:U,title:"Live Preview",sandbox:"allow-scripts allow-forms",style:{width:"100%",height:"100%",border:"none",background:"#020306"}}):(0,t.jsx)("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"var(--text-muted)",fontSize:"0.75rem"},children:"Generando sandbox..."})})]})]}),"import"===b&&(0,t.jsxs)("div",{style:{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:"16px"},children:[(0,t.jsxs)("div",{style:{background:"rgba(10, 14, 28, 0.7)",border:"1px solid rgba(255, 255, 255, 0.12)",borderRadius:"16px",padding:"20px"},children:[(0,t.jsxs)("h3",{style:{fontSize:"0.95rem",fontWeight:900,color:"#FFFFFF",margin:"0 0 8px 0",display:"flex",alignItems:"center",gap:"8px"},children:["📁 ",(0,t.jsx)("span",{children:"Cargar Archivo de Aplicación"})]}),(0,t.jsxs)("p",{style:{fontSize:"0.78rem",color:"var(--text-secondary)",margin:"0 0 16px 0",lineHeight:1.4},children:["Selecciona un archivo ",(0,t.jsx)("code",{children:".redapp"})," firmado digitalmente o un manifiesto ",(0,t.jsx)("code",{children:".json"})," exportado previamente."]}),(0,t.jsxs)("label",{style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"10px 18px",background:"linear-gradient(135deg, rgba(0,230,118,0.2) 0%, rgba(0,229,255,0.2) 100%)",border:"1px solid rgba(0, 230, 118, 0.4)",borderRadius:"10px",color:"var(--accent-emerald)",fontWeight:900,fontSize:"0.82rem",cursor:"pointer"},children:[(0,t.jsx)("span",{children:"📥 Seleccionar Archivo (.redapp / .json)"}),(0,t.jsx)("input",{type:"file",accept:".json,.redapp",onChange:e=>{let t=e.target.files?.[0];if(!t)return;let a=new FileReader;a.onload=e=>{let t=e.target?.result;t&&Y(t)},a.readAsText(t)},style:{display:"none"}})]})]}),(0,t.jsxs)("div",{style:{background:"rgba(10, 14, 28, 0.7)",border:"1px solid rgba(255, 255, 255, 0.12)",borderRadius:"16px",padding:"20px",display:"flex",flexDirection:"column",gap:"12px"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,t.jsxs)("h3",{style:{fontSize:"0.95rem",fontWeight:900,color:"#FFFFFF",margin:0,display:"flex",alignItems:"center",gap:"8px"},children:["📋 ",(0,t.jsx)("span",{children:"Pegar Paquete Codificado (Air-Gap / Portapapeles)"})]}),(0,t.jsx)("span",{style:{fontSize:"0.68rem",color:"var(--accent-cyan)",fontFamily:"JetBrains Mono, monospace"},children:"Formatos: RED_APP_V1:* o JSON Raw"})]}),(0,t.jsx)("p",{style:{fontSize:"0.78rem",color:"var(--text-secondary)",margin:0,lineHeight:1.4},children:"Para dispositivos tácticos aislados sin acceso al explorador de archivos del sistema, pega la cadena Base64 o el contenido del paquete directamente:"}),(0,t.jsx)("textarea",{rows:6,value:C,onChange:e=>R(e.target.value),placeholder:"Pega aquí el paquete RED_APP_V1:... o JSON de la Mini-App...",className:"tactical-input",style:{width:"100%",fontFamily:"JetBrains Mono, monospace",fontSize:"0.75rem",color:"var(--accent-emerald)"}}),(0,t.jsxs)("div",{style:{display:"flex",gap:"10px",justifyContent:"flex-end"},children:[C&&(0,t.jsx)("button",{type:"button",onClick:()=>{c.TacticalAudioEngine.playTap(),R("")},style:{padding:"8px 14px",background:"rgba(255, 255, 255, 0.06)",border:"1px solid rgba(255, 255, 255, 0.14)",borderRadius:"8px",color:"#FFFFFF",fontSize:"0.78rem",fontWeight:700,cursor:"pointer"},children:"Limpiar"}),(0,t.jsx)("button",{type:"button",onClick:()=>Y(C),disabled:!C.trim(),style:{padding:"8px 18px",background:C.trim()?"linear-gradient(135deg, #00E676 0%, #00E5FF 100%)":"rgba(255, 255, 255, 0.1)",border:"none",borderRadius:"8px",color:C.trim()?"#000000":"var(--text-muted)",fontSize:"0.78rem",fontWeight:900,cursor:C.trim()?"pointer":"not-allowed"},children:"⚡ Instalar Paquete"})]})]})]}),"mesh"===b&&(0,t.jsxs)("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",padding:"16px"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"},children:[(0,t.jsxs)("div",{children:[(0,t.jsxs)("h3",{style:{fontSize:"0.95rem",fontWeight:900,color:"#FFFFFF",margin:0,display:"flex",alignItems:"center",gap:"8px"},children:["📡 ",(0,t.jsx)("span",{children:"Micro-Aplicaciones en la Malla P2P"}),(0,t.jsxs)("span",{style:{fontSize:"0.68rem",padding:"2px 8px",background:"rgba(0, 230, 118, 0.15)",border:"1px solid rgba(0, 230, 118, 0.4)",color:"var(--accent-emerald)",borderRadius:"10px",fontFamily:"JetBrains Mono, monospace"},children:[E.length," Detectadas"]})]}),(0,t.jsx)("p",{style:{fontSize:"0.75rem",color:"var(--text-secondary)",margin:"4px 0 0 0"},children:"Paquetes y manifiestos de aplicaciones recibidos en vivo a través de canales de radio LoRa, Bluetooth LE y WiFi-Direct."})]}),E.length>0&&(0,t.jsx)("button",{type:"button",onClick:()=>{c.TacticalAudioEngine.playTap(),j([]),p.toast.info("Historial de paquetes de malla limpiado.")},style:{padding:"6px 12px",background:"rgba(255, 255, 255, 0.06)",border:"1px solid rgba(255, 255, 255, 0.12)",color:"#FFFFFF",borderRadius:"8px",fontSize:"0.72rem",cursor:"pointer"},children:"Limpiar Registro"})]}),0===E.length?(0,t.jsxs)("div",{style:{flex:1,border:"1px dashed rgba(255, 255, 255, 0.15)",borderRadius:"16px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"10px",color:"var(--text-muted)",textAlign:"center",padding:"24px"},children:[(0,t.jsx)("div",{style:{fontSize:"2.5rem"},children:"📡"}),(0,t.jsx)("div",{style:{fontSize:"0.9rem",fontWeight:800,color:"#E2E8F0"},children:"Transceptor a la Escucha en Canales de Radio"}),(0,t.jsx)("p",{style:{fontSize:"0.75rem",maxWidth:"420px",margin:0,lineHeight:1.5},children:"Cuando los nodos de tu escuadrón o base transmitan aplicaciones soberanas mediante la red de malla descentralizada, aparecerán aquí automáticamente para su instalación con un clic."})]}):(0,t.jsx)("div",{style:{flex:1,overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))",gap:"12px"},children:E.map(e=>(0,t.jsxs)("div",{style:{background:"linear-gradient(180deg, rgba(16, 22, 44, 0.8) 0%, rgba(8, 12, 26, 0.9) 100%)",border:"1px solid rgba(0, 229, 255, 0.25)",borderRadius:"14px",padding:"14px",display:"flex",flexDirection:"column",justifyContent:"space-between",boxShadow:"0 4px 16px rgba(0, 0, 0, 0.5)"},children:[(0,t.jsxs)("div",{children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"},children:[(0,t.jsx)("div",{style:{width:"40px",height:"40px",borderRadius:"10px",background:"rgba(0, 229, 255, 0.1)",border:"1px solid rgba(0, 229, 255, 0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.3rem"},children:e.manifest.icon||"📱"}),(0,t.jsxs)("div",{children:[(0,t.jsx)("h4",{style:{fontSize:"0.85rem",fontWeight:900,color:"#FFFFFF",margin:0},children:e.manifest.name}),(0,t.jsxs)("div",{style:{fontSize:"0.68rem",color:"var(--accent-cyan)",fontFamily:"JetBrains Mono, monospace"},children:["v",e.manifest.version," • ",e.manifest.category]})]})]}),(0,t.jsx)("p",{style:{fontSize:"0.75rem",color:"var(--text-secondary)",margin:"0 0 8px 0",lineHeight:1.3},children:e.manifest.description}),(0,t.jsxs)("div",{style:{fontSize:"0.65rem",color:"var(--text-muted)",fontFamily:"JetBrains Mono, monospace",marginBottom:"10px"},children:[(0,t.jsxs)("div",{children:["Autor: ",e.authorDid?.slice(0,16),"..."]}),(0,t.jsxs)("div",{children:["Recibido: ",new Date(e.timestamp).toLocaleTimeString()]})]})]}),(0,t.jsxs)("div",{style:{display:"flex",gap:"8px",paddingTop:"10px",borderTop:"1px solid rgba(255, 255, 255, 0.08)"},children:[e.pkg&&(0,t.jsx)("button",{type:"button",onClick:()=>G(e.pkg,"Paquete Malla"),style:{padding:"6px 10px",background:"rgba(255, 255, 255, 0.06)",border:"1px solid rgba(255, 255, 255, 0.12)",color:"#FFFFFF",borderRadius:"8px",fontSize:"0.72rem",cursor:"pointer"},title:"Copiar paquete firmado base64",children:"📋 Copiar"}),(0,t.jsx)("button",{type:"button",onClick:()=>(e=>{if(c.TacticalAudioEngine.playTap(),e.pkg){let t=o.redAppRegistry.importAppPackage(e.pkg);if(t.isValid&&t.bundle){o.redAppRegistry.installApp(t.bundle),K(),c.TacticalAudioEngine.playMessageSent(),p.toast.success(`🚀 Mini-App '${t.bundle.manifest.name}' instalada desde la malla.`),g(t.bundle);return}}c.TacticalAudioEngine.playWarning(),p.toast.error("El paquete recibido no contiene un bundle ejecutable válido.")})(e),style:{flex:1,padding:"6px 12px",background:"linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",border:"none",color:"#000000",fontWeight:900,borderRadius:"8px",fontSize:"0.75rem",cursor:"pointer"},children:"⚡ Instalar e Iniciar"})]})]},e.appId))})]})]})})}])},18893,e=>{e.n(e.i(35286))}]);