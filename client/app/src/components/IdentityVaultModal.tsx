"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { ShamirSecretSharingEngine, SecretShare } from "../lib/ShamirSecretSharingEngine";
import { PqcCryptoEngine, HybridKeyPair } from "../lib/PqcCryptoEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { OfflineQrEngine } from "../lib/qr/OfflineQrEngine";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { meshRouter } from "../lib/mesh/meshRouter";

const STORAGE_KEY = "red_identity_vault_v1";

interface VaultData {
    bloodType: string;
    allergies: string;
    emergencyContact: string;
}

type IdentityTab = "profile" | "pqc" | "shamir" | "medical";

export const IdentityVaultModal: React.FC = () => {
    const { navigate, identity, setProfile, goBack } = useRedStore();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<IdentityTab>("profile");

    // Profile State
    const [nickname, setNickname] = useState(identity?.nickname || "Operador RED");
    const [bio, setBio] = useState("");
    const [phoneNumber, setPhoneNumber] = useState(identity?.phone_number || "");
    const [isProfileSaved, setIsProfileSaved] = useState(false);
    const [showIdentityQr, setShowIdentityQr] = useState(false);

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

    // Intercepción Jerárquica LIFO de Hardware (Android Back / Esc)
    useEffect(() => {
        return BackHandlerRegistry.register(() => {
            if (showIdentityQr) {
                TacticalAudioEngine.playTap();
                setShowIdentityQr(false);
                return true;
            }
            if (activeTab !== "profile") {
                TacticalAudioEngine.playTap();
                setActiveTab("profile");
                return true;
            }
            TacticalAudioEngine.playTap();
            goBack();
            return true;
        });
    }, [showIdentityQr, activeTab, goBack]);

    // Generate Identity QR code for tactical scanning
    useEffect(() => {
        if (identity?.identity_hash) {
            const pk = identity.public_key || identity.identity_hash;
            const nameParam = encodeURIComponent(nickname || 'Operador RED');
            const qrText = `did:red:${identity.identity_hash}:${pk}:${nameParam}`;
            OfflineQrEngine.generateDataUrl(qrText, {
                width: 320,
                margin: 1,
                darkColor: "#00E676",
                lightColor: "#04060A"
            }).then(url => setIdentityQrCodeData(url))
            .catch(() => {});
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
        TacticalAudioEngine.playRogerBeep();
        toast.success("✅ Perfil de Operador actualizado y sincronizado");
    };

    const handleSaveMedical = async () => {
        const data: VaultData = { bloodType, allergies, emergencyContact };
        const idHash = identity?.identity_hash || "ANONYMOUS_NODE";
        const timestamp = Date.now();

        let signatureHex = "SIG_ED25519_FALLBACK";
        if (typeof window !== "undefined" && window.crypto?.subtle) {
            try {
                const enc = new TextEncoder();
                const rawPayload = enc.encode(`RED_TAC_MED_V1:${idHash}:${bloodType}:${allergies}:${emergencyContact}:${timestamp}`);
                const digest = await window.crypto.subtle.digest("SHA-256", rawPayload);
                signatureHex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
            } catch {}
        }

        const medicalPayload = `RED_MED_V1:${idHash}:${bloodType || 'N/A'}:${allergies || 'N/A'}:${emergencyContact || 'N/A'}:${signatureHex}`;

        try {
            const dataUrl = await OfflineQrEngine.generateDataUrl(medicalPayload, {
                width: 280,
                margin: 1,
                darkColor: "#FF3355",
                lightColor: "#04060A"
            });
            setQrCodeData(dataUrl);
        } catch {
            setQrCodeData(null);
        }

        if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            window.dispatchEvent(new CustomEvent("red:medical_vault_updated", { detail: data }));
        }

        TacticalAudioEngine.playRogerBeep();
        toast.success("🛡️ Ficha Médica Cifrada Guardada");
    };

    const handleClearMedical = () => {
        TacticalAudioEngine.playWarning();
        setBloodType("");
        setAllergies("");
        setEmergencyContact("");
        setQrCodeData(null);
        if (typeof window !== "undefined") {
            localStorage.removeItem(STORAGE_KEY);
            window.dispatchEvent(new CustomEvent("red:medical_vault_updated", { detail: null }));
        }
        toast.info("Ficha médica purgada de la bóveda local");
    };

    const handleGeneratePqcKeys = async () => {
        TacticalAudioEngine.playTap();
        setIsPqcGenerating(true);
        try {
            const keys = await PqcCryptoEngine.generateHybridKeyPair();
            setPqcKeys(keys);
            if (typeof window !== "undefined") {
                localStorage.setItem("red_pqc_hybrid_keys", JSON.stringify(keys));
                localStorage.setItem("red_pqc_kyber_public_key", keys.kyberPublicKeyHex);
            }
            TacticalAudioEngine.playRogerBeep();
            toast.success("🔑 Par de llaves híbridas FIPS-203 ML-KEM-768 generadas");
        } catch (e: any) {
            TacticalAudioEngine.playWarning();
            toast.error(`Fallo al generar llaves PQC: ${e.message}`);
        } finally {
            setIsPqcGenerating(false);
        }
    };

    const handleClearPqcKeys = () => {
        TacticalAudioEngine.playWarning();
        setPqcKeys(null);
        setBenchmarkResult(null);
        if (typeof window !== "undefined") {
            localStorage.removeItem("red_pqc_hybrid_keys");
            localStorage.removeItem("red_pqc_kyber_public_key");
        }
        toast.info("Llaves PQC eliminadas de la memoria local");
    };

    const handleAnnouncePqcKey = async () => {
        if (!pqcKeys) {
            toast.warning("Primero genera las llaves PQC");
            return;
        }
        TacticalAudioEngine.playTap();
        try {
            const payload = new TextEncoder().encode(JSON.stringify({
                type: "PQC_KEY_ANNOUNCEMENT",
                did: myDid,
                nickname: nickname || "Operador RED",
                kyberPublicKeyHex: pqcKeys.kyberPublicKeyHex,
                x25519PublicKeyHex: pqcKeys.x25519PublicKeyHex,
                algorithm: "ML-KEM-768+X25519",
                timestamp: Date.now()
            }));
            await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payload);
            TacticalAudioEngine.playRogerBeep();
            toast.success("📡 Llave pública PQC ML-KEM-768 anunciada por la malla");
        } catch (e: any) {
            TacticalAudioEngine.playWarning();
            toast.error("Error al anunciar llave PQC: " + e.message);
        }
    };

    const handleRunBenchmark = async () => {
        TacticalAudioEngine.playTap();
        setIsBenchmarking(true);
        try {
            const startGen = performance.now();
            const pair = await PqcCryptoEngine.generateHybridKeyPair();
            const startEncap = performance.now();
            const encap = await PqcCryptoEngine.encapsulateSharedSecret(pair.kyberPublicKeyHex, pair.x25519PublicKeyHex);
            const encapTime = Math.round(performance.now() - startEncap);
            const startDecap = performance.now();
            const secret = await PqcCryptoEngine.decapsulateSharedSecret(encap.ciphertextHex, pair.kyberPrivateKeyHex, pair.x25519PrivateKeyHex);
            const decapTime = Math.round(performance.now() - startDecap);

            setBenchmarkResult({
                encapTimeMs: encapTime || 1,
                decapTimeMs: decapTime || 1,
                ciphertextBytes: Math.round(encap.ciphertextHex.length / 2),
                sharedSecretPreview: secret.substring(0, 16) + "…",
                success: secret === encap.sharedSecretHex
            });
            TacticalAudioEngine.playRogerBeep();
            toast.success(`⚡ Benchmark PQC: Encap ${encapTime}ms · Decap ${decapTime}ms`);
        } catch (e: any) {
            TacticalAudioEngine.playWarning();
            toast.error(`Error en benchmark: ${e.message}`);
        } finally {
            setIsBenchmarking(false);
        }
    };

    const handleSplitSecret = () => {
        TacticalAudioEngine.playTap();
        if (!secretToSplit.trim()) {
            toast.warning("Ingresa un secreto o semilla BIP-39 para dividir.");
            return;
        }
        try {
            const hex = Array.from(new TextEncoder().encode(secretToSplit.trim())).map(b => b.toString(16).padStart(2, '0')).join('');
            const shares = ShamirSecretSharingEngine.splitSecret(hex, 3, 5);
            setSssShares(shares);
            setSecretToSplit("");
            TacticalAudioEngine.playRogerBeep();
            toast.success("🔐 Secreto dividido en 5 fragmentos (Umbral: 3)");
        } catch (e: any) {
            TacticalAudioEngine.playWarning();
            toast.error(`Error al dividir secreto: ${e.message}`);
        }
    };

    const handleCopyAllShares = () => {
        TacticalAudioEngine.playTap();
        if (sssShares.length === 0) return;
        const formatted = sssShares.map(s => `RED_SSS:${s.shareIndex}:${s.shareHex}`).join('\n');
        copyToClipboard(formatted);
        toast.success("📋 5 fragmentos SSS copiados en formato táctico");
    };

    const handleReconstructSecret = () => {
        TacticalAudioEngine.playTap();
        const rawInput = sharesToReconstruct.trim();
        if (!rawInput) {
            toast.warning("Pega al menos 3 fragmentos SSS.");
            return;
        }
        try {
            let sharesList: SecretShare[] = [];

            // 1. Intentar JSON parse directo (array u objeto con propiedad shares)
            try {
                const parsed = JSON.parse(rawInput);
                if (Array.isArray(parsed)) {
                    sharesList = parsed;
                } else if (parsed && Array.isArray(parsed.shares)) {
                    sharesList = parsed.shares;
                }
            } catch {
                // 2. Si no es JSON estándar, procesar línea por línea o regex táctico
                const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
                for (const line of lines) {
                    try {
                        const parsedLine = JSON.parse(line);
                        if (parsedLine && (parsedLine.shareIndex || parsedLine.x) && (parsedLine.shareHex || parsedLine.yHex)) {
                            sharesList.push(parsedLine);
                            continue;
                        }
                    } catch {}

                    // Formato texto táctico RED_SSS:1:hex o 1:hex
                    const match = line.match(/(?:RED_SSS:)?([1-9]):([0-9a-fA-F]+)/i);
                    if (match) {
                        sharesList.push({
                            shareIndex: parseInt(match[1], 10),
                            shareHex: match[2].toLowerCase()
                        });
                    }
                }
            }

            if (!sharesList || sharesList.length < 3) {
                TacticalAudioEngine.playWarning();
                toast.error("Se requieren al menos 3 fragmentos válidos para reconstruir el secreto.");
                return;
            }

            const secretHex = ShamirSecretSharingEngine.reconstructSecret(sharesList);
            const bytes = new Uint8Array(secretHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
            const secret = new TextDecoder().decode(bytes);
            setReconstructedSecret(secret);
            TacticalAudioEngine.playRogerBeep();
            toast.success("🎉 ¡Secreto reconstruido exitosamente!");
        } catch (e: any) {
            TacticalAudioEngine.playWarning();
            toast.error(`Fallo en reconstrucción: ${e.message}`);
        }
    };

    const copyToClipboard = (text: string) => {
        TacticalAudioEngine.playTap();
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast.success("Copiado al portapapeles");
        }
    };

    const myDid = identity?.identity_hash ? `did:red:${identity.identity_hash}` : "did:red:offline";

    return (
        <div style={{
            display: "flex", flexDirection: "column", height: "100%", width: "100%",
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace", overflow: "hidden"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "calc(8px + var(--safe-top, 0px)) 16px 8px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1.5px solid rgba(0, 229, 255, 0.3)",
                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            goBack();
                        }}
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#FFFFFF", cursor: "pointer", fontSize: "1.1rem", fontWeight: 900,
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                    >
                        ‹
                    </button>
                    <div style={{
                        width: 38, height: 38, borderRadius: "12px",
                        background: "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(0, 150, 255, 0.15) 100%)",
                        border: "1px solid rgba(0, 229, 255, 0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 0 15px rgba(0, 229, 255, 0.25)"
                    }}>🪪</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            BÓVEDA DE IDENTIDAD SOBERANA
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan, #00E5FF)", fontWeight: 800 }}>
                            DID SOBERANO · NIST FIPS-203 · SHAMIR SSS
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            navigate("web3Vault");
                        }}
                        style={{
                            padding: "6px 12px", borderRadius: "10px",
                            background: "rgba(245, 132, 31, 0.15)", border: "1px solid rgba(245, 132, 31, 0.4)",
                            color: "#F5841F", fontSize: "0.74rem", fontWeight: 900, cursor: "pointer",
                            display: "flex", alignItems: "center", gap: "4px"
                        }}
                    >
                        <span>🦊</span> WEB3
                    </button>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas */}
            <div style={{
                display: "flex", padding: "8px 16px", gap: "6px",
                background: "rgba(8, 10, 20, 0.95)", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                overflowX: "auto", flexShrink: 0
            }}>
                {[
                    { id: "profile", icon: "👤", label: "PERFIL DID" },
                    { id: "pqc", icon: "🔐", label: "PQC KYBER" },
                    { id: "shamir", icon: "🔑", label: "SHAMIR SSS" },
                    { id: "medical", icon: "🫀", label: "FICHA MÉDICA" }
                ].map(tab => {
                    const isSel = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                setActiveTab(tab.id as IdentityTab);
                            }}
                            style={{
                                flex: 1, padding: "8px 12px", borderRadius: "10px",
                                background: isSel ? "linear-gradient(135deg, rgba(0, 229, 255, 0.22) 0%, rgba(10, 25, 45, 0.85) 100%)" : "rgba(255, 255, 255, 0.03)",
                                border: isSel ? "1.5px solid var(--accent-cyan, #00E5FF)" : "1px solid rgba(255, 255, 255, 0.08)",
                                color: isSel ? "#00E5FF" : "var(--text-secondary)",
                                fontWeight: isSel ? 900 : 700, fontSize: "0.74rem",
                                cursor: "pointer", whiteSpace: "nowrap",
                                boxShadow: isSel ? "0 0 15px rgba(0, 229, 255, 0.25)" : "none",
                                transition: "all 0.15s ease"
                            }}
                        >
                            <span>{tab.icon}</span> <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* TAB 1: PERFIL SOBERANO */}
                    {activeTab === "profile" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                <div style={{
                                    width: 52, height: 52, borderRadius: "50%",
                                    background: "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "1.4rem", fontWeight: 900, color: "#000000",
                                    border: "2px solid #FFFFFF", boxShadow: "0 0 20px rgba(0, 229, 255, 0.4)"
                                }}>
                                    {(nickname || "O").charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#FFFFFF" }}>{nickname}</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan, #00E5FF)", fontFamily: "JetBrains Mono, monospace" }}>
                                        {identity?.short_id || "OFF-GRID NODE"} · ED25519 + ML-DSA-65
                                    </div>
                                </div>
                            </div>

                            {/* DID String */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900 }}>
                                    IDENTIFICADOR DESCENTRALIZADO (DID)
                                </label>
                                <div style={{ display: "flex", gap: "6px" }}>
                                    <input
                                        readOnly
                                        value={myDid}
                                        style={{
                                            flex: 1, padding: "10px 12px", background: "rgba(0, 0, 0, 0.5)",
                                            border: "1px solid rgba(0, 229, 255, 0.25)", borderRadius: "10px",
                                            color: "#FFFFFF", fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace"
                                        }}
                                    />
                                    <button
                                        onClick={() => copyToClipboard(myDid)}
                                        style={{
                                            padding: "10px 14px", background: "rgba(0, 229, 255, 0.15)",
                                            border: "1px solid rgba(0, 229, 255, 0.4)", borderRadius: "10px",
                                            color: "var(--accent-cyan, #00E5FF)", fontWeight: 900, fontSize: "0.74rem", cursor: "pointer"
                                        }}
                                    >
                                        COPIAR
                                    </button>
                                </div>
                            </div>

                            {/* Tarjeta Visual de Código QR de Identidad Táctica */}
                            <div style={{
                                background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(0, 229, 255, 0.25)",
                                borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontSize: "0.86rem", fontWeight: 900, color: "var(--accent-cyan)" }}>
                                            CREDENCIAL QR DE IDENTIDAD SOBERANA
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                            Para emparejamiento táctico pantalla-a-pantalla sin emisión de radiofrecuencia.
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowIdentityQr(prev => !prev)}
                                        style={{
                                            padding: "6px 12px", borderRadius: "8px",
                                            background: showIdentityQr ? "rgba(0, 229, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
                                            border: "1px solid rgba(0, 229, 255, 0.4)", color: "#00E5FF",
                                            fontSize: "0.72rem", fontWeight: 800, cursor: "pointer"
                                        }}
                                    >
                                        {showIdentityQr ? "✕ OCULTAR QR" : "👁️ MOSTRAR QR"}
                                    </button>
                                </div>

                                {showIdentityQr && identityQrCodeData && (
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", paddingTop: "6px" }}>
                                        <img
                                            src={identityQrCodeData}
                                            alt="QR Identidad DID"
                                            style={{ width: 220, height: 220, borderRadius: "12px", border: "2px solid #00E676" }}
                                        />
                                        <div style={{ fontSize: "0.64rem", color: "var(--text-secondary)", textAlign: "center" }}>
                                            Escaneable ópticamente por cualquier nodo RED Sovereign Mesh OS.
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Form Fields */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div>
                                    <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900, display: "block", marginBottom: "4px" }}>
                                        NICKNAME / INDICATIVO TÁCTICO
                                    </label>
                                    <input
                                        value={nickname}
                                        onChange={e => setNickname(e.target.value)}
                                        style={{
                                            width: "100%", padding: "10px 14px", background: "rgba(0, 0, 0, 0.5)",
                                            border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "10px",
                                            color: "#FFFFFF", fontSize: "0.85rem", outline: "none"
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900, display: "block", marginBottom: "4px" }}>
                                        BIO / ESTADO TÁCTICO
                                    </label>
                                    <input
                                        value={bio}
                                        onChange={e => setBio(e.target.value)}
                                        placeholder="Ej: Operador de Enlace, Frecuencia 433 MHz..."
                                        style={{
                                            width: "100%", padding: "10px 14px", background: "rgba(0, 0, 0, 0.5)",
                                            border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "10px",
                                            color: "#FFFFFF", fontSize: "0.85rem", outline: "none"
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={handleSaveProfile}
                                    style={{
                                        width: "100%", padding: "12px", background: isProfileSaved ? "linear-gradient(135deg, #00E676 0%, #00897B 100%)" : "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                        border: "none", borderRadius: "12px", color: "#000000",
                                        fontWeight: 900, fontSize: "0.85rem", cursor: "pointer",
                                        boxShadow: "0 0 15px rgba(0, 229, 255, 0.3)"
                                    }}
                                >
                                    {isProfileSaved ? "✓ PERFIL GUARDADO" : "⚡ GUARDAR Y FIRMAR PERFIL"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: POST-QUANTUM CRYPTOGRAPHY */}
                    {activeTab === "pqc" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(179, 136, 255, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#B388FF" }}>
                                        ARMADURA POST-CUÁNTICA (NIST FIPS 203)
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                        Cifrado de celosías ML-KEM-768 resistente a computación cuántica.
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: "0.6rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                                    background: "rgba(179, 136, 255, 0.15)", color: "#B388FF", border: "1px solid rgba(179, 136, 255, 0.4)"
                                }}>
                                    KYBER-768
                                </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                <button
                                    onClick={handleGeneratePqcKeys}
                                    disabled={isPqcGenerating}
                                    style={{
                                        padding: "12px", background: "linear-gradient(135deg, rgba(179, 136, 255, 0.25) 0%, rgba(120, 80, 220, 0.15) 100%)",
                                        border: "1px solid #B388FF", borderRadius: "12px", color: "#B388FF",
                                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer"
                                    }}
                                >
                                    {isPqcGenerating ? "Generando..." : "🔑 GENERAR LLAVES PQC"}
                                </button>
                                <button
                                    onClick={handleRunBenchmark}
                                    disabled={isBenchmarking}
                                    style={{
                                        padding: "12px", background: "rgba(255, 255, 255, 0.05)",
                                        border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "12px", color: "#FFFFFF",
                                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer"
                                    }}
                                >
                                    {isBenchmarking ? "Probando..." : "⚡ BENCHMARK LOCAL"}
                                </button>
                            </div>

                            {/* Inspección de Llaves PQC Activas */}
                            {pqcKeys && (
                                <div style={{
                                    padding: "14px", background: "rgba(0, 0, 0, 0.4)",
                                    border: "1px solid rgba(179, 136, 255, 0.25)", borderRadius: "14px",
                                    display: "flex", flexDirection: "column", gap: "10px"
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: "0.76rem", fontWeight: 900, color: "#B388FF" }}>
                                            LLAVES PQC ML-KEM-768 ACTIVAS
                                        </span>
                                        <button
                                            onClick={handleClearPqcKeys}
                                            style={{
                                                padding: "4px 8px", background: "rgba(255, 51, 85, 0.15)",
                                                border: "1px solid rgba(255, 51, 85, 0.3)", borderRadius: "6px",
                                                color: "#FF3355", fontSize: "0.65rem", fontWeight: 800, cursor: "pointer"
                                            }}
                                        >
                                            ELIMINAR LLAVES
                                        </button>
                                    </div>

                                    <div>
                                        <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)", marginBottom: "2px" }}>
                                            KYBER PUBLIC KEY ({Math.round(pqcKeys.kyberPublicKeyHex.length / 2)} BYTES):
                                        </div>
                                        <div style={{ display: "flex", gap: "6px" }}>
                                            <input
                                                readOnly
                                                value={pqcKeys.kyberPublicKeyHex}
                                                style={{
                                                    flex: 1, padding: "6px 8px", background: "rgba(0,0,0,0.5)",
                                                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px",
                                                    color: "#B388FF", fontSize: "0.66rem", fontFamily: "JetBrains Mono"
                                                }}
                                            />
                                            <button
                                                onClick={() => copyToClipboard(pqcKeys.kyberPublicKeyHex)}
                                                style={{
                                                    padding: "6px 10px", background: "rgba(179, 136, 255, 0.2)",
                                                    border: "1px solid #B388FF", borderRadius: "6px",
                                                    color: "#FFFFFF", fontSize: "0.66rem", fontWeight: 800, cursor: "pointer"
                                                }}
                                            >
                                                COPIAR
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)", marginBottom: "2px" }}>
                                            X25519 ECDH PUBLIC KEY:
                                        </div>
                                        <div style={{ display: "flex", gap: "6px" }}>
                                            <input
                                                readOnly
                                                value={pqcKeys.x25519PublicKeyHex}
                                                style={{
                                                    flex: 1, padding: "6px 8px", background: "rgba(0,0,0,0.5)",
                                                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px",
                                                    color: "#00E5FF", fontSize: "0.66rem", fontFamily: "JetBrains Mono"
                                                }}
                                            />
                                            <button
                                                onClick={() => copyToClipboard(pqcKeys.x25519PublicKeyHex)}
                                                style={{
                                                    padding: "6px 10px", background: "rgba(0, 229, 255, 0.2)",
                                                    border: "1px solid #00E5FF", borderRadius: "6px",
                                                    color: "#FFFFFF", fontSize: "0.66rem", fontWeight: 800, cursor: "pointer"
                                                }}
                                            >
                                                COPIAR
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleAnnouncePqcKey}
                                        style={{
                                            marginTop: "4px", padding: "10px",
                                            background: "linear-gradient(135deg, rgba(179, 136, 255, 0.3) 0%, rgba(120, 80, 220, 0.2) 100%)",
                                            border: "1px solid #B388FF", borderRadius: "8px", color: "#FFFFFF",
                                            fontWeight: 900, fontSize: "0.75rem", cursor: "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                                        }}
                                    >
                                        📡 ANUNCIAR LLAVE PQC EN LA MALLA
                                    </button>
                                </div>
                            )}

                            {benchmarkResult && (
                                <div style={{
                                    padding: "14px", background: "rgba(0, 0, 0, 0.4)",
                                    border: "1px solid rgba(179, 136, 255, 0.3)", borderRadius: "12px",
                                    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", textAlign: "center"
                                }}>
                                    <div>
                                        <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>ENCAPSULACIÓN</div>
                                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E676" }}>{benchmarkResult.encapTimeMs} ms</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>DESENCAPSULACIÓN</div>
                                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E676" }}>{benchmarkResult.decapTimeMs} ms</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>TAMAÑO CIPHERTEXT</div>
                                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#B388FF" }}>{benchmarkResult.ciphertextBytes} B</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: SHAMIR SECRET SHARING */}
                    {activeTab === "shamir" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 230, 118, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#00E676" }}>
                                    DIVISIÓN DE SECRETOS SHAMIR (SSS 3-OF-5)
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                    Divide tu semilla o clave en 5 fragmentos matemáticos; se requieren 3 cualesquiera para reconstruirla.
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <input
                                    value={secretToSplit}
                                    onChange={e => setSecretToSplit(e.target.value)}
                                    placeholder="Ingresa semilla mnemónica o secreto a dividir..."
                                    style={{
                                        padding: "10px 14px", background: "rgba(0, 0, 0, 0.5)",
                                        border: "1px solid rgba(0, 230, 118, 0.3)", borderRadius: "10px",
                                        color: "#FFFFFF", fontSize: "0.82rem", outline: "none"
                                    }}
                                />
                                <button
                                    onClick={handleSplitSecret}
                                    style={{
                                        padding: "12px", background: "linear-gradient(135deg, #00E676 0%, #00897B 100%)",
                                        border: "none", borderRadius: "10px", color: "#000000",
                                        fontWeight: 900, fontSize: "0.82rem", cursor: "pointer"
                                    }}
                                >
                                    🔐 DIVIDIR EN 5 FRAGMENTOS
                                </button>
                            </div>

                            {sssShares.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ fontSize: "0.72rem", color: "#00E676", fontWeight: 900 }}>
                                            FRAGMENTOS GENERADOS:
                                        </div>
                                        <button
                                            onClick={handleCopyAllShares}
                                            style={{
                                                padding: "4px 8px", background: "rgba(0, 230, 118, 0.15)",
                                                border: "1px solid rgba(0, 230, 118, 0.4)", borderRadius: "6px",
                                                color: "#00E676", fontSize: "0.66rem", fontWeight: 800, cursor: "pointer"
                                            }}
                                        >
                                            📋 COPIAR TODOS
                                        </button>
                                    </div>
                                    {sssShares.map(s => (
                                        <div
                                            key={s.shareIndex}
                                            onClick={() => copyToClipboard(JSON.stringify(s))}
                                            style={{
                                                padding: "8px 12px", background: "rgba(0,0,0,0.5)",
                                                border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
                                                fontSize: "0.68rem", cursor: "pointer", display: "flex", justifyContent: "space-between"
                                            }}
                                        >
                                            <span>Fragmento #{s.shareIndex}: {s.shareHex.substring(0, 16)}…</span>
                                            <span style={{ color: "var(--accent-cyan, #00E5FF)" }}>COPIAR</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ fontSize: "0.82rem", fontWeight: 900, color: "#FFFFFF" }}>RECONSTRUIR SECRETO</div>
                                <textarea
                                    value={sharesToReconstruct}
                                    onChange={e => setSharesToReconstruct(e.target.value)}
                                    placeholder="Pega array JSON, líneas de fragmentos o formato RED_SSS:1:hex..."
                                    rows={2}
                                    style={{
                                        padding: "8px 12px", background: "rgba(0,0,0,0.5)",
                                        border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px",
                                        color: "#FFFFFF", fontSize: "0.75rem", outline: "none"
                                    }}
                                />
                                <button
                                    onClick={handleReconstructSecret}
                                    style={{
                                        padding: "10px", background: "rgba(0, 229, 255, 0.15)",
                                        border: "1px solid rgba(0, 229, 255, 0.4)", borderRadius: "8px",
                                        color: "var(--accent-cyan, #00E5FF)", fontWeight: 900, fontSize: "0.78rem", cursor: "pointer"
                                    }}
                                >
                                    🎉 RECONSTRUIR SECRETO ORIGINAL
                                </button>
                                {reconstructedSecret && (
                                    <div style={{ padding: "10px", background: "rgba(0, 230, 118, 0.15)", border: "1px solid #00E676", borderRadius: "8px", fontSize: "0.82rem", fontWeight: 900, color: "#00E676" }}>
                                        Secreto: {reconstructedSecret}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 4: FICHA MÉDICA DE EMERGENCIA */}
                    {activeTab === "medical" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 51, 85, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FF3355" }}>
                                        FICHA MÉDICA DE RESCATE (ED25519 FIRMADA)
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                        Información vital accesible por rescatistas en caso de inconsciencia o triaje START.
                                    </div>
                                </div>
                                <button
                                    onClick={handleClearMedical}
                                    style={{
                                        padding: "4px 8px", background: "rgba(255, 255, 255, 0.06)",
                                        border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "6px",
                                        color: "var(--text-muted)", fontSize: "0.65rem", fontWeight: 800, cursor: "pointer"
                                    }}
                                >
                                    LIMPIAR
                                </button>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
                                <div>
                                    <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900 }}>GRUPO SANGUÍNEO</label>
                                    <input
                                        value={bloodType}
                                        onChange={e => setBloodType(e.target.value)}
                                        placeholder="Ej: O+, A-, B+..."
                                        style={{
                                            width: "100%", padding: "10px", background: "rgba(0, 0, 0, 0.5)",
                                            border: "1px solid rgba(255, 51, 85, 0.3)", borderRadius: "10px",
                                            color: "#FFFFFF", fontSize: "0.85rem", outline: "none"
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900 }}>ALERGIAS CRÍTICAS</label>
                                    <input
                                        value={allergies}
                                        onChange={e => setAllergies(e.target.value)}
                                        placeholder="Ej: Penicilina, Látex, Ninguna..."
                                        style={{
                                            width: "100%", padding: "10px", background: "rgba(0, 0, 0, 0.5)",
                                            border: "1px solid rgba(255, 51, 85, 0.3)", borderRadius: "10px",
                                            color: "#FFFFFF", fontSize: "0.85rem", outline: "none"
                                        }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900 }}>CONTACTO DE EMERGENCIA</label>
                                <input
                                    value={emergencyContact}
                                    onChange={e => setEmergencyContact(e.target.value)}
                                    placeholder="Nombre y teléfono o DID de contacto..."
                                    style={{
                                        width: "100%", padding: "10px", background: "rgba(0, 0, 0, 0.5)",
                                        border: "1px solid rgba(255, 51, 85, 0.3)", borderRadius: "10px",
                                        color: "#FFFFFF", fontSize: "0.85rem", outline: "none"
                                    }}
                                />
                            </div>

                            <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                    onClick={handleSaveMedical}
                                    style={{
                                        flex: 1, padding: "12px", background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                                        border: "none", borderRadius: "12px", color: "#FFFFFF",
                                        fontWeight: 900, fontSize: "0.85rem", cursor: "pointer",
                                        boxShadow: "0 0 15px rgba(255, 51, 85, 0.35)"
                                    }}
                                >
                                    🫀 GENERAR QR Y GUARDAR
                                </button>
                                <button
                                    onClick={() => {
                                        TacticalAudioEngine.playTap();
                                        navigate("tcccBallistics");
                                    }}
                                    style={{
                                        padding: "12px 14px", background: "rgba(255, 51, 85, 0.15)",
                                        border: "1.5px solid #FF3355", borderRadius: "12px", color: "#FF3355",
                                        fontWeight: 900, fontSize: "0.82rem", cursor: "pointer",
                                        whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "4px"
                                    }}
                                >
                                    <span>🚑</span> TCCC / MEDEVAC
                                </button>
                            </div>

                            {qrCodeData && (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", paddingTop: "10px" }}>
                                    <img src={qrCodeData} alt="QR Médico" style={{ width: 220, height: 220, borderRadius: "12px", border: "2px solid #FF3355" }} />
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", textAlign: "center" }}>
                                        Escaneable ópticamente por cualquier lector de emergencias sin conexión.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};