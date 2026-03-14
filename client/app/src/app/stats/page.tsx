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
        <div className="stats-card">
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

    // Calulate live stats
    const s = useMemo(() => {
        let sent = 0;
        let received = 0;
        let calls = 0;
        let dataBytes = 0;

        // Daily chart bins for the last 7 days
        const dailyCounts = new Array(7).fill(0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const todayMs = now.getTime();

        messages.forEach(m => {
            if (m.is_mine) sent++; else received++;
            if (m.msg_type === "call" || m.msg_type === "video") calls++;
            dataBytes += m.content.length + (m.media_data ? m.media_data.length : 0);
            
            // Calculate which bin (0=today, 1=yesterday, ..., 6=6 days ago)
            const msgDate = new Date(m.timestamp * 1000);
            msgDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((todayMs - msgDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays < 7) {
                dailyCounts[6 - diffDays]++; // 6 is today, 0 is 6 days ago in chart L-R
            }
        });

        // Map groups
        const breakdown = Object.entries(
            messages.reduce((acc, m) => {
                const target = m.is_mine ? m.sender : m.sender; // simplified group by sender string
                acc[target] = (acc[target] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        ).map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 4);

        const nodes = contacts.length > 0 ? contacts.length + 1 : 1;
        const voiceMins = 0;
        const dataMB = dataBytes / 1024 / 1024 + ((sent + received) * 0.015);

        return { 
            sent, received, sentMB: dataBytes / 1024 / 1024, recvMB: dataBytes * 1.5 / 1024 / 1024, calls, breakdown, dailyCounts,
            nodes, voiceMins, dataMB
        };
    }, [messages, contacts, period]);

    const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
    const chartData = s.dailyCounts;

    // Read real grouped conversations
    const convStats = useMemo(() => {
        return conversations.slice(0, 4).map((c, i) => {
            const count = messages.filter(m => m.sender === c.peer || (m.is_mine && i===0 /*simplification*/)).length;
            return { conv: c, value: count, color: ["#ff1744", "#2196f3", "#4caf50", "#ff9800"][i % 4] };
        });
    }, [conversations, messages]);

    return (
        <main className="stats-page bg-dark">
            <header className="mobile-settings-header">
                <Link href="/settings" className="back-btn">←</Link>
                <h2>📊 Estadísticas</h2>
            </header>

            {/* Period toggle */}
            <div className="stats-period-tabs" style={{ background: 'var(--surface-2)', margin: '0 1rem 1rem', borderRadius: '12px', display: 'flex', padding: '0.25rem' }}>
                {(["7d", "30d", "all"] as const).map(p => (
                    <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>
                        {p === "7d" ? "7 días" : p === "30d" ? "30 días" : "Todo"}
                    </button>
                ))}
            </div>

            <div className="stats-content">
                {/* Summary cards */}
                <h3 className="section-title" style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>Resumen Global</h3>
                <div className="tools-grid animate-fade" style={{ marginBottom: "2rem" }}>
                    <StatsCard title="Mensajes enviados" value={s.sent} icon="↗️" color="#ff1744" />
                    <StatsCard title="Mensajes recibidos" value={s.received} icon="↙️" color="#2196f3" />
                    <StatsCard title="Llamadas" value={s.calls} icon="📞" color="#9c27b0" sub={`${s.voiceMins} min`} />
                    <StatsCard title="Datos transferidos" value={`${s.dataMB.toFixed(2)} MB`} icon="🌐" color="#00bcd4" />
                    <StatsCard title="Contactos" value={contacts.length} icon="👥" color="#4caf50" />
                    <StatsCard title="Nodos RED Conocidos" value={s.nodes} icon="🔴" color="#ff5722" />
                </div>

                {/* Mini bar chart */}
                <div className="stats-chart animate-fade">
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
                <div className="stats-breakdown animate-fade">
                    <p className="stats-chart-title">Desglose por conversación</p>
                    {convStats.map(({ conv, value, color }) => (
                        <StatBar key={conv.id} label={conv.peer} value={value} max={Math.max(10, s.sent + s.received)} color={color} unit=" msgs" />
                    ))}
                    {conversations.length === 0 && (
                        <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                            Aún no hay conversaciones activas.
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
