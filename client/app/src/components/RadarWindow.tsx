"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { localTransport } from "../lib/mesh/localTransport";
import { toast } from "./Toast";

export default function RadarWindow() {
    const { goBack, identity, addContact, navigate } = useRedStore();
    const [scanning, setScanning] = useState(false);
    const [scannedResult, setScannedResult] = useState<string | null>(null);
    const [nearbyPeers, setNearbyPeers] = useState<any[]>([]);
    
    // Manual Entry State
    const [manualHash, setManualHash] = useState('');
    const [manualName, setManualName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [addingStatus, setAddingStatus] = useState(''); // e.g. 'Verificando nodo...'
    
    // QR Code State
    const [qrDataUrl, setQrDataUrl] = useState<string>('');

    // QR Generation Hook
    useEffect(() => {
        if (identity?.identity_hash) {
            const qrText = identity.public_key 
                ? `did:red:${identity.identity_hash}:${identity.public_key}` 
                : identity.identity_hash;
            import('qrcode').then(QRCode => {
                QRCode.toDataURL(qrText, {
                    width: 400,
                    margin: 1,
                    color: { dark: '#f01e1e', light: '#00000000' }
                }).then(setQrDataUrl);
            });
        }
    }, [identity]);

    // The Radar now consumes peers from the centralized localTransport
    // instead of running its own redundant BLE scan.
    useEffect(() => {
        const updatePeers = () => {
            // Filter only BLE peers for the specific "RED NEARBY" section
            const blePeers = localTransport.allPeers
                .filter((p: any) => p.transport === 'ble')
                .map((p: any) => ({
                    id: p.id,
                    name: `RED-${p.id.substring(0, 8)}`,
                    rssi: p.rssi || -100
                }));
            setNearbyPeers(blePeers);
        };

        const interval = setInterval(updatePeers, 2000);
        updatePeers();
        return () => clearInterval(interval);
    }, []);

    // Stop camera scanning when unmounting
    useEffect(() => {
        return () => { stopScan(); };
    }, []);

    const startScan = async () => {
        try {
            const { Capacitor, registerPlugin } = await import('@capacitor/core');
            if (!Capacitor.isNativePlatform()) {
                toast.info("La cámara QR requiere un dispositivo físico.");
                return;
            }

            const BarcodeScanner = registerPlugin<any>('BarcodeScanner');
            
            // Check Camera permission
            await BarcodeScanner.checkPermission({ force: true });

            // Hide UI background to show camera view
            BarcodeScanner.hideBackground();
            document.body.style.background = "transparent";
            setScanning(true);

            const result = await BarcodeScanner.startScan(); // start scanning and wait for a result

            // if the result has content
            if (result.hasContent) {
                const raw = result.content.trim();
                if (raw.startsWith('RED_ID_VAULT:')) {
                    try {
                        const encoded = raw.split(':')[1];
                        const decoded = JSON.parse(atob(encoded));
                        const cleanHash = decoded.did || '';
                        const pubKey = decoded.pk || null;
                        if (cleanHash) {
                            await addContact(cleanHash, "Bóveda Escaneada", pubKey);
                            toast.success("¡Identidad y clave guardadas con éxito!");
                            navigate('chat', cleanHash);
                        }
                    } catch (e) {
                        toast.error("Bóveda QR Inválida");
                    }
                } else if (raw.startsWith('did:red:')) {
                    try {
                        const parts = raw.split(':');
                        const cleanHash = parts[2];
                        const pubKey = parts[3] || null;
                        await addContact(cleanHash, "Par Escaneado", pubKey);
                        toast.success("¡Contacto y clave pública guardados con éxito!");
                        navigate('chat', cleanHash);
                    } catch (addErr) {
                        const msg = addErr instanceof Error ? addErr.message : String(addErr);
                        toast.error(`Error al añadir: ${msg}`);
                    }
                } else {
                    const cleanHash = raw;
                    setScannedResult(cleanHash);
                    try {
                        await addContact(cleanHash, "Par Escaneado");
                        toast.success("¡Contacto añadido con éxito!");
                        navigate('chat', cleanHash);
                    } catch (addErr) {
                        const msg = addErr instanceof Error ? addErr.message : String(addErr);
                        toast.error(`Error al añadir: ${msg}`);
                    }
                }
            }
        } catch (e) {
            console.error("Camera permissions or Scanner error", e);
        } finally {
            stopScan();
        }
    };

    const stopScan = async () => {
        setScanning(false);
        document.body.style.background = "";
        try {
            const { Capacitor, registerPlugin } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const BarcodeScanner = registerPlugin<any>('BarcodeScanner');
                BarcodeScanner.showBackground();
                BarcodeScanner.stopScan();
            }
        } catch (e) {}
    };

    if (scanning) {
        return (
            <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
                <div style={{ padding: '32px 16px', background: 'rgba(0,0,0,0.8)', color: 'white' }}>
                    <button onClick={stopScan} className="btn-primary" style={{ padding: '8px 16px', borderRadius: 8 }}>Cancelar</button>
                    <p style={{ textAlign: 'center', marginTop: 16 }}>Apunta al código QR de otro par RED</p>
                </div>
                <div style={{ flex: 1 }}>
                    {/* Camera view visible here through transparent body */}
                    <div style={{ 
                        margin: 'auto', width: '250px', height: '250px', 
                        border: '4px solid var(--primary)', borderRadius: '16px',
                        boxShadow: '0 0 0 4000px rgba(0,0,0,0.6)',
                        marginTop: '10vh'
                    }} />
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-deep)' }}>
            
            <header className="glass-panel" style={{ padding: '20px', borderBottom: '1px solid var(--solid-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '0 0 24px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={goBack} style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', fontSize: '1.4rem', cursor: 'pointer', padding: '8px' }}>←</button>
                    <div>
                        <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.3rem', fontWeight: 800, letterSpacing: '1px' }}>RADAR P2P</h2>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.75rem', letterSpacing: '2px' }}>GESTIÓN DE IDENTIDADES</p>
                    </div>
                </div>
                <button onClick={() => useRedStore.getState().navigate('nodemap')} style={{ background: 'var(--primary-subtle)', color: 'var(--primary)', padding: '8px 16px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem', border: '1px solid var(--solid-border-active)', cursor: 'pointer' }}>
                    🌍 Mapa P2P
                </button>
            </header>

            <div className="scroll-container" style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Add Contact (Scanner) */}
                <div style={{ background: 'linear-gradient(135deg, rgba(20,20,30,0.85), rgba(15,15,24,0.95))', backdropFilter: 'blur(16px)', padding: '28px', borderRadius: '24px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button 
                        onClick={startScan}
                        style={{ 
                            width: 88, height: 88, borderRadius: 44, background: 'linear-gradient(135deg, #E8213A, #C0152A)', 
                            color: 'white', fontSize: '2.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px auto', boxShadow: '0 8px 32px rgba(232,33,58,0.4)',
                            border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'transform 0.3s var(--ease-spring)',
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        📷
                    </button>
                    <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.2rem', fontWeight: 800 }}>Escaneo Rápido</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>Añade identidades apuntando con la cámara.</p>
                </div>

                {/* Manual Entry Fallback */}
                <div style={{ background: 'linear-gradient(135deg, rgba(20,20,30,0.85), rgba(15,15,24,0.95))', backdropFilter: 'blur(16px)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: 700 }}>Entrada Manual de ID</h3>
                    <input 
                        type="text" 
                        placeholder="Hash de Identidad (64 hex chars)" 
                        value={manualHash}
                        onChange={e => setManualHash(e.target.value)}
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px 16px', borderRadius: '12px', color: 'white', fontFamily: 'monospace', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                    />
                    <input 
                        type="text" 
                        placeholder="Alias del contacto" 
                        value={manualName}
                        onChange={e => setManualName(e.target.value)}
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px 16px', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                    />
                    <button 
                        disabled={!manualHash || isAdding}
                        onClick={async () => {
                            setIsAdding(true);
                            setAddingStatus('Añadiendo...');
                            const hashToSent = manualHash.trim();
                            const nameToSend = manualName ? manualName.trim() : "Nuevo Par";
                            try {
                                const powTimer = setTimeout(() => setAddingStatus('Verificando nodo PoW…'), 1000);
                                await addContact(hashToSent, nameToSend);
                                clearTimeout(powTimer);
                                toast.success("✅ Contacto añadido correctamente.");
                                navigate('chat', hashToSent);
                            } catch (err) {
                                const msg = err instanceof Error ? err.message : String(err);
                                toast.error(`❌ ${msg}`);
                            } finally {
                                setIsAdding(false);
                                setAddingStatus('');
                            }
                        }}
                        className="btn-primary" 
                        style={{ borderRadius: '14px', background: 'linear-gradient(135deg, #E8213A, #C0152A)', opacity: manualHash ? 1 : 0.5, border: 'none', color: 'white', padding: '14px' }}
                    >
                        {isAdding ? addingStatus || 'Añadiendo...' : 'Añadir Contacto'}
                    </button>
                </div>

                {/* My Identity / Display QR */}
                <div style={{ background: 'linear-gradient(135deg, rgba(20,20,30,0.85), rgba(15,15,24,0.95))', backdropFilter: 'blur(16px)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '1.1rem', fontWeight: 700 }}>Mi Tarjeta de Identidad</h3>
                    
                    <div style={{ 
                        background: 'white', padding: '12px', borderRadius: '16px', display: 'inline-block',
                        boxShadow: '0 0 32px rgba(232,33,58,0.3)', marginBottom: '16px'
                    }}>
                        {qrDataUrl ? (
                            <img src={qrDataUrl} alt="My QR Code" style={{ width: 200, height: 200, display: 'block' }} />
                        ) : (
                            <div style={{ width: 200, height: 200, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', borderRadius: '8px' }}>Generando...</div>
                        )}
                    </div>

                    <div style={{ 
                        background: 'rgba(0,0,0,0.5)', padding: '12px 16px', borderRadius: '12px', 
                        fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--primary-bright)',
                        wordBreak: 'break-all', border: '1px solid rgba(232,33,58,0.25)',
                        letterSpacing: '1px', lineHeight: 1.6
                    }}>
                        {identity?.identity_hash}
                    </div>
                </div>

                {/* Radar BLE (Nearby Nodes) */}
                <div style={{ background: 'linear-gradient(135deg, rgba(20,40,60,0.85), rgba(10,20,30,0.95))', backdropFilter: 'blur(16px)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(41,182,246,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: 700 }}>RED NEARBY (BLE)</h3>
                        <div className="pulsing-dot" style={{ width: 12, height: 12, borderRadius: 6, background: '#00D97E' }} />
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', margin: '0 0 16px 0' }}>Escaneando nodos en Bluetooth Low Energy...</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {nearbyPeers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                0 Pares Detectados
                            </div>
                        ) : (
                            nearbyPeers.map(peer => (
                                <div key={peer.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    background: 'rgba(0,0,0,0.4)', padding: '12px 14px', borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {peer.name}
                                            <span style={{
                                                fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px',
                                                background: peer.rssi > -65 ? 'rgba(0,217,126,0.15)' : peer.rssi > -80 ? 'rgba(255,167,38,0.15)' : 'rgba(232,33,58,0.15)',
                                                color: peer.rssi > -65 ? '#00D97E' : peer.rssi > -80 ? '#FFA726' : '#ff4444',
                                                border: `1px solid ${peer.rssi > -65 ? 'rgba(0,217,126,0.3)' : peer.rssi > -80 ? 'rgba(255,167,38,0.3)' : 'rgba(232,33,58,0.3)'}`,
                                                fontWeight: 800
                                            }}>
                                                {peer.rssi > -65 ? '⚡ EXCELENTE' : peer.rssi > -80 ? '📶 BUENA' : '📡 DÉBIL'}
                                            </span>
                                        </div>
                                        <div style={{
                                            color: 'var(--text-muted)',
                                            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', marginTop: 2,
                                        }}>
                                            {peer.rssi} dBm · Proximidad BLE Mesh
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const peerTarget = peer.id || peer.name.replace('RED-', '');
                                                await addContact(peerTarget, peer.name);
                                                toast.success(`🤝 Vinculación directa enviada a ${peer.name}`);
                                            } catch (e) {
                                                const msg = e instanceof Error ? e.message : String(e);
                                                toast.error(`❌ ${msg}`);
                                            }
                                        }}
                                        style={{
                                            padding: '7px 14px', borderRadius: 10, flexShrink: 0,
                                            background: 'linear-gradient(135deg, rgba(41,182,246,0.2), rgba(0,217,126,0.15))',
                                            border: '1px solid rgba(41,182,246,0.35)',
                                            color: '#29B6F6', fontSize: '0.78rem', fontWeight: 800,
                                            cursor: 'pointer', whiteSpace: 'nowrap',
                                            boxShadow: '0 2px 8px rgba(41,182,246,0.2)'
                                        }}
                                    >
                                        🤝 Invitar
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
