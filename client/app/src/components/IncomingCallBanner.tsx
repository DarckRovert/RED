"use client";

import React from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

import { CallRingtoneEngine } from "../lib/CallRingtoneEngine";
import { useTranslation } from "../lib/i18n/i18nEngine";

export function IncomingCallBanner() {
    const { t } = useTranslation();
    const { incomingCall, setIncomingCall, navigate, setActiveCallType, preferences, currentScreen } = useRedStore();

    const isVideo = incomingCall?.callType === 'video';

    // ── Tactical Web Audio Ringtone & Vibration via CallRingtoneEngine ────────
    React.useEffect(() => {
        if (!incomingCall || currentScreen === 'call') {
            CallRingtoneEngine.stop();
            return;
        }

        CallRingtoneEngine.startIncoming((preferences as any)?.ringtoneType || "tactical-alpha");

        return () => {
            CallRingtoneEngine.stop();
        };
    }, [incomingCall, currentScreen]);

    if (!incomingCall || currentScreen === 'call') return null;

    const handleAccept = () => {
        CallRingtoneEngine.stop();
        // Unlock Web Audio synchronously on user gesture to bypass browser/WebView autoplay restrictions
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                const ctx = new AudioContextClass();
                ctx.resume().catch(() => {});
            }
        } catch {}

        const callerId = incomingCall.callerHash;
        const callType = incomingCall.callType || 'video';
        const offer = incomingCall.offer;
        const callId = incomingCall.callId || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        setActiveCallType(callType);
        useRedStore.setState({
            activeConversationId: callerId,
            activeCallPeer: callerId,
            activeCallOffer: offer,
            activeCallId: callId,
            incomingCall: null,
            activeCallSignal: null,
            callSignalQueue: [] // Clear old stale queue on call accept
        });
        navigate("call", callerId);
    };

    const handleReject = async () => {
        CallRingtoneEngine.stop();
        try {
            await RedAPI.sendMessage(incomingCall.callerHash, JSON.stringify({
                hangup: true,
                callId: incomingCall.callId,
                timestamp: Date.now()
            }), {
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
            border: isVideo ? "1px solid var(--accent-cyan)" : "1px solid var(--accent-emerald)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 18px",
            boxShadow: isVideo ? "0 12px 48px rgba(0,229,255,0.4)" : "0 12px 48px rgba(0,230,118,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            animation: "animate-enter 0.3s ease",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: isVideo 
                        ? "linear-gradient(135deg, #00E5FF, #0097A7)"
                        : "linear-gradient(135deg, #00E676, #00B368)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.3rem", color: isVideo ? "#000" : "#000",
                    boxShadow: isVideo ? "0 0 16px rgba(0,229,255,0.6)" : "0 0 16px rgba(0,230,118,0.6)",
                    animation: "pulse 1s infinite"
                }}>
                    {isVideo ? "📹" : "📞"}
                </div>
                <div>
                    <div style={{ color: "white", fontWeight: 800, fontSize: "0.95rem" }}>
                        {incomingCall.callerName}
                    </div>
                    <div style={{ 
                        color: isVideo ? "var(--accent-cyan)" : "var(--accent-emerald)", 
                        fontSize: "0.72rem", 
                        fontWeight: 800, 
                        fontFamily: "JetBrains Mono, monospace" 
                    }}>
                        {isVideo ? "VIDEOLAMADA HD ENTRANTE…" : (t.calls?.incoming || "LLAMADA DE VOZ P2P ENTRANTE…")}
                    </div>
                </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
                <button
                    onClick={handleReject}
                    className="btn-icon"
                    style={{ width: 38, height: 38, background: "rgba(255,51,85,0.2)", border: "1px solid var(--accent-crimson)", color: "var(--accent-crimson)" }}
                    title={t.calls?.reject || "Rechazar"}
                >
                    ✕
                </button>
                <button
                    onClick={handleAccept}
                    className="btn-tactical-primary"
                    style={{ 
                        padding: "8px 16px", 
                        borderRadius: "var(--radius-full)", 
                        background: isVideo 
                            ? "linear-gradient(135deg, #00E5FF, #00B4D8)" 
                            : "linear-gradient(135deg, #00E676, #00B368)", 
                        color: "#000", 
                        fontWeight: 900, 
                        fontSize: "0.82rem" 
                    }}
                >
                    {t.calls?.accept || "Contestar"}
                </button>
            </div>
        </div>
    );
}