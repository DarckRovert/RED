"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { companionSyncEngine, PairingSession, CompanionSyncPayload } from "../lib/mesh/companionSyncEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

interface WebCompanionQRModalProps {
    onClose: () => void;
}

export const WebCompanionQRModal: React.FC<WebCompanionQRModalProps> = ({ onClose }) => {
    const { restoreCompanionVault } = useRedStore();
    const [qrDataUrl, setQrDataUrl] = useState<string>("");
    const [timeLeft, setTimeLeft] = useState<number>(120);
    const [status, setStatus] = useState<"connecting" | "ready" | "paired" | "expired" | "error">("connecting");
    const [errorMessage, setErrorMessage] = useState<string>("");

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

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 100000,
            background: "rgba(3, 7, 18, 0.88)", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px"
        }}>
            <div style={{
                maxWidth: "420px", width: "100%",
                background: "linear-gradient(180deg, rgba(20,24,36,0.98) 0%, rgba(10,12,20,0.98) 100%)",
                border: "1px solid rgba(0, 229, 255, 0.3)",
                borderRadius: "24px",
                boxShadow: "0 0 45px rgba(0, 229, 255, 0.15), 0 20px 50px rgba(0,0,0,0.8)",
                padding: "26px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "20px",
                color: "#fff", position: "relative"
            }}>
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
                        background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.25)",
                        fontSize: "11px", fontWeight: 800, color: "var(--accent-cyan)", letterSpacing: "1px",
                        marginBottom: "8px"
                    }}>
                        🔗 RED WEB COMPANION
                    </div>
                    <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 900, color: "#fff" }}>
                        Vincular con tu Teléfono
                    </h3>
                    <p style={{ margin: "6px 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        Escanea este código QR desde la App RED de tu móvil para sincronizar tus contactos y conversaciones al instante.
                    </p>
                </div>

                {/* Contenedor del QR */}
                <div style={{
                    position: "relative",
                    width: "250px", height: "250px",
                    background: "#FFFFFF",
                    borderRadius: "20px",
                    padding: "10px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 30px rgba(0, 229, 255, 0.25)",
                    border: "3px solid rgba(0, 229, 255, 0.4)"
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
                            <div style={{ fontSize: "12px", fontWeight: 800 }}>Generando enlace seguro ECDH…</div>
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
