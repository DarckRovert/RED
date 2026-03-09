"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";

interface StatBarProps { label: string; value: number; max: number; color: string; unit?: string; }
function StatBar({ label, value, max, color, unit = "" }: StatBarProps) {
    const pct = Math.min(100, (value / max) * 100);
    return (
        <div className="stat-bar-row">
            <div className="stat-bar-header">
                <span className="stat-bar-label">{label}</span>
                <span className="stat-bar-value">{value.toLocaleString()}{unit}</span>
            </div>
            <div className="stat-bar-track">
                <div className="stat-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
}

interface StatsCardProps { title: string; value: string | number; sub?: string; icon: string; color: string; }
function StatsCard({ title, value, sub, icon, color }: StatsCardProps) {
    return (
        <div className="stats-card glass">
            <div className="stats-card-icon" style={{ color }}>{icon}</div>
            <div className="stats-card-info">
                <span className="stats-card-value">{typeof value === "number" ? value.toLocaleString() : value}</span>
                <span className="stats-card-title">{title}</span>
                {sub && <span className="stats-card-sub">{sub}</span>}
            </div>
        </div>
    );
}

export default function UsageStatsPage() {
    const { messages, conversations, contacts } = useRedStore();
    const [period, setPeriod] = useState<"7d" | "30d" | "all">("7d");

    const STATS_DB = {
        "7d": { sent: 312, received: 489, calls: 8, voiceMins: 47, dataMB: 12.4, nodes: 6 },
        "30d": { sent: 1247, received: 1893, calls: 31, voiceMins: 184, dataMB: 89.2, nodes: 12 },
        "all": { sent: 8742, received: 13284, calls: 247, voiceMins: 1831, dataMB: 1240, nodes: 34 },
    };
    const s = STATS_DB[period];
    const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
    const chartData = [42, 78, 35, 91, 65, 104, 53];

    // Stable per-conversation values (seeded by conv id — no Math.random in render)
    const convStats = useMemo(() =>
        conversations.slice(0, 4).map((c, i) => {
            const id = c.id || `mock_${i}`;
            const seed = id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
            return { conv: c, value: 50 + (seed % 300) + i * 80, color: ["#ff1744", "#2196f3", "#4caf50", "#ff9800"][i % 4] };
        }),
        [conversations]
    );

    return (
        <main className="stats-page bg-dark">
            <header className="mobile-settings-header glass">
                <Link href="/settings" className="back-btn">←</Link>
                <h2>📊 Estadísticas</h2>
            </header>

            {/* Period toggle */}
            <div className="stats-period-tabs glass">
                {(["7d", "30d", "all"] as const).map(p => (
                    <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>
                        {p === "7d" ? "7 días" : p === "30d" ? "30 días" : "Todo"}
                    </button>
                ))}
            </div>

            <div className="stats-content">
                {/* Summary cards */}
                <div className="stats-cards-grid animate-fade">
                    <StatsCard title="Mensajes enviados" value={s.sent} icon="↗️" color="#ff1744" />
                    <StatsCard title="Mensajes recibidos" value={s.received} icon="↙️" color="#2196f3" />
                    <StatsCard title="Llamadas" value={s.calls} icon="📞" color="#9c27b0" sub={`${s.voiceMins} min`} />
                    <StatsCard title="Datos transferidos" value={`${s.dataMB} MB`} icon="🌐" color="#00bcd4" />
                    <StatsCard title="Contactos" value={Math.max(contacts.length, 4)} icon="👥" color="#4caf50" />
                    <StatsCard title="Nodos RED Conocidos" value={s.nodes} icon="🔴" color="#ff5722" />
                </div>

                {/* Mini bar chart */}
                <div className="stats-chart glass animate-fade">
                    <p className="stats-chart-title">Mensajes por día (últimos 7 días)</p>
                    <div className="stats-chart-bars">
                        {chartData.map((v, i) => (
                            <div key={i} className="stats-chart-col">
                                <div className="stats-chart-bar" style={{ height: `${(v / 110) * 80}px` }} />
                                <span className="stats-chart-label">{DAYS[i]}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Breakdown bars */}
                <div className="stats-breakdown glass animate-fade">
                    <p className="stats-chart-title">Desglose por conversación</p>
                    {convStats.map(({ conv, value, color }) => (
                        <StatBar key={conv.id} label={conv.peer} value={value} max={600} color={color} unit=" msgs" />
                    ))}
                    {conversations.length === 0 && (
                        <>
                            <StatBar label="Satoshi Nakamoto" value={412} max={600} color="#ff1744" unit=" msgs" />
                            <StatBar label="Alice (RED Dev)" value={278} max={600} color="#2196f3" unit=" msgs" />
                            <StatBar label="Vitalik Buterin" value={195} max={600} color="#4caf50" unit=" msgs" />
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
