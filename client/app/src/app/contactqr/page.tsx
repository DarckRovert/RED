"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";
import QRCode from "qrcode";

export default function ContactQRPage() {
    const { contacts, identity, displayName } = useRedStore();
    const [selected, setSelected] = useState<string | null>(null);
    const [myQRDataUrl, setMyQRDataUrl] = useState<string>("");
    const [contactQRDataUrl, setContactQRDataUrl] = useState<string>("");

    const myQRData = `red://add-contact/${identity?.identity_hash || "pending"}?name=${encodeURIComponent(displayName)}`;
    const selectedContact = contacts.find(c => c.id === selected);

    // Generate real QR for my own DID (SVG mode for robustness)
    useEffect(() => {
        QRCode.toString(myQRData, {
            type: "svg",
            width: 220,
            margin: 2,
            color: { dark: "#111111", light: "#ffffff" },
            errorCorrectionLevel: "M",
        }).then(setMyQRDataUrl).catch(console.error);
    }, [myQRData]);

    // Generate real QR for selected contact (SVG mode)
    useEffect(() => {
        if (!selectedContact) { setContactQRDataUrl(""); return; }
        const contactData = `red://add-contact/${selectedContact.identity_hash}?name=${encodeURIComponent(selectedContact.displayName)}`;
        QRCode.toString(contactData, {
            type: "svg",
            width: 160,
            margin: 2,
            color: { dark: "#111111", light: "#ffffff" },
            errorCorrectionLevel: "M",
        }).then(setContactQRDataUrl).catch(console.error);
    }, [selectedContact]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).catch(() => { });
    };

    return (
        <main className="contact-qr-page bg-dark">
            <header className="mobile-settings-header glass">
                <Link href="/settings" className="back-btn">←</Link>
                <h2>📲 Códigos QR</h2>
            </header>

            {/* My QR */}
            <section className="qr-section-card glass animate-fade">
                <h3>Mi código RED</h3>
                <p className="qr-sub">Scanéalo con otra app RED para añadirte</p>
                <div className="qr-container">
                    {myQRDataUrl
                        ? <div dangerouslySetInnerHTML={{ __html: myQRDataUrl }} style={{ borderRadius: 12, overflow: "hidden" }} />
                        : <div style={{ width: 220, height: 220, background: "rgba(255,255,255,0.05)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>⏳</div>
                    }
                    <p className="qr-identity">{displayName}</p>
                    <code className="qr-hash">{identity?.identity_hash?.substring(0, 24) || "Generando..."}...</code>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="btn-secondary" onClick={() => copyToClipboard(myQRData)}>📋 Copiar link</button>
                    <button className="btn-primary" onClick={() => {
                        if (typeof navigator.share === "function") {
                            navigator.share({ title: "RED", text: "Únete a RED", url: myQRData });
                        } else copyToClipboard(myQRData);
                    }}>📤 Compartir</button>
                </div>
            </section>

            {/* Contact QR picker */}
            <section className="qr-contacts-section">
                <p className="section-title" style={{ padding: "0.5rem 1rem", marginTop: '0.8rem' }}>Código de mis contactos</p>
                <div className="qr-contact-list tools-grid" style={{ padding: '0 1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
                    {contacts.map(c => (
                        <button
                            key={c.id}
                            className={`qr-contact-chip glass ${selected === c.id ? "selected" : ""}`}
                            onClick={() => setSelected(selected === c.id ? null : c.id)}
                            style={{ 
                                display: 'flex', alignItems: 'center', gap: '8px', 
                                padding: '10px 12px', borderRadius: '14px', 
                                border: selected === c.id ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                                background: selected === c.id ? 'var(--primary-subtle)' : 'var(--surface-2)',
                                transition: 'all 0.2s', width: '100%', justifyContent: 'flex-start'
                            }}
                        >
                            <span className="qr-contact-avatar" style={{width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>{c.displayName[0]}</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.displayName}</span>
                        </button>
                    ))}
                </div>

                {contactQRDataUrl && selectedContact && (
                    <div className="qr-contact-card glass animate-fade" style={{ margin: '1.5rem 1rem', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', background: 'var(--surface-2)' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedContact.displayName}</h4>
                        <div dangerouslySetInnerHTML={{ __html: contactQRDataUrl }} style={{ borderRadius: 12, overflow: "hidden", background: '#fff', padding: '4px' }} />
                        <button className="btn-secondary" onClick={() => copyToClipboard(`red://add-contact/${selectedContact.identity_hash}`)} style={{ width: '100%' }}>📋 Copiar link</button>
                    </div>
                )}
            </section>
        </main>
    );
}
