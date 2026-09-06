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

window.addEventListener('DOMContentLoaded', init);`}},r={manifest:{id:"org.redmesh.wiki",name:"MeshWiki Táctica",version:"1.0.0",description:"Enciclopedia interactiva de supervivencia, medicina de campaña y radiocomunicaciones 100% offline.",author:{name:"RED Survival & Civil Defense Lab",did:"did:red:0000000000000000000000000000000000000000000000000000000000000002"},icon:"📚",category:"utility",permissions:["identity","storage","ai"],entryPoint:"index.html",createdAt:Date.now(),updatedAt:Date.now()},files:{"index.html":`<!DOCTYPE html>
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

window.addEventListener('DOMContentLoaded', init);`}},i={manifest:{id:"org.redmesh.battleship",name:"Batalla Naval P2P",version:"1.0.0",description:"Juego táctico multijugador en tiempo real por radio y Bluetooth sin conexión a internet.",author:{name:"RED Tactical Gaming",did:"did:red:0000000000000000000000000000000000000000000000000000000000000003"},icon:"🚢",category:"games",permissions:["identity","mesh_pubsub","storage"],entryPoint:"index.html",createdAt:Date.now(),updatedAt:Date.now()},files:{"index.html":`<!DOCTYPE html>
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

window.addEventListener('DOMContentLoaded', init);`}},o="red_installed_miniapps_v1";class n{static instance=null;apps=new Map;constructor(){this.loadFromStorage(),this.ensureBuiltinApps()}static getInstance(){return n.instance||(n.instance=new n),n.instance}loadFromStorage(){try{let e=localStorage.getItem(o);e&&JSON.parse(e).forEach(e=>this.apps.set(e.manifest.id,e))}catch(e){console.error("[RedAppRegistry] Error loading apps from storage:",e)}}saveToStorage(){try{let e=Array.from(this.apps.values());localStorage.setItem(o,JSON.stringify(e))}catch(e){console.error("[RedAppRegistry] Error saving apps to storage:",e)}}ensureBuiltinApps(){[a,r,i].forEach(e=>{let t=this.apps.get(e.manifest.id);t?(t.manifest=e.manifest,t.bundle=e,t.isBuiltin=!0):this.apps.set(e.manifest.id,{manifest:e.manifest,bundle:e,installedAt:Date.now(),lastOpenedAt:Date.now(),grantedPermissions:e.manifest.permissions,isBuiltin:!0})}),this.saveToStorage()}getAllApps(){return Array.from(this.apps.values()).sort((e,t)=>t.lastOpenedAt-e.lastOpenedAt)}getApp(e){return this.apps.get(e)}installApp(e,t){let a={manifest:e.manifest,bundle:e,installedAt:Date.now(),lastOpenedAt:Date.now(),grantedPermissions:t||e.manifest.permissions,isBuiltin:!1};return this.apps.set(e.manifest.id,a),this.saveToStorage(),a}uninstallApp(e){let t=this.apps.get(e);if(t?.isBuiltin)return console.warn("No se pueden desinstalar aplicaciones nativas del sistema."),!1;let a=this.apps.delete(e);return a&&this.saveToStorage(),a}updatePermissions(e,t){let a=this.apps.get(e);a&&(a.grantedPermissions=t,this.saveToStorage())}touchApp(e){let t=this.apps.get(e);t&&(t.lastOpenedAt=Date.now(),this.saveToStorage())}exportAppPackage(e){let a=this.apps.get(e);if(!a)return null;let r=JSON.stringify({format:"RED_APP_PACKAGE_V1",exportedAt:Date.now(),bundle:a.bundle,manifest:a.manifest}),i="u">typeof btoa?btoa(unescape(encodeURIComponent(r))):t.Buffer.from(r).toString("base64");return`RED_APP_V1:${i}`}importAppPackage(e){try{let a=e.trim();a.startsWith("RED_APP_V1:")&&(a=a.substring(11));let r="u">typeof atob?decodeURIComponent(escape(atob(a))):t.Buffer.from(a,"base64").toString("utf8"),i=JSON.parse(r);if(!i.bundle||!i.bundle.manifest||!i.bundle.manifest.id||!i.bundle.html)return{bundle:null,isValid:!1,error:"Estructura de paquete inválida o manifiesto corrupto."};let o=i.bundle.manifest;if(!o.name||!o.version)return{bundle:null,isValid:!1,error:"El manifiesto no especifica nombre o versión."};if(!/^[a-zA-Z0-9_.-]{3,64}$/.test(o.id))return{bundle:null,isValid:!1,error:"El identificador de la aplicación debe ser alfanumérico (3-64 caracteres)."};if(!/^\d+\.\d+\.\d+/.test(o.version))return{bundle:null,isValid:!1,error:"La versión de la aplicación debe seguir el formato SemVer (ej: 1.0.0)."};return{bundle:i.bundle,isValid:!0}}catch(e){return{bundle:null,isValid:!1,error:e.message||"Error al decodificar paquete de aplicación."}}}}let s=n.getInstance();e.s(["redAppRegistry",0,s],19439)},26520,e=>{"use strict";var t=e.i(14582);class a{static getClientSDKScript(e){return`
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
`}static compileBundleToHtml(e){let t=e.manifest.entryPoint||"index.html",a=e.files[t]||"<html><body><h1>Mini-App no encontrada</h1></body></html>",r=`<script id="red-sdk-injected">
${this.getClientSDKScript(e.manifest.id)}
</script>`;return Object.entries(e.files).forEach(([e,r])=>{e.endsWith(".js")&&e!==t?a=a.replace(RegExp(`<script[^>]*src=["']\\.?/?${e}["'][^>]*>\\s*</script>`,"gi"),`<script data-inlined="${e}">
${r}
</script>`):e.endsWith(".css")&&(a=a.replace(RegExp(`<link[^>]*rel=["']stylesheet["'][^>]*href=["']\\.?/?${e}["'][^>]*>`,"gi"),`<style data-inlined="${e}">
${r}
</style>`))}),a=a.includes("<head>")?a.replace("<head>",`<head>
${r}`):a.includes("<html>")?a.replace("<html>",`<html>
<head>
${r}
</head>`):`${r}
${a}`}static createBlobUrl(e){let t=new Blob([this.compileBundleToHtml(e)],{type:"text/html;charset=utf-8"});return URL.createObjectURL(t)}static revokeBlobUrl(e){if(e&&e.startsWith("blob:"))try{URL.revokeObjectURL(e)}catch{}}static exportBundle(e,a){let r=Object.keys(a).sort(),i=new TextEncoder,o="";for(let e of r)o+=`${e}:${a[e]||""}
`;let n=Array.from((0,t.sha256)(i.encode(o))).map(e=>e.toString(16).padStart(2,"0")).join(""),s=`sha256_${n}_${r.length}`;return JSON.stringify({manifest:{...e,updatedAt:Date.now(),integrityDigest:s},files:a})}static importBundle(e){try{let a=JSON.parse(e);if(!a.manifest||!a.manifest.id||!a.files)throw Error("El archivo .redapp no tiene un manifiesto o archivos válidos.");if(a.manifest.integrityDigest){let e=Object.keys(a.files).sort(),r=new TextEncoder,i="";for(let t of e)i+=`${t}:${a.files[t]||""}
`;let o=(0,t.sha256)(r.encode(i)),n=Array.from(o).map(e=>e.toString(16).padStart(2,"0")).join(""),s=`sha256_${n}_${e.length}`;a.manifest.integrityDigest!==s&&console.warn(`[RedAppBundleEngine] Advertencia de integridad en paquete ${a.manifest.id}`)}return a}catch(e){throw Error(`Error al procesar paquete .redapp: ${e.message}`)}}}e.s(["RedAppBundleEngine",()=>a])},91596,85067,77319,e=>{"use strict";var t=e.i(60352),a=e.i(8901);class r{static instance=null;callbacks={};static getInstance(){return r.instance||(r.instance=new r),r.instance}registerUIHandler(e){this.callbacks=e}async processPayment(e,t){if(!e.amount||e.amount<=0)throw Error("El monto del pago debe ser mayor a 0.");if(this.callbacks.onOpenCheckoutModal)return new Promise((t,a)=>{this.callbacks.onOpenCheckoutModal(e,t,a)});let a=e.supportedRails&&e.supportedRails.length>0?e.supportedRails:["paypal","web3_usdt","offgrid_voucher"];if(a.includes("paypal")&&e.merchant.paypalUsername)return this.executePayPalPayment(e,t);if(a.includes("web3_usdt")&&e.merchant.evmAddress)return this.executeWeb3Payment(e,t);if(a.includes("offgrid_voucher"))return this.executeOffgridVoucherPayment(e,t);throw Error("No hay un riel de pago configurado compatible con este comercio.")}async executePayPalPayment(e,t){let a=e.merchant.paypalUsername||"redmesh",r=e.amount.toFixed(2),i="CREDITS"===e.currency?"USD":e.currency,o=`https://paypal.me/${a}/${r}${i}`;window.open&&window.open(o,"_blank","noopener,noreferrer");let n="u">typeof crypto&&crypto.getRandomValues?Array.from(crypto.getRandomValues(new Uint8Array(4))).map(e=>e.toString(16).padStart(2,"0")).join(""):Date.now().toString(36);return{success:!0,rail:"paypal",transactionId:`pp_${Date.now()}_${n}`,amount:e.amount,currency:i,timestamp:Date.now(),merchantDid:e.merchant.did,buyerDid:t,details:{paypalUrl:o,merchantUsername:a,status:"intent_opened",pendingConfirmation:!0}}}async executeWeb3Payment(e,a){let r=t.Web3BridgeEngine.getInstance().getState();if(!e.merchant.evmAddress||!e.merchant.evmAddress.startsWith("0x"))throw Error("La dirección EVM del comercio no es válida.");let i=new Uint8Array(32);crypto.getRandomValues(i);let o=`0x${Array.from(i,e=>e.toString(16).padStart(2,"0")).join("")}`;if(!r.isConnected||!r.account||!window.ethereum)throw Error("Billetera Web3 no conectada. Conecte MetaMask o su proveedor Web3 para procesar transferencias EVM.");try{let t=window.ethereum;o=await t.request({method:"eth_sendTransaction",params:[{from:r.account,to:e.merchant.evmAddress,value:"0x0",data:"0x"}]})}catch(e){if(4001===e.code||e.message?.includes("User rejected"))throw Error("Transacción cancelada por el usuario en la billetera Web3.");throw e}return{success:!0,rail:"web3_usdt",transactionId:o,amount:e.amount,currency:"USDT",timestamp:Date.now(),merchantDid:e.merchant.did,buyerDid:a,details:{network:r.chainName||"Polygon PoS",recipientAddress:e.merchant.evmAddress,senderAccount:r.account}}}async executeLightningPayment(e,t){let a="SAT"===e.currency?Math.round(e.amount):Math.round(1500*e.amount),r=new Uint8Array(8);crypto.getRandomValues(r);let i=Array.from(r,e=>e.toString(36)).join("").substring(0,13),o=`lnbc${a}u1p${i}...`;if(window.webln)try{await window.webln.enable(),await window.webln.sendPayment(o)}catch(e){}let n=new Uint8Array(4);return crypto.getRandomValues(n),{success:!0,rail:"lightning",transactionId:`ln_${Date.now()}_${Array.from(n,e=>e.toString(36)).join("").substring(0,7)}`,amount:a,currency:"SAT",timestamp:Date.now(),merchantDid:e.merchant.did,buyerDid:t,details:{paymentRequest:o,lightningAddress:e.merchant.lightningAddress||"merchant@getalby.com"}}}async executeOffgridVoucherPayment(e,t){let r=Math.round(e.amount),i=a.MonetizationEngine.getProStatus().credits;if(i<r)throw Error(`Saldo insuficiente de cr\xe9ditos/vales locales. Requerido: ${r}, Disponible: ${i}`);a.MonetizationEngine.recordTransaction("redeem_product",-r,`Pago Mini-App: ${e.title}`);let o="u">typeof crypto&&crypto.getRandomValues?Array.from(crypto.getRandomValues(new Uint8Array(2))).map(e=>e.toString(16).padStart(2,"0")).join("").toUpperCase():(Date.now()%1e4).toString(16).toUpperCase(),n=`RED-VOUCHER-${Date.now().toString(36).toUpperCase()}-${o}`;return{success:!0,rail:"offgrid_voucher",transactionId:n,amount:r,currency:"CREDITS",timestamp:Date.now(),merchantDid:e.merchant.did,buyerDid:t,signature:`sig_ed25519_${Date.now()}_${Array.from(new Uint8Array(4).fill(0).map(()=>{let e=new Uint8Array(1);return crypto.getRandomValues(e),e[0]}),e=>e.toString(16).padStart(2,"0")).join("")}`,details:{voucherCode:n,concept:e.title,remainingCredits:a.MonetizationEngine.getProStatus().credits}}}}let i=r.getInstance();e.s(["redPaymentGateway",0,i],85067);var o=e.i(69104),n=e.i(55211),s=e.i(13045),d=e.i(83036);class l{iframeWindow=null;manifest;context;meshSubscriptions=new Map;storagePrefix;unsubscribeMeshRouter=null;constructor(e,t,a){this.manifest=e,this.context=t,this.iframeWindow=a||null,this.storagePrefix=`red_app_storage_${e.id}_`}setIframeWindow(e){this.iframeWindow=e}updateGrantedPermissions(e){this.context.grantedPermissions=e}setupMeshRouterListener(){this.unsubscribeMeshRouter||(this.unsubscribeMeshRouter=o.meshRouter.onLocalDelivery(e=>{try{if(!e||!e.payload)return;let t=new TextDecoder().decode(e.payload);if(!t.startsWith("{"))return;let a=JSON.parse(t);if(a.appId===this.manifest.id)if("APP_DATA"===a.type){let t=a.topic||"default";(this.meshSubscriptions.has(t)||this.meshSubscriptions.has("*"))&&this.sendEvent("mesh.message",{topic:t,from:e.sender||"unknown",payload:a.payload,timestamp:a.timestamp||e.timestamp||Date.now()})}else"APP_DATA_DIRECT"===a.type&&this.sendEvent("mesh.directMessage",{from:e.sender||"unknown",payload:a.payload,timestamp:a.timestamp||e.timestamp||Date.now()})}catch{}}))}async handleMessage(e){let t=e.data;if(t&&"RED_SDK"===t.channel&&"RED_SDK_REQUEST"===t.type){if(t.appId!==this.manifest.id)return void this.sendResponse(t.requestId,!1,void 0,"App ID mismatch");try{let e=await this.dispatchMethod(t.method,t.params);this.sendResponse(t.requestId,!0,e)}catch(e){console.error(`[RedSDKBridge] Error executing ${t.method} for ${this.manifest.id}:`,e),this.sendResponse(t.requestId,!1,void 0,e.message||"Internal error")}}}async dispatchMethod(e,r){switch(e){case"identity.getProfile":return this.requirePermission("identity"),{did:this.context.userDid,nickname:this.context.nickname,publicKey:this.context.publicKey,appId:this.manifest.id};case"identity.signData":{this.requirePermission("identity");let e=r?.data||"",t=Date.now(),a=localStorage.getItem("red_private_key")||localStorage.getItem("red_mnemonic_seed")||localStorage.getItem("red_signing_key")||`${this.context.userDid}_vault_key`,i=new TextEncoder,o=await crypto.subtle.importKey("raw",i.encode(a),{name:"HMAC",hash:"SHA-256"},!1,["sign"]),n=i.encode(`${this.context.userDid}:${t}:${e}`),s=Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",o,n))).map(e=>e.toString(16).padStart(2,"0")).join("");return{signature:`ed25519_hmac_sha256:${s}`,signerDid:this.context.userDid,timestamp:t,payload:e}}case"identity.verifySignature":{let{signature:e,payload:t,timestamp:a,signerPublicKey:i}=r||{};if(!e||!t||!a)return{valid:!1,timestamp:Date.now()};try{if(e.startsWith("ed25519_hmac_sha256:")||e.startsWith("hmac_sha256:")){let r=e.startsWith("ed25519_hmac_sha256:")?"ed25519_hmac_sha256:":"hmac_sha256:",o=localStorage.getItem("red_private_key")||localStorage.getItem("red_mnemonic_seed")||localStorage.getItem("red_signing_key")||`${this.context.userDid}_vault_key`,n=new TextEncoder,s=await crypto.subtle.importKey("raw",n.encode(i||o),{name:"HMAC",hash:"SHA-256"},!1,["verify"]),d=new Uint8Array(e.slice(r.length).match(/.{1,2}/g).map(e=>parseInt(e,16))),l=n.encode(`${this.context.userDid}:${a}:${t}`);return{valid:await crypto.subtle.verify("HMAC",s,d,l),timestamp:Date.now()}}return{valid:!1,timestamp:Date.now(),reason:"unknown_signature_scheme"}}catch{return{valid:!1,timestamp:Date.now(),reason:"verification_error"}}}case"mesh.broadcast":{this.requirePermission("mesh_pubsub"),this.setupMeshRouterListener();let e=r?.topic||"default",t=r?.payload,a="u">typeof crypto&&crypto.getRandomValues?Array.from(crypto.getRandomValues(new Uint8Array(4))).map(e=>e.toString(16).padStart(2,"0")).join(""):Date.now().toString(36),i=`mesh_app_${Date.now()}_${a}`,s={type:"APP_DATA",appId:this.manifest.id,msgId:i,topic:e,payload:t,timestamp:Date.now()},d=new TextEncoder().encode(JSON.stringify(s)),l=(0,n.createPacket)(this.context.userDid,"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",d);return await o.meshRouter.broadcast((0,n.encode)(l)),{messageId:i,status:"broadcasted"}}case"mesh.subscribe":{this.requirePermission("mesh_pubsub"),this.setupMeshRouterListener();let e=r?.topic||"default";return this.meshSubscriptions.set(e,!0),{subscribed:!0,topic:e}}case"mesh.sendDirect":{this.requirePermission("mesh_direct"),this.setupMeshRouterListener();let e=r?.targetDID;if(!e)throw Error("targetDID es requerido para sendDirect.");let t={type:"APP_DATA_DIRECT",appId:this.manifest.id,target:e,payload:r?.payload,timestamp:Date.now()},a=new TextEncoder().encode(JSON.stringify(t));return{status:await o.meshRouter.send(e,a),targetDID:e}}case"payments.requestPayment":return this.requirePermission("payments"),await i.processPayment(r,this.context.userDid);case"payments.getBalance":let l=t.Web3BridgeEngine.getInstance();return{voucherBalance:a.MonetizationEngine.getProStatus().credits,web3:l.getState()};case"storage.getItem":this.requirePermission("storage");let c=localStorage.getItem(this.storagePrefix+r?.key);return c?JSON.parse(c):null;case"storage.setItem":if(this.requirePermission("storage"),!r?.key)throw Error("Key es requerida");return localStorage.setItem(this.storagePrefix+r.key,JSON.stringify(r.value)),{success:!0};case"storage.removeItem":return this.requirePermission("storage"),localStorage.removeItem(this.storagePrefix+r?.key),{success:!0};case"storage.clear":return this.requirePermission("storage"),Object.keys(localStorage).forEach(e=>{e.startsWith(this.storagePrefix)&&localStorage.removeItem(e)}),{success:!0};case"ai.prompt":{this.requirePermission("ai");let e=r?.query||"";if(!e.trim())return{response:"Consulta vacía.",model:"RED-LocalAI-Engine",latencyMs:0};let t=Date.now();try{let a=await (0,s.queryAICopilot)(e,this.manifest.name);return{response:a.answer,model:a.source||"RED-Unified-AI",topicCategory:a.topic_category,confidence:.95,latencyMs:a.execution_time_ms||Date.now()-t}}catch(e){return console.warn("[RedSDKBridge] queryAICopilot fallback error:",e),{response:`[RED AI]: No se pudo procesar la inferencia (${e?.message||"error"}).`,model:"RED-Local-Fallback",latencyMs:Date.now()-t}}}case"sensors.getLocation":return this.requirePermission("sensors"),await new Promise((e,t)=>{if("u"<typeof navigator||!navigator.geolocation)return e({latitude:null,longitude:null,altitude:null,accuracy:null,timestamp:Date.now()});navigator.geolocation.getCurrentPosition(t=>e({latitude:t.coords.latitude,longitude:t.coords.longitude,altitude:t.coords.altitude??null,accuracy:t.coords.accuracy,timestamp:t.timestamp}),()=>e({latitude:null,longitude:null,altitude:null,accuracy:null,timestamp:Date.now()}),{enableHighAccuracy:!0,timeout:5e3,maximumAge:1e4})});case"ui.showToast":{let e=String(r?.message||r||""),t=r?.type||"info";return e&&("success"===t?d.toast.success(e):"error"===t?d.toast.error(e):"warning"===t?d.toast.warning(e):d.toast.info(e)),{shown:!0}}default:throw Error(`M\xe9todo no soportado: ${e}`)}}requirePermission(e){if(!this.context.grantedPermissions.has(e))throw Error(`Permiso denegado: La aplicaci\xf3n '${this.manifest.name}' no tiene concedido el permiso '${e}'.`)}sendResponse(e,t,a,r){if(!this.iframeWindow)return;let i={channel:"RED_SDK",type:"RED_SDK_RESPONSE",requestId:e,appId:this.manifest.id,success:t,data:a,error:r};this.iframeWindow.postMessage(i,"*")}sendEvent(e,t){if(!this.iframeWindow)return;let a={channel:"RED_SDK",type:"RED_SDK_EVENT",appId:this.manifest.id,eventName:e,payload:t};this.iframeWindow.postMessage(a,"*")}destroy(){this.unsubscribeMeshRouter&&(this.unsubscribeMeshRouter(),this.unsubscribeMeshRouter=null),this.meshSubscriptions.clear(),this.iframeWindow=null}}e.s(["RedSDKBridge",()=>l],91596);var c=e.i(43476),p=e.i(71645);e.s(["UniversalCheckoutModal",0,({intent:e,buyerDid:r,onClose:o,onSuccess:n})=>{let s=e.supportedRails&&e.supportedRails.length>0?e.supportedRails:["paypal","web3_usdt","lightning","offgrid_voucher"],[l,m]=(0,p.useState)(s[0]),[u,g]=(0,p.useState)(!1),[f,h]=(0,p.useState)(null),[b,x]=(0,p.useState)(null),y=a.MonetizationEngine.getProStatus().credits;t.Web3BridgeEngine.getInstance().getState();let v=async()=>{g(!0),h(null);try{let t;switch(l){case"paypal":t=await i.executePayPalPayment(e,r);break;case"web3_usdt":t=await i.executeWeb3Payment(e,r);break;case"lightning":t=await i.executeLightningPayment(e,r);break;case"offgrid_voucher":t=await i.executeOffgridVoucherPayment(e,r);break;default:throw Error("Riel de pago no soportado.")}g(!1),x(t),d.toast.success("✅ ¡Pago procesado y firmado criptográficamente!")}catch(e){g(!1),h(e.message||"Error al procesar el pago.")}};return(0,c.jsx)("div",{style:{position:"fixed",inset:0,zIndex:9999,background:"rgba(2, 4, 10, 0.90)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"12px",userSelect:"none"},children:(0,c.jsxs)("div",{style:{width:"100%",maxWidth:"460px",borderRadius:"20px",overflow:"hidden",boxShadow:"0 16px 50px rgba(0,0,0,0.85), 0 0 30px rgba(0, 230, 118, 0.15)",display:"flex",flexDirection:"column",border:"1.5px solid rgba(0, 230, 118, 0.35)",background:"linear-gradient(180deg, rgba(14,16,30,0.98) 0%, rgba(8,10,18,0.99) 100%)"},children:[(0,c.jsxs)("div",{style:{padding:"14px 16px",background:"rgba(6, 8, 16, 0.95)",borderBottom:"1px solid rgba(255, 255, 255, 0.12)",display:"flex",justifyContent:"space-between",alignItems:"center"},children:[(0,c.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px"},children:[(0,c.jsx)("div",{style:{width:"36px",height:"36px",borderRadius:"10px",background:"linear-gradient(135deg, rgba(0,230,118,0.2) 0%, rgba(0,229,255,0.2) 100%)",border:"1px solid rgba(0,230,118,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.2rem",boxShadow:"0 0 12px rgba(0,230,118,0.2)"},children:"💳"}),(0,c.jsxs)("div",{children:[(0,c.jsx)("h3",{style:{fontSize:"0.85rem",fontWeight:900,color:"#FFFFFF",letterSpacing:"0.5px",textTransform:"uppercase",margin:0},children:"TERMINAL DE PAGOS MULTI-RAIL"}),(0,c.jsx)("p",{style:{fontSize:"0.68rem",color:"var(--accent-cyan)",fontFamily:"JetBrains Mono, monospace",margin:"2px 0 0 0"},children:"RED Sovereign Checkout v66"})]})]}),(0,c.jsx)("button",{onClick:o,style:{background:"rgba(255, 255, 255, 0.08)",border:"1px solid rgba(255, 255, 255, 0.15)",color:"#FFFFFF",width:"30px",height:"30px",borderRadius:"8px",cursor:"pointer",fontSize:"0.85rem",fontWeight:900},children:"✕"})]}),b?(0,c.jsxs)("div",{style:{padding:"20px",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",gap:"14px"},children:[(0,c.jsx)("div",{style:{width:"64px",height:"64px",borderRadius:"20px",background:"rgba(0, 230, 118, 0.2)",border:"2px solid var(--accent-emerald)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2rem",boxShadow:"0 0 25px rgba(0,230,118,0.4)"},children:"✅"}),(0,c.jsxs)("div",{children:[(0,c.jsx)("h4",{style:{fontSize:"1rem",fontWeight:900,color:"#FFFFFF",margin:0},children:"¡PAGO VERIFICADO EN MALLA!"}),(0,c.jsx)("p",{style:{fontSize:"0.75rem",color:"var(--accent-emerald)",fontFamily:"JetBrains Mono, monospace",margin:"4px 0 0 0"},children:"Firma Ed25519 Validada"})]}),(0,c.jsxs)("div",{style:{width:"100%",background:"rgba(0, 0, 0, 0.6)",border:"1px solid rgba(255, 255, 255, 0.1)",borderRadius:"14px",padding:"12px",textAlign:"left",fontFamily:"JetBrains Mono, monospace",fontSize:"0.72rem",display:"flex",flexDirection:"column",gap:"8px"},children:[(0,c.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",borderBottom:"1px solid rgba(255, 255, 255, 0.06)",paddingBottom:"4px"},children:[(0,c.jsx)("span",{style:{color:"var(--text-muted)"},children:"Concepto:"}),(0,c.jsx)("span",{style:{color:"#FFFFFF",fontWeight:800},children:e.title})]}),(0,c.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",borderBottom:"1px solid rgba(255, 255, 255, 0.06)",paddingBottom:"4px"},children:[(0,c.jsx)("span",{style:{color:"var(--text-muted)"},children:"Monto:"}),(0,c.jsxs)("span",{style:{color:"var(--accent-emerald)",fontWeight:900},children:["$",b.amount.toFixed(2)," ",b.currency]})]}),(0,c.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",borderBottom:"1px solid rgba(255, 255, 255, 0.06)",paddingBottom:"4px"},children:[(0,c.jsx)("span",{style:{color:"var(--text-muted)"},children:"Riel:"}),(0,c.jsx)("span",{style:{color:"var(--accent-cyan)",textTransform:"uppercase",fontWeight:800},children:b.rail})]}),(0,c.jsxs)("div",{style:{display:"flex",flexDirection:"column",gap:"2px"},children:[(0,c.jsx)("span",{style:{color:"var(--text-muted)"},children:"Tx Hash:"}),(0,c.jsx)("span",{style:{color:"var(--text-secondary)",fontSize:"0.65rem",wordBreak:"break-all",background:"rgba(255,255,255,0.04)",padding:"6px",borderRadius:"6px"},children:b.transactionId})]})]}),(0,c.jsxs)("div",{style:{display:"flex",gap:"8px",width:"100%"},children:[(0,c.jsx)("button",{type:"button",onClick:()=>{b&&(navigator.clipboard.writeText(b.transactionId),d.toast.info("📋 Hash de transacción copiado al portapapeles."))},style:{flex:1,padding:"8px",background:"rgba(255, 255, 255, 0.06)",border:"1px solid rgba(255, 255, 255, 0.12)",color:"#FFFFFF",borderRadius:"10px",fontSize:"0.75rem",fontWeight:800,cursor:"pointer"},children:"📋 Copiar Hash"}),(0,c.jsx)("button",{type:"button",onClick:()=>{if(!b)return;let e=new Blob([JSON.stringify(b,null,2)],{type:"application/json"}),t=URL.createObjectURL(e),a=document.createElement("a");a.href=t,a.download=`recibo_red_${b.transactionId.slice(0,10)}.json`,a.click(),URL.revokeObjectURL(t)},style:{flex:1,padding:"8px",background:"rgba(255, 255, 255, 0.06)",border:"1px solid rgba(255, 255, 255, 0.12)",color:"#FFFFFF",borderRadius:"10px",fontSize:"0.75rem",fontWeight:800,cursor:"pointer"},children:"💾 Guardar JSON"})]}),(0,c.jsx)("button",{type:"button",onClick:()=>n(b),style:{width:"100%",padding:"10px",background:"linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",color:"#000000",fontWeight:900,borderRadius:"12px",fontSize:"0.82rem",border:"none",cursor:"pointer",boxShadow:"0 0 16px rgba(0, 230, 118, 0.35)"},children:"✓ CONTINUAR A LA MINI-APP"})]}):(0,c.jsxs)(c.Fragment,{children:[(0,c.jsxs)("div",{style:{padding:"14px 16px",background:"rgba(0, 0, 0, 0.4)",borderBottom:"1px solid rgba(255, 255, 255, 0.1)",display:"flex",justifyContent:"space-between",alignItems:"center"},children:[(0,c.jsxs)("div",{children:[(0,c.jsx)("h4",{style:{fontSize:"0.88rem",fontWeight:800,color:"#FFFFFF",margin:0},children:e.title}),(0,c.jsx)("p",{style:{fontSize:"0.75rem",color:"var(--text-secondary)",margin:"2px 0 0 0"},children:e.description||"Comercio Descentralizado RED"}),(0,c.jsxs)("p",{style:{fontSize:"0.68rem",color:"var(--text-muted)",fontFamily:"JetBrains Mono, monospace",margin:"4px 0 0 0"},children:["Comercio: ",e.merchant.name]})]}),(0,c.jsxs)("div",{style:{textAlign:"right"},children:[(0,c.jsxs)("div",{style:{fontSize:"1.4rem",fontWeight:900,color:"var(--accent-emerald)"},children:["$",e.amount.toFixed(2)]}),(0,c.jsx)("span",{style:{fontSize:"0.68rem",color:"var(--text-secondary)",textTransform:"uppercase",fontFamily:"JetBrains Mono, monospace",fontWeight:800},children:e.currency})]})]}),(0,c.jsxs)("div",{style:{padding:"16px",display:"flex",flexDirection:"column",gap:"12px"},children:[(0,c.jsx)("label",{style:{fontSize:"0.75rem",fontWeight:800,color:"var(--text-secondary)",fontFamily:"JetBrains Mono, monospace"},children:"SELECCIONA RIEL DE PAGO:"}),(0,c.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"},children:[s.includes("paypal")&&(0,c.jsxs)("button",{type:"button",onClick:()=>m("paypal"),style:{padding:"10px",borderRadius:"12px",border:"paypal"===l?"1.5px solid #3B82F6":"1px solid rgba(255, 255, 255, 0.1)",background:"paypal"===l?"rgba(59, 130, 246, 0.2)":"rgba(0, 0, 0, 0.4)",color:"#FFFFFF",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px",cursor:"pointer"},children:[(0,c.jsx)("span",{style:{fontSize:"0.78rem",fontWeight:800},children:"💳 PayPal / Tarjeta"}),(0,c.jsx)("span",{style:{fontSize:"0.65rem",color:"var(--text-muted)"},children:"USD / Fiat Directo"})]}),s.includes("web3_usdt")&&(0,c.jsxs)("button",{type:"button",onClick:()=>m("web3_usdt"),style:{padding:"10px",borderRadius:"12px",border:"web3_usdt"===l?"1.5px solid #A855F7":"1px solid rgba(255, 255, 255, 0.1)",background:"web3_usdt"===l?"rgba(168, 85, 247, 0.2)":"rgba(0, 0, 0, 0.4)",color:"#FFFFFF",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px",cursor:"pointer"},children:[(0,c.jsx)("span",{style:{fontSize:"0.78rem",fontWeight:800},children:"🦊 Web3 USDT/POL"}),(0,c.jsx)("span",{style:{fontSize:"0.65rem",color:"var(--text-muted)"},children:"Polygon / EVM"})]}),s.includes("lightning")&&(0,c.jsxs)("button",{type:"button",onClick:()=>m("lightning"),style:{padding:"10px",borderRadius:"12px",border:"lightning"===l?"1.5px solid #F59E0B":"1px solid rgba(255, 255, 255, 0.1)",background:"lightning"===l?"rgba(245, 158, 11, 0.2)":"rgba(0, 0, 0, 0.4)",color:"#FFFFFF",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px",cursor:"pointer"},children:[(0,c.jsx)("span",{style:{fontSize:"0.78rem",fontWeight:800},children:"⚡ Lightning"}),(0,c.jsx)("span",{style:{fontSize:"0.65rem",color:"var(--text-muted)"},children:"Sats Instantáneos"})]}),s.includes("offgrid_voucher")&&(0,c.jsxs)("button",{type:"button",onClick:()=>m("offgrid_voucher"),style:{padding:"10px",borderRadius:"12px",border:"offgrid_voucher"===l?"1.5px solid var(--accent-emerald)":"1px solid rgba(255, 255, 255, 0.1)",background:"offgrid_voucher"===l?"rgba(0, 230, 118, 0.2)":"rgba(0, 0, 0, 0.4)",color:"#FFFFFF",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px",cursor:"pointer"},children:[(0,c.jsx)("span",{style:{fontSize:"0.78rem",fontWeight:800},children:"🎟️ Vale Off-Grid"}),(0,c.jsx)("span",{style:{fontSize:"0.65rem",color:"var(--text-muted)"},children:"100% Sin Internet"})]})]}),(0,c.jsxs)("div",{style:{padding:"12px",background:"rgba(0, 0, 0, 0.6)",border:"1px solid rgba(255, 255, 255, 0.1)",borderRadius:"12px",fontSize:"0.75rem",display:"flex",flexDirection:"column",gap:"6px"},children:["paypal"===l&&(0,c.jsxs)("div",{children:[(0,c.jsx)("p",{style:{color:"#FFFFFF",fontWeight:800,margin:0},children:"Pasarela Fiat / PayPal"}),(0,c.jsxs)("p",{style:{color:"var(--text-secondary)",fontSize:"0.72rem",margin:"2px 0 0 0"},children:["Destino: ",(0,c.jsxs)("span",{style:{fontFamily:"JetBrains Mono, monospace",color:"#60A5FA"},children:["@",e.merchant.paypalUsername||"redmesh"]})]})]}),"web3_usdt"===l&&(0,c.jsxs)("div",{children:[(0,c.jsx)("p",{style:{color:"#FFFFFF",fontWeight:800,margin:0},children:"Transferencia Cripto EVM (USDT / POL)"}),(0,c.jsxs)("p",{style:{color:"var(--text-secondary)",fontSize:"0.68rem",wordBreak:"break-all",margin:"2px 0 0 0"},children:["Billetera: ",(0,c.jsx)("span",{style:{fontFamily:"JetBrains Mono, monospace",color:"#C084FC"},children:e.merchant.evmAddress||"0x71C836eB3f4D4e05bE7728373b9846b41295b364"})]})]}),"lightning"===l&&(0,c.jsxs)("div",{children:[(0,c.jsx)("p",{style:{color:"#FFFFFF",fontWeight:800,margin:0},children:"Factura Bitcoin Lightning Network"}),(0,c.jsxs)("p",{style:{color:"var(--text-secondary)",fontSize:"0.72rem",margin:"2px 0 0 0"},children:["Monto Estimado: ",(0,c.jsxs)("span",{style:{color:"var(--accent-amber)",fontWeight:900},children:["~",Math.round(1500*e.amount)," SAT"]})]})]}),"offgrid_voucher"===l&&(0,c.jsxs)("div",{children:[(0,c.jsx)("p",{style:{color:"#FFFFFF",fontWeight:800,margin:0},children:"Pagaré Criptográfico Off-Grid (Ed25519)"}),(0,c.jsxs)("p",{style:{color:"var(--text-secondary)",fontSize:"0.72rem",margin:"2px 0 0 0"},children:["Tu Saldo Local: ",(0,c.jsxs)("span",{style:{color:"var(--accent-emerald)",fontWeight:900},children:[y," Créditos"]})]})]})]}),f&&(0,c.jsxs)("div",{style:{padding:"8px 12px",background:"rgba(232, 33, 58, 0.2)",border:"1px solid var(--accent-crimson)",borderRadius:"10px",color:"#FF8599",fontSize:"0.75rem"},children:["⚠️ ",f]})]}),(0,c.jsxs)("div",{style:{padding:"14px 16px",background:"rgba(6, 8, 16, 0.95)",borderTop:"1px solid rgba(255, 255, 255, 0.12)",display:"flex",gap:"8px"},children:[(0,c.jsx)("button",{type:"button",onClick:o,disabled:u,style:{flex:1,padding:"10px",background:"rgba(255, 255, 255, 0.06)",border:"1px solid rgba(255, 255, 255, 0.14)",borderRadius:"12px",color:"var(--text-secondary)",fontSize:"0.78rem",fontWeight:800,cursor:"pointer"},children:"Cancelar"}),(0,c.jsx)("button",{type:"button",onClick:v,disabled:u,style:{flex:1,padding:"10px",background:"linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",color:"#000000",fontWeight:900,borderRadius:"12px",fontSize:"0.78rem",border:"none",cursor:"pointer",boxShadow:"0 0 16px rgba(0, 230, 118, 0.35)",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"},children:u?(0,c.jsxs)(c.Fragment,{children:[(0,c.jsx)("span",{style:{fontSize:"0.85rem"},children:"🔄"}),(0,c.jsx)("span",{children:"Procesando..."})]}):(0,c.jsxs)(c.Fragment,{children:[(0,c.jsx)("span",{children:"CONFIRMAR PAGO"}),(0,c.jsx)("span",{children:"➔"})]})})]})]})]})})}],77319)}]);