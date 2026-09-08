"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { StegoEngine, StegoExtractResult } from "../lib/StegoEngine";
import { RedAPI, StegoCapsuleRecord } from "../lib/api";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { meshRouter } from "../lib/mesh/meshRouter";

type StegoTab = "embed" | "extract" | "vault";

export function StegoVaultModal() {
    const { navigate, identity } = useRedStore();
    const { t } = useTranslation();
    const [mode, setMode] = useState<StegoTab>("embed");

    // Embed states
    const [payloadText, setPayloadText] = useState("");
    const [embedPassword, setEmbedPassword] = useState("");
    const [capsuleTitle, setCapsuleTitle] = useState("");
    const [customEmbedImage, setCustomEmbedImage] = useState<string | null>(null);
    const [stegoResultUrl, setStegoResultUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSavingVault, setIsSavingVault] = useState(false);
    const [carrierDimensions, setCarrierDimensions] = useState<{ width: number; height: number }>({ width: 450, height: 450 });

    // Extract states
    const [customExtractImage, setCustomExtractImage] = useState<string | null>(null);
    const [extractPassword, setExtractPassword] = useState("");
    const [extractResult, setExtractResult] = useState<StegoExtractResult | null>(null);

    // Vault states
    const [vaultCapsules, setVaultCapsules] = useState<StegoCapsuleRecord[]>([]);
    const [isLoadingVault, setIsLoadingVault] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // File input refs for desktop/web fallback
    const embedFileInputRef = useRef<HTMLInputElement>(null);
    const extractFileInputRef = useRef<HTMLInputElement>(null);

    const operatorName = identity?.nickname || "Operador RED";

    // ─── Intercepción Jerárquica LIFO de Hardware (Android Back / Esc) ───
    useEffect(() => {
        return BackHandlerRegistry.register(() => {
            if (deletingId) {
                TacticalAudioEngine.playTap();
                setDeletingId(null);
                return true;
            }
            if (extractResult) {
                TacticalAudioEngine.playTap();
                setExtractResult(null);
                return true;
            }
            if (stegoResultUrl) {
                TacticalAudioEngine.playTap();
                setStegoResultUrl(null);
                return true;
            }
            if (mode !== "embed") {
                TacticalAudioEngine.playTap();
                setMode("embed");
                return true;
            }
            TacticalAudioEngine.playTap();
            navigate("sidebar");
            return true;
        });
    }, [deletingId, extractResult, stegoResultUrl, mode, navigate]);

    const loadVault = useCallback(async () => {
        setIsLoadingVault(true);
        try {
            const list = await RedAPI.getStegoCapsules();
            if (Array.isArray(list)) setVaultCapsules(list);
        } catch {
            // Silencioso ante errores de red; mantiene estado
        } finally {
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

    // Inspect dimensions whenever customEmbedImage changes
    useEffect(() => {
        if (!customEmbedImage) {
            setCarrierDimensions({ width: 450, height: 450 });
            return;
        }
        const img = new Image();
        img.onload = () => {
            setCarrierDimensions({
                width: img.naturalWidth || 450,
                height: img.naturalHeight || 450
            });
        };
        img.src = customEmbedImage;
    }, [customEmbedImage]);

    // Theoretical capacity (3 bits per pixel across RGB channels)
    const telemetry = useMemo(() => {
        const totalPixels = carrierDimensions.width * carrierDimensions.height;
        const maxBits = totalPixels * 3;
        const maxBytes = Math.floor(maxBits / 8);
        const payloadBytes = new TextEncoder().encode(payloadText).length;
        const headerEstimatedBytes = 24;
        const totalNeededBytes = payloadBytes + headerEstimatedBytes;
        const occupancyPct = maxBytes > 0 ? ((totalNeededBytes / maxBytes) * 100) : 0;
        const isExceeded = totalNeededBytes > maxBytes;

        return {
            totalPixels,
            maxBytes,
            maxKb: (maxBytes / 1024).toFixed(1),
            payloadBytes,
            totalNeededBytes,
            occupancyPct: occupancyPct.toFixed(2),
            isExceeded
        };
    }, [carrierDimensions, payloadText]);

    // Default base canvas image generator if user does not upload a photo
    const createBaseCanvasImage = (): string => {
        const canvas = document.createElement("canvas");
        canvas.width = 450;
        canvas.height = 450;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

    const handleTakeEmbedPhoto = async () => {
        try {
            const photo = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Prompt
            });
            if (photo.dataUrl) {
                setCustomEmbedImage(photo.dataUrl);
                toast.success("Foto de portadora capturada con éxito");
            }
        } catch {
            embedFileInputRef.current?.click();
        }
    };

    const handleTakeExtractPhoto = async () => {
        try {
            const photo = await Camera.getPhoto({
                quality: 100,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Prompt
            });
            if (photo.dataUrl) {
                setCustomExtractImage(photo.dataUrl);
                setExtractResult(null);
                toast.success("Foto cargada para análisis esteganográfico");
            }
        } catch {
            extractFileInputRef.current?.click();
        }
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

    const handleBroadcastStegoNotice = async (title?: string) => {
        try {
            const payload = new TextEncoder().encode(JSON.stringify({
                type: "STEGO_CAPSULE_NOTICE",
                title: (title || capsuleTitle || "Cápsula Táctica").trim(),
                author: operatorName,
                timestamp: Date.now()
            }));
            await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payload);
            TacticalAudioEngine.playRogerBeep();
            toast.success("📡 Notificación de cápsula transmitida a la malla táctica");
        } catch (e: any) {
            toast.error("Error al transmitir por malla: " + e.message);
        }
    };

    const handleBroadcastExtractedSecret = async () => {
        if (!extractResult?.payloadText) return;
        try {
            const payload = new TextEncoder().encode(JSON.stringify({
                type: "DECRYPTED_STEGO_INTEL",
                sender: operatorName,
                intelText: extractResult.payloadText,
                timestamp: Date.now()
            }));
            await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payload);
            TacticalAudioEngine.playRogerBeep();
            toast.success("📡 Secreto extraído transmitido a la malla táctica");
        } catch (e: any) {
            toast.error("Error al transmitir secreto: " + e.message);
        }
    };

    const handleEmbedSecret = async () => {
        if (!payloadText.trim()) {
            TacticalAudioEngine.playWarning();
            toast.warning("Ingresa el texto o secreto que deseas ocultar");
            return;
        }
        if (telemetry.isExceeded) {
            TacticalAudioEngine.playEmergencyAlarm();
            toast.error(`La carga útil (${telemetry.totalNeededBytes} B) excede la capacidad máxima de la portadora (${telemetry.maxBytes} B). Selecciona una imagen de mayor resolución.`);
            return;
        }
        TacticalAudioEngine.playTap();
        setIsProcessing(true);
        setStegoResultUrl(null);

        try {
            const coverImage = customEmbedImage || createBaseCanvasImage();
            const res = await StegoEngine.embedSecret(coverImage, payloadText, embedPassword || undefined);

            if (res.success && res.stegoImageDataUrl) {
                setStegoResultUrl(res.stegoImageDataUrl);
                TacticalAudioEngine.playRogerBeep();
                toast.success(`Secreto inyectado en píxeles (${res.payloadBytes} bytes).`);
            } else {
                TacticalAudioEngine.playWarning();
                toast.error(res.error || "Fallo en la inyección esteganográfica");
            }
        } catch {
            TacticalAudioEngine.playWarning();
            toast.error("Error al procesar los píxeles de la imagen");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveToVault = async () => {
        if (!stegoResultUrl) return;
        TacticalAudioEngine.playTap();
        setIsSavingVault(true);

        try {
            const title = capsuleTitle.trim() || `Cápsula Táctica ${Date.now()}`;
            const record = await RedAPI.saveStegoCapsule({
                title,
                image_data_url: stegoResultUrl,
                image_data: stegoResultUrl,
                has_password: Boolean(embedPassword.trim()),
                author: operatorName,
                notes: `Operador: ${operatorName}`
            });

            await loadVault();
            TacticalAudioEngine.playRogerBeep();
            toast.success(`🖼️ Cápsula '${record.title}' guardada en Bóveda Sled DB.`);
            setMode("vault");
        } catch {
            TacticalAudioEngine.playWarning();
            toast.error("Error al persistir cápsula esteganográfica en Rust");
        } finally {
            setIsSavingVault(false);
        }
    };

    const handleDownloadPng = (dataUrl: string, title?: string) => {
        try {
            TacticalAudioEngine.playMessageSent();
            const link = document.createElement("a");
            const sanitized = (title || "stego_capsule").replace(/[^a-zA-Z0-9_-]/g, "_");
            link.download = `${sanitized}_${Date.now()}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("💾 Imagen PNG sin pérdidas descargada");
        } catch {
            TacticalAudioEngine.playWarning();
            toast.error("Error al descargar la imagen");
        }
    };

    const handleShareImage = async (dataUrl: string, title?: string) => {
        TacticalAudioEngine.playTap();
        if (typeof navigator !== "undefined" && navigator.share) {
            try {
                const res = await fetch(dataUrl);
                const blob = await res.blob();
                const file = new File([blob], `${(title || "stego_capsule").replace(/[^a-zA-Z0-9_-]/g, "_")}.png`, { type: "image/png" });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: title || "Cápsula Esteganográfica RED",
                        text: "Cápsula táctica protegida con esteganografía LSB y cifrado soberano.",
                        files: [file]
                    });
                    TacticalAudioEngine.playMessageSent();
                    toast.success("Compartido exitosamente");
                    return;
                }
            } catch (err: any) {
                if (err.name !== "AbortError") {
                    handleDownloadPng(dataUrl, title);
                }
                return;
            }
        }
        handleDownloadPng(dataUrl, title);
    };

    const handleExtractSecret = async () => {
        if (!customExtractImage) {
            TacticalAudioEngine.playWarning();
            toast.warning("Selecciona una imagen portadora para extraer");
            return;
        }
        TacticalAudioEngine.playTap();
        setIsProcessing(true);
        setExtractResult(null);

        try {
            const res = await StegoEngine.extractSecret(customExtractImage, extractPassword || undefined);
            setExtractResult(res);
            if (res.success) {
                TacticalAudioEngine.playRogerBeep();
                toast.success("🔓 ¡Secreto esteganográfico extraído y descifrado!");
            } else {
                TacticalAudioEngine.playWarning();
                toast.error(res.error || "No se detectó cabecera esteganográfica válida (o contraseña incorrecta)");
            }
        } catch {
            TacticalAudioEngine.playWarning();
            toast.error("Fallo durante el descifrado del canal azul");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteCapsule = async (id: string) => {
        TacticalAudioEngine.playTap();
        try {
            await RedAPI.deleteStegoCapsule(id);
            setDeletingId(null);
            await loadVault();
            toast.info("Cápsula eliminada de Sled DB");
        } catch {
            TacticalAudioEngine.playWarning();
            toast.error("Error al eliminar la cápsula");
        }
    };

    const fallbackCopy = (text: string) => {
        try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            toast.success("Copiado al portapapeles");
        } catch {
            toast.error("No se pudo copiar al portapapeles");
        }
    };

    const copyToClipboard = (text: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                toast.success("Copiado al portapapeles");
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
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
                            {t.stego_module?.title || "Bóveda Esteganográfica Cifrada"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {t.stego_module?.subtitle || "LSB CARRIER INJECTION · AES-256-GCM · SLED PERSISTED"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="badge-tactical badge-tactical-cyan" style={{ fontSize: "0.68rem" }}>
                        🔒 ZERO-TRUST LSB
                    </span>
                    <button
                        onClick={() => navigate("sidebar")}
                        className="btn-icon"
                        title={t.common?.close || "Cerrar bóveda"}
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
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
                    🔒 {t.stego_module?.embed_tab || "Ocultar & Cifrar (Embed)"}
                </button>
                <button
                    onClick={() => setMode("extract")}
                    className={mode === "extract" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🔓 {t.stego_module?.extract_tab || "Extraer & Revelar (Extract)"}
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
                                    Cifra el texto con AES-256-GCM y lo dispersa en los bits menos significativos (LSB) de los canales RGB con permutación Mulberry32 determinista.
                                </div>
                            </div>

                            {/* HUD Telemetría de Portadora & Capacidad */}
                            <div style={{
                                padding: "12px 14px", borderRadius: "8px",
                                background: "rgba(0, 229, 255, 0.04)",
                                border: "1px solid rgba(0, 229, 255, 0.2)",
                                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                                gap: "10px", fontSize: "0.72rem"
                            }}>
                                <div>
                                    <div style={{ color: "var(--text-muted)", fontWeight: 700 }}>PORTADORA:</div>
                                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 800, color: "var(--text-primary)" }}>
                                        {carrierDimensions.width} × {carrierDimensions.height} px
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: "var(--text-muted)", fontWeight: 700 }}>CAPACIDAD MÁX:</div>
                                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                        {telemetry.maxKb} KB ({telemetry.maxBytes.toLocaleString()} B)
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: "var(--text-muted)", fontWeight: 700 }}>PAYLOAD REQUERIDO:</div>
                                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 800, color: telemetry.isExceeded ? "var(--accent-crimson-bright)" : "var(--accent-emerald)" }}>
                                        {telemetry.totalNeededBytes.toLocaleString()} B ({telemetry.occupancyPct}%)
                                    </div>
                                </div>
                            </div>

                            {/* Selector Dual de Imagen Portadora */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    IMAGEN PORTADORA (COVER PHOTO):
                                </label>
                                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                                    <button
                                        type="button"
                                        onClick={handleTakeEmbedPhoto}
                                        className="btn-tactical-primary"
                                        style={{ padding: "8px 14px", fontSize: "0.80rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                                    >
                                        📷 Tomar Foto
                                    </button>
                                    <label
                                        className="card-tactical-interactive"
                                        style={{
                                            padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px",
                                            cursor: "pointer", fontSize: "0.80rem", fontWeight: 700, borderColor: "var(--accent-cyan)"
                                        }}
                                    >
                                        <span>📂 Subir Imagen</span>
                                        <input
                                            ref={embedFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleEmbedImageFile}
                                            style={{ display: "none" }}
                                        />
                                    </label>
                                    {customEmbedImage && (
                                        <button
                                            type="button"
                                            onClick={() => setCustomEmbedImage(null)}
                                            className="btn-ghost"
                                            style={{ padding: "6px 10px", fontSize: "0.75rem", color: "var(--text-muted)" }}
                                        >
                                            Restablecer a Plantilla
                                        </button>
                                    )}
                                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                        {customEmbedImage ? "✅ Portadora personalizada cargada" : "Usando lienzo sintético de alta entropía"}
                                    </span>
                                </div>

                                {customEmbedImage && (
                                    <div style={{ width: "100%", maxHeight: "140px", overflow: "hidden", borderRadius: "8px", border: "1px solid var(--glass-border)", marginTop: "4px" }}>
                                        <img src={customEmbedImage} alt="Cover Preview" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                                    </div>
                                )}
                            </div>

                            {/* Carga Útil */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                        SECRETO O DOCUMENTO A OCULTAR:
                                    </label>
                                    <span style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                        {telemetry.payloadBytes} bytes
                                    </span>
                                </div>
                                <textarea
                                    value={payloadText}
                                    onChange={e => setPayloadText(e.target.value)}
                                    rows={4}
                                    placeholder="Escribe aquí las coordenadas, contraseñas, semillas criptográficas o informe clasificado..."
                                />
                            </div>

                            {/* Contraseña Simétrica Opcional */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    CLAVE DE CIFRADO / SEMILLA DE DISPERSIÓN (OPCIONAL):
                                </label>
                                <input
                                    type="password"
                                    value={embedPassword}
                                    onChange={e => setEmbedPassword(e.target.value)}
                                    placeholder="Introduce clave para dispersión criptográfica personalizada (SHA-256)"
                                />
                            </div>

                            {/* Botón de Ejecución */}
                            <button
                                onClick={handleEmbedSecret}
                                disabled={isProcessing || telemetry.isExceeded}
                                className="btn-tactical-primary"
                                style={{
                                    width: "100%", padding: "14px", fontSize: "0.92rem",
                                    background: telemetry.isExceeded
                                        ? "rgba(100, 100, 100, 0.4)"
                                        : "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                                    color: telemetry.isExceeded ? "var(--text-muted)" : "#000"
                                }}
                            >
                                {isProcessing ? "Inyectando en píxeles..." : "⚡ GENERAR IMAGEN ESTEGANOGRÁFICA"}
                            </button>

                            {/* Previsualización del Resultado */}
                            {stegoResultUrl && (
                                <div className="card-tactical animate-pop" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", background: "rgba(0,0,0,0.6)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                            ✅ Cápsula Generada (Canales RGB Modulados)
                                        </div>
                                        <span className="badge-tactical badge-tactical-emerald" style={{ fontSize: "0.68rem" }}>
                                            PNG LOSSLESS
                                        </span>
                                    </div>
                                    <div style={{ width: "100%", maxHeight: "240px", overflow: "hidden", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                                        <img src={stegoResultUrl} alt="Stego Result" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                                    </div>

                                    {/* Opciones de Exportación y Persistencia */}
                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadPng(stegoResultUrl, capsuleTitle)}
                                            className="btn-tactical-secondary"
                                            style={{ padding: "8px 14px", fontSize: "0.80rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                                        >
                                            💾 Descargar PNG
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleShareImage(stegoResultUrl, capsuleTitle)}
                                            className="btn-tactical-secondary"
                                            style={{ padding: "8px 14px", fontSize: "0.80rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                                        >
                                            📤 Compartir
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleBroadcastStegoNotice(capsuleTitle)}
                                            className="btn-tactical-secondary"
                                            style={{ padding: "8px 14px", fontSize: "0.80rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                                        >
                                            📡 Avisar Malla
                                        </button>
                                    </div>

                                    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
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
                                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                    <button
                                        type="button"
                                        onClick={handleTakeExtractPhoto}
                                        className="btn-tactical-primary"
                                        style={{ padding: "10px 16px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                                    >
                                        📷 Escanear con Cámara
                                    </button>
                                    <label
                                        className="card-tactical-interactive"
                                        style={{
                                            padding: "10px 16px", display: "inline-flex", alignItems: "center", gap: "6px",
                                            cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, borderColor: "var(--accent-cyan)"
                                        }}
                                    >
                                        <span>📂 Seleccionar Archivo PNG</span>
                                        <input
                                            ref={extractFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleExtractImageFile}
                                            style={{ display: "none" }}
                                        />
                                    </label>
                                </div>

                                {customExtractImage && (
                                    <div style={{ width: "100%", maxHeight: "180px", overflow: "hidden", borderRadius: "8px", border: "1px solid var(--glass-border)", marginTop: "6px" }}>
                                        <img src={customExtractImage} alt="Extract Carrier" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                                    </div>
                                )}
                            </div>

                            <input
                                type="password"
                                value={extractPassword}
                                onChange={e => setExtractPassword(e.target.value)}
                                placeholder="Contraseña de descifrado (si la imagen fue protegida con clave)"
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
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                                                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                                    Tamaño: {extractResult.payloadBytes} bytes · Cifrado: {extractResult.wasEncrypted ? "AES-256-GCM" : "Plano"}
                                                </span>
                                                <div style={{ display: "flex", gap: "6px" }}>
                                                    <button
                                                        onClick={() => copyToClipboard(extractResult.payloadText || "")}
                                                        className="btn-tactical-secondary"
                                                        style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                                                    >
                                                        📋 Copiar
                                                    </button>
                                                    <button
                                                        onClick={handleBroadcastExtractedSecret}
                                                        className="btn-tactical-primary"
                                                        style={{
                                                            padding: "6px 12px", fontSize: "0.76rem",
                                                            background: "rgba(0, 229, 255, 0.2)", border: "1px solid #00E5FF", color: "#00E5FF"
                                                        }}
                                                    >
                                                        📡 Transmitir a Malla
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            TacticalAudioEngine.playTap();
                                                            navigate("chat");
                                                        }}
                                                        className="btn-tactical-secondary"
                                                        style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                                                    >
                                                        💬 Abrir en Chat
                                                    </button>
                                                </div>
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
                                    {vaultCapsules.map((cap) => {
                                        const carrierImg = cap.image_data_url || cap.image_data || cap.media_data || "";
                                        const isConfirmingDelete = deletingId === cap.id;

                                        return (
                                            <div
                                                key={cap.id}
                                                className="card-tactical"
                                                style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}
                                            >
                                                <div style={{ width: "100%", height: "120px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--glass-border)", background: "#05050D" }}>
                                                    {carrierImg ? (
                                                        <img src={carrierImg} alt={cap.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                    ) : (
                                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                                            Sin previsualización
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                                                    {cap.title}
                                                </div>
                                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                                                    <span>{cap.has_password ? "🔒 Cifrado" : "🔓 Plano"}</span>
                                                    <span>{new Date(cap.timestamp).toLocaleDateString()}</span>
                                                </div>

                                                {isConfirmingDelete ? (
                                                    <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                                                        <button
                                                            onClick={() => handleDeleteCapsule(cap.id)}
                                                            className="btn-tactical-primary"
                                                            style={{ flex: 1, padding: "4px", fontSize: "0.72rem", background: "var(--accent-crimson)", color: "#fff" }}
                                                        >
                                                            Confirmar
                                                        </button>
                                                        <button
                                                            onClick={() => setDeletingId(null)}
                                                            className="btn-ghost"
                                                            style={{ flex: 1, padding: "4px", fontSize: "0.72rem" }}
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                                                        <button
                                                            onClick={() => {
                                                                setCustomExtractImage(carrierImg);
                                                                setMode("extract");
                                                            }}
                                                            className="btn-tactical-secondary"
                                                            style={{ flex: 1, padding: "6px", fontSize: "0.72rem" }}
                                                        >
                                                            🔓 Revelar
                                                        </button>
                                                        {carrierImg && (
                                                            <button
                                                                onClick={() => handleDownloadPng(carrierImg, cap.title)}
                                                                className="btn-icon"
                                                                title="Descargar PNG"
                                                                style={{ width: 30, height: 30 }}
                                                            >
                                                                💾
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setDeletingId(cap.id)}
                                                            className="btn-icon"
                                                            title="Eliminar de Sled"
                                                            style={{ width: 30, height: 30, color: "var(--accent-crimson-bright)" }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}