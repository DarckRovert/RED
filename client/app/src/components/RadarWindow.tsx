"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { localTransport } from "../lib/mesh/localTransport";
import { meshRouter } from "../lib/mesh/meshRouter";
import { WebCompanionPairConfirmationModal } from "./WebCompanionPairConfirmationModal";
import { toast } from "./Toast";

type RadarTab = "qr" | "radar" | "manual";

export default function RadarWindow() {
    const { goBack, identity, addContact, navigate } = useRedStore();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<RadarTab>("qr");
    const [scanning, setScanning] = useState(false);
    const [nearbyPeers, setNearbyPeers] = useState<any[]>([]);
    const [webPairingCode, setWebPairingCode] = useState<string | null>(null);

    // Manual Entry State
    const [manualHash, setManualHash] = useState("");
    const [manualName, setManualName] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [addingStatus, setAddingStatus] = useState("");

    // QR Code State
    const [qrDataUrl, setQrDataUrl] = useState<string>("");

    // QR Generation Hook
    useEffect(() => {
        if (identity?.identity_hash) {
            const pk = identity.public_key || identity.identity_hash;
            const nameParam = encodeURIComponent(identity.nickname || "Operador RED");
            const qrText = `did:red:${identity.identity_hash}:${pk}:${nameParam}`;
            import("qrcode").then(QRCode => {
                QRCode.toDataURL(qrText, {
                    width: 320,
                    margin: 1,
                    color: { dark: "#00E676", light: "#04060A" }
                }).then(setQrDataUrl);
            });
        }
    }, [identity]);

    // BLE Peers Discovery Poll
    useEffect(() => {
        const updatePeers = () => {
            const peers = localTransport.discoveredBluetoothPeers || [];
            setNearbyPeers(peers);
        };
        updatePeers();
        const interval = setInterval(updatePeers, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleRefreshNearby = () => {
        const peers = localTransport.discoveredBluetoothPeers || [];
        setNearbyPeers(peers);
        toast.info("Actualizando lista de balizas BLE cercanas...");
    };

    const handleAddPeer = async (peer: any) => {
        const targetId = meshRouter.getCanonicalId(peer.id || peer.address || "");
        const finalName = peer.name && !peer.name.startsWith("Nodo ") ? peer.name : `Nodo ${targetId.slice(0, 6)}`;
        const pk = peer.publicKey || peer.public_key || null;
        try {
            const resolvedHash = await addContact(targetId, finalName, pk);
            toast.success(`Añadido ${finalName}`);
            navigate("chat", resolvedHash || targetId);
        } catch (e: any) {
            toast.error(e?.message || "Error al conectar con el par");
        }
    };

    const startScan = async () => {
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (!Capacitor.isNativePlatform()) {
                toast.info("La cámara QR requiere un dispositivo físico Android.");
                return;
            }

            const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
            
            // Check & request runtime permissions explicitly
            const status = await BarcodeScanner.checkPermission({ force: true });
            if (status.denied) {
                toast.error("Permiso de cámara denegado. Actívalo en la configuración.");
                return;
            }
            if (!status.granted) {
                toast.warning("Permiso de cámara no concedido.");
                return;
            }

            // Hide native webview background & apply global transparency
            await BarcodeScanner.hideBackground();
            document.body.classList.add("scanner-active");
            setScanning(true);

            const result = await BarcodeScanner.startScan();

            if (result.hasContent) {
                const raw = result.content.trim();

                // 0. Detección Inteligente de Vinculación Web Companion (WhatsApp Web style)
                if (raw.startsWith("RED_PAIR:1:")) {
                    await stopScan();
                    setWebPairingCode(raw);
                    return;
                }

                let cleanHash = "";
                let pubKey: string | null = null;
                let scannedName = "Operador RED";

                if (raw.startsWith("RED_ID_VAULT:")) {
                    try {
                        const encoded = raw.split(":")[1];
                        const decoded = JSON.parse(atob(encoded));
                        cleanHash = meshRouter.getCanonicalId(decoded.did || "");
                        pubKey = decoded.pk || null;
                        scannedName = decoded.name || `Nodo ${cleanHash.slice(0, 8)}`;
                    } catch {
                        toast.error("Bóveda QR Inválida");
                    }
                } else if (raw.startsWith("did:red:")) {
                    try {
                        const withoutScheme = raw.replace(/^did:red:/i, '');
                        const parts = withoutScheme.split(":");
                        const rawHash = parts[0] ? parts[0].trim() : "";
                        cleanHash = meshRouter.getCanonicalId(rawHash) || rawHash;
                        pubKey = parts[1] ? parts[1].trim() : null;
                        if (parts[2]) {
                            try {
                                scannedName = decodeURIComponent(parts[2].trim());
                            } catch {
                                scannedName = parts[2].trim();
                            }
                        } else {
                            scannedName = `Operador ${cleanHash.slice(0, 6)}`;
                        }
                    } catch (addErr) {
                        const msg = addErr instanceof Error ? addErr.message : String(addErr);
                        toast.error(`Error al interpretar QR: ${msg}`);
                    }
                } else {
                    cleanHash = meshRouter.getCanonicalId(raw) || raw;
                    scannedName = `Operador ${cleanHash.slice(0, 6)}`;
                }

                if (cleanHash && cleanHash.length >= 8) {
                    try {
                        await addContact(cleanHash, scannedName, pubKey);
                        toast.success(`🤝 ¡Contacto ${scannedName} añadido con éxito!`);
                        navigate("chat", cleanHash);
                    } catch (addErr) {
                        const msg = addErr instanceof Error ? addErr.message : String(addErr);
                        toast.error(`Error al añadir contacto: ${msg}`);
                    }
                }
            }
        } catch (e) {
            console.error("[Scanner]", e);
            toast.error("Error al inicializar cámara");
        } finally {
            stopScan();
        }
    };

    const stopScan = async () => {
        setScanning(false);
        document.body.classList.remove("scanner-active");
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
                await BarcodeScanner.showBackground();
                await BarcodeScanner.stopScan();
            }
        } catch {}
    };

    const copyToClipboard = (text: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast.success(t('common.copied'));
        }
    };

    const myDid = identity?.identity_hash ? `did:red:${identity.identity_hash}` : "did:red:local_node";

    if (scanning) {
        return (
            <div className="scanner-viewfinder-overlay">
                <div style={{
                    padding: "14px 20px",
                    borderRadius: "16px",
                    background: "rgba(6, 12, 20, 0.92)",
                    border: "1.5px solid #00E676",
                    color: "#FFFFFF",
                    textAlign: "center",
                    boxShadow: "0 4px 25px rgba(0, 230, 118, 0.35)",
                    maxWidth: "340px",
                    width: "90%"
                }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#00E676", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        <span>🤝</span> {t('radar.scanner_title')}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)", marginTop: "4px", lineHeight: 1.3 }}>
                        {t('radar.scanner_desc')}
                    </div>
                </div>

                <div className="scanner-target-box" style={{ borderColor: "#00E676", boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 24px rgba(0, 230, 118, 0.45)" }}>
                    <div className="scanner-laser-line" style={{ background: "linear-gradient(90deg, transparent, #00E676, #00E5FF, transparent)", boxShadow: "0 0 12px #00E676" }} />
                </div>

                <button
                    onClick={stopScan}
                    className="btn-tactical-primary"
                    style={{
                        padding: "14px 36px",
                        fontSize: "0.95rem",
                        boxShadow: "0 4px 25px rgba(232,33,58,0.5)",
                        borderRadius: "var(--radius-md)"
                    }}
                >
                    {t('radar.cancel_scan')}
                </button>
            </div>
        );
    }

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #00E676 0%, #00897B 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,230,118,0.35)"
                    }}>📡</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t('radar.title')}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {t('radar.subtitle')}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => navigate("nodemap")}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                    >
                        {t('radar.map_btn')}
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title={t('common.close')}
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas Tácticas */}
            <div style={{
                padding: "10px 16px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border)",
                overflowX: "auto", flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("qr")}
                    className={activeTab === "qr" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    {t('radar.tab_qr')}
                </button>
                <button
                    onClick={() => setActiveTab("radar")}
                    className={activeTab === "radar" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    {t('radar.tab_ble')} ({nearbyPeers.length})
                </button>
                <button
                    onClick={() => setActiveTab("manual")}
                    className={activeTab === "manual" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    {t('radar.tab_manual')}
                </button>
            </div>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ─── TAB 1: MI TARJETA QR ───────────────────────────────── */}
                    {activeTab === "qr" && (
                        <div className="card-tactical animate-enter" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "18px" }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "var(--text-primary)" }}>
                                    {identity?.nickname || "Operador RED"}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", marginTop: "2px" }}>
                                    {identity?.short_id || "OFF-GRID NODE"}
                                </div>
                            </div>

                            {/* Contenedor QR de Alto Contraste */}
                            <div style={{
                                padding: "16px", background: "#04060A", borderRadius: "18px",
                                border: "2px solid rgba(0,230,118,0.35)", boxShadow: "0 0 35px rgba(0,230,118,0.15)"
                            }}>
                                {qrDataUrl ? (
                                    <img src={qrDataUrl} alt="Mi QR RED" style={{ width: "240px", height: "240px", display: "block", borderRadius: "8px" }} />
                                ) : (
                                    <div style={{ width: "240px", height: "240px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                                        {t('common.loading')}
                                    </div>
                                )}
                            </div>

                            {/* Botón de Escáner Directo */}
                            <button
                                onClick={startScan}
                                className="btn-tactical-primary"
                                style={{
                                    width: "100%", padding: "16px",
                                    background: "linear-gradient(135deg, #00E676 0%, #00B0FF 100%)",
                                    fontSize: "0.95rem", fontWeight: 900,
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px"
                                }}
                            >
                                {t('radar.scan_scanner_btn')}
                            </button>

                            {/* DID y Botón de Copiar */}
                            <div style={{ width: "100%", display: "flex", gap: "8px" }}>
                                <input
                                    readOnly
                                    value={myDid}
                                    style={{ flex: 1, fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace", background: "rgba(0,0,0,0.5)" }}
                                />
                                <button
                                    onClick={() => copyToClipboard(myDid)}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "8px 14px", fontSize: "0.78rem" }}
                                >
                                    {t('radar.copy_did')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 2: RADAR BLE CERCANO ───────────────────────────── */}
                    {activeTab === "radar" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            {/* Radar Animado */}
                            <div style={{ position: "relative", width: "220px", height: "220px", margin: "0 auto", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,230,118,0.08) 0%, rgba(4,6,10,0.95) 70%)", border: "2px solid rgba(0,230,118,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ position: "absolute", width: "100%", height: "1px", background: "rgba(0,230,118,0.2)" }} />
                                <div style={{ position: "absolute", width: "1px", height: "100%", background: "rgba(0,230,118,0.2)" }} />
                                <div style={{ position: "absolute", width: "140px", height: "140px", borderRadius: "50%", border: "1px dashed rgba(0,230,118,0.2)" }} />
                                <div style={{ position: "absolute", width: "70px", height: "70px", borderRadius: "50%", border: "1px dashed rgba(0,230,118,0.25)" }} />

                                {/* Haz Giratorio del Radar */}
                                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 0deg, rgba(0,230,118,0.3) 0deg, transparent 60deg)", animation: "spin 3s linear infinite" }} />

                                <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--accent-emerald)", boxShadow: "0 0 14px var(--accent-emerald)", zIndex: 5 }} />
                            </div>

                            {/* Lista de Nodos Detectados */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: "0.88rem", fontWeight: 800 }}>{t('radar.ble_active_nodes')} ({nearbyPeers.length})</div>
                                <span className="badge-tactical badge-tactical-emerald">SWARM ACTIVE</span>
                            </div>

                            {nearbyPeers.length === 0 ? (
                                <div className="empty-state-tactical">
                                    <div className="empty-state-icon">📡</div>
                                    <div className="empty-state-title">{t('radar.ble_searching')}</div>
                                    <div className="empty-state-desc">
                                        {t('radar.scanning')}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {nearbyPeers.map((p) => (
                                        <div
                                            key={p.id}
                                            className="card-tactical"
                                            style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: "4px solid var(--accent-emerald)" }}
                                        >
                                            <div>
                                                <strong style={{ fontSize: "0.90rem", color: "var(--text-primary)" }}>{p.name}</strong>
                                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    DID: {p.id.substring(0, 16)}…
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span className="badge-tactical badge-tactical-emerald">{p.rssi} dBm</span>
                                                <button
                                                    onClick={async () => {
                                                        const targetId = meshRouter.getCanonicalId(p.id) || p.id;
                                                        const peerRec = meshRouter.getPeerByAnyId(targetId) || meshRouter.getPeerByAnyId(p.id);
                                                        const finalId = (peerRec?.canonicalId && peerRec.canonicalId.length === 64) ? peerRec.canonicalId : targetId;
                                                        const finalName = p.name && !p.name.startsWith("Nodo ") ? p.name : (peerRec?.name || p.name);
                                                        const resolved = await addContact(finalId, finalName, peerRec?.publicKey);
                                                        toast.success(t('radar.add_success'));
                                                        navigate("chat", resolved || finalId);
                                                    }}
                                                    className="btn-tactical-secondary"
                                                    style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                                                >
                                                    {t('radar.ble_pair')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── TAB 3: AGREGAR MANUAL & ESCÁNER ────────────────────── */}
                    {activeTab === "manual" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            {/* Botón de Cámara */}
                            <button
                                onClick={startScan}
                                className="card-tactical-interactive"
                                style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", borderColor: "var(--accent-emerald)", background: "rgba(0,230,118,0.06)" }}
                            >
                                <span style={{ fontSize: "2.4rem" }}>📷</span>
                                <span style={{ fontSize: "1rem", fontWeight: 900, color: "var(--accent-emerald)" }}>{t('radar.scan_scanner_btn')}</span>
                                <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{t('radar.manual_desc')}</span>
                            </button>

                            {/* Entrada Manual de ID */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>{t('radar.manual_title')}</div>

                                <input
                                    value={manualHash}
                                    onChange={e => setManualHash(e.target.value)}
                                    placeholder={t('radar.manual_placeholder')}
                                    style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem" }}
                                />

                                <input
                                    value={manualName}
                                    onChange={e => setManualName(e.target.value)}
                                    placeholder={t('radar.alias_placeholder')}
                                />

                                <button
                                    disabled={!manualHash.trim() || isAdding}
                                    onClick={async () => {
                                        const hashToSent = manualHash.trim();
                                        if (hashToSent.startsWith("RED_PAIR:1:")) {
                                            setWebPairingCode(hashToSent);
                                            return;
                                        }
                                        setIsAdding(true);
                                        setAddingStatus(t('radar.adding'));
                                        const nameToSend = manualName.trim() || "Nuevo Par";
                                        try {
                                            const resolvedHash = await addContact(hashToSent, nameToSend);
                                            toast.success(t('radar.add_success'));
                                            navigate("chat", resolvedHash || hashToSent);
                                        } catch (err) {
                                            const msg = err instanceof Error ? err.message : String(err);
                                            toast.error(`❌ ${msg}`);
                                        } finally {
                                            setIsAdding(false);
                                            setAddingStatus("");
                                        }
                                    }}
                                    className="btn-tactical-primary"
                                    style={{ width: "100%", padding: "14px", fontSize: "0.95rem" }}
                                >
                                    {isAdding ? addingStatus || t('common.loading') : t('radar.add_btn')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Confirmación de Vinculación Web Companion */}
            {webPairingCode && (
                <WebCompanionPairConfirmationModal
                    qrData={webPairingCode}
                    onClose={() => setWebPairingCode(null)}
                />
            )}
        </div>
    );
}