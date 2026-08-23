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

    if (!isCallPipMinimized || !activeCallPeer) return null;

    const peerContact = contacts.find((c: any) =>
        c.identity_hash?.toLowerCase() === activeCallPeer.toLowerCase() ||
        (activeCallPeer.length >= 8 && c.identity_hash?.toLowerCase().startsWith(activeCallPeer.substring(0, 8).toLowerCase()))
    );
    const peerName = peerContact?.display_name || `Operador ${activeCallPeer.substring(0, 8)}`;

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        setDragging(true);
        setDragOffset({ x: touch.clientX - pos.x, y: touch.clientY - pos.y });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!dragging) return;
        const touch = e.touches[0];
        setPos({
            x: Math.max(10, Math.min(window.innerWidth - 160, touch.clientX - dragOffset.x)),
            y: Math.max(60, Math.min(window.innerHeight - 180, touch.clientY - dragOffset.y)),
        });
    };

    const handleTouchEnd = () => {
        setDragging(false);
    };

    const handleExpand = () => {
        setCallPipMinimized(false);
        navigate("call", activeCallPeer);
    };

    const handleEndCall = () => {
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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                position: "fixed",
                left: pos.x,
                top: pos.y,
                width: "140px",
                height: "170px",
                borderRadius: "16px",
                background: "rgba(10, 14, 28, 0.95)",
                border: "2px solid var(--accent-cyan)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.85), 0 0 16px rgba(0,229,255,0.3)",
                zIndex: 99999,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                userSelect: "none",
                cursor: "move",
                backdropFilter: "blur(16px)",
            }}
        >
            {/* Header Mini */}
            <div
                style={{
                    padding: "6px 8px",
                    background: "rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                    ● {activeCallType === "video" ? "VIDEO" : "VOZ"}
                </span>
                <button
                    onClick={handleExpand}
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--accent-cyan)",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                    }}
                    title={t.calls_extended?.pip_return || "Maximizar"}
                >
                    ⛶
                </button>
            </div>

            {/* Avatar / Status Body */}
            <div
                onClick={handleExpand}
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px",
                    cursor: "pointer",
                }}
            >
                <div
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--accent-cyan) 0%, #0284C7 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.2rem",
                        color: "#000",
                        fontWeight: 900,
                        boxShadow: "0 0 12px rgba(0,229,255,0.4)",
                    }}
                >
                    {peerName[0]?.toUpperCase() || "📞"}
                </div>
                <div
                    style={{
                        fontSize: "0.70rem",
                        fontWeight: 800,
                        color: "#fff",
                        textAlign: "center",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "110px",
                    }}
                >
                    {peerName}
                </div>
            </div>

            {/* Actions Footer */}
            <div
                style={{
                    padding: "6px 8px",
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-around",
                }}
            >
                <button
                    onClick={handleEndCall}
                    style={{
                        background: "var(--accent-crimson)",
                        border: "none",
                        borderRadius: "50%",
                        width: 28,
                        height: 28,
                        color: "#fff",
                        fontSize: "0.80rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: "rotate(135deg)",
                    }}
                    title={t.calls?.reject || "Colgar"}
                >
                    📞
                </button>
            </div>
        </div>
    );
};
