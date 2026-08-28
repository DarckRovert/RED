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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in p-2 sm:p-4">
            <div className={`bg-slate-950 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all ${
                isFullscreen ? 'w-full h-full rounded-none border-none' : 'w-full max-w-4xl h-[90vh] max-h-[850px]'
            }`}>
                {/* Header Bar */}
                <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between select-none">
                    <div className="flex items-center gap-2.5">
                        <span className="text-xl">{bundle.manifest.icon || '📱'}</span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-white tracking-wide">{bundle.manifest.name}</h2>
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-950 border border-blue-800 text-blue-400 rounded-md font-mono font-bold">
                                    v{bundle.manifest.version}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs">{bundle.manifest.id}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* Permissions Button */}
                        <button
                            type="button"
                            onClick={() => setShowPermissionsModal(!showPermissionsModal)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                            title="Gestionar permisos del sandbox"
                        >
                            <span>🛡️ Permisos</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        </button>

                        {/* Reload Button */}
                        <button
                            type="button"
                            onClick={handleReload}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs transition"
                            title="Recargar Mini-App"
                        >
                            🔄
                        </button>

                        {/* Fullscreen Button */}
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs transition"
                            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                        >
                            {isFullscreen ? '🗗' : '🗖'}
                        </button>

                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg text-xs font-bold transition ml-1"
                            title="Cerrar Mini-App"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Permissions Flyout Drawer */}
                {showPermissionsModal && (
                    <div className="bg-slate-900 border-b border-slate-800 p-3 animate-fade-in flex flex-wrap gap-2 items-center text-xs">
                        <span className="font-semibold text-slate-300 mr-2">Permisos Sandbox:</span>
                        {bundle.manifest.permissions.map(scope => {
                            const isGranted = grantedPermissions.has(scope);
                            return (
                                <button
                                    key={scope}
                                    type="button"
                                    onClick={() => togglePermission(scope)}
                                    className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 font-mono text-[11px] transition ${
                                        isGranted 
                                            ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300' 
                                            : 'bg-slate-800 border-slate-700 text-slate-500 line-through'
                                    }`}
                                >
                                    <span>{isGranted ? '✓' : '✗'}</span>
                                    <span>{scope}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Sandboxed Iframe Container */}
                <div className="flex-1 bg-slate-950 relative overflow-hidden">
                    {blobUrl ? (
                        <iframe
                            ref={iframeRef}
                            src={blobUrl}
                            title={bundle.manifest.name}
                            sandbox="allow-scripts allow-forms"
                            onLoad={handleIframeLoad}
                            className="w-full h-full border-none bg-slate-950"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                            Cargando Sandbox Soberano...
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
