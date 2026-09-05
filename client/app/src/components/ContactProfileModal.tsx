"use client";

import React, { useState, useMemo } from "react";
import { MessageItem, ConversationItem } from "../lib/api";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { MediaGalleryViewer } from "./chat/MediaGalleryViewer";
import { toast } from "./Toast";
import { SettingsManager } from "../lib/settingsManager";
import { useRedStore } from "../store/useRedStore";

interface ContactProfileModalProps {
    contact: any;
    conversation?: ConversationItem | null;
    messages?: MessageItem[];
    onClose: () => void;
    onStartCall?: (type: "audio" | "video") => void;
    onClearChat?: () => void;
    onDeleteContact?: () => void;
    onBlockNode?: () => void;
}

type MediaTab = "media" | "docs" | "audio" | "links";

export const ContactProfileModal: React.FC<ContactProfileModalProps> = ({
    contact,
    conversation,
    messages = [],
    onClose,
    onStartCall,
    onClearChat,
    onDeleteContact,
    onBlockNode,
}) => {
    const { t } = useTranslation();
    const { preferences } = useRedStore();
    const isFamiliar = (preferences?.uiMode ?? 'familiar') !== 'tactical';
    const [activeTab, setActiveTab] = useState<MediaTab>("media");
    const [selectedViewerMedia, setSelectedViewerMedia] = useState<MessageItem | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [burnTimer, setBurnTimer] = useState<number>(0);

    const peerHash = contact?.identity_hash || conversation?.peer || "";
    const displayName = contact?.display_name || (peerHash ? `Operador ${peerHash.substring(0, 8)}` : "Contacto");

    // Categorized shared media
    const photosAndVideos = useMemo(() => {
        return messages.filter(
            (m) =>
                m.msg_type === "image" ||
                m.msg_type === "video" ||
                (m.media_data && (m.media_data.startsWith("data:image/") || m.media_data.startsWith("data:video/")))
        );
    }, [messages]);

    const documents = useMemo(() => {
        return messages.filter(
            (m) =>
                m.msg_type === "document" ||
                m.msg_type === "file" ||
                (m.file_name && !m.media_data?.startsWith("data:image/"))
        );
    }, [messages]);

    const voiceNotes = useMemo(() => {
        return messages.filter(
            (m) =>
                m.msg_type === "voice" ||
                m.msg_type === "audio" ||
                (m.media_data && m.media_data.startsWith("data:audio/"))
        );
    }, [messages]);

    const linksAndLocations = useMemo(() => {
        return messages.filter(
            (m) =>
                m.msg_type === "location" ||
                (m.content && (m.content.includes("http://") || m.content.includes("https://") || m.content.includes("geo:")))
        );
    }, [messages]);

    const handleCopyDid = () => {
        if (!peerHash) return;
        navigator.clipboard.writeText(`did:red:${peerHash}`);
        SettingsManager.triggerHaptic("light");
        toast.success("📋 DID copiado al portapapeles");
    };

    const handleExportChatText = () => {
        if (!messages.length) {
            toast.info("No hay mensajes para exportar");
            return;
        }
        const textLines = messages.map((m) => {
            const time = new Date((m.timestamp > 1e11 ? m.timestamp : m.timestamp * 1000)).toLocaleString();
            const sender = m.is_mine ? "Tú" : displayName;
            return `[${time}] ${sender}: ${m.content || `[${m.msg_type || "Medio"}]`}`;
        });
        const blob = new Blob([textLines.join("\n")], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `chat_${displayName.replace(/\s+/g, "_")}_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("📄 Historial exportado exitosamente");
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                background: isFamiliar ? "#111B21" : "var(--bg-void)",
                color: isFamiliar ? "#E9EDEF" : "var(--text-primary)",
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
                animation: "fadeIn 0.2s ease-out",
            }}
        >
            {/* Header */}
            <header
                style={{
                    height: isFamiliar ? "56px" : "var(--header-h)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 16px",
                    borderBottom: isFamiliar ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid var(--glass-border)",
                    background: isFamiliar ? "#111B21" : "var(--glass-bg)",
                    backdropFilter: isFamiliar ? "none" : "var(--glass-blur)",
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                }}
            >
                <button onClick={onClose} style={{ background: "none", border: "none", color: "#AEBAC1", fontSize: "1.25rem", cursor: "pointer" }}>
                    ←
                </button>
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "#E9EDEF" }}>Info del contacto</span>
                <div style={{ width: 38 }} />
            </header>

            {/* Content Container */}
            <div style={{ maxWidth: "600px", margin: "0 auto", width: "100%", padding: "20px 16px", display: "flex", flexDirection: "column", gap: "18px" }}>
                {/* Profile Header Card */}
                <div
                    style={{
                        padding: "24px 20px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        gap: "12px",
                        borderRadius: "14px",
                        background: isFamiliar ? "#182229" : "linear-gradient(180deg, rgba(232,33,58,0.08) 0%, rgba(10,12,22,0.95) 100%)",
                        border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid var(--glass-border)",
                    }}
                >
                    <div
                        style={{
                            width: "80px",
                            height: "80px",
                            borderRadius: "50%",
                            background: isFamiliar ? "linear-gradient(135deg, #00A884 0%, #005C4B 100%)" : "linear-gradient(135deg, var(--primary) 0%, #750010 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "2.2rem",
                            fontWeight: 900,
                            color: "#fff",
                            boxShadow: isFamiliar ? "0 4px 16px rgba(0, 168, 132, 0.35)" : "0 0 24px var(--primary-glow)",
                            border: isFamiliar ? "none" : "2px solid var(--primary-bright)",
                        }}
                    >
                        {displayName.charAt(0).toUpperCase()}
                    </div>

                    <div>
                        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#E9EDEF", margin: 0 }}>{displayName}</h2>
                        <div
                            onClick={handleCopyDid}
                            style={{
                                fontSize: "0.72rem",
                                color: isFamiliar ? "#00A884" : "var(--accent-cyan)",
                                fontFamily: "JetBrains Mono, monospace",
                                marginTop: "4px",
                                cursor: "pointer",
                                wordBreak: "break-all",
                            }}
                            title="Click para copiar"
                        >
                            did:red:{peerHash.substring(0, 16)}...{peerHash.substring(peerHash.length - 8)} 📋
                        </div>
                        {contact?.bio && (
                            <div style={{ fontSize: "0.82rem", color: isFamiliar ? "#8696A0" : "var(--text-secondary)", marginTop: "6px", fontStyle: "italic" }}>
                                "{contact.bio}"
                            </div>
                        )}
                        {contact?.phone_number && (
                            <div style={{ fontSize: "0.75rem", color: "#8696A0", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                                <span>📱</span> {contact.phone_number}
                            </div>
                        )}
                    </div>

                    {/* Quick Call Action Buttons */}
                    <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                        <button
                            onClick={() => { onClose(); onStartCall?.("audio"); }}
                            style={{
                                padding: "10px 20px", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.84rem",
                                borderRadius: "20px", border: isFamiliar ? "1px solid rgba(0, 168, 132, 0.4)" : "none",
                                background: isFamiliar ? "rgba(0, 168, 132, 0.15)" : "var(--glass-bg)",
                                color: isFamiliar ? "#00A884" : "#FFFFFF", cursor: "pointer", fontWeight: 700
                            }}
                        >
                            <span>📞</span> {t.chat?.call_btn || "Llamada de voz"}
                        </button>
                        <button
                            onClick={() => { onClose(); onStartCall?.("video"); }}
                            style={{
                                padding: "10px 20px", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.84rem",
                                borderRadius: "20px", border: "none",
                                background: isFamiliar ? "#00A884" : "linear-gradient(135deg, var(--accent-cyan), #0097A7)",
                                color: "#FFFFFF", cursor: "pointer", fontWeight: 700,
                                boxShadow: isFamiliar ? "0 2px 10px rgba(0, 168, 132, 0.35)" : "none"
                            }}
                        >
                            <span>📹</span> {t.chat?.video_btn || "Videollamada"}
                        </button>
                    </div>
                </div>

                {/* Shared Media Tabs Header */}
                <div style={{
                    padding: "14px 16px", display: "flex", flexDirection: "column", gap: "14px",
                    borderRadius: "14px",
                    background: isFamiliar ? "#182229" : "var(--bg-card)",
                    border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid var(--glass-border)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#E9EDEF" }}>{t.chat_extended?.gallery_title || "Archivos & Medios Compartidos"}</span>
                        <span style={{ fontSize: "0.72rem", color: "#8696A0", fontFamily: isFamiliar ? "inherit" : "JetBrains Mono, monospace" }}>
                            {messages.length} {t.nav?.chats ? t.nav.chats.toUpperCase() : "MENSAJES"}
                        </span>
                    </div>

                    {/* Media Tabs Pills */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                        {[
                            { id: "media", label: `Fotos (${photosAndVideos.length})`, icon: "🖼️" },
                            { id: "docs", label: `Docs (${documents.length})`, icon: "📄" },
                            { id: "audio", label: `Voz (${voiceNotes.length})`, icon: "🎙️" },
                            { id: "links", label: `Links (${linksAndLocations.length})`, icon: "🔗" },
                        ].map((tab) => {
                            const isSelected = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => { SettingsManager.triggerHaptic("light"); setActiveTab(tab.id as MediaTab); }}
                                    style={{
                                        padding: "8px 2px", fontSize: "0.68rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                                        borderRadius: "10px", cursor: "pointer",
                                        background: isSelected 
                                            ? (isFamiliar ? "rgba(0, 168, 132, 0.2)" : "var(--accent-cyan-subtle)") 
                                            : (isFamiliar ? "rgba(255, 255, 255, 0.04)" : "transparent"),
                                        border: isSelected 
                                            ? (isFamiliar ? "1px solid #00A884" : "1px solid var(--accent-cyan)") 
                                            : "1px solid transparent",
                                        color: isSelected 
                                            ? (isFamiliar ? "#00A884" : "var(--accent-cyan)") 
                                            : "#8696A0",
                                        fontWeight: isSelected ? 700 : 500,
                                        transition: "all 0.15s ease"
                                    }}
                                >
                                    <span>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Media Tab Body */}
                    <div style={{ minHeight: "140px" }}>
                        {activeTab === "media" && (
                            photosAndVideos.length > 0 ? (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                                    {photosAndVideos.map((m) => (
                                        <div
                                            key={m.id}
                                            onClick={() => setSelectedViewerMedia(m)}
                                            style={{
                                                aspectRatio: "1/1",
                                                borderRadius: "8px",
                                                overflow: "hidden",
                                                background: "#000",
                                                cursor: "pointer",
                                                border: "1px solid var(--glass-border)",
                                            }}
                                        >
                                            <img
                                                src={m.media_data || m.content}
                                                alt="Media"
                                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "24px", fontSize: "0.76rem", color: "var(--text-muted)" }}>
                                    No hay fotos ni videos compartidos
                                </div>
                            )
                        )}

                        {activeTab === "docs" && (
                            documents.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {documents.map((m) => (
                                        <div
                                            key={m.id}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "10px",
                                                borderRadius: "8px",
                                                background: "rgba(0,0,0,0.3)",
                                                border: "1px solid var(--glass-border)",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                                                <span style={{ fontSize: "1.4rem" }}>📄</span>
                                                <div style={{ overflow: "hidden" }}>
                                                    <div style={{ fontSize: "0.80rem", fontWeight: 700, color: "#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                                        {m.file_name || "Documento sin nombre"}
                                                    </div>
                                                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                                        {m.file_size ? `${(m.file_size / 1024).toFixed(1)} KB` : "Documento"}
                                                    </div>
                                                </div>
                                            </div>
                                            <a
                                                href={m.media_data || m.content}
                                                download={m.file_name || "document"}
                                                className="btn-tactical-secondary"
                                                style={{ padding: "6px 10px", fontSize: "0.72rem", textDecoration: "none" }}
                                            >
                                                📥
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "24px", fontSize: "0.76rem", color: "var(--text-muted)" }}>
                                    No hay documentos compartidos
                                </div>
                            )
                        )}

                        {activeTab === "audio" && (
                            voiceNotes.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {voiceNotes.map((m) => (
                                        <div
                                            key={m.id}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "10px",
                                                padding: "10px",
                                                borderRadius: "8px",
                                                background: "rgba(0,0,0,0.3)",
                                                border: "1px solid var(--glass-border)",
                                            }}
                                        >
                                            <span>🎙️</span>
                                            <audio src={m.media_data || m.content} controls style={{ height: "32px", flex: 1 }} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "24px", fontSize: "0.76rem", color: "var(--text-muted)" }}>
                                    No hay notas de voz
                                </div>
                            )
                        )}

                        {activeTab === "links" && (
                            linksAndLocations.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {linksAndLocations.map((m) => (
                                        <div
                                            key={m.id}
                                            style={{
                                                padding: "10px",
                                                borderRadius: "8px",
                                                background: "rgba(0,0,0,0.3)",
                                                border: "1px solid var(--glass-border)",
                                                fontSize: "0.78rem",
                                                wordBreak: "break-all",
                                                color: "var(--accent-cyan)",
                                            }}
                                        >
                                            {m.msg_type === "location" ? (
                                                <span>📍 Coordenadas: {m.latitude}, {m.longitude}</span>
                                            ) : (
                                                <a href={m.content} target="_blank" rel="noreferrer" style={{ color: "var(--accent-cyan)" }}>
                                                    {m.content}
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "24px", fontSize: "0.76rem", color: "var(--text-muted)" }}>
                                    No hay enlaces ni coordenadas
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* Privacy & Chat Actions Card */}
                <div style={{
                    padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px",
                    borderRadius: "14px",
                    background: isFamiliar ? "#182229" : "var(--bg-card)",
                    border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid var(--glass-border)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#E9EDEF" }}>Silenciar notificaciones</div>
                            <div style={{ fontSize: "0.72rem", color: "#8696A0" }}>Desactiva alertas y sonidos de este chat</div>
                        </div>
                        <input
                            type="checkbox"
                            checked={isMuted}
                            onChange={(e) => {
                                setIsMuted(e.target.checked);
                                toast.info(e.target.checked ? "🔇 Chat silenciado" : "🔔 Notificaciones activadas");
                            }}
                            style={{ width: 22, height: 22, accentColor: "#00A884", cursor: "pointer" }}
                        />
                    </div>

                    <hr style={{ borderColor: "var(--glass-border)", margin: 0 }} />

                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            onClick={handleExportChatText}
                            className="btn-tactical-secondary"
                            style={{ flex: 1, padding: "10px", fontSize: "0.75rem" }}
                        >
                            📤 Exportar Chat
                        </button>
                        <button
                            onClick={() => {
                                if (window.confirm("¿Seguro que deseas vaciar los mensajes de este chat?")) {
                                    onClearChat?.();
                                    onClose();
                                }
                            }}
                            className="btn-tactical-secondary"
                            style={{ flex: 1, padding: "10px", fontSize: "0.75rem", color: "var(--accent-crimson)", borderColor: "rgba(232,33,58,0.3)" }}
                        >
                            🧹 Vaciar Chat
                        </button>
                    </div>

                    <hr style={{ borderColor: "var(--glass-border)", margin: 0 }} />

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <button
                            onClick={() => {
                                if (window.confirm(`¿Estás seguro de eliminar a ${displayName} de tus contactos?`)) {
                                    onDeleteContact?.();
                                    onClose();
                                }
                            }}
                            style={{
                                width: "100%", padding: "12px",
                                background: "rgba(245,0,87,0.08)",
                                border: "1px solid rgba(245,0,87,0.25)",
                                borderRadius: "10px",
                                color: "#FF5A7E",
                                fontSize: "0.82rem",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                            }}
                        >
                            <span>🗑️</span> {t('profile.delete_contact')}
                        </button>

                        <button
                            onClick={() => {
                                if (window.confirm(`¿Bloquear a ${displayName}? No podrá enviarte mensajes ni solicitudes P2P.`)) {
                                    onBlockNode?.();
                                    onClose();
                                }
                            }}
                            style={{
                                width: "100%", padding: "12px",
                                background: "rgba(255,51,85,0.12)",
                                border: "1px solid rgba(255,51,85,0.4)",
                                borderRadius: "10px",
                                color: "#FF3355",
                                fontSize: "0.82rem",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                            }}
                        >
                            <span>🚫</span> {t('profile.block_contact')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Media Gallery Viewer Modal */}
            {selectedViewerMedia && (
                <MediaGalleryViewer
                    activeMedia={selectedViewerMedia}
                    allMessages={photosAndVideos}
                    onClose={() => setSelectedViewerMedia(null)}
                />
            )}
        </div>
    );
};
