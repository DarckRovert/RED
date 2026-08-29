"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RedAppManifest, RedAppBundle, RedPermissionScope, PaymentIntentRequest, PaymentReceipt } from '../../lib/miniapp/RedSDKTypes';
import { RedSDKBridge, HostContext } from '../../lib/miniapp/RedSDKBridge';
import { RedAppBundleEngine } from '../../lib/miniapp/RedAppBundleEngine';
import { redPaymentGateway } from '../../lib/miniapp/RedPaymentGatewayEngine';
import { redAppRegistry } from '../../lib/miniapp/RedAppRegistry';
import { UniversalCheckoutModal } from './UniversalCheckoutModal';

interface MiniAppContainerModalProps {
    bundle: RedAppBundle;
    userDid: string;
    nickname: string;
    publicKey: string;
    onClose: () => void;
}

export const MiniAppContainerModal: React.FC<MiniAppContainerModalProps> = ({
    bundle,
    userDid,
    nickname,
    publicKey,
    onClose,
}) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [blobUrl, setBlobUrl] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [showPermissionsModal, setShowPermissionsModal] = useState<boolean>(false);
    
    // Granted permissions state
    const [grantedPermissions, setGrantedPermissions] = useState<Set<RedPermissionScope>>(() => {
        const entry = redAppRegistry.getApp(bundle.manifest.id);
        return new Set(entry?.grantedPermissions || bundle.manifest.permissions);
    });

    // Universal Checkout state
    const [activeCheckoutIntent, setActiveCheckoutIntent] = useState<{
        intent: PaymentIntentRequest;
        resolve: (receipt: PaymentReceipt) => void;
        reject: (err: Error) => void;
    } | null>(null);

    // Host SDK Bridge instance
    const bridge = useMemo(() => {
        const ctx: HostContext = {
            userDid,
            nickname,
            publicKey,
            grantedPermissions,
        };
        return new RedSDKBridge(bundle.manifest, ctx);
    }, [bundle.manifest, userDid, nickname, publicKey]);

    // Build Sandboxed HTML Blob URL on mount
    useEffect(() => {
        const url = RedAppBundleEngine.createBlobUrl(bundle);
        setBlobUrl(url);
        redAppRegistry.touchApp(bundle.manifest.id);

        return () => {
            if (url) URL.revokeObjectURL(url);
            bridge.destroy();
        };
    }, [bundle]);

    // Setup bridge event listeners
    useEffect(() => {
        // Register payment UI handler
        redPaymentGateway.registerUIHandler({
            onOpenCheckoutModal: (intent, resolve, reject) => {
                setActiveCheckoutIntent({ intent, resolve, reject });
            }
        });

        const handleIframeMessage = (e: MessageEvent) => {
            bridge.handleMessage(e);
        };

        window.addEventListener('message', handleIframeMessage);
        return () => {
            window.removeEventListener('message', handleIframeMessage);
        };
    }, [bridge]);

    const handleIframeLoad = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            bridge.setIframeWindow(iframeRef.current.contentWindow);
        }
    };

    const handleReload = () => {
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
        }
        const newUrl = RedAppBundleEngine.createBlobUrl(bundle);
        setBlobUrl(newUrl);
    };

    const togglePermission = (scope: RedPermissionScope) => {
        const updated = new Set(grantedPermissions);
        if (updated.has(scope)) {
            updated.delete(scope);
        } else {
            updated.add(scope);
        }
        setGrantedPermissions(updated);
        bridge.updateGrantedPermissions(updated);
        redAppRegistry.updatePermissions(bundle.manifest.id, Array.from(updated));
    };

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
                padding: isFullscreen ? "0" : "12px",
                userSelect: "none"
            }}
        >
            <div 
                style={{
                    width: "100%",
                    maxWidth: isFullscreen ? "100vw" : "1024px",
                    height: isFullscreen ? "100vh" : "92vh",
                    maxHeight: isFullscreen ? "100vh" : "880px",
                    borderRadius: isFullscreen ? "0" : "20px",
                    boxShadow: "0 16px 50px rgba(0,0,0,0.85), 0 0 30px rgba(0, 229, 255, 0.15)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    border: isFullscreen ? "none" : "1.5px solid rgba(0, 229, 255, 0.35)",
                    background: "linear-gradient(180deg, rgba(14,18,34,0.98) 0%, rgba(6,8,16,0.99) 100%)"
                }}
            >
                {/* ── HEADER TÁCTICO DEL SANDBOX ── */}
                <div style={{ padding: "12px 16px", background: "rgba(6, 8, 16, 0.95)", borderBottom: "1px solid rgba(255, 255, 255, 0.12)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(0, 0, 0, 0.6)", border: "1px solid rgba(255, 255, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
                            {bundle.manifest.icon || '📱'}
                        </div>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <h2 style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.5px", margin: 0 }}>
                                    {bundle.manifest.name}
                                </h2>
                                <span style={{ fontSize: "0.65rem", padding: "2px 6px", background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.5)", color: "var(--accent-cyan)", borderRadius: "4px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                                    v{bundle.manifest.version}
                                </span>
                                <span style={{ fontSize: "0.62rem", padding: "2px 6px", background: "rgba(0, 230, 118, 0.15)", border: "1px solid rgba(0, 230, 118, 0.5)", color: "var(--accent-emerald)", borderRadius: "6px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                                    🛡️ ARENA AISLADA
                                </span>
                            </div>
                            <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", margin: "2px 0 0 0" }}>{bundle.manifest.id}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                            type="button"
                            onClick={() => setShowPermissionsModal(!showPermissionsModal)}
                            style={{
                                padding: "6px 12px",
                                borderRadius: "10px",
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                cursor: "pointer",
                                border: showPermissionsModal ? "1px solid var(--accent-emerald)" : "1px solid rgba(255, 255, 255, 0.15)",
                                background: showPermissionsModal ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 255, 255, 0.06)",
                                color: showPermissionsModal ? "var(--accent-emerald)" : "#FFFFFF"
                            }}
                            title="Gestionar permisos del sandbox"
                        >
                            <span>🛡️ Permisos</span>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-emerald)" }}></span>
                        </button>

                        <button
                            type="button"
                            onClick={handleReload}
                            style={{
                                padding: "6px 10px",
                                background: "rgba(255, 255, 255, 0.06)",
                                border: "1px solid rgba(255, 255, 255, 0.14)",
                                borderRadius: "10px",
                                color: "#FFFFFF",
                                cursor: "pointer"
                            }}
                            title="Recargar Mini-App"
                        >
                            🔄
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            style={{
                                padding: "6px 10px",
                                background: "rgba(255, 255, 255, 0.06)",
                                border: "1px solid rgba(255, 255, 255, 0.14)",
                                borderRadius: "10px",
                                color: "#FFFFFF",
                                cursor: "pointer"
                            }}
                            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                        >
                            {isFullscreen ? '🗗' : '🗖'}
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: "6px 12px",
                                background: "rgba(232, 33, 58, 0.2)",
                                border: "1px solid var(--accent-crimson)",
                                borderRadius: "10px",
                                color: "#FF8599",
                                fontSize: "0.82rem",
                                fontWeight: 900,
                                cursor: "pointer",
                                marginLeft: "4px"
                            }}
                            title="Cerrar Sandbox"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* ── PERMISSIONS FLYOUT DRAWER ── */}
                {showPermissionsModal && (
                    <div style={{ background: "rgba(10, 14, 28, 0.95)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", fontSize: "0.75rem" }}>
                        <span style={{ fontWeight: 800, color: "var(--text-secondary)", marginRight: "8px", fontFamily: "JetBrains Mono, monospace" }}>Permisos Concedidos:</span>
                        {bundle.manifest.permissions.map(scope => {
                            const isGranted = grantedPermissions.has(scope);
                            return (
                                <button
                                    key={scope}
                                    type="button"
                                    onClick={() => togglePermission(scope)}
                                    style={{
                                        padding: "4px 10px",
                                        borderRadius: "8px",
                                        border: isGranted ? "1px solid var(--accent-emerald)" : "1px solid rgba(255, 255, 255, 0.1)",
                                        background: isGranted ? "rgba(0, 230, 118, 0.2)" : "rgba(0, 0, 0, 0.4)",
                                        color: isGranted ? "var(--accent-emerald)" : "var(--text-muted)",
                                        fontFamily: "JetBrains Mono, monospace",
                                        fontSize: "0.7rem",
                                        fontWeight: 800,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        cursor: "pointer",
                                        textDecoration: isGranted ? "none" : "line-through"
                                    }}
                                >
                                    <span>{isGranted ? '✓' : '✗'}</span>
                                    <span>{scope}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ── SANDBOXED IFRAME VIEWPORT ── */}
                <div style={{ flex: 1, background: "#020306", position: "relative", overflow: "hidden" }}>
                    {blobUrl ? (
                        <iframe
                            ref={iframeRef}
                            src={blobUrl}
                            title={bundle.manifest.name}
                            sandbox="allow-scripts allow-forms"
                            onLoad={handleIframeLoad}
                            style={{ width: "100%", height: "100%", border: "none", background: "#020306" }}
                        />
                    ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "0.85rem", fontFamily: "JetBrains Mono, monospace" }}>
                            Inicializando Sandbox Soberano...
                        </div>
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
