"use client";

import React from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";

export default function StarredPage() {
    const { starredMessages, toggleStarMessage } = useRedStore();

    return (
        <main className="starred-page bg-dark">
            <header className="mobile-settings-header glass">
                <Link href="/chat" className="back-btn">←</Link>
                <h2>⭐ Mensajes Guardados</h2>
            </header>

            <div className="starred-list">
                {starredMessages.length === 0 ? (
                    <div className="empty-state-full animate-fade">
                        <div style={{ fontSize: "3rem" }}>⭐</div>
                        <h3>Sin mensajes guardados</h3>
                        <p>Mantén pulsado un mensaje y elige "Guardar" para tenerlo siempre a mano.</p>
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
                                {msg.mediaType === "image" ? "📷 Imagen" : msg.content}
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
