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
    const { 
        navigate, groups: rawGroups, peerTypingStatus, 
        preferences, activeConversationId 
    } = useRedStore();
    const { t } = useTranslation();
    const groups = Array.isArray(rawGroups) ? rawGroups : [];
    const isFamiliar = (preferences?.uiMode ?? 'familiar') === 'familiar';

    const handleOpenNewChat = () => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("red:open_new_chat"));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: isFamiliar ? "0px" : "6px" }}>

            {/* ── SECCIÓN TÁCTICA DE ESCUADRONES (Sólo en Modo Táctico) ── */}
            {!isFamiliar && (
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
                            <span>👥</span> {t('sidebar.squads_title') || "ESCUADRONES P2P"}
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
                            + {t('sidebar.create_squad_btn')?.split(' ').slice(-1)[0] || 'CREAR'}
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
                                    {t('sidebar.no_squads') || "Sin escuadrones activos"}
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                    {t('sidebar.no_squads_desc') || "Crea un escuadrón seguro para comunicación grupal."}
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
                                            {Array.isArray(g.members) ? g.members.length : 0} {t('modules.groups')?.includes('P2P') ? 'miembros' : 'members'} · E2E SenderKey
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

                    {/* Divisor Táctico */}
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
                </div>
            )}

            {/* ── LISTA DE CONVERSACIONES ── */}
            {filteredConvs.length === 0 ? (
                isFamiliar ? (
                    <div className="animate-fade-scale" style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        padding: "48px 24px", textAlign: "center", color: "#8696A0"
                    }}>
                        <div style={{
                            width: "64px", height: "64px", borderRadius: "50%",
                            background: "rgba(0, 168, 132, 0.1)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.8rem", marginBottom: "16px", color: "#00A884"
                        }}>
                            💬
                        </div>
                        <div style={{ fontSize: "1rem", fontWeight: 600, color: "#E9EDEF", marginBottom: "8px" }}>
                            No tienes chats aún
                        </div>
                        <div style={{ fontSize: "0.82rem", lineHeight: 1.5, color: "#8696A0", maxWidth: "260px", marginBottom: "20px" }}>
                            Inicia una conversación privada con un contacto o escanea su código QR para enlazar en la malla P2P.
                        </div>
                        <button
                            onClick={handleOpenNewChat}
                            style={{
                                padding: "10px 20px", borderRadius: "24px",
                                background: "#00A884", color: "#FFFFFF",
                                border: "none", fontSize: "0.85rem", fontWeight: 700,
                                cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                                boxShadow: "0 2px 8px rgba(0, 168, 132, 0.4)",
                                transition: "transform 0.15s ease, background 0.15s ease"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "#02906f"}
                            onMouseLeave={e => e.currentTarget.style.background = "#00A884"}
                        >
                            <span>➕</span> Iniciar un chat
                        </button>
                    </div>
                ) : (
                    <div className="empty-state-tactical animate-fade-scale">
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
                )
            ) : (
                filteredConvs.map((c, idx) => {
                    const rawTs = (typeof c.last_message === "object" && c.last_message?.timestamp) || (c as any).last_timestamp;
                    const lm = c.last_message;
                    let snippet = "Mensaje cifrado";
                    let isOwn = false;
                    let msgStatus: string | undefined = undefined;
                    const animDelay = `${Math.min(idx * 30, 300)}ms`;

                    if (lm) {
                        const msgType = typeof lm === "object" ? lm.msg_type : null;
                        const content = typeof lm === "object" ? lm.content : lm;
                        isOwn = typeof lm === "object" && Boolean((lm as any).is_mine);
                        msgStatus = typeof lm === "object" ? (lm as any).status : undefined;
                        const prefix = isOwn ? "" : "";

                        if (msgType === "image" || content?.startsWith("data:image")) snippet = "📷 Foto";
                        else if (msgType === "voice" || msgType === "audio" || content?.startsWith("data:audio")) snippet = "🎤 Mensaje de voz";
                        else if (msgType === "video" || content?.startsWith("data:video")) snippet = "📹 Video";
                        else if (msgType === "location" || content?.includes("Ubicación Táctica")) snippet = "📍 Ubicación";
                        else if (msgType === "poll") snippet = "📊 Encuesta";
                        else if (msgType === "document" || content?.startsWith("<?xml") || content?.startsWith("<") || content?.startsWith("data:application")) snippet = "📄 Documento";
                        else if (content && !content.startsWith("data:") && !content.startsWith("[")) {
                            let isSignalingJson = false;
                            if (content.startsWith("{")) {
                                try {
                                    const parsed = JSON.parse(content);
                                    const SIGNAL_TYPES = ['IDENTITY_ANNOUNCE','IDENTITY_RESPONSE','IDENTITY_REQUEST','SHAKE_PAIR_BROADCAST','SHAKE_PAIR_ACCEPT','DELIVERY_ACK','PROFILE_UPDATE','NODE_LOCATION_UPDATE','group_invite'];
                                    const SIGNAL_KEYS = ['read_up_to','reader_hash','offer','answer','candidate','hangup','sender_hash','sender_pk','beacon_id'];
                                    if (parsed.type === 'group_message' || parsed.type === 'squad_msg') {
                                        if (c.is_group) {
                                            const subText = parsed.content || 'Mensaje de grupo';
                                            snippet = subText.length > 38 ? subText.substring(0, 38) + "…" : subText;
                                            isSignalingJson = true;
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
                                snippet = content.length > 38 ? content.substring(0, 38) + "…" : content;
                            }
                        }
                    }

                    const savedDraft = typeof window !== 'undefined' ? (localStorage.getItem(`red_draft_${c.peer}`) || localStorage.getItem(`red_draft_${c.id}`)) : null;
                    const hasDraft = Boolean(savedDraft && savedDraft.trim().length > 0);

                    const peerRecord = meshRouter.getPeerByAnyId(c.peer);
                    const isPeerOnline = Boolean(peerRecord);
                    const isSelected = activeConversationId === c.peer || activeConversationId === c.id;

                    const peerStatus = peerTypingStatus?.[c.peer];
                    const isTyping = peerStatus === 'typing';
                    const isRecording = peerStatus === 'recording_voice';

                    if (isFamiliar) {
                        return (
                            <div
                                key={c.peer}
                                className="contact-item-enter"
                                onClick={() => navigate("chat", c.peer)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "14px",
                                    padding: "12px 16px",
                                    cursor: "pointer",
                                    background: isSelected ? "#2A3942" : "transparent",
                                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                                    transition: "background 0.15s ease",
                                    animationDelay: animDelay,
                                }}
                                onMouseEnter={e => {
                                    if (!isSelected) e.currentTarget.style.background = "#202C33";
                                }}
                                onMouseLeave={e => {
                                    if (!isSelected) e.currentTarget.style.background = "transparent";
                                }}
                            >
                                {/* WhatsApp Round Avatar */}
                                <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: "50%",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "1.15rem", fontWeight: 700, color: "#FFFFFF",
                                        ...avatarStyle(c.peer),
                                    }}>
                                        {c.is_group ? "👥" : resolvePeerName(c.peer).charAt(0).toUpperCase()}
                                    </div>
                                    {isPeerOnline && !c.is_group && (
                                        <span
                                            className="online-dot"
                                            title="En línea en la Malla"
                                        />
                                    )}
                                </div>

                                {/* Main Text Block */}
                                <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                                        <div style={{
                                            fontSize: "0.95rem", fontWeight: 600, color: "#E9EDEF",
                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                                        }}>
                                            {resolvePeerName(c.peer)}
                                        </div>
                                        <div style={{
                                            fontSize: "0.74rem",
                                            color: (c.unread_count || 0) > 0 ? "#25D366" : "#8696A0",
                                            fontWeight: (c.unread_count || 0) > 0 ? 600 : 400,
                                            flexShrink: 0
                                        }}>
                                            {rawTs ? formatTime(rawTs) : ""}
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{
                                            fontSize: "0.82rem",
                                            color: isTyping || isRecording ? "#25D366" : hasDraft ? "#FFB300" : "#8696A0",
                                            fontWeight: isTyping || isRecording ? 600 : 400,
                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            display: "flex", alignItems: "center", gap: "4px"
                                        }}>
                                            {isTyping ? (
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                    <span className="typing-dots">
                                                        <span />
                                                        <span />
                                                        <span />
                                                    </span>
                                                    <span>escribiendo...</span>
                                                </span>
                                            ) : isRecording ? (
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                    <span style={{ animation: "pulse 1s infinite" }}>🎙️</span>
                                                    <span>grabando audio...</span>
                                                </span>
                                            ) : hasDraft ? (
                                                <span>
                                                    <span style={{ color: "#FFB300", fontWeight: 600 }}>Borrador: </span>
                                                    {savedDraft!.trim().slice(0, 30)}
                                                </span>
                                            ) : (
                                                <>
                                                    {isOwn && (
                                                        <span style={{ display: "inline-flex", alignItems: "center", marginRight: "2px" }}>
                                                            {msgStatus === 'read' ? (
                                                                  <svg width="15" height="15" viewBox="0 0 16 15" fill="none">
                                                                    <path d="M15.01 3.316l-7.53 7.84-3.48-3.63.78-.75 2.7 2.82 6.75-7.03.78.75z" fill="#53BDEB"/>
                                                                    <path d="M11.95 3.316l-7.53 7.84L1 7.526l.78-.75 2.64 2.76 6.75-7.03.78.81z" fill="#53BDEB"/>
                                                                </svg>
                                                            ) : msgStatus === 'delivered' ? (
                                                                <svg width="15" height="15" viewBox="0 0 16 15" fill="none">
                                                                    <path d="M15.01 3.316l-7.53 7.84-3.48-3.63.78-.75 2.7 2.82 6.75-7.03.78.75z" fill="#8696A0"/>
                                                                    <path d="M11.95 3.316l-7.53 7.84L1 7.526l.78-.75 2.64 2.76 6.75-7.03.78.81z" fill="#8696A0"/>
                                                                </svg>
                                                            ) : msgStatus === 'sent' ? (
                                                                <svg width="15" height="15" viewBox="0 0 16 15" fill="none">
                                                                    <path d="M10.91 3.316l-6.49 6.76-2.92-3.04.78-.75 2.14 2.23 5.71-5.95.78.75z" fill="#8696A0"/>
                                                                </svg>
                                                            ) : (
                                                                <span style={{ fontSize: "0.72rem", color: "#8696A0" }}>🕒</span>
                                                            )}
                                                        </span>
                                                    )}
                                                    <span>{snippet}</span>
                                                </>
                                            )}
                                        </div>

                                        {(c.unread_count || 0) > 0 && (
                                            <span style={{
                                                backgroundColor: "#25D366",
                                                color: "#111B21",
                                                fontWeight: 700,
                                                borderRadius: "12px",
                                                padding: "1px 7px",
                                                fontSize: "0.72rem",
                                                minWidth: "18px",
                                                height: "18px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                marginLeft: "8px",
                                                flexShrink: 0
                                            }}>
                                                {c.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // Modo Táctico (Cyberpunk HUD)
                    return (
                        <div
                            key={c.peer}
                            onClick={() => navigate("chat", c.peer)}
                            className="card-tactical-interactive contact-item-enter"
                            style={{
                                padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px",
                                border: isPeerOnline ? "1px solid rgba(0, 230, 118, 0.2)" : "1px solid var(--glass-border)",
                                background: isPeerOnline ? "linear-gradient(135deg, rgba(0,230,118,0.03) 0%, rgba(18,18,32,0.85) 100%)" : undefined,
                                animationDelay: animDelay,
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
                                        className="online-dot online-dot--tactical"
                                        title="En línea en la Malla"
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
                                {isTyping ? (
                                    <div style={{ fontSize: "0.80rem", color: "var(--accent-emerald, #00E676)", fontWeight: 700, marginTop: "2px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                        <span className="typing-dots typing-dots--tactical">
                                            <span />
                                            <span />
                                            <span />
                                        </span>
                                        <span>escribiendo...</span>
                                    </div>
                                ) : isRecording ? (
                                    <div style={{ fontSize: "0.80rem", color: "var(--accent-emerald, #00E676)", fontWeight: 700, marginTop: "2px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                        <span style={{ animation: "pulse 1s infinite" }}>🎙️</span>
                                        <span>grabando audio...</span>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: "0.78rem", color: hasDraft ? "var(--accent-amber, #FFB300)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                                        {hasDraft ? (
                                            <span>
                                                <strong style={{ color: "var(--accent-amber, #FFB300)" }}>✏️ Borrador: </strong>
                                                {savedDraft!.trim().slice(0, 35)}
                                            </span>
                                        ) : snippet}
                                    </div>
                                )}
                            </div>
                            {(c.unread_count || 0) > 0 && (
                                <span style={{
                                    backgroundColor: "var(--accent-cyan)",
                                    color: "#FFFFFF",
                                    fontWeight: 900,
                                    borderRadius: "12px",
                                    padding: "2px 7px",
                                    fontSize: "0.72rem",
                                    minWidth: "20px",
                                    textAlign: "center",
                                    boxShadow: "0 0 10px rgba(0, 229, 255, 0.4)"
                                }}>
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
