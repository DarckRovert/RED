"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { companionSyncEngine, CompanionSyncPayload, PairingSession } from "../lib/mesh/companionSyncEngine";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

interface WebCompanionLinkModalProps {
    onClose: () => void;
}

type ModalMode = "receive_qr" | "send_scan" | "manual" | "encrypting" | "receiving" | "success" | "error";

export const WebCompanionLinkModal: React.FC<WebCompanionLinkModalProps> = ({ onClose }) => {
    const { identity, contacts, conversations, fetchData } = useRedStore();
    const { t } = useTranslation();

    const [isNativeMobile, setIsNativeMobile] = useState(false);
    const [mode, setMode] = useState<ModalMode>("receive_qr");
    const [statusMessage, setStatusMessage] = useState<string>("Iniciando protocolo de sincronización P2P…");
    const [manualCode, setManualCode] = useState<string>("");

    // QR Session state (for Web/PC receiver)
    const [pairingSession, setPairingSession] = useState<PairingSession | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [isGeneratingQr, setIsGeneratingQr] = useState(false);

    const isScanningRef = useRef(false);

    // Detección inicial de plataforma
    useEffect(() => {
        let isMounted = true;
        import("@capacitor/core").then(({ Capacitor }) => {
            if (isMounted) {
                const native = Capacitor.isNativePlatform();
                setIsNativeMobile(native);
                if (native) {
                    setMode("send_scan");
                } else {
                    setMode("receive_qr");
                }
            }
        }).catch(() => {
            if (isMounted) setMode("receive_qr");
        });

        return () => {
            isMounted = false;
        };
    }, []);

    // ── Iniciar sesión receptora (Generar QR en PC) ───────────────────────────
    useEffect(() => {
        let isMounted = true;
        let sessionCleanup: (() => void) | null = null;

        if (mode === "receive_qr") {
            setIsGeneratingQr(true);
            setStatusMessage("Generando canal E2E ECDH P-256...");

            companionSyncEngine.createWebPairingSession(
                async (payload: CompanionSyncPayload) => {
                    if (!isMounted) return;
                    setMode("receiving");
                    setStatusMessage("¡Bóveda recibida! Importando identidad y contactos...");
                    TacticalAudioEngine.playMessageSent();

                    try {
                        if (typeof window !== "undefined") {
                            if (payload.identity) {
                                localStorage.setItem("user_identity_v1", JSON.stringify(payload.identity));
                            }
                            if (payload.masterPin) {
                                localStorage.setItem("master_pin", payload.masterPin);
                            }
                            if (payload.contacts) {
                                localStorage.setItem("red_contacts_v1", JSON.stringify(payload.contacts));
                            }
                            if (payload.conversations) {
                                localStorage.setItem("red_conversations_v1", JSON.stringify(payload.conversations));
                            }
                        }

                        if (fetchData) await fetchData();
                        toast.success("🎉 ¡Bóveda sincronizada con éxito desde el móvil!");
                        setMode("success");
                        setStatusMessage("Sesión Web vinculada y activa.");

                        setTimeout(() => {
                            if (isMounted) {
                                onClose();
                                window.location.reload();
                            }
                        }, 1800);
                    } catch (e: any) {
                        toast.error("Error al persistir bóveda en navegador");
                    }
                },
                (err: string) => {
                    if (!isMounted) return;
                    console.warn("[WebCompanion] Pairing error:", err);
                    setStatusMessage(err);
                }
            ).then((session) => {
                if (!isMounted) {
                    session.cleanup();
                    return;
                }
                setPairingSession(session);
                sessionCleanup = session.cleanup;

                import("qrcode").then((QRCode) => {
                    QRCode.toDataURL(session.qrPayload, {
                        width: 240,
                        margin: 1,
                        color: { dark: "#00F0FF", light: "#04060A" }
                    }).then((url) => {
                        if (isMounted) {
                            setQrDataUrl(url);
                            setIsGeneratingQr(false);
                            setStatusMessage("Escanea este código con la app RED en tu móvil");
                        }
                    }).catch(() => {
                        if (isMounted) setIsGeneratingQr(false);
                    });
                }).catch(() => {
                    if (isMounted) setIsGeneratingQr(false);
                });
            }).catch((err) => {
                if (isMounted) {
                    setIsGeneratingQr(false);
                    setStatusMessage("Relé ocupado o sin red. Puedes usar entrada manual.");
                }
            });
        }

        return () => {
            isMounted = false;
            if (sessionCleanup) sessionCleanup();
        };
    }, [mode, fetchData, onClose]);

    // ── Control de Cámara para Escaneo en Móvil ──────────────────────────────
    const stopCamera = async () => {
        if (!isScanningRef.current) return;
        isScanningRef.current = false;
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

    const startNativeScan = async () => {
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
                const perm = await BarcodeScanner.checkPermission({ force: true });
                if (perm.denied || !perm.granted) {
                    toast.warning("Permiso de cámara no concedido. Puedes ingresar el código manualmente.");
                    setMode("manual");
                    return;
                }

                await BarcodeScanner.hideBackground();
                document.body.classList.add("scanner-active");
                isScanningRef.current = true;
                setMode("send_scan");

                const result = await BarcodeScanner.startScan();
                if (result.hasContent) {
                    await stopCamera();
                    await handleSendVaultWithCode(result.content);
                }
            } else {
                setMode("manual");
            }
        } catch (e: any) {
            console.warn("[WebCompanionLink] Camera init error:", e);
            await stopCamera();
            setMode("manual");
        }
    };

    useEffect(() => {
        if (mode === "send_scan" && isNativeMobile) {
            startNativeScan();
        }
        return () => {
            stopCamera();
        };
    }, [mode, isNativeMobile]);

    // ── Transmitir Bóveda desde Móvil hacia PC ─────────────────────────────────
    const handleSendVaultWithCode = async (code: string) => {
        await stopCamera();
        const rawCode = code.trim();

        if (!rawCode.startsWith("RED_PAIR:1:")) {
            toast.error("El código no es un token de vinculación RED válido.");
            setMode("error");
            setStatusMessage("Código no reconocido");
            return;
        }

        setMode("encrypting");
        setStatusMessage("Derivando claves ECDH P-256 y empaquetando bóveda…");
        TacticalAudioEngine.playTap();

        try {
            let masterPin = localStorage.getItem("master_pin") || "123456";
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
                    const res = await SecureStoragePlugin.get({ key: "master_pin" }).catch(() => null);
                    if (res?.value) masterPin = res.value;
                }
            } catch {}

            const convsToSync = Array.isArray(conversations) ? conversations.slice(0, 30) : [];
            const contactsToSync = Array.isArray(contacts) ? contacts : [];

            const payload: CompanionSyncPayload = {
                version: 1,
                timestamp: Date.now(),
                identity: {
                    identity_hash: identity?.identity_hash || "",
                    short_id: identity?.short_id || "",
                    public_key: identity?.public_key || identity?.identity_hash || "",
                    nickname: identity?.nickname || "Operador RED"
                },
                masterPin,
                contacts: contactsToSync,
                conversations: convsToSync
            };

            await companionSyncEngine.transmitMobileVaultToWeb(
                rawCode,
                payload,
                (msg) => setStatusMessage(msg)
            );

            setMode("success");
            setStatusMessage("¡Navegador Web vinculado exitosamente!");
            TacticalAudioEngine.playMessageSent();
            toast.success("✅ ¡Bóveda clonada en el navegador Web con éxito!");

            setTimeout(() => {
                onClose();
            }, 1800);
        } catch (e: any) {
            setMode("error");
            setStatusMessage(e?.message || "Error al transmitir bóveda");
            toast.error(e?.message || "Fallo en la vinculación");
        }
    };

    const handleCopyCode = () => {
        if (pairingSession?.qrPayload) {
            navigator.clipboard.writeText(pairingSession.qrPayload);
            toast.success("📋 Código copiado al portapapeles");
        }
    };

    const handleCancel = async () => {
        await stopCamera();
        if (pairingSession) pairingSession.cleanup();
        onClose();
    };

    // ── VISTA DE CÁMARA TRANSPARENTE EN MÓVIL ─────────────────────────────────
    if (mode === "send_scan") {
        return (
            <div className="scanner-viewfinder-overlay" style={{ zIndex: 100000 }}>
                <div style={{
                    padding: "14px 20px",
                    borderRadius: "16px",
                    background: "rgba(8, 12, 28, 0.92)",
                    border: "1.5px solid var(--accent-cyan)",
                    color: "#FFFFFF",
                    textAlign: "center",
                    boxShadow: "0 4px 25px rgba(0,229,255,0.35)",
                    maxWidth: "340px",
                    width: "90%"
                }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "var(--accent-cyan)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        <span>💻</span> VINCULAR SESIÓN RED WEB (PC)
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)", marginTop: "4px", lineHeight: 1.3 }}>
                        Apunta al código QR generado en la versión Web de tu PC
                    </div>
                </div>

                <div className="scanner-target-box" style={{ width: "260px", height: "260px", borderColor: "var(--accent-cyan)", boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 24px rgba(0, 229, 255, 0.5)" }}>
                    <div className="scanner-laser-line" style={{ background: "linear-gradient(90deg, transparent, #00E5FF, #B388FF, transparent)", boxShadow: "0 0 12px #00E5FF" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "90%", maxWidth: "340px", alignItems: "center" }}>
                    <button
                        onClick={() => {
                            stopCamera();
                            setMode("manual");
                        }}
                        className="btn-tactical-secondary"
                        style={{
                            width: "100%", padding: "12px",
                            fontSize: "0.85rem", background: "rgba(0,0,0,0.75)",
                            borderColor: "var(--accent-cyan)", color: "var(--accent-cyan)",
                            borderRadius: "var(--radius-md)"
                        }}
                    >
                        ⌨️ Ingresar código manualmente
                    </button>
                    <button
                        onClick={handleCancel}
                        className="btn-tactical-primary"
                        style={{ width: "100%", padding: "14px", fontSize: "0.92rem", borderRadius: "var(--radius-md)" }}
                    >
                        ✕ Cancelar
                    </button>
                </div>
            </div>
        );
    }

    // ── VISTA PRINCIPAL: MODAL TÁCTICO CON SELECTOR DE ROL ─────────────────────
    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 100000,
            background: "rgba(3, 7, 18, 0.92)", backdropFilter: "blur(16px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px"
        }}>
            <div 
                className="modal-card-scrollable card-tactical-glass glow-border-cyan"
                style={{
                    maxWidth: "420px", width: "100%",
                    borderRadius: "24px",
                    padding: "26px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "18px",
                    color: "#fff", position: "relative",
                    maxHeight: "calc(100dvh - 32px)", overflowY: "auto"
                }}
            >
                <button
                    onClick={handleCancel}
                    className="btn-icon"
                    style={{ position: "absolute", top: "16px", right: "16px", width: "32px", height: "32px" }}
                >
                    ✕
                </button>

                {/* Header */}
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "2.2rem", marginBottom: "6px" }}>
                        {mode === "success" ? "🎉" : mode === "encrypting" || mode === "receiving" ? "⚡" : mode === "error" ? "❌" : "💻"}
                    </div>
                    <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>
                        {mode === "success" ? "¡Sesión Vinculada!" : "Web Companion Link"}
                    </h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: "0.76rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                        {statusMessage}
                    </p>
                </div>

                {/* Tabs de Rol (Recibir QR en PC / Enviar Bóveda) */}
                {(mode === "receive_qr" || mode === "manual") && (
                    <div style={{ display: "flex", width: "100%", gap: "6px", background: "rgba(0,0,0,0.3)", padding: "4px", borderRadius: "var(--radius-full)" }}>
                        <button
                            onClick={() => setMode("receive_qr")}
                            style={{
                                flex: 1, padding: "6px 10px", borderRadius: "var(--radius-full)",
                                background: mode === "receive_qr" ? "var(--accent-cyan)" : "transparent",
                                color: mode === "receive_qr" ? "#000" : "var(--text-secondary)",
                                border: "none", fontWeight: 800, fontSize: "0.72rem", cursor: "pointer"
                            }}
                        >
                            📥 Recibir en esta PC
                        </button>
                        <button
                            onClick={() => {
                                if (isNativeMobile) {
                                    setMode("send_scan");
                                } else {
                                    setMode("manual");
                                }
                            }}
                            style={{
                                flex: 1, padding: "6px 10px", borderRadius: "var(--radius-full)",
                                background: mode === "manual" ? "var(--accent-cyan)" : "transparent",
                                color: mode === "manual" ? "#000" : "var(--text-secondary)",
                                border: "none", fontWeight: 800, fontSize: "0.72rem", cursor: "pointer"
                            }}
                        >
                            📤 Transmitir Bóveda
                        </button>
                    </div>
                )}

                {/* ESTADO 1: GENERAR QR PARA VINCULAR PC */}
                {mode === "receive_qr" && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "100%" }}>
                        <div style={{
                            padding: "12px", borderRadius: "16px", background: "#04060A",
                            border: "1px solid rgba(0, 240, 255, 0.4)",
                            boxShadow: "0 0 24px rgba(0, 240, 255, 0.2)",
                            minWidth: "220px", minHeight: "220px",
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                            {isGeneratingQr || !qrDataUrl ? (
                                <div style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                    ⏳ Generando par de claves...
                                </div>
                            ) : (
                                <img src={qrDataUrl} alt="QR de Vinculación" style={{ width: "220px", height: "220px", borderRadius: "8px" }} />
                            )}
                        </div>

                        {pairingSession && (
                            <button
                                onClick={handleCopyCode}
                                className="btn-tactical-secondary"
                                style={{ padding: "8px 14px", fontSize: "0.74rem", width: "100%" }}
                            >
                                📋 Copiar Código de Emparejamiento
                            </button>
                        )}

                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.4 }}>
                            Abre la app RED en tu móvil → Pulsa <strong>💻 Vincular</strong> en el encabezado → Escanea este código para clonar tu cuenta sin servidores intermedios.
                        </div>
                    </div>
                )}

                {/* ESTADO 2: ENTRADA MANUAL DE CÓDIGO */}
                {mode === "manual" && (
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <label style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                            Pega el token <code>RED_PAIR:1:...</code> generado en tu otro dispositivo:
                        </label>
                        <textarea
                            placeholder="RED_PAIR:1:0:redpair_..."
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            rows={3}
                            style={{
                                width: "100%", padding: "10px", borderRadius: "10px",
                                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(0,229,255,0.3)",
                                color: "#fff", fontSize: "11px", fontFamily: "JetBrains Mono, monospace",
                                resize: "none"
                            }}
                        />
                        <button
                            onClick={() => handleSendVaultWithCode(manualCode.trim())}
                            disabled={!manualCode.trim()}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "12px", fontWeight: 800 }}
                        >
                            ⚡ TRANSMITIR BÓVEDA AHORA
                        </button>
                    </div>
                )}

                {/* ESTADO 3: CIFRANDO / RECIBIENDO */}
                {(mode === "encrypting" || mode === "receiving") && (
                    <div style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                        <div style={{
                            width: "50px", height: "50px", borderRadius: "50%",
                            border: "3px solid rgba(0,229,255,0.2)", borderTopColor: "var(--accent-cyan)",
                            animation: "spin 1s linear infinite"
                        }} />
                        <span style={{ fontSize: "0.78rem", color: "var(--accent-cyan)", fontWeight: 800, fontFamily: "JetBrains Mono, monospace" }}>
                            AES-256-GCM E2E VAULT PACKET
                        </span>
                    </div>
                )}

                {/* ESTADO 4: ERROR CON REINTENTO */}
                {mode === "error" && (
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <button
                            onClick={() => setMode("receive_qr")}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "10px" }}
                        >
                            🔄 Reintentar Generación
                        </button>
                        <button
                            onClick={() => setMode("manual")}
                            className="btn-tactical-secondary"
                            style={{ width: "100%", padding: "10px" }}
                        >
                            ⌨️ Usar Entrada Manual
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WebCompanionLinkModal;
