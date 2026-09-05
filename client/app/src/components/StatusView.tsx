"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI, MessageItem } from "../lib/api";
import { useTranslation } from "../lib/i18n/i18nEngine";
import StoryViewer from "./stories/StoryViewer";
import StoryCreator from "./stories/StoryCreator";
import { LiveStreamBroadcaster } from "./LiveStreamBroadcaster";
import { LiveStreamViewer } from "./LiveStreamViewer";
import { EmptyState } from "./ui/EmptyState";

const AVATAR_COLORS = [
    ["#E8213A","#C0152A"], ["#FF7043","#E64A19"], ["#FFA726","#F57C00"],
    ["#26C6DA","#00ACC1"], ["#29B6F6","#0288D1"], ["#7E57C2","#5E35B1"],
    ["#26A69A","#00897B"], ["#EC407A","#C2185B"],
];
function getAvIdx(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 8;
}
function avStyle(s: string) {
    const [a, b] = AVATAR_COLORS[getAvIdx(s)];
    return { background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: `0 2px 12px ${a}55` };
}

function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 1) return "Ahora";
    if (hours === 0) return `Hace ${mins}m`;
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
}

const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

type Modal =
    | { type: "viewer"; senderHash: string; stories: MessageItem[]; senderName: string }
    | { type: "creator" }
    | { type: "broadcaster" }
    | { type: "liveViewer"; streamId: string };

export default function StatusView() {
    const { t } = useTranslation();
    const {
        contacts, identity, goBack, peerStories,
        myStories, liveStreams, navigate, preferences
    } = useRedStore();
    const isFamiliar = (preferences?.uiMode ?? 'familiar') !== 'tactical';

    const [modal, setModal] = useState<Modal | null>(null);
    const now = Date.now();

    const peerStoriesMap = useMemo(() => {
        const map: Record<string, MessageItem[]> = {};
        const storedMap = peerStories || {};
        for (const sender of Object.keys(storedMap)) {
            const arr = storedMap[sender] || [];
            const valid = arr.filter(m => {
                const msgTime = m.timestamp > 1e10 ? m.timestamp : m.timestamp * 1000;
                return (now - msgTime) < STATUS_TTL_MS;
            });
            if (valid.length > 0) {
                map[sender] = [...valid].sort((a, b) => {
                    const ta = a.timestamp > 1e10 ? a.timestamp : a.timestamp * 1000;
                    const tb = b.timestamp > 1e10 ? b.timestamp : b.timestamp * 1000;
                    return ta - tb;
                });
            }
        }
        return map;
    }, [peerStories, now]);

    const peerSenders = Object.keys(peerStoriesMap);

    const activeLives = useMemo(() =>
        Object.values(liveStreams || {}).filter(s => s.is_active),
    [liveStreams]);

    const myValidStories = useMemo(() => {
        const arr = Array.isArray(myStories) ? myStories : [];
        return arr.filter(s => (now - s.timestamp) < STATUS_TTL_MS);
    }, [myStories, now]);

    const handleReply = useCallback((storyId: string, senderHash: string) => {
        setModal(null);
        navigate("chat", senderHash);
    }, [navigate]);

    if (modal?.type === "viewer") {
        return (
            <StoryViewer
                stories={modal.stories}
                senderHash={modal.senderHash}
                senderName={modal.senderName}
                onClose={() => setModal(null)}
                onReply={handleReply}
            />
        );
    }

    if (modal?.type === "creator") {
        return (
            <StoryCreator
                onClose={() => setModal(null)}
                onPublished={() => setModal(null)}
            />
        );
    }

    if (modal?.type === "broadcaster") {
        return <LiveStreamBroadcaster onClose={() => setModal(null)} />;
    }

    if (modal?.type === "liveViewer") {
        return <LiveStreamViewer streamId={modal.streamId} onClose={() => setModal(null)} />;
    }

    if (isFamiliar) {
        return (
            <div style={{
                width: "100%", height: "100%",
                background: "#111B21", color: "#E9EDEF",
                display: "flex", flexDirection: "column",
                overflow: "hidden", position: "relative"
            }}>
                {/* WhatsApp Familiar Header */}
                <header style={{
                    padding: "16px 20px",
                    height: "56px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "#111B21",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                    zIndex: 10, flexShrink: 0,
                }}>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#E9EDEF", letterSpacing: "0.2px" }}>
                        Novedades
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <button
                            onClick={() => setModal({ type: "creator" })}
                            style={{
                                background: "transparent", border: "none",
                                color: "#AEBAC1", fontSize: "1.2rem", cursor: "pointer"
                            }}
                            title="Buscar o publicar"
                        >
                            📷
                        </button>
                        <button
                            onClick={() => setModal({ type: "broadcaster" })}
                            style={{
                                background: "rgba(232, 33, 58, 0.15)", border: "1px solid rgba(232, 33, 58, 0.3)",
                                color: "#FF5252", fontSize: "0.74rem", fontWeight: 700,
                                borderRadius: "14px", padding: "4px 10px", cursor: "pointer",
                                display: "flex", alignItems: "center", gap: "4px"
                            }}
                            title="Transmitir en directo por la malla"
                        >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF5252", display: "inline-block" }} />
                            EN VIVO
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="scroll-container" style={{ flex: 1, overflowY: "auto", paddingBottom: "100px" }}>
                    <div style={{ maxWidth: "600px", margin: "0 auto", width: "100%" }}>
                        
                        {/* Estado Section */}
                        <div style={{ padding: "16px 16px 8px 16px" }}>
                            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#E9EDEF", marginBottom: "14px" }}>
                                Estado
                            </div>

                            {/* Mi Estado Item */}
                            <div
                                style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    cursor: "pointer", padding: "8px 0"
                                }}
                            >
                                <div
                                    onClick={() => {
                                        if (myValidStories.length > 0) {
                                            setModal({
                                                type: "viewer",
                                                senderHash: identity?.identity_hash || "",
                                                senderName: "Mi Estado",
                                                stories: myValidStories.map(s => ({
                                                    id: s.id, sender: identity?.identity_hash || "",
                                                    is_mine: true,
                                                    content: s.content, timestamp: Math.floor(s.timestamp / 1000),
                                                    msg_type: ((s as any).msg_type || "story") as any
                                                }))
                                            });
                                        } else {
                                            setModal({ type: "creator" });
                                        }
                                    }}
                                    style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1 }}
                                >
                                    <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
                                        <div style={{
                                            width: 52, height: 52, borderRadius: "50%",
                                            background: "linear-gradient(135deg, #00A884, #005C4B)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontWeight: 900, color: "#FFF", fontSize: "1.2rem",
                                            border: myValidStories.length > 0 ? "2.5px solid #00A884" : "none",
                                            padding: myValidStories.length > 0 ? "2px" : "0"
                                        }}>
                                            {identity?.nickname ? identity.nickname[0].toUpperCase() : "👤"}
                                        </div>

                                        {/* Badge '+' Verde si no tiene estados */}
                                        {myValidStories.length === 0 && (
                                            <div style={{
                                                position: "absolute", bottom: 0, right: 0,
                                                width: 20, height: 20, borderRadius: "50%",
                                                background: "#00A884", border: "2px solid #111B21",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 900
                                            }}>
                                                +
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <div style={{ fontSize: "0.98rem", fontWeight: 600, color: "#E9EDEF" }}>
                                            Mi estado
                                        </div>
                                        <div style={{ fontSize: "0.80rem", color: "#8696A0", marginTop: "2px" }}>
                                            {myValidStories.length > 0
                                                ? `${myValidStories.length} actualización(es) activa(s)`
                                                : "Añade una actualización"}
                                        </div>
                                    </div>
                                </div>

                                {myValidStories.length > 0 && (
                                    <button
                                        onClick={() => setModal({ type: "creator" })}
                                        style={{
                                            width: 36, height: 36, borderRadius: "50%",
                                            background: "rgba(255, 255, 255, 0.06)", border: "none",
                                            color: "#00A884", fontSize: "1rem", cursor: "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center"
                                        }}
                                        title="Publicar nuevo estado"
                                    >
                                        📷
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Directos Activos (Live Streams P2P) */}
                        {activeLives.length > 0 && (
                            <div style={{ padding: "8px 16px", marginTop: "4px" }}>
                                <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#8696A0", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                                    Transmisiones en vivo ({activeLives.length})
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {activeLives.map(stream => (
                                        <div
                                            key={stream.stream_id}
                                            onClick={() => setModal({ type: "liveViewer", streamId: stream.stream_id })}
                                            style={{
                                                padding: "12px 14px", borderRadius: "12px",
                                                background: "#182229", border: "1px solid rgba(255, 255, 255, 0.05)",
                                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                                cursor: "pointer"
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5252", boxShadow: "0 0 8px #FF5252" }} />
                                                <div>
                                                    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>{stream.broadcaster_name}</div>
                                                    <div style={{ fontSize: "0.74rem", color: "#8696A0" }}>{stream.title || "Transmisión P2P"}</div>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#00A884" }}>
                                                Ver en vivo ➔
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.05)", margin: "8px 0" }} />

                        {/* Actualizaciones Recientes */}
                        <div style={{ padding: "10px 16px" }}>
                            <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#8696A0", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                                Actualizaciones recientes
                            </div>

                            {peerSenders.length === 0 ? (
                                <div style={{ padding: "30px 16px", textAlign: "center", color: "#8696A0" }}>
                                    <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⭕</div>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>
                                        Sin actualizaciones recientes
                                    </div>
                                    <div style={{ fontSize: "0.78rem", maxWidth: "280px", margin: "4px auto 0 auto", lineHeight: 1.45 }}>
                                        Las historias compartidas por tus contactos durante las últimas 24 horas aparecerán aquí.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    {peerSenders.map(senderHash => {
                                        const senderStories = peerStoriesMap[senderHash] || [];
                                        const latestStory = senderStories[senderStories.length - 1];
                                        const contact = contacts.find((c: any) => c.identity_hash === senderHash);
                                        const displayName = contact?.display_name || `${senderHash.substring(0, 10)}…`;
                                        const storyTime = latestStory ? (latestStory.timestamp > 1e10 ? latestStory.timestamp : latestStory.timestamp * 1000) : Date.now();

                                        return (
                                            <div
                                                key={senderHash}
                                                onClick={() => setModal({
                                                    type: "viewer",
                                                    senderHash,
                                                    senderName: displayName,
                                                    stories: senderStories
                                                })}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "14px",
                                                    padding: "10px 0", cursor: "pointer",
                                                    borderBottom: "1px solid rgba(255, 255, 255, 0.03)"
                                                }}
                                            >
                                                {/* Story Ring Avatar */}
                                                <div style={{
                                                    width: 52, height: 52, borderRadius: "50%",
                                                    border: "2.5px solid #00A884",
                                                    padding: "2px", display: "flex", alignItems: "center", justifyContent: "center",
                                                    flexShrink: 0
                                                }}>
                                                    <div style={{
                                                        width: "100%", height: "100%", borderRadius: "50%",
                                                        ...avStyle(senderHash),
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        fontWeight: 700, color: "#FFF", fontSize: "1.1rem"
                                                    }}>
                                                        {displayName.charAt(0).toUpperCase()}
                                                    </div>
                                                </div>

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: "0.96rem", fontWeight: 600, color: "#E9EDEF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {displayName}
                                                    </div>
                                                    <div style={{ fontSize: "0.78rem", color: "#8696A0", marginTop: "2px" }}>
                                                        {formatRelativeTime(storyTime)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Floating Action Buttons (FABs) de WhatsApp */}
                <div style={{
                    position: "absolute", bottom: "24px", right: "20px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "14px",
                    zIndex: 40
                }}>
                    {/* Small FAB Text */}
                    <button
                        onClick={() => setModal({ type: "creator" })}
                        style={{
                            width: "44px", height: "44px", borderRadius: "50%",
                            background: "#202C33", border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: "#00A884", fontSize: "1.15rem", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: "0 3px 10px rgba(0, 0, 0, 0.35)",
                            transition: "transform 0.15s ease"
                        }}
                        title="Crear estado de texto"
                    >
                        ✏️
                    </button>

                    {/* Main Big FAB Camera */}
                    <button
                        onClick={() => setModal({ type: "creator" })}
                        style={{
                            width: "56px", height: "56px", borderRadius: "50%",
                            background: "#00A884", border: "none",
                            color: "#FFFFFF", fontSize: "1.35rem", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: "0 4px 16px rgba(0, 168, 132, 0.45)",
                            transition: "transform 0.15s ease"
                        }}
                        title="Tomar foto o video para estado"
                    >
                        📷
                    </button>
                </div>
            </div>
        );
    }

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
                        background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(232,33,58,0.4)"
                    }}>📺</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Estados Efímeros & Streaming LIVE
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-crimson-bright)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            24H GOSSIPSUB TTL · P2P MESH VIDEO
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    className="btn-icon"
                    title="Cerrar vista"
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Directos Activos (Live Streams) */}
                    {activeLives.length > 0 && (
                        <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px", borderLeft: "4px solid var(--accent-crimson)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--accent-crimson-bright)" }}>
                                    🔴 TRANSMISIONES EN VIVO ACTIVAS ({activeLives.length})
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {activeLives.map(stream => (
                                    <div
                                        key={stream.stream_id}
                                        onClick={() => setModal({ type: "liveViewer", streamId: stream.stream_id })}
                                        className="card-tactical-interactive"
                                        style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent-crimson)", boxShadow: "0 0 10px var(--accent-crimson)" }} />
                                            <div>
                                                <div style={{ fontSize: "0.90rem", fontWeight: 800 }}>{stream.broadcaster_name}</div>
                                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>{stream.title || "Transmisión de Malla P2P"}</div>
                                            </div>
                                        </div>
                                        <button className="btn-tactical-primary" style={{ padding: "6px 14px", fontSize: "0.76rem" }}>
                                            Unirse 📺
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mi Estado & Botón Transmitir */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div
                                onClick={() => {
                                    if (myValidStories.length > 0) {
                                        setModal({
                                            type: "viewer",
                                            senderHash: identity?.identity_hash || "",
                                            senderName: t.stories_module?.my_story || "Mi Estado",
                                            stories: myValidStories.map(s => ({
                                                id: s.id, sender: identity?.identity_hash || "",
                                                is_mine: true,
                                                content: s.content, timestamp: Math.floor(s.timestamp / 1000),
                                                msg_type: ((s as any).msg_type || "story") as any
                                            }))
                                        });
                                    } else {
                                        setModal({ type: "creator" });
                                    }
                                }}
                                style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}
                            >
                                <div style={{
                                    width: 48, height: 48, borderRadius: "50%",
                                    background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "1.3rem", fontWeight: 900, color: "white",
                                    border: myValidStories.length > 0 ? "2px solid var(--accent-emerald)" : "none"
                                }}>
                                    {myValidStories.length > 0 ? "✨" : "+"}
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 800 }}>{t.stories_module?.my_story || "Mi Estado"}</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        {myValidStories.length > 0 ? `${myValidStories.length} 24h` : (t.stories_module?.caption_placeholder || "Toca para publicar una historia de 24h")}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                    onClick={() => setModal({ type: "creator" })}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "8px 12px", fontSize: "0.78rem" }}
                                >
                                    📷 {t.stories_module?.add_story || "Publicar"}
                                </button>
                                <button
                                    onClick={() => setModal({ type: "broadcaster" })}
                                    className="btn-tactical-primary"
                                    style={{ padding: "8px 12px", fontSize: "0.78rem" }}
                                >
                                    🔴 LIVE
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Actualizaciones de Contactos */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            {t.stories_module?.recent_updates || "ACTUALIZACIONES DE CONTACTOS"} ({peerSenders.length})
                        </div>

                        {peerSenders.length === 0 ? (
                            <EmptyState
                                icon="✨"
                                title={t.stories_module?.no_stories || "Sin Actualizaciones Recientes"}
                                description={t.stories_module?.no_stories_desc || "Las historias de tus contactos de la malla aparecerán aquí durante 24 horas."}
                            />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {peerSenders.map(senderHash => {
                                    const senderStories = peerStoriesMap[senderHash] || [];
                                    const latestStory = senderStories[senderStories.length - 1];
                                    const contact = contacts.find((c: any) => c.identity_hash === senderHash);
                                    const displayName = contact?.display_name || `${senderHash.substring(0, 10)}…`;
                                    const storyTime = latestStory ? (latestStory.timestamp > 1e10 ? latestStory.timestamp : latestStory.timestamp * 1000) : Date.now();

                                    return (
                                        <div
                                            key={senderHash}
                                            onClick={() => setModal({
                                                type: "viewer",
                                                senderHash,
                                                senderName: displayName,
                                                stories: senderStories
                                            })}
                                            className="card-tactical-interactive"
                                            style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <div style={{
                                                    width: 44, height: 44, borderRadius: "50%",
                                                    ...avStyle(senderHash),
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontWeight: 900, color: "white", fontSize: "1.1rem",
                                                    border: "2px solid var(--accent-emerald)"
                                                }}>
                                                    {displayName[0]?.toUpperCase() || "🔴"}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: "0.90rem", fontWeight: 800 }}>{displayName}</div>
                                                    <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>
                                                        {formatRelativeTime(storyTime)} · {senderStories.length} historia(s)
                                                    </div>
                                                </div>
                                            </div>

                                            <span style={{ fontSize: "1.2rem", color: "var(--accent-emerald)" }}>➔</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}