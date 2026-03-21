"use client";

import React, { useState, useEffect } from "react";
import { localTransport } from "../lib/mesh/localTransport";
import { RedDevice } from "../lib/mesh/bluetoothTransport";

export default function NearbyDevicesPanel() {
    const [devices, setDevices] = useState<RedDevice[]>([]);
    const [scanning, setScanning] = useState(false);

    useEffect(() => {
        // Automatically start the background sensing
        localTransport.startBackgroundSensing(() => {
            setDevices([...localTransport.discoveredBluetoothPeers]);
        });
        setScanning(true);

        const interval = setInterval(() => {
            setDevices([...localTransport.discoveredBluetoothPeers]);
        }, 2000); // UI Refresh loop

        return () => clearInterval(interval);
    }, []);

    const handleConnect = async (deviceId: string) => {
        try {
            await localTransport.connectBluetooth(deviceId);
            alert("Conectado físicamente al nodo " + deviceId);
        } catch (e) {
            alert("Error al conectar por Bluetooth");
        }
    };

    return (
        <div style={{
            background: 'var(--bg-lifted)', padding: '24px', borderRadius: '16px',
            border: '1px solid var(--solid-border)', margin: '16px', color: 'var(--text-primary)'
        }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                    display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', 
                    background: scanning ? 'var(--primary-glow)' : 'gray',
                    animation: scanning ? 'pulse 2s infinite' : 'none' 
                }}></span>
                RADAR OFFLINE (BLE / WiFi LAN)
            </h3>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px', marginBottom: '16px' }}>
                Escaneando el perímetro físico en busca de pares criptográficos RED.
            </p>

            {devices.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                    No hay pares en rango directo.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {devices.map((dev, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px', borderRadius: '12px', background: 'var(--bg-deep)',
                            border: '1px solid var(--solid-border)'
                        }}>
                            <div>
                                <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>NODO DESCUBIERTO</p>
                                <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>MAC: {dev.id}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--primary-glow)' }}>RSSI: {dev.rssi} dBm</p>
                            </div>
                            <button 
                                onClick={() => handleConnect(dev.id)}
                                className="btn-secondary"
                                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
                            >
                                CONECTAR
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
