"use client";

import React from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

export function IncomingCallBanner() {
    const { incomingCall, setIncomingCall, navigate } = useRedStore();

    // ── Tactical Web Audio Ringtone Chime ─────────────────────────────────────
    React.useEffect(() => {
        if (!incomingCall) return;

        let audioCtx: AudioContext | null = null;
        let isCancelled = false;
        let intervalId: any = null;

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
                
                const playChime = () => {
                    if (isCancelled || !audioCtx || audioCtx.state === 'closed') return;
                    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

                    const now = audioCtx.currentTime;
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();

                    osc.type = "sine";
                    osc.frequency.setValueAtTime(880, now); // A5
                    osc.frequency.setValueAtTime(1174.66, now + 0.15); // D6
                    osc.frequency.setValueAtTime(880, now + 0.3);

                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

                    osc.connect(gain);
                    gain.connect(audioCtx.destination);

                    osc.start(now);
                    osc.stop(now + 0.45);
                };

                playChime();
                intervalId = setInterval(playChime, 2500);
            }
        } catch {}

        return () => {
            isCancelled = true;
            if (intervalId) clearInterval(intervalId);
            if (audioCtx && audioCtx.state !== 'closed') {
                audioCtx.close().catch(() => {});
            }
        };
    }, [incomingCall]);

    if (!incomingCall) return null;

    const handleAccept = () => {
        const callerId = incomingCall.callerHash;
        useRedStore.setState({ activeConversationId: callerId });
        navigate("call", callerId);
    };

    const handleReject = async () => {
        try {
            await RedAPI.sendMessage(incomingCall.callerHash, JSON.stringify({ hangup: true }), {
                msg_type: "webrtc_signal"
            });
        } catch {}
        setIncomingCall(null);
    };

    return (
        <div style={{
            position: "fixed",
            top: "calc(16px + var(--safe-top, 0px))",
            left: "16px",
            right: "16px",
            margin: "0 auto",
            maxWidth: "460px",
            zIndex: 99999,
            background: "linear-gradient(135deg, rgba(16,18,32,0.98), rgba(8,10,20,0.98))",
            backdropFilter: "blur(20px)",
            border: "1px solid var(--accent-crimson)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 18px",
            boxShadow: "0 12px 48px rgba(255,51,85,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            animation: "animate-enter 0.3s ease",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: "linear-gradient(135deg, #FF3355, #E8213A)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.3rem", color: "white",
                    boxShadow: "0 0 16px rgba(255,51,85,0.6)",
                    animation: "pulse 1s infinite"
                }}>
                    📞
                </div>
                <div>
                    <div style={{ color: "white", fontWeight: 800, fontSize: "0.95rem" }}>
                        {incomingCall.callerName}
                    </div>
                    <div style={{ color: "var(--accent-emerald)", fontSize: "0.72rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                        LLAMADA P2P WEBRTC ENTRANTE…
                    </div>
                </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
                <button
                    onClick={handleReject}
                    className="btn-icon"
                    style={{ width: 38, height: 38, background: "rgba(255,51,85,0.2)", border: "1px solid var(--accent-crimson)", color: "var(--accent-crimson)" }}
                    title="Rechazar"
                >
                    ✕
                </button>
                <button
                    onClick={handleAccept}
                    className="btn-tactical-primary"
                    style={{ padding: "8px 16px", borderRadius: "var(--radius-full)", background: "linear-gradient(135deg, #00E676, #00B368)", color: "#000", fontWeight: 900, fontSize: "0.82rem" }}
                >
                    Contestar
                </button>
            </div>
        </div>
    );
}