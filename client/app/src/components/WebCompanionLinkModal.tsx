"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { companionSyncEngine, CompanionSyncPayload } from "../lib/mesh/companionSyncEngine";
import { TacticalAudioEngine } from "../lib/TacticalAudioEngine";
import { toast } from "./Toast";
import { RedAPI } from "../lib/api";

interface WebCompanionLinkModalProps {
    onClose: () => void;
}

export const WebCompanionLinkModal: React.FC<WebCompanionLinkModalProps> = ({ onClose }) => {
    const { identity, contacts, conversations } = useRedStore();
    const [status, setStatus] = useState<"scanning" | "encrypting" | "success" | "error">("scanning");
    const [statusMessage, setStatusMessage] = useState<string>("Escaneando código QR de RED Web…");
    const [manualCode, setManualCode] = useState<string>("");
    const [showManualInput, setShowManualInput] = useState<boolean>(false);

    // Iniciar escaneo nativo con Capacitor Barcode Scanner si está disponible
    useEffect(() => {
        let isMounted = true;

        const startNativeScan = async () => {
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
                    
                    const status = await BarcodeScanner.checkPermission({ force: true });
                    if (!status.granted) {
                        setShowManualInput(true);
                        return;
                    }

                    await BarcodeScanner.hideBackground();
                    document.body.style.background = "transparent";

                    const result = await BarcodeScanner.startScan();
                    if (result.hasContent && isMounted) {
                        await handleScannedCode(result.content);
                    }
                } else {
                    setShowManualInput(true);
                }
            } catch (e: any) {
                if (isMounted) {
                    setShowManualInput(true);
                }
            }
        };

        startNativeScan();

        return () => {
            isMounted = false;
            import("@capacitor/core").then(({ Capacitor }) => {
                if (Capacitor.isNativePlatform()) {
                    import("@capacitor-community/barcode-scanner").then(({ BarcodeScanner }) => {
                        BarcodeScanner.showBackground();
                        BarcodeScanner.stopScan();
                        document.body.style.background = "";
                    }).catch(() => {});
                }
            }).catch(() => {});
        };
    }, []);

    const handleScannedCode = async (code: string) => {
        if (!code.startsWith("RED_PAIR:1:")) {
            toast.error("El código escaneado no es un código de vinculación RED válido.");
            setStatus("error");
            setStatusMessage("Código no reconocido");
            return;
        }

        setStatus("encrypting");
        setStatusMessage("Preparando bóveda y cifrando canal E2E…");
        TacticalAudioEngine.playTap();

        try {
            // Obtener PIN maestro
            let masterPin = localStorage.getItem("master_pin") || "123456";
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
                    const res = await SecureStoragePlugin.get({ key: "master_pin" }).catch(() => null);
                    if (res?.value) masterPin = res.value;
                }
            } catch {}

            // Preparar conversaciones recientes
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
                code,
                payload,
                (msg) => setStatusMessage(msg)
            );

            setStatus("success");
            setStatusMessage("¡Navegador Web vinculado exitosamente!");
            TacticalAudioEngine.playMessageSent();
            toast.success("✅ ¡Dispositivo Web vinculado con éxito!");

            // Háptica
            if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([100, 50, 150]);
            }

            setTimeout(() => {
                onClose();
            }, 1800);
        } catch (e: any) {
            setStatus("error");
            setStatusMessage(e?.message || "Error al transmitir bóveda");
            toast.error(e?.message || "Fallo en la vinculación");
        }
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 100000,
            background: "rgba(3, 7, 18, 0.92)", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px"
        }}>
            <div style={{
                maxWidth: "380px", width: "100%",
                background: "linear-gradient(180deg, rgba(22,27,42,0.98) 0%, rgba(11,14,24,0.98) 100%)",
                border: "1px solid rgba(0, 229, 255, 0.3)",
                borderRadius: "24px",
                padding: "26px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "20px",
                color: "#fff", position: "relative",
                boxShadow: "0 0 45px rgba(0, 229, 255, 0.15)"
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: "absolute", top: "16px", right: "16px",
                        background: "rgba(255,255,255,0.06)", border: "none",
                        width: "32px", height: "32px", borderRadius: "50%",
                        color: "var(--text-muted)", fontSize: "16px", cursor: "pointer"
                    }}
                >
                    ✕
                </button>

                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "2.2rem", marginBottom: "8px" }}>
                        {status === "success" ? "🎉" : status === "encrypting" ? "⚡" : "💻"}
                    </div>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900 }}>
                        {status === "success" ? "¡Sesión Web Activa!" : "Vincular con RED Web"}
                    </h3>
                    <p style={{ margin: "6px 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {statusMessage}
                    </p>
                </div>

                {status === "scanning" && (
                    <div style={{
                        width: "200px", height: "200px",
                        border: "2px dashed var(--accent-cyan)",
                        borderRadius: "18px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        position: "relative", overflow: "hidden"
                    }}>
                        <div style={{
                            position: "absolute", width: "100%", height: "2px",
                            background: "var(--accent-cyan)",
                            boxShadow: "0 0 10px var(--accent-cyan)",
                            animation: "radarSweep 2s ease-in-out infinite"
                        }} />
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", padding: "10px" }}>
                            Apunta la cámara al código QR de la pantalla de tu PC
                        </span>
                    </div>
                )}

                {status === "encrypting" && (
                    <div style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                        <div className="animate-spin" style={{ fontSize: "2rem" }}>⚙️</div>
                        <span style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", fontWeight: 700 }}>
                            Derivando claves ECDH P-256…
                        </span>
                    </div>
                )}

                {/* Entrada manual de respaldo */}
                {showManualInput && status === "scanning" && (
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <input
                            type="text"
                            placeholder="Pega el código RED_PAIR aquí…"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            style={{
                                width: "100%", padding: "12px", borderRadius: "12px",
                                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                                color: "#fff", fontSize: "11px", fontFamily: "JetBrains Mono, monospace"
                            }}
                        />
                        <button
                            onClick={() => handleScannedCode(manualCode.trim())}
                            disabled={!manualCode.trim()}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "12px" }}
                        >
                            Vincular Manualmente
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
