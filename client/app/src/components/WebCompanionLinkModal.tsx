"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { companionSyncEngine, CompanionSyncPayload } from "../lib/mesh/companionSyncEngine";
import { TacticalAudioEngine } from "../lib/TacticalAudioEngine";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

interface WebCompanionLinkModalProps {
    onClose: () => void;
}

export const WebCompanionLinkModal: React.FC<WebCompanionLinkModalProps> = ({ onClose }) => {
    const { identity, contacts, conversations } = useRedStore();
    const { t } = useTranslation();
    const [status, setStatus] = useState<"camera" | "manual" | "encrypting" | "success" | "error">("camera");
    const [statusMessage, setStatusMessage] = useState<string>("Apunta la cámara al código QR de RED Web en tu PC…");
    const [manualCode, setManualCode] = useState<string>("");
    const isScanningRef = useRef(false);

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

    // Iniciar escaneo nativo con Capacitor Barcode Scanner
    useEffect(() => {
        let isMounted = true;

        const startNativeScan = async () => {
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
                    
                    const perm = await BarcodeScanner.checkPermission({ force: true });
                    if (perm.denied) {
                        toast.error("Permiso de cámara denegado. Puedes pegar el código manualmente.");
                        if (isMounted) setStatus("manual");
                        return;
                    }
                    if (!perm.granted) {
                        toast.warning("Permiso de cámara no concedido.");
                        if (isMounted) setStatus("manual");
                        return;
                    }

                    await BarcodeScanner.hideBackground();
                    document.body.classList.add("scanner-active");
                    isScanningRef.current = true;
                    if (isMounted) setStatus("camera");

                    const result = await BarcodeScanner.startScan();
                    if (result.hasContent && isMounted) {
                        await stopCamera();
                        await handleScannedCode(result.content);
                    }
                } else {
                    if (isMounted) setStatus("manual");
                }
            } catch (e: any) {
                console.warn("[WebCompanionLink] Camera init error:", e);
                await stopCamera();
                if (isMounted) setStatus("manual");
            }
        };

        startNativeScan();

        return () => {
            isMounted = false;
            stopCamera();
        };
    }, []);

    const handleScannedCode = async (code: string) => {
        await stopCamera();
        const rawCode = code.trim();

        if (!rawCode.startsWith("RED_PAIR:1:")) {
            toast.error("El código escaneado no es un código de vinculación RED Web válido.");
            setStatus("error");
            setStatusMessage("Código no reconocido");
            return;
        }

        setStatus("encrypting");
        setStatusMessage("Derivando claves ECDH P-256 y empaquetando bóveda…");
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
                rawCode,
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
            }, 1600);
        } catch (e: any) {
            setStatus("error");
            setStatusMessage(e?.message || "Error al transmitir bóveda");
            toast.error(e?.message || "Fallo en la vinculación");
        }
    };

    const handleCancel = async () => {
        await stopCamera();
        onClose();
    };

    // ── MODO 1: CÁMARA TRANSPARENTE EN TIEMPO REAL ───────────────────────────
    if (status === "camera") {
        return (
            <div className="scanner-viewfinder-overlay" style={{ zIndex: 100000 }}>
                {/* Header Superior del Visor */}
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
                        Apunta al código QR generado en tu PC (darckrovert.github.io/RED/) para clonar tu cuenta
                    </div>
                </div>

                {/* Caja de Visor con Línea Láser Animada */}
                <div className="scanner-target-box" style={{ width: "260px", height: "260px", borderColor: "var(--accent-cyan)", boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 24px rgba(0, 229, 255, 0.5)" }}>
                    <div className="scanner-laser-line" style={{ background: "linear-gradient(90deg, transparent, #00E5FF, #B388FF, transparent)", boxShadow: "0 0 12px #00E5FF" }} />
                </div>

                {/* Botonera Inferior */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "90%", maxWidth: "340px", alignItems: "center" }}>
                    <button
                        onClick={() => {
                            stopCamera();
                            setStatus("manual");
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
                        style={{
                            width: "100%", padding: "14px",
                            fontSize: "0.92rem",
                            boxShadow: "0 4px 25px rgba(232,33,58,0.5)",
                            borderRadius: "var(--radius-md)"
                        }}
                    >
                        ✕ Cancelar
                    </button>
                </div>
            </div>
        );
    }

    // ── MODO 2: TARJETA DE PROCESO / ENTRADA MANUAL / RESULTADOS ─────────────
    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 100000,
            background: "rgba(3, 7, 18, 0.92)", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px"
        }}>
            <div 
                className="modal-card-scrollable"
                style={{
                    maxWidth: "380px", width: "100%",
                    background: "linear-gradient(180deg, rgba(22,27,42,0.98) 0%, rgba(11,14,24,0.98) 100%)",
                    border: "1px solid rgba(0, 229, 255, 0.3)",
                    borderRadius: "24px",
                    padding: "26px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "20px",
                    color: "#fff", position: "relative",
                    boxShadow: "0 0 45px rgba(0, 229, 255, 0.15)",
                    maxHeight: "calc(100dvh - 32px)", overflowY: "auto"
                }}
            >
                <button
                    onClick={handleCancel}
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
                    <div style={{ fontSize: "2.4rem", marginBottom: "8px" }}>
                        {status === "success" ? "🎉" : status === "encrypting" ? "⚡" : status === "error" ? "❌" : "💻"}
                    </div>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900 }}>
                        {status === "success" ? "¡Sesión Web Activa!" : status === "encrypting" ? "Cifrando y Transmitiendo" : "Vincular con RED Web"}
                    </h3>
                    <p style={{ margin: "6px 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        {statusMessage}
                    </p>
                </div>

                {status === "encrypting" && (
                    <div style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                        <div style={{
                            width: "50px", height: "50px", borderRadius: "50%",
                            border: "3px solid rgba(0,229,255,0.2)", borderTopColor: "var(--accent-cyan)",
                            animation: "spin 1s linear infinite"
                        }} />
                        <span style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                            AES-256-GCM E2E VAULT PACKET
                        </span>
                    </div>
                )}

                {status === "manual" && (
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <textarea
                            placeholder="Pega el código RED_PAIR:1:... que aparece en tu pantalla PC"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            rows={3}
                            style={{
                                width: "100%", padding: "12px", borderRadius: "12px",
                                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(0,229,255,0.3)",
                                color: "#fff", fontSize: "11px", fontFamily: "JetBrains Mono, monospace",
                                resize: "none"
                            }}
                        />
                        <button
                            onClick={() => handleScannedCode(manualCode.trim())}
                            disabled={!manualCode.trim()}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "14px", fontWeight: 900 }}
                        >
                            ⚡ VINCULAR DISPOSITIVO AHORA
                        </button>
                    </div>
                )}

                {status === "error" && (
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <button
                            onClick={() => setStatus("camera")}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "12px" }}
                        >
                            🔄 Reintentar Escaneo
                        </button>
                        <button
                            onClick={() => setStatus("manual")}
                            className="btn-tactical-secondary"
                            style={{ width: "100%", padding: "12px" }}
                        >
                            ⌨️ Usar Entrada Manual
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
