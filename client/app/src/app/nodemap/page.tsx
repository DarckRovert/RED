"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";

interface NetworkNode {
    id: string;
    label: string;
    x: number;
    y: number;
    type: "self" | "peer" | "relay" | "unknown";
    latency?: number;
    active: boolean;
}

interface Edge { from: string; to: string; strength: number; }

function typeColor(type: NetworkNode["type"]) {
    return { self: "#ff1744", peer: "#2196f3", relay: "#4caf50", unknown: "#9e9e9e" }[type];
}

export default function NodeMapPage() {
    const { peers, nodeStatus } = useRedStore();
    const [selected, setSelected] = useState<NetworkNode | null>(null);
    const [pulse, setPulse] = useState(0);
    const svgRef = useRef<SVGSVGElement>(null);

    // Compute live network nodes
    const nodes: NetworkNode[] = React.useMemo(() => {
        const list: NetworkNode[] = [
            { id: "self", label: "Tú", x: 0.5, y: 0.5, type: "self", active: nodeStatus === 'online' }
        ];

        peers.forEach((p, i) => {
            // Distribute peers in a circle around the center (0.5, 0.5)
            const angle = (i / peers.length) * Math.PI * 2;
            const dist = 0.25 + ((p.id.length % 5) * 0.04); 
            
            list.push({
                id: p.id,
                label: p.name || p.id.substring(0, 8),
                x: 0.5 + Math.cos(angle) * dist,
                y: 0.5 + Math.sin(angle) * dist,
                type: p.transport === 'wifi' ? 'relay' : 'peer',
                active: p.connected,
                latency: p.rssi ? Math.abs(p.rssi) : 0 
            });
        });
        return list;
    }, [peers, nodeStatus]);

    // Compute edges to self based on connected state
    const edges: Edge[] = React.useMemo(() => {
        return peers.map(p => ({
            from: "self",
            to: p.id,
            strength: p.connected ? 0.8 : 0.3
        }));
    }, [peers]);
    // Animate pulse
    useEffect(() => {
        // Animate pulse using requestAnimationFrame (throttled to ~30fps) instead of setInterval
        let raf: number;
        let last = 0;
        const tick = (now: number) => {
            if (now - last > 33) { // ~30fps cap
                setPulse(p => (p + 1) % 100);
                last = now;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    const W = 360, H = 420;

    return (
        <main className="nodemap-page bg-dark">
            <header className="mobile-settings-header">
                <Link href="/settings" className="back-btn">←</Link>
                <h2>🌐 Red de Nodos</h2>
                <span className="nodemap-live">● LIVE</span>
            </header>

            {/* Stats bar */}
            <div className="nodemap-stats" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--glass-border)' }}>
                <div className="nodemap-stat"><span className="nodemap-stat-val">{nodes.filter(n => n.active).length}</span><small>activos</small></div>
                <div className="nodemap-stat"><span className="nodemap-stat-val">{nodes.filter(n => !n.active).length}</span><small>offline</small></div>
                <div className="nodemap-stat"><span className="nodemap-stat-val">{edges.length}</span><small>enlaces</small></div>
                <div className="nodemap-stat"><span className="nodemap-stat-val" style={{ color: "#4caf50" }}>
                    {nodes.length > 1 ? Math.floor(nodes.filter(n => n.latency).reduce((acc, curr) => acc + (curr.latency || 0), 0) / (nodes.length - 1)) : 0}ms
                </span><small>avg ping</small></div>
            </div>

            {/* SVG Network Map */}
            <div className="nodemap-canvas-wrap">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${W} ${H}`}
                    width="100%"
                    style={{ touchAction: "none" }}
                >
                    {/* Edges */}
                    {edges.map((e, i) => {
                        const from = nodes.find(n => n.id === e.from);
                        const to = nodes.find(n => n.id === e.to);
                        if (!from || !to) return null;
                        return (
                            <line
                                key={i}
                                x1={from.x * W} y1={from.y * H}
                                x2={to.x * W} y2={to.y * H}
                                stroke={`rgba(255,23,68,${e.strength * 0.35})`}
                                strokeWidth={e.strength * 2}
                                strokeDasharray={`${4 + e.strength * 6} ${8}`}
                                strokeDashoffset={-pulse * e.strength * 2}
                            />
                        );
                    })}

                    {/* Nodes */}
                    {nodes.map(node => {
                        const x = node.x * W;
                        const y = node.y * H;
                        const r = node.type === "self" ? 16 : node.type === "relay" ? 11 : 9;
                        const color = typeColor(node.type);
                        const isSelected = selected?.id === node.id;
                        return (
                            <g key={node.id} onClick={() => setSelected(selected?.id === node.id ? null : node)} style={{ cursor: "pointer" }}>
                                {/* Pulse ring for self */}
                                {node.type === "self" && (
                                    <circle cx={x} cy={y} r={r + 8 + (pulse % 50) * 0.3} fill="none" stroke="#ff1744" strokeWidth={1} opacity={1 - (pulse % 50) / 50} />
                                )}
                                {/* Active glow */}
                                {node.active && <circle cx={x} cy={y} r={r + 4} fill={color} opacity={0.12} />}
                                {/* Main circle */}
                                <circle cx={x} cy={y} r={r} fill={node.active ? color : "#444"} stroke={isSelected ? "white" : color} strokeWidth={isSelected ? 2.5 : 1.5} />
                                {/* Label */}
                                <text x={x} y={y + r + 11} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="9" fontFamily="monospace">
                                    {node.label.substring(0, 12)}
                                </text>
                                {/* Latency badge */}
                                {node.latency && node.active && (
                                    <text x={x + r + 2} y={y - r + 4} fill="#4caf50" fontSize="7" fontFamily="monospace">{node.latency}ms</text>
                                )}
                                {!node.active && <text x={x} y={y + 4} textAnchor="middle" fill="white" fontSize="8">✕</text>}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Legend */}
            <div className="nodemap-legend glass">
                {(["self", "peer", "relay", "unknown"] as const).map(t => (
                    <div key={t} className="nodemap-legend-item">
                        <div className="nodemap-legend-dot" style={{ background: typeColor(t) }} />
                        <span>{{ self: "Tú", peer: "Par", relay: "Relay", unknown: "Anónimo" }[t]}</span>
                    </div>
                ))}
            </div>

            {/* Selected node info */}
            {selected && (
                <div className="nodemap-node-info glass animate-fade">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className="nodemap-node-name">{selected.label}</span>
                        <button onClick={() => setSelected(null)}>✕</button>
                    </div>
                    <p className="nodemap-node-detail">Tipo: <strong>{{ self: "Tu nodo", peer: "Par directo", relay: "Nodo relay", unknown: "Desconocido" }[selected.type]}</strong></p>
                    <p className="nodemap-node-detail">Estado: <strong style={{ color: selected.active ? "#4caf50" : "#ef5350" }}>{selected.active ? "Activo" : "Offline"}</strong></p>
                    {selected.latency && <p className="nodemap-node-detail">Latencia: <strong style={{ color: "#4caf50" }}>{selected.latency}ms</strong></p>}
                </div>
            )}
        </main>
    );
}
