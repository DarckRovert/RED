"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRedStore } from "../../store/useRedStore";
import { toast } from "../Toast";

export const STORY_THEMES = [
    { label: "Carmesí", from: "#FF3355", to: "#8B0000" },
    { label: "Cian Táctico", from: "#00E5FF", to: "#0284C7" },
    { label: "Esmeralda", from: "#00E676", to: "#00796B" },
    { label: "Ámbar Alerta", from: "#FFA726", to: "#E65100" },
    { label: "Púrpura Cifrado", from: "#7E57C2", to: "#4527A0" },
    { label: "Void OLED", from: "#16162a", to: "#080812" },
    { label: "Atardecer", from: "#FF6B35", to: "#E8213A" },
    { label: "Aurora", from: "#EC407A", to: "#7B1FA2" },
];

interface StoryCreatorProps {
    onClose?: () => void;
    onPublished?: () => void;
}

export default function StoryCreator({ onClose, onPublished }: StoryCreatorProps) {
    const { contacts, publishStatus } = useRedStore();

    const [mode, setMode] = useState<"text" | "photo">("text");
    const [text, setText] = useState("");
    const [theme, setTheme] = useState(0);
    const [photoData, setPhotoData] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const selectedTheme = STORY_THEMES[theme];

    const handlePickPhoto = useCallback(async () => {
        try {
            const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
            const photo = await Camera.getPhoto({
                quality: 70,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Prompt,
                width: 720,
                height: 1280,
                correctOrientation: true,
            });
            if (photo.base64String) {
                setPhotoData(photo.base64String);
                setMode("photo");
            }
        } catch {
            fileInputRef.current?.click();
        }
    }, []);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            const base64 = result.includes(",") ? result.split(",")[1] : result;
            setPhotoData(base64);
            setMode("photo");
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    }, []);

    const handlePublish = useCallback(async () => {
        if (mode === "text" && !text.trim()) return;
        if (mode === "photo" && !photoData) return;
        if (isSending) return;

        setIsSending(true);
        try {
            await publishStatus(
                mode === "text" ? text.trim() : (text.trim() || "📷 Estado con foto"),
                mode === "photo" ? photoData : null,
                mode === "text" ? theme : undefined,
            );
            toast.success("Estado publicado en la malla P2P");
            onClose?.();
        } catch {
            toast.error("Error al publicar estado");
            setIsSending(false);
        }
    }, [mode, text, photoData, theme, isSending, publishStatus, onClose]);

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: mode === "photo" && photoData ? "#000" : `linear-gradient(135deg, ${selectedTheme.from}, ${selectedTheme.to})`,
            color: "white", display: "flex", flexDirection: "column",
            overflow: "hidden",
        }}>
            {/* Hidden File Input Fallback */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                style={{ display: "none" }}
            />

            {/* Top HUD Controls */}
            <div style={{
                padding: "calc(16px + var(--safe-top, 0px)) 16px 16px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)",
                zIndex: 10
            }}>
                <button
                    onClick={onClose}
                    className="btn-icon"
                    style={{ background: "rgba(0,0,0,0.5)", width: 38, height: 38 }}
                >
                    ✕
                </button>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={handlePickPhoto}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem", background: "rgba(0,0,0,0.5)" }}
                    >
                        📷 {mode === "photo" ? "Cambiar Foto" : "Foto"}
                    </button>
                    {mode === "photo" && (
                        <button
                            onClick={() => { setMode("text"); setPhotoData(null); }}
                            className="btn-tactical-secondary"
                            style={{ padding: "6px 12px", fontSize: "0.78rem", background: "rgba(0,0,0,0.5)" }}
                        >
                            ✍️ Texto
                        </button>
                    )}
                </div>
            </div>

            {/* Center Canvas / Text Area */}
            <div style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                padding: "20px", position: "relative", overflow: "hidden"
            }}>
                {mode === "photo" && photoData ? (
                    <img
                        src={`data:image/jpeg;base64,${photoData}`}
                        alt="Estado Capturado"
                        style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "16px" }}
                    />
                ) : (
                    <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Escribe tu estado para la malla..."
                        maxLength={280}
                        autoFocus
                        style={{
                            width: "100%", maxWidth: "420px", background: "transparent",
                            border: "none", outline: "none", color: "#fff",
                            fontSize: "1.4rem", fontWeight: 800, textAlign: "center",
                            resize: "none", textShadow: "0 2px 10px rgba(0,0,0,0.5)"
                        }}
                    />
                )}
            </div>

            {/* Bottom Controls */}
            <div style={{
                padding: "16px 16px calc(24px + var(--safe-bottom, 0px)) 16px",
                display: "flex", flexDirection: "column", gap: "12px",
                background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)",
                zIndex: 10
            }}>
                {mode === "text" && (
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center", overflowX: "auto", paddingBottom: "4px" }}>
                        {STORY_THEMES.map((t, i) => (
                            <div
                                key={t.label}
                                onClick={() => setTheme(i)}
                                style={{
                                    width: 28, height: 28, borderRadius: "50%",
                                    background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                                    border: theme === i ? "2px solid #fff" : "2px solid rgba(255,255,255,0.2)",
                                    boxShadow: theme === i ? "0 0 10px #fff" : "none",
                                    cursor: "pointer", flexShrink: 0
                                }}
                            />
                        ))}
                    </div>
                )}

                <button
                    onClick={handlePublish}
                    disabled={isSending || (mode === "text" && !text.trim()) || (mode === "photo" && !photoData)}
                    className="btn-tactical-primary"
                    style={{ width: "100%", maxWidth: "420px", margin: "0 auto", padding: "12px 20px", fontSize: "0.95rem" }}
                >
                    {isSending ? "Publicando en Malla..." : "PUBLICAR ESTADO (24H)"}
                </button>
            </div>
        </div>
    );
}