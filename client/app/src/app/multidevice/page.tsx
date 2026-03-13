"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";
import QRCode from "qrcode";

interface LinkedDevice {
    id: string;
    name: string;
    platform: string;
    lastSeen: string;
}

const INITIAL_DEVICES: LinkedDevice[] = [];

export default function MultidevicePage() {
    const { identity, displayName } = useRedStore();
    const [devices, setDevices] = useState<LinkedDevice[]>(INITIAL_DEVICES);
    const [qrDataUrl, setQrDataUrl] = useState<string>("");
    const [refreshCount, setRefreshCount] = useState(0);

    const qrContent = `red://link-device/${identity?.identity_hash || "pending"}?session=${Date.now()}&name=${encodeURIComponent(displayName)}`;

    // Generate real scannable QR code (SVG mode)
    useEffect(() => {
        QRCode.toString(qrContent, {
            type: "svg",
            width: 200,
            margin: 2,
            color: { dark: "#111111", light: "#ffffff" },
            errorCorrectionLevel: "H",
        }).then(setQrDataUrl).catch(console.error);
    }, [qrContent, refreshCount]);

    const unlink = (id: string) => setDevices(ds => ds.filter(d => d.id !== id));

    const refresh = () => setRefreshCount(c => c + 1);

    return (
        <main className="multidevice-page bg-dark">
            <header className="mobile-settings-header">
                <Link href="/settings" className="back-btn">←</Link>
                <h2>📱 Dispositivos Vinculados</h2>
            </header>

            <section className="multidevice-content">
                {/* QR Hero */}
                <div className="multidevice-hero animate-fade" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', padding: '1.5rem 1rem' }}>
                    <h3>Vincular nuevo dispositivo</h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
                        Abre RED en el otro dispositivo → Ajustes → Vincular → Escanea este QR
                    </p>
                    <div className="qr-display">
                        {qrDataUrl
                            ? <div dangerouslySetInnerHTML={{ __html: qrDataUrl }} style={{ borderRadius: 12, overflow: "hidden" }} />
                            : <div style={{ width: 200, height: 200, background: "rgba(255,255,255,0.05)", borderRadius: 12, display: "grid", placeItems: "center" }}>⏳</div>
                        }
                    </div>
                    <div className="qr-label">QR expira en 60s · Error correction: H</div>
                    <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={refresh}>🔄 Regenerar QR</button>
                </div>

                {/* Linked devices */}
                <div className="multidevice-linked" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', padding: '1rem' }}>
                    <h3>Dispositivos activos ({devices.length})</h3>
                    {devices.map(d => (
                        <div key={d.id} className="device-item">
                            <span className="device-icon">📱</span>
                            <div>
                                <p className="device-name">{d.name}</p>
                                <p className="device-detail">{d.platform} · {d.lastSeen}</p>
                            </div>
                            <button className="device-unlink" onClick={() => unlink(d.id)}>Desvincular</button>
                        </div>
                    ))}
                    {devices.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Sin dispositivos vinculados</p>}
                </div>
            </section>
        </main>
    );
}
