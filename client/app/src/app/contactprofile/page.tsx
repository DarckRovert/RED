"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useRedStore } from "../../store/useRedStore";

interface MediaItem { type: string; url?: string; caption?: string; name?: string; size?: string; icon?: string; }

const SHARED_MEDIA_MOCK: MediaItem[] = [];

const TABS = ["Info", "Multimedia", "Archivos", "Links"];

function ContactProfileContent() {
    const searchParams = useSearchParams();
    const contactId = searchParams.get("id");
    const { contacts, conversations, selectConversation, startBurnerChat } = useRedStore();
    const [tab, setTab] = useState("Info");
    const router = useRouter();

    // Look up contact by ?id= param, fall back to first contact
    const contact = (contactId ? contacts.find(c => c.id === contactId) : null)
        ?? contacts[0]
        ?? { id: "demo", displayName: "Desconocido", identity_hash: "00000000000000000000000000000000" };
    const conv = conversations.find(c => c.peer === contact.displayName);

    const media = SHARED_MEDIA_MOCK.filter(m => m.type === "image");
    const files = SHARED_MEDIA_MOCK.filter(m => m.type === "file");

    return (
        <main className="contact-profile-page bg-dark">
            {/* Hero header */}
            <div className="contact-profile-hero">
                <Link href="/contacts" className="back-btn profile-back">←</Link>
                <div className="contact-profile-avatar-wrap">
                    <div className="contact-profile-avatar">{contact.displayName[0]}</div>
                    <div className="contact-online-dot" />
                </div>
                <h2 className="contact-profile-name">{contact.displayName}</h2>
                <p className="contact-profile-hash">{contact.identity_hash?.substring(0, 32) || "—"}...</p>
                <p className="contact-profile-status">🟢 En línea · Nodo RED activo</p>

                <div className="contact-profile-actions">
                    <button className="profile-action-btn" onClick={() => conv && selectConversation(conv.id)}>
                        <span>💬</span><small>Mensaje</small>
                    </button>
                    <Link href="/calls" className="profile-action-btn">
                        <span>📞</span><small>Llamada</small>
                    </Link>
                    <Link href="/calls" className="profile-action-btn">
                        <span>📹</span><small>Video</small>
                    </Link>
                    <button className="profile-action-btn" onClick={() => {
                        startBurnerChat(contact.id, contact.displayName);
                        router.push('/chat');
                    }}>
                        <span>🔥</span><small>Burner</small>
                    </button>
                    <button className="profile-action-btn">
                        <span>🔇</span><small>Silenciar</small>
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <nav className="profile-tabs glass">
                {TABS.map(t => (
                    <button key={t} className={`profile-tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
                ))}
            </nav>

            {/* Tab Content */}
            <div className="profile-tab-content animate-fade">
                {tab === "Info" && (
                    <div className="profile-info-section">
                        <div className="profile-info-row glass">
                            <span className="profile-info-label">Red ID</span>
                            <code className="profile-info-value mono">{contact.identity_hash?.substring(0, 20) || "—"}…</code>
                        </div>
                        <div className="profile-info-row glass">
                            <span className="profile-info-label">Estado</span>
                            <span className="profile-info-value">🟢 En línea</span>
                        </div>
                        <div className="profile-info-row glass">
                            <span className="profile-info-label">Nodo</span>
                            <span className="profile-info-value">gossip.red.p2p:7001</span>
                        </div>
                        <div className="profile-info-row glass">
                            <span className="profile-info-label">Tiempo en RED</span>
                            <span className="profile-info-value">847 días</span>
                        </div>
                        <div className="profile-info-row glass">
                            <span className="profile-info-label">Mensajes cifrados</span>
                            <span className="profile-info-value">1,247 total</span>
                        </div>
                        <div className="profile-info-row glass danger-row">
                            <span className="profile-info-label">⚠️ Bloquear contacto</span>
                            <button className="danger-btn">Bloquear</button>
                        </div>
                    </div>
                )}

                {tab === "Multimedia" && (
                    <div className="profile-media-grid">
                        {media.map((m, i) => (
                            <div key={i} className="profile-media-item">
                                <img src={m.url} alt={m.caption} loading="lazy" />
                            </div>
                        ))}
                        {media.length === 0 && <p className="empty-state-full">Sin multimedia compartida</p>}
                    </div>
                )}

                {tab === "Archivos" && (
                    <div className="profile-files-list">
                        {files.map((f, i) => f.type === "file" && (
                            <div key={i} className="profile-file-item glass">
                                <span className="profile-file-icon">{(f as any).icon}</span>
                                <div>
                                    <p className="profile-file-name">{(f as any).name}</p>
                                    <p className="profile-file-size">{(f as any).size}</p>
                                </div>
                                <button className="call-back-btn">↓</button>
                            </div>
                        ))}
                    </div>
                )}

                {tab === "Links" && (
                    <div className="profile-links-list">
                        <p className="search-hint">Sin enlaces compartidos aún</p>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function ContactProfilePage() {
    return (
        <Suspense fallback={<div className="bg-dark" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>⏳</div>}>
            <ContactProfileContent />
        </Suspense>
    );
}
