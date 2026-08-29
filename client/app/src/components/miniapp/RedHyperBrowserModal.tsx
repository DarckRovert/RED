"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { redAppRegistry } from '../../lib/miniapp/RedAppRegistry';
import { RedAppBundleEngine } from '../../lib/miniapp/RedAppBundleEngine';
import { meshGatewayEngine } from '../../lib/network/MeshGatewayEngine';
import { RedAppBundle, RedPermissionScope, PaymentIntentRequest, PaymentReceipt } from '../../lib/miniapp/RedSDKTypes';
import { RedSDKBridge, HostContext } from '../../lib/miniapp/RedSDKBridge';
import { redPaymentGateway } from '../../lib/miniapp/RedPaymentGatewayEngine';
import { UniversalCheckoutModal } from './UniversalCheckoutModal';
import { useTranslation } from '../../lib/i18n/i18nEngine';
import { toast } from '../Toast';

interface RedHyperBrowserModalProps {
    userDid: string;
    nickname?: string;
    publicKey?: string;
    onClose: () => void;
    onLaunchMiniApp: (bundle: RedAppBundle) => void;
}

interface BrowserTab {
    id: string;
    url: string;
    title: string;
    icon: string;
    isProxy: boolean;
    hops: number;
    relayDid?: string;
    history: string[];
    historyIndex: number;
}

interface BrowserBookmark {
    title: string;
    url: string;
    icon: string;
}

const DEFAULT_BOOKMARKS: BrowserBookmark[] = [
    { title: 'Bazaar P2P', url: 'red://org.redmesh.bazaar', icon: '🛒' },
    { title: 'MeshWiki', url: 'red://org.redmesh.wiki', icon: '📚' },
    { title: 'Batalla Naval', url: 'red://org.redmesh.battleship', icon: '🚢' },
    { title: 'Wikipedia Global', url: 'https://es.m.wikipedia.org', icon: '🌐' },
    { title: 'DuckDuckGo Lite', url: 'https://lite.duckduckgo.com', icon: '🦆' },
];

export const RedHyperBrowserModal: React.FC<RedHyperBrowserModalProps> = ({
    userDid,
    nickname = 'Operador',
    publicKey = 'pk_00',
    onClose,
    onLaunchMiniApp,
}) => {
    const { t } = useTranslation();
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const [tabs, setTabs] = useState<BrowserTab[]>([
        { 
            id: 'tab_1', 
            url: 'red://org.redmesh.bazaar', 
            title: 'RED Bazaar P2P', 
            icon: '🛒', 
            isProxy: false, 
            hops: 0,
            history: ['red://org.redmesh.bazaar'],
            historyIndex: 0
        }
    ]);
    const [activeTabId, setActiveTabId] = useState<string>('tab_1');
    const [addressInput, setAddressInput] = useState<string>('red://org.redmesh.bazaar');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [showSecurityShield, setShowSecurityShield] = useState<boolean>(false);
    const [currentAppBundle, setCurrentAppBundle] = useState<RedAppBundle | null>(null);

    // Active Checkout Modal state for in-browser dApp purchases
    const [activeCheckoutIntent, setActiveCheckoutIntent] = useState<{
        intent: PaymentIntentRequest;
        resolve: (receipt: PaymentReceipt) => void;
        reject: (err: Error) => void;
    } | null>(null);

    const [renderedContent, setRenderedContent] = useState<{ 
        type: 'blob' | 'iframe_src' | 'html' | 'reader'; 
        src: string;
        title?: string;
        extractedText?: string;
    }>({
        type: 'html',
        src: '<p>Cargando navegador táctico...</p>'
    });

    const activeTab = useMemo(() => {
        return tabs.find(t => t.id === activeTabId) || tabs[0];
    }, [tabs, activeTabId]);

    const canGoBack = activeTab.historyIndex > 0;
    const canGoForward = activeTab.historyIndex < activeTab.history.length - 1;

    // Granted permissions state for active dApp
    const grantedPermissions = useMemo(() => {
        if (!currentAppBundle) return new Set<RedPermissionScope>();
        const entry = redAppRegistry.getApp(currentAppBundle.manifest.id);
        return new Set(entry?.grantedPermissions || currentAppBundle.manifest.permissions);
    }, [currentAppBundle]);

    // Host SDK Bridge instance for active dApp
    const bridge = useMemo(() => {
        if (!currentAppBundle) return null;
        const ctx: HostContext = {
            userDid,
            nickname,
            publicKey,
            grantedPermissions,
        };
        return new RedSDKBridge(currentAppBundle.manifest, ctx);
    }, [currentAppBundle, userDid, nickname, publicKey, grantedPermissions]);

    // Setup RedSDK event listener and payment handler
    useEffect(() => {
        redPaymentGateway.registerUIHandler({
            onOpenCheckoutModal: (intent, resolve, reject) => {
                setActiveCheckoutIntent({ intent, resolve, reject });
            }
        });

        const handleIframeMessage = (e: MessageEvent) => {
            if (bridge) {
                bridge.handleMessage(e);
            }
        };

        window.addEventListener('message', handleIframeMessage);
        return () => {
            window.removeEventListener('message', handleIframeMessage);
            if (bridge) {
                bridge.destroy();
            }
        };
    }, [bridge]);

    const handleIframeLoad = useCallback(() => {
        if (iframeRef.current && iframeRef.current.contentWindow && bridge) {
            bridge.setIframeWindow(iframeRef.current.contentWindow);
        }
    }, [bridge]);

    // Apertura en navegador nativo seguro
    const openInAppNativeBrowser = async (targetUrl: string) => {
        try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.open({
                url: targetUrl,
                toolbarColor: '#080A12',
                presentationStyle: 'popover'
            });
        } catch {
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const updateTab = (id: string, updates: Partial<BrowserTab>) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const navigateTo = async (url: string, pushHistory = true) => {
        let cleanUrl = url.trim();
        if (!cleanUrl) return;

        // Auto detección de búsqueda
        if (!cleanUrl.startsWith('red://') && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            if (cleanUrl.includes('.') && !cleanUrl.includes(' ')) {
                cleanUrl = 'https://' + cleanUrl;
            } else {
                // Conversión automática a motor de búsqueda liviano soberano
                cleanUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(cleanUrl)}`;
            }
        }

        setIsLoading(true);
        setAddressInput(cleanUrl);

        // Actualizar historial de pestaña
        if (pushHistory) {
            setTabs(prev => prev.map(t => {
                if (t.id !== activeTabId) return t;
                const newHistory = t.history.slice(0, t.historyIndex + 1);
                newHistory.push(cleanUrl);
                return {
                    ...t,
                    url: cleanUrl,
                    history: newHistory,
                    historyIndex: newHistory.length - 1
                };
            }));
        }

        try {
            // Case 1: Sovereign Mesh dApp (red://)
            if (cleanUrl.startsWith('red://')) {
                const appId = cleanUrl.replace('red://', '').replace('/', '');
                const app = redAppRegistry.getApp(appId);

                if (app) {
                    setCurrentAppBundle(app.bundle);
                    redAppRegistry.touchApp(app.manifest.id);
                    const blob = RedAppBundleEngine.createBlobUrl(app.bundle);
                    setRenderedContent({ type: 'blob', src: blob, title: app.manifest.name });
                    updateTab(activeTabId, {
                        url: cleanUrl,
                        title: app.manifest.name,
                        icon: app.manifest.icon || '⚡',
                        isProxy: false,
                        hops: 0
                    });
                } else {
                    setCurrentAppBundle(null);
                    setRenderedContent({
                        type: 'html',
                        src: `<div style="background:#060810;color:#FFF;font-family:sans-serif;padding:40px;text-align:center;border-radius:12px;margin:20px;border:1px solid rgba(255,51,85,0.3);">
                            <div style="font-size:3rem;margin-bottom:10px;">⚠️</div>
                            <h2 style="color:#FF3355;font-weight:900;margin:0 0 10px 0;">Mini-App Soberana No Encontrada</h2>
                            <p style="color:#94A3B8;font-size:13px;max-width:400px;margin:0 auto 20px auto;">El identificador <code style="color:#00E5FF;">${appId}</code> no está instalado en la bóveda local.</p>
                            <button onclick="window.parent.postMessage({channel:'RED_SDK', type:'NAVIGATE_APP_STORE'}, '*')" style="background:#FF3355;color:#FFF;border:none;padding:10px 18px;border-radius:8px;font-weight:900;cursor:pointer;">
                                🛒 Explorar App Store P2P
                            </button>
                        </div>`
                    });
                    updateTab(activeTabId, {
                        url: cleanUrl,
                        title: 'No Encontrada',
                        icon: '⚠️',
                        isProxy: false,
                        hops: 0
                    });
                }
            } 
            // Case 2: ClearNet Web (https:// or http://)
            else {
                setCurrentAppBundle(null);
                const hasInternet = await meshGatewayEngine.checkInternetConnectivity();
                let hostname = 'Sitio Web';
                try { hostname = new URL(cleanUrl).hostname; } catch {}

                if (hasInternet) {
                    // Para sitios externos con posibles restricciones de iframe (Google, Wikipedia, etc.)
                    // Renderizamos un visor táctico con modo Lector y selector In-App seguro
                    setRenderedContent({ 
                        type: 'reader', 
                        src: cleanUrl,
                        title: hostname
                    });
                    updateTab(activeTabId, {
                        url: cleanUrl,
                        title: hostname,
                        icon: '🌐',
                        isProxy: false,
                        hops: 0
                    });
                } else {
                    // Mesh Gateway Out-Proxy (DTN)
                    const result = await meshGatewayEngine.fetchUrl(cleanUrl, userDid);
                    setRenderedContent({ type: 'html', src: result.html, title: hostname });
                    updateTab(activeTabId, {
                        url: cleanUrl,
                        title: `${hostname} (Mesh Proxy)`,
                        icon: '🛰️',
                        isProxy: true,
                        hops: 2,
                        relayDid: 'did:red:relay_satellite_node'
                    });
                }
            }
        } catch (err: any) {
            setRenderedContent({
                type: 'html',
                src: `<div style="background:#060810;color:#FFF;font-family:sans-serif;padding:40px;text-align:center;margin:20px;border-radius:12px;border:1px solid rgba(255,51,85,0.3);">
                    <div style="font-size:3rem;margin-bottom:10px;">⚡</div>
                    <h2 style="color:#FF3355;font-weight:900;margin:0 0 10px 0;">Error de Conexión Táctica</h2>
                    <p style="color:#94A3B8;font-size:13px;max-width:400px;margin:0 auto;">${err.message || 'No se pudo contactar el nodo de destino.'}</p>
                </div>`
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoBack = () => {
        if (!canGoBack) return;
        const newIndex = activeTab.historyIndex - 1;
        const prevUrl = activeTab.history[newIndex];
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, historyIndex: newIndex, url: prevUrl } : t));
        navigateTo(prevUrl, false);
    };

    const handleGoForward = () => {
        if (!canGoForward) return;
        const newIndex = activeTab.historyIndex + 1;
        const nextUrl = activeTab.history[newIndex];
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, historyIndex: newIndex, url: nextUrl } : t));
        navigateTo(nextUrl, false);
    };

    const handleReload = () => {
        navigateTo(activeTab.url, false);
    };

    useEffect(() => {
        if (activeTab) {
            navigateTo(activeTab.url, false);
        }
    }, [activeTabId]);

    const handleAddTab = () => {
        const newId = `tab_${Date.now()}`;
        const newTab: BrowserTab = {
            id: newId,
            url: 'red://org.redmesh.bazaar',
            title: 'Nueva Pestaña',
            icon: '⚡',
            isProxy: false,
            hops: 0,
            history: ['red://org.redmesh.bazaar'],
            historyIndex: 0
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(newId);
    };

    const handleCloseTab = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (tabs.length === 1) return;
        const nextTabs = tabs.filter(t => t.id !== id);
        setTabs(nextTabs);
        if (activeTabId === id) {
            setActiveTabId(nextTabs[nextTabs.length - 1].id);
        }
    };

    const isSovereignApp = activeTab.url.startsWith('red://');

    return (
        <div 
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(2, 4, 10, 0.92)",
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
                    maxWidth: "1080px",
                    height: "92vh",
                    maxHeight: "880px",
                    borderRadius: "20px",
                    boxShadow: "0 16px 50px rgba(0,0,0,0.85), 0 0 30px rgba(0, 229, 255, 0.15)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    border: "1.5px solid rgba(0, 229, 255, 0.35)",
                    background: "linear-gradient(180deg, rgba(14,18,34,0.98) 0%, rgba(6,8,16,0.99) 100%)"
                }}
            >
                {/* ── BROWSER TOP CHROME & PESTAÑAS ── */}
                <div style={{ background: "rgba(6, 8, 16, 0.95)", borderBottom: "1px solid rgba(255, 255, 255, 0.12)", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {/* Tabs row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", overflowX: "auto" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
                            {tabs.map(t => {
                                const isActive = activeTabId === t.id;
                                return (
                                    <div
                                        key={t.id}
                                        onClick={() => { setActiveTabId(t.id); setAddressInput(t.url); }}
                                        style={{
                                            padding: "6px 12px",
                                            borderRadius: "10px 10px 0 0",
                                            fontSize: "0.78rem",
                                            fontWeight: 800,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            cursor: "pointer",
                                            maxWidth: "200px",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            borderTop: isActive ? "2px solid var(--accent-cyan)" : "1px solid transparent",
                                            borderLeft: isActive ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid transparent",
                                            borderRight: isActive ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid transparent",
                                            background: isActive ? "rgba(16, 24, 48, 0.9)" : "rgba(255, 255, 255, 0.04)",
                                            color: isActive ? "#FFFFFF" : "var(--text-secondary)",
                                            boxShadow: isActive ? "0 -2px 10px rgba(0, 229, 255, 0.2)" : "none"
                                        }}
                                    >
                                        <span>{t.icon}</span>
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                                        {tabs.length > 1 && (
                                            <button
                                                onClick={(e) => handleCloseTab(e, t.id)}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    color: "var(--text-muted)",
                                                    cursor: "pointer",
                                                    fontSize: "0.7rem",
                                                    padding: "0 2px",
                                                    marginLeft: "auto"
                                                }}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                            <button
                                onClick={handleAddTab}
                                style={{
                                    padding: "4px 10px",
                                    background: "rgba(255, 255, 255, 0.08)",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    color: "#FFFFFF",
                                    borderRadius: "8px",
                                    fontSize: "0.85rem",
                                    fontWeight: 900,
                                    cursor: "pointer"
                                }}
                                title="Abrir nueva pestaña"
                            >
                                ＋
                            </button>
                        </div>

                        {/* Right close & Action buttons */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {currentAppBundle && (
                                <button
                                    type="button"
                                    onClick={() => onLaunchMiniApp(currentAppBundle)}
                                    style={{
                                        background: "rgba(0, 230, 118, 0.15)",
                                        border: "1px solid rgba(0, 230, 118, 0.4)",
                                        color: "var(--accent-emerald)",
                                        padding: "6px 12px",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        fontSize: "0.74rem",
                                        fontWeight: 800,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px"
                                    }}
                                    title="Lanzar en contenedor de pantalla completa"
                                >
                                    <span>⚡</span>
                                    <span>Lanzar dApp</span>
                                </button>
                            )}

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

                    {/* Navigation Bar & Omnibox */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {/* Nav controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <button
                                type="button"
                                onClick={handleGoBack}
                                disabled={!canGoBack}
                                style={{
                                    padding: "6px 10px",
                                    background: "rgba(255, 255, 255, 0.06)",
                                    border: "1px solid rgba(255, 255, 255, 0.14)",
                                    borderRadius: "8px",
                                    color: canGoBack ? "#FFFFFF" : "rgba(255,255,255,0.2)",
                                    cursor: canGoBack ? "pointer" : "default"
                                }}
                                title="Atrás"
                            >
                                ◀
                            </button>
                            <button
                                type="button"
                                onClick={handleGoForward}
                                disabled={!canGoForward}
                                style={{
                                    padding: "6px 10px",
                                    background: "rgba(255, 255, 255, 0.06)",
                                    border: "1px solid rgba(255, 255, 255, 0.14)",
                                    borderRadius: "8px",
                                    color: canGoForward ? "#FFFFFF" : "rgba(255,255,255,0.2)",
                                    cursor: canGoForward ? "pointer" : "default"
                                }}
                                title="Adelante"
                            >
                                ▶
                            </button>
                            <button
                                type="button"
                                onClick={handleReload}
                                style={{
                                    padding: "6px 10px",
                                    background: "rgba(255, 255, 255, 0.06)",
                                    border: "1px solid rgba(255, 255, 255, 0.14)",
                                    borderRadius: "8px",
                                    color: "#FFFFFF",
                                    cursor: "pointer"
                                }}
                                title="Recargar página"
                            >
                                🔄
                            </button>
                            <button
                                type="button"
                                onClick={() => navigateTo('red://org.redmesh.bazaar')}
                                style={{
                                    padding: "6px 10px",
                                    background: "rgba(255, 255, 255, 0.06)",
                                    border: "1px solid rgba(255, 255, 255, 0.14)",
                                    borderRadius: "8px",
                                    color: "#FFFFFF",
                                    cursor: "pointer"
                                }}
                                title="Inicio Soberano"
                            >
                                🏠
                            </button>
                        </div>

                        {/* Omnibox */}
                        <form 
                            onSubmit={(e) => { e.preventDefault(); navigateTo(addressInput); }}
                            style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                background: "rgba(0, 0, 0, 0.65)",
                                border: "1px solid rgba(0, 229, 255, 0.35)",
                                borderRadius: "12px",
                                padding: "6px 12px",
                                gap: "8px",
                                boxShadow: "inset 0 2px 6px rgba(0,0,0,0.5)"
                            }}
                        >
                            {/* Protocol Status Badge */}
                            {isSovereignApp ? (
                                <span style={{
                                    fontSize: "0.68rem",
                                    padding: "2px 8px",
                                    background: "rgba(0, 230, 118, 0.2)",
                                    border: "1px solid rgba(0, 230, 118, 0.5)",
                                    color: "var(--accent-emerald)",
                                    borderRadius: "6px",
                                    fontFamily: "JetBrains Mono, monospace",
                                    fontWeight: 900,
                                    whiteSpace: "nowrap",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px"
                                }}>
                                    <span>⚡</span>
                                    <span>red://</span>
                                </span>
                            ) : activeTab.isProxy ? (
                                <span style={{
                                    fontSize: "0.68rem",
                                    padding: "2px 8px",
                                    background: "rgba(255, 179, 0, 0.2)",
                                    border: "1px solid rgba(255, 179, 0, 0.5)",
                                    color: "var(--accent-amber)",
                                    borderRadius: "6px",
                                    fontFamily: "JetBrains Mono, monospace",
                                    fontWeight: 900,
                                    whiteSpace: "nowrap",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px"
                                }}>
                                    <span>🛰️</span>
                                    <span>MESH PROXY</span>
                                </span>
                            ) : (
                                <span style={{
                                    fontSize: "0.68rem",
                                    padding: "2px 8px",
                                    background: "rgba(0, 229, 255, 0.2)",
                                    border: "1px solid rgba(0, 229, 255, 0.5)",
                                    color: "var(--accent-cyan)",
                                    borderRadius: "6px",
                                    fontFamily: "JetBrains Mono, monospace",
                                    fontWeight: 900,
                                    whiteSpace: "nowrap",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px"
                                }}>
                                    <span>🔒</span>
                                    <span>https://</span>
                                </span>
                            )}

                            <input
                                type="text"
                                value={addressInput}
                                onChange={(e) => setAddressInput(e.target.value)}
                                placeholder="Escribe URL o término de búsqueda en la red..."
                                style={{
                                    flex: 1,
                                    background: "transparent",
                                    border: "none",
                                    outline: "none",
                                    color: "#FFFFFF",
                                    fontSize: "0.82rem",
                                    fontFamily: "JetBrains Mono, monospace",
                                    fontWeight: 700
                                }}
                            />

                            {isLoading && (
                                <span style={{ fontSize: "0.75rem", animation: "spin 1s linear infinite" }}>🔄</span>
                            )}

                            {/* ClearWeb Native Open button */}
                            {!isSovereignApp && (
                                <button
                                    type="button"
                                    onClick={() => openInAppNativeBrowser(activeTab.url)}
                                    style={{
                                        background: "rgba(0, 229, 255, 0.15)",
                                        border: "1px solid rgba(0, 229, 255, 0.4)",
                                        color: "var(--accent-cyan)",
                                        padding: "3px 8px",
                                        borderRadius: "6px",
                                        cursor: "pointer",
                                        fontSize: "0.68rem",
                                        fontWeight: 800,
                                        whiteSpace: "nowrap"
                                    }}
                                    title="Abrir en navegador seguro con JavaScript completo"
                                >
                                    ↗ Abrir Web
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setShowSecurityShield(!showSecurityShield)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: "0.75rem"
                                }}
                                title="Información de Seguridad Zero-Trust"
                            >
                                🛡️
                            </button>
                        </form>
                    </div>

                    {/* Quick Tactical Bookmarks */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", overflowX: "auto", padding: "2px 0" }}>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 900, textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace" }}>
                            Marcadores:
                        </span>
                        {DEFAULT_BOOKMARKS.map(bm => (
                            <button
                                key={bm.url}
                                type="button"
                                onClick={() => navigateTo(bm.url)}
                                style={{
                                    padding: "3px 8px",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "1px solid rgba(255, 255, 255, 0.12)",
                                    borderRadius: "8px",
                                    color: "#FFFFFF",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap"
                                }}
                            >
                                <span>{bm.icon}</span>
                                <span>{bm.title}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── SECURITY / TELEMETRY FLYOUT ── */}
                {showSecurityShield && (
                    <div style={{ background: "rgba(10, 14, 28, 0.95)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ color: "var(--accent-emerald)", fontWeight: 900 }}>🔒 PROTOCOLO:</span>
                            <span style={{ color: "#FFFFFF" }}>{isSovereignApp ? 'SANDBOX AISLADO LOCAL (BLOB URL / RED SDK)' : activeTab.isProxy ? 'RED MESH OUT-PROXY DTN' : 'CLEARNET DIRECT TLS 1.3'}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-secondary)" }}>
                            <span>SALTOS RADIO: <strong style={{ color: "var(--accent-cyan)" }}>{activeTab.hops}</strong></span>
                            <span>ENCRIPTACIÓN: <strong style={{ color: "var(--accent-emerald)" }}>ML-KEM-768 / X25519</strong></span>
                            <span>IDENTIDAD DID: <strong style={{ color: "var(--accent-cyan)" }}>{userDid.slice(0, 16)}…</strong></span>
                        </div>
                    </div>
                )}

                {/* ── VIEWPORT FRAME ── */}
                <div style={{ flex: 1, background: "#020306", position: "relative", overflow: "hidden" }}>
                    {renderedContent.type === 'blob' ? (
                        <iframe
                            ref={iframeRef}
                            src={renderedContent.src}
                            title="dApp View"
                            sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
                            onLoad={handleIframeLoad}
                            style={{ width: "100%", height: "100%", border: "none", background: "#060810" }}
                        />
                    ) : renderedContent.type === 'reader' ? (
                        /* Tactical Reader Mode for ClearWeb URLs */
                        <div style={{ width: "100%", height: "100%", overflowY: "auto", padding: "24px", color: "#FFFFFF", boxSizing: "border-box" }}>
                            <div style={{
                                maxWidth: "720px",
                                margin: "0 auto",
                                background: "rgba(12, 16, 32, 0.85)",
                                border: "1px solid rgba(0, 229, 255, 0.25)",
                                borderRadius: "16px",
                                padding: "28px",
                                boxShadow: "0 10px 40px rgba(0,0,0,0.6)"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "16px", marginBottom: "20px" }}>
                                    <div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                                            MODO LECTOR TÁCTICO & NAVEGACIÓN
                                        </div>
                                        <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: "4px 0 0 0" }}>
                                            {renderedContent.title}
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openInAppNativeBrowser(renderedContent.src)}
                                        className="btn-tactical-primary"
                                        style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 800 }}
                                    >
                                        🌐 Abrir Web Completa
                                    </button>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "0.88rem", lineHeight: 1.6, color: "var(--text-primary)" }}>
                                    <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.2)", fontSize: "0.80rem" }}>
                                        <strong style={{ color: "var(--accent-cyan)" }}>URL de Destino:</strong>
                                        <div style={{ wordBreak: "break-all", color: "#FFFFFF", marginTop: "4px", fontFamily: "JetBrains Mono, monospace" }}>
                                            {renderedContent.src}
                                        </div>
                                    </div>

                                    <div style={{ color: "var(--text-secondary)", fontSize: "0.84rem" }}>
                                        Para garantizar máxima privacidad y protección contra scripts de rastreo, puedes navegar este sitio directamente con el motor nativo acelerado o mediante el portal de búsqueda P2P.
                                    </div>

                                    {/* Quick action grid */}
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "10px" }}>
                                        <div 
                                            onClick={() => openInAppNativeBrowser(renderedContent.src)}
                                            style={{
                                                padding: "16px", borderRadius: "12px", background: "rgba(255,255,255,0.04)",
                                                border: "1px solid var(--glass-border)", cursor: "pointer", display: "flex", flexDirection: "column", gap: "6px"
                                            }}
                                        >
                                            <span style={{ fontSize: "1.4rem" }}>⚡</span>
                                            <span style={{ fontWeight: 800, fontSize: "0.86rem" }}>Navegador Seguro In-App</span>
                                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Soporte completo de JavaScript, autenticación y multimedia</span>
                                        </div>

                                        <div 
                                            onClick={() => navigateTo('https://lite.duckduckgo.com')}
                                            style={{
                                                padding: "16px", borderRadius: "12px", background: "rgba(255,255,255,0.04)",
                                                border: "1px solid var(--glass-border)", cursor: "pointer", display: "flex", flexDirection: "column", gap: "6px"
                                            }}
                                        >
                                            <span style={{ fontSize: "1.4rem" }}>🦆</span>
                                            <span style={{ fontWeight: 800, fontSize: "0.86rem" }}>Búsqueda DuckDuckGo Lite</span>
                                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Páginas livianas de texto optimizadas para bajo ancho de banda</span>
                                        </div>

                                        <div 
                                            onClick={() => navigateTo('red://org.redmesh.wiki')}
                                            style={{
                                                padding: "16px", borderRadius: "12px", background: "rgba(255,255,255,0.04)",
                                                border: "1px solid var(--glass-border)", cursor: "pointer", display: "flex", flexDirection: "column", gap: "6px"
                                            }}
                                        >
                                            <span style={{ fontSize: "1.4rem" }}>📚</span>
                                            <span style={{ fontWeight: 800, fontSize: "0.86rem" }}>Enciclopedia MeshWiki</span>
                                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Artículos médicos y de supervivencia 100% offline</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div 
                            dangerouslySetInnerHTML={{ __html: renderedContent.src }}
                            style={{ width: "100%", height: "100%", overflowY: "auto", padding: "16px", color: "#FFFFFF", boxSizing: "border-box" }}
                        />
                    )}
                </div>

                {/* Checkout Modal Overlay if an active payment intent is triggered */}
                {activeCheckoutIntent && (
                    <UniversalCheckoutModal
                        intent={activeCheckoutIntent.intent}
                        buyerDid={userDid}
                        onClose={() => {
                            activeCheckoutIntent.reject(new Error("Pago cancelado por el usuario"));
                            setActiveCheckoutIntent(null);
                        }}
                        onSuccess={(receipt) => {
                            activeCheckoutIntent.resolve(receipt);
                            setActiveCheckoutIntent(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
};
