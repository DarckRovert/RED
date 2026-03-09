"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";

const STATUS_BG = [
    "linear-gradient(135deg, #ff1744, #7c0019)",
    "linear-gradient(135deg, #6200ea, #0d47a1)",
    "linear-gradient(135deg, #00838f, #1de9b6)",
    "linear-gradient(135deg, #e65100, #ffd600)",
];

export default function StatusPage() {
    const { statusItems, addStatusItem, identity, displayName, avatarUrl } = useRedStore();
    const [composing, setComposing] = useState(false);
    const [textInput, setTextInput] = useState("");
    const [selectedBg, setSelectedBg] = useState(0);
    const [viewingIndex, setViewingIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePostText = () => {
        if (!textInput.trim()) return;
        addStatusItem(textInput, "text");
        setTextInput("");
        setComposing(false);
    };

    const handleImageStatus = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => addStatusItem(reader.result as string, "image");
        reader.readAsDataURL(f);
        e.target.value = "";
    };

    return (
        <main className="status-page bg-dark">
            {/* Header */}
            <header className="mobile-settings-header glass">
                <Link href="/chat" className="back-btn">←</Link>
                <h2>Estados</h2>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="Foto de estado">📷</button>
                    <button className="icon-btn" onClick={() => setComposing(true)} title="Texto">✏️</button>
                </div>
                <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*" onChange={handleImageStatus} />
            </header>

            {/* My Status */}
            <section className="status-my-section glass">
                <div className="status-avatar-ring" onClick={() => statusItems.length > 0 ? setViewingIndex(0) : setComposing(true)}>
                    {avatarUrl
                        ? <img src={avatarUrl} alt="avatar" className="status-avatar-img" />
                        : <div className="status-avatar-placeholder">{displayName[0]?.toUpperCase() || "R"}</div>
                    }
                    <div className="status-add-icon">{statusItems.length > 0 ? "▶" : "+"}</div>
                </div>
                <div>
                    <p className="status-name">Mi estado</p>
                    <p className="status-sub">{statusItems.length > 0 ? `${statusItems.length} historias` : "Toca para añadir un estado"}</p>
                </div>
            </section>

            {/* Contacts statuses (mock) */}
            <section className="status-contacts-section">
                <h3 className="status-section-title">Actualizaciones recientes</h3>
                {[
                    { name: "Satoshi Nakamoto", time: "hace 2 min", initials: "S", bg: STATUS_BG[0] },
                    { name: "Alice (RED Dev)", time: "hace 14 min", initials: "A", bg: STATUS_BG[1] },
                    { name: "Vitalik Buterin", time: "hace 1h", initials: "V", bg: STATUS_BG[2] },
                    { name: "Bob (Gossip Node)", time: "Ayer", initials: "B", bg: STATUS_BG[3] },
                ].map((c) => (
                    <div key={c.name} className="status-contact-item">
                        <div className="status-avatar-ring viewed">
                            <div className="status-avatar-placeholder" style={{ background: c.bg }}>{c.initials}</div>
                        </div>
                        <div>
                            <p className="status-name">{c.name}</p>
                            <p className="status-sub">{c.time}</p>
                        </div>
                    </div>
                ))}
            </section>

            {/* Compose overlay */}
            {composing && (
                <div className="status-compose-overlay animate-fade">
                    <div className="status-compose glass" style={{ background: STATUS_BG[selectedBg] }}>
                        <textarea
                            className="status-text-input"
                            placeholder="Escribe tu estado..."
                            value={textInput}
                            onChange={e => setTextInput(e.target.value)}
                            autoFocus
                        />
                        <div className="status-bg-picker">
                            {STATUS_BG.map((bg, i) => (
                                <button key={i} className={`status-bg-swatch ${i === selectedBg ? "selected" : ""}`} style={{ background: bg }} onClick={() => setSelectedBg(i)} />
                            ))}
                        </div>
                    </div>
                    <div className="status-compose-actions">
                        <button className="call-btn reject" onClick={() => setComposing(false)}>✕</button>
                        <button className="call-btn answer" onClick={handlePostText}>▶</button>
                    </div>
                </div>
            )}

            {/* View overlay */}
            {viewingIndex !== null && statusItems[viewingIndex] && (
                <div className="status-view-overlay animate-fade" onClick={() => setViewingIndex(null)}>
                    <div className="status-view-item">
                        {statusItems[viewingIndex].type === "image"
                            ? <img src={statusItems[viewingIndex].content} alt="status" className="status-view-image" />
                            : <div className="status-view-text" style={{ background: STATUS_BG[viewingIndex % STATUS_BG.length] }}>
                                <p>{statusItems[viewingIndex].content}</p>
                            </div>
                        }
                        <div className="status-view-bar">
                            {statusItems.map((_, i) => (
                                <div key={i} className={`status-bar-segment ${i === viewingIndex ? "active" : i < viewingIndex ? "done" : ""}`} />
                            ))}
                        </div>
                        <p className="status-view-time">{new Date(statusItems[viewingIndex].timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                </div>
            )}
        </main>
    );
}
