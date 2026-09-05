"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { localTransport } from "../lib/mesh/localTransport";
import { meshRouter } from "../lib/mesh/meshRouter";
import { WebCompanionPairConfirmationModal } from "./WebCompanionPairConfirmationModal";
import { toast } from "./Toast";

type RadarTab = "radar" | "qr" | "manual";

export default function RadarWindow() {
    const { goBack, identity, addContact, navigate } = useRedStore();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<RadarTab>("radar");
    const [scanning, setScanning] = useState(false);
    const [nearbyPeers, setNearbyPeers] = useState<any[]>([]);
    const [selectedPeer, setSelectedPeer] = useState<any | null>(null);
    const [webPairingCode, setWebPairingCode] = useState<string | null>(null);

    // Manual Entry State
    const [manualHash, setManualHash] = useState("");
    const [manualName, setManualName] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [addingStatus, setAddingStatus] = useState("");

    // QR Code State
    const [qrDataUrl, setQrDataUrl] = useState<string>("");
    const shouldScanRef = useRef(false);

    // QR Generation Hook
    useEffect(() => {
        if (identity?.identity_hash) {
            const pk = identity.public_key || identity.identity_hash;
            const nameParam = encodeURIComponent(identity.nickname || "Operador RED");
            const qrText = `did:red:${identity.identity_hash}:${pk}:${nameParam}`;
            import('../lib/qr/OfflineQrEngine').then(({ OfflineQrEngine }) => {
                OfflineQrEngine.generateDataUrl(qrText, {
                    width: 320,
                    margin: 1,
                    darkColor: "#00E676",
                    lightColor: "#04060A"
                }).then(setQrDataUrl);
            });
        }
    }, [identity]);

    // BLE Peers Discovery Poll & Scanner Cleanup
    useEffect(() => {
        const updatePeers = () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            const peers = localTransport.discoveredBluetoothPeers || [];
            setNearbyPeers(peers);
        };
        updatePeers();

        window.addEventListener('red:ble_peers_updated', updatePeers);
        document.addEventListener('visibilitychange', updatePeers);
        const interval = setInterval(updatePeers, 6000);

        return () => {
            clearInterval(interval);
            window.removeEventListener('red:ble_peers_updated', updatePeers);
            document.removeEventListener('visibilitychange', updatePeers);
            stopScan();
        };
    }, []);

    const handleRefreshNearby = () => {
        const peers = localTransport.discoveredBluetoothPeers || [];
        setNearbyPeers(peers);
        toast.info("Escaneando espectro BLE & Wi-Fi Direct...");
    };

    const handleAddPeer = async (peer: any) => {
        const rawId = peer.id || peer.address || "";
        const targetId = meshRouter.getCanonicalId(rawId) || rawId;
        const peerRecord = meshRouter.getPeerByAnyId(targetId) || meshRouter.getPeerByAnyId(rawId);
        const resolvedId = (peerRecord?.canonicalId && peerRecord.canonicalId.length === 64) ? peerRecord.canonicalId : targetId;
        const finalName = peer.name && !peer.name.startsWith("Nodo ") ? peer.name : (peerRecord?.name || `Nodo ${resolvedId.slice(0, 6)}`);
        const pk = peer.publicKey || peer.public_key || peerRecord?.publicKey || null;
        try {
            const resolvedHash = await addContact(resolvedId, finalName, pk);
            toast.success(`🤝 ¡Contacto ${finalName} añadido!`);
            navigate("chat", resolvedHash || resolvedId);
        } catch (e: any) {
            toast.error(e?.message || "Error al conectar con el par");
        }
    };

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const webCamStreamRef = useRef<MediaStream | null>(null);
    const webCamRafRef = useRef<number | null>(null);

    const processScannedQr = async (rawContent: string) => {
        const raw = rawContent.trim();
        if (
            raw.startsWith("RED_PAIR:1:") ||
            raw.startsWith("RED_PAIR:2:") ||
            raw.startsWith("RED_PAIR:") ||
            raw.startsWith("RED_VAULT:1:")
        ) {
            await stopScan();
            window.dispatchEvent(new CustomEvent("red:pair_web_companion", { detail: raw }));
            setWebPairingCode(raw);
            return;
        }

        let cleanHash = "";
        let pubKey: string | null = null;
        let scannedName = "Operador RED";

        if (raw.startsWith("{") && raw.endsWith("}")) {
            try {
                const parsed = JSON.parse(raw);
                const rawHash = parsed.hash || parsed.peerHash || (parsed.did ? parsed.did.replace(/^did:red:/i, "") : "");
                cleanHash = meshRouter.getCanonicalId(rawHash) || rawHash;
                pubKey = parsed.pk || parsed.publicKey || null;
                scannedName = parsed.name || parsed.nickname || `Operador ${cleanHash.slice(0, 6)}`;
            } catch {
                toast.error("Error al interpretar JSON QR");
            }
        } else if (raw.startsWith("RED_ID_VAULT:")) {
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
                const resolvedHash = await addContact(cleanHash, scannedName, pubKey);

                // Anunciar handshake en la malla para que el otro par registre el camino de retorno
                try {
                    const payload = new TextEncoder().encode(JSON.stringify({
                        type: "contact_request",
                        sender_hash: identity?.identity_hash,
                        sender_name: identity?.nickname || "Operador RED",
                        sender_pk: identity?.public_key,
                        timestamp: Date.now()
                    }));
                    meshRouter.broadcast(payload);
                } catch {}

                toast.success(`🤝 ¡Contacto ${scannedName} añadido con éxito!`);
                const targetChat = (typeof resolvedHash === "string" && resolvedHash) ? resolvedHash : cleanHash;
                navigate("chat", targetChat);
            } catch (addErr) {
                const msg = addErr instanceof Error ? addErr.message : String(addErr);
                toast.error(`Error al añadir contacto: ${msg}`);
            }
        }
    };

    const startWebCamScan = async () => {
        try {
            setScanning(true);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
            });
            webCamStreamRef.current = stream;

            await new Promise<void>(resolve => {
                const check = () => (videoRef.current ? resolve() : requestAnimationFrame(check));
                check();
            });

            if (!shouldScanRef.current) {
                await stopScan();
                return;
            }

            const video = videoRef.current!;
            video.srcObject = stream;
            await video.play();

            const hasBD = "BarcodeDetector" in window;
            const detector = hasBD ? new (window as any).BarcodeDetector({ formats: ["qr_code"] }) : null;
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            const tick = async () => {
                if (!shouldScanRef.current || !webCamStreamRef.current) return;
                if (video.readyState >= 2 && ctx) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0);
                    try {
                        if (detector) {
                            const codes = await detector.detect(canvas);
                            if (codes.length > 0 && codes[0].rawValue) {
                                await stopScan();
                                await processScannedQr(codes[0].rawValue);
                                return;
                            }
                        }
                    } catch {}
                }
                webCamRafRef.current = requestAnimationFrame(tick);
            };
            webCamRafRef.current = requestAnimationFrame(tick);
        } catch (err: any) {
            console.warn("[RadarScanner] Fallback WebCam error:", err);
            const msg = err?.name === "NotAllowedError"
                ? "Permiso de cámara web denegado."
                : "Cámara web no accesible en este navegador. Puedes usar la subida de imagen QR.";
            toast.warning(msg);
            setScanning(false);
        }
    };

    const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";

        toast.info("Analizando imagen QR...");
        try {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const dataUrl = ev.target?.result as string;
                if (!dataUrl) return;

                const img = new Image();
                img.onload = async () => {
                    try {
                        const canvas = document.createElement("canvas");
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext("2d");
                        if (!ctx) throw new Error("Canvas context null");
                        ctx.drawImage(img, 0, 0);

                        if ("BarcodeDetector" in window) {
                            try {
                                const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
                                const barcodes = await detector.detect(canvas);
                                if (barcodes.length > 0 && barcodes[0].rawValue) {
                                    await stopScan();
                                    await processScannedQr(barcodes[0].rawValue);
                                    return;
                                }
                            } catch {}
                        }

                        // Pure JS / Offline fallback via @zxing/library
                        try {
                            const { BrowserQRCodeReader } = await import("@zxing/library");
                            const zxingReader = new BrowserQRCodeReader();
                            const zResult = await zxingReader.decodeFromImageElement(img);
                            if (zResult && zResult.getText()) {
                                await stopScan();
                                await processScannedQr(zResult.getText());
                                return;
                            }
                        } catch {}

                        toast.warning("No se detectó un código QR legible en esta imagen.");
                    } catch {
                        toast.error("Error al procesar imagen");
                    }
                };
                img.src = dataUrl;
            };
            reader.readAsDataURL(file);
        } catch {
            toast.error("Error al leer archivo");
        }
    };

    const startScan = async () => {
        shouldScanRef.current = true;
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (!Capacitor.isNativePlatform()) {
                if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
                    await startWebCamScan();
                } else {
                    toast.info("Escaneo visual: sube una imagen de código QR.");
                }
                return;
            }

            const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
            
            const status = await BarcodeScanner.checkPermission({ force: true });
            if (!shouldScanRef.current) {
                await stopScan();
                return;
            }
            if (status.denied) {
                toast.error("Permiso de cámara denegado. Actívalo en la configuración.");
                return;
            }
            if (!status.granted) {
                toast.warning("Permiso de cámara no concedido.");
                return;
            }

            await BarcodeScanner.hideBackground();
            if (!shouldScanRef.current) {
                await stopScan();
                return;
            }
            if (typeof document !== "undefined") {
                document.documentElement.classList.add("scanner-active");
            }
            document.body.classList.add("scanner-active");
            setScanning(true);

            const result = await BarcodeScanner.startScan();
            if (!shouldScanRef.current) {
                await stopScan();
                return;
            }

            if (result.hasContent && result.content) {
                await processScannedQr(result.content.trim());
            }
        } catch (e) {
            console.error("[Scanner]", e);
            toast.error("Error al inicializar cámara");
        } finally {
            if (!shouldScanRef.current) {
                stopScan();
            }
        }
    };

    const stopScan = async () => {
        shouldScanRef.current = false;
        if (webCamRafRef.current) {
            cancelAnimationFrame(webCamRafRef.current);
            webCamRafRef.current = null;
        }
        if (webCamStreamRef.current) {
            try {
                webCamStreamRef.current.getTracks().forEach(track => track.stop());
            } catch {}
            webCamStreamRef.current = null;
        }
        if (videoRef.current) {
            try {
                videoRef.current.srcObject = null;
            } catch {}
        }
        setScanning(false);
        if (typeof document !== "undefined") {
            document.documentElement.classList.remove("scanner-active");
            document.body.classList.remove("scanner-active");
        }
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
                await BarcodeScanner.showBackground().catch(() => {});
                await BarcodeScanner.stopScan().catch(() => {});
            }
        } catch {}
    };

    const copyToClipboard = (text: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast.success(t('common.copied') || "Copiado");
        }
    };

    const myDid = identity?.identity_hash ? `did:red:${identity.identity_hash}` : "did:red:local_node";

    // Calcular posición polar para cada nodo detectado
    const polarPeers = useMemo(() => {
        return nearbyPeers.map((p, idx) => {
            // Pseudo-angle from hash
            const hash = p.id || p.address || `${idx}`;
            let sum = 0;
            for (let i = 0; i < hash.length; i++) sum += hash.charCodeAt(i);
            const angleDeg = (sum * 47) % 360;
            const angleRad = (angleDeg * Math.PI) / 180;

            // Distance ratio based on RSSI (-30 dBm closest ~ 15%, -100 dBm farthest ~ 90%)
            const rssi = typeof p.rssi === "number" ? p.rssi : -70;
            const normRssi = Math.max(-100, Math.min(-30, rssi));
            const radiusPercent = 15 + ((100 + normRssi) / 70) * 75; // 15% to 90%

            const x = 50 + (radiusPercent / 2) * Math.cos(angleRad);
            const y = 50 + (radiusPercent / 2) * Math.sin(angleRad);

            return {
                ...p,
                x,
                y,
                angleDeg,
                estimatedMeters: Math.round(Math.pow(10, (-40 - rssi) / (10 * 2.2)))
            };
        });
    }, [nearbyPeers]);

    if (scanning) {
        return (
            <div className="scanner-viewfinder-overlay" style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "calc(20px + var(--safe-top, 0px)) 16px calc(24px + var(--safe-bottom, 0px)) 16px" }}>
                {/* Elemento de video WebCam si la sesión de cámara web está activa */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        zIndex: -1,
                        background: "#000"
                    }}
                />

                <div style={{
                    padding: "14px 20px",
                    borderRadius: "16px",
                    background: "rgba(6, 12, 20, 0.92)",
                    border: "1.5px solid #00E676",
                    color: "#FFFFFF",
                    textAlign: "center",
                    boxShadow: "0 4px 25px rgba(0, 230, 118, 0.35)",
                    maxWidth: "340px",
                    width: "90%",
                    zIndex: 2
                }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#00E676", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        <span>🤝</span> {t('radar.scanner_title')}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)", marginTop: "4px", lineHeight: 1.3 }}>
                        {t('radar.scanner_desc')}
                    </div>
                </div>

                <div className="scanner-target-box" style={{ borderColor: "#00E676", boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 24px rgba(0, 230, 118, 0.45)", zIndex: 2 }}>
                    <div className="scanner-laser-line" style={{ background: "linear-gradient(90deg, transparent, #00E676, #00E5FF, transparent)", boxShadow: "0 0 12px #00E676" }} />
                </div>

                <div style={{ display: "flex", gap: "12px", zIndex: 2, flexWrap: "wrap", justifyContent: "center" }}>
                    <label
                        style={{
                            padding: "14px 22px",
                            fontSize: "0.9rem",
                            fontWeight: 800,
                            background: "rgba(0, 229, 255, 0.18)",
                            color: "#00E5FF",
                            border: "1.5px solid rgba(0, 229, 255, 0.5)",
                            borderRadius: "12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            boxShadow: "0 4px 20px rgba(0, 229, 255, 0.25)"
                        }}
                    >
                        <span>📁</span> Subir Imagen QR
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFile}
                            style={{ display: "none" }}
                        />
                    </label>

                    <button
                        onClick={stopScan}
                        style={{
                            padding: "14px 30px",
                            fontSize: "0.95rem",
                            fontWeight: 900,
                            background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                            color: "#FFFFFF",
                            border: "none",
                            boxShadow: "0 4px 25px rgba(232,33,58,0.5)",
                            borderRadius: "12px",
                            cursor: "pointer"
                        }}
                    >
                        {t('radar.cancel_scan')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="radar-window" style={{
            width: "100%", height: "100%",
            background: scanning ? "transparent" : "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Viewfinder Overlay de Escaneo Táctico de QR */}
            {scanning && (
                <div className="scanner-viewfinder-overlay" style={{
                    position: "fixed", inset: 0, zIndex: 99999,
                    background: "rgba(0,0,0,0.5)",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "space-between",
                    padding: "calc(var(--safe-top, 20px) + 20px) 20px calc(var(--safe-bottom, 20px) + 20px)",
                    pointerEvents: "auto"
                }}>
                    <div style={{
                        padding: "12px 20px", borderRadius: "16px",
                        background: "rgba(6, 10, 24, 0.92)",
                        border: "1.5px solid var(--accent-cyan)",
                        color: "#FFFFFF", textAlign: "center",
                        boxShadow: "0 0 20px rgba(0,229,255,0.3)",
                        maxWidth: "340px", width: "90%"
                    }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "var(--accent-cyan)" }}>
                            📷 ESCÁNER TÁCTICO QR
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)", marginTop: "4px" }}>
                            Apunta al código QR de identidad del nodo par
                        </div>
                    </div>

                    <div className="scanner-target-box" style={{
                        width: "260px", height: "260px",
                        border: "2px solid var(--accent-emerald)",
                        borderRadius: "24px",
                        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.82), 0 0 24px rgba(0, 230, 118, 0.4)",
                        position: "relative", overflow: "hidden",
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            style={{
                                width: "100%", height: "100%",
                                objectFit: "cover",
                                display: webCamStreamRef.current ? "block" : "none"
                            }}
                        />
                        <div className="scanner-laser-line" style={{
                            width: "100%", height: "2px",
                            background: "linear-gradient(90deg, transparent, #00E676, #00E5FF, transparent)",
                            boxShadow: "0 0 12px #00E676",
                            position: "absolute", top: 0,
                            animation: "scanLaser 2s infinite ease-in-out"
                        }} />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "90%", maxWidth: "340px" }}>
                        <button
                            onClick={stopScan}
                            style={{
                                width: "100%", padding: "14px",
                                background: "rgba(232, 33, 58, 0.85)",
                                border: "1px solid #FF3355",
                                borderRadius: "14px", color: "#FFFFFF",
                                fontWeight: 900, fontSize: "0.9rem",
                                cursor: "pointer", boxShadow: "0 0 16px rgba(232,33,58,0.4)"
                            }}
                        >
                            ✕ CANCELAR ESCANEO
                        </button>
                    </div>
                </div>
            )}
            {/* Header Táctico C4ISR */}
            <header style={{
                padding: "calc(8px + var(--safe-top, 0px)) 16px 8px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1.5px solid rgba(0, 229, 255, 0.3)",
                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: "12px",
                        background: "linear-gradient(135deg, rgba(0, 230, 118, 0.2) 0%, rgba(0, 229, 255, 0.15) 100%)",
                        border: "1px solid rgba(0, 230, 118, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.3rem", boxShadow: "0 0 15px rgba(0,230,118,0.25)"
                    }}>📡</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, letterSpacing: "0.4px", color: "#FFFFFF" }}>
                            {t('radar.title') || "RADAR TÁCTICO P2P"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-emerald, #00E676)", fontWeight: 800 }}>
                            {t('radar.subtitle') || "DESCUBRIMIENTO BLE / LORA / WIFI"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => navigate("nodemap")}
                        style={{
                            padding: "6px 12px", fontSize: "0.78rem", fontWeight: 800,
                            background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.35)",
                            borderRadius: "10px", color: "var(--accent-cyan, #00E5FF)", cursor: "pointer"
                        }}
                    >
                        🗺️ MAPA
                    </button>
                    <button
                        onClick={goBack}
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#FFFFFF", cursor: "pointer", fontWeight: 900, fontSize: "0.9rem"
                        }}
                        title={t('common.close')}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas */}
            <div style={{
                padding: "8px 16px",
                display: "flex", gap: "6px",
                background: "rgba(8, 10, 20, 0.95)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                overflowX: "auto", flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("radar")}
                    style={{
                        padding: "8px 16px", fontSize: "0.78rem", fontWeight: 900, borderRadius: "12px",
                        background: activeTab === "radar" ? "linear-gradient(135deg, rgba(0, 230, 118, 0.25) 0%, rgba(0, 180, 80, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "radar" ? "1.5px solid #00E676" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "radar" ? "#00E676" : "var(--text-secondary)",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                        boxShadow: activeTab === "radar" ? "0 0 15px rgba(0, 230, 118, 0.25)" : "none"
                    }}
                >
                    <span>📡</span> {t('radar.tab_ble') || "RADAR EN VIVO"} ({nearbyPeers.length})
                </button>
                <button
                    onClick={() => setActiveTab("qr")}
                    style={{
                        padding: "8px 16px", fontSize: "0.78rem", fontWeight: 900, borderRadius: "12px",
                        background: activeTab === "qr" ? "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(0, 150, 255, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "qr" ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "qr" ? "#00E5FF" : "var(--text-secondary)",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                        boxShadow: activeTab === "qr" ? "0 0 15px rgba(0, 229, 255, 0.25)" : "none"
                    }}
                >
                    <span>🪪</span> {t('radar.tab_qr') || "MI QR TÁCTICO"}
                </button>
                <button
                    onClick={() => setActiveTab("manual")}
                    style={{
                        padding: "8px 16px", fontSize: "0.78rem", fontWeight: 900, borderRadius: "12px",
                        background: activeTab === "manual" ? "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(200, 30, 60, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "manual" ? "1.5px solid #FF3355" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "manual" ? "#FF3355" : "var(--text-secondary)",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                        boxShadow: activeTab === "manual" ? "0 0 15px rgba(255, 51, 85, 0.25)" : "none"
                    }}
                >
                    <span>➕</span> {t('radar.tab_manual') || "MANUAL / CÁMARA"}
                </button>
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ─── TAB 1: RADAR 360° POLAR SCOPE ─────────────────────── */}
                    {activeTab === "radar" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 230, 118, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 230, 118, 0.15)"
                        }}>
                            {/* Visual Polar Scope (Canvas Simulator) */}
                            <div style={{
                                position: "relative", width: "260px", height: "260px", margin: "0 auto",
                                borderRadius: "50%",
                                background: "radial-gradient(circle, rgba(0, 230, 118, 0.12) 0%, rgba(4, 8, 16, 0.95) 75%)",
                                border: "2px solid rgba(0, 230, 118, 0.4)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: "0 0 35px rgba(0, 230, 118, 0.2), inset 0 0 25px rgba(0, 230, 118, 0.15)",
                                overflow: "hidden"
                            }}>
                                {/* Retículas y Cuadrícula Polar */}
                                <div style={{ position: "absolute", width: "100%", height: "1px", background: "rgba(0, 230, 118, 0.25)" }} />
                                <div style={{ position: "absolute", width: "1px", height: "100%", background: "rgba(0, 230, 118, 0.25)" }} />
                                <div style={{ position: "absolute", width: "200px", height: "200px", borderRadius: "50%", border: "1px dashed rgba(0, 230, 118, 0.2)" }} />
                                <div style={{ position: "absolute", width: "130px", height: "130px", borderRadius: "50%", border: "1px dashed rgba(0, 230, 118, 0.25)" }} />
                                <div style={{ position: "absolute", width: "65px", height: "65px", borderRadius: "50%", border: "1px dashed rgba(0, 230, 118, 0.3)" }} />

                                {/* Indicadores de Coordenadas */}
                                <span style={{ position: "absolute", top: "6px", fontSize: "9px", color: "rgba(0,230,118,0.7)", fontWeight: 900 }}>N (0°)</span>
                                <span style={{ position: "absolute", right: "6px", fontSize: "9px", color: "rgba(0,230,118,0.7)", fontWeight: 900 }}>E (90°)</span>
                                <span style={{ position: "absolute", bottom: "6px", fontSize: "9px", color: "rgba(0,230,118,0.7)", fontWeight: 900 }}>S (180°)</span>
                                <span style={{ position: "absolute", left: "6px", fontSize: "9px", color: "rgba(0,230,118,0.7)", fontWeight: 900 }}>W (270°)</span>

                                {/* Haz Giratorio 360° con barrido fosforescente */}
                                <div style={{
                                    position: "absolute", inset: 0, borderRadius: "50%",
                                    background: "conic-gradient(from 0deg, rgba(0, 230, 118, 0.4) 0deg, rgba(0, 230, 118, 0.05) 50deg, transparent 75deg)",
                                    animation: "spin 3.5s linear infinite"
                                }} />

                                {/* Mi Nodo Central */}
                                <div style={{
                                    width: 14, height: 14, borderRadius: "50%",
                                    background: "#00E676", boxShadow: "0 0 16px #00E676",
                                    zIndex: 10, border: "2px solid #FFFFFF"
                                }} />

                                {/* Blips de Pares Detectados */}
                                {polarPeers.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => setSelectedPeer(p)}
                                        style={{
                                            position: "absolute",
                                            left: `${p.x}%`,
                                            top: `${p.y}%`,
                                            transform: "translate(-50%, -50%)",
                                            width: 12, height: 12, borderRadius: "50%",
                                            background: selectedPeer?.id === p.id ? "#00E5FF" : "#00E676",
                                            boxShadow: `0 0 12px ${selectedPeer?.id === p.id ? '#00E5FF' : '#00E676'}`,
                                            cursor: "pointer", zIndex: 15,
                                            animation: "pulse 1.5s infinite"
                                        }}
                                        title={`${p.name} (${p.rssi} dBm)`}
                                    />
                                ))}
                            </div>

                            {/* Cabecera de Lista y Estado de Escaneo */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "12px" }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "#FFFFFF" }}>
                                    NODOS DETECTADOS EN RANGO ({nearbyPeers.length})
                                </div>
                                <button
                                    onClick={handleRefreshNearby}
                                    style={{
                                        padding: "5px 12px", borderRadius: "8px",
                                        background: "rgba(0, 230, 118, 0.12)", border: "1px solid rgba(0, 230, 118, 0.4)",
                                        color: "var(--accent-emerald, #00E676)", fontSize: "0.72rem", fontWeight: 900,
                                        cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"
                                    }}
                                >
                                    🔄 ESCANEAR
                                </button>
                            </div>

                            {/* Lista de Nodos */}
                            {nearbyPeers.length === 0 ? (
                                <div style={{
                                    textAlign: "center", padding: "24px 16px",
                                    background: "rgba(0, 0, 0, 0.3)", borderRadius: "14px",
                                    border: "1px dashed rgba(255, 255, 255, 0.12)"
                                }}>
                                    <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>📡</div>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "#FFFFFF" }}>
                                        Buscando Nodos en Espectro BLE...
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                        Asegúrate de que otros dispositivos tengan RED abierto con Bluetooth activo.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {polarPeers.map(p => (
                                        <div
                                            key={p.id}
                                            style={{
                                                padding: "12px 14px", borderRadius: "12px",
                                                background: selectedPeer?.id === p.id ? "rgba(0, 229, 255, 0.12)" : "rgba(255, 255, 255, 0.03)",
                                                border: selectedPeer?.id === p.id ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.08)",
                                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                                boxShadow: selectedPeer?.id === p.id ? "0 0 15px rgba(0, 229, 255, 0.2)" : "none"
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: "0.88rem", fontWeight: 900, color: "#FFFFFF" }}>{p.name}</div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    DID: {p.id.substring(0, 16)}… · ~{p.estimatedMeters}m
                                                </div>
                                            </div>

                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{
                                                    fontSize: "0.65rem", fontWeight: 900, padding: "2px 8px", borderRadius: "6px",
                                                    background: "rgba(0, 230, 118, 0.15)", color: "#00E676", border: "1px solid rgba(0, 230, 118, 0.3)"
                                                }}>
                                                    {p.rssi} dBm
                                                </span>
                                                <button
                                                    onClick={() => handleAddPeer(p)}
                                                    style={{
                                                        padding: "6px 14px", borderRadius: "8px",
                                                        background: "linear-gradient(135deg, rgba(0, 230, 118, 0.25) 0%, rgba(0, 180, 80, 0.15) 100%)",
                                                        border: "1px solid #00E676", color: "#00E676",
                                                        fontWeight: 900, fontSize: "0.74rem", cursor: "pointer"
                                                    }}
                                                >
                                                    ENLAZAR
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── TAB 2: MI TARJETA QR ───────────────────────────────── */}
                    {activeTab === "qr" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "22px", padding: "24px",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: "18px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 229, 255, 0.15)"
                        }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FFFFFF" }}>
                                    {identity?.nickname || "Operador RED"}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--accent-cyan, #00E5FF)", fontFamily: "JetBrains Mono, monospace", marginTop: "2px" }}>
                                    {identity?.short_id || "OFF-GRID NODE"} · ML-KEM-768
                                </div>
                            </div>

                            <div style={{
                                padding: "16px", background: "#04060A", borderRadius: "20px",
                                border: "2px solid rgba(0, 230, 118, 0.4)", boxShadow: "0 0 35px rgba(0, 230, 118, 0.2)"
                            }}>
                                {qrDataUrl ? (
                                    <img src={qrDataUrl} alt="Mi QR RED" style={{ width: "240px", height: "240px", display: "block", borderRadius: "10px" }} />
                                ) : (
                                    <div style={{ width: "240px", height: "240px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                        Generando QR...
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={startScan}
                                style={{
                                    width: "100%", padding: "14px",
                                    background: "linear-gradient(135deg, #00E676 0%, #00B0FF 100%)",
                                    fontSize: "0.92rem", fontWeight: 900, color: "#FFFFFF",
                                    border: "none", borderRadius: "12px", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                                    boxShadow: "0 0 20px rgba(0, 230, 118, 0.3)"
                                }}
                            >
                                <span>📷</span> {t('radar.scan_scanner_btn') || "ESCANEAR QR DE OTRO OPERADOR"}
                            </button>

                            <div style={{ width: "100%", display: "flex", gap: "8px" }}>
                                <input
                                    readOnly
                                    value={myDid}
                                    style={{
                                        flex: 1, fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace",
                                        background: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(0, 229, 255, 0.25)",
                                        borderRadius: "10px", padding: "10px 12px", color: "#FFFFFF", outline: "none"
                                    }}
                                />
                                <button
                                    onClick={() => copyToClipboard(myDid)}
                                    style={{
                                        padding: "10px 16px", fontSize: "0.78rem", fontWeight: 900,
                                        background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.4)",
                                        borderRadius: "10px", color: "var(--accent-cyan, #00E5FF)", cursor: "pointer"
                                    }}
                                >
                                    COPIAR
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 3: AGREGAR MANUAL & ESCÁNER ────────────────────── */}
                    {activeTab === "manual" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 51, 85, 0.35)", borderRadius: "22px", padding: "22px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                        }}>
                            <button
                                onClick={startScan}
                                style={{
                                    padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
                                    border: "1.5px dashed rgba(0, 230, 118, 0.5)", background: "rgba(0, 230, 118, 0.08)",
                                    borderRadius: "16px", cursor: "pointer"
                                }}
                            >
                                <span style={{ fontSize: "2.4rem" }}>📷</span>
                                <span style={{ fontSize: "1rem", fontWeight: 900, color: "#00E676" }}>{t('radar.scan_scanner_btn') || "ABRIR CÁMARA QR"}</span>
                                <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>{t('radar.manual_desc') || "Escaneo óptico de identidades de pares"}</span>
                            </button>

                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "#FFFFFF" }}>{t('radar.manual_title') || "INGRESO MANUAL DE PAR"}</div>

                                <input
                                    value={manualHash}
                                    onChange={e => setManualHash(e.target.value)}
                                    placeholder="DID o Hash (64 hex)..."
                                    style={{
                                        fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem",
                                        padding: "11px 14px", background: "rgba(0, 0, 0, 0.5)",
                                        border: "1px solid rgba(0, 229, 255, 0.25)", borderRadius: "10px", color: "#FFFFFF"
                                    }}
                                />

                                <input
                                    value={manualName}
                                    onChange={e => setManualName(e.target.value)}
                                    placeholder="Alias o indicativo táctico..."
                                    style={{
                                        fontSize: "0.85rem", padding: "11px 14px",
                                        background: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(255, 255, 255, 0.15)",
                                        borderRadius: "10px", color: "#FFFFFF"
                                    }}
                                />

                                <button
                                    disabled={!manualHash.trim() || isAdding}
                                    onClick={async () => {
                                        const hashToSent = manualHash.trim();
                                        if (
                                            hashToSent.startsWith("RED_PAIR:1:") ||
                                            hashToSent.startsWith("RED_PAIR:2:") ||
                                            hashToSent.startsWith("RED_PAIR:") ||
                                            hashToSent.startsWith("RED_VAULT:1:")
                                        ) {
                                            window.dispatchEvent(new CustomEvent("red:pair_web_companion", { detail: hashToSent }));
                                            setWebPairingCode(hashToSent);
                                            return;
                                        }
                                        setIsAdding(true);
                                        setAddingStatus(t('radar.adding') || "Enlazando...");
                                        const nameToSend = manualName.trim() || "Nuevo Par";
                                        try {
                                            const resolvedHash = await addContact(hashToSent, nameToSend);
                                            toast.success(t('radar.add_success') || "Contacto añadido");
                                            navigate("chat", resolvedHash || hashToSent);
                                        } catch (err) {
                                            const msg = err instanceof Error ? err.message : String(err);
                                            toast.error(`❌ ${msg}`);
                                        } finally {
                                            setIsAdding(false);
                                            setAddingStatus("");
                                        }
                                    }}
                                    style={{
                                        width: "100%", padding: "14px", fontSize: "0.92rem", fontWeight: 900,
                                        background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                                        border: "none", borderRadius: "12px", color: "#FFFFFF", cursor: "pointer",
                                        boxShadow: "0 0 20px rgba(255, 51, 85, 0.3)"
                                    }}
                                >
                                    {isAdding ? addingStatus || t('common.loading') : t('radar.add_btn') || "⚡ ENLAZAR PAR MANUAL"}
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