"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { ShamirSecretSharingEngine, SecretShare } from "../lib/ShamirSecretSharingEngine";
import { toast } from "./Toast";

const STORAGE_KEY = "red_identity_vault_v1";

interface VaultData {
    bloodType: string;
    allergies: string;
    emergencyContact: string;
}

type IdentityTab = "profile" | "shamir" | "medical";

export const IdentityVaultModal: React.FC = () => {
    const { navigate, identity, setProfile } = useRedStore();
    const [activeTab, setActiveTab] = useState<IdentityTab>("profile");

    // Profile State
    const [nickname, setNickname] = useState(identity?.nickname || "Operador RED");
    const [bio, setBio] = useState("");
    const [phoneNumber, setPhoneNumber] = useState(identity?.phone_number || "");
    const [isProfileSaved, setIsProfileSaved] = useState(false);

    // Emergency Vault State
    const [bloodType, setBloodType] = useState("");
    const [allergies, setAllergies] = useState("");
    const [emergencyContact, setEmergencyContact] = useState("");
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);

    // Shamir Secret Sharing State
    const [secretToSplit, setSecretToSplit] = useState("");
    const [sssShares, setSssShares] = useState<SecretShare[]>([]);
    const [reconstructedSecret, setReconstructedSecret] = useState<string | null>(null);
    const [sharesToReconstruct, setSharesToReconstruct] = useState<string>("");

    // Initial Load
    useEffect(() => {
        if (identity?.nickname) setNickname(identity.nickname);
        if (identity?.phone_number) setPhoneNumber(identity.phone_number);

        if (typeof window !== "undefined") {
            const savedBio = localStorage.getItem("user_bio");
            if (savedBio) setBio(savedBio);
            const savedPhone = localStorage.getItem("user_phone_number");
            if (savedPhone) setPhoneNumber(savedPhone);

            try {
                const rawVault = localStorage.getItem(STORAGE_KEY);
                if (rawVault) {
                    const data = JSON.parse(rawVault) as VaultData;
                    setBloodType(data.bloodType || "");
                    setAllergies(data.allergies || "");
                    setEmergencyContact(data.emergencyContact || "");
                }
            } catch {}
        }
    }, [identity]);

    const handleSaveProfile = () => {
        if (!nickname.trim()) {
            toast.error("El nickname no puede estar vacío");
            return;
        }

        if (typeof window !== "undefined") {
            localStorage.setItem("user_bio", bio);
            localStorage.setItem("user_phone_number", phoneNumber);
        }

        if (setProfile) {
            setProfile({
                nickname: nickname.trim(),
                phone_number: phoneNumber.trim() || undefined
            });
        }

        setIsProfileSaved(true);
        setTimeout(() => setIsProfileSaved(false), 2500);
        toast.success("✅ Perfil de Operador actualizado");
    };

    const handleSaveMedical = () => {
        const data: VaultData = { bloodType, allergies, emergencyContact };
        if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }

        // Generate QR string for triage
        const medString = `RED_MED:${bloodType || "ND"}:${allergies || "ND"}:${emergencyContact || "ND"}`;
        import("qrcode").then(QRCode => {
            QRCode.toDataURL(medString, { width: 220, margin: 1, color: { dark: "#00E676", light: "#04060A" } })
                .then(url => setQrCodeData(url))
                .catch(() => {});
        }).catch(() => {});

        toast.success("💾 Ficha médica de emergencia guardada");
    };

    const handleSplitSecret = () => {
        if (!secretToSplit.trim()) {
            toast.warning("Ingresa la clave o secreto que deseas fragmentar");
            return;
        }

        try {
            const shares = ShamirSecretSharingEngine.splitSecret(secretToSplit.trim(), 5, 3);
            setSssShares(shares);
            toast.success("🧬 Clave fragmentada en 5 partes (Umbral: 3 partes requeridas)");
        } catch {
            toast.error("Error al calcular fragmentos Shamir");
        }
    };

    const handleReconstruct = () => {
        try {
            const rawLines = sharesToReconstruct.split("\n").map(l => l.trim()).filter(Boolean);
            if (rawLines.length < 3) {
                toast.warning("Se requieren al menos 3 fragmentos para reconstruir");
                return;
            }

            const parsedShares: SecretShare[] = rawLines.map(line => {
                const parts = line.split(":");
                return {
                    shareIndex: parseInt(parts[0], 10),
                    shareHex: parts[1] || "",
                    x: parseInt(parts[0], 10),
                    yHex: parts[1] || "",
                    threshold: 3,
                    totalShares: 5
                };
            });

            const recovered = ShamirSecretSharingEngine.reconstructSecret(parsedShares);
            setReconstructedSecret(recovered);
            toast.success("🔓 ¡Secreto reconstruido con éxito!");
        } catch {
            toast.error("Error al reconstruir el secreto. Verifica los fragmentos.");
        }
    };

    const copyToClipboard = (text: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast.success("Copiado al portapapeles");
        }
    };

    const did = identity?.identity_hash ? `did:red:${identity.identity_hash}` : "did:red:sovereign_node";

    return (
        <div className="modal-screen-container">
            {/* Header Táctico */}
            <header className="safe-header" style={{
                padding: "12px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,229,255,0.35)"
                    }}>🔐</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Bóveda de Identidad & Soberanía
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            ED25519 · NOISE PROTOCOL · SHAMIR SSS VAULT
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate("sidebar")}
                    className="btn-icon"
                    title="Cerrar bóveda"
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Selector de Pestañas Segmentadas Tácticas */}
            <div style={{
                padding: "10px 16px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border)",
                overflowX: "auto", flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("profile")}
                    className={activeTab === "profile" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    👤 Perfil Operador
                </button>
                <button
                    onClick={() => setActiveTab("shamir")}
                    className={activeTab === "shamir" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🧬 Fragmentación Shamir
                </button>
                <button
                    onClick={() => setActiveTab("medical")}
                    className={activeTab === "medical" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🚑 Ficha Médica
                </button>
            </div>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ─── TAB 1: PERFIL DEL OPERADOR ──────────────────────────── */}
                    {activeTab === "profile" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            {/* Tarjeta DID Soberana */}
                            <div className="card-tactical" style={{ padding: "14px", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        Identificador Descentralizado (DID)
                                    </div>
                                    <div style={{ fontSize: "0.82rem", fontFamily: "JetBrains Mono, monospace", color: "var(--accent-cyan)", fontWeight: 700, marginTop: "2px" }}>
                                        {did.substring(0, 28)}…
                                    </div>
                                </div>
                                <button
                                    onClick={() => copyToClipboard(did)}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                                >
                                    📋 Copiar
                                </button>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    NICKNAME DEL OPERADOR:
                                </label>
                                <input
                                    value={nickname}
                                    onChange={e => setNickname(e.target.value)}
                                    placeholder="Nombre de guerra o identificador"
                                />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    BIOGRAFÍA / ESPECIALIDAD TÁCTICA:
                                </label>
                                <textarea
                                    value={bio}
                                    onChange={e => setBio(e.target.value)}
                                    rows={3}
                                    placeholder="Operador de enlace P2P, médico de campo, etc."
                                />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    TELÉFONO DE ENLACE DE EMERGENCIA (OPCIONAL):
                                </label>
                                <input
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    placeholder="+54 9 11 ..."
                                />
                            </div>

                            <button
                                onClick={handleSaveProfile}
                                className="btn-tactical-primary"
                                style={{ width: "100%", padding: "14px", fontSize: "0.95rem" }}
                            >
                                {isProfileSaved ? "✅ GUARDADO" : "💾 ACTUALIZAR PERFIL DE OPERADOR"}
                            </button>
                        </div>
                    )}

                    {/* ─── TAB 2: SHAMIR SECRET SHARING ────────────────────────── */}
                    {activeTab === "shamir" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                    🧬 Custodia Distribuida de Claves (Shamir's SSS)
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Divide una clave secreta en 5 partes matemáticas. Se necesitan 3 partes cualesquiera para reconstruirla.
                                </div>
                            </div>

                            {/* Creador de Fragmentos */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    CLAVE O FRASE SEMILLA A FRAGMENTAR:
                                </label>
                                <input
                                    type="password"
                                    value={secretToSplit}
                                    onChange={e => setSecretToSplit(e.target.value)}
                                    placeholder="Ingresa la clave privada o secreto..."
                                />
                            </div>

                            <button
                                onClick={handleSplitSecret}
                                className="btn-tactical-primary"
                                style={{ width: "100%", padding: "12px", fontSize: "0.90rem", background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)", color: "#000" }}
                            >
                                ⚡ FRAGMENTAR CLAVE (3-DE-5)
                            </button>

                            {/* Lista de Fragmentos Generados */}
                            {sssShares.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <div style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                        Fragmentos Generados (Distribuye uno a cada custodio):
                                    </div>
                                    {sssShares.map((s, i) => (
                                        <div
                                            key={i}
                                            className="card-tactical"
                                            style={{ padding: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}
                                        >
                                            <span>Parte {s.x || s.shareIndex}: {(s.yHex || s.shareHex || "").substring(0, 20)}…</span>
                                            <button
                                                onClick={() => copyToClipboard(`${s.x || s.shareIndex}:${s.yHex || s.shareHex || ""}`)}
                                                className="btn-tactical-secondary"
                                                style={{ padding: "4px 8px", fontSize: "0.70rem" }}
                                            >
                                                📋 Copiar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Reconstructor de Secreto */}
                            <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                                    🔓 Reconstruir Secreto (Pega al menos 3 fragmentos)
                                </div>
                                <textarea
                                    value={sharesToReconstruct}
                                    onChange={e => setSharesToReconstruct(e.target.value)}
                                    rows={3}
                                    placeholder="Pega un fragmento por línea (ej: 1:a9f0b2...)"
                                    style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.78rem" }}
                                />
                                <button
                                    onClick={handleReconstruct}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "10px", fontSize: "0.85rem" }}
                                >
                                    🔓 RECONSTRUIR SECRETO
                                </button>

                                {reconstructedSecret && (
                                    <div className="card-tactical animate-pop" style={{ padding: "12px", background: "rgba(0,230,118,0.1)", borderColor: "var(--accent-emerald)" }}>
                                        <div style={{ fontSize: "0.72rem", color: "var(--accent-emerald)", fontWeight: 700 }}>
                                            SECRETO RECONSTRUIDO:
                                        </div>
                                        <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "#fff", marginTop: "2px" }}>
                                            {reconstructedSecret}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 3: FICHA MÉDICA DE EMERGENCIA ───────────────────── */}
                    {activeTab === "medical" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-crimson-bright)" }}>
                                    🚑 Ficha Médica para Rescate Offline
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Datos vitales accesibles mediante código QR en caso de inconsciencia o rescate
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    GRUPO SANGUÍNEO & FACTOR RH:
                                </label>
                                <input
                                    value={bloodType}
                                    onChange={e => setBloodType(e.target.value)}
                                    placeholder="Ej: O+, A-, AB+..."
                                />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    ALERGIAS O CONDICIONES CRÍTICAS:
                                </label>
                                <input
                                    value={allergies}
                                    onChange={e => setAllergies(e.target.value)}
                                    placeholder="Ej: Penicilina, Diabético, Asma..."
                                />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    CONTACTO DE EMERGENCIA / ICE:
                                </label>
                                <input
                                    value={emergencyContact}
                                    onChange={e => setEmergencyContact(e.target.value)}
                                    placeholder="Nombre y teléfono de contacto familiar"
                                />
                            </div>

                            <button
                                onClick={handleSaveMedical}
                                className="btn-tactical-primary"
                                style={{ width: "100%", padding: "14px", fontSize: "0.95rem", background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)" }}
                            >
                                💾 GUARDAR & GENERAR QR MÉDICO
                            </button>

                            {qrCodeData && (
                                <div className="card-tactical animate-pop" style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", background: "#04060A" }}>
                                    <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                        QR de Triaje Médico Listo
                                    </div>
                                    <img src={qrCodeData} alt="QR Médico" style={{ width: "180px", height: "180px", display: "block", borderRadius: "8px" }} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};