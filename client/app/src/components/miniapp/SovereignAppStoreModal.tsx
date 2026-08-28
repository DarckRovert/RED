"use client";

import React, { useState, useEffect } from 'react';
import { RedAppManifest, RedAppBundle, RedPermissionScope } from '../../lib/miniapp/RedSDKTypes';
import { redAppRegistry, InstalledAppEntry } from '../../lib/miniapp/RedAppRegistry';
import { RedAppBundleEngine } from '../../lib/miniapp/RedAppBundleEngine';
import { meshRouter } from '../../lib/mesh/meshRouter';
import { encode, createPacket } from '../../lib/mesh/meshProtocol';

interface SovereignAppStoreModalProps {
    userDid: string;
    onClose: () => void;
    onLaunchApp: (bundle: RedAppBundle) => void;
}

export const SovereignAppStoreModal: React.FC<SovereignAppStoreModalProps> = ({
    userDid,
    onClose,
    onLaunchApp,
}) => {
    const [appsList, setAppsList] = useState<InstalledAppEntry[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isPublishingOpen, setIsPublishingOpen] = useState<boolean>(false);

    // Creator State
    const [createName, setCreateName] = useState('');
    const [createId, setCreateId] = useState('');
    const [createDesc, setCreateDesc] = useState('');
    const [createCategory, setCreateCategory] = useState<'market' | 'utility' | 'emergency' | 'games'>('utility');
    const [createIcon, setCreateIcon] = useState('⚡');
    const [createHtml, setCreateHtml] = useState(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { background: #0b0f19; color: #fff; font-family: sans-serif; padding: 20px; text-align: center; }
    button { background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>¡Mi Primera Mini-App RED!</h1>
  <p id="user-info">Cargando identidad...</p>
  <button onclick="testMesh()">📡 Enviar Saludo por Malla</button>

  <script>
    window.addEventListener('DOMContentLoaded', async () => {
      try {
        const user = await window.RedSDK.identity.getProfile();
        document.getElementById('user-info').textContent = 'Conectado como: ' + user.nickname + ' (' + user.did.slice(0, 12) + '...)';
      } catch (e) {
        document.getElementById('user-info').textContent = 'Modo local';
      }
    });

    async function testMesh() {
      await window.RedSDK.mesh.broadcast('saludos', { msg: '¡Hola desde mi Mini-App!' });
      window.RedSDK.ui.showToast('¡Mensaje transmitido por radio!', 'success');
    }
  </script>
</body>
</html>`);

    const reloadList = () => {
        setAppsList(redAppRegistry.getAllApps());
    };

    useEffect(() => {
        reloadList();
    }, []);

    const handleCreateApp = (e: React.FormEvent) => {
        e.preventDefault();
        if (!createName || !createId) return;

        const manifest: RedAppManifest = {
            id: createId.trim().toLowerCase(),
            name: createName.trim(),
            version: '1.0.0',
            description: createDesc.trim(),
            author: {
                name: 'Operador Local',
                did: userDid,
            },
            icon: createIcon,
            category: createCategory,
            permissions: ['identity', 'mesh_pubsub', 'storage'],
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

        setIsPublishingOpen(false);
        reloadList();
        onLaunchApp(bundle);
    };

    const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const bundle = RedAppBundleEngine.importBundle(text);
                redAppRegistry.installApp(bundle);
                reloadList();
                alert(`¡Mini-App '${bundle.manifest.name}' instalada exitosamente!`);
            } catch (err: any) {
                alert(`Error al importar: ${err.message}`);
            }
        };
        reader.readAsText(file);
    };

    const filteredApps = appsList.filter(entry => {
        const matchesCategory = selectedCategory === 'all' || entry.manifest.category === selectedCategory;
        const matchesSearch = entry.manifest.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              entry.manifest.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in p-3 sm:p-6">
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl w-full max-w-4xl h-[90vh] max-h-[850px] shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🏬</span>
                        <div>
                            <h2 className="text-base font-extrabold text-white tracking-wide">Sovereign P2P App Store</h2>
                            <p className="text-xs text-slate-400">Ecosistema de Mini-Apps Descentralizadas & Off-Grid</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5">
                            <span>📥 Importar .redapp</span>
                            <input type="file" accept=".json,.redapp" onChange={handleImportJson} className="hidden" />
                        </label>
                        <button
                            type="button"
                            onClick={() => setIsPublishingOpen(true)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                        >
                            <span>➕ Crear Mini-App</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition text-sm ml-1"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Categories & Search */}
                <div className="p-3 bg-slate-900/50 border-b border-slate-800/80 flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        {[
                            { id: 'all', label: 'Todas' },
                            { id: 'market', label: '🛒 Mercado' },
                            { id: 'utility', label: '🔧 Utilidades' },
                            { id: 'emergency', label: '🩹 Emergencia' },
                            { id: 'games', label: '🎮 Juegos' },
                        ].map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                                    selectedCategory === cat.id
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                    <div className="w-full sm:w-64">
                        <input
                            type="text"
                            placeholder="Buscar Mini-Apps en la malla..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* Apps Grid */}
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredApps.map(entry => (
                        <div
                            key={entry.manifest.id}
                            className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between transition group shadow-lg"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow-inner">
                                            {entry.manifest.icon || '📱'}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition">
                                                {entry.manifest.name}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                                <span className="font-mono">v{entry.manifest.version}</span>
                                                <span>•</span>
                                                <span className="uppercase font-semibold text-blue-400">{entry.manifest.category}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {entry.isBuiltin && (
                                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 rounded-md font-bold uppercase tracking-wider">
                                            Oficial
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-slate-300 line-clamp-2 mb-3 leading-relaxed">
                                    {entry.manifest.description}
                                </p>

                                {/* Permissions Badges */}
                                <div className="flex flex-wrap gap-1 mb-4">
                                    {entry.manifest.permissions.map(p => (
                                        <span key={p} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono">
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 mt-auto">
                                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">
                                    {entry.manifest.author.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onLaunchApp(entry.bundle)}
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
                                >
                                    <span>Abrir</span>
                                    <span>➔</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Creator Modal Overlay */}
                {isPublishingOpen && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-base font-bold text-white">🛠️ Creador & Publicador de Mini-Apps RED</h3>
                                <button onClick={() => setIsPublishingOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                            </div>

                            <form onSubmit={handleCreateApp} className="space-y-4 text-xs">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-slate-300 font-semibold mb-1">Nombre de la App</label>
                                        <input
                                            type="text"
                                            required
                                            value={createName}
                                            onChange={e => setCreateName(e.target.value)}
                                            placeholder="Mi Calculadora Solar"
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 font-semibold mb-1">App ID Único (Reverse DNS)</label>
                                        <input
                                            type="text"
                                            required
                                            value={createId}
                                            onChange={e => setCreateId(e.target.value)}
                                            placeholder="com.usuario.solar"
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-slate-300 font-semibold mb-1">Categoría</label>
                                        <select
                                            value={createCategory}
                                            onChange={(e: any) => setCreateCategory(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                        >
                                            <option value="utility">Utilidad</option>
                                            <option value="market">Mercado</option>
                                            <option value="emergency">Emergencia</option>
                                            <option value="games">Juegos</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 font-semibold mb-1">Emoji Icono</label>
                                        <input
                                            type="text"
                                            value={createIcon}
                                            onChange={e => setCreateIcon(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-slate-300 font-semibold mb-1">Descripción</label>
                                    <input
                                        type="text"
                                        value={createDesc}
                                        onChange={e => setCreateDesc(e.target.value)}
                                        placeholder="Descripción breve de la utilidad de tu aplicación..."
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-300 font-semibold mb-1">Código Fuente HTML / JS / CSS (`index.html`)</label>
                                    <textarea
                                        rows={10}
                                        value={createHtml}
                                        onChange={e => setCreateHtml(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 font-mono text-[11px]"
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsPublishingOpen(false)}
                                        className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg"
                                    >
                                        🚀 Instalar & Emitir a la Malla
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
