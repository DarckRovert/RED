"use client";

import React from "react";
import NearbyDevicesPanel from "../../components/NearbyDevicesPanel";
import { useRouter } from "next/navigation";

export default function OfflinePage() {
    const router = useRouter();

    return (
        <div style={{ 
            height: '100vh', width: '100vw', background: 'var(--bg-deep)', 
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 24px', borderBottom: '1px solid var(--solid-border)',
                display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-lifted)'
            }}>
                <button 
                    onClick={() => router.push('/')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
                <div>
                    <h1 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>Modo Offline P2P</h1>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Malla Mesh Local Descentralizada</p>
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                <div style={{
                    background: 'var(--danger)', color: '#fff', padding: '12px 16px', 
                    borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px',
                    display: 'flex', gap: '12px', alignItems: 'flex-start'
                }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    <span>
                        RED Omega L1 inaccesible. Estás retransmitiendo mensajes saltando físicamente celular por celular usando la Mesh Store-and-Forward hasta alcanzar el L1.
                    </span>
                </div>

                <NearbyDevicesPanel />
            </div>
        </div>
    );
}
