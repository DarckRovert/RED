import React from "react";
import { useRedStore } from "../../store/useRedStore";
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
}) => {
    const { navigate } = useRedStore();

    return (
            <header className="safe-header" style={{
                padding: "12px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title="Volver a la lista"
                        style={{ width: 36, height: 36, flexShrink: 0 }}
                    >
                        ←
                    </button>

                    {/* Avatar y Datos del Interlocutor (Click para abrir perfil) */}
                    <div
                        onClick={() => setIsContactProfileOpen(true)}
                        style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden", cursor: "pointer" }}
                        title="Ver info y archivos del contacto"
                    >
                        <div style={{ position: "relative", flexShrink: 0 }}>
                            <div style={{
                                width: 38, height: 38, borderRadius: "50%",
                                ...avStyle(peerHash || "RED"),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontWeight: 900, color: "white", fontSize: "1rem"
                            }}>
                                {peerName[0]?.toUpperCase() || "🔴"}
                            </div>
                            <div style={{
                                position: "absolute", bottom: -1, right: -1,
                                width: 10, height: 10, borderRadius: "50%",
                                background: isOnline ? "var(--accent-emerald)" : "var(--text-muted)",
                                border: "2px solid var(--bg-void)",
                                boxShadow: isOnline ? "0 0 6px var(--accent-emerald)" : "none"
                            }} />
                        </div>

                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{peerName}</span>
                                <span className="badge-tactical badge-tactical-cyan" style={{ fontSize: "0.62rem", padding: "1px 6px", flexShrink: 0 }}>NOISE E2E</span>
                                {isVerified && (
                                    <span
                                        onClick={() => setIsSafetyModalOpen(true)}
                                        className="badge-tactical"
                                        style={{
                                            fontSize: "0.62rem", padding: "1px 6px", flexShrink: 0, cursor: "pointer",
                                            background: "rgba(0, 230, 118, 0.15)", color: "#00E676", border: "1px solid rgba(0, 230, 118, 0.4)"
                                        }}
                                        title="Identidad Criptográfica Verificada (Toca para ver Safety Number)"
                                    >
                                        🛡️ VERIFICADO
                                    </span>
                                )}
                            </div>
                            <div style={{
                                fontSize: "0.68rem",
                                color: (peerTypingStatus?.[peerHash] && peerTypingStatus[peerHash] !== 'idle') || peerTyping
                                    ? "var(--accent-cyan)"
                                    : (isOnline ? "var(--accent-emerald)" : "var(--text-muted)"),
                                fontFamily: "JetBrains Mono, monospace",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                fontWeight: (peerTypingStatus?.[peerHash] && peerTypingStatus[peerHash] !== 'idle') || peerTyping ? 800 : 500
                            }}>
                                {peerTypingStatus?.[peerHash] === 'recording_voice'
                                    ? '🎙️ Grabando audio...'
                                    : ((peerTypingStatus?.[peerHash] === 'typing' || peerTyping)
                                        ? '✍️ Escribiendo...'
                                        : (isOnline ? "● CONECTADO EN MALLA" : `DID: ${peerHash.substring(0, 10)}…`))}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, position: "relative" }}>
                    {/* Ephemeral / Auto-Destruct Timer Button */}
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

                    {/* Ephemeral Timer Dropdown Menu */}
                    {burnMenuOpen && (
                        <>
                            <div onClick={() => setBurnMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 120 }} />
                            <div style={{
                                position: "absolute", top: "44px", right: "0px", zIndex: 130,
                                background: "rgba(18, 22, 38, 0.98)", backdropFilter: "blur(16px)",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                borderRadius: "14px", padding: "8px", width: "190px",
                                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.8)",
                                animation: "fadeIn 0.15s ease"
                            }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--accent-red, #FF5252)", padding: "4px 8px 8px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", fontFamily: "JetBrains Mono, monospace" }}>
                                    ⏳ AUTO-DESTRUCCIÓN
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

                    <button
                        onClick={() => setSearchOpen(v => !v)}
                        className="btn-icon"
                        title="Buscar en conversación"
                        style={{ width: 36, height: 36, color: searchOpen ? "var(--accent-amber)" : "var(--text-secondary)" }}
                    >
                        🔍
                    </button>

                    <button
                        onClick={() => {
                            try {
                                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                                if (AudioContextClass) {
                                    const ctx = new AudioContextClass();
                                    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
                                }
                            } catch {}
                            const target = fullPeerHash || peerHash;
                            const newCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                            setActiveCallType('audio');
                            useRedStore.setState({
                                activeCallPeer: target,
                                activeCallId: newCallId,
                                activeCallOffer: null,
                                activeCallSignal: null,
                                callSignalQueue: []
                            });
                            navigate("call", target);
                        }}
                        className="btn-icon"
                        title="Llamada de Voz P2P WebRTC"
                        style={{ width: 36, height: 36, color: "var(--accent-emerald)" }}
                    >
                        📞
                    </button>

                    <button
                        onClick={() => {
                            try {
                                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                                if (AudioContextClass) {
                                    const ctx = new AudioContextClass();
                                    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
                                }
                            } catch {}
                            const target = fullPeerHash || peerHash;
                            const newCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                            setActiveCallType('video');
                            useRedStore.setState({
                                activeCallPeer: target,
                                activeCallId: newCallId,
                                activeCallOffer: null,
                                activeCallSignal: null,
                                callSignalQueue: []
                            });
                            navigate("call", target);
                        }}
                        className="btn-icon"
                        title="Videollamada HD P2P WebRTC"
                        style={{ width: 36, height: 36, color: "var(--accent-cyan)" }}
                    >
                        📹
                    </button>

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

                    {/* Security & Remote Wipe Dropdown Menu */}
                    <div style={{ position: "relative" }}>
                        <button
                            onClick={() => setIsSecurityMenuOpen(v => !v)}
                            className="btn-icon"
                            title="Opciones de Seguridad Avanzada"
                            style={{ width: 36, height: 36, color: "var(--text-secondary)" }}
                        >
                            ⋮
                        </button>
                        {isSecurityMenuOpen && (
                            <>
                                <div onClick={() => setIsSecurityMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 120 }} />
                                <div style={{
                                    position: "absolute", top: "44px", right: "0px", zIndex: 130,
                                    background: "rgba(18, 22, 38, 0.98)", backdropFilter: "blur(16px)",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    borderRadius: "14px", padding: "6px", width: "230px",
                                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.8)",
                                    animation: "fadeIn 0.15s ease", display: "flex", flexDirection: "column", gap: "2px"
                                }}>
                                    <button
                                        onClick={() => {
                                            setIsSecurityMenuOpen(false);
                                            setIsSafetyModalOpen(true);
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "8px",
                                            padding: "8px 10px", borderRadius: "8px", background: "transparent",
                                            border: "none", color: "#FFFFFF", fontSize: "0.82rem", fontWeight: 600,
                                            cursor: "pointer", textAlign: "left"
                                        }}
                                    >
                                        <span>🛡️</span>
                                        <span>Safety Number (60 dígitos)</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsSecurityMenuOpen(false);
                                            setIsWipeConfirmOpen(true);
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "8px",
                                            padding: "8px 10px", borderRadius: "8px", background: "transparent",
                                            border: "none", color: "var(--accent-crimson, #FF3C5F)", fontSize: "0.82rem", fontWeight: 700,
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
