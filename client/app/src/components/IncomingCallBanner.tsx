"use client";

import React from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

export function IncomingCallBanner() {
    const { incomingCall, setIncomingCall, navigate } = useRedStore();

    if (!incomingCall) return null;

    const handleAccept = () => {
        const callerId = incomingCall.callerHash;
        useRedStore.setState({ activeConversationId: callerId });
        navigate('call', callerId);
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
            position: 'fixed',
            top: 'calc(20px + var(--safe-top, 0px))',
            left: '16px',
            right: '16px',
            margin: '0 auto',
            maxWidth: 420,
            zIndex: 99999,
            background: 'linear-gradient(135deg, rgba(15,15,26,0.98), rgba(8,8,16,0.98))',
            backdropFilter: 'blur(20px)',
            border: '2px solid var(--primary)',
            borderRadius: 24,
            padding: '16px 20px',
            boxShadow: '0 12px 48px rgba(232,33,58,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            animation: 'slideDown 0.3s cubic-bezier(0,0,0.2,1)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                    width: 48, height: 48, borderRadius: 24,
                    background: 'linear-gradient(135deg, #E8213A, #C0152A)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem', color: 'white',
                    boxShadow: '0 0 20px rgba(232,33,58,0.6)',
                    animation: 'pulse 1s infinite'
                }}>
                    📞
                </div>
                <div>
                    <div style={{ color: 'white', fontWeight: 800, fontSize: '1rem' }}>
                        {incomingCall.callerName}
                    </div>
                    <div style={{ color: '#00D97E', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                        Llamada Entrante P2P E2E…
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    onClick={handleReject}
                    style={{
                        width: 40, height: 40, borderRadius: 20,
                        background: 'rgba(232,33,58,0.2)', border: '1px solid #E8213A',
                        color: '#E8213A', fontSize: '1.1rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    ✕
                </button>
                <button
                    onClick={handleAccept}
                    style={{
                        padding: '8px 16px', borderRadius: 20,
                        background: 'linear-gradient(135deg, #00D97E, #00B368)',
                        color: 'black', fontWeight: 800, fontSize: '0.85rem',
                        border: 'none', cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(0,217,126,0.4)'
                    }}
                >
                    Contestar
                </button>
            </div>

            <style jsx>{`
                @keyframes slideDown {
                    from { transform: translateY(-30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
