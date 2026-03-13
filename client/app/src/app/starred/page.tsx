"use client";

import React from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";

export default function StarredPage() {
    const { starredMessages, toggleStarMessage } = useRedStore();

    return (
        <main className="starred-page bg-dark">
            <header className="mobile-settings-header">
                <Link href="/settings" className="back-btn">←</Link>
                <h2>⭐ Mensajes Guardados</h2>
            </header>

            <div className="starred-list">
                {starredMessages.length === 0 ? (
                    <div className="empty-state-full animate-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem' }}>
                        <div className="status-avatar-placeholder" style={{ width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', background: 'var(--surface-2)', border: '1px solid var(--glass-border)' }}>
                            <span style={{ fontSize: "2.5rem" }}>⭐</span>
                        </div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.4rem', color: 'var(--text-primary)', fontWeight: 600 }}>Cero mensajes estelares</h3>
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '250px' }}>
                            Mantén pulsado un mensaje del chat y elige "Guardar" para conservarlo por siempre.
                        </p>
                    </div>
                ) : (
                    starredMessages.map(msg => (
                        <div key={msg.id} className="starred-item glass">
                            <div className="starred-meta">
                                <span className="starred-sender">{msg.is_mine ? "Tú" : msg.sender.substring(0, 12)}</span>
                                <span className="starred-time">
                                    {new Date(msg.timestamp * 1000).toLocaleDateString([], { day: "2-digit", month: "short" })}
                                </span>
                            </div>
                            <p className="starred-content">
                                {msg.msg_type === "image" ? "📷 Imagen" : msg.content}
                            </p>
                            <button className="star-remove-btn" onClick={() => toggleStarMessage(msg)} title="Quitar estrella">
                                ⭐ Guardado
                            </button>
                        </div>
                    ))
                )}
            </div>
        </main>
    );
}
