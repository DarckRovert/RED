"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RedAppManifest, RedAppBundle, RedPermissionScope, RedAppCategory } from '../../lib/miniapp/RedSDKTypes';
import { redAppRegistry, InstalledAppEntry } from '../../lib/miniapp/RedAppRegistry';
import { RedAppBundleEngine } from '../../lib/miniapp/RedAppBundleEngine';
import { meshRouter } from '../../lib/mesh/meshRouter';
import { encode, createPacket } from '../../lib/mesh/meshProtocol';
import { toast } from '../Toast';

interface SovereignAppStoreModalProps {
    userDid: string;
    onClose: () => void;
    onLaunchApp: (bundle: RedAppBundle) => void;
}

type StoreTab = 'catalog' | 'creator' | 'import' | 'mesh';

const TEMPLATES: Record<string, { name: string; id: string; cat: RedAppCategory; icon: string; desc: string; permissions: RedPermissionScope[]; html: string }> = {
    bazaar: {
        name: "Mi Tienda Trueque P2P",
        id: "org.redmesh.custombazaar",
        cat: "market",
        icon: "🛒",
        desc: "Tienda de suministros tácticos y trueque descentralizado con pasarela Multi-Rail integrada.",
        permissions: ['identity', 'payments', 'mesh_pubsub', 'storage'],
        html: `<!DOCTYPE html>
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
    <h1>🛒 Tienda Táctica P2P</h1>
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
      <div class="card-title">Batería Solar 20Ah</div>
      <div class="card-price">$45.00</div>
      <button onclick="buy('Batería Solar 20Ah', 45.00)">Comprar Multi-Rail</button>
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
          description: 'Suministro táctico adquirido vía Mini-App Sovereign',
          amount: price,
          currency: 'USD',
          merchant: { name: 'Comercio Malla RED', did: 'did:red:merchant_hq' },
          supportedRails: ['paypal', 'web3_usdt', 'lightning', 'offgrid_voucher']
        });
        window.RedSDK.ui.showToast('¡Pago exitoso! Tx: ' + receipt.transactionId.slice(0, 12), 'success');
      } catch(e) {
        window.RedSDK.ui.showToast('Pago no completado: ' + e.message, 'error');
      }
    }
  </script>
</body>
</html>`
    },
    game: {
        name: "Batalla Naval Malla P2P",
        id: "org.redmesh.customgame",
        cat: "games",
        icon: "🚢",
        desc: "Juego multijugador descentralizado sobre canales PubSub de radio.",
        permissions: ['identity', 'mesh_pubsub', 'storage'],
        html: `<!DOCTYPE html>
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
  <h1>🚢 Radar Táctico de Batalla</h1>
  <div class="log" id="status">Dispara a las coordenadas de la cuadrícula</div>
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
        status.textContent = '¡IMPACTO DIRECTO en sector [' + idx + ']!';
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
</html>`
    },
    notes: {
        name: "Bloc Criptográfico Táctico",
        id: "org.redmesh.customnotes",
        cat: "utility",
        icon: "🔒",
        desc: "Cuaderno de notas cifradas y firmadas digitalmente con tu clave de identidad Ed25519.",
        permissions: ['identity', 'storage', 'clipboard'],
        html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bloc Criptográfico</title>
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
  <h1>🔒 Bloc Criptográfico Seguro</h1>
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
</html>`
    }
};

export const SovereignAppStoreModal: React.FC<SovereignAppStoreModalProps> = ({
    userDid,
    onClose,
    onLaunchApp,
}) => {
    const [activeTab, setActiveTab] = useState<StoreTab>('catalog');
    const [appsList, setAppsList] = useState<InstalledAppEntry[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Creator State
    const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('bazaar');
    const [createName, setCreateName] = useState(TEMPLATES.bazaar.name);
    const [createId, setCreateId] = useState(TEMPLATES.bazaar.id);
    const [createDesc, setCreateDesc] = useState(TEMPLATES.bazaar.desc);
    const [createCategory, setCreateCategory] = useState<RedAppCategory>(TEMPLATES.bazaar.cat);
    const [createIcon, setCreateIcon] = useState(TEMPLATES.bazaar.icon);
    const [createPermissions, setCreatePermissions] = useState<RedPermissionScope[]>(TEMPLATES.bazaar.permissions);
    const [createHtml, setCreateHtml] = useState(TEMPLATES.bazaar.html);

    // Live Preview State
    const [previewBlobUrl, setPreviewBlobUrl] = useState<string>('');

    const reloadList = () => {
        setAppsList(redAppRegistry.getAllApps());
    };

    useEffect(() => {
        reloadList();
    }, []);

    // Live preview update
    useEffect(() => {
        if (activeTab === 'creator') {
            const bundle: RedAppBundle = {
                manifest: {
                    id: createId || 'preview.app',
                    name: createName || 'Vista Previa',
                    version: '1.0.0',
                    description: createDesc || '',
                    author: { name: 'Operador Local', did: userDid },
                    icon: createIcon || '⚡',
                    category: createCategory,
                    permissions: createPermissions,
                    entryPoint: 'index.html',
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                },
                files: {
                    'index.html': createHtml
                }
            };
            const url = RedAppBundleEngine.createBlobUrl(bundle);
            setPreviewBlobUrl(url);
            return () => {
                if (url) URL.revokeObjectURL(url);
            };
        }
    }, [activeTab, createHtml, createId, createName, createCategory, createPermissions, createIcon, userDid]);

    const handleSelectTemplate = (key: string) => {
        const tpl = TEMPLATES[key];
        if (!tpl) return;
        setSelectedTemplateKey(key);
        setCreateName(tpl.name);
        setCreateId(tpl.id);
        setCreateDesc(tpl.desc);
        setCreateCategory(tpl.cat);
        setCreateIcon(tpl.icon);
        setCreatePermissions(tpl.permissions);
        setCreateHtml(tpl.html);
    };

    const togglePermission = (scope: RedPermissionScope) => {
        if (createPermissions.includes(scope)) {
            setCreatePermissions(createPermissions.filter(p => p !== scope));
        } else {
            setCreatePermissions([...createPermissions, scope]);
        }
    };

    const handleCreateApp = (e: React.FormEvent) => {
        e.preventDefault();
        if (!createName.trim() || !createId.trim()) {
            toast.error("El nombre y el App ID son obligatorios.");
            return;
        }

        const manifest: RedAppManifest = {
            id: createId.trim().toLowerCase(),
            name: createName.trim(),
            version: '1.0.0',
            description: createDesc.trim(),
            author: {
                name: 'Operador Soberano',
                did: userDid,
            },
            icon: createIcon.trim() || '📱',
            category: createCategory,
            permissions: createPermissions,
            entryPoint: 'index.html',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const bundle: RedAppBundle = {
            manifest,
            files: {
                'index.html': createHtml,
            }
        };

        // Install locally
        redAppRegistry.installApp(bundle);

        // Broadcast bundle manifest to the P2P mesh
        try {
            const manifestEnvelope = { type: 'MINIAPP_MANIFEST', appId: manifest.id, manifest, timestamp: Date.now() };
            const manifestBytes = new TextEncoder().encode(JSON.stringify(manifestEnvelope));
            void meshRouter.broadcast(encode(createPacket(userDid, 'broadcast', manifestBytes)));
        } catch {}

        toast.success(`🚀 Mini-App '${manifest.name}' instalada y transmitida a la malla.`);
        reloadList();
        setActiveTab('catalog');
        onLaunchApp(bundle);
    };

    const handleExportApp = (bundle: RedAppBundle) => {
        const pkg = redAppRegistry.exportAppPackage(bundle.manifest.id);
        const content = pkg || JSON.stringify(bundle, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${bundle.manifest.id}.redapp`;
        a.click();
        URL.revokeObjectURL(url);
        toast.info(`📦 Paquete firmado ${bundle.manifest.name} exportado.`);
    };

    const handleBroadcastApp = (bundle: RedAppBundle) => {
        try {
            const pkg = redAppRegistry.exportAppPackage(bundle.manifest.id);
            const manifestEnvelope = { 
                type: 'MINIAPP_PACKAGE_BROADCAST', 
                appId: bundle.manifest.id, 
                manifest: bundle.manifest, 
                pkg,
                authorDid: userDid,
                timestamp: Date.now() 
            };
            const manifestBytes = new TextEncoder().encode(JSON.stringify(manifestEnvelope));
            void meshRouter.broadcast(encode(createPacket(userDid, 'broadcast', manifestBytes)));
            toast.success(`📡 Mini-App '${bundle.manifest.name}' transmitida por radio/mesh.`);
        } catch (e: any) {
            toast.error(`Error al transmitir: ${e.message}`);
        }
    };

    const handleDeleteApp = (appId: string) => {
        const success = redAppRegistry.uninstallApp(appId);
        if (success) {
            toast.info("Mini-App desinstalada.");
            reloadList();
        } else {
            toast.error("No se pueden desinstalar aplicaciones nativas del sistema.");
        }
    };

    const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                if (!text) return;

                // Try signed .redapp package import first
                if (text.startsWith('RED_APP_V1:') || text.includes('"format":"RED_APP_PACKAGE_V1"')) {
                    const res = redAppRegistry.importAppPackage(text);
                    if (res.isValid && res.bundle) {
                        redAppRegistry.installApp(res.bundle);
                        reloadList();
                        toast.success(`¡Mini-App '${res.bundle.manifest.name}' instalada exitosamente!`);
                        setActiveTab('catalog');
                        return;
                    }
                }

                // Fallback to legacy raw JSON bundle engine
                const bundle = RedAppBundleEngine.importBundle(text);
                redAppRegistry.installApp(bundle);
                reloadList();
                toast.success(`¡Mini-App '${bundle.manifest.name}' instalada exitosamente!`);
                setActiveTab('catalog');
            } catch (err: any) {
                toast.error(`Error al importar: ${err.message}`);
            }
        };
        reader.readAsText(file);
    };

    const filteredApps = useMemo(() => {
        return appsList.filter(entry => {
            const matchesCategory = selectedCategory === 'all' || entry.manifest.category === selectedCategory;
            const matchesSearch = entry.manifest.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  entry.manifest.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  entry.manifest.id.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [appsList, selectedCategory, searchQuery]);

    return (
        <div 
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(2, 4, 10, 0.90)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px",
                userSelect: "none"
            }}
        >
            <div 
                style={{
                    width: "100%",
                    maxWidth: "1024px",
                    height: "92vh",
                    maxHeight: "880px",
                    borderRadius: "20px",
                    boxShadow: "0 16px 50px rgba(0,0,0,0.85), 0 0 30px rgba(0, 230, 118, 0.15)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    border: "1.5px solid rgba(0, 230, 118, 0.35)",
                    background: "linear-gradient(180deg, rgba(14,18,34,0.98) 0%, rgba(6,8,16,0.99) 100%)"
                }}
            >
                {/* ── HEADER TÁCTICO DE ALTO IMPACTO ── */}
                <div style={{ padding: "12px 16px", background: "rgba(6, 8, 16, 0.95)", borderBottom: "1px solid rgba(255, 255, 255, 0.12)", display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg, rgba(0,230,118,0.2) 0%, rgba(0,229,255,0.2) 100%)", border: "1px solid rgba(0,230,118,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", boxShadow: "0 0 15px rgba(0,230,118,0.2)" }}>
                            🏬
                        </div>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <h2 style={{ fontSize: "1rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.5px", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                                    SOVEREIGN APP STORE
                                    <span style={{ fontSize: "0.65rem", padding: "2px 6px", background: "rgba(0, 230, 118, 0.15)", border: "1px solid rgba(0, 230, 118, 0.5)", color: "var(--accent-emerald)", borderRadius: "4px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                                        v66.0.0
                                    </span>
                                </h2>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", marginTop: "2px" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-emerald)", display: "inline-block" }}></span>
                                <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userDid}</span>
                                <span>•</span>
                                <span style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>{appsList.length} dApps</span>
                            </div>
                        </div>
                    </div>

                    {/* Header Action Buttons */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <label style={{ padding: "6px 12px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.15)", color: "#FFFFFF", borderRadius: "10px", fontSize: "0.78rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>📥 Importar</span>
                            <input type="file" accept=".json,.redapp" onChange={handleImportJson} style={{ display: "none" }} />
                        </label>
                        <button
                            type="button"
                            onClick={() => setActiveTab(activeTab === 'creator' ? 'catalog' : 'creator')}
                            style={{
                                padding: "6px 14px",
                                borderRadius: "10px",
                                fontSize: "0.78rem",
                                fontWeight: 900,
                                cursor: "pointer",
                                border: "none",
                                background: activeTab === 'creator' ? "var(--accent-emerald)" : "linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",
                                color: "#000000",
                                boxShadow: "0 0 12px rgba(0, 230, 118, 0.3)"
                            }}
                        >
                            <span>{activeTab === 'creator' ? '📦 Ver Catálogo' : '➕ Crear Mini-App'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                background: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                color: "#FFFFFF",
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "0.9rem",
                                fontWeight: 900
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* ── BARRA DE PESTAÑAS & NAVEGACIÓN TÁCTICA ── */}
                <div style={{ padding: "8px 16px", background: "rgba(6, 8, 16, 0.6)", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: "6px", overflowX: "auto" }}>
                        {[
                            { id: 'catalog', label: '📦 Catálogo Soberano', count: appsList.length },
                            { id: 'creator', label: '🛠️ Creador & Live Preview', count: null },
                        ].map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setActiveTab(t.id as StoreTab)}
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    fontSize: "0.78rem",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    border: activeTab === t.id ? "1px solid var(--accent-emerald)" : "1px solid transparent",
                                    background: activeTab === t.id ? "rgba(0, 230, 118, 0.15)" : "transparent",
                                    color: activeTab === t.id ? "var(--accent-emerald)" : "var(--text-secondary)"
                                }}
                            >
                                <span>{t.label}</span>
                                {t.count !== null && (
                                    <span style={{ fontSize: "0.68rem", padding: "1px 6px", background: "rgba(255,255,255,0.1)", borderRadius: "10px", marginLeft: "6px", fontFamily: "JetBrains Mono, monospace" }}>
                                        {t.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'catalog' && (
                        <div style={{ width: "240px" }}>
                            <input
                                type="text"
                                placeholder="🔍 Buscar Mini-Apps..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="tactical-input"
                                style={{ width: "100%", padding: "6px 10px", fontSize: "0.78rem" }}
                            />
                        </div>
                    )}
                </div>

                {/* ── VISTA 1: CATÁLOGO DE MINI-APPS ── */}
                {activeTab === 'catalog' && (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        {/* Categorías Filter */}
                        <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", gap: "6px", overflowX: "auto" }}>
                            {[
                                { id: 'all', label: 'Todas las Apps' },
                                { id: 'market', label: '🛒 Mercado P2P' },
                                { id: 'utility', label: '🔧 Utilidades' },
                                { id: 'emergency', label: '🩹 Emergencia' },
                                { id: 'games', label: '🎮 Juegos' },
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id)}
                                    style={{
                                        padding: "4px 10px",
                                        borderRadius: "8px",
                                        fontSize: "0.75rem",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        border: selectedCategory === cat.id ? "1px solid var(--accent-cyan)" : "1px solid rgba(255, 255, 255, 0.08)",
                                        background: selectedCategory === cat.id ? "rgba(0, 229, 255, 0.15)" : "rgba(255, 255, 255, 0.03)",
                                        color: selectedCategory === cat.id ? "var(--accent-cyan)" : "var(--text-secondary)",
                                        whiteSpace: "nowrap"
                                    }}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>

                        {/* Grid de Aplicaciones */}
                        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
                            {filteredApps.map(entry => (
                                <div
                                    key={entry.manifest.id}
                                    style={{
                                        background: "linear-gradient(180deg, rgba(16, 22, 44, 0.8) 0%, rgba(8, 12, 26, 0.9) 100%)",
                                        border: "1px solid rgba(255, 255, 255, 0.12)",
                                        borderRadius: "16px",
                                        padding: "14px",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between",
                                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)"
                                    }}
                                >
                                    <div>
                                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(0, 0, 0, 0.6)", border: "1px solid rgba(255, 255, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
                                                    {entry.manifest.icon || '📱'}
                                                </div>
                                                <div>
                                                    <h3 style={{ fontSize: "0.88rem", fontWeight: 900, color: "#FFFFFF", margin: 0 }}>
                                                        {entry.manifest.name}
                                                    </h3>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", marginTop: "2px" }}>
                                                        <span>v{entry.manifest.version}</span>
                                                        <span>•</span>
                                                        <span style={{ textTransform: "uppercase", color: "var(--accent-emerald)", fontWeight: 800 }}>{entry.manifest.category}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {entry.isBuiltin ? (
                                                <span style={{ fontSize: "0.62rem", padding: "2px 6px", background: "rgba(0, 230, 118, 0.15)", border: "1px solid rgba(0, 230, 118, 0.5)", color: "var(--accent-emerald)", borderRadius: "6px", fontWeight: 900, textTransform: "uppercase" }}>
                                                    Oficial
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: "0.62rem", padding: "2px 6px", background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.5)", color: "var(--accent-cyan)", borderRadius: "6px", fontWeight: 900, textTransform: "uppercase" }}>
                                                    Soberana
                                                </span>
                                            )}
                                        </div>

                                        <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                                            {entry.manifest.description}
                                        </p>

                                        {/* Permissions Badges */}
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
                                            {entry.manifest.permissions.map(p => (
                                                <span key={p} style={{ fontSize: "0.64rem", padding: "2px 6px", background: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(255, 255, 255, 0.08)", color: "var(--text-secondary)", borderRadius: "4px", fontFamily: "JetBrains Mono, monospace" }}>
                                                    🔒 {p}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Footbar */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", marginTop: "auto" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <button
                                                type="button"
                                                onClick={() => handleBroadcastApp(entry.bundle)}
                                                style={{ padding: "6px 8px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#FFFFFF", borderRadius: "8px", fontSize: "0.75rem", cursor: "pointer" }}
                                                title="Transmitir paquete por radio/malla"
                                            >
                                                📡
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleExportApp(entry.bundle)}
                                                style={{ padding: "6px 8px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#FFFFFF", borderRadius: "8px", fontSize: "0.75rem", cursor: "pointer" }}
                                                title="Exportar archivo .redapp"
                                            >
                                                💾
                                            </button>
                                            {!entry.isBuiltin && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteApp(entry.manifest.id)}
                                                    style={{ padding: "6px 8px", background: "rgba(232, 33, 58, 0.15)", border: "1px solid rgba(232, 33, 58, 0.4)", color: "var(--accent-crimson)", borderRadius: "8px", fontSize: "0.75rem", cursor: "pointer" }}
                                                    title="Eliminar Mini-App local"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => onLaunchApp(entry.bundle)}
                                            style={{
                                                padding: "6px 14px",
                                                background: "linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",
                                                color: "#000000",
                                                fontWeight: 900,
                                                borderRadius: "10px",
                                                fontSize: "0.78rem",
                                                border: "none",
                                                cursor: "pointer",
                                                boxShadow: "0 0 10px rgba(0, 230, 118, 0.3)",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px"
                                            }}
                                        >
                                            <span>EJECUTAR</span>
                                            <span>➔</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── VISTA 2: CREADOR & LIVE PREVIEW INTEGRADO ── */}
                {activeTab === 'creator' && (
                    <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden" }}>
                        {/* Editor Pane (Left) */}
                        <div style={{ flex: 1, padding: "16px", overflowY: "auto", borderRight: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.78rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 style={{ fontSize: "0.88rem", fontWeight: 900, color: "#FFFFFF", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>🛠️ Creador & Editor de dApps</span>
                                </h3>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ color: "var(--text-muted)" }}>Plantilla:</span>
                                    <select
                                        value={selectedTemplateKey}
                                        onChange={(e) => handleSelectTemplate(e.target.value)}
                                        style={{ padding: "4px 8px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(0, 230, 118, 0.4)", color: "var(--accent-emerald)", borderRadius: "8px", fontWeight: 800, fontFamily: "JetBrains Mono, monospace", outline: "none" }}
                                    >
                                        <option value="bazaar">🛒 Tienda / Trueque P2P</option>
                                        <option value="game">🎮 Batalla Naval Malla</option>
                                        <option value="notes">🔒 Bloc Criptográfico</option>
                                    </select>
                                </div>
                            </div>

                            <form onSubmit={handleCreateApp} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    <div>
                                        <label style={{ display: "block", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "4px" }}>Nombre de la Aplicación</label>
                                        <input
                                            type="text"
                                            required
                                            value={createName}
                                            onChange={e => setCreateName(e.target.value)}
                                            placeholder="Mi Calculadora Solar"
                                            className="tactical-input"
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "4px" }}>App ID Único (Reverse DNS)</label>
                                        <input
                                            type="text"
                                            required
                                            value={createId}
                                            onChange={e => setCreateId(e.target.value)}
                                            placeholder="com.usuario.solar"
                                            className="tactical-input"
                                            style={{ width: "100%", fontFamily: "JetBrains Mono, monospace" }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    <div>
                                        <label style={{ display: "block", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "4px" }}>Categoría</label>
                                        <select
                                            value={createCategory}
                                            onChange={(e: any) => setCreateCategory(e.target.value)}
                                            className="tactical-input"
                                            style={{ width: "100%" }}
                                        >
                                            <option value="utility">Utilidad</option>
                                            <option value="market">Mercado</option>
                                            <option value="emergency">Emergencia</option>
                                            <option value="games">Juegos</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: "block", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "4px" }}>Emoji / Icono</label>
                                        <input
                                            type="text"
                                            value={createIcon}
                                            onChange={e => setCreateIcon(e.target.value)}
                                            className="tactical-input"
                                            style={{ width: "100%", textAlign: "center", fontSize: "1.2rem" }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: "block", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "4px" }}>Descripción</label>
                                    <input
                                        type="text"
                                        value={createDesc}
                                        onChange={e => setCreateDesc(e.target.value)}
                                        placeholder="Descripción breve de la utilidad..."
                                        className="tactical-input"
                                        style={{ width: "100%" }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: "block", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "4px" }}>Permisos Solicitados</label>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                        {(['identity', 'mesh_pubsub', 'payments', 'storage', 'ai', 'sensors'] as RedPermissionScope[]).map(scope => {
                                            const active = createPermissions.includes(scope);
                                            return (
                                                <button
                                                    key={scope}
                                                    type="button"
                                                    onClick={() => togglePermission(scope)}
                                                    style={{
                                                        padding: "4px 8px",
                                                        borderRadius: "6px",
                                                        fontSize: "0.68rem",
                                                        fontFamily: "JetBrains Mono, monospace",
                                                        fontWeight: 800,
                                                        cursor: "pointer",
                                                        border: active ? "1px solid var(--accent-emerald)" : "1px solid rgba(255,255,255,0.1)",
                                                        background: active ? "rgba(0, 230, 118, 0.2)" : "rgba(0,0,0,0.4)",
                                                        color: active ? "var(--accent-emerald)" : "var(--text-muted)"
                                                    }}
                                                >
                                                    {active ? '✓ ' : '+ '} {scope}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: "block", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "4px" }}>Código Fuente Sandboxed (`index.html`)</label>
                                    <textarea
                                        rows={10}
                                        value={createHtml}
                                        onChange={e => setCreateHtml(e.target.value)}
                                        className="tactical-input"
                                        style={{ width: "100%", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", lineHeight: 1.4 }}
                                        spellCheck={false}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    style={{
                                        width: "100%",
                                        padding: "10px",
                                        background: "linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",
                                        color: "#000000",
                                        fontWeight: 900,
                                        borderRadius: "12px",
                                        fontSize: "0.82rem",
                                        border: "none",
                                        cursor: "pointer",
                                        boxShadow: "0 0 16px rgba(0, 230, 118, 0.35)"
                                    }}
                                >
                                    🚀 INSTALAR & EMITIR PAQUETE A LA MALLA
                                </button>
                            </form>
                        </div>

                        {/* Live Preview Pane (Right) */}
                        <div style={{ flex: 1, background: "rgba(0, 0, 0, 0.8)", padding: "16px", display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "8px", marginBottom: "8px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-emerald)" }}></span>
                                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#FFFFFF" }}>VISTA PREVIA EN VIVO (SANDBOX)</span>
                                </div>
                                <span style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>window.RedSDK Activo</span>
                            </div>
                            <div style={{ flex: 1, background: "#020306", borderRadius: "14px", overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.12)", position: "relative" }}>
                                {previewBlobUrl ? (
                                    <iframe
                                        src={previewBlobUrl}
                                        title="Live Preview"
                                        sandbox="allow-scripts allow-forms"
                                        style={{ width: "100%", height: "100%", border: "none", background: "#020306" }}
                                    />
                                ) : (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                        Generando sandbox...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
