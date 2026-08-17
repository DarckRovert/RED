"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { StegoEngine, StegoExtractResult } from "../lib/StegoEngine";
import { RedAPI, StegoCapsuleRecord } from "../lib/api";
import { toast } from "./Toast";

type StegoTab = "embed" | "extract" | "vault";

export function StegoVaultModal() {
    const { navigate, identity } = useRedStore();
    const [mode, setMode] = useState<StegoTab>("embed");

    // Embed states
    const [payloadText, setPayloadText] = useState("");
    const [embedPassword, setEmbedPassword] = useState("");
    const [capsuleTitle, setCapsuleTitle] = useState("");
    const [customEmbedImage, setCustomEmbedImage] = useState<string | null>(null);
    const [stegoResultUrl, setStegoResultUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSavingVault, setIsSavingVault] = useState(false);

    // Extract states
    const [customExtractImage, setCustomExtractImage] = useState<string | null>(null);
    const [extractPassword, setExtractPassword] = useState("");
    const [extractResult, setExtractResult] = useState<StegoExtractResult | null>(null);

    // Vault states
    const [vaultCapsules, setVaultCapsules] = useState<StegoCapsuleRecord[]>([]);
    const [isLoadingVault, setIsLoadingVault] = useState(false);

    const operatorName = identity?.nickname || "Operador RED";

    const loadVault = useCallback(async () => {
        setIsLoadingVault(true);
        try {
            const list = await RedAPI.getStegoCapsules();
            if (Array.isArray(list)) setVaultCapsules(list);
        } catch {}
        finally {
            setIsLoadingVault(false);
        }
    }, []);

    useEffect(() => {
        const randSuffix = typeof crypto !== 'undefined' && crypto.getRandomValues 
            ? Array.from(crypto.getRandomValues(new Uint8Array(2))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase() 
            : (Date.now() % 10000).toString();
        setPayloadText(`INFORME_OPERACIONAL_${operatorName.toUpperCase()}_${Date.now()}`);
        setCapsuleTitle(`Cápsula Táctica #${randSuffix}`);
        loadVault();
    }, [operatorName, loadVault]);

    // Default base canvas image generator if user does not upload a photo
    const createBaseCanvasImage = (): string => {
        const canvas = document.createElement("canvas");
        canvas.width = 450;
        canvas.height = 450;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            const grad = ctx.createLinearGradient(0, 0, 450, 450);
            grad.addColorStop(0, "#080816");
            grad.addColorStop(0.5, "#881337");
            grad.addColorStop(1, "#0369A1");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 450, 450);

            // Add tactical grid pattern
            ctx.strokeStyle = "rgba(255,255,255,0.08)";
            ctx.lineWidth = 1;
            for (let x = 0; x < 450; x += 25) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 450); ctx.stroke();
            }
            for (let y = 0; y < 450; y += 25) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(450, y); ctx.stroke();
            }

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 20px Inter, sans-serif";
            ctx.fillText("🔴 RED TACTICAL STEGO CARRIER", 36, 200);
            ctx.font = "13px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#CBD5E1";
            ctx.fillText(`OPERADOR: ${operatorName}`, 36, 235);
            ctx.fillStyle = "#94A3B8";
            ctx.font = "11px 'JetBrains Mono', monospace";
            ctx.fillText(`TIMESTAMP: ${new Date().toISOString()}`, 36, 260);
        }
        return canvas.toDataURL("image/png");
    };

    const handleEmbedImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) setCustomEmbedImage(ev.target.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleExtractImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                setCustomExtractImage(ev.target.result as string);
                setExtractResult(null);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleEmbedSecret = async () => {
        if (!payloadText.trim()) {
            toast.warning("Ingresa el texto o secreto que deseas ocultar");
            return;
        }
        setIsProcessing(true);
        setStegoResultUrl(null);

        try {
            const coverImage = customEmbedImage || createBaseCanvasImage();
            const res = await StegoEngine.embedSecret(coverImage, payloadText, embedPassword || undefined);

            if (res.success && res.stegoImageDataUrl) {
                setStegoResultUrl(res.stegoImageDataUrl);
                toast.success(`Secreto inyectado en píxeles (${res.payloadBytes} bytes).`);
            } else {
                toast.error(res.error || "Fallo en la inyección esteganográfica");
            }
        } catch {
            toast.error("Error al procesar los píxeles de la imagen");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveToVault = async () => {
        if (!stegoResultUrl) return;
        setIsSavingVault(true);

        try {
            const title = capsuleTitle.trim() || `Cápsula Táctica ${Date.now()}`;
            const record = await RedAPI.saveStegoCapsule({
                title,
                image_data_url: stegoResultUrl,
                has_password: Boolean(embedPassword.trim()),
                author: operatorName
            });

            await loadVault();
            toast.success(`🖼️ Cápsula '${record.title}' guardada en Bóveda Sled DB.`);
            setMode("vault");
        } catch {
            toast.error("Error al persistir cápsula esteganográfica en Rust");
        } finally {
            setIsSavingVault(false);
        }
    };

    const handleExtractSecret = async () => {
        if (!customExtractImage) {
            toast.warning("Selecciona una imagen portadora para extraer");
            return;
        }
        setIsProcessing(true);
        setExtractResult(null);

        try {
            const res = await StegoEngine.extractSecret(customExtractImage, extractPassword || undefined);
            setExtractResult(res);
            if (res.success) {
                toast.success("🔓 ¡Secreto esteganográfico extraído y descifrado!");
            } else {
                toast.error(res.error || "No se detectó cabecera esteganográfica válida");
            }
        } catch {
            toast.error("Fallo durante el descifrado del canal azul");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteCapsule = async (id: string) => {
        try {
            await RedAPI.deleteStegoCapsule(id);
            await loadVault();
            toast.info("Cápsula eliminada de Sled DB");
        } catch {
            toast.error("Error al eliminar la cápsula");
        }
    };

    const copyToClipboard = (text: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast.success("Copiado al portapapeles");
        }
    };

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
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
                    }}>🖼️</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Bóveda Esteganográfica Cifrada
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            LSB CARRIER INJECTION · AES-256-GCM · SLED PERSISTED
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
                    onClick={() => setMode("embed")}
                    className={mode === "embed" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🔒 Ocultar & Cifrar (Embed)
                </button>
                <button
                    onClick={() => setMode("extract")}
                    className={mode === "extract" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🔓 Extraer & Revelar (Extract)
                </button>
                <button
                    onClick={() => setMode("vault")}
                    className={mode === "vault" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🗄️ Bóveda Sled ({vaultCapsules.length})
                </button>
            </div>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ─── MODO 1: OCULTAR & CIFRAR ─────────────────────────────── */}
                    {mode === "embed" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                    🔒 Inyección Esteganográfica de Información Secreta
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Cifra el texto con AES-256-GCM y lo oculta en los bits menos significativos (LSB) del canal azul
                                </div>
                            </div>

                            {/* Dropzone de Imagen Portadora */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    IMAGEN PORTADORA (COVER PHOTO):
                                </label>
                                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                    <label
                                        className="card-tactical-interactive"
                                        style={{
                                            padding: "12px 16px", display: "inline-flex", alignItems: "center", gap: "8px",
                                            cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, borderColor: "var(--accent-cyan)"
                                        }}
                                    >
                                        <span>📷 Subir Foto</span>
                                        <input type="file" accept="image/*" onChange={handleEmbedImageFile} style={{ display: "none" }} />
                                    </label>
                                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                        {customEmbedImage ? "✅ Foto seleccionada" : "Usando plantilla táctica predeterminada"}
                                    </span>
                                </div>
                            </div>

                            {/* Carga Útil */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    SECRETO O DOCUMENTO A OCULTAR:
                                </label>
                                <textarea
                                    value={payloadText}
                                    onChange={e => setPayloadText(e.target.value)}
                                    rows={4}
                                    placeholder="Escribe aquí las coordenadas, contraseñas o informe clasificado..."
                                />
                            </div>

                            {/* Contraseña Simétrica Opcional */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    CLAVE DE CIFRADO AES-256 (OPCIONAL):
                                </label>
                                <input
                                    type="password"
                                    value={embedPassword}
                                    onChange={e => setEmbedPassword(e.target.value)}
                                    placeholder="Contraseña para doble blindaje criptográfico"
                                />
                            </div>

                            {/* Botón de Ejecución */}
                            <button
                                onClick={handleEmbedSecret}
                                disabled={isProcessing}
                                className="btn-tactical-primary"
                                style={{ width: "100%", padding: "14px", fontSize: "0.92rem", background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)", color: "#000" }}
                            >
                                {isProcessing ? "Inyectando en píxeles..." : "⚡ GENERAR IMAGEN ESTEGANOGRÁFICA"}
                            </button>

                            {/* Previsualización del Resultado */}
                            {stegoResultUrl && (
                                <div className="card-tactical animate-pop" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", background: "rgba(0,0,0,0.6)" }}>
                                    <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                        ✅ Cápsula Generada con Éxito (Canal Azul Modulado)
                                    </div>
                                    <div style={{ width: "100%", maxHeight: "240px", overflow: "hidden", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                                        <img src={stegoResultUrl} alt="Stego Result" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                                    </div>

                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <input
                                            value={capsuleTitle}
                                            onChange={e => setCapsuleTitle(e.target.value)}
                                            placeholder="Título de la cápsula para la bóveda"
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            onClick={handleSaveToVault}
                                            disabled={isSavingVault}
                                            className="btn-tactical-primary"
                                            style={{ padding: "10px 16px", fontSize: "0.82rem", background: "linear-gradient(135deg, #00E676 0%, #00B359 100%)", color: "#000" }}
                                        >
                                            {isSavingVault ? "Guardando..." : "💾 Guardar en Sled"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── MODO 2: EXTRAER & REVELAR ────────────────────────────── */}
                    {mode === "extract" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                    🔓 Extracción y Descifrado de Píxeles Portadores
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Escanea la matriz de píxeles LSB y descifra la carga útil oculta
                                </div>
                            </div>

                            {/* Carga de Imagen a Analizar */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <label
                                    className="card-tactical-interactive"
                                    style={{
                                        padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                        gap: "8px", cursor: "pointer", borderStyle: "dashed"
                                    }}
                                >
                                    <span style={{ fontSize: "2rem" }}>📂</span>
                                    <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Seleccionar Imagen Portadora</span>
                                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>PNG recomendado para máxima integridad LSB</span>
                                    <input type="file" accept="image/*" onChange={handleExtractImageFile} style={{ display: "none" }} />
                                </label>

                                {customExtractImage && (
                                    <div style={{ width: "100%", maxHeight: "160px", overflow: "hidden", borderRadius: "8px", border: "1px solid var(--glass-border)", marginTop: "6px" }}>
                                        <img src={customExtractImage} alt="Extract Carrier" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                                    </div>
                                )}
                            </div>

                            <input
                                type="password"
                                value={extractPassword}
                                onChange={e => setExtractPassword(e.target.value)}
                                placeholder="Contraseña de descifrado (si la imagen fue protegida)"
                            />

                            <button
                                onClick={handleExtractSecret}
                                disabled={isProcessing || !customExtractImage}
                                className="btn-tactical-primary"
                                style={{ width: "100%", padding: "14px", fontSize: "0.92rem", background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)", color: "#000" }}
                            >
                                {isProcessing ? "Extrayendo píxeles..." : "🔓 EXTRAER Y DESCIFRAR SECRETO"}
                            </button>

                            {/* Resultado Revelado */}
                            {extractResult && (
                                <div className="animate-pop" style={{
                                    padding: "16px", borderRadius: "var(--radius-md)",
                                    background: extractResult.success ? "rgba(0, 230, 118, 0.08)" : "rgba(232, 33, 58, 0.08)",
                                    border: `1px solid ${extractResult.success ? "var(--accent-emerald)" : "var(--accent-crimson)"}`,
                                    display: "flex", flexDirection: "column", gap: "10px"
                                }}>
                                    <div style={{ fontWeight: 800, fontSize: "0.92rem", color: extractResult.success ? "var(--accent-emerald)" : "var(--accent-crimson-bright)" }}>
                                        {extractResult.success ? "🔓 SECRETO REVELADO:" : "❌ FALLO DE EXTRACCIÓN:"}
                                    </div>

                                    {extractResult.success ? (
                                        <>
                                            <div style={{
                                                padding: "12px", background: "rgba(0,0,0,0.5)", borderRadius: "6px",
                                                fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", color: "#fff",
                                                wordBreak: "break-all", whiteSpace: "pre-wrap", maxHeight: "180px", overflowY: "auto"
                                            }}>
                                                {extractResult.payloadText}
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                                    Tamaño: {extractResult.payloadBytes} bytes · Cifrado: {extractResult.wasEncrypted ? "AES-256-GCM" : "Plano"}
                                                </span>
                                                <button
                                                    onClick={() => copyToClipboard(extractResult.payloadText || "")}
                                                    className="btn-tactical-secondary"
                                                    style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                                                >
                                                    📋 Copiar
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                                            {extractResult.error}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── MODO 3: BÓVEDA SLED DB ──────────────────────────────── */}
                    {mode === "vault" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                        🗄️ Bóveda de Cápsulas Esteganográficas
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        Imágenes portadoras persistidas en la base de datos segura Sled
                                    </div>
                                </div>
                                <span className="badge-tactical badge-tactical-emerald">SLED PERSISTED</span>
                            </div>

                            {isLoadingVault ? (
                                <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                                    Cargando cápsulas desde disco...
                                </div>
                            ) : vaultCapsules.length === 0 ? (
                                <div className="empty-state-tactical">
                                    <div className="empty-state-icon">🗄️</div>
                                    <div className="empty-state-title">Bóveda Vacía</div>
                                    <div className="empty-state-desc">
                                        No has guardado cápsulas esteganográficas en disco Sled DB aún.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                                    {vaultCapsules.map((cap) => (
                                        <div
                                            key={cap.id}
                                            className="card-tactical"
                                            style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}
                                        >
                                            <div style={{ width: "100%", height: "120px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--glass-border)" }}>
                                                <img src={cap.image_data_url} alt={cap.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            </div>
                                            <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                                                {cap.title}
                                            </div>
                                            <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                                                <span>{cap.has_password ? "🔒 Cifrado" : "🔓 Plano"}</span>
                                                <span>{new Date(cap.timestamp).toLocaleDateString()}</span>
                                            </div>
                                            <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                                                <button
                                                    onClick={() => {
                                                        setCustomExtractImage(cap.image_data_url || cap.media_data || null);
                                                        setMode("extract");
                                                    }}
                                                    className="btn-tactical-secondary"
                                                    style={{ flex: 1, padding: "6px", fontSize: "0.75rem" }}
                                                >
                                                    🔓 Revelar
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCapsule(cap.id)}
                                                    className="btn-icon"
                                                    title="Eliminar de Sled"
                                                    style={{ width: 30, height: 30, color: "var(--accent-crimson-bright)" }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}