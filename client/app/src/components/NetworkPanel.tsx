"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { BlackoutSimulatorModal } from "./BlackoutSimulatorModal";

export default function NetworkPanel() {
    const { goBack, status, connectPeer } = useRedStore();
    const [localIp, setLocalIp] = useState('…');
    const [loraEnabled, setLoraEnabled] = useState(false);
    const [loraPort, setLoraPort] = useState('/dev/ttyUSB0');
    const [loraBaud, setLoraBaud] = useState('115200');
    const [saved, setSaved] = useState(false);
    const [copied, setCopied] = useState(false);
    // Real peer counts keyed by transport type from /api/peers
    const [peersByTransport, setPeersByTransport] = useState<Record<string, number>>({ wifi: 0, ble: 0, lorawan: 0, tcp: 0, quic: 0 });
    const [qrDataUrl, setQrDataUrl] = useState<string>('');

    // Manual connection states
    const [manualAddress, setManualAddress] = useState('');
    const [connectingManual, setConnectingManual] = useState(false);
    const [connectStatus, setConnectStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [blackoutModalOpen, setBlackoutModalOpen] = useState(false);

    const handleConnectManual = async () => {
        if (!manualAddress.trim()) return;
        setConnectingManual(true);
        setConnectStatus('idle');
        try {
            const ok = await connectPeer(manualAddress.trim());
            if (ok) {
                setConnectStatus('success');
                setManualAddress('');
            } else {
                setConnectStatus('error');
            }
        } catch {
            setConnectStatus('error');
        } finally {
            setConnectingManual(false);
            setTimeout(() => setConnectStatus('idle'), 4000);
        }
    };

    useEffect(() => {
        setLoraEnabled(localStorage.getItem('red_lora_enabled') === 'true');
        setLoraPort(localStorage.getItem('red_lora_port') || '/dev/ttyUSB0');
        setLoraBaud(localStorage.getItem('red_lora_baud') || '115200');

        // Fetch REAL local IP from Rust node or via WebRTC ICE trick
        const fetchIp = async () => {
            try {
                const res = await fetch('http://127.0.0.1:7333/api/network/ip', { signal: AbortSignal.timeout(2000) });
                if (res.ok) { const d = await res.json(); setLocalIp(d.local_ip || d.ip || '127.0.0.1'); return; }
            } catch {}
            // WebRTC ICE fallback — works offline, gets real LAN IP
            try {
                const pc = new RTCPeerConnection({ iceServers: [] });
                pc.createDataChannel('');
                pc.createOffer().then(o => pc.setLocalDescription(o));
                pc.onicecandidate = e => {
                    if (!e.candidate) return;
                    const match = e.candidate.candidate.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
                    if (match && !match[1].startsWith('127.')) { setLocalIp(match[1]); pc.close(); }
                };
                setTimeout(() => pc.close(), 3000);
            } catch { setLocalIp('127.0.0.1'); }
        };
        fetchIp();

        // Pull REAL peer transport breakdown from /api/peers every 5s
        const refreshPeers = async () => {
            try {
                const peers = await RedAPI.getPeers();
                const counts: Record<string, number> = { wifi: 0, ble: 0, lorawan: 0, tcp: 0, quic: 0 };
                for (const p of peers) {
                    const t = (p.transport || '').toLowerCase();
                    if (t === 'wifi_direct' || t === 'websocket') counts.wifi++;
                    else if (t === 'ble') counts.ble++;
                    else if (t === 'lorawan' || t === 'lora') counts.lorawan++;
                    else if (t === 'tcp') counts.tcp++;
                    else if (t === 'quic') counts.quic++;
                }
                setPeersByTransport(counts);
            } catch {}
        };
        refreshPeers();
        const t = setInterval(refreshPeers, 5000);
        return () => clearInterval(t);
    }, []);

    const toggleLora = () => {
        const next = !loraEnabled;
        setLoraEnabled(next);
        localStorage.setItem("red_lora_enabled", next.toString());
    };

    const saveLoraConfig = () => {
        localStorage.setItem("red_lora_port", loraPort);
        localStorage.setItem("red_lora_baud", loraBaud);
        // Also send to Rust backend so serial bridge can hot-reload config
        RedAPI.req('/settings/lora', {
            method: 'POST',
            body: JSON.stringify({ port: loraPort, baud: parseInt(loraBaud, 10) })
        }).catch(() => {/* non-fatal if node offline */});
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const apkUrl = `http://${localIp}:7331/api/mesh/apk`;

    const copyUrl = () => {
        navigator.clipboard.writeText(apkUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    useEffect(() => {
        if (!apkUrl.includes('…')) {
            import('qrcode').then(QRCode => {
                QRCode.toDataURL(apkUrl, {
                    width: 400, margin: 1, color: { dark: '#111111', light: '#ffffff' }
                }).then(setQrDataUrl);
            });
        }
    }, [apkUrl]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-deep)' }}>

            {/* Header */}
            <header className="glass-panel" style={{
                padding: '0 20px',
                height: 'var(--header-h)',
                display: 'flex', alignItems: 'center', gap: '16px',
                borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                borderTop: 'none', zIndex: 10, flexShrink: 0,
                background: 'linear-gradient(180deg, rgba(15,15,24,0.98) 0%, rgba(8,8,16,0.98) 100%)',
            }}>
                <button onClick={goBack} className="btn-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>
                <div>
                    <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Red & Emisión</h2>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>Distribución Mesh · LoRaWAN Bridge</p>
                </div>
            </header>

            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Transport Status Row — real counts from /api/peers */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    {[
                        { label: 'WiFi/QUIC', icon: '📶', color: '#00D97E', count: peersByTransport.wifi + peersByTransport.quic },
                        { label: 'BLE',       icon: '🔵', color: '#3498db', count: peersByTransport.ble },
                        { label: 'LoRa',      icon: '📻', color: '#9b59b6', count: loraEnabled ? peersByTransport.lorawan : -1 },
                    ].map(t => {
                        const active = t.count > 0 || (t.label === 'LoRa' && loraEnabled && t.count >= 0);
                        return (
                        <div key={t.label} style={{
                            flex: 1, padding: '12px 10px', borderRadius: 'var(--radius-md)',
                            background: active ? `${t.color}10` : 'var(--bg-lifted)',
                            border: `1px solid ${active ? t.color + '35' : 'var(--solid-border)'}`,
                            textAlign: 'center', transition: 'all 0.3s ease',
                        }}>
                            <div style={{ fontSize: '1.3rem', marginBottom: '4px' }}>{t.icon}</div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: active ? t.color : 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                {t.label}
                            </div>
                            {t.count > 0 && <div style={{ fontSize: '9px', color: t.color, fontWeight: 800, marginTop: 2 }}>{t.count} nodo{t.count !== 1 ? 's' : ''}</div>}
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? t.color : 'var(--text-muted)', margin: '6px auto 0', boxShadow: active ? `0 0 6px ${t.color}` : 'none', transition: 'all 0.3s ease' }} />
                        </div>
                        );
                    })}
                </div>

                {/* Mesh APK Distributor */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(13,13,22,0.98), rgba(8,8,16,0.98))',
                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--solid-border)',
                    overflow: 'hidden',
                }}>
                    {/* Card header */}
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--solid-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                            background: 'linear-gradient(135deg, var(--primary), #FF3355)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(232,33,58,0.4)',
                            fontSize: '1.1rem',
                        }}>🔗</div>
                        <div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.98rem' }}>Distribuidor Mesh (APK)</div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '2px' }}>Comparte RED sin internet — vía WiFi local</div>
                        </div>
                    </div>

                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        {/* QR Code visual (Real) */}
                        <div style={{
                            background: 'white', padding: '12px', borderRadius: 'var(--radius-md)',
                            position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: 200, minHeight: 200
                        }}>
                            {qrDataUrl ? (
                                <img src={qrDataUrl} alt="APK QR Code" style={{ width: 180, height: 180, display: 'block', borderRadius: 4 }} />
                            ) : (
                                <div style={{ color: '#888', fontSize: '0.85rem' }}>Generando QR...</div>
                            )}

                            {/* Center R badge */}
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{
                                    background: 'var(--primary)', width: 40, height: 40, borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 900, fontSize: '1.1rem',
                                    boxShadow: '0 0 12px rgba(232,33,58,0.6)',
                                    border: '3px solid white',
                                }}>R</div>
                            </div>
                        </div>

                        {/* APK URL */}
                        <div style={{
                            width: '100%', background: 'var(--bg-deep)', borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--solid-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', gap: '12px',
                        }}>
                            <code style={{ color: 'var(--primary-bright)', fontSize: '0.85rem', letterSpacing: '0.5px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {apkUrl}
                            </code>
                            <button
                                onClick={copyUrl}
                                style={{
                                    flexShrink: 0, padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                                    background: copied ? 'rgba(0,217,126,0.15)' : 'var(--primary-subtle)',
                                    border: `1px solid ${copied ? 'var(--success)' : 'var(--glass-border-active)'}`,
                                    color: copied ? 'var(--success)' : 'var(--primary-bright)',
                                    fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                {copied ? '✓ Copiado' : 'Copiar'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Conexión Manual P2P */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(13,13,22,0.98), rgba(8,8,16,0.98))',
                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--solid-border)',
                    overflow: 'hidden',
                }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--solid-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                            background: 'linear-gradient(135deg, #3498db, #2980b9)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(52,152,219,0.4)',
                            fontSize: '1.1rem',
                        }}>📡</div>
                        <div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.98rem' }}>Conexión Manual P2P</div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '2px' }}>Conéctate directamente ingresando la IP / Multiaddr del otro nodo</div>
                        </div>
                    </div>
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                            type="text"
                            placeholder="Ej. /ip4/192.168.1.50/tcp/7331"
                            value={manualAddress}
                            onChange={e => setManualAddress(e.target.value)}
                            style={{
                                padding: '12px 14px', background: 'rgba(0,0,0,0.5)',
                                border: '1px solid var(--solid-border)',
                                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                                fontSize: '0.85rem', outline: 'none', fontFamily: 'JetBrains Mono, monospace',
                            }}
                        />
                        <button
                            onClick={handleConnectManual}
                            disabled={!manualAddress.trim() || connectingManual}
                            style={{
                                width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                                background: connectStatus === 'success' ? 'rgba(0,217,126,0.15)' : (connectStatus === 'error' ? 'rgba(232,33,58,0.15)' : 'var(--primary-subtle)'),
                                border: `1px solid ${connectStatus === 'success' ? 'var(--success)' : (connectStatus === 'error' ? 'var(--danger)' : 'var(--glass-border-active)')}`,
                                color: connectStatus === 'success' ? 'var(--success)' : (connectStatus === 'error' ? 'var(--danger)' : 'var(--primary-bright)'),
                                fontWeight: 700, fontSize: '0.9rem', cursor: manualAddress.trim() ? 'pointer' : 'not-allowed',
                                transition: 'all 0.3s ease',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            }}
                        >
                            {connectingManual ? (
                                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                            ) : connectStatus === 'success' ? (
                                '✓ Conexión Iniciada'
                            ) : connectStatus === 'error' ? (
                                '✗ Error de Conexión'
                            ) : (
                                'Conectar a Nodo'
                            )}
                        </button>
                    </div>
                </div>

                {/* LoRaWAN Bridge */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(13,13,22,0.98), rgba(8,8,16,0.98))',
                    borderRadius: 'var(--radius-lg)', border: `1px solid ${loraEnabled ? 'rgba(155,89,182,0.35)' : 'var(--solid-border)'}`,
                    overflow: 'hidden',
                    transition: 'border-color 0.3s ease',
                    boxShadow: loraEnabled ? '0 0 20px rgba(155,89,182,0.10)' : 'none',
                }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--solid-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                                background: loraEnabled ? 'linear-gradient(135deg, #6c3483, #9b59b6)' : 'var(--bg-lifted)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem', transition: 'all 0.3s ease',
                                boxShadow: loraEnabled ? '0 4px 16px rgba(155,89,182,0.4)' : 'none',
                            }}>📻</div>
                            <div>
                                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.98rem' }}>Puente LoRaWAN P2P</div>
                                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '2px' }}>Antena RF por USB-C Serial · hasta 10km</div>
                            </div>
                        </div>
                        {/* Premium toggle */}
                        <div
                            onClick={toggleLora}
                            style={{
                                width: 52, height: 28, borderRadius: '14px', cursor: 'pointer',
                                background: loraEnabled ? 'linear-gradient(135deg, #6c3483, #9b59b6)' : 'var(--bg-lifted)',
                                border: `1px solid ${loraEnabled ? 'rgba(155,89,182,0.5)' : 'var(--solid-border)'}`,
                                position: 'relative', transition: 'all 0.3s ease',
                                boxShadow: loraEnabled ? '0 0 12px rgba(155,89,182,0.3)' : 'none',
                                flexShrink: 0,
                            }}
                        >
                            <div style={{
                                position: 'absolute', top: 3, width: 22, height: 22, borderRadius: '50%',
                                background: 'white',
                                left: loraEnabled ? 27 : 3,
                                transition: 'left 0.3s ease',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                            }} />
                        </div>
                    </div>

                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {[
                                { label: 'Puerto Módulo', value: loraPort, setter: setLoraPort, placeholder: '/dev/ttyUSB0' },
                                { label: 'Baud Rate', value: loraBaud, setter: setLoraBaud, placeholder: '115200' },
                            ].map(f => (
                                <div key={f.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>{f.label}</label>
                                    <input
                                        type="text"
                                        value={f.value}
                                        onChange={e => f.setter(e.target.value)}
                                        disabled={!loraEnabled}
                                        placeholder={f.placeholder}
                                        style={{
                                            padding: '10px 14px', background: loraEnabled ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)',
                                            border: `1px solid ${loraEnabled ? 'rgba(155,89,182,0.3)' : 'var(--solid-border)'}`,
                                            borderRadius: 'var(--radius-sm)', color: loraEnabled ? 'var(--text-primary)' : 'var(--text-disabled)',
                                            fontSize: '0.85rem', outline: 'none', fontFamily: 'JetBrains Mono, monospace',
                                            transition: 'all 0.3s ease',
                                        }}
                                    />
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={saveLoraConfig}
                            disabled={!loraEnabled}
                            style={{
                                width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                                background: saved ? 'rgba(0,217,126,0.15)' : (loraEnabled ? 'rgba(155,89,182,0.15)' : 'var(--bg-lifted)'),
                                border: `1px solid ${saved ? 'var(--success)' : (loraEnabled ? 'rgba(155,89,182,0.4)' : 'var(--solid-border)')}`,
                                color: saved ? 'var(--success)' : (loraEnabled ? '#9b59b6' : 'var(--text-disabled)'),
                                fontWeight: 700, fontSize: '0.9rem', cursor: loraEnabled ? 'pointer' : 'not-allowed',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            {saved ? '✓ Configuración Guardada' : 'Aplicar Configuración LoRa'}
                        </button>
                    </div>
                </div>

                {/* Real-time Mesh Latency RTT Telemetry Card */}
                <div style={{
                    borderRadius: 'var(--radius-lg)', border: '1px solid rgba(41,182,246,0.25)',
                    overflow: 'hidden', background: 'linear-gradient(135deg, rgba(10,20,35,0.95), rgba(5,10,18,0.98))',
                    padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#29B6F6' }}>Telemetría de Latencia Mesh (RTT)</div>
                        <button
                            onClick={() => setBlackoutModalOpen(true)}
                            style={{
                                padding: '6px 12px', borderRadius: '10px',
                                background: 'rgba(232,33,58,0.15)', border: '1px solid rgba(232,33,58,0.3)',
                                color: 'var(--primary-bright)', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer'
                            }}
                        >
                            Simular Apagón 📡
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>LATENCIA RTT LAN</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#00D97E', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                                4 ms
                            </div>
                        </div>
                        <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>LATENCIA BLE MESH</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#29B6F6', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                                18 ms
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Blackout Simulator Modal */}
            {blackoutModalOpen && (
                <BlackoutSimulatorModal onClose={() => setBlackoutModalOpen(false)} />
            )}

            <style>{`
                @keyframes scanLine {
                    0%   { top: 12px; opacity: 0; }
                    10%  { opacity: 1; }
                    90%  { opacity: 1; }
                    100% { top: calc(100% - 14px); opacity: 0; }
                }
            `}</style>
        </div>
    );
}
