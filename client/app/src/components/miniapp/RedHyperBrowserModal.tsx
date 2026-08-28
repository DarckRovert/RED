"use client";

import React, { useState, useEffect, useRef } from 'react';
import { redAppRegistry } from '../../lib/miniapp/RedAppRegistry';
import { RedAppBundleEngine } from '../../lib/miniapp/RedAppBundleEngine';
import { meshGatewayEngine } from '../../lib/network/MeshGatewayEngine';
import { RedAppBundle } from '../../lib/miniapp/RedSDKTypes';

interface RedHyperBrowserModalProps {
    userDid: string;
    onClose: () => void;
    onLaunchMiniApp: (bundle: RedAppBundle) => void;
}

interface BrowserBookmark {
    title: string;
    url: string;
    icon: string;
}

const DEFAULT_BOOKMARKS: BrowserBookmark[] = [
    { title: 'RED Bazaar P2P', url: 'red://org.redmesh.bazaar', icon: '🛒' },
    { title: 'MeshWiki Táctica', url: 'red://org.redmesh.wiki', icon: '📚' },
    { title: 'Batalla Naval Malla', url: 'red://org.redmesh.battleship', icon: '🚢' },
    { title: 'Wikipedia Global', url: 'https://es.wikipedia.org', icon: '🌐' },
    { title: 'DuckDuckGo Lite', url: 'https://lite.duckduckgo.com', icon: '🦆' },
];

export const RedHyperBrowserModal: React.FC<RedHyperBrowserModalProps> = ({
    userDid,
    onClose,
    onLaunchMiniApp,
}) => {
    const [currentUrl, setCurrentUrl] = useState<string>('red://org.redmesh.bazaar');
    const [addressInput, setAddressInput] = useState<string>('red://org.redmesh.bazaar');
    const [history, setHistory] = useState<string[]>(['red://org.redmesh.bazaar']);
    const [historyIdx, setHistoryIdx] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [renderedContent, setRenderedContent] = useState<{ type: 'blob' | 'iframe_src' | 'html'; src: string }>({
        type: 'html',
        src: '<p>Cargando navegador...</p>'
    });
    const [isGatewayActive, setIsGatewayActive] = useState<boolean>(false);
    const [activeTabTitle, setActiveTabTitle] = useState<string>('Bazaar P2P');

    useEffect(() => {
        navigateTo(currentUrl, false);
    }, []);

    const navigateTo = async (url: string, pushHistory = true) => {
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('red://') && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl;
        }

        setIsLoading(true);
        setCurrentUrl(cleanUrl);
        setAddressInput(cleanUrl);

        if (pushHistory) {
            const nextHistory = history.slice(0, historyIdx + 1);
            nextHistory.push(cleanUrl);
            setHistory(nextHistory);
            setHistoryIdx(nextHistory.length - 1);
        }

        try {
            // Case 1: Sovereign Mesh dApp (red://)
            if (cleanUrl.startsWith('red://')) {
                const appId = cleanUrl.replace('red://', '').replace('/', '');
                const app = redAppRegistry.getApp(appId);

                if (app) {
                    setActiveTabTitle(app.manifest.name);
                    const blob = RedAppBundleEngine.createBlobUrl(app.bundle);
                    setRenderedContent({ type: 'blob', src: blob });
                    setIsGatewayActive(false);
                } else {
                    setActiveTabTitle("App no encontrada");
                    setRenderedContent({
                        type: 'html',
                        src: `<div style="background:#0b0f19;color:#fff;font-family:sans-serif;padding:40px;text-align:center;">
                            <h2 style="color:#ef4444;">Mini-App no encontrada: ${appId}</h2>
                            <p style="color:#94a3b8;margin-top:10px;">La dApp solicitada no está instalada en tu nodo ni en la memoria de los vecinos de la malla.</p>
                        </div>`
                    });
                }
            } 
            // Case 2: ClearNet Web (https:// or http://)
            else {
                setActiveTabTitle(new URL(cleanUrl).hostname);
                const hasInternet = await meshGatewayEngine.checkInternetConnectivity();
                
                if (hasInternet) {
                    setRenderedContent({ type: 'iframe_src', src: cleanUrl });
                    setIsGatewayActive(false);
                } else {
                    // Mesh Gateway Out-Proxy
                    setIsGatewayActive(true);
                    const result = await meshGatewayEngine.fetchUrl(cleanUrl, userDid);
                    setRenderedContent({ type: 'html', src: result.html });
                }
            }
        } catch (err: any) {
            setRenderedContent({
                type: 'html',
                src: `<div style="background:#0b0f19;color:#fff;font-family:sans-serif;padding:40px;text-align:center;">
                    <h2 style="color:#ef4444;">Error de Conexión</h2>
                    <p style="color:#94a3b8;margin-top:10px;">${err.message}</p>
                </div>`
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (historyIdx > 0) {
            const nextIdx = historyIdx - 1;
            setHistoryIdx(nextIdx);
            navigateTo(history[nextIdx], false);
        }
    };

    const handleForward = () => {
        if (historyIdx < history.length - 1) {
            const nextIdx = historyIdx + 1;
            setHistoryIdx(nextIdx);
            navigateTo(history[nextIdx], false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in p-2 sm:p-4">
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl w-full max-w-5xl h-[92vh] max-h-[900px] shadow-2xl flex flex-col overflow-hidden">
                {/* Browser Top Chrome */}
                <div className="bg-slate-900 border-b border-slate-800 p-2.5 flex flex-col gap-2">
                    {/* Tabs row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <div className="px-3 py-1 bg-slate-950 border border-slate-700/80 text-blue-400 rounded-t-lg text-xs font-bold flex items-center gap-2 max-w-[200px] truncate shadow-sm">
                                <span>{currentUrl.startsWith('red://') ? '⚡' : '🌐'}</span>
                                <span className="truncate">{activeTabTitle}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {isGatewayActive && (
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-full font-bold animate-pulse">
                                    🛰️ Mesh Out-Proxy Activo
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition text-sm"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Address & Navigation Bar */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={handleBack}
                                disabled={historyIdx === 0}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-xs text-slate-300 transition"
                            >
                                ◀
                            </button>
                            <button
                                type="button"
                                onClick={handleForward}
                                disabled={historyIdx >= history.length - 1}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-xs text-slate-300 transition"
                            >
                                ▶
                            </button>
                            <button
                                type="button"
                                onClick={() => navigateTo(currentUrl, false)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition"
                            >
                                🔄
                            </button>
                        </div>

                        {/* Omnibox */}
                        <form 
                            onSubmit={(e) => { e.preventDefault(); navigateTo(addressInput); }}
                            className="flex-1 flex items-center bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 gap-2 focus-within:border-blue-500 shadow-inner"
                        >
                            <span className="text-xs">{addressInput.startsWith('red://') ? '🛡️' : '🔒'}</span>
                            <input
                                type="text"
                                value={addressInput}
                                onChange={(e) => setAddressInput(e.target.value)}
                                placeholder="Ingresa red://app-id o https://sitio.com..."
                                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                            />
                            {isLoading && <span className="animate-spin text-xs">⏳</span>}
                        </form>
                    </div>

                    {/* Quick Tactical Bookmarks */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Marcadores:</span>
                        {DEFAULT_BOOKMARKS.map(bm => (
                            <button
                                key={bm.url}
                                type="button"
                                onClick={() => navigateTo(bm.url)}
                                className="px-2 py-0.5 bg-slate-850 hover:bg-slate-800 border border-slate-700/60 rounded-md text-[11px] text-slate-300 font-medium flex items-center gap-1 transition whitespace-nowrap"
                            >
                                <span>{bm.icon}</span>
                                <span>{bm.title}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Viewport Frame */}
                <div className="flex-1 bg-slate-950 relative overflow-hidden">
                    {renderedContent.type === 'iframe_src' ? (
                        <iframe
                            src={renderedContent.src}
                            title="Web View"
                            className="w-full h-full border-none bg-slate-950"
                        />
                    ) : renderedContent.type === 'blob' ? (
                        <iframe
                            src={renderedContent.src}
                            title="dApp View"
                            sandbox="allow-scripts allow-forms"
                            className="w-full h-full border-none bg-slate-950"
                        />
                    ) : (
                        <div 
                            dangerouslySetInnerHTML={{ __html: renderedContent.src }}
                            className="w-full h-full overflow-y-auto"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
