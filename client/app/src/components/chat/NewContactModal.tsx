"use client";

import React, { useState, useCallback } from "react";
import { useRedStore } from "../../store/useRedStore";
import { toast } from "../Toast";
import { ContactQrModal } from "./ContactQrModal";

interface NewContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * NewContactModal — Dedicated "New Contact" modal, WhatsApp UX.
 *
 * Fixes root cause #1: users were confused by NewChatModal showing existing
 * contacts instead of a simple form to add a new one.
 *
 * Fields:
 *  - Alias / Name  (e.g. "Mamá", "Carlos")
 *  - RED Identifier (DID / Hash) with real-time validation + paste + QR shortcut
 *
 * On save: adds contact → navigates to new chat.
 */
export const NewContactModal: React.FC<NewContactModalProps> = ({ isOpen, onClose }) => {
    const { addContact, navigate } = useRedStore();

    const [name, setName] = useState("");
    const [did, setDid] = useState("");
    const [didError, setDidError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showQr, setShowQr] = useState(false);

    // Reset form when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setName("");
            setDid("");
            setDidError(null);
            setIsSaving(false);
        }
    }, [isOpen]);

    const validateDid = useCallback((value: string): string | null => {
        const v = value.trim();
        if (!v) return null;
        // Accept: did:red:..., RED_ID_VAULT:..., 8-64 hex chars, hex:pk:name
        if (v.startsWith("did:red:") && v.length > 8) return null;
        if (v.startsWith("RED_ID_VAULT:") && v.length > 13) return null;
        if (/^[0-9a-fA-F]{8,64}$/.test(v)) return null;
        if (/^[0-9a-fA-F]{8,}:.+/.test(v)) return null;
        return "Formato no reconocido. Pega el DID, hash o usa el escáner QR.";
    }, []);

    const handleDidChange = (value: string) => {
        setDid(value);
        setDidError(validateDid(value));
    };

    const handlePaste = async () => {
        try {
            if (navigator?.clipboard) {
                const text = await navigator.clipboard.readText();
                if (text) {
                    handleDidChange(text.trim());
                    toast.info("📋 Pegado del portapapeles");
                }
            }
        } catch {
            toast.warning("No se pudo leer el portapapeles. Pega manualmente.");
        }
    };

    const handleSave = async () => {
        const cleanDid = did.trim();
        const cleanName = name.trim();
        if (!cleanDid) {
            setDidError("El identificador RED es obligatorio.");
            return;
        }

        // Si el usuario por error pegó un código de vinculación Web Companion
        if (
            cleanDid.startsWith("RED_PAIR:1:") ||
            cleanDid.startsWith("RED_PAIR:2:") ||
            cleanDid.startsWith("RED_PAIR:") ||
            cleanDid.startsWith("RED_VAULT:1:")
        ) {
            window.dispatchEvent(new CustomEvent("red:pair_web_companion", { detail: cleanDid }));
            toast.info("💻 Código de RED Web detectado. Abriendo vinculación...");
            onClose();
            return;
        }

        const err = validateDid(cleanDid);
        if (err) {
            setDidError(err);
            return;
        }

        setIsSaving(true);
        try {
            const resultHash = await addContact(cleanDid, cleanName || undefined!);
            toast.success(`✅ Contacto guardado. Abriendo chat...`);
            onClose();
            const target = (typeof resultHash === "string" && resultHash) ? resultHash : cleanDid;
            navigate("chat", target);
        } catch (e: any) {
            toast.error(`❌ Error: ${e?.message || e}`);
        } finally {
            setIsSaving(false);
        }
    };

    const isValid = did.trim().length > 0 && !didError;
    const inputBase: React.CSSProperties = {
        width: "100%",
        padding: "12px 14px",
        backgroundColor: "#111B21",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "10px",
        color: "#E9EDEF",
        fontSize: "0.88rem",
        outline: "none",
        boxSizing: "border-box",
        transition: "border-color 0.15s ease",
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.85)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    zIndex: 10000,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "16px",
                    animation: "fadeIn 0.15s ease-out"
                }}
                onClick={onClose}
            >
                <div
                    className="animate-fade-scale"
                    style={{
                        width: "100%",
                        maxWidth: "440px",
                        backgroundColor: "#111B21",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "20px",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.95), 0 0 30px rgba(0,168,132,0.15)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* ── Header ── */}
                    <div style={{
                        padding: "14px 18px",
                        backgroundColor: "#1F2C34",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{
                                width: 38, height: 38, borderRadius: "50%",
                                backgroundColor: "#00A884",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.2rem"
                            }}>
                                👤
                            </div>
                            <div>
                                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#E9EDEF" }}>
                                    Nuevo contacto
                                </div>
                                <div style={{ fontSize: "0.74rem", color: "#8696A0" }}>
                                    Añade a alguien a tu RED P2P cifrada
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            style={{ background: "transparent", border: "none", color: "#8696A0", fontSize: "1.3rem", cursor: "pointer", padding: "4px 8px" }}
                        >✕</button>
                    </div>

                    {/* ── Form ── */}
                    <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>

                        {/* Name field */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "0.74rem", color: "#8696A0", fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase" }}>
                                Nombre / Alias
                            </label>
                            <input
                                id="new-contact-name"
                                type="text"
                                placeholder="Ej. Mamá, Carlos, Compañero..."
                                value={name}
                                onChange={e => setName(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && isValid && handleSave()}
                                maxLength={60}
                                autoComplete="off"
                                style={inputBase}
                                onFocus={e => (e.target.style.borderColor = "rgba(0,168,132,0.5)")}
                                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                            />
                        </div>

                        {/* DID field */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "0.74rem", color: "#8696A0", fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase" }}>
                                Identificador RED <span style={{ color: "#FF3355" }}>*</span>
                            </label>
                            <div style={{ position: "relative", display: "flex", gap: "8px" }}>
                                <input
                                    id="new-contact-did"
                                    type="text"
                                    placeholder="did:red:... o hash de 64 caracteres"
                                    value={did}
                                    onChange={e => handleDidChange(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && isValid && handleSave()}
                                    autoCorrect="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    style={{
                                        ...inputBase,
                                        fontFamily: "monospace",
                                        fontSize: "0.78rem",
                                        borderColor: didError ? "rgba(255,51,85,0.5)" : "rgba(255,255,255,0.1)",
                                        flex: 1,
                                    }}
                                    onFocus={e => (e.target.style.borderColor = didError ? "rgba(255,51,85,0.7)" : "rgba(0,168,132,0.5)")}
                                    onBlur={e => (e.target.style.borderColor = didError ? "rgba(255,51,85,0.5)" : "rgba(255,255,255,0.1)")}
                                />
                                {/* Paste */}
                                <button
                                    onClick={handlePaste}
                                    title="Pegar del portapapeles"
                                    style={{
                                        flexShrink: 0,
                                        width: 40, height: 40,
                                        borderRadius: "10px",
                                        backgroundColor: "#202C33",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: "#8696A0",
                                        fontSize: "1.05rem",
                                        cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        transition: "background 0.15s",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "#2A3942")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "#202C33")}
                                >
                                    📋
                                </button>
                                {/* QR */}
                                <button
                                    onClick={() => setShowQr(true)}
                                    title="Escanear código QR"
                                    style={{
                                        flexShrink: 0,
                                        width: 40, height: 40,
                                        borderRadius: "10px",
                                        backgroundColor: "rgba(0,168,132,0.15)",
                                        border: "1px solid rgba(0,168,132,0.3)",
                                        color: "#00A884",
                                        fontSize: "1.05rem",
                                        cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        transition: "background 0.15s",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,168,132,0.25)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,168,132,0.15)")}
                                >
                                    📷
                                </button>
                            </div>
                            {didError && (
                                <div style={{ fontSize: "0.72rem", color: "#FF3355", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                                    ⚠ {didError}
                                </div>
                            )}
                            {did.trim() && !didError && (
                                <div style={{ fontSize: "0.72rem", color: "#00A884", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                                    ✓ Formato válido
                                </div>
                            )}
                        </div>

                        {/* Save Button */}
                        <button
                            id="new-contact-save-btn"
                            onClick={handleSave}
                            disabled={!isValid || isSaving}
                            style={{
                                width: "100%",
                                padding: "13px",
                                backgroundColor: isValid && !isSaving ? "#00A884" : "#005C4B",
                                border: "none",
                                borderRadius: "12px",
                                color: "#FFFFFF",
                                fontSize: "0.92rem",
                                fontWeight: 700,
                                cursor: isValid && !isSaving ? "pointer" : "not-allowed",
                                opacity: isValid && !isSaving ? 1 : 0.65,
                                transition: "background 0.2s, opacity 0.2s",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                            }}
                            onMouseEnter={e => { if (isValid && !isSaving) e.currentTarget.style.background = "#02906f"; }}
                            onMouseLeave={e => { if (isValid && !isSaving) e.currentTarget.style.background = "#00A884"; }}
                        >
                            {isSaving ? (
                                <>⏳ Guardando contacto...</>
                            ) : (
                                <>✅ Guardar contacto</>
                            )}
                        </button>

                        <div style={{ fontSize: "0.71rem", color: "#8696A0", textAlign: "center", lineHeight: 1.4 }}>
                            El contacto se almacena cifrado localmente. Solo tú puedes leerlo.
                        </div>
                    </div>
                </div>
            </div>

            {/* QR Scanner (pasará la hash detectada al campo DID) */}
            {showQr && (
                <ContactQrModal
                    isOpen={showQr}
                    initialTab="scan"
                    onClose={() => setShowQr(false)}
                />
            )}
        </>
    );
};

export default NewContactModal;
