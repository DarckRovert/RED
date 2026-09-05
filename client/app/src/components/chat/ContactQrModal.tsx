"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../../store/useRedStore";
import { OfflineQrEngine } from "../../lib/qr/OfflineQrEngine";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { toast } from "../Toast";
import { avatarStyle } from "../sidebar/types";

interface ContactQrModalProps {
    isOpen?: boolean;
    onClose: () => void;
    initialTab?: "my_qr" | "scan";
}

export const ContactQrModal: React.FC<ContactQrModalProps> = ({
    isOpen = true,
    onClose,
    initialTab = "my_qr"
}) => {
    const { identity, addContact, navigate } = useRedStore();
    const [activeTab, setActiveTab] = useState<"my_qr" | "scan">(initialTab);
    const [qrDataUrl, setQrDataUrl] = useState<string>("");
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [isScanningNative, setIsScanningNative] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [isProcessingCode, setIsProcessingCode] = useState(false);
    const shouldScanRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync initial tab when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // Generate my QR code data URL
    useEffect(() => {
        if (!isOpen || !identity?.identity_hash) return;
        const payload = JSON.stringify({
            type: "identity",
            did: `did:red:${identity.identity_hash}`,
            hash: identity.identity_hash,
            name: identity.nickname || "Familiar RED",
            pk: identity.public_key || ""
        });

        OfflineQrEngine.generateDataUrl(payload, {
            width: 280,
            margin: 2,
            darkColor: "#111B21",
            lightColor: "#FFFFFF"
        }).then(setQrDataUrl).catch(err => {
            console.warn("[ContactQrModal] Error generating QR:", err);
        });
    }, [isOpen, identity]);

    // Stop camera and restore webview background
    const stopCamera = async () => {
        shouldScanRef.current = false;
        setIsScanningNative(false);
        if (typeof document !== "undefined") {
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

    // Cleanup camera when closing or switching tabs
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    useEffect(() => {
        if (!isOpen || activeTab !== "scan") {
            stopCamera();
        } else if (isOpen && activeTab === "scan") {
            startScan();
        }
    }, [isOpen, activeTab]);

    // Process a detected QR code string
    const handleCodeDetected = async (rawCode: string) => {
        if (isProcessingCode) return;
        setIsProcessingCode(true);

        try {
            if (typeof navigator !== "undefined" && navigator.vibrate) {
                try { navigator.vibrate([40, 60, 40]); } catch {}
            }

            let targetHash = "";
            let targetName = "";
            let targetPk = "";

            const trimmed = rawCode.trim();

            // Case A: JSON payload
            if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                try {
                    const parsed = JSON.parse(trimmed);
                    targetHash = parsed.hash || parsed.peerHash || (parsed.did ? parsed.did.replace(/^did:red:/i, "") : "");
                    targetName = parsed.name || parsed.nickname || "";
                    targetPk = parsed.pk || parsed.publicKey || "";
                } catch {}
            }

            // Case B: did:red:<hash>
            if (!targetHash && trimmed.toLowerCase().startsWith("did:red:")) {
                targetHash = trimmed.replace(/^did:red:/i, "").trim();
            }

            // Case C: Web Companion pair code
            if (trimmed.startsWith("RED_PAIR:1:")) {
                await stopCamera();
                onClose();
                navigate("webCompanionLink");
                return;
            }

            // Case D: Raw Hex hash
            if (!targetHash && /^[0-9a-fA-F]{16,64}$/.test(trimmed)) {
                targetHash = trimmed.toLowerCase();
            }

            if (!targetHash) {
                toast.warning("Código QR no reconocido como contacto de RED.");
                setIsProcessingCode(false);
                return;
            }

            // Add contact to store
            const finalName = targetName || `Contacto ${targetHash.substring(0, 8)}`;
            await addContact(targetHash, finalName, targetPk || undefined);

            // Announce handshake over mesh
            try {
                const payload = new TextEncoder().encode(JSON.stringify({
                    type: "contact_request",
                    sender_hash: identity?.identity_hash,
                    sender_name: identity?.nickname || "Familiar",
                    sender_pk: identity?.public_key,
                    timestamp: Date.now()
                }));
                meshRouter.broadcast(payload);
            } catch {}

            await stopCamera();
            toast.success(`✅ Conectado con ${finalName}`);
            onClose();
            navigate("chat", targetHash);
        } catch (err: any) {
            console.error("[ContactQrModal] Error processing code:", err);
            toast.error("Error al procesar el código QR");
        } finally {
            setIsProcessingCode(false);
        }
    };

    const startScan = async () => {
        setScanError(null);
        shouldScanRef.current = true;

        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
                const perm = await BarcodeScanner.checkPermission({ force: true });
                
                if (!shouldScanRef.current) {
                    await stopCamera();
                    return;
                }

                if (perm.denied || !perm.granted) {
                    setScanError("Permiso de cámara no concedido. Habilita el acceso en los ajustes de tu teléfono.");
                    return;
                }

                await BarcodeScanner.hideBackground();
                if (!shouldScanRef.current) {
                    await stopCamera();
                    return;
                }

                if (typeof document !== "undefined") {
                    document.body.classList.add("scanner-active");
                }
                setIsScanningNative(true);

                const result = await BarcodeScanner.startScan();
                if (!shouldScanRef.current) {
                    await stopCamera();
                    return;
                }

                if (result.hasContent && result.content) {
                    await handleCodeDetected(result.content);
                }
            } else {
                // Non-native fallback (browser)
                setIsScanningNative(false);
            }
        } catch (err: any) {
            console.warn("[ContactQrModal] Native camera error:", err);
            await stopCamera();
            setScanError("No se pudo iniciar la cámara en este dispositivo. Puedes usar una foto del código QR.");
        }
    };

    const toggleTorch = async () => {
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
                if (isTorchOn) {
                    await BarcodeScanner.disableTorch();
                    setIsTorchOn(false);
                } else {
                    await BarcodeScanner.enableTorch();
                    setIsTorchOn(true);
                }
            }
        } catch {}
    };

    const handleShare = async () => {
        if (!identity?.identity_hash) return;
        const shareText = `did:red:${identity.identity_hash}`;
        if (typeof navigator !== "undefined" && navigator.share) {
            try {
                await navigator.share({
                    title: `Mi contacto en RED (${identity.nickname || "Familiar"})`,
                    text: `Añádeme a tus contactos de RED: ${shareText}`
                });
                return;
            } catch {}
        }
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            await navigator.clipboard.writeText(shareText);
            toast.success("📋 Código copiado al portapapeles");
        }
    };

    // Parse QR from image file
    const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";

        toast.info("Analizando imagen...");
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
                                    handleCodeDetected(barcodes[0].rawValue);
                                    return;
                                }
                            } catch {}
                        }

                        toast.warning("No se detectó un código QR legible en esta imagen. Intenta con un enfoque más nítido.");
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

    if (!isOpen) return null;

    return (
        <div
            className={isScanningNative ? "contact-qr-scanner-overlay" : ""}
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: isScanningNative ? "transparent" : "rgba(0, 0, 0, 0.85)",
                backdropFilter: isScanningNative ? "none" : "blur(14px)",
                WebkitBackdropFilter: isScanningNative ? "none" : "blur(14px)",
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
                animation: "fadeIn 0.15s ease-out"
            }}
            onClick={e => {
                if (e.target === e.currentTarget && !isScanningNative) {
                    stopCamera();
                    onClose();
                }
            }}
        >
            {/* Top Navigation Header */}
            <header style={{
                height: "60px",
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: isScanningNative ? "rgba(0,0,0,0.6)" : "#202C33",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                zIndex: 10001,
                flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                        onClick={() => {
                            stopCamera();
                            onClose();
                        }}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#E9EDEF",
                            fontSize: "1.3rem",
                            cursor: "pointer",
                            padding: "4px 8px"
                        }}
                        title="Cerrar"
                    >
                        ←
                    </button>
                    <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#E9EDEF" }}>
                        Código QR
                    </span>
                </div>

                {activeTab === "scan" && isScanningNative && (
                    <button
                        onClick={toggleTorch}
                        style={{
                            background: isTorchOn ? "#00A884" : "rgba(255, 255, 255, 0.15)",
                            border: "none",
                            borderRadius: "50%",
                            width: "38px",
                            height: "38px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#FFFFFF",
                            fontSize: "1.1rem",
                            cursor: "pointer"
                        }}
                        title="Linterna"
                    >
                        {isTorchOn ? "🔦" : "💡"}
                    </button>
                )}
            </header>

            {/* WhatsApp Tab Selector: "Mi código" | "Escanear código" */}
            <div style={{
                display: "flex",
                height: "48px",
                background: isScanningNative ? "rgba(0,0,0,0.6)" : "#111B21",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                zIndex: 10001,
                flexShrink: 0
            }}>
                <button
                    onClick={() => {
                        stopCamera();
                        setActiveTab("my_qr");
                    }}
                    style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        borderBottom: activeTab === "my_qr" ? "3px solid #00A884" : "3px solid transparent",
                        color: activeTab === "my_qr" ? "#00A884" : "#8696A0",
                        fontSize: "0.92rem",
                        fontWeight: activeTab === "my_qr" ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                    }}
                >
                    Mi código
                </button>
                <button
                    onClick={() => {
                        setActiveTab("scan");
                    }}
                    style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        borderBottom: activeTab === "scan" ? "3px solid #00A884" : "3px solid transparent",
                        color: activeTab === "scan" ? "#00A884" : "#8696A0",
                        fontSize: "0.92rem",
                        fontWeight: activeTab === "scan" ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                    }}
                >
                    Escanear código
                </button>
            </div>

            {/* Hidden image picker for QR photos */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImageFile}
            />

            {/* Tab 1: Mi código QR */}
            {activeTab === "my_qr" && (
                <div style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px 20px",
                    overflowY: "auto"
                }}>
                    <div style={{
                        maxWidth: "340px",
                        width: "100%",
                        background: "#182229",
                        borderRadius: "24px",
                        padding: "28px 20px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        gap: "16px"
                    }}>
                        {/* Avatar */}
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.6rem",
                            fontWeight: 700,
                            color: "#FFFFFF",
                            ...avatarStyle(identity?.identity_hash || "me"),
                            boxShadow: "0 4px 14px rgba(0,0,0,0.4)"
                        }}>
                            {(identity?.nickname || "O").charAt(0).toUpperCase()}
                        </div>

                        {/* Name & Handle */}
                        <div>
                            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#E9EDEF" }}>
                                {identity?.nickname || "Mi Perfil RED"}
                            </div>
                            <div style={{ fontSize: "0.76rem", color: "#00A884", marginTop: "2px", fontWeight: 600 }}>
                                Contacto de RED P2P
                            </div>
                        </div>

                        {/* White QR Box */}
                        <div style={{
                            background: "#FFFFFF",
                            padding: "16px",
                            borderRadius: "20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
                        }}>
                            {qrDataUrl ? (
                                <img
                                    src={qrDataUrl}
                                    alt="Mi código QR"
                                    style={{ width: 220, height: 220, display: "block" }}
                                />
                            ) : (
                                <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "0.85rem" }}>
                                    Generando código seguro...
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div style={{ fontSize: "0.78rem", color: "#8696A0", lineHeight: 1.45, maxWidth: "280px" }}>
                            Tu código QR es privado. Si lo compartes con alguien, podrá escanearlo con la cámara de RED para chatear contigo sin necesidad de Internet.
                        </div>

                        {/* Share Button */}
                        <button
                            onClick={handleShare}
                            style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: "24px",
                                background: "#00A884",
                                color: "#FFFFFF",
                                border: "none",
                                fontSize: "0.9rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                                boxShadow: "0 4px 14px rgba(0, 168, 132, 0.4)",
                                transition: "background 0.15s ease"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "#02906f"}
                            onMouseLeave={e => e.currentTarget.style.background = "#00A884"}
                        >
                            <span>📤</span> Compartir código
                        </button>
                    </div>
                </div>
            )}

            {/* Tab 2: Escanear código QR */}
            {activeTab === "scan" && (
                <div style={{
                    flex: 1,
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center"
                }}>
                    {isScanningNative ? (
                        /* Native Camera Overlay Frame */
                        <div style={{
                            position: "relative",
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            pointerEvents: "none"
                        }}>
                            {/* Scanning Target Frame */}
                            <div style={{
                                width: "260px",
                                height: "260px",
                                position: "relative",
                                border: "2px solid rgba(0, 168, 132, 0.4)",
                                borderRadius: "24px",
                                boxShadow: "0 0 0 4000px rgba(0, 0, 0, 0.55)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}>
                                {/* Corner Accents (WhatsApp style) */}
                                <div style={{ position: "absolute", top: -2, left: -2, width: 28, height: 28, borderTop: "4px solid #00A884", borderLeft: "4px solid #00A884", borderTopLeftRadius: "16px" }} />
                                <div style={{ position: "absolute", top: -2, right: -2, width: 28, height: 28, borderTop: "4px solid #00A884", borderRight: "4px solid #00A884", borderTopRightRadius: "16px" }} />
                                <div style={{ position: "absolute", bottom: -2, left: -2, width: 28, height: 28, borderBottom: "4px solid #00A884", borderLeft: "4px solid #00A884", borderBottomLeftRadius: "16px" }} />
                                <div style={{ position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderBottom: "4px solid #00A884", borderRight: "4px solid #00A884", borderBottomRightRadius: "16px" }} />

                                {/* Moving Scan Line */}
                                <div style={{
                                    width: "90%",
                                    height: "2px",
                                    background: "linear-gradient(90deg, transparent, #00A884, transparent)",
                                    boxShadow: "0 0 10px #00A884",
                                    animation: "beaconPulse 2s infinite"
                                }} />
                            </div>

                            <div style={{
                                marginTop: "32px",
                                color: "#FFFFFF",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                textAlign: "center",
                                padding: "8px 18px",
                                background: "rgba(0, 0, 0, 0.6)",
                                borderRadius: "20px"
                            }}>
                                Apunta la cámara al código QR de tu contacto
                            </div>

                            {/* Bottom floating button to pick photo from gallery */}
                            <div style={{ position: "absolute", bottom: "32px", pointerEvents: "auto" }}>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        padding: "10px 20px",
                                        background: "rgba(255, 255, 255, 0.2)",
                                        backdropFilter: "blur(10px)",
                                        border: "1px solid rgba(255, 255, 255, 0.3)",
                                        borderRadius: "24px",
                                        color: "#FFFFFF",
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px"
                                    }}
                                >
                                    <span>🖼️</span> Subir desde fotos
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Web / Fallback Mode (No native Capacitor barcode scanner) */
                        <div style={{
                            maxWidth: "340px",
                            width: "100%",
                            background: "#182229",
                            borderRadius: "24px",
                            padding: "28px 20px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textAlign: "center",
                            gap: "16px",
                            border: "1px solid rgba(255, 255, 255, 0.08)"
                        }}>
                            <div style={{
                                width: 64,
                                height: 64,
                                borderRadius: "50%",
                                background: "rgba(0, 168, 132, 0.15)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "2rem",
                                color: "#00A884"
                            }}>
                                📷
                            </div>

                            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#E9EDEF" }}>
                                Escanear código de contacto
                            </div>

                            <div style={{ fontSize: "0.82rem", color: "#8696A0", lineHeight: 1.45 }}>
                                {scanError || "Sube una imagen o captura del código QR de tu contacto para enlazar automáticamente."}
                            </div>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    borderRadius: "24px",
                                    background: "#00A884",
                                    color: "#FFFFFF",
                                    border: "none",
                                    fontSize: "0.9rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px"
                                }}
                            >
                                <span>🖼️</span> Seleccionar foto del QR
                            </button>

                            <button
                                onClick={async () => {
                                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                                        try {
                                            const text = await navigator.clipboard.readText();
                                            if (text) {
                                                handleCodeDetected(text);
                                                return;
                                            }
                                        } catch {}
                                    }
                                    toast.info("Copia el código DID o escanea una foto.");
                                }}
                                style={{
                                    width: "100%",
                                    padding: "10px",
                                    borderRadius: "24px",
                                    background: "transparent",
                                    color: "#00A884",
                                    border: "1px solid rgba(0, 168, 132, 0.3)",
                                    fontSize: "0.82rem",
                                    fontWeight: 600,
                                    cursor: "pointer"
                                }}
                            >
                                📋 Pegar código del portapapeles
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
export default ContactQrModal;
