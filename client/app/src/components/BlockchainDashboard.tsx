"use client";

import React, { useEffect, useState } from "react";
import { useRedStore } from "../store/useRedStore";

export default function BlockchainDashboard() {
    const { status } = useRedStore();
    const [blocks, setBlocks] = useState<{ height: number, hash: string, time: string }[]>([]);

    useEffect(() => {
        // Simulate live block updates
        const initialBlocks = Array.from({ length: 5 }, (_, i) => ({
            height: 12492 - i,
            hash: Math.random().toString(16).substring(2, 10).toUpperCase() + "...",
            time: `${i * 2} min ago`
        }));
        setBlocks(initialBlocks);

        const interval = setInterval(() => {
            setBlocks(prev => [
                { height: prev[0].height + 1, hash: Math.random().toString(16).substring(2, 10).toUpperCase() + "...", time: "Just now" },
                ...prev.slice(0, 4)
            ]);
        }, 15000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="dashboard-container animate-fade">
            <header className="dashboard-header">
                <div className="status-indicator">
                    <div className="pulse-dot"></div>
                    <span>RED Mainnet Activo</span>
                </div>
                <h2>Explorador de Red</h2>
            </header>

            <div className="metrics-grid">
                <div className="metric-card glass">
                    <span className="metric-label">Identidad (Identity Hash)</span>
                    <code className="metric-value">{status?.identity_hash || "f3a2...92b1"}</code>
                </div>
                <div className="metric-card glass">
                    <span className="metric-label">Pares Conectados (Gossip)</span>
                    <span className="metric-value highlighting">{status?.peer_count || 12} Nodos</span>
                </div>
                <div className="metric-card glass">
                    <span className="metric-label">Algoritmo de Consenso</span>
                    <span className="metric-value">Proof of Stake (Red-POS)</span>
                </div>
            </div>

            <div className="main-grid">
                <section className="block-feed glass">
                    <h3>Sincronización de Bloques</h3>
                    <div className="feed-list">
                        {blocks.map(block => (
                            <div key={block.height} className="block-item animate-fade">
                                <div className="block-icon">📦</div>
                                <div className="block-info">
                                    <span className="block-height">Bloque # {block.height}</span>
                                    <span className="block-hash">{block.hash}</span>
                                </div>
                                <span className="block-time">{block.time}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="network-map glass">
                    <h3>Mapa de Nodos P2P</h3>
                    <div className="map-sim">
                        <div className="node-center"></div>
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="node-peer" style={{
                                transform: `rotate(${i * 60}deg) translate(80px)`
                            }}></div>
                        ))}
                        <div className="map-overlay">
                            <span>Red Mesh Activa</span>
                        </div>
                    </div>
                    <div className="network-details">
                        <div className="detail">
                            <span>Protocolo</span>
                            <span>libp2p / QUIC</span>
                        </div>
                        <div className="detail">
                            <span>Encriptación</span>
                            <span>ChaCha20-Poly1305</span>
                        </div>
                    </div>
                </section>
            </div>

        </div>
    );
}
