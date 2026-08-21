"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { companionSyncEngine, CompanionSyncPayload } from "../lib/mesh/companionSyncEngine";
import { TacticalAudioEngine } from "../lib/TacticalAudioEngine";
import { toast } from "./Toast";

interface WebCompanionPairConfirmationModalProps {
    qrData: string;
    onClose: () => void;
}

export const WebCompanionPairConfirmationModal: React.FC<WebCompanionPairConfirmationModalProps> = ({ qrData, onClose }) => {
    const { identity, contacts, conversations } = useRedStore();
    const [status, setStatus] = useState<"idle" | "transmitting" | "success" | "error">("idle");
    const [statusMessage, setStatusMessage] = useState<string>("");

    const handleConfirmPairing = async () => {
        try {
            setStatus("transmitting");
            setStatusMessage("Estableciendo enlace criptográfico seguro con la Web…");
            TacticalAudioEngine.playTap();

            // 1. Obtener PIN maestro
            let masterPin = typeof window !== "undefined" ? localStorage.getItem("master_pin") || "123456" : "123456";
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
                    const res = await SecureStoragePlugin.get({ key: "master_pin" }).catch(() => null);
                    if (res?.value) masterPin = res.value;
                }
            } catch {}

            // 2. Empaquetar datos de sincronización
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

            // 3. Transmitir con cifrado E2E ECDH + AES-256-GCM
            await companionSyncEngine.transmitMobileVaultToWeb(
                qrData,
                payload,
                (msg) => setStatusMessage(msg)
            );

            setStatus("success");
            setStatusMessage("¡Navegador Web vinculado exitosamente!");
            TacticalAudioEngine.playMessageSent();
            toast.success("✅ ¡Dispositivo Web vinculado con éxito! Ya puedes usar RED en tu PC.");

            if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([100, 50, 150]);
            }

            setTimeout(() => {
                onClose();
            }, 1600);
        } catch (e: any) {
            setStatus("error");
            setStatusMessage(e?.message || "Error al vincular con la web");
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
                display: "flex", flexDirection: "column", alignItems: "center", gap: "18px",
                color: "#fff", position: "relative",
                boxShadow: "0 0 45px rgba(0, 229, 255, 0.15)"
            }}>
                <button
                    onClick={onClose}
                    disabled={status === "transmitting"}
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
                    <div style={{
                        width: "56px", height: "56px", borderRadius: "18px",
                        background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.8rem", margin: "0 auto 12px auto"
                    }}>
                        {status === "success" ? "🎉" : status === "transmitting" ? "⚡" : "💻"}
                    </div>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900 }}>
                        {status === "success" ? "¡Sesión Web Activa!" : "Vincular con RED Web (PC)"}
                    </h3>
                    <p style={{ margin: "8px 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                        {status === "idle"
                            ? "Se ha detectado un código de vinculación Web. Al autorizar, podrás acceder a todos tus contactos, chats y perfil desde tu navegador en la computadora."
                            : statusMessage}
                    </p>
                </div>

                {status === "idle" && (
                    <div style={{
                        width: "100%", background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px",
                        padding: "14px", display: "flex", flexDirection: "column", gap: "8px",
                        fontSize: "0.78rem"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>🔒</span>
                            <span>Cifrado de extremo a extremo (ECDH P-256)</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>🔄</span>
                            <span>Sincroniza contactos y mensajes recientes</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>👤</span>
                            <span>Misma identidad: <strong>{identity?.nickname || "Operador RED"}</strong></span>
                        </div>
                    </div>
                )}

                {status === "transmitting" && (
                    <div style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                        <div className="animate-spin" style={{ fontSize: "2rem" }}>⚙️</div>
                        <span style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", fontWeight: 700 }}>
                            Transmitiendo bóveda cifrada…
                        </span>
                    </div>
                )}

                {status === "idle" && (
                    <div style={{ width: "100%", display: "flex", gap: "10px" }}>
                        <button
                            onClick={onClose}
                            className="btn-tactical-secondary"
                            style={{ flex: 1, padding: "12px", fontSize: "0.85rem" }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmPairing}
                            className="btn-tactical-primary"
                            style={{ flex: 2, padding: "12px", fontSize: "0.88rem", fontWeight: 900 }}
                        >
                            ⚡ Autorizar y Vincular
                        </button>
                    </div>
                )}

                {status === "error" && (
                    <div style={{ width: "100%", display: "flex", gap: "10px" }}>
                        <button
                            onClick={onClose}
                            className="btn-tactical-secondary"
                            style={{ flex: 1, padding: "12px", fontSize: "0.85rem" }}
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={handleConfirmPairing}
                            className="btn-tactical-primary"
                            style={{ flex: 1, padding: "12px", fontSize: "0.88rem" }}
                        >
                            Reintentar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
