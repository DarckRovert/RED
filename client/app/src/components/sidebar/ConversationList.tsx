import React from "react";
import { useRedStore } from "../../store/useRedStore";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { avatarStyle, formatTime } from "./types";

interface ConversationListProps {
    filteredConvs: any[];
    resolvePeerName: (peerHash: string) => string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
    filteredConvs,
    resolvePeerName,
}) => {
    const { navigate } = useRedStore();

    if (filteredConvs.length === 0) {
        return (
            <div className="empty-state-tactical">
                <div className="empty-state-icon">📡</div>
                <div className="empty-state-title">Sin Transmisiones en Malla</div>
                <div className="empty-state-desc">Escanea un código QR o descubre nodos vecinos en el Radar táctico.</div>
                <button
                    onClick={() => navigate("radar")}
                    className="btn-tactical-primary"
                    style={{ marginTop: "12px", padding: "8px 16px", fontSize: "0.8rem" }}
                >
                    Abrir Radar P2P
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {filteredConvs.map(c => {
                const rawTs = (typeof c.last_message === "object" && c.last_message?.timestamp) || (c as any).last_timestamp;
                const lm = c.last_message;
                let snippet = "Mensaje cifrado";
                if (lm) {
                    const msgType = typeof lm === "object" ? lm.msg_type : null;
                    const content = typeof lm === "object" ? lm.content : lm;
                    const isOwn = typeof lm === "object" && (lm as any).is_mine;
                    const prefix = isOwn ? "Tú: " : "";
                    if (msgType === "image" || content?.startsWith("data:image")) snippet = prefix + "📷 Foto";
                    else if (msgType === "voice" || msgType === "audio" || content?.startsWith("data:audio")) snippet = prefix + "🎤 Nota de voz";
                    else if (msgType === "video" || content?.startsWith("data:video")) snippet = prefix + "📹 Video";
                    else if (msgType === "location" || content?.includes("Ubicación Táctica")) snippet = prefix + "📍 Ubicación";
                    else if (msgType === "poll") snippet = prefix + "📊 Encuesta";
                    else if (content && !content.startsWith("data:") && !content.startsWith("[")) {
                        // Block JSON signaling packets from appearing as conversation preview
                        let isSignalingJson = false;
                        if (content.startsWith("{")) {
                            try {
                                const c = JSON.parse(content);
                                const SIGNAL_TYPES = ['IDENTITY_ANNOUNCE','IDENTITY_RESPONSE','IDENTITY_REQUEST','SHAKE_PAIR_BROADCAST','SHAKE_PAIR_ACCEPT','DELIVERY_ACK','PROFILE_UPDATE','NODE_LOCATION_UPDATE'];
                                const SIGNAL_KEYS = ['read_up_to','reader_hash','offer','answer','candidate','hangup','sender_hash','sender_pk','beacon_id'];
                                if (c.type && SIGNAL_TYPES.some(t => c.type.startsWith(t.split('_')[0]))) isSignalingJson = true;
                                else if (SIGNAL_KEYS.filter(k => k in c).length >= 2) isSignalingJson = true;
                                else if (c.reason === 'user_remote_wipe') isSignalingJson = true;
                            } catch {}
                        }
                        if (!isSignalingJson) {
                            const truncated = content.length > 38 ? content.substring(0, 38) + "…" : content;
                            snippet = prefix + truncated;
                        }
                    }
                }
                const isPeerOnline = meshRouter.peers.has(c.peer) || Array.from(meshRouter.peers.values()).some(p => p.id === c.peer);
                return (
                    <div
                        key={c.peer}
                        onClick={() => navigate("chat", c.peer)}
                        className="card-tactical-interactive"
                        style={{
                            padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px",
                            border: isPeerOnline ? "1px solid rgba(0, 230, 118, 0.2)" : "1px solid var(--glass-border)",
                            background: isPeerOnline ? "linear-gradient(135deg, rgba(0,230,118,0.03) 0%, rgba(18,18,32,0.85) 100%)" : undefined
                        }}
                    >
                        <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: "50%",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.1rem", fontWeight: 800, color: "#fff",
                                ...avatarStyle(c.peer),
                                boxShadow: isPeerOnline ? "0 0 10px rgba(0, 230, 118, 0.4)" : undefined,
                                border: isPeerOnline ? "2px solid rgba(0, 230, 118, 0.7)" : "2px solid rgba(255,255,255,0.08)",
                            }}>
                                {resolvePeerName(c.peer).charAt(0).toUpperCase()}
                            </div>
                            {isPeerOnline && (
                                <span
                                    title="En línea en la Malla"
                                    style={{
                                        position: "absolute", bottom: -1, right: -1,
                                        width: 12, height: 12, borderRadius: "50%",
                                        background: "#00E676",
                                        border: "2px solid #06060c",
                                        boxShadow: "0 0 6px #00E676",
                                        animation: "beaconPulse 2s infinite"
                                    }}
                                />
                            )}
                        </div>
                        <div style={{ flex: 1, overflow: "hidden" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>{resolvePeerName(c.peer)}</span>
                                    {isPeerOnline && (
                                        <span style={{ fontSize: "0.55rem", padding: "1px 4px", borderRadius: "4px", background: "rgba(0, 230, 118, 0.15)", color: "#00E676", border: "1px solid rgba(0, 230, 118, 0.4)", fontFamily: "JetBrains Mono, monospace" }}>
                                            EN VIVO
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                    {rawTs ? formatTime(rawTs) : ""}
                                </div>
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                                {snippet}
                            </div>
                        </div>
                        {(c.unread_count || 0) > 0 && (
                            <span className="badge-tactical badge-tactical-cyan" style={{ borderRadius: "var(--radius-full)", padding: "2px 8px", boxShadow: "0 0 10px rgba(0, 229, 255, 0.4)" }}>
                                {c.unread_count}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
