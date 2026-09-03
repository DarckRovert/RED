"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { companionSyncEngine, PairingSession, CompanionSyncPayload } from "../lib/mesh/companionSyncEngine";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { toast } from "./Toast";

interface WebCompanionQRModalProps {
    onClose: () => void;
}

export const WebCompanionQRModal: React.FC<WebCompanionQRModalProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const { restoreCompanionVault } = useRedStore();
    const [qrDataUrl, setQrDataUrl] = useState<string>("");
    const [timeLeft, setTimeLeft] = useState<number>(120);
    const [status, setStatus] = useState<"connecting" | "ready" | "paired" | "expired" | "error">("connecting");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [isP2pOffline, setIsP2pOffline] = useState(false);
    const [rawPayload, setRawPayload] = useState<string>("");
    const [showAirGap, setShowAirGap] = useState(false);
    const [airGapToken, setAirGapToken] = useState("");
    const [airGapPin, setAirGapPin] = useState("");
    const [isImportingAirGap, setIsImportingAirGap] = useState(false);

    useEffect(() => {
        let currentSession: PairingSession | null = null;
        let timerInterval: any = null;
        let isMounted = true;

        const startSession = async () => {
            try {
                setStatus("connecting");
                const session = await companionSyncEngine.createWebPairingSession(
                    async (payload: CompanionSyncPayload) => {
                        if (!isMounted) return;
                        setStatus("paired");
                        const ok = await restoreCompanionVault(payload);
                        if (ok) {
                            setTimeout(() => {
                                if (isMounted) onClose();
                            }, 1200);
                        }
                    },
                    (err) => {
                        if (!isMounted) return;
                        setStatus("error");
                        setErrorMessage(err);
                    }
                );

                if (!isMounted) {
                    session.cleanup();
                    return;
                }

                currentSession = session;
                setRawPayload(session.qrPayload);
                setIsP2pOffline(session.qrPayload.startsWith("RED_PAIR:2:"));

                const url = await QRCode.toDataURL(session.qrPayload, {
                    width: 260,
                    margin: 2,
                    color: {
                        dark: "#000000",
                        light: "#FFFFFF"
                    }
                });

                if (isMounted) {
                    setQrDataUrl(url);
                    setStatus("ready");
                    setTimeLeft(Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)));

                    timerInterval = setInterval(() => {
                        const remaining = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
                        setTimeLeft(remaining);
                        if (remaining <= 0) {
                            clearInterval(timerInterval);
                            setStatus("expired");
                        }
                    }, 1000);
                }
            } catch (e: any) {
                if (isMounted) {
                    setStatus("error");
                    setErrorMessage(e?.message || "Error al inicializar sesión de vinculación");
                }
            }
        };

        startSession();

        return () => {
            isMounted = false;
            if (timerInterval) clearInterval(timerInterval);
            if (currentSession) currentSession.cleanup();
        };
    }, [restoreCompanionVault, onClose]);

    const handleCopyToken = () => {
        if (!rawPayload) return;
        navigator.clipboard.writeText(rawPayload);
        toast.success("📋 Token copiado al portapapeles");
    };

    const handleImportAirGap = async () => {
        if (!airGapToken.trim()) {
            toast.warning("Pega un token válido con prefijo RED_VAULT:1:");
            return;
        }
        setIsImportingAirGap(true);
        try {
            const payload = await companionSyncEngine.importAirGapVaultToken(airGapToken, airGapPin || undefined);
            const ok = await restoreCompanionVault(payload);
            if (ok) {
                setStatus("paired");
                toast.success("✅ ¡Bóveda Air-Gap descifrada e importada con éxito!");
                setTimeout(() => {
                    onClose();
                }, 1200);
            } else {
                toast.error("Error al restaurar los datos de la bóveda");
            }
        } catch (e: any) {
            toast.error(e?.message || "Fallo al descifrar cápsula Air-Gap");
        } finally {
            setIsImportingAirGap(false);
        }
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 100000,
            background: "rgba(3, 7, 18, 0.88)", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px"
        }}>
            <div 
                className="modal-card-scrollable"
                style={{
                    maxWidth: "440px", width: "100%",
                    background: "linear-gradient(180deg, rgba(20,24,36,0.98) 0%, rgba(10,12,20,0.98) 100%)",
                    border: "1px solid rgba(0, 229, 255, 0.3)",
                    borderRadius: "24px",
                    boxShadow: "0 0 45px rgba(0, 229, 255, 0.15), 0 20px 50px rgba(0,0,0,0.8)",
                    padding: "24px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
                    color: "#fff", position: "relative",
                    maxHeight: "calc(100dvh - 32px)", overflowY: "auto"
                }}
            >
                {/* Botón Cerrar */}
                <button
                    onClick={onClose}
                    style={{
                        position: "absolute", top: "16px", right: "16px",
                        background: "rgba(255,255,255,0.06)", border: "none",
                        width: "32px", height: "32px", borderRadius: "50%",
                        color: "var(--text-muted)", fontSize: "16px", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                >
                    ✕
                </button>

                {/* Cabecera */}
                <div style={{ textAlign: "center" }}>
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: "8px",
                        padding: "4px 12px", borderRadius: "12px",
                        background: isP2pOffline ? "rgba(0, 230, 118, 0.12)" : "rgba(0, 229, 255, 0.1)",
                        border: `1px solid ${isP2pOffline ? "rgba(0, 230, 118, 0.35)" : "rgba(0, 229, 255, 0.25)"}`,
                        fontSize: "11px", fontWeight: 800,
                        color: isP2pOffline ? "var(--accent-emerald, #00E676)" : "var(--accent-cyan)",
                        letterSpacing: "1px", marginBottom: "8px"
                    }}>
                        {isP2pOffline ? "⚡ RED COMPANION: P2P SOBERANO (OFFLINE)" : "🔗 RED WEB COMPANION"}
                    </div>
                    <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 900, color: "#fff" }}>
                        Vincular con tu Teléfono
                    </h3>
                    <p style={{ margin: "6px 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {isP2pOffline 
                            ? "Enlace P2P directo sin servidor central activo. Escanea con la cámara de RED."
                            : "Escanea este código QR desde la App RED de tu móvil para sincronizar en tiempo real."
                        }
                    </p>
                </div>

                {/* Contenedor del QR */}
                <div style={{
                    position: "relative",
                    width: "min(240px, 60vw)", height: "min(240px, 60vw)",
                    background: "#FFFFFF",
                    borderRadius: "20px",
                    padding: "10px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 30px rgba(0, 229, 255, 0.25)",
                    border: `3px solid ${isP2pOffline ? "rgba(0, 230, 118, 0.5)" : "rgba(0, 229, 255, 0.4)"}`
                }}>
                    {status === "ready" && qrDataUrl && (
                        <img
                            src={qrDataUrl}
                            alt="RED Web Companion Pairing QR"
                            style={{ width: "100%", height: "100%", borderRadius: "12px", display: "block" }}
                        />
                    )}

                    {status === "connecting" && (
                        <div style={{ textAlign: "center", color: "#111", padding: "20px" }}>
                            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⚡</div>
                            <div style={{ fontSize: "12px", fontWeight: 800 }}>Iniciando enlace E2E ECDH…</div>
                        </div>
                    )}

                    {status === "paired" && (
                        <div style={{ textAlign: "center", color: "#10b981", padding: "20px" }}>
                            <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>✅</div>
                            <div style={{ fontSize: "14px", fontWeight: 900 }}>¡Dispositivo Vinculado!</div>
                            <div style={{ fontSize: "11px", color: "#666" }}>Iniciando sesión…</div>
                        </div>
                    )}

                    {status === "expired" && (
                        <div style={{ textAlign: "center", color: "#e11d48", padding: "20px" }}>
                            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⏱️</div>
                            <div style={{ fontSize: "13px", fontWeight: 800 }}>Código QR Caducado</div>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    marginTop: "10px", padding: "6px 14px", borderRadius: "10px",
                                    background: "#e11d48", color: "#fff", border: "none",
                                    fontSize: "11px", fontWeight: 800, cursor: "pointer"
                                }}
                            >
                                Reintentar
                            </button>
                        </div>
                    )}

                    {status === "error" && (
                        <div style={{ textAlign: "center", color: "#e11d48", padding: "16px" }}>
                            <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>⚠️</div>
                            <div style={{ fontSize: "11px", fontWeight: 800 }}>{errorMessage || "Error de enlace"}</div>
                        </div>
                    )}
                </div>

                {/* Acciones auxiliares de emparejamiento */}
                {status === "ready" && (
                    <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                        <button
                            onClick={handleCopyToken}
                            style={{
                                flex: 1, padding: "8px 12px", borderRadius: "12px",
                                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                                color: "#fff", fontSize: "0.74rem", fontWeight: 700, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                            }}
                        >
                            <span>📋</span>
                            <span>Copiar Token</span>
                        </button>
                        <button
                            onClick={() => setShowAirGap(!showAirGap)}
                            style={{
                                flex: 1, padding: "8px 12px", borderRadius: "12px",
                                background: showAirGap ? "rgba(0, 229, 255, 0.2)" : "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(0, 229, 255, 0.3)",
                                color: "var(--accent-cyan)", fontSize: "0.74rem", fontWeight: 700, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                            }}
                        >
                            <span>🛡️</span>
                            <span>Modo Air-Gap</span>
                        </button>
                    </div>
                )}

                {/* Sección Air-Gap para ambientes 100% aislados */}
                {showAirGap && (
                    <div style={{
                        width: "100%", background: "rgba(0, 229, 255, 0.05)",
                        border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: "16px",
                        padding: "14px", display: "flex", flexDirection: "column", gap: "10px",
                        animation: "fadeIn 0.2s ease-out"
                    }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                            Importación Manual Air-Gap (Búnker / Sin Red)
                        </div>
                        <input
                            type="text"
                            placeholder="Pega el token RED_VAULT:1:..."
                            value={airGapToken}
                            onChange={(e) => setAirGapToken(e.target.value)}
                            style={{
                                width: "100%", background: "rgba(0,0,0,0.5)",
                                border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px",
                                padding: "8px 10px", color: "#fff", fontSize: "0.75rem",
                                fontFamily: "monospace"
                            }}
                        />
                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                type="password"
                                placeholder="PIN Maestro (ej: 123456)"
                                value={airGapPin}
                                onChange={(e) => setAirGapPin(e.target.value)}
                                style={{
                                    flex: 1, background: "rgba(0,0,0,0.5)",
                                    border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px",
                                    padding: "8px 10px", color: "#fff", fontSize: "0.75rem"
                                }}
                            />
                            <button
                                onClick={handleImportAirGap}
                                disabled={isImportingAirGap}
                                className="btn-tactical-primary"
                                style={{ padding: "8px 16px", borderRadius: "10px", fontSize: "0.75rem" }}
                            >
                                {isImportingAirGap ? "Descifrando…" : "Restaurar"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Pasos e Instrucciones */}
                <div style={{
                    width: "100%", background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px",
                    padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px",
                    fontSize: "0.78rem", color: "var(--text-muted)"
                }}>
                    <div><strong>1.</strong> Abre RED en tu teléfono móvil.</div>
                    <div><strong>2.</strong> Toca el icono de <strong>Ajustes / Seguridad</strong> o el botón <strong>💻 Vincular Web</strong>.</div>
                    <div><strong>3.</strong> Apunta la cámara a este código QR para sincronizar.</div>
                </div>

                {/* Temporizador */}
                {status === "ready" && (
                    <div style={{ fontSize: "11px", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                        ⏳ Caduca en: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                    </div>
                )}
            </div>
        </div>
    );
};
