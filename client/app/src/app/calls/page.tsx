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

const MOCK_CALLS: CallRecord[] = [
    { id: "c1", peer: "Satoshi Nakamoto", type: "voice", direction: "outgoing", status: "answered", duration: 312, timestamp: Date.now() / 1000 - 1800 },
    { id: "c2", peer: "Alice (RED Dev)", type: "video", direction: "incoming", status: "answered", duration: 928, timestamp: Date.now() / 1000 - 7200 },
    { id: "c3", peer: "Vitalik Buterin", type: "voice", direction: "incoming", status: "missed", timestamp: Date.now() / 1000 - 18000 },
    { id: "c4", peer: "Bob (Gossip Node)", type: "voice", direction: "outgoing", status: "declined", timestamp: Date.now() / 1000 - 86400 },
    { id: "c5", peer: "Satoshi Nakamoto", type: "video", direction: "incoming", status: "answered", duration: 54, timestamp: Date.now() / 1000 - 172800 },
    { id: "c6", peer: "Charlie (Auditor)", type: "voice", direction: "outgoing", status: "answered", duration: 147, timestamp: Date.now() / 1000 - 259200 },
];

export default function CallHistoryPage() {
    const [filter, setFilter] = useState<"all" | "missed">("all");

    const calls = MOCK_CALLS.filter(c => filter === "all" || c.status === "missed");

    return (
        <main className="call-history-page bg-dark">
            <header className="mobile-settings-header glass">
                <Link href="/chat" className="back-btn">←</Link>
                <h2>📞 Historial de llamadas</h2>
            </header>

            {/* Filter tabs */}
            <div className="call-filter-tabs glass">
                <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas</button>
                <button className={filter === "missed" ? "active missed" : ""} onClick={() => setFilter("missed")}>Perdidas</button>
            </div>

            <div className="call-history-list">
                {calls.length === 0 && (
                    <div className="empty-state-full animate-fade">
                        <div style={{ fontSize: "3rem" }}>📞</div>
                        <h3>Sin llamadas perdidas</h3>
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
