"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";

export default function NetworkPanel() {
    const { goBack } = useRedStore();
    const [localIp, setLocalIp] = useState("Escaneando IPs locales...");
    const [loraEnabled, setLoraEnabled] = useState(false);
    const [loraPort, setLoraPort] = useState("/dev/ttyUSB0");
    const [loraBaud, setLoraBaud] = useState("115200");

    useEffect(() => {
        // Fetch local IP from Capacitor network plugin or Axum
        setTimeout(() => setLocalIp("192.168.1.55"), 1500);

        setLoraEnabled(localStorage.getItem("red_lora_enabled") === "true");
        setLoraPort(localStorage.getItem("red_lora_port") || "/dev/ttyUSB0");
        setLoraBaud(localStorage.getItem("red_lora_baud") || "115200");
    }, []);

    const toggleLora = () => {
        const nextState = !loraEnabled;
        setLoraEnabled(nextState);
        localStorage.setItem("red_lora_enabled", nextState.toString());
        // Phase 19: This would command the Rust node over JNI
    };

    const saveLoraConfig = () => {
        localStorage.setItem("red_lora_port", loraPort);
        localStorage.setItem("red_lora_baud", loraBaud);
    };

    const apkUrl = `http://${localIp}:7331/api/mesh/apk`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-surface)' }}>
            
            <header style={{ padding: '16px', borderBottom: '1px solid var(--solid-border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={goBack} style={{ background: 'transparent', color: 'var(--primary)', fontSize: '1.4rem' }}>←</button>
                <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.3rem' }}>Red & Emisión</h2>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Mesh APK Updater */}
                <div style={{ background: 'var(--bg-lifted)', padding: '24px', borderRadius: '16px', border: '1px solid var(--solid-border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', textAlign: 'center' }}>🔗 Distribuidor Mesh (APK)</h3>
                    <p style={{ margin: '8px 0 24px', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', lineHeight: '1.4' }}>
                        Comparte la App de RED con usuarios sin internet localmente. Escanea el código o entra a la IP desde su navegador.
                    </p>
                    
                    <div style={{ background: 'white', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {/* Stylized QR placeholder — render a real QR canvas via a useEffect if native canvas access is available */}
                        <div style={{ width: 200, height: 200, position: 'relative' }}>
                            <div style={{
                                width: '100%', height: '100%', display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gridTemplateRows: 'repeat(10, 1fr)', gap: '2px'
                            }}>
                                {Array.from({ length: 100 }).map((_, i) => (
                                    <div key={i} style={{ background: Math.random() > 0.5 ? '#000' : '#fff', borderRadius: '2px' }} />
                                ))}
                            </div>
                            {/* Center badge */}
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ background: '#e74c3c', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>R</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-deep)', padding: '12px 24px', borderRadius: '8px', border: '1px solid var(--solid-highlight)' }}>
                        <code style={{ color: 'var(--primary)', fontSize: '1.1rem', letterSpacing: '1px' }}>{apkUrl}</code>
                    </div>
                </div>

                {/* LoRaWAN Bridge */}
                <div style={{ background: 'var(--bg-lifted)', padding: '16px', borderRadius: '16px', border: '1px solid var(--solid-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>🛰️ Puente LoRaWAN P2P</h3>
                            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Conecta antena RF por puerto USB-C Serial.</p>
                        </div>
                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px' }}>
                            <input type="checkbox" checked={loraEnabled} onChange={toggleLora} style={{ opacity: 0, width: 0, height: 0 }} />
                            <span className="slider round" style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: loraEnabled ? 'var(--primary)' : 'var(--solid-highlight)', borderRadius: '34px', transition: '.4s' }}>
                                <span style={{ position: 'absolute', height: '20px', width: '20px', left: loraEnabled ? '26px' : '4px', top: '4px', background: 'white', transition: '.4s', borderRadius: '50%' }} />
                            </span>
                        </label>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Puerto Módulo</label>
                            <input 
                                type="text" 
                                value={loraPort}
                                onChange={(e) => setLoraPort(e.target.value)}
                                disabled={!loraEnabled}
                                placeholder="/dev/ttyUSB0" 
                                style={{ padding: '12px', background: 'var(--bg-deep)', border: '1px solid var(--solid-highlight)', color: 'var(--text-primary)', borderRadius: '8px' }} 
                            />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Baud Rate</label>
                            <input 
                                type="number" 
                                value={loraBaud}
                                onChange={(e) => setLoraBaud(e.target.value)}
                                disabled={!loraEnabled}
                                placeholder="115200" 
                                style={{ padding: '12px', background: 'var(--bg-deep)', border: '1px solid var(--solid-highlight)', color: 'var(--text-primary)', borderRadius: '8px' }} 
                            />
                        </div>
                    </div>
                    <button 
                        onClick={saveLoraConfig}
                        disabled={!loraEnabled}
                        style={{ width: '100%', padding: '12px', marginTop: '16px', background: 'var(--solid-bg)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '8px', fontWeight: 'bold' }}
                    >
                        Configurar Frecuencia
                    </button>
                </div>

            </div>
        </div>
    );
}
