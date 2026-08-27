"use client";

import React from "react";
import { useRedStore } from "../../store/useRedStore";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { avatarStyle, formatTime } from "./types";
import { useTranslation } from "../../lib/i18n/i18nEngine";

interface ConversationListProps {
    filteredConvs: any[];
    resolvePeerName: (peerHash: string) => string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
    filteredConvs,
    resolvePeerName,
}) => {
    const { navigate, groups: rawGroups } = useRedStore();
    const { t } = useTranslation();
    const groups = Array.isArray(rawGroups) ? rawGroups : [];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>

            {/* ── SECCIÓN: NUESTROS GRUPOS / ESCUADRONES ─────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "4px 2px"
                }}>
                    <div style={{
                        fontSize: "0.65rem", fontWeight: 900,
                        color: "var(--accent-purple, #B388FF)",
                        fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.8px",
                        display: "flex", alignItems: "center", gap: "6px"
                    }}>
                        <span>👥</span> {t('sidebar.squads_title')}
                    </div>
                    <button
                        onClick={() => navigate("groups")}
                        style={{
                            background: "rgba(124,77,255,0.12)", border: "1px solid rgba(124,77,255,0.3)",
                            borderRadius: "6px", color: "#B388FF", cursor: "pointer",
                            fontSize: "0.62rem", fontWeight: 800, padding: "3px 8px",
                            transition: "all 0.15s ease"
                        }}
                    >
                        + {t('sidebar.create_squad_btn').split(' ').slice(-1)[0] || 'CREAR'}
                    </button>
                </div>

                {groups.length === 0 ? (
                    <div
                        onClick={() => navigate("groups")}
                        style={{
                            padding: "10px 12px", borderRadius: "10px",
                            background: "rgba(124,77,255,0.06)", border: "1px dashed rgba(124,77,255,0.25)",
                            display: "flex", alignItems: "center", gap: "10px",
                            cursor: "pointer", transition: "all 0.2s ease"
                        }}
                    >
                        <span style={{ fontSize: "1.2rem" }}>👥</span>
                        <div>
                            <div style={{ fontSize: "0.80rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                {t('sidebar.no_squads')}
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                {t('sidebar.no_squads_desc')}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        {groups.slice(0, 5).map((g: any) => (
                            <div
                                key={g.id}
                                onClick={() => navigate("chat", g.id)}
                                className="card-tactical-interactive"
                                style={{
                                    padding: "10px 12px", display: "flex", alignItems: "center", gap: "10px",
                                    border: "1px solid rgba(124,77,255,0.2)",
                                    background: "linear-gradient(135deg, rgba(124,77,255,0.06) 0%, rgba(18,18,32,0.85) 100%)"
                                }}
                            >
                                <div style={{
                                    width: 36, height: 36, borderRadius: "10px", flexShrink: 0,
                                    background: "linear-gradient(135deg, #7C4DFF, #5E35B1)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontWeight: 900, color: "white", fontSize: "1rem"
                                }}>
                                    #
                                </div>
                                <div style={{ flex: 1, overflow: "hidden" }}>
                                    <div style={{
                                        fontSize: "0.88rem", fontWeight: 800, color: "#fff",
                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                                    }}>
                                        {g.name}
                                    </div>
                                    <div style={{ fontSize: "0.66rem", color: "#B388FF", fontFamily: "JetBrains Mono, monospace" }}>
                                        {Array.isArray(g.members) ? g.members.length : 0} {t('modules.groups').includes('P2P') ? 'miembros' : 'members'} · E2E SenderKey
                                    </div>
                                </div>
                                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>›</span>
                            </div>
                        ))}
                        {groups.length > 5 && (
                            <button
                                onClick={() => navigate("groups")}
                                style={{
                                    background: "none", border: "1px solid rgba(124,77,255,0.2)", borderRadius: "8px",
                                    color: "#B388FF", cursor: "pointer", fontSize: "0.72rem", fontWeight: 800,
                                    padding: "6px 12px", transition: "all 0.15s ease"
                                }}
                            >
                                Ver todos ({groups.length}) →
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Divisor ────────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0" }}>
                <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
                <span style={{
                    fontSize: "0.60rem", color: "var(--text-muted)",
                    fontFamily: "JetBrains Mono, monospace", fontWeight: 700, whiteSpace: "nowrap"
                }}>
                    {t('nav.chats') || "CONVERSACIONES P2P"}
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
            </div>

            {/* ── Lista de Conversaciones ────────────────────────────── */}
            {filteredConvs.length === 0 ? (
                <div className="empty-state-tactical">
                    <div className="empty-state-icon">📡</div>
                    <div className="empty-state-title">{t('sidebar.no_contacts') || "Sin Transmisiones en Malla"}</div>
                    <div className="empty-state-desc">{t('sidebar.no_contacts_desc') || "Escanea un código QR o descubre nodos vecinos en el Radar táctico."}</div>
                    <button
                        onClick={() => navigate("radar")}
                        className="btn-tactical-primary"
                        style={{ marginTop: "12px", padding: "8px 16px", fontSize: "0.8rem" }}
                    >
                        {t('dock.radar') || "Abrir Radar P2P"}
                    </button>
                </div>
            ) : (
                filteredConvs.map(c => {
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
                                    const parsed = JSON.parse(content);
                                    const SIGNAL_TYPES = ['IDENTITY_ANNOUNCE','IDENTITY_RESPONSE','IDENTITY_REQUEST','SHAKE_PAIR_BROADCAST','SHAKE_PAIR_ACCEPT','DELIVERY_ACK','PROFILE_UPDATE','NODE_LOCATION_UPDATE','group_invite'];
                                    const SIGNAL_KEYS = ['read_up_to','reader_hash','offer','answer','candidate','hangup','sender_hash','sender_pk','beacon_id'];
                                    if (parsed.type === 'group_message' || parsed.type === 'squad_msg') {
                                        if (c.is_group) {
                                            const subText = parsed.content || 'Mensaje de escuadrón';
                                            const truncated = subText.length > 38 ? subText.substring(0, 38) + "…" : subText;
                                            snippet = prefix + truncated;
                                            isSignalingJson = true; // Handled directly
                                        } else {
                                            isSignalingJson = true;
                                        }
                                    } else if (parsed.type && SIGNAL_TYPES.some(t => parsed.type.startsWith(t.split('_')[0]) || parsed.type === t)) {
                                        isSignalingJson = true;
                                    } else if (SIGNAL_KEYS.filter(k => k in parsed).length >= 2) {
                                        isSignalingJson = true;
                                    } else if (parsed.reason === 'user_remote_wipe') {
                                        isSignalingJson = true;
                                    }
                                } catch {}
                            }
                            if (!isSignalingJson) {
                                const truncated = content.length > 38 ? content.substring(0, 38) + "…" : content;
                                snippet = prefix + truncated;
                            }
                        }
                    }
                    const peerRecord = meshRouter.getPeerByAnyId(c.peer);
                    const isPeerOnline = !!peerRecord;
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
                })
            )}
        </div>
    );
};
