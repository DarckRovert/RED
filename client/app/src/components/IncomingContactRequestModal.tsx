"use client";

import React, { useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import type { PendingContactRequest } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";

function AvatarInitial({ name, hash }: { name: string; hash: string }) {
    const colors = ["#7C4DFF", "#00E5FF", "#FF6D00", "#00C853", "#F50057", "#FFD600"];
    const color = colors[parseInt(hash.slice(0, 2), 16) % colors.length];
    const initials = name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || "?")
        .join("");
    return (
        <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: `linear-gradient(135deg, ${color}cc, ${color}66)`,
            border: `3px solid ${color}88`,
            boxShadow: `0 0 24px ${color}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.6rem", fontWeight: 900, color: "#fff",
            letterSpacing: "0.5px", flexShrink: 0,
        }}>
            {initials}
        </div>
    );
}

function formatTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

export function IncomingContactRequestModal() {
    const { t } = useTranslation();
    const {
        activeContactRequestModal: req,
        pendingContactRequests,
        acceptContactRequest,
        rejectContactRequest,
        blockNode,
        dismissContactRequestModal,
    } = useRedStore();

    useEffect(() => {
        if (req) {
            try {
                const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtxClass) {
                    const ctx = new AudioCtxClass();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(880, ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
                    gain.gain.setValueAtTime(0.3, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.5);
                    setTimeout(() => {
                        try {
                            if (ctx.state !== "closed") ctx.close();
                        } catch {}
                    }, 600);
                }
            } catch {}
        }
    }, [req?.id]);

    if (!req) return null;

    const pendingCount = pendingContactRequests.length;
    const shortHash = `did:red:${req.senderHash.slice(0, 8)}…${req.senderHash.slice(-4)}`;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={dismissContactRequestModal}
                style={{
                    position: "fixed", inset: 0,
                    background: "rgba(0,0,0,0.72)",
                    backdropFilter: "blur(8px)",
                    zIndex: 9998,
                    animation: "fadeIn 0.2s ease",
                }}
            />

            {/* Modal */}
            <div style={{
                position: "fixed",
                bottom: 0, left: "50%",
                transform: "translateX(-50%)",
                width: "min(100vw, 480px)",
                background: "linear-gradient(180deg, rgba(14,14,26,0.98) 0%, rgba(8,8,16,0.99) 100%)",
                border: "1px solid rgba(0,229,255,0.25)",
                borderBottom: "none",
                borderRadius: "24px 24px 0 0",
                boxShadow: "0 -12px 60px rgba(0,229,255,0.15), 0 -4px 20px rgba(0,0,0,0.8)",
                zIndex: 9999,
                padding: "24px 24px 40px 24px",
                display: "flex", flexDirection: "column", gap: "20px",
                animation: "slideUpModal 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            }}>
                {/* Handle bar */}
                <div style={{
                    width: 40, height: 4, borderRadius: 2,
                    background: "rgba(255,255,255,0.2)",
                    alignSelf: "center", marginBottom: 4,
                }} />

                {/* Alert badge */}
                <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 14px", borderRadius: 10,
                    background: "rgba(255,107,0,0.12)",
                    border: "1px solid rgba(255,107,0,0.3)",
                    alignSelf: "flex-start",
                }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: "#FF6B00",
                        boxShadow: "0 0 8px #FF6B00",
                        animation: "pulse 1.5s infinite",
                    }} />
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#FF9E40", fontFamily: "JetBrains Mono, monospace" }}>
                        {t('incoming_req.title')} · {req.channel.toUpperCase()}
                    </span>
                </div>

                {/* Sender Identity Card */}
                <div style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "16px",
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.08)",
                }}>
                    <AvatarInitial name={req.senderName} hash={req.senderHash} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#fff", marginBottom: 4 }}>
                            {req.senderName}
                        </div>
                        <div style={{
                            fontSize: "0.68rem", color: "rgba(0,229,255,0.7)",
                            fontFamily: "JetBrains Mono, monospace",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                            {shortHash}
                        </div>
                        <div style={{
                            marginTop: 6, fontSize: "0.7rem",
                            color: "var(--text-muted)",
                            fontFamily: "JetBrains Mono, monospace",
                        }}>
                            {formatTime(req.timestamp)}
                        </div>
                    </div>
                    {pendingCount > 1 && (
                        <div style={{
                            minWidth: 22, height: 22, borderRadius: 11,
                            background: "rgba(255,107,0,0.9)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.72rem", fontWeight: 900, color: "#fff",
                            flexShrink: 0,
                        }}>
                            {pendingCount}
                        </div>
                    )}
                </div>

                {/* Description */}
                <div style={{
                    fontSize: "0.82rem", color: "var(--text-muted)",
                    lineHeight: 1.55, textAlign: "center",
                    padding: "0 8px",
                }}>
                    {t('incoming_req.desc')}
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Accept */}
                    <button
                        id="btn-accept-contact-request"
                        onClick={() => acceptContactRequest(req)}
                        style={{
                            width: "100%", padding: "16px",
                            borderRadius: 14, border: "none",
                            background: "linear-gradient(135deg, #00C853 0%, #00897B 100%)",
                            color: "#fff", fontWeight: 900, fontSize: "0.95rem",
                            cursor: "pointer", letterSpacing: "0.3px",
                            boxShadow: "0 4px 20px rgba(0,200,83,0.3)",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                            transition: "transform 0.15s ease, box-shadow 0.15s ease",
                        }}
                        onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                        onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                    >
                        <span style={{ fontSize: "1.2rem" }}>✅</span>
                        {t('incoming_req.accept_btn')}
                    </button>

                    {/* Reject */}
                    <button
                        id="btn-reject-contact-request"
                        onClick={() => rejectContactRequest(req)}
                        style={{
                            width: "100%", padding: "14px",
                            borderRadius: 14,
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "var(--text-primary)", fontWeight: 700, fontSize: "0.88rem",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                            transition: "background 0.15s ease",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.09)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                    >
                        <span style={{ fontSize: "1rem" }}>❌</span>
                        {t('incoming_req.reject_btn')}
                    </button>

                    {/* Block */}
                    <button
                        id="btn-block-contact-request"
                        onClick={() => blockNode(req.senderHash)}
                        style={{
                            width: "100%", padding: "14px",
                            borderRadius: 14,
                            background: "rgba(245,0,87,0.08)",
                            border: "1px solid rgba(245,0,87,0.25)",
                            color: "#FF5A7E", fontWeight: 700, fontSize: "0.88rem",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                            transition: "background 0.15s ease",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,0,87,0.16)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(245,0,87,0.08)")}
                    >
                        <span style={{ fontSize: "1rem" }}>🚫</span>
                        {t('incoming_req.block_btn')}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slideUpModal {
                    from { transform: translateX(-50%) translateY(100%); opacity: 0; }
                    to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.4; }
                }
            `}</style>
        </>
    );
}
