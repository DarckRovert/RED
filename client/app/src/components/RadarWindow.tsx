"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
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
    
    // QR Code State
    const [qrDataUrl, setQrDataUrl] = useState<string>('');

    // QR Generation Hook
    useEffect(() => {
        if (identity?.identity_hash) {
            import('qrcode').then(QRCode => {
                QRCode.toDataURL(identity.identity_hash, {
                    width: 400,
                    margin: 1,
                    color: { dark: '#f01e1e', light: '#00000000' }
                }).then(setQrDataUrl);
            });
        }
    }, [identity]);

    // BLE Scanning Hook
    useEffect(() => {
        let isScanningBLE = false;

        const initBLE = async () => {
            try {
                const { Capacitor } = await import('@capacitor/core');
                if (!Capacitor.isNativePlatform()) return;

                const { BleClient } = await import('@capacitor-community/bluetooth-le');
                await BleClient.initialize();
                
                await BleClient.requestLEScan({
                    // Scan all for now, filter by 'RED-' prefix
                    allowDuplicates: false
                }, (result) => {
                    const devName = result.device.name || result.localName;
                    if (devName && devName.startsWith('RED-')) {
                        setNearbyPeers(prev => {
                            if (!prev.find(p => p.id === result.device.deviceId)) {
                                return [...prev, {
                                    id: result.device.deviceId,
                                    name: devName,
                                    rssi: result.rssi
                                }];
                            }
                            return prev;
                        });
                    }
                });
                isScanningBLE = true;
            } catch (e) {
                console.error("[RED BLE] Scan error:", e);
            }
        };

        if (!scanning) {
            initBLE();
        }

        return () => {
            if (isScanningBLE) {
                import('@capacitor-community/bluetooth-le').then(({ BleClient }) => {
                    BleClient.stopLEScan().catch(() => {});
                });
            }
        };
    }, [scanning]);

    // Stop camera scanning when unmounting
    useEffect(() => {
        return () => { stopScan(); };
    }, []);

    const startScan = async () => {
        try {
            const { Capacitor, registerPlugin } = await import('@capacitor/core');
            if (!Capacitor.isNativePlatform()) {
                alert("La cámara QR solo funciona en dispositivos físicos.");
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
                setScannedResult(result.content);
                const success = await addContact(result.content, "Par Escaneado");
                if (success) {
                    toast.success("¡Contacto añadido con éxito!");
                    navigate('sidebar');
                } else {
                    toast.error("No se pudo agregar el contacto. Verifica el QR.");
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-surface)' }}>
            
            <header style={{ padding: '16px', borderBottom: '1px solid var(--solid-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={goBack} style={{ background: 'transparent', color: 'var(--primary)', fontSize: '1.4rem' }}>←</button>
                    <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.3rem' }}>Radar & Contactos</h2>
                </div>
                <button onClick={() => useRedStore.getState().navigate('nodemap')} style={{ background: 'var(--solid-highlight)', color: 'var(--primary)', padding: '6px 12px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    🌍 Mapa P2P
                </button>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Add Contact Action (Scanner) */}
                <div style={{ 
                    background: 'var(--bg-lifted)', padding: '24px', borderRadius: '16px', 
                    border: '1px solid var(--solid-border)', textAlign: 'center',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                    <button 
                        onClick={startScan}
                        style={{ 
                            width: 80, height: 80, borderRadius: 40, background: 'var(--primary)', 
                            color: 'white', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px auto', boxShadow: '0 8px 24px var(--primary-glow)'
                        }}
                    >
                        📷
                    </button>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem' }}>Escaneo Rápido</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 8 }}>Añade identidades apuntando con la cámara.</p>
                </div>

                {/* Manual Entry Fallback */}
                <div style={{ 
                    background: 'var(--bg-lifted)', padding: '24px', borderRadius: '16px', 
                    border: '1px solid var(--solid-border)', display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>Entrada Manual</h3>
                    <input 
                        type="text" 
                        placeholder="Hash de Identidad (ej: 42af...)" 
                        value={manualHash}
                        onChange={e => setManualHash(e.target.value)}
                        style={{ background: 'var(--bg-deep)', border: '1px solid var(--solid-border)', padding: '12px', borderRadius: '8px', color: 'white' }}
                    />
                    <input 
                        type="text" 
                        placeholder="Nombre para el contacto" 
                        value={manualName}
                        onChange={e => setManualName(e.target.value)}
                        style={{ background: 'var(--bg-deep)', border: '1px solid var(--solid-border)', padding: '12px', borderRadius: '8px', color: 'white' }}
                    />
                    <button 
                        disabled={!manualHash || isAdding}
                        onClick={async () => {
                            setIsAdding(true);
                            const ok = await addContact(manualHash, manualName || "Nuevo Par");
                            setIsAdding(false);
                            if (ok) {
                                toast.success("Contacto añadido.");
                                navigate('sidebar');
                            } else {
                                toast.error("Error al añadir contacto.");
                            }
                        }}
                        className="btn-primary" 
                        style={{ padding: '12px', borderRadius: '8px', opacity: manualHash ? 1 : 0.5 }}
                    >
                        {isAdding ? "Añadiendo..." : "Añadir Contacto"}
                    </button>
                </div>

                {/* My Identity / Display QR */}
                <div style={{ 
                    background: 'var(--bg-lifted)', padding: '20px', borderRadius: '16px', 
                    border: '1px solid var(--solid-border)', textAlign: 'center'
                }}>
                    <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Mi Tarjeta de Identidad</h3>
                    
                    <div style={{ 
                        background: 'white', padding: '10px', borderRadius: '12px', display: 'inline-block',
                        boxShadow: '0 0 20px rgba(240, 30, 30, 0.3)', marginBottom: '16px'
                    }}>
                        {qrDataUrl ? (
                            <img src={qrDataUrl} alt="My QR Code" style={{ width: 180, height: 180, display: 'block' }} />
                        ) : (
                            <div style={{ width: 180, height: 180, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>Generando QR...</div>
                        )}
                    </div>

                    <div style={{ 
                        background: 'var(--bg-deep)', padding: '12px', borderRadius: '8px', 
                        fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--primary)',
                        wordBreak: 'break-all', border: '1px solid var(--solid-highlight)'
                    }}>
                        {identity?.identity_hash}
                    </div>
                </div>

                {/* Radar BLE (Nearby Nodes) */}
                <div style={{ 
                    background: 'var(--bg-lifted)', padding: '20px', borderRadius: '16px', 
                    border: '1px solid var(--solid-border)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, color: '#3498db', fontSize: '1.1rem' }}>RED Nearby (BLE)</h3>
                        <div className="pulsing-dot" style={{ width: 12, height: 12, borderRadius: 6, background: '#3498db' }} />
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '8px 0 16px 0' }}>Escaneando nodos en red local y Bluetooth Low Energy...</p>
                    
                    <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed var(--solid-highlight)', borderRadius: 8 }}>
                        {nearbyPeers.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>0 Pares Detectados Offline</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {nearbyPeers.map(peer => (
                                    <div key={peer.id} style={{ 
                                        display: 'flex', justifyContent: 'space-between', 
                                        background: 'var(--bg-card)', padding: '12px', borderRadius: '8px',
                                        border: '1px solid var(--solid-border)'
                                    }}>
                                        <span style={{ color: 'white', fontWeight: 'bold' }}>{peer.name}</span>
                                        <span style={{ color: peer.rssi > -70 ? '#2ecc71' : '#f1c40f' }}>{peer.rssi} dBm</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
