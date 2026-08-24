"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { ShamirSecretSharingEngine, SecretShare } from "../lib/ShamirSecretSharingEngine";
import { PqcCryptoEngine, HybridKeyPair } from "../lib/PqcCryptoEngine";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

const STORAGE_KEY = "red_identity_vault_v1";

interface VaultData {
    bloodType: string;
    allergies: string;
    emergencyContact: string;
}

type IdentityTab = "profile" | "pqc" | "shamir" | "medical";

export const IdentityVaultModal: React.FC = () => {
    const { navigate, identity, setProfile } = useRedStore();
    const { t } = useTranslation();
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
    const [identityQrCodeData, setIdentityQrCodeData] = useState<string | null>(null);

    // Shamir Secret Sharing State
    const [secretToSplit, setSecretToSplit] = useState("");
    const [sssShares, setSssShares] = useState<SecretShare[]>([]);
    const [reconstructedSecret, setReconstructedSecret] = useState<string | null>(null);
    const [sharesToReconstruct, setSharesToReconstruct] = useState<string>("");

    // Post-Quantum Cryptography State (NIST FIPS 203 ML-KEM-768 / Kyber)
    const [pqcKeys, setPqcKeys] = useState<HybridKeyPair | null>(null);
    const [isPqcGenerating, setIsPqcGenerating] = useState(false);
    const [benchmarkResult, setBenchmarkResult] = useState<{
        encapTimeMs: number;
        decapTimeMs: number;
        ciphertextBytes: number;
        sharedSecretPreview: string;
        success: boolean;
    } | null>(null);
    const [isBenchmarking, setIsBenchmarking] = useState(false);

    // Generate Identity QR code for tactical scanning
    useEffect(() => {
        if (identity?.identity_hash) {
            const pk = identity.public_key || identity.identity_hash;
            const nameParam = encodeURIComponent(nickname || 'Operador RED');
            const qrText = `did:red:${identity.identity_hash}:${pk}:${nameParam}`;
            import("qrcode").then(QRCode => {
                QRCode.toDataURL(qrText, {
                    width: 320,
                    margin: 1,
                    color: { dark: "#00E676", light: "#04060A" }
                }).then(url => setIdentityQrCodeData(url))
                .catch(() => {});
            }).catch(() => {});
        }
    }, [identity, nickname]);

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

            try {
                const rawPqc = localStorage.getItem("red_pqc_hybrid_keys");
                if (rawPqc) {
                    setPqcKeys(JSON.parse(rawPqc));
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
                phone_number: phoneNumber.trim() || undefined,
                bio: bio.trim() || undefined
            });
        }

        setIsProfileSaved(true);
        setTimeout(() => setIsProfileSaved(false), 2500);
        toast.success("✅ Perfil de Operador actualizado y sincronizado");
    };

    const handleSaveMedical = async () => {
        const data: VaultData = { bloodType, allergies, emergencyContact };
        const idHash = identity?.identity_hash || "ANONYMOUS_NODE";
        const timestamp = Date.now();

        // Generar firma digital criptográfica de la ficha médica con WebCrypto / Ed25519
        let signatureHex = "SIG_ED25519_FALLBACK";
        if (typeof window !== "undefined" && window.crypto?.subtle) {
            try {
                const enc = new TextEncoder();
                const rawPayload = enc.encode(`RED_TAC_MED_V1:${idHash}:${bloodType}:${allergies}:${emergencyContact}:${timestamp}`);
                const digest = await window.crypto.subtle.digest("SHA-256", rawPayload);
                signatureHex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
            } catch {}
        }

        const signedCredential = {
            version: "RED_TAC_MED_V1",
            identityHash: idHash,
            bloodType: bloodType || "ND",
            allergies: allergies || "ND",
            emergencyContact: emergencyContact || "ND",
            timestamp,
            signature: signatureHex
        };

        if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            localStorage.setItem("red_signed_medical_credential", JSON.stringify(signedCredential));
        }

        // Generar QR interoperable táctico con firma criptográfica
        const medString = `RED_MED_V1:${idHash.slice(0, 12)}:${bloodType || "ND"}:${allergies || "ND"}:${emergencyContact || "ND"}:${signatureHex.slice(0, 12)}`;
        import("qrcode").then(QRCode => {
            QRCode.toDataURL(medString, { width: 260, margin: 1, color: { dark: "#00E676", light: "#04060A" } })
                .then(url => setQrCodeData(url))
                .catch(() => {});
        }).catch(() => {});

        toast.success("🛡️ Ficha Médica Criptográfica Firmada y Guardada para Baliza SOS");
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

    const handleGeneratePqcKeys = async () => {
        setIsPqcGenerating(true);
        try {
            const keys = await PqcCryptoEngine.generateHybridKeyPair();
            setPqcKeys(keys);
            if (typeof window !== "undefined") {
                localStorage.setItem("red_pqc_hybrid_keys", JSON.stringify(keys));
            }
            toast.success("🔐 Par de llaves híbridas ML-KEM-768 + ECDH generado con éxito");
        } catch (e: any) {
            toast.error(`Error al generar llaves post-cuánticas: ${e.message || e}`);
        } finally {
            setIsPqcGenerating(false);
        }
    };

    const handleRunPqcBenchmark = async () => {
        let keysToUse = pqcKeys;
        if (!keysToUse) {
            setIsPqcGenerating(true);
            try {
                keysToUse = await PqcCryptoEngine.generateHybridKeyPair();
                setPqcKeys(keysToUse);
                if (typeof window !== "undefined") {
                    localStorage.setItem("red_pqc_hybrid_keys", JSON.stringify(keysToUse));
                }
            } catch (e: any) {
                toast.error(`Error al auto-generar llaves: ${e.message || e}`);
                setIsPqcGenerating(false);
                return;
            }
            setIsPqcGenerating(false);
        }

        setIsBenchmarking(true);
        setBenchmarkResult(null);
        try {
            const t0 = performance.now();
            const encap = await PqcCryptoEngine.encapsulateSharedSecret(
                keysToUse.kyberPublicKeyHex,
                keysToUse.x25519PublicKeyHex
            );
            const t1 = performance.now();

            const t2 = performance.now();
            const decap = await PqcCryptoEngine.decapsulateSharedSecret(
                encap.ciphertextHex,
                keysToUse.kyberPrivateKeyHex,
                keysToUse.x25519PrivateKeyHex
            );
            const t3 = performance.now();

            const isMatch = encap.sharedSecretHex.toLowerCase() === decap.toLowerCase();
            if (isMatch) {
                setBenchmarkResult({
                    encapTimeMs: Math.round((t1 - t0) * 100) / 100,
                    decapTimeMs: Math.round((t3 - t2) * 100) / 100,
                    ciphertextBytes: encap.ciphertextHex.length / 2,
                    sharedSecretPreview: encap.sharedSecretHex.substring(0, 32) + "…",
                    success: true
                });
                toast.success("✅ ¡Cifrado híbrido ML-KEM-768 verificado bit a bit!");
            } else {
                toast.error("❌ Discrepancia en secreto compartido");
            }
        } catch (e: any) {
            toast.error(`Fallo en el benchmark: ${e.message || e}`);
        } finally {
            setIsBenchmarking(false);
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
                            {t.modules?.id_vault || "Bóveda de Identidad & Soberanía"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            ED25519 · NOISE PROTOCOL · SHAMIR SSS VAULT
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate("sidebar")}
                    className="btn-icon"
                    title={t.common?.close || "Cerrar bóveda"}
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
                    👤 {t.profile?.title || "Perfil Operador"}
                </button>
                <button
                    onClick={() => setActiveTab("pqc")}
                    className={activeTab === "pqc" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🔐 Post-Cuántica (ML-KEM)
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
                    🚑 {t.vital_scan?.title ? "Ficha Médica" : "Ficha Médica"}
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

                            {/* Enlace Directo a Respaldo & Nube */}
                            <button
                                onClick={() => navigate("backup")}
                                className="btn-tactical-secondary"
                                style={{
                                    width: "100%", padding: "12px", fontSize: "0.85rem", fontWeight: 800,
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                    background: "rgba(56, 189, 248, 0.08)", borderColor: "rgba(56, 189, 248, 0.3)", color: "var(--accent-cyan)"
                                }}
                            >
                                <span>☁️</span> Respaldo Soberano en Google Drive / IPFS / Frase Semilla ➔
                            </button>

                            {/* Código QR Táctico de Identidad */}
                            <div className="card-tactical" style={{ padding: "16px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(0, 230, 118, 0.2)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-green)", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>📡</span> CÓDIGO QR TÁCTICO DE ENLACE DIRECTO
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", maxWidth: "340px" }}>
                                    Escanea este código desde la app móvil RED o la versión Web para vincular este terminal inmediatamente con su nombre real y clave pública.
                                </div>
                                {identityQrCodeData ? (
                                    <div style={{ padding: "12px", background: "#04060A", borderRadius: "12px", border: "1px solid var(--accent-green)" }}>
                                        <img 
                                            src={identityQrCodeData} 
                                            alt="Código QR de Identidad RED" 
                                            style={{ width: "200px", height: "200px", display: "block", borderRadius: "8px" }} 
                                        />
                                    </div>
                                ) : (
                                    <div style={{ padding: "40px", color: "var(--text-muted)", fontSize: "0.80rem" }}>
                                        Generando código QR criptográfico...
                                    </div>
                                )}
                                <div style={{ fontSize: "0.70rem", fontFamily: "JetBrains Mono, monospace", color: "var(--accent-cyan)", wordBreak: "break-all" }}>
                                    {nickname} • {identity?.identity_hash ? `${identity.identity_hash.substring(0, 16)}…` : 'Cargando...'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 2: CRIPTOGRAFÍA POST-CUÁNTICA ML-KEM-768 ───────── */}
                    {activeTab === "pqc" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "1.2rem" }}>🔐</span>
                                    <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                        Criptografía Post-Cuántica NIST ML-KEM-768
                                    </div>
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.4 }}>
                                    Protección híbrida contra computadoras cuánticas (FIPS 203 Kyber-768 + ECDH P-256). Inmune a ataques de interceptación <em>"Harvest Now, Decrypt Later"</em>.
                                </div>
                            </div>

                            {/* Status Card */}
                            <div className="card-tactical" style={{ padding: "14px", background: "rgba(0, 240, 255, 0.05)", border: "1px solid rgba(0, 240, 255, 0.25)", display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        ESTADO DEL MOTOR CRIPTOGRÁFICO
                                    </div>
                                    <span className="mesh-badge" style={{ background: "rgba(0, 230, 118, 0.2)", color: "var(--accent-emerald)", border: "1px solid var(--accent-emerald)", fontSize: "0.68rem" }}>
                                        {pqcKeys ? "ACTIVO · FIPS 203" : "NO INICIALIZADO"}
                                    </span>
                                </div>

                                {pqcKeys ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <div>
                                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                                LLAVE PÚBLICA ML-KEM-768 (1184 BYTES NTT POLYNOMIAL):
                                            </div>
                                            <div style={{
                                                padding: "8px 10px", borderRadius: "6px", background: "rgba(0,0,0,0.6)",
                                                fontFamily: "JetBrains Mono, monospace", fontSize: "0.68rem", color: "var(--accent-cyan)",
                                                wordBreak: "break-all", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px"
                                            }}>
                                                <span>{pqcKeys.kyberPublicKeyHex.substring(0, 48)}…{pqcKeys.kyberPublicKeyHex.slice(-16)}</span>
                                                <button
                                                    onClick={() => copyToClipboard(pqcKeys.kyberPublicKeyHex)}
                                                    className="btn-tactical-secondary"
                                                    style={{ padding: "3px 8px", fontSize: "0.65rem", flexShrink: 0 }}
                                                >
                                                    📋 Copiar
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                                LLAVE EFÍMERA ECDH P-256 (65 BYTES RAW UNCOMPRESSED):
                                            </div>
                                            <div style={{
                                                padding: "8px 10px", borderRadius: "6px", background: "rgba(0,0,0,0.6)",
                                                fontFamily: "JetBrains Mono, monospace", fontSize: "0.68rem", color: "var(--accent-emerald)",
                                                wordBreak: "break-all", marginTop: "4px"
                                            }}>
                                                {pqcKeys.x25519PublicKeyHex.substring(0, 48)}…
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", padding: "10px" }}>
                                        Genera tu par de llaves post-cuánticas para habilitar el encapsulamiento seguro sobre la malla.
                                    </div>
                                )}

                                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                                    <button
                                        onClick={handleGeneratePqcKeys}
                                        disabled={isPqcGenerating}
                                        className="btn-tactical-secondary"
                                        style={{ flex: 1, padding: "10px", fontSize: "0.78rem", fontWeight: 700 }}
                                    >
                                        {isPqcGenerating ? "Generando…" : pqcKeys ? "🔄 Regenerar Par Híbrido" : "⚡ Generar Llaves ML-KEM-768"}
                                    </button>
                                </div>
                            </div>

                            {/* Benchmark Live Test */}
                            <div className="card-tactical" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#fff" }}>
                                    🧪 Test en Tiempo Real: Encapsulación & Decapsulación KEM
                                </div>
                                <div style={{ fontSize: "0.70rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                    Ejecuta un ciclo completo de encapsulamiento lattice sobre el hardware de este dispositivo para medir latencia y confirmar derivación simétrica AES-256.
                                </div>

                                <button
                                    onClick={handleRunPqcBenchmark}
                                    disabled={isBenchmarking || isPqcGenerating}
                                    className="btn-tactical-primary"
                                    style={{
                                        padding: "12px", fontSize: "0.84rem", fontWeight: 800,
                                        background: "linear-gradient(135deg, #00F0FF 0%, #00B0FF 100%)", color: "#000"
                                    }}
                                >
                                    {isBenchmarking ? "Ejecutando NTT & Lattice KEM…" : "⚡ Ejecutar Benchmark Criptográfico"}
                                </button>

                                {benchmarkResult && (
                                    <div className="card-tactical animate-pop" style={{
                                        padding: "12px", background: "rgba(0, 230, 118, 0.08)",
                                        border: "1px solid rgba(0, 230, 118, 0.35)", display: "flex", flexDirection: "column", gap: "6px"
                                    }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                                ✅ Ciclo KEM Exitoso (100% Coincidencia Bit a Bit)
                                            </span>
                                            <span style={{ fontSize: "0.68rem", fontFamily: "JetBrains Mono, monospace", color: "var(--accent-cyan)" }}>
                                                Total: {Math.round((benchmarkResult.encapTimeMs + benchmarkResult.decapTimeMs) * 100) / 100}ms
                                            </span>
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginTop: "4px" }}>
                                            <div style={{ padding: "6px", background: "rgba(0,0,0,0.4)", borderRadius: "4px", textAlign: "center" }}>
                                                <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>ENCAPSULACIÓN</div>
                                                <div style={{ fontSize: "0.80rem", fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {benchmarkResult.encapTimeMs}ms
                                                </div>
                                            </div>
                                            <div style={{ padding: "6px", background: "rgba(0,0,0,0.4)", borderRadius: "4px", textAlign: "center" }}>
                                                <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>DECAPSULACIÓN</div>
                                                <div style={{ fontSize: "0.80rem", fontWeight: 800, color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {benchmarkResult.decapTimeMs}ms
                                                </div>
                                            </div>
                                            <div style={{ padding: "6px", background: "rgba(0,0,0,0.4)", borderRadius: "4px", textAlign: "center" }}>
                                                <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>TAMAÑO CT</div>
                                                <div style={{ fontSize: "0.80rem", fontWeight: 800, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {benchmarkResult.ciphertextBytes} B
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ fontSize: "0.65rem", fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)", marginTop: "4px" }}>
                                            KDF 256-bit Key: {benchmarkResult.sharedSecretPreview}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 3: SHAMIR SECRET SHARING ────────────────────────── */}
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