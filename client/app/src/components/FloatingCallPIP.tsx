"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { useTranslation } from "../lib/i18n/i18nEngine";

export const FloatingCallPIP: React.FC = () => {
    const { t } = useTranslation();
    const {
        isCallPipMinimized,
        setCallPipMinimized,
        activeCallPeer,
        activeCallType,
        contacts,
        navigate,
    } = useRedStore();

    const [pos, setPos] = useState({ x: 16, y: 80 });
    const [dragging, setDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isMuted, setIsMuted] = useState(false);

    if (!isCallPipMinimized || !activeCallPeer) return null;

    const peerContact = contacts.find((c: any) =>
        c.identity_hash?.toLowerCase() === activeCallPeer.toLowerCase() ||
        (activeCallPeer.length >= 8 && c.identity_hash?.toLowerCase().startsWith(activeCallPeer.substring(0, 8).toLowerCase()))
    );
    const peerName = peerContact?.display_name || `Operador ${activeCallPeer.substring(0, 8)}`;

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest("button")) return;
        setDragging(true);
        setDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
        try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragging) return;
        const maxX = typeof window !== "undefined" ? window.innerWidth - 165 : 300;
        const maxY = typeof window !== "undefined" ? window.innerHeight - 200 : 500;
        setPos({
            x: Math.max(10, Math.min(maxX, e.clientX - dragOffset.x)),
            y: Math.max(60, Math.min(maxY, e.clientY - dragOffset.y)),
        });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        setDragging(false);
        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}
    };

    const handleExpand = () => {
        setCallPipMinimized(false);
        navigate("call", activeCallPeer);
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextMuted = !isMuted;
        setIsMuted(nextMuted);
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("red:call_toggle_mic", { detail: { muted: nextMuted } }));
        }
    };

    const handleEndCall = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCallPipMinimized(false);
        const currentCallId = useRedStore.getState().activeCallId;
        RedAPI.sendMessage(activeCallPeer, JSON.stringify({
            hangup: true,
            callId: currentCallId,
            timestamp: Date.now()
        }), { msg_type: "webrtc_signal" }).catch(() => {});
        useRedStore.setState({
            activeCallPeer: null,
            activeCallId: null,
            activeCallOffer: null,
            activeCallSignal: null,
            callSignalQueue: [],
        });
    };

    return (
        <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="animate-fade-scale"
            style={{
                position: "fixed",
                left: pos.x,
                top: pos.y,
                width: "155px",
                height: "185px",
                borderRadius: "18px",
                background: "linear-gradient(180deg, rgba(14, 18, 36, 0.96) 0%, rgba(6, 8, 20, 0.98) 100%)",
                border: "1.5px solid rgba(0, 229, 255, 0.45)",
                boxShadow: "0 14px 45px rgba(0,0,0,0.85), 0 0 20px rgba(0,229,255,0.25)",
                zIndex: 99999,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                userSelect: "none",
                cursor: dragging ? "grabbing" : "grab",
                touchAction: "none",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                transition: dragging ? "none" : "box-shadow 0.2s ease"
            }}
        >
            {/* Header Mini */}
            <div
                style={{
                    padding: "6px 10px",
                    background: "rgba(0,0,0,0.45)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: "var(--accent-emerald, #00E676)",
                        boxShadow: "0 0 8px #00E676",
                        display: "inline-block"
                    }} />
                    <span style={{ fontSize: "0.64rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.5px" }}>
                        {activeCallType === "video" ? "VIDEO" : "VOZ"}
                    </span>
                </div>
                <button
                    onClick={handleExpand}
                    style={{
                        background: "rgba(0, 229, 255, 0.12)",
                        border: "1px solid rgba(0, 229, 255, 0.35)",
                        borderRadius: "6px",
                        color: "var(--accent-cyan, #00E5FF)",
                        fontSize: "0.72rem",
                        padding: "2px 6px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                    title={t.calls_extended?.pip_return || "Maximizar"}
                >
                    ⛶
                </button>
            </div>

            {/* Avatar / Active Voice Waveform Body */}
            <div
                onClick={handleExpand}
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    padding: "6px 8px",
                    cursor: "pointer",
                }}
            >
                <div
                    style={{
                        position: "relative",
                        width: 46,
                        height: 46,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--accent-cyan, #00E5FF) 0%, #0284C7 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.2rem",
                        color: "#000",
                        fontWeight: 900,
                        boxShadow: "0 0 16px rgba(0,229,255,0.4)",
                    }}
                >
                    {peerName[0]?.toUpperCase() || "📞"}
                </div>

                <div
                    style={{
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        color: "#FFFFFF",
                        textAlign: "center",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "125px",
                    }}
                >
                    {peerName}
                </div>

                {/* Mini Waveform de Voz Activa */}
                <div style={{ display: "flex", alignItems: "center", gap: "3px", height: "12px" }}>
                    {[35, 80, 55, 95, 45].map((h, idx) => (
                        <div
                            key={idx}
                            style={{
                                width: "3px",
                                height: isMuted ? "3px" : `${h}%`,
                                background: isMuted ? "rgba(255, 255, 255, 0.3)" : "var(--accent-cyan, #00E5FF)",
                                borderRadius: "2px",
                                transition: "height 0.15s ease",
                                animation: isMuted ? "none" : `pulse ${0.45 + idx * 0.12}s ease-in-out infinite alternate`
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Actions Footer */}
            <div
                style={{
                    padding: "6px 10px",
                    background: "rgba(0,0,0,0.65)",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                {/* Mute Mic Button */}
                <button
                    onClick={toggleMute}
                    style={{
                        background: isMuted ? "rgba(255, 51, 85, 0.25)" : "rgba(255, 255, 255, 0.1)",
                        border: isMuted ? "1px solid #FF3355" : "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "50%",
                        width: 30,
                        height: 30,
                        color: isMuted ? "#FF3355" : "#FFFFFF",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.18s ease"
                    }}
                    title={isMuted ? "Activar micrófono" : "Silenciar micrófono"}
                >
                    {isMuted ? "🔇" : "🎙️"}
                </button>

                {/* Hangup Button */}
                <button
                    onClick={handleEndCall}
                    style={{
                        background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                        border: "none",
                        borderRadius: "50%",
                        width: 30,
                        height: 30,
                        color: "#FFFFFF",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: "rotate(135deg)",
                        boxShadow: "0 0 12px rgba(255, 51, 85, 0.5)",
                        transition: "transform 0.18s ease"
                    }}
                    title={t.calls?.reject || "Colgar"}
                >
                    📞
                </button>
            </div>
        </div>
    );
};
