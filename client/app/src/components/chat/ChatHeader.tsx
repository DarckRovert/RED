import React from "react";
import { useRedStore } from "../../store/useRedStore";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

interface ChatHeaderProps {
    goBack: () => void;
    setIsContactProfileOpen: (v: boolean) => void;
    peerHash: string;
    fullPeerHash: string;
    peerName: string;
    isOnline: boolean;
    isVerified: boolean;
    setIsSafetyModalOpen: (v: boolean) => void;
    peerTypingStatus: Record<string, string>;
    peerTyping: boolean;
    burnTimer?: number;
    setBurnTimer: (v: number | undefined) => void;
    burnMenuOpen: boolean;
    setBurnMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    searchOpen: boolean;
    setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setActiveCallType: (t: 'audio' | 'video') => void;
    handleSummarize: () => void;
    isSummarizing: boolean;
    isSecurityMenuOpen: boolean;
    setIsSecurityMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsWipeConfirmOpen: (v: boolean) => void;
    avStyle: (hash: string) => any;
    isGroupChat?: boolean;
    onStartGroupCall?: (type: 'audio' | 'video') => void;
    onOpenMediaGallery?: () => void;
    onOpenStarredModal?: () => void;
    onOpenWallpaperModal?: () => void;
    onClearChat?: () => void;
    onExportChat?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    goBack,
    setIsContactProfileOpen,
    peerHash,
    fullPeerHash,
    peerName,
    isOnline,
    isVerified,
    setIsSafetyModalOpen,
    peerTypingStatus,
    peerTyping,
    burnTimer,
    setBurnTimer,
    burnMenuOpen,
    setBurnMenuOpen,
    searchOpen,
    setSearchOpen,
    setActiveCallType,
    handleSummarize,
    isSummarizing,
    isSecurityMenuOpen,
    setIsSecurityMenuOpen,
    setIsWipeConfirmOpen,
    avStyle,
    isGroupChat,
    onStartGroupCall,
    onOpenMediaGallery,
    onOpenStarredModal,
    onOpenWallpaperModal,
    onClearChat,
    onExportChat,
}) => {
    const { navigate, preferences } = useRedStore();
    const { t } = useTranslation();
    const isFamiliar = (preferences?.uiMode ?? 'familiar') !== 'tactical';

    const isTyping = (peerTypingStatus?.[peerHash] === 'typing') || peerTyping;
    const isRecordingVoice = peerTypingStatus?.[peerHash] === 'recording_voice';

    const getStatusText = () => {
        if (isRecordingVoice) {
            return `🎙️ ${t.chat_extended?.recording_p2p || 'grabando audio...'}`;
        }
        if (isTyping) {
            return isFamiliar ? 'escribiendo...' : '✍️ ...';
        }
        if (isOnline) {
            return isFamiliar ? 'en línea' : '● ON-GRID MESH';
        }
        return isFamiliar ? 'modo malla P2P' : `DID: ${peerHash.substring(0, 10)}…`;
    };

    const getStatusColor = () => {
        if (isRecordingVoice || isTyping) return isFamiliar ? "#00A884" : "var(--accent-cyan)";
        if (isOnline) return isFamiliar ? "#00A884" : "var(--accent-emerald)";
        return isFamiliar ? "#8696A0" : "var(--text-muted)";
    };

    const startAudioCall = () => {
        if (isGroupChat && onStartGroupCall) {
            onStartGroupCall('audio');
            return;
        }
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                const ctx = new AudioContextClass();
                if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            }
        } catch {}
        const target = fullPeerHash || peerHash;
        const randSuffix = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('')
            : Date.now().toString(36);
        const newCallId = `call_${Date.now()}_${randSuffix}`;
        setActiveCallType('audio');
        useRedStore.setState({
            activeCallPeer: target,
            activeCallId: newCallId,
            activeCallOffer: null,
            activeCallSignal: null,
            callSignalQueue: []
        });
        navigate("call", target);
    };

    const startVideoCall = () => {
        if (isGroupChat && onStartGroupCall) {
            onStartGroupCall('video');
            return;
        }
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                const ctx = new AudioContextClass();
                if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            }
        } catch {}
        const target = fullPeerHash || peerHash;
        const randSuffix = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('')
            : Date.now().toString(36);
        const newCallId = `call_${Date.now()}_${randSuffix}`;
        setActiveCallType('video');
        useRedStore.setState({
            activeCallPeer: target,
            activeCallId: newCallId,
            activeCallOffer: null,
            activeCallSignal: null,
            callSignalQueue: []
        });
        navigate("call", target);
    };

    return (
            <header className="safe-header" style={{
                padding: "10px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: isFamiliar ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid var(--glass-border)",
                background: isFamiliar ? "#202C33" : "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title={t.common?.back || "Volver"}
                        style={{ width: 36, height: 36, flexShrink: 0, color: isFamiliar ? "#D1D7DB" : "#FFFFFF" }}
                    >
                        ←
                    </button>

                    {/* Avatar y Datos del Interlocutor (Click para abrir perfil) */}
                    <div
                        onClick={() => setIsContactProfileOpen(true)}
                        style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden", cursor: "pointer" }}
                        title={t.chat?.contact_info || "Ver perfil"}
                    >
                        <div style={{ position: "relative", flexShrink: 0 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: "50%",
                                ...avStyle(peerHash || "RED"),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontWeight: 900, color: "white", fontSize: "1.05rem"
                            }}>
                                {peerName[0]?.toUpperCase() || "🔴"}
                            </div>
                            <div style={{
                                position: "absolute", bottom: -1, right: -1,
                                width: 10, height: 10, borderRadius: "50%",
                                background: isOnline ? (isFamiliar ? "#00A884" : "var(--accent-emerald)") : "var(--text-muted)",
                                border: `2px solid ${isFamiliar ? "#202C33" : "var(--bg-void)"}`,
                                boxShadow: isOnline ? `0 0 6px ${isFamiliar ? "#00A884" : "var(--accent-emerald)"}` : "none"
                            }} />
                        </div>

                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: isFamiliar ? "#E9EDEF" : "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{peerName}</span>
                                {!isFamiliar && (
                                    <span className="badge-tactical badge-tactical-cyan" style={{ fontSize: "0.62rem", padding: "1px 6px", flexShrink: 0 }}>NOISE E2E</span>
                                )}
                                {isVerified && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setIsSafetyModalOpen(true); }}
                                        className={isFamiliar ? "" : "badge-tactical"}
                                        style={{
                                            fontSize: "0.68rem", padding: isFamiliar ? "0 2px" : "1px 6px", flexShrink: 0, cursor: "pointer",
                                            background: isFamiliar ? "transparent" : "rgba(0, 230, 118, 0.15)",
                                            color: isFamiliar ? "#00A884" : "#00E676",
                                            border: isFamiliar ? "none" : "1px solid rgba(0, 230, 118, 0.4)"
                                        }}
                                        title="Safety Number Verificado"
                                    >
                                        🛡️ {isFamiliar ? "" : (t.safety_number?.verified || "VERIFICADO")}
                                    </span>
                                )}
                            </div>
                            <div style={{
                                fontSize: "0.74rem",
                                color: getStatusColor(),
                                fontFamily: isFamiliar ? "inherit" : "JetBrains Mono, monospace",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                fontWeight: (isTyping || isRecordingVoice) ? 700 : 500
                            }}>
                                {getStatusText()}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, position: "relative" }}>
                    {/* Ephemeral Timer Dropdown Menu */}
                    {burnMenuOpen && (
                        <>
                            <div onClick={() => setBurnMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 120 }} />
                            <div style={{
                                position: "absolute", top: "44px", right: "0px", zIndex: 130,
                                background: isFamiliar ? "#233138" : "rgba(18, 22, 38, 0.98)", backdropFilter: "blur(16px)",
                                border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0.15)",
                                borderRadius: "14px", padding: "8px", width: "190px",
                                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.8)",
                                animation: "fadeIn 0.15s ease"
                            }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--accent-red, #FF5252)", padding: "4px 8px 8px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", fontFamily: "JetBrains Mono, monospace" }}>
                                    ⏳ MENSAJES TEMPORALES
                                </div>
                                {[
                                    { label: "Desactivado", sec: undefined },
                                    { label: "5 segundos", sec: 5 },
                                    { label: "10 segundos", sec: 10 },
                                    { label: "30 segundos", sec: 30 },
                                    { label: "1 minuto", sec: 60 },
                                    { label: "5 minutos", sec: 300 },
                                    { label: "1 hora", sec: 3600 },
                                    { label: "24 horas", sec: 86400 }
                                ].map((opt) => (
                                    <button
                                        key={opt.label}
                                        onClick={() => {
                                            setBurnTimer(opt.sec);
                                            setBurnMenuOpen(false);
                                            toast.info(opt.sec ? `🔥 Auto-destrucción fijada en ${opt.label}` : "⏱️ Mensajes persistentes (normal)");
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            width: "100%", padding: "8px 10px", borderRadius: "8px",
                                            background: burnTimer === opt.sec ? "rgba(255, 82, 82, 0.18)" : "transparent",
                                            border: "none", color: burnTimer === opt.sec ? "#FF5252" : "#FFFFFF",
                                            fontSize: "0.82rem", fontWeight: burnTimer === opt.sec ? 800 : 500,
                                            cursor: "pointer", textAlign: "left", transition: "background 0.1s"
                                        }}
                                    >
                                        <span>{opt.label}</span>
                                        {burnTimer === opt.sec && <span style={{ fontSize: "0.75rem" }}>✓</span>}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Tactical Mode: Explicit Ephemeral Button */}
                    {!isFamiliar && (
                        <button
                            onClick={() => setBurnMenuOpen(v => !v)}
                            className="btn-icon"
                            title="Mensajes Efímeros / Auto-destrucción"
                            style={{
                                width: 36, height: 36,
                                color: burnTimer ? "var(--accent-red, #FF5252)" : "var(--text-secondary)",
                                background: burnTimer ? "rgba(255, 82, 82, 0.15)" : "transparent",
                                borderRadius: "10px",
                                border: burnTimer ? "1px solid rgba(255, 82, 82, 0.4)" : "none",
                                fontSize: "0.95rem"
                            }}
                        >
                            {burnTimer ? "🔥" : "⏱️"}
                        </button>
                    )}

                    {/* Video Call Button */}
                    <button
                        onClick={startVideoCall}
                        className="btn-icon"
                        title={isGroupChat ? "Sala de Video Grupal del Escuadrón" : "Videollamada HD P2P WebRTC"}
                        style={{ width: 36, height: 36, color: isFamiliar ? "#D1D7DB" : "var(--accent-cyan)" }}
                    >
                        📹
                    </button>

                    {/* Voice Call Button */}
                    <button
                        onClick={startAudioCall}
                        className="btn-icon"
                        title={isGroupChat ? "Sala de Voz Grupal del Escuadrón" : "Llamada de Voz P2P WebRTC"}
                        style={{ width: 36, height: 36, color: isFamiliar ? "#D1D7DB" : "var(--accent-emerald)" }}
                    >
                        📞
                    </button>

                    {/* Search in Chat Button */}
                    <button
                        onClick={() => setSearchOpen(v => !v)}
                        className="btn-icon"
                        title="Buscar en conversación"
                        style={{ width: 36, height: 36, color: searchOpen ? "var(--accent-amber)" : (isFamiliar ? "#D1D7DB" : "var(--text-secondary)") }}
                    >
                        🔍
                    </button>

                    {/* Tactical Mode Only Buttons */}
                    {!isFamiliar && (
                        <>
                            <button
                                onClick={() => navigate("p2pCompass", fullPeerHash || peerHash)}
                                className="btn-icon"
                                title="🧭 Brújula Táctica P2P (Apuntar rumbo al contacto)"
                                style={{ width: 36, height: 36, color: "var(--accent-amber)" }}
                            >
                                🧭
                            </button>

                            <button
                                onClick={handleSummarize}
                                disabled={isSummarizing}
                                className="btn-icon"
                                title="Resumen IA del Canal"
                                style={{ width: 36, height: 36, color: "var(--accent-cyan)" }}
                            >
                                {isSummarizing ? "..." : "🤖"}
                            </button>

                            <button
                                onClick={() => setIsSafetyModalOpen(true)}
                                className="btn-icon"
                                title={isVerified ? "Identidad Verificada — Ver Safety Number" : "Verificar Safety Number (Criptografía Signal-Class)"}
                                style={{
                                    width: 36, height: 36,
                                    color: isVerified ? "var(--accent-emerald, #00E676)" : "var(--text-secondary)",
                                    background: isVerified ? "rgba(0, 230, 118, 0.12)" : "transparent",
                                    borderRadius: "10px",
                                    fontSize: "0.95rem"
                                }}
                            >
                                🛡️
                            </button>
                        </>
                    )}

                    {/* 3-Dots Options Menu */}
                    <div style={{ position: "relative" }}>
                        <button
                            onClick={() => setIsSecurityMenuOpen(v => !v)}
                            className="btn-icon"
                            title="Más opciones"
                            style={{ width: 36, height: 36, color: isFamiliar ? "#D1D7DB" : "var(--text-secondary)" }}
                        >
                            ⋮
                        </button>
                        {isSecurityMenuOpen && (
                            <>
                                <div onClick={() => setIsSecurityMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 120 }} />
                                <div style={{
                                    position: "absolute", top: "44px", right: "0px", zIndex: 130,
                                    background: isFamiliar ? "#233138" : "rgba(18, 22, 38, 0.98)", backdropFilter: "blur(16px)",
                                    border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0.15)",
                                    borderRadius: "14px", padding: "6px", width: "240px",
                                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.8)",
                                    animation: "fadeIn 0.15s ease", display: "flex", flexDirection: "column", gap: "2px"
                                }}>
                                    <button
                                        onClick={() => {
                                            setIsSecurityMenuOpen(false);
                                            setIsContactProfileOpen(true);
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "10px",
                                            padding: "9px 12px", borderRadius: "8px", background: "transparent",
                                            border: "none", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 500,
                                            cursor: "pointer", textAlign: "left"
                                        }}
                                    >
                                        <span>👤</span>
                                        <span>Info. del contacto</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setIsSecurityMenuOpen(false);
                                            if (onOpenMediaGallery) onOpenMediaGallery();
                                            else setIsContactProfileOpen(true);
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "10px",
                                            padding: "9px 12px", borderRadius: "8px", background: "transparent",
                                            border: "none", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 500,
                                            cursor: "pointer", textAlign: "left"
                                        }}
                                    >
                                        <span>🖼️</span>
                                        <span>Archivos, enlaces y docs</span>
                                    </button>

                                    {onOpenStarredModal && (
                                        <button
                                            onClick={() => {
                                                setIsSecurityMenuOpen(false);
                                                onOpenStarredModal();
                                            }}
                                            style={{
                                                display: "flex", alignItems: "center", gap: "10px",
                                                padding: "9px 12px", borderRadius: "8px", background: "transparent",
                                                border: "none", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 500,
                                                cursor: "pointer", textAlign: "left"
                                            }}
                                        >
                                            <span>⭐</span>
                                            <span>Mensajes destacados</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={() => {
                                            setIsSecurityMenuOpen(false);
                                            setSearchOpen(true);
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "10px",
                                            padding: "9px 12px", borderRadius: "8px", background: "transparent",
                                            border: "none", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 500,
                                            cursor: "pointer", textAlign: "left"
                                        }}
                                    >
                                        <span>🔍</span>
                                        <span>Buscar en el chat</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setIsSecurityMenuOpen(false);
                                            setBurnMenuOpen(true);
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "10px",
                                            padding: "9px 12px", borderRadius: "8px", background: "transparent",
                                            border: "none", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 500,
                                            cursor: "pointer", textAlign: "left"
                                        }}
                                    >
                                        <span>⏱️</span>
                                        <span>Mensajes temporales {burnTimer ? `(${burnTimer}s)` : ""}</span>
                                    </button>

                                    {onOpenWallpaperModal && (
                                        <button
                                            onClick={() => {
                                                setIsSecurityMenuOpen(false);
                                                onOpenWallpaperModal();
                                            }}
                                            style={{
                                                display: "flex", alignItems: "center", gap: "10px",
                                                padding: "9px 12px", borderRadius: "8px", background: "transparent",
                                                border: "none", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 500,
                                                cursor: "pointer", textAlign: "left"
                                            }}
                                        >
                                            <span>🎨</span>
                                            <span>Fondo de pantalla</span>
                                        </button>
                                    )}

                                    {onExportChat && (
                                        <button
                                            onClick={() => {
                                                setIsSecurityMenuOpen(false);
                                                onExportChat();
                                            }}
                                            style={{
                                                display: "flex", alignItems: "center", gap: "10px",
                                                padding: "9px 12px", borderRadius: "8px", background: "transparent",
                                                border: "none", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 500,
                                                cursor: "pointer", textAlign: "left"
                                            }}
                                        >
                                            <span>📄</span>
                                            <span>Exportar chat</span>
                                        </button>
                                    )}

                                    {onClearChat && (
                                        <button
                                            onClick={() => {
                                                setIsSecurityMenuOpen(false);
                                                onClearChat();
                                            }}
                                            style={{
                                                display: "flex", alignItems: "center", gap: "10px",
                                                padding: "9px 12px", borderRadius: "8px", background: "transparent",
                                                border: "none", color: "#FF9800", fontSize: "0.85rem", fontWeight: 500,
                                                cursor: "pointer", textAlign: "left"
                                            }}
                                        >
                                            <span>🧹</span>
                                            <span>Vaciar chat</span>
                                        </button>
                                    )}

                                    <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />

                                    <button
                                        onClick={() => {
                                            setIsSecurityMenuOpen(false);
                                            setIsSafetyModalOpen(true);
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "10px",
                                            padding: "9px 12px", borderRadius: "8px", background: "transparent",
                                            border: "none", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 500,
                                            cursor: "pointer", textAlign: "left"
                                        }}
                                    >
                                        <span>🛡️</span>
                                        <span>Safety Number (Signal-Class)</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setIsSecurityMenuOpen(false);
                                            handleSummarize();
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "10px",
                                            padding: "9px 12px", borderRadius: "8px", background: "transparent",
                                            border: "none", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 500,
                                            cursor: "pointer", textAlign: "left"
                                        }}
                                    >
                                        <span>🤖</span>
                                        <span>Resumen IA del Canal</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setIsSecurityMenuOpen(false);
                                            navigate("p2pCompass", fullPeerHash || peerHash);
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "10px",
                                            padding: "9px 12px", borderRadius: "8px", background: "transparent",
                                            border: "none", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 500,
                                            cursor: "pointer", textAlign: "left"
                                        }}
                                    >
                                        <span>🧭</span>
                                        <span>Brújula Táctica P2P</span>
                                    </button>

                                    <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />

                                    <button
                                        onClick={() => {
                                            setIsSecurityMenuOpen(false);
                                            setIsWipeConfirmOpen(true);
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "10px",
                                            padding: "9px 12px", borderRadius: "8px", background: "transparent",
                                            border: "none", color: "var(--accent-crimson, #FF3C5F)", fontSize: "0.85rem", fontWeight: 600,
                                            cursor: "pointer", textAlign: "left"
                                        }}
                                    >
                                        <span>💣</span>
                                        <span>Borrado Remoto P2P</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

    );
};
