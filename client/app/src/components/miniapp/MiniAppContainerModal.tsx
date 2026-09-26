"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from '../../lib/i18n/i18nEngine';
import { RedAppManifest, RedAppBundle, RedPermissionScope, PaymentIntentRequest, PaymentReceipt } from '../../lib/miniapp/RedSDKTypes';
import { RedSDKBridge, HostContext } from '../../lib/miniapp/RedSDKBridge';
import { RedAppBundleEngine } from '../../lib/miniapp/RedAppBundleEngine';
import { redPaymentGateway } from '../../lib/miniapp/RedPaymentGatewayEngine';
import { redAppRegistry } from '../../lib/miniapp/RedAppRegistry';
import { BackHandlerRegistry } from '../../lib/navigation/BackHandlerRegistry';
import { TacticalAudioEngine } from '../../lib/audio/TacticalAudioEngine';
import { toast } from '../Toast';
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
    const { t } = useTranslation();
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

    // ─── BackHandlerRegistry LIFO & Keyboard Interception ──────────────────────
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (activeCheckoutIntent) {
                TacticalAudioEngine.playTap();
                activeCheckoutIntent.reject(new Error("Pago cancelado por el operador."));
                setActiveCheckoutIntent(null);
                return true;
            }
            if (showPermissionsModal) {
                TacticalAudioEngine.playTap();
                setShowPermissionsModal(false);
                return true;
            }
            if (isFullscreen) {
                TacticalAudioEngine.playTap();
                setIsFullscreen(false);
                return true;
            }
            TacticalAudioEngine.playTap();
            onClose();
            return true;
        });

        return unregister;
    }, [activeCheckoutIntent, showPermissionsModal, isFullscreen, onClose]);

    // ─── Resilient Copy to Clipboard ──────────────────────────────────────────
    const copyToClipboard = async (text: string, label: string = 'Texto') => {
        TacticalAudioEngine.playTap();
        if (typeof window !== 'undefined' && navigator?.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                toast.info(`📋 ${label} copiado al portapapeles.`);
                return;
            } catch {}
        }
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.pointerEvents = 'none';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            toast.info(`📋 ${label} copiado al portapapeles.`);
        } catch {
            toast.error(`No se pudo copiar ${label.toLowerCase()}.`);
        }
    };

    const handleReload = () => {
        TacticalAudioEngine.playTap();
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
        }
        const newUrl = RedAppBundleEngine.createBlobUrl(bundle);
        setBlobUrl(newUrl);
    };

    const togglePermission = (scope: RedPermissionScope) => {
        TacticalAudioEngine.playTap();
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
            className="scroll-container"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(3, 5, 12, 0.96)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: isFullscreen ? "0" : "clamp(6px, 1.5vh, 12px)",
                userSelect: "none",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
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
                    background: "linear-gradient(180deg, rgba(14,18,34,0.98) 0%, rgba(6,8,16,0.99) 100%)",
                    margin: "auto",
                }}
            >
                {/* ── HEADER TÁCTICO DEL SANDBOX CON PROTECCIÓN DE ANCHO ── */}
                <div style={{
                    padding: "10px 14px",
                    background: "rgba(6, 8, 16, 0.95)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    flexShrink: 0,
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: "1 1 auto" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(0, 0, 0, 0.6)", border: "1px solid rgba(255, 255, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
                            {bundle.manifest.icon || '📱'}
                        </div>
                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <h2 style={{ fontSize: "0.90rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.5px", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>
                                    {bundle.manifest.name}
                                </h2>
                                <span style={{ fontSize: "0.62rem", padding: "1px 5px", background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.5)", color: "var(--accent-cyan)", borderRadius: "4px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                                    v{bundle.manifest.version}
                                </span>
                                <span style={{ fontSize: "0.60rem", padding: "1px 5px", background: "rgba(0, 230, 118, 0.15)", border: "1px solid rgba(0, 230, 118, 0.5)", color: "var(--accent-emerald)", borderRadius: "6px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                                    🛡️ {t('sovereign_store_modal.sandbox_isolated')}
                                </span>
                            </div>
                            <p 
                                onClick={() => copyToClipboard(bundle.manifest.id, 'App ID')}
                                style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", margin: "2px 0 0 0", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                title="Clic para copiar App ID"
                            >
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{bundle.manifest.id}</span>
                                <span style={{ opacity: 0.6, flexShrink: 0 }}>📋</span>
                            </p>
                        </div>
                    </div>

                    {/* Actions Toolbar Blindada */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                        <button
                            type="button"
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                setShowPermissionsModal(!showPermissionsModal);
                            }}
                            style={{
                                padding: "6px 10px",
                                borderRadius: "8px",
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
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
                                padding: "6px 8px",
                                background: "rgba(255, 255, 255, 0.06)",
                                border: "1px solid rgba(255, 255, 255, 0.14)",
                                borderRadius: "8px",
                                color: "#FFFFFF",
                                cursor: "pointer"
                            }}
                            title="Recargar Mini-App"
                        >
                            🔄
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                setIsFullscreen(!isFullscreen);
                            }}
                            style={{
                                padding: "6px 8px",
                                background: "rgba(255, 255, 255, 0.06)",
                                border: "1px solid rgba(255, 255, 255, 0.14)",
                                borderRadius: "8px",
                                color: "#FFFFFF",
                                cursor: "pointer"
                            }}
                            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                        >
                            {isFullscreen ? '🗗' : '🗖'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                onClose();
                            }}
                            style={{
                                padding: "6px 10px",
                                background: "rgba(232, 33, 58, 0.2)",
                                border: "1px solid var(--accent-crimson)",
                                borderRadius: "8px",
                                color: "#FF8599",
                                fontSize: "0.80rem",
                                fontWeight: 900,
                                cursor: "pointer",
                            }}
                            title="Cerrar Sandbox"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* ── PERMISSIONS FLYOUT DRAWER ACOTADO CON SCROLL ── */}
                {showPermissionsModal && (
                    <div style={{
                        background: "rgba(10, 14, 28, 0.95)",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                        padding: "8px 14px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        alignItems: "center",
                        fontSize: "0.72rem",
                        maxHeight: "140px",
                        overflowY: "auto",
                        flexShrink: 0,
                    }}>
                        <span style={{ fontWeight: 800, color: "var(--text-secondary)", marginRight: "6px", fontFamily: "JetBrains Mono, monospace" }}>Permisos:</span>
                        {bundle.manifest.permissions.map(scope => {
                            const isGranted = grantedPermissions.has(scope);
                            return (
                                <button
                                    key={scope}
                                    type="button"
                                    onClick={() => togglePermission(scope)}
                                    style={{
                                        padding: "3px 8px",
                                        borderRadius: "6px",
                                        border: isGranted ? "1px solid var(--accent-emerald)" : "1px solid rgba(255, 255, 255, 0.1)",
                                        background: isGranted ? "rgba(0, 230, 118, 0.2)" : "rgba(0, 0, 0, 0.4)",
                                        color: isGranted ? "var(--accent-emerald)" : "var(--text-muted)",
                                        fontFamily: "JetBrains Mono, monospace",
                                        fontSize: "0.68rem",
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

                {/* ── SANDBOXED IFRAME VIEWPORT CON MIN-HEIGHT: 0 ── */}
                <div style={{ flex: "1 1 0%", minHeight: 0, background: "#020306", position: "relative", overflow: "hidden" }}>
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
