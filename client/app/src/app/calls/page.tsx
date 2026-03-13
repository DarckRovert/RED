"use client";

import React, { useState } from "react";
import Link from "next/link";

type CallType = "voice" | "video";
type CallDir = "incoming" | "outgoing";
type CallStatus = "answered" | "missed" | "declined";

interface CallRecord {
    id: string;
    peer: string;
    type: CallType;
    direction: CallDir;
    status: CallStatus;
    duration?: number; // seconds
    timestamp: number;
}

function formatDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
}

function relTime(ts: number) {
    const diff = (Date.now() / 1000) - ts;
    if (diff < 86400) return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800) return ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][new Date(ts * 1000).getDay()];
    return new Date(ts * 1000).toLocaleDateString([], { day: "2-digit", month: "short" });
}

export default function CallHistoryPage() {
    const [filter, setFilter] = useState<"all" | "missed">("all");

    // Eventually loaded from persistent storage/store
    const calls: CallRecord[] = [];

    return (
        <main className="call-history-page bg-dark">
            <header className="mobile-settings-header glass">
                <Link href="/settings" className="back-btn">←</Link>
                <h2>📞 Historial de llamadas</h2>
            </header>

            {/* Filter tabs */}
            <div className="call-filter-tabs glass">
                <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas</button>
                <button className={filter === "missed" ? "active missed" : ""} onClick={() => setFilter("missed")}>Perdidas</button>
            </div>

            <div className="call-history-list">
                {calls.length === 0 && (
                    <div className="empty-state-full animate-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', opacity: 0.8 }}>
                        <div className="glass" style={{ width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                            <span style={{ fontSize: "2.5rem" }}>📞</span>
                        </div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 600 }}>Aún no hay llamadas</h3>
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '250px' }}>
                            Tus llamadas de voz y video encriptadas y P2P aparecerán aquí.
                        </p>
                    </div>
                )}
                {calls.map(c => (
                    <div key={c.id} className={`call-record glass ${c.status === "missed" ? "missed" : ""}`}>
                        <div className="call-record-avatar">{c.peer[0]}</div>
                        <div className="call-record-info">
                            <span className="call-record-name">{c.peer}</span>
                            <div className="call-record-meta">
                                <span className="call-record-dir">
                                    {c.direction === "outgoing" ? "↗️" : "↙️"}
                                    {c.type === "video" ? " 📹" : " 📞"}
                                    {c.status === "missed" && <span className="call-missed-tag"> Perdida</span>}
                                    {c.status === "declined" && <span className="call-declined-tag"> Rechazada</span>}
                                </span>
                                {c.duration && <span className="call-record-dur">{formatDuration(c.duration)}</span>}
                            </div>
                        </div>
                        <div className="call-record-right">
                            <span className="call-record-time">{relTime(c.timestamp)}</span>
                            <button className="call-back-btn" title="Volver a llamar">
                                {c.type === "video" ? "📹" : "📞"}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}
