"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { companionSyncEngine, ActiveCompanionSession } from "../../lib/mesh/companionSyncEngine";
import { WebCompanionPairConfirmationModal } from "../WebCompanionPairConfirmationModal";
import { toast } from "../Toast";
import { useTranslation } from "../../lib/i18n/i18nEngine";

interface LinkedDevicesViewProps {
    onClose?: () => void;
    hideHeader?: boolean;
}

export const LinkedDevicesView: React.FC<LinkedDevicesViewProps> = ({ onClose, hideHeader = false }) => {
    const { t } = useTranslation();
    const [activeSession, setActiveSession] = useState<ActiveCompanionSession | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isScanningNative, setIsScanningNative] = useState(false);
    const [isWebCamActive, setIsWebCamActive] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [pendingWebPairingCode, setPendingWebPairingCode] = useState<string | null>(null);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [showAirGapSection, setShowAirGapSection] = useState(false);
    const [airGapExportToken, setAirGapExportToken] = useState<string | null>(null);

    const shouldScanRef = useRef(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const webCamStreamRef = useRef<MediaStream | null>(null);
    const webCamRafRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Cargar estado de sesión vinculada activa
    const refreshActiveSession = useCallback(() => {
        try {
            const current = companionSyncEngine.getActiveSession();
            if (current) {
                setActiveSession(current);
                return;
            }
            if (typeof window !== "undefined") {
                const raw = localStorage.getItem("red_companion_active_session");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    setActiveSession(parsed);
                } else {
                    setActiveSession(null);
                }
            }
        } catch {
            setActiveSession(null);
        }
    }, []);

    useEffect(() => {
        refreshActiveSession();
    }, [refreshActiveSession]);

    // Cerrar sesión activa
    const handleCloseSession = async () => {
        try {
            companionSyncEngine.closeSession();
            if (typeof window !== "undefined") {
                localStorage.removeItem("red_companion_active_session");
            }
            setActiveSession(null);
            toast.success("✅ Sesión cerrada en la computadora vinculada.");
        } catch {
            toast.error("Error al cerrar la sesión vinculada.");
        }
    };

    // Detener cámara web
    const stopWebCam = useCallback(() => {
        if (webCamRafRef.current != null) {
            cancelAnimationFrame(webCamRafRef.current);
            webCamRafRef.current = null;
        }
        if (webCamStreamRef.current) {
            webCamStreamRef.current.getTracks().forEach((t) => t.stop());
            webCamStreamRef.current = null;
        }
        setIsWebCamActive(false);
    }, []);

    // Detener cámara completamente (nativa + web)
    const stopCamera = useCallback(async () => {
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
                if (isTorchOn) {
                    await BarcodeScanner.disableTorch().catch(() => {});
                    setIsTorchOn(false);
                }
                await BarcodeScanner.showBackground().catch(() => {});
                await BarcodeScanner.stopScan().catch(() => {});
            }
        } catch {}
        setIsScanning(false);
    }, [stopWebCam, isTorchOn]);

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    // Procesar código QR detectado
    const handleCodeDetected = async (rawCode: string) => {
        const trimmed = rawCode.trim();
        if (!trimmed) return;

        if (typeof navigator !== "undefined" && navigator.vibrate) {
            try { navigator.vibrate([60, 40, 60]); } catch {}
        }

        // Si es un token de vinculación válido (Online WAN o Offline P2P o Cápsula Air-Gap)
        if (
            trimmed.startsWith("RED_PAIR:1:") ||
            trimmed.startsWith("RED_PAIR:2:") ||
            trimmed.startsWith("RED_PAIR:") ||
            trimmed.startsWith("RED_VAULT:1:")
        ) {
            await stopCamera();
            setPendingWebPairingCode(trimmed);
            return;
        }

        // Si el usuario por error escaneó un contacto
        if (trimmed.startsWith("did:red:") || trimmed.startsWith("{")) {
            toast.info("Este es un código de contacto, no de vinculación web.");
            return;
        }

        toast.warning("Código QR no reconocido como sesión de RED Web.");
    };

    // Iniciar escaneo con cámara web (navegador / desktop / fallback)
    const startWebCamScan = useCallback(async () => {
        setScanError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
            });
            webCamStreamRef.current = stream;
            setIsWebCamActive(true);

            await new Promise<void>((resolve) => {
                const check = () => (videoRef.current ? resolve() : requestAnimationFrame(check));
                check();
            });

            const video = videoRef.current!;
            video.srcObject = stream;
            await video.play();

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
                    } catch {}
                }
                webCamRafRef.current = requestAnimationFrame(tick);
            };
            webCamRafRef.current = requestAnimationFrame(tick);
        } catch (err: any) {
            stopWebCam();
            setScanError("No se pudo iniciar la cámara web. Puedes subir una captura del QR.");
        }
    }, [stopWebCam]);

    // Iniciar escáner principal
    const handleStartScanner = async () => {
        setScanError(null);
        shouldScanRef.current = true;
        setIsScanning(true);

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
                    setScanError("Permiso de cámara no otorgado. Actívalo en los ajustes de tu teléfono.");
                    setIsScanning(false);
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
                if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
                    await startWebCamScan();
                } else {
                    setScanError("Cámara no disponible en este entorno. Puedes subir una foto del código QR.");
                }
            }
        } catch (err: any) {
            console.warn("[LinkedDevicesView] Native camera error:", err);
            await stopCamera();
            if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
                shouldScanRef.current = true;
                setIsScanning(true);
                await startWebCamScan();
            } else {
                setScanError("No se pudo iniciar la cámara en este dispositivo.");
                setIsScanning(false);
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

    // Procesar foto de QR desde almacenamiento local
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            await new Promise((resolve) => (img.onload = resolve));

            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas context null");
            ctx.drawImage(img, 0, 0);

            let detectedText = "";
            if ("BarcodeDetector" in window) {
                const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
                const codes = await detector.detect(canvas);
                if (codes.length > 0 && codes[0].rawValue) {
                    detectedText = codes[0].rawValue;
                }
            }

            if (!detectedText) {
                try {
                    const { BrowserQRCodeReader } = await import("@zxing/library");
                    const zxing = new BrowserQRCodeReader();
                    const zRes = await zxing.decodeFromImageElement(img);
                    if (zRes && zRes.getText()) {
                        detectedText = zRes.getText();
                    }
                } catch {}
            }

            if (detectedText) {
                await handleCodeDetected(detectedText);
            } else {
                toast.warning("No se detectó ningún código QR en la imagen seleccionada.");
            }
        } catch (err: any) {
            toast.error("Error al procesar la foto: " + (err?.message || ""));
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // ── VISTA DE CÁMARA ACTIVA (ESCANEANDO LA PANTALLA DE LA PC) ─────────────
    if (isScanning) {
        return (
            <div className="scanner-viewfinder-overlay" style={{ zIndex: 100000 }}>
                {/* Header Táctico Superior */}
                <div style={{
                    position: "absolute", top: "24px", left: "16px", right: "16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    zIndex: 10, pointerEvents: "auto"
                }}>
                    <button
                        onClick={stopCamera}
                        style={{
                            width: "44px", height: "44px", borderRadius: "50%",
                            background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.2)",
                            color: "#fff", fontSize: "1.2rem", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                        title="Cancelar escaneo"
                    >
                        ✕
                    </button>

                    <div style={{
                        padding: "8px 16px", borderRadius: "20px",
                        background: "rgba(0,0,0,0.75)", border: "1px solid rgba(0, 168, 132, 0.4)",
                        color: "#E9EDEF", fontSize: "0.85rem", fontWeight: 700,
                        display: "flex", alignItems: "center", gap: "8px"
                    }}>
                        <span>💻</span>
                        <span>Escanear código de RED Web</span>
                    </div>

                    <button
                        onClick={toggleTorch}
                        style={{
                            width: "44px", height: "44px", borderRadius: "50%",
                            background: isTorchOn ? "#00A884" : "rgba(0,0,0,0.65)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "#fff", fontSize: "1.2rem", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                        title="Linterna"
                    >
                        {isTorchOn ? "🔦" : "💡"}
                    </button>
                </div>

                {/* Marco de Escaneo con esquinas verdes estilo WhatsApp */}
                <div style={{
                    width: "260px", height: "260px", position: "relative",
                    borderRadius: "24px", border: "2px solid rgba(0, 168, 132, 0.4)",
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.80), 0 0 30px rgba(0, 168, 132, 0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                    {/* 4 Esquinas Verdes */}
                    <div style={{ position: "absolute", top: -2, left: -2, width: 28, height: 28, borderTop: "4px solid #00A884", borderLeft: "4px solid #00A884", borderTopLeftRadius: "16px" }} />
                    <div style={{ position: "absolute", top: -2, right: -2, width: 28, height: 28, borderTop: "4px solid #00A884", borderRight: "4px solid #00A884", borderTopRightRadius: "16px" }} />
                    <div style={{ position: "absolute", bottom: -2, left: -2, width: 28, height: 28, borderBottom: "4px solid #00A884", borderLeft: "4px solid #00A884", borderBottomLeftRadius: "16px" }} />
                    <div style={{ position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderBottom: "4px solid #00A884", borderRight: "4px solid #00A884", borderBottomRightRadius: "16px" }} />

                    {/* Láser de Escaneo */}
                    <div style={{
                        width: "90%", height: "2px",
                        background: "linear-gradient(90deg, transparent, #00A884, #00E5FF, transparent)",
                        boxShadow: "0 0 12px #00A884",
                        animation: "beaconPulse 2s infinite"
                    }} />
                </div>

                {/* Indicación inferior */}
                <div style={{
                    position: "absolute", bottom: "40px", left: "20px", right: "20px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
                    zIndex: 10, pointerEvents: "auto"
                }}>
                    <div style={{
                        padding: "8px 18px", borderRadius: "16px",
                        background: "rgba(0,0,0,0.75)", color: "#E9EDEF",
                        fontSize: "0.82rem", fontWeight: 600, textAlign: "center"
                    }}>
                        Apunta tu cámara al código QR de la pantalla de tu computadora
                    </div>

                    <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "320px" }}>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                flex: 1, padding: "10px 14px", borderRadius: "20px",
                                background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
                                border: "1px solid rgba(255,255,255,0.25)", color: "#fff",
                                fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                            }}
                        >
                            <span>🖼️</span> Subir foto
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
                                toast.info("Copia el código de emparejamiento primero.");
                            }}
                            style={{
                                flex: 1, padding: "10px 14px", borderRadius: "20px",
                                background: "rgba(0, 168, 132, 0.25)", backdropFilter: "blur(8px)",
                                border: "1px solid #00A884", color: "#00A884",
                                fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                            }}
                        >
                            <span>📋</span> Pegar código
                        </button>
                    </div>
                </div>

                {/* Input invisible para fotos */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                />

                {/* Video tag para modo WebCam fallback */}
                {isWebCamActive && (
                    <video
                        ref={videoRef}
                        muted
                        playsInline
                        style={{
                            position: "absolute", inset: 0, width: "100%", height: "100%",
                            objectFit: "cover", zIndex: -1
                        }}
                    />
                )}
            </div>
        );
    }

    // ── VISTA PRINCIPAL: DISPOSITIVOS VINCULADOS (ESTILO WHATSAPP WEB) ────────
    return (
        <div style={{
            display: "flex", flexDirection: "column", height: "100%", width: "100%",
            background: "#111B21", color: "#E9EDEF", position: "relative"
        }}>
            {/* Header de WhatsApp (oculto si el contenedor padre ya provee cabecera) */}
            {!hideHeader && (
                <header style={{
                    padding: "0 16px", height: "56px",
                    display: "flex", alignItems: "center", gap: "16px",
                    background: "#202C33", borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                    flexShrink: 0
                }}>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                background: "transparent", border: "none",
                                color: "#AEBAC1", fontSize: "1.25rem", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center"
                            }}
                            title="Volver"
                        >
                            ←
                        </button>
                    )}
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#E9EDEF" }}>
                        Dispositivos vinculados
                    </div>
                </header>
            )}

            {/* Contenido con scroll */}
            <div style={{
                flex: 1, overflowY: "auto", padding: "20px 16px 40px 16px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "24px",
                maxWidth: "540px", margin: "0 auto", width: "100%"
            }}>
                {/* Ilustración Gráfica Auténtica WhatsApp Web */}
                <div style={{
                    width: "100%", display: "flex", flexDirection: "column",
                    alignItems: "center", textAlign: "center", gap: "14px",
                    padding: "20px 10px"
                }}>
                    <div style={{
                        width: "100px", height: "100px", borderRadius: "50%",
                        background: "linear-gradient(135deg, rgba(0, 168, 132, 0.15) 0%, rgba(0, 229, 255, 0.1) 100%)",
                        border: "1.5px solid rgba(0, 168, 132, 0.35)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "3rem", boxShadow: "0 8px 30px rgba(0, 168, 132, 0.15)"
                    }}>
                        💻
                    </div>

                    <div>
                        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "#E9EDEF" }}>
                            Usa RED en computadoras y tablets
                        </h2>
                        <p style={{
                            fontSize: "0.85rem", color: "#8696A0", margin: "8px 0 0 0",
                            lineHeight: 1.45, maxWidth: "420px"
                        }}>
                            Sincroniza tus chats y contactos en tiempo real con cifrado punto a punto inviolable (ECDH P-256 + AES-256-GCM) sin depender de servidores centrales.
                        </p>
                    </div>

                    {/* Botón Verde Prominente: Vincular un Dispositivo */}
                    <button
                        onClick={handleStartScanner}
                        style={{
                            marginTop: "8px", padding: "14px 28px", borderRadius: "24px",
                            background: "#00A884", border: "none", color: "#FFFFFF",
                            fontSize: "0.95rem", fontWeight: 700, cursor: "pointer",
                            display: "flex", alignItems: "center", gap: "10px",
                            boxShadow: "0 4px 14px rgba(0, 168, 132, 0.4)",
                            transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#02906f")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#00A884")}
                    >
                        <span>📷</span>
                        <span>Vincular un dispositivo</span>
                    </button>
                </div>

                {/* Mensaje de Seguridad E2E */}
                <div style={{
                    width: "100%", padding: "12px 16px", borderRadius: "12px",
                    background: "#182229", border: "1px solid rgba(255, 255, 255, 0.05)",
                    display: "flex", alignItems: "center", gap: "12px",
                    fontSize: "0.78rem", color: "#8696A0"
                }}>
                    <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>🔒</span>
                    <span>Tus datos personales y mensajes están cifrados de extremo a extremo y nunca tocan la nube sin cifrar.</span>
                </div>

                {/* Sección de Estado del Dispositivo */}
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#8696A0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        ESTADO DEL DISPOSITIVO
                    </div>

                    {activeSession ? (
                        <div style={{
                            width: "100%", padding: "16px", borderRadius: "14px",
                            background: "#182229", border: "1px solid rgba(0, 168, 132, 0.3)",
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                <div style={{
                                    width: "44px", height: "44px", borderRadius: "12px",
                                    background: "rgba(0, 168, 132, 0.15)", border: "1px solid rgba(0, 168, 132, 0.3)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "1.4rem", color: "#00A884", flexShrink: 0
                                }}>
                                    💻
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#E9EDEF" }}>
                                        RED Web (Navegador PC)
                                    </div>
                                    <div style={{ fontSize: "0.76rem", color: "#00A884", fontWeight: 600, marginTop: "2px" }}>
                                        🟢 Sesión vinculada y activa
                                    </div>
                                    <div style={{ fontSize: "0.70rem", color: "#8696A0", marginTop: "1px", fontFamily: "JetBrains Mono, monospace" }}>
                                        ID: {activeSession.sessionId.slice(0, 16)}…
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleCloseSession}
                                style={{
                                    padding: "8px 14px", borderRadius: "18px",
                                    background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)",
                                    color: "#EF4444", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                                    flexShrink: 0
                                }}
                            >
                                Cerrar sesión
                            </button>
                        </div>
                    ) : (
                        <div style={{
                            width: "100%", padding: "16px", borderRadius: "14px",
                            background: "#182229", border: "1px solid rgba(255, 255, 255, 0.05)",
                            display: "flex", alignItems: "center", gap: "12px",
                            color: "#8696A0", fontSize: "0.85rem"
                        }}>
                            <span style={{ fontSize: "1.2rem" }}>ℹ️</span>
                            <span>No hay computadoras ni navegadores vinculados actualmente.</span>
                        </div>
                    )}
                </div>

                {/* Sección Air-Gap Soberana (Para ambientes tácticos sin red) */}
                <div style={{ width: "100%", marginTop: "10px" }}>
                    <button
                        onClick={() => setShowAirGapSection(!showAirGapSection)}
                        style={{
                            background: "transparent", border: "none", color: "#8696A0",
                            fontSize: "0.80rem", fontWeight: 600, cursor: "pointer",
                            display: "flex", alignItems: "center", gap: "6px", padding: "6px 0"
                        }}
                    >
                        <span>{showAirGapSection ? "▼" : "▶"}</span>
                        <span>Opciones avanzadas: Cápsula Soberana Air-Gap (Búnker sin red)</span>
                    </button>

                    {showAirGapSection && (
                        <div style={{
                            marginTop: "8px", padding: "14px", borderRadius: "14px",
                            background: "#182229", border: "1px solid rgba(255, 255, 255, 0.08)",
                            display: "flex", flexDirection: "column", gap: "10px"
                        }}>
                            <p style={{ margin: 0, fontSize: "0.76rem", color: "#8696A0", lineHeight: 1.4 }}>
                                Si tu computadora está en un entorno completamente desconectado sin WiFi ni internet, puedes exportar una cápsula cifrada con tu PIN maestro y pegarla en la PC.
                            </p>
                            <button
                                onClick={async () => {
                                    try {
                                        const { getSecurePin } = await import("../../lib/crypto/BiometricLockEngine");
                                        const masterPin = await getSecurePin("master_pin");
                                        if (!masterPin) {
                                            toast.error("Configura tu PIN maestro primero en Ajustes.");
                                            return;
                                        }
                                        const { useRedStore } = await import("../../store/useRedStore");
                                        const state = useRedStore.getState();
                                        const token = await companionSyncEngine.exportAirGapVaultToken(
                                            {
                                                version: 1,
                                                timestamp: Date.now(),
                                                identity: {
                                                    identity_hash: state.identity?.identity_hash || "",
                                                    short_id: state.identity?.short_id || "",
                                                    nickname: state.identity?.nickname || "Operador RED"
                                                },
                                                masterPin,
                                                contacts: state.contacts?.slice(0, 50) || [],
                                                conversations: state.conversations?.slice(0, 20) || []
                                            },
                                            masterPin
                                        );
                                        setAirGapExportToken(token);
                                        navigator.clipboard.writeText(token);
                                        toast.success("🛡️ Cápsula Air-Gap copiada al portapapeles.");
                                    } catch (e: any) {
                                        toast.error("Error al exportar cápsula: " + (e?.message || ""));
                                    }
                                }}
                                style={{
                                    padding: "10px", borderRadius: "12px",
                                    background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.3)",
                                    color: "var(--accent-cyan)", fontSize: "0.80rem", fontWeight: 700, cursor: "pointer"
                                }}
                            >
                                📋 Generar y Copiar Cápsula Air-Gap
                            </button>
                            {airGapExportToken && (
                                <div style={{
                                    fontSize: "0.70rem", fontFamily: "monospace", color: "#E9EDEF",
                                    background: "#0B0E14", padding: "8px", borderRadius: "8px",
                                    wordBreak: "break-all"
                                }}>
                                    {airGapExportToken.slice(0, 60)}…
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Confirmación de Vinculación (cuando el escáner detecta el QR de la PC) */}
            {pendingWebPairingCode && (
                <WebCompanionPairConfirmationModal
                    qrData={pendingWebPairingCode}
                    onClose={() => {
                        setPendingWebPairingCode(null);
                        refreshActiveSession();
                    }}
                />
            )}
        </div>
    );
};

export default LinkedDevicesView;
