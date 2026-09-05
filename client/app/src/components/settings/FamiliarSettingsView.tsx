"use client";

import React, { useState } from "react";
import { useRedStore } from "../../store/useRedStore";
import { SettingsManager } from "../../lib/settingsManager";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { ContactQrModal } from "../chat/ContactQrModal";
import { toast } from "../Toast";
import { IdentityTab } from "./IdentityTab";
import { AppearanceTab } from "./AppearanceTab";
import { CallsTab } from "./CallsTab";
import { AudioTab } from "./AudioTab";
import { PrivacyTab } from "./PrivacyTab";
import { StorageTab } from "./StorageTab";
import { MeshTab } from "./MeshTab";
import { UpdatesTab } from "./UpdatesTab";

interface FamiliarSettingsViewProps {
    onClose?: () => void;
}

type SubSection = "identity" | "appearance" | "calls" | "privacy" | "storage" | "mesh" | "updates" | null;

export const FamiliarSettingsView: React.FC<FamiliarSettingsViewProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const { identity, preferences, updatePreferences } = useRedStore();
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<SubSection>(null);

    const isFamiliar = (preferences?.uiMode ?? "familiar") !== "tactical";

    const handleToggleUiMode = () => {
        const nextMode = isFamiliar ? "tactical" : "familiar";
        updatePreferences({ uiMode: nextMode });
        SettingsManager.triggerHaptic("medium");
        toast.success(nextMode === "familiar" ? "Modo Familiar activado" : "Modo Táctico C4ISR activado");
    };

    const myName = identity?.nickname || (identity?.identity_hash ? `Usuario ${identity.identity_hash.substring(0, 8)}` : "Mi Perfil");
    const myDid = identity?.identity_hash ? `did:red:${identity.identity_hash.substring(0, 16)}…` : "Sin DID asignado";

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "#111B21", color: "#E9EDEF",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header */}
            <header style={{
                padding: "16px 20px",
                height: "56px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "#111B21",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                background: "transparent", border: "none",
                                color: "#AEBAC1", fontSize: "1.25rem", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center"
                            }}
                        >
                            ←
                        </button>
                    )}
                    <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "#E9EDEF" }}>
                        Ajustes
                    </h1>
                </div>
            </header>

            {/* Scrollable Content */}
            <div className="scroll-container" style={{ flex: 1, overflowY: "auto", paddingBottom: "80px" }}>
                <div style={{ maxWidth: "600px", margin: "0 auto", width: "100%", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Profile Banner */}
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "14px 16px", borderRadius: "14px",
                        background: "#182229", border: "1px solid rgba(255, 255, 255, 0.06)",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)"
                    }}>
                        <div
                            onClick={() => setActiveSection("identity")}
                            style={{ display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", flex: 1, minWidth: 0 }}
                        >
                            <div style={{
                                width: 56, height: 56, borderRadius: "50%",
                                background: "linear-gradient(135deg, #00A884 0%, #005C4B 100%)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.4rem", fontWeight: 900, color: "#FFFFFF",
                                flexShrink: 0, boxShadow: "0 4px 12px rgba(0, 168, 132, 0.3)"
                            }}>
                                {myName.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0, overflow: "hidden" }}>
                                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#E9EDEF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {myName}
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "#8696A0", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    ¡Hola! Estoy usando RED OS
                                </div>
                                <div style={{ fontSize: "0.70rem", color: "#00A884", marginTop: "2px", fontFamily: "JetBrains Mono, monospace" }}>
                                    {myDid}
                                </div>
                            </div>
                        </div>

                        {/* Direct QR Code Button */}
                        <button
                            onClick={() => setQrModalOpen(true)}
                            style={{
                                width: 44, height: 44, borderRadius: "50%",
                                background: "rgba(0, 168, 132, 0.15)", border: "1px solid rgba(0, 168, 132, 0.3)",
                                color: "#00A884", fontSize: "1.25rem", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0, marginLeft: "10px"
                            }}
                            title="Ver mi código QR de contacto"
                        >
                            🪪
                        </button>
                    </div>

                    {/* UI Mode Switch Card */}
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "14px 16px", borderRadius: "14px",
                        background: "#182229", border: "1px solid rgba(0, 168, 132, 0.3)",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: "10px",
                                background: "rgba(0, 168, 132, 0.18)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.2rem", color: "#00A884"
                            }}>
                                🎛️
                            </div>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#E9EDEF" }}>
                                    Modo Familiar (WhatsApp)
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "#8696A0", marginTop: "2px" }}>
                                    {isFamiliar ? "Interfaz amigable para uso cotidiano" : "Modo militar táctico C4ISR activo"}
                                </div>
                            </div>
                        </div>

                        {/* Interactive Toggle Switch */}
                        <div
                            onClick={handleToggleUiMode}
                            style={{
                                width: 50, height: 28, borderRadius: "14px",
                                background: isFamiliar ? "#00A884" : "#374248",
                                position: "relative", cursor: "pointer",
                                transition: "background 0.2s ease"
                            }}
                        >
                            <div style={{
                                width: 22, height: 22, borderRadius: "50%",
                                background: "#FFFFFF",
                                position: "absolute", top: 3,
                                left: isFamiliar ? 25 : 3,
                                transition: "left 0.2s ease",
                                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)"
                            }} />
                        </div>
                    </div>

                    {/* Categories List */}
                    <div style={{
                        background: "#182229", borderRadius: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        overflow: "hidden"
                    }}>
                        {/* 1. Cuenta y Perfil */}
                        <div
                            onClick={() => setActiveSection("identity")}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "14px 16px", cursor: "pointer",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.04)"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                <span style={{ fontSize: "1.3rem" }}>👤</span>
                                <div>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>
                                        Cuenta & Identidad
                                    </div>
                                    <div style={{ fontSize: "0.74rem", color: "#8696A0" }}>
                                        Clave criptográfica, apodo y DID
                                    </div>
                                </div>
                            </div>
                            <span style={{ color: "#8696A0", fontSize: "0.9rem" }}>➔</span>
                        </div>

                        {/* 2. Chats y Apariencia */}
                        <div
                            onClick={() => setActiveSection("appearance")}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "14px 16px", cursor: "pointer",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.04)"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                <span style={{ fontSize: "1.3rem" }}>💬</span>
                                <div>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>
                                        Chats & Apariencia
                                    </div>
                                    <div style={{ fontSize: "0.74rem", color: "#8696A0" }}>
                                        Fondo de pantalla, tamaño de texto, temas
                                    </div>
                                </div>
                            </div>
                            <span style={{ color: "#8696A0", fontSize: "0.9rem" }}>➔</span>
                        </div>

                        {/* 3. Privacidad */}
                        <div
                            onClick={() => setActiveSection("privacy")}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "14px 16px", cursor: "pointer",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.04)"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                <span style={{ fontSize: "1.3rem" }}>🔒</span>
                                <div>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>
                                        Privacidad & Seguridad
                                    </div>
                                    <div style={{ fontSize: "0.74rem", color: "#8696A0" }}>
                                        Mensajes temporales, Safety Numbers, bloqueo
                                    </div>
                                </div>
                            </div>
                            <span style={{ color: "#8696A0", fontSize: "0.9rem" }}>➔</span>
                        </div>

                        {/* 4. Llamadas & Audio */}
                        <div
                            onClick={() => setActiveSection("calls")}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "14px 16px", cursor: "pointer",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.04)"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                <span style={{ fontSize: "1.3rem" }}>📞</span>
                                <div>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>
                                        Llamadas & Tonos
                                    </div>
                                    <div style={{ fontSize: "0.74rem", color: "#8696A0" }}>
                                        Calidad de video, tonos de llamada, audio
                                    </div>
                                </div>
                            </div>
                            <span style={{ color: "#8696A0", fontSize: "0.9rem" }}>➔</span>
                        </div>

                        {/* 5. Almacenamiento y Datos */}
                        <div
                            onClick={() => setActiveSection("storage")}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "14px 16px", cursor: "pointer",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.04)"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                <span style={{ fontSize: "1.3rem" }}>💾</span>
                                <div>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>
                                        Almacenamiento y Caché
                                    </div>
                                    <div style={{ fontSize: "0.74rem", color: "#8696A0" }}>
                                        Bóveda de medios, liberar espacio en disco
                                    </div>
                                </div>
                            </div>
                            <span style={{ color: "#8696A0", fontSize: "0.9rem" }}>➔</span>
                        </div>

                        {/* 6. Conexión de Malla */}
                        <div
                            onClick={() => setActiveSection("mesh")}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "14px 16px", cursor: "pointer",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.04)"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                <span style={{ fontSize: "1.3rem" }}>📶</span>
                                <div>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>
                                        Red Malla P2P (Sin Internet)
                                    </div>
                                    <div style={{ fontSize: "0.74rem", color: "#8696A0" }}>
                                        Perfil de energía, repetidores Bluetooth/WiFi
                                    </div>
                                </div>
                            </div>
                            <span style={{ color: "#8696A0", fontSize: "0.9rem" }}>➔</span>
                        </div>

                        {/* 7. Ayuda & Actualizaciones */}
                        <div
                            onClick={() => setActiveSection("updates")}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "14px 16px", cursor: "pointer"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                <span style={{ fontSize: "1.3rem" }}>🔄</span>
                                <div>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>
                                        Ayuda y Actualizaciones
                                    </div>
                                    <div style={{ fontSize: "0.74rem", color: "#8696A0" }}>
                                        RED OS v90.0.0 · Estado del sistema
                                    </div>
                                </div>
                            </div>
                            <span style={{ color: "#8696A0", fontSize: "0.9rem" }}>➔</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub-Section Modal */}
            {activeSection && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 10000,
                        background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(14px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "16px"
                    }}
                    onClick={() => setActiveSection(null)}
                >
                    <div
                        style={{
                            width: "100%", maxWidth: "600px", maxHeight: "85vh",
                            background: "#182229", borderRadius: "18px",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.7)",
                            display: "flex", flexDirection: "column", overflow: "hidden"
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Sub-header */}
                        <div style={{
                            padding: "16px", borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                            display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}>
                            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#E9EDEF" }}>
                                {activeSection === "identity" && "Identidad & Perfil"}
                                {activeSection === "appearance" && "Chats & Apariencia"}
                                {activeSection === "privacy" && "Privacidad & Seguridad"}
                                {activeSection === "calls" && "Llamadas & Audio"}
                                {activeSection === "storage" && "Almacenamiento"}
                                {activeSection === "mesh" && "Red Malla P2P"}
                                {activeSection === "updates" && "Actualizaciones"}
                            </div>
                            <button
                                onClick={() => setActiveSection(null)}
                                style={{ background: "none", border: "none", color: "#8696A0", fontSize: "1.2rem", cursor: "pointer" }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                            {activeSection === "identity" && <IdentityTab />}
                            {activeSection === "appearance" && <AppearanceTab />}
                            {activeSection === "privacy" && <PrivacyTab />}
                            {activeSection === "calls" && <CallsTab />}
                            {activeSection === "storage" && <StorageTab />}
                            {activeSection === "mesh" && <MeshTab />}
                            {activeSection === "updates" && <UpdatesTab />}
                        </div>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {qrModalOpen && (
                <ContactQrModal
                    initialTab="my_qr"
                    onClose={() => setQrModalOpen(false)}
                />
            )}
        </div>
    );
};
