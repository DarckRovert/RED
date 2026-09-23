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

window.addEventListener('DOMContentLoaded', init);`}},o={manifest:{id:"org.redmesh.battleship",name:"Batalla Naval P2P",version:"1.0.0",description:"Juego táctico multijugador en tiempo real por radio y Bluetooth sin conexión a internet.",author:{name:"RED Tactical Gaming",did:"did:red:0000000000000000000000000000000000000000000000000000000000000003"},icon:"🚢",category:"games",permissions:["identity","mesh_pubsub","storage"],entryPoint:"index.html",createdAt:Date.now(),updatedAt:Date.now()},files:{"index.html":`<!DOCTYPE html>
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

window.addEventListener('DOMContentLoaded', init);`}},r={manifest:{id:"org.redmesh.biocybernetic.habitat",name:"Hábitat Biocibernético 3D",version:"1.0.0",description:"Ecosistema biocibernético in-silico con física de difusión de Fick, visión omatidial, termodinámica real y migración P2P.",author:{name:"RED Biocybernetics Laboratory",did:"did:red:0000000000000000000000000000000000000000000000000000000000000008"},icon:"🪰",category:"utility",permissions:["identity","mesh_pubsub","storage","sensors"],entryPoint:"index.html",createdAt:Date.now(),updatedAt:Date.now()},files:{"index.html":`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>H\xe1bitat Biocibern\xe9tico 3D</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header class="app-header">
        <span class="app-icon">🪰</span>
        <div class="header-titles">
            <h1>H\xc1BITAT BIOCIBERN\xc9TICO</h1>
            <p class="subtitle">Ecosistema In-Silico &middot; Difusi\xf3n Fick &middot; Drosophila</p>
        </div>
        <div class="hud-status">
            <span id="hud-atp" class="badge badge-green">ATP: 100%</span>
            <span id="hud-state" class="badge badge-blue">ESTADO: \xd3PTIMO</span>
            <span id="hud-mesh" class="badge badge-purple">MALLA: P2P LISTO</span>
        </div>
    </header>

    <div class="viewport-container">
        <canvas id="habitat-canvas" width="600" height="420"></canvas>
        <div id="alert-banner" class="alert-banner"></div>
    </div>

    <div class="control-panel">
        <div class="panel-section">
            <label class="section-label">🛠️ INSTRUMENTAL DE EXPERIMENTACI\xd3N</label>
            <div class="button-group">
                <button id="tool-glucose" class="btn btn-tool active" onclick="selectTool('GLUCOSE')">💧 Pipeta Glucosa</button>
                <button id="tool-heat" class="btn btn-tool" onclick="selectTool('HEAT')">🔥 Foco Infrarrojo</button>
                <button id="tool-shadow" class="btn btn-tool" onclick="selectTool('SHADOW')">🌑 Sombra Looming</button>
                <button id="tool-chr2" class="btn btn-tool" onclick="selectTool('CHR2')">⚡ Optogen\xe9tica ChR2</button>
            </div>
        </div>

        <div class="panel-section">
            <label class="section-label">📡 ACCIONES DE ENJAMBRE & MALLA P2P</label>
            <div class="button-group">
                <button class="btn btn-action" onclick="emigrateToMesh()">🚀 Emigrar Organismo a Malla</button>
                <button class="btn btn-action" onclick="spawnNewAgent()">➕ A\xf1adir Drosophila</button>
                <button class="btn btn-danger" onclick="clearField()">🧹 Limpiar Sustrato</button>
            </div>
        </div>
    </div>

    <footer class="app-footer">
        <span>RED Sovereign OS &middot; Mini-App Biocibern\xe9tica v120.0.0</span>
        <span id="footer-metrics">Fick Grid: 64x64 &middot; Tick: 60Hz &middot; STDP: Activo</span>
    </footer>

    <script src="app.js"></script>
</body>
</html>`,"style.css":`* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
}

body {
    background: #060c18;
    color: #e2e8f0;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
}

.app-header {
    background: rgba(10, 20, 36, 0.95);
    border-bottom: 1px solid rgba(0, 240, 255, 0.25);
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.app-icon {
    font-size: 24px;
}

.header-titles h1 {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 1px;
    color: #00f0ff;
}

.subtitle {
    font-size: 10px;
    color: #8b9bb4;
}

.hud-status {
    margin-left: auto;
    display: flex;
    gap: 8px;
}

.badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
}

.badge-green { background: rgba(0, 255, 136, 0.15); border: 1px solid #00ff88; color: #00ff88; }
.badge-blue { background: rgba(0, 240, 255, 0.15); border: 1px solid #00f0ff; color: #00f0ff; }
.badge-purple { background: rgba(168, 85, 247, 0.15); border: 1px solid #a855f7; color: #a855f7; }

.viewport-container {
    flex: 1;
    position: relative;
    background: #020610;
    display: flex;
    justify-content: center;
    align-items: center;
}

#habitat-canvas {
    width: 100%;
    height: 100%;
    cursor: crosshair;
}

.alert-banner {
    position: absolute;
    top: 12px;
    background: rgba(255, 51, 85, 0.25);
    border: 1px solid #ff3355;
    color: #ff3355;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 800;
    display: none;
}

.control-panel {
    background: #091220;
    border-top: 1px solid rgba(0, 240, 255, 0.2);
    padding: 10px 16px;
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
}

.panel-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.section-label {
    font-size: 10px;
    font-weight: 800;
    color: #8b9bb4;
    letter-spacing: 0.5px;
}

.button-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid rgba(139, 155, 180, 0.3);
    background: rgba(25, 40, 65, 0.5);
    color: #c8d6e5;
}

.btn:hover {
    background: rgba(0, 240, 255, 0.15);
    border-color: #00f0ff;
    color: #00f0ff;
}

.btn-tool.active {
    background: rgba(0, 240, 255, 0.25);
    border-color: #00f0ff;
    color: #00f0ff;
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
}

.btn-action {
    background: rgba(0, 255, 136, 0.12);
    border-color: #00ff88;
    color: #00ff88;
}

.btn-danger {
    background: rgba(255, 51, 85, 0.12);
    border-color: #ff3355;
    color: #ff3355;
}

.app-footer {
    background: #040812;
    border-top: 1px solid rgba(139, 155, 180, 0.15);
    padding: 6px 16px;
    font-size: 10px;
    color: #576574;
    display: flex;
    justify-content: space-between;
}`,"app.js":`// Simulaci\xf3n del H\xe1bitat Biocibern\xe9tico en Mini-App
const canvas = document.getElementById('habitat-canvas');
const ctx = canvas.getContext('2d');

let currentTool = 'GLUCOSE';
let atp = 100.0;
let glucose = 100.0;
let organisms = [{
    x: 300,
    y: 210,
    heading: 0,
    speed: 1.2,
    antennaeDiff: 0,
    atp: 100
}];

let chemicals = []; // {x, y, radius, intensity, substance}
let shadows = [];   // {x, y, radius, velocity}

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function selectTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('tool-' + tool.toLowerCase());
    if (btn) btn.classList.add('active');
}

canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'GLUCOSE') {
        chemicals.push({ x, y, radius: 15, intensity: 1.0, substance: 'GLUCOSE' });
    } else if (currentTool === 'HEAT') {
        chemicals.push({ x, y, radius: 25, intensity: 1.0, substance: 'ALARM' });
    } else if (currentTool === 'SHADOW') {
        shadows.push({ x, y, radius: 8, velocity: 3.5 });
        showAlert("🌑 SOMBRA EXPANSIVA LOOMING: Disparo de Giant Fiber LC4");
    } else if (currentTool === 'CHR2') {
        atp = Math.min(100, atp + 15);
        showAlert("⚡ PULSO OPTOGEN\xc9TICO ChR2: Despolarizaci\xf3n Dopamin\xe9rgica PAM");
    }
});

function showAlert(text) {
    const b = document.getElementById('alert-banner');
    b.innerText = text;
    b.style.display = 'block';
    setTimeout(() => { b.style.display = 'none'; }, 2200);
}

function spawnNewAgent() {
    organisms.push({
        x: Math.random() * (canvas.width - 40) + 20,
        y: Math.random() * (canvas.height - 40) + 20,
        heading: Math.random() * Math.PI * 2,
        speed: 1.0,
        antennaeDiff: 0,
        atp: 100
    });
}

function clearField() {
    chemicals = [];
    shadows = [];
}

async function emigrateToMesh() {
    if (window.RedSDK && window.RedSDK.mesh) {
        try {
            await window.RedSDK.mesh.publish('mesh.bio.habitat.v1', {
                type: 'DROSOPHILA',
                atp: atp,
                timestamp: Date.now()
            });
            showAlert("🚀 ORGANISMO EMIGRADO A LA MALLA P2P (SX1262 LoRa/BLE)");
        } catch {
            showAlert("📡 Paquete de migraci\xf3n encolado en DTN Store & Forward");
        }
    } else {
        showAlert("🚀 ORGANISMO EMIGRADO (Simulado sobre bus local)");
    }
}

// Bucle f\xedsico y renderizado a 60 Hz
function step() {
    // 1. Difusi\xf3n y evaporaci\xf3n de qu\xedmicos
    for (let i = chemicals.length - 1; i >= 0; i--) {
        const c = chemicals[i];
        c.radius += 0.15;
        c.intensity *= 0.992;
        if (c.intensity < 0.05) chemicals.splice(i, 1);
    }

    // 2. Sombras Looming
    for (let i = shadows.length - 1; i >= 0; i--) {
        const s = shadows[i];
        s.radius += s.velocity;
        if (s.radius > 120) shadows.splice(i, 1);
    }

    // 3. Organismos
    atp = Math.max(0, atp - 0.02);
    document.getElementById('hud-atp').innerText = 'ATP: ' + Math.round(atp) + '%';
    document.getElementById('hud-state').innerText = atp > 60 ? 'ESTADO: \xd3PTIMO' : (atp > 15 ? 'ESTADO: AHORRO' : 'ESTADO: TORPOR');

    for (const org of organisms) {
        // Tropotaxis antenal
        let leftSensor = 0;
        let rightSensor = 0;
        const antDist = 18;
        const antAngle = 0.5;

        const lx = org.x + Math.cos(org.heading - antAngle) * antDist;
        const ly = org.y + Math.sin(org.heading - antAngle) * antDist;
        const rx = org.x + Math.cos(org.heading + antAngle) * antDist;
        const ry = org.y + Math.sin(org.heading + antAngle) * antDist;

        for (const c of chemicals) {
            if (c.substance === 'GLUCOSE') {
                const dl = Math.hypot(c.x - lx, c.y - ly);
                const dr = Math.hypot(c.x - rx, c.y - ry);
                leftSensor += c.intensity / (1 + dl * 0.05);
                rightSensor += c.intensity / (1 + dr * 0.05);

                // Alimentaci\xf3n si toca la gota
                if (Math.hypot(c.x - org.x, c.y - org.y) < c.radius) {
                    atp = Math.min(100, atp + 0.3);
                }
            }
        }

        const delta = rightSensor - leftSensor;
        org.heading += delta * 0.15 + (Math.random() - 0.5) * 0.08;

        const speed = (atp > 15 ? 1.4 : 0.4) * (leftSensor + rightSensor > 0.1 ? 1.6 : 1.0);
        org.x += Math.cos(org.heading) * speed;
        org.y += Math.sin(org.heading) * speed;

        // Rebote en bordes
        if (org.x < 15) { org.x = 15; org.heading = Math.PI - org.heading; }
        if (org.x > canvas.width - 15) { org.x = canvas.width - 15; org.heading = Math.PI - org.heading; }
        if (org.y < 15) { org.y = 15; org.heading = -org.heading; }
        if (org.y > canvas.height - 15) { org.y = canvas.height - 15; org.heading = -org.heading; }
    }

    render();
    requestAnimationFrame(step);
}

function render() {
    ctx.fillStyle = '#020610';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Rejilla de fondo
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Dibujar Qu\xedmicos
    for (const c of chemicals) {
        const radGrad = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.radius);
        if (c.substance === 'GLUCOSE') {
            radGrad.addColorStop(0, 'rgba(0, 255, 136, ' + (c.intensity * 0.8) + ')');
            radGrad.addColorStop(1, 'rgba(0, 255, 136, 0)');
        } else {
            radGrad.addColorStop(0, 'rgba(255, 51, 85, ' + (c.intensity * 0.8) + ')');
            radGrad.addColorStop(1, 'rgba(255, 51, 85, 0)');
        }
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Dibujar Sombras Looming
    for (const s of shadows) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff3355';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Dibujar Organismos
    for (const org of organisms) {
        ctx.save();
        ctx.translate(org.x, org.y);
        ctx.rotate(org.heading);

        // Antenas
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(6, -2); ctx.lineTo(16, -8);
        ctx.moveTo(6, 2); ctx.lineTo(16, 8);
        ctx.stroke();

        // Omatidios (ojos compuestos)
        ctx.fillStyle = '#ff0055';
        ctx.beginPath(); ctx.arc(4, -4, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(4, 4, 2.5, 0, Math.PI * 2); ctx.fill();

        // Cuerpo / T\xf3rax
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Alas trasl\xfacidas
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath(); ctx.ellipse(-4, -6, 8, 3, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-4, 6, 8, 3, 0.2, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }
}

requestAnimationFrame(step);
`}},n="red_installed_miniapps_v1";class s{static instance=null;apps=new Map;constructor(){this.loadFromStorage(),this.ensureBuiltinApps()}static getInstance(){return s.instance||(s.instance=new s),s.instance}loadFromStorage(){try{let e=localStorage.getItem(n);e&&JSON.parse(e).forEach(e=>this.apps.set(e.manifest.id,e))}catch(e){console.error("[RedAppRegistry] Error loading apps from storage:",e)}}saveToStorage(){try{let e=Array.from(this.apps.values());localStorage.setItem(n,JSON.stringify(e))}catch(e){console.error("[RedAppRegistry] Error saving apps to storage:",e)}}ensureBuiltinApps(){[a,i,o,r].forEach(e=>{let t=this.apps.get(e.manifest.id);t?(t.manifest=e.manifest,t.bundle=e,t.isBuiltin=!0):this.apps.set(e.manifest.id,{manifest:e.manifest,bundle:e,installedAt:Date.now(),lastOpenedAt:Date.now(),grantedPermissions:e.manifest.permissions,isBuiltin:!0})}),this.saveToStorage()}getAllApps(){return Array.from(this.apps.values()).sort((e,t)=>t.lastOpenedAt-e.lastOpenedAt)}getApp(e){return this.apps.get(e)}installApp(e,t){let a={manifest:e.manifest,bundle:e,installedAt:Date.now(),lastOpenedAt:Date.now(),grantedPermissions:t||e.manifest.permissions,isBuiltin:!1};return this.apps.set(e.manifest.id,a),this.saveToStorage(),a}uninstallApp(e){let t=this.apps.get(e);if(t?.isBuiltin)return console.warn("No se pueden desinstalar aplicaciones nativas del sistema."),!1;let a=this.apps.delete(e);return a&&this.saveToStorage(),a}updatePermissions(e,t){let a=this.apps.get(e);a&&(a.grantedPermissions=t,this.saveToStorage())}touchApp(e){let t=this.apps.get(e);t&&(t.lastOpenedAt=Date.now(),this.saveToStorage())}exportAppPackage(e){let a=this.apps.get(e);if(!a)return null;let i=JSON.stringify({format:"RED_APP_PACKAGE_V1",exportedAt:Date.now(),bundle:a.bundle,manifest:a.manifest}),o="u">typeof btoa?btoa(unescape(encodeURIComponent(i))):t.Buffer.from(i).toString("base64");return`RED_APP_V1:${o}`}importAppPackage(e){try{let a=e.trim();a.startsWith("RED_APP_V1:")&&(a=a.substring(11));let i="u">typeof atob?decodeURIComponent(escape(atob(a))):t.Buffer.from(a,"base64").toString("utf8"),o=JSON.parse(i);if(!o.bundle||!o.bundle.manifest||!o.bundle.manifest.id||!o.bundle.html)return{bundle:null,isValid:!1,error:"Estructura de paquete inválida o manifiesto corrupto."};let r=o.bundle.manifest;if(!r.name||!r.version)return{bundle:null,isValid:!1,error:"El manifiesto no especifica nombre o versión."};if(!/^[a-zA-Z0-9_.-]{3,64}$/.test(r.id))return{bundle:null,isValid:!1,error:"El identificador de la aplicación debe ser alfanumérico (3-64 caracteres)."};if(!/^\d+\.\d+\.\d+/.test(r.version))return{bundle:null,isValid:!1,error:"La versión de la aplicación debe seguir el formato SemVer (ej: 1.0.0)."};return{bundle:o.bundle,isValid:!0}}catch(e){return{bundle:null,isValid:!1,error:e.message||"Error al decodificar paquete de aplicación."}}}}let l=s.getInstance();e.s(["redAppRegistry",0,l],19439)},26520,e=>{"use strict";var t=e.i(14582);class a{static getClientSDKScript(e){return`
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
${a}`}static createBlobUrl(e){let t=new Blob([this.compileBundleToHtml(e)],{type:"text/html;charset=utf-8"});return URL.createObjectURL(t)}static revokeBlobUrl(e){if(e&&e.startsWith("blob:"))try{URL.revokeObjectURL(e)}catch{}}static exportBundle(e,a){let i=Object.keys(a).sort(),o=new TextEncoder,r="";for(let e of i)r+=`${e}:${a[e]||""}
`;let n=Array.from((0,t.sha256)(o.encode(r))).map(e=>e.toString(16).padStart(2,"0")).join(""),s=`sha256_${n}_${i.length}`;return JSON.stringify({manifest:{...e,updatedAt:Date.now(),integrityDigest:s},files:a})}static importBundle(e){try{let a=JSON.parse(e);if(!a.manifest||!a.manifest.id||!a.files)throw Error("El archivo .redapp no tiene un manifiesto o archivos válidos.");if(a.manifest.integrityDigest){let e=Object.keys(a.files).sort(),i=new TextEncoder,o="";for(let t of e)o+=`${t}:${a.files[t]||""}
`;let r=(0,t.sha256)(i.encode(o)),n=Array.from(r).map(e=>e.toString(16).padStart(2,"0")).join(""),s=`sha256_${n}_${e.length}`;a.manifest.integrityDigest!==s&&console.warn(`[RedAppBundleEngine] Advertencia de integridad en paquete ${a.manifest.id}`)}return a}catch(e){throw Error(`Error al procesar paquete .redapp: ${e.message}`)}}}e.s(["RedAppBundleEngine",()=>a])}]);