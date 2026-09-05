"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRedStore } from "../../store/useRedStore";
import { OfflineQrEngine } from "../../lib/qr/OfflineQrEngine";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { toast } from "../Toast";
import { avatarStyle } from "../sidebar/types";
import { WebCompanionPairConfirmationModal } from "../WebCompanionPairConfirmationModal";

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
    const { identity, contacts, addContact, navigate } = useRedStore();
    const [activeTab, setActiveTab] = useState<"my_qr" | "scan">(initialTab);
    const [qrDataUrl, setQrDataUrl] = useState<string>("");
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [isScanningNative, setIsScanningNative] = useState(false);
    const [pendingWebPairingCode, setPendingWebPairingCode] = useState<string | null>(null);
    const [detectedContact, setDetectedContact] = useState<{
        hash: string;
        pk?: string;
        name: string;
        alreadyContact: boolean;
    } | null>(null);
    const [isWebCamActive, setIsWebCamActive] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [isProcessingCode, setIsProcessingCode] = useState(false);
    const shouldScanRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const webCamStreamRef = useRef<MediaStream | null>(null);
    const webCamRafRef = useRef<number | null>(null);

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

    // Stop webcam stream
    const stopWebCam = useCallback(() => {
        if (webCamRafRef.current != null) {
            cancelAnimationFrame(webCamRafRef.current);
            webCamRafRef.current = null;
        }
        if (webCamStreamRef.current) {
            webCamStreamRef.current.getTracks().forEach(t => t.stop());
            webCamStreamRef.current = null;
        }
        setIsWebCamActive(false);
    }, []);

    // Stop camera and restore webview background
    const stopCamera = async () => {
        shouldScanRef.current = false;
        setIsScanningNative(false);
        stopWebCam();
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

    // Cleanup camera when closing or switching tabs
    useEffect(() => {
        return () => {
            stopCamera();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

            // Case B: did:red:<hash>:<pk>:<name>
            if (!targetHash && trimmed.toLowerCase().startsWith("did:red:")) {
                const withoutScheme = trimmed.replace(/^did:red:/i, "").trim();
                const parts = withoutScheme.split(":");
                targetHash = parts[0]?.trim() || "";
                if (parts.length >= 2 && parts[1]?.trim() && !targetPk) {
                    targetPk = parts[1].trim();
                }
                if (parts.length >= 3 && parts[2]?.trim() && !targetName) {
                    try {
                        targetName = decodeURIComponent(parts[2].trim());
                    } catch {
                        targetName = parts[2].trim();
                    }
                }
            }

            // Case B.2: RED_ID_VAULT:<base64>
            if (!targetHash && trimmed.startsWith("RED_ID_VAULT:")) {
                try {
                    const encoded = trimmed.split(":")[1];
                    const decoded = JSON.parse(atob(encoded));
                    targetHash = (decoded.did || "").replace(/^did:red:/i, "").trim();
                    if (decoded.pk && !targetPk) targetPk = decoded.pk;
                    if (decoded.name && !targetName) targetName = decoded.name;
                } catch {}
            }

            // Case C: Web Companion pair code (Any variant: RED_PAIR:1:, RED_PAIR:2:, RED_PAIR:, RED_VAULT:1:)
            if (
                trimmed.startsWith("RED_PAIR:1:") ||
                trimmed.startsWith("RED_PAIR:2:") ||
                trimmed.startsWith("RED_PAIR:") ||
                trimmed.startsWith("RED_VAULT:1:")
            ) {
                await stopCamera();
                window.dispatchEvent(new CustomEvent("red:pair_web_companion", { detail: trimmed }));
                setPendingWebPairingCode(trimmed);
                return;
            }

            // Case D: Raw Hex hash
            if (!targetHash && /^[0-9a-fA-F]{16,64}$/.test(trimmed)) {
                targetHash = trimmed.toLowerCase();
            }

            if (!targetHash) {
                toast.warning("Código QR no reconocido como contacto ni sesión Web de RED.");
                setIsProcessingCode(false);
                return;
            }

            await stopCamera();
            const finalName = targetName || `Contacto ${targetHash.substring(0, 8)}`;
            const isAlready = contacts.some((c: any) => c.identity_hash === targetHash || c.short_id === targetHash);
            setDetectedContact({
                hash: targetHash,
                pk: targetPk,
                name: finalName,
                alreadyContact: isAlready
            });
        } catch (err: any) {
            console.error("[ContactQrModal] Error processing code:", err);
            toast.error("Error al procesar el código QR");
        } finally {
            setIsProcessingCode(false);
        }
    };

    /** Confirms and commits the detected contact to the local store and mesh */
    const handleCommitContact = async (openChat = true) => {
        if (!detectedContact) return;
        setIsProcessingCode(true);
        try {
            const { hash, name, pk } = detectedContact;
            await addContact(hash, name, pk || undefined);

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

            toast.success(`✅ Conectado con ${name}`);
            if (openChat) {
                onClose();
                navigate("chat", hash);
            } else {
                setDetectedContact(prev => prev ? { ...prev, alreadyContact: true } : null);
            }
        } catch (err: any) {
            console.error("[ContactQrModal] Error committing contact:", err);
            toast.error("Error al guardar el contacto");
        } finally {
            setIsProcessingCode(false);
        }
    };

    /** Start web-camera scanning using getUserMedia + BarcodeDetector */
    const startWebCamScan = useCallback(async () => {
        setScanError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
            });
            webCamStreamRef.current = stream;
            setIsWebCamActive(true);

            // Wait for video element to mount
            await new Promise<void>(resolve => {
                const check = () => videoRef.current ? resolve() : requestAnimationFrame(check);
                check();
            });

            const video = videoRef.current!;
            video.srcObject = stream;
            await video.play();

            // BarcodeDetector loop with ZXing fallback
            const hasBD = "BarcodeDetector" in window;
            const detector = hasBD ? new (window as any).BarcodeDetector({ formats: ["qr_code"] }) : null;
            let zxingReader: any = null;
            if (!hasBD) {
                try {
                    const { BrowserQRCodeReader } = await import("@zxing/library");
                    zxingReader = new BrowserQRCodeReader();
                } catch {}
            }

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
                                stopWebCam();
                                await handleCodeDetected(codes[0].rawValue);
                                return;
                            }
                        } else if (zxingReader) {
                            try {
                                const zResult = await zxingReader.decodeFromVideoElement(video);
                                if (zResult && zResult.getText()) {
                                    stopWebCam();
                                    await handleCodeDetected(zResult.getText());
                                    return;
                                }
                            } catch {}
                        }
                    } catch { /* BarcodeDetector may throw on empty frame */ }
                }
                webCamRafRef.current = requestAnimationFrame(tick);
            };
            webCamRafRef.current = requestAnimationFrame(tick);
        } catch (err: any) {
            stopWebCam();
            const msg = err?.name === "NotAllowedError"
                ? "Permiso de cámara denegado. Habilítalo en la configuración del navegador."
                : "No se pudo activar la cámara web. Usa la opción de subir imagen."; 
            setScanError(msg);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stopWebCam]);

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
                    document.documentElement.classList.add("scanner-active");
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
                // Web / Desktop: try getUserMedia first
                if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
                    await startWebCamScan();
                } else {
                    setScanError("Cámara web no disponible en este dispositivo.");
                }
            }
        } catch (err: any) {
            console.warn("[ContactQrModal] Native camera error:", err);
            await stopCamera();
            // Native failed — try web camera as final fallback
            if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
                await startWebCamScan();
            } else {
                setScanError("No se pudo iniciar la cámara en este dispositivo. Puedes usar una foto del código QR.");
            }
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

                        // Pure JS / Offline fallback via @zxing/library
                        try {
                            const { BrowserQRCodeReader } = await import("@zxing/library");
                            const zxingReader = new BrowserQRCodeReader();
                            const zResult = await zxingReader.decodeFromImageElement(img);
                            if (zResult && zResult.getText()) {
                                handleCodeDetected(zResult.getText());
                                return;
                            }
                        } catch {}

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
            className={isScanningNative ? "contact-qr-scanner-overlay contact-qr-modal-root" : "contact-qr-modal-root"}
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
                            <span>📤</span> Compartir / Copiar código
                        </button>

                        {/* Copy DID directly */}
                        <button
                            onClick={async () => {
                                if (!identity?.identity_hash) return;
                                const did = `did:red:${identity.identity_hash}`;
                                try {
                                    await navigator.clipboard.writeText(did);
                                    toast.success("📋 DID copiado al portapapeles");
                                } catch {
                                    toast.warning("No se pudo copiar. Usa el botón de compartir.");
                                }
                            }}
                            style={{
                                width: "100%", padding: "11px", borderRadius: "24px",
                                background: "transparent",
                                color: "#E9EDEF",
                                border: "1px solid rgba(255,255,255,0.15)",
                                fontSize: "0.88rem", fontWeight: 600, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                transition: "background 0.15s"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                            <span>📋</span> Copiar mi DID
                        </button>

                        {/* Save QR image as PNG */}
                        {qrDataUrl && (
                            <button
                                onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = qrDataUrl;
                                    link.download = `RED_QR_${(identity?.identity_hash || "me").slice(0, 8)}.png`;
                                    link.click();
                                    toast.success("🖼️ Imagen QR guardada");
                                }}
                                style={{
                                    width: "100%", padding: "11px", borderRadius: "24px",
                                    background: "transparent",
                                    color: "#8696A0",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                    transition: "background 0.15s"
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                                <span>💾</span> Guardar imagen QR
                            </button>
                        )}
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
                    justifyContent: "center",
                    padding: detectedContact ? "20px" : 0
                }}>
                    {detectedContact ? (
                        /* Previsualización de Contacto Detectado (Preview Card Estilo WhatsApp) */
                        <div style={{
                            maxWidth: "360px",
                            width: "100%",
                            background: "#182229",
                            borderRadius: "24px",
                            padding: "28px 24px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textAlign: "center",
                            gap: "16px",
                            border: "1px solid rgba(0, 168, 132, 0.4)",
                            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)"
                        }}>
                            <div style={{
                                width: 80, height: 80, borderRadius: "50%",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "2.2rem", fontWeight: 700, color: "#FFFFFF",
                                ...avatarStyle(detectedContact.hash),
                                boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
                            }}>
                                {detectedContact.name.charAt(0).toUpperCase()}
                            </div>

                            <div>
                                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#E9EDEF" }}>
                                    {detectedContact.name}
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "#00A884", fontFamily: "JetBrains Mono, monospace", marginTop: "4px" }}>
                                    did:red:{detectedContact.hash.substring(0, 18)}…
                                </div>
                                {detectedContact.alreadyContact && (
                                    <span style={{
                                        display: "inline-block", marginTop: "8px",
                                        padding: "3px 10px", borderRadius: "12px",
                                        background: "rgba(0, 168, 132, 0.15)", color: "#00A884",
                                        fontSize: "0.75rem", fontWeight: 600
                                    }}>
                                        ✓ Ya está en tus contactos
                                    </span>
                                )}
                            </div>

                            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                                {!detectedContact.alreadyContact ? (
                                    <button
                                        onClick={() => handleCommitContact(true)}
                                        disabled={isProcessingCode}
                                        style={{
                                            width: "100%", padding: "12px", borderRadius: "24px",
                                            background: "#00A884", color: "#FFFFFF", border: "none",
                                            fontSize: "0.95rem", fontWeight: 700, cursor: "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                            boxShadow: "0 4px 14px rgba(0, 168, 132, 0.35)"
                                        }}
                                    >
                                        <span>➕</span> Añadir y Chatear
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            onClose();
                                            navigate("chat", detectedContact.hash);
                                        }}
                                        style={{
                                            width: "100%", padding: "12px", borderRadius: "24px",
                                            background: "#00A884", color: "#FFFFFF", border: "none",
                                            fontSize: "0.95rem", fontWeight: 700, cursor: "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                            boxShadow: "0 4px 14px rgba(0, 168, 132, 0.35)"
                                        }}
                                    >
                                        <span>💬</span> Abrir conversación
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        setDetectedContact(null);
                                        setIsScanningNative(false);
                                        setIsWebCamActive(false);
                                    }}
                                    style={{
                                        width: "100%", padding: "10px", borderRadius: "24px",
                                        background: "transparent", color: "#8696A0",
                                        border: "1px solid rgba(255, 255, 255, 0.12)",
                                        fontSize: "0.85rem", fontWeight: 600, cursor: "pointer"
                                    }}
                                >
                                    🔄 Escanear otro código
                                </button>
                            </div>
                        </div>
                    ) : isScanningNative ? (
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
                                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.82)",
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
                    ) : isWebCamActive ? (
                        /* Web Camera Live Scan */
                        <div style={{
                            position: "relative", width: "100%", height: "100%",
                            display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            background: "#000"
                        }}>
                            <video
                                ref={videoRef}
                                muted
                                playsInline
                                style={{ width: "100%", maxHeight: "100%", objectFit: "cover" }}
                            />
                            {/* Scan frame overlay */}
                            <div style={{
                                position: "absolute",
                                width: "220px", height: "220px",
                                border: "2px solid rgba(0, 168, 132, 0.6)",
                                borderRadius: "20px",
                                pointerEvents: "none",
                                boxShadow: "0 0 0 4000px rgba(0,0,0,0.45)"
                            }}>
                                <div style={{ position: "absolute", top: -2, left: -2, width: 24, height: 24, borderTop: "4px solid #00A884", borderLeft: "4px solid #00A884", borderTopLeftRadius: "14px" }} />
                                <div style={{ position: "absolute", top: -2, right: -2, width: 24, height: 24, borderTop: "4px solid #00A884", borderRight: "4px solid #00A884", borderTopRightRadius: "14px" }} />
                                <div style={{ position: "absolute", bottom: -2, left: -2, width: 24, height: 24, borderBottom: "4px solid #00A884", borderLeft: "4px solid #00A884", borderBottomLeftRadius: "14px" }} />
                                <div style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderBottom: "4px solid #00A884", borderRight: "4px solid #00A884", borderBottomRightRadius: "14px" }} />
                                <div style={{ position: "absolute", top: "50%", left: "5%", right: "5%", height: "2px", background: "linear-gradient(90deg, transparent, #00A884, transparent)", boxShadow: "0 0 10px #00A884", animation: "beaconPulse 2s infinite", transform: "translateY(-50%)" }} />
                            </div>
                            {/* Stop button */}
                            <button
                                onClick={() => { stopWebCam(); setScanError(null); }}
                                style={{
                                    position: "absolute", bottom: "24px",
                                    padding: "9px 20px",
                                    background: "rgba(255,255,255,0.18)",
                                    backdropFilter: "blur(10px)",
                                    border: "1px solid rgba(255,255,255,0.3)",
                                    borderRadius: "24px",
                                    color: "#FFFFFF",
                                    fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: "6px"
                                }}
                            >
                                ✕ Cerrar cámara
                            </button>
                        </div>
                    ) : (
                        /* Web / Fallback Mode — file picker + manual paste */
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
                                width: 64, height: 64, borderRadius: "50%",
                                background: "rgba(0, 168, 132, 0.15)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "2rem", color: "#00A884"
                            }}>
                                📷
                            </div>

                            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#E9EDEF" }}>
                                Escanear código de contacto
                            </div>

                            <div style={{ fontSize: "0.82rem", color: scanError ? "#FF5555" : "#8696A0", lineHeight: 1.45 }}>
                                {scanError || "Activa la cámara o sube una imagen del código QR de tu contacto."}
                            </div>

                            {/* Primary: activate webcam */}
                            {typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function" && (
                                <button
                                    onClick={startWebCamScan}
                                    style={{
                                        width: "100%", padding: "12px", borderRadius: "24px",
                                        background: "#00A884", color: "#FFFFFF", border: "none",
                                        fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                                    }}
                                >
                                    <span>📷</span> Abrir cámara web
                                </button>
                            )}

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    width: "100%", padding: "12px", borderRadius: "24px",
                                    background: "rgba(255,255,255,0.07)",
                                    color: "#E9EDEF", border: "1px solid rgba(255,255,255,0.15)",
                                    fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                                }}
                            >
                                <span>🖼️</span> Seleccionar foto del QR
                            </button>

                            <button
                                onClick={async () => {
                                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                                        try {
                                            const text = await navigator.clipboard.readText();
                                            if (text) { handleCodeDetected(text); return; }
                                        } catch {}
                                    }
                                    toast.info("Copia el código DID o escanea una foto.");
                                }}
                                style={{
                                    width: "100%", padding: "10px", borderRadius: "24px",
                                    background: "transparent", color: "#00A884",
                                    border: "1px solid rgba(0, 168, 132, 0.3)",
                                    fontSize: "0.82rem", fontWeight: 600, cursor: "pointer"
                                }}
                            >
                                📋 Pegar código del portapapeles
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de confirmación para Web Companion si se escaneó un código de escritorio */}
            {pendingWebPairingCode && (
                <WebCompanionPairConfirmationModal
                    qrData={pendingWebPairingCode}
                    onClose={() => {
                        setPendingWebPairingCode(null);
                        onClose();
                    }}
                />
            )}
        </div>
    );
};
export default ContactQrModal;
