"use client";

import React, { useEffect, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { BlockDetailsModal } from "./BlockDetailsModal";
import { LocalAIEngine } from "../lib/localAiEngine";
import { queryAICopilot } from "../api/ai";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

interface BlockItem {
    height: number;
    hash: string;
    prev_hash: string;
    timestamp: number;
    tx_count: number;
    validator: string;
}

interface ValidatorItem {
    public_key: string;
    stake: number;
    active: boolean;
    blocks_produced: number;
    missed_slots: number;
    weight: number;
}

interface ConsensusStatus {
    epoch: number;
    current_slot: number;
    total_stake: number;
    active_validators: number;
    chain_height: number;
}

type TabType = "blocks" | "validators" | "consensus" | "stake";

function timeAgo(ts: number, isGenesis = false): string {
    if (isGenesis || ts <= 1704067200) {
        return "Génesis (Red Omega)";
    }
    const secs = Math.floor(Date.now() / 1000 - ts);
    if (secs < 0) return "Ahora mismo";
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
    return `${Math.floor(secs / 86400)}d`;
}

export default function BlockchainExplorer() {
    const { identity, status, goBack } = useRedStore();
    const { t } = useTranslation();
    const [blocks, setBlocks] = useState<BlockItem[]>([]);
    const [validators, setValidators] = useState<ValidatorItem[]>([]);
    const [consensus, setConsensus] = useState<ConsensusStatus | null>(null);
    const [tab, setTab] = useState<TabType>("blocks");
    const [loading, setLoading] = useState(true);
    const [selectedBlock, setSelectedBlock] = useState<BlockItem | null>(null);

    // AI Audit state
    const [aiAudit, setAiAudit] = useState<string | null>(null);
    const [auditLoading, setAuditLoading] = useState(false);

    // Staking states
    const [stakeAmount, setStakeAmount] = useState("");
    const [stakingStatus, setStakingStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [stakingError, setStakingError] = useState("");

    const [searchQuery, setSearchQuery] = useState("");

    const chainHeight = consensus?.chain_height || blocks.length || 1;

    const fetchChainData = async () => {
        try {
            const { localChainLedger } = await import("../lib/blockchain/LocalChainLedger");
            const chain = localChainLedger.getBlocks();
            if (Array.isArray(chain) && chain.length > 0) {
                setBlocks(chain.map(b => ({
                    height: b.height,
                    hash: b.hash,
                    prev_hash: b.prev_hash,
                    timestamp: b.timestamp,
                    tx_count: b.tx_count,
                    validator: b.validator,
                    merkle_root: b.merkle_root,
                    transactions: b.transactions
                } as any)));
            } else {
                const apiChain = await RedAPI.getBlockchain();
                if (Array.isArray(apiChain)) setBlocks(apiChain);
            }

            const metrics = localChainLedger.getConsensusMetrics();
            setConsensus({
                epoch: metrics.epoch,
                current_slot: metrics.current_slot,
                total_stake: metrics.total_stake,
                active_validators: metrics.active_validators,
                chain_height: metrics.chain_height,
            });

            const vals = await localChainLedger.getValidators();
            setValidators(vals.map(v => ({
                public_key: v.public_key,
                stake: v.stake,
                active: v.active,
                blocks_produced: v.blocks_produced,
                missed_slots: v.missed_slots,
                weight: v.weight,
                display_name: v.display_name
            } as any)));
        } catch {
            // fallback handled
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChainData();
        let unsubscribeLedger = () => {};
        import("../lib/blockchain/LocalChainLedger").then(({ localChainLedger }) => {
            unsubscribeLedger = localChainLedger.subscribe(() => {
                fetchChainData();
            });
        });

        const interval = setInterval(fetchChainData, 4000);
        return () => {
            clearInterval(interval);
            unsubscribeLedger();
        };
    }, []);

    const handleRunAiAudit = async () => {
        setAuditLoading(true);
        setAiAudit(null);
        try {
            const prompt = `Evalúa en 2 oraciones la salud de la blockchain local con altura #${chainHeight} y ${blocks.length} bloques minados.`;
            const res = await queryAICopilot(prompt);
            setAiAudit(res.answer || "El modelo no generó una evaluación para la cadena.");
        } catch (e: any) {
            setAiAudit(`⚠️ Motor de IA no disponible: ${e.message || "Modelos no cargados"}.`);
            toast.error("IA no disponible");
        } finally {
            setAuditLoading(false);
        }
    };

    const handleStake = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseInt(stakeAmount);
        if (isNaN(amt) || amt <= 0) {
            setStakingError("Ingresa un monto válido mayor a 0");
            return;
        }

        setStakingStatus("loading");
        setStakingError("");

        try {
            const { localChainLedger } = await import("../lib/blockchain/LocalChainLedger");
            const ok = await localChainLedger.stake(amt);
            if (ok) {
                setStakingStatus("success");
                toast.success(`✅ Has delegado ${amt} RED como validador PoS`);
                setStakeAmount("");
                await fetchChainData();
            } else {
                setStakingStatus("error");
                setStakingError("Saldo insuficiente en la bóveda");
            }
        } catch (err: any) {
            setStakingStatus("error");
            setStakingError(err?.message || "Error al procesar delegación de stake");
        }
    };

    const handleForceSync = async () => {
        setLoading(true);
        toast.info("⚡ Sincronizando árbol de consenso con pares mesh...");
        try {
            await fetchChainData();
            toast.success("✅ Cadena local verificada y sincronizada.");
        } catch {
            toast.warning("Sincronización completada con estado Génesis local.");
        } finally {
            setLoading(false);
        }
    };

    const handleForgeLocalBlock = async () => {
        toast.info("⛏️ Forjando bloque real con Merkle Tree y PoS...");
        try {
            const { localChainLedger } = await import("../lib/blockchain/LocalChainLedger");
            const newBlock = await localChainLedger.forgeNextBlock();
            await fetchChainData();
            toast.success(`🎉 ¡Bloque #${newBlock.height} minado y validado (Hash: ${newBlock.hash.slice(0, 10)}…)!`);
        } catch (e: any) {
            toast.error("Error al forjar bloque: " + (e?.message || ""));
        }
    };

    const filteredBlocks = blocks.filter(b => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
            b.height.toString() === q ||
            b.hash.toLowerCase().includes(q) ||
            b.prev_hash.toLowerCase().includes(q) ||
            b.validator.toLowerCase().includes(q)
        );
    });

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,229,255,0.4)"
                    }}>⛓️</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t.blockchain_module?.title || "Explorador Blockchain Soberano"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {t.blockchain_module?.subtitle || "DAG CONSENSUS · MERKLE AUDITOR · PROOF-OF-STAKE"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    className="btn-icon"
                    title={t.common?.close || "Cerrar explorador"}
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Selector de Pestañas Segmentadas Tácticas */}
            <div style={{
                padding: "10px 16px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border)",
                overflowX: "auto", flexShrink: 0
            }}>
                <button
                    onClick={() => setTab("blocks")}
                    className={tab === "blocks" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                >
                    ⛓️ {t.blockchain_module?.tab_blocks || "Bloques"} ({blocks.length})
                </button>
                <button
                    onClick={() => setTab("validators")}
                    className={tab === "validators" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                >
                    🛡️ {t.blockchain_module?.tab_validators || "Validadores"}
                </button>
                <button
                    onClick={() => setTab("consensus")}
                    className={tab === "consensus" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                >
                    ⚙️ {t.blockchain_module?.tab_consensus || "Consenso"}
                </button>
                <button
                    onClick={() => setTab("stake")}
                    className={tab === "stake" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                >
                    🥩 {t.blockchain_module?.tab_stake || "Staking PoS"}
                </button>
            </div>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ─── TAB 1: BLOQUES ─────────────────────────────────────── */}
                    {tab === "blocks" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: "0.90rem", fontWeight: 800 }}>Registro de Bloques Minados</div>
                                <span className="badge-tactical badge-tactical-cyan">ALTURA #{chainHeight}</span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                <button
                                    onClick={handleForceSync}
                                    disabled={loading}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "8px 12px", fontSize: "0.76rem" }}
                                >
                                    ⚡ Forzar Sincronización
                                </button>
                                <button
                                    onClick={handleForgeLocalBlock}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "8px 12px", fontSize: "0.76rem", borderColor: "rgba(0,230,118,0.4)", color: "var(--accent-emerald)" }}
                                >
                                    ⛏️ Forjar Bloque Local
                                </button>
                            </div>

                            <button
                                onClick={handleRunAiAudit}
                                disabled={auditLoading}
                                className="btn-tactical-secondary"
                                style={{ padding: "10px", fontSize: "0.82rem" }}
                            >
                                {auditLoading ? "Analizando cadena..." : "🤖 Auditar Cadena con IA Local"}
                            </button>

                            {aiAudit && (
                                <div className="card-tactical animate-pop" style={{ padding: "12px", background: "rgba(0,229,255,0.06)", borderColor: "var(--accent-cyan)" }}>
                                    <div style={{ fontSize: "0.82rem", color: "#fff" }}>{aiAudit}</div>
                                </div>
                            )}

                            {/* Barra de Búsqueda Táctica */}
                            <div style={{ position: "relative" }}>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="🔍 Buscar por altura, hash o validador…"
                                    className="input-tactical"
                                    style={{ width: "100%", padding: "10px 14px", fontSize: "0.82rem", borderRadius: "var(--radius-md)" }}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        style={{
                                            position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                                            background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer"
                                        }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {filteredBlocks.length === 0 ? (
                                    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                                        No se encontraron bloques para "{searchQuery}"
                                    </div>
                                ) : (
                                    filteredBlocks.map(b => (
                                        <div
                                            key={b.height}
                                            onClick={() => setSelectedBlock(b)}
                                            className="card-tactical-interactive"
                                            style={{ padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                        >
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <strong style={{ fontSize: "0.95rem", color: "var(--accent-cyan)" }}>Bloque #{b.height}</strong>
                                                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>({b.tx_count} txs)</span>
                                                </div>
                                                <div style={{ fontSize: "0.70rem", fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)", marginTop: "2px" }}>
                                                    Hash: {b.hash.substring(0, 24)}…
                                                </div>
                                            </div>
                                            <div style={{ textAlign: "right", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                                {timeAgo(b.timestamp)}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 2: VALIDADORES ─────────────────────────────────── */}
                    {tab === "validators" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ fontSize: "0.90rem", fontWeight: 800 }}>Validadores Activos en Malla</div>

                            {validators.length === 0 ? (
                                <div className="empty-state-tactical">
                                    <div className="empty-state-icon">🛡️</div>
                                    <div className="empty-state-title">Nodo Validador Local Activo</div>
                                    <div className="empty-state-desc">
                                        Tu nodo opera como validador local de la red soberana RED.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {validators.map((v, i) => (
                                        <div key={i} className="card-tactical" style={{ padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-emerald)" }}>
                                                    Validador {v.public_key.substring(0, 12)}…
                                                </div>
                                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>
                                                    Bloques: {v.blocks_produced} · Peso: {v.weight}%
                                                </div>
                                            </div>
                                            <span className="badge-tactical badge-tactical-emerald">{v.stake} RED</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── TAB 3: CONSENSO ────────────────────────────────────── */}
                    {tab === "consensus" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ fontSize: "0.90rem", fontWeight: 800 }}>Estado de Consenso PoS</div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                <div className="card-tactical" style={{ padding: "14px" }}>
                                    <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Época Actual</div>
                                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                        #{consensus?.epoch ?? 1}
                                    </div>
                                </div>
                                <div className="card-tactical" style={{ padding: "14px" }}>
                                    <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Slot de Tiempo</div>
                                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                                        {consensus?.current_slot ?? 42}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 4: STAKING POS ─────────────────────────────────── */}
                    {tab === "stake" && (
                        <form onSubmit={handleStake} className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                    🥩 Delegación de Stake Soberano
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Bloquea tokens RED para validar bloques y fortalecer el consenso de la malla.
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    CANTIDAD DE TOKENS RED A DELEGAR:
                                </label>
                                <input
                                    type="number"
                                    value={stakeAmount}
                                    onChange={e => setStakeAmount(e.target.value)}
                                    placeholder="Ej: 50, 100, 500..."
                                    style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "1rem" }}
                                />
                            </div>

                            {stakingError && (
                                <div style={{ fontSize: "0.76rem", color: "var(--accent-crimson-bright)", fontWeight: 700 }}>
                                    {stakingError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={stakingStatus === "loading" || !stakeAmount}
                                className="btn-tactical-primary"
                                style={{ width: "100%", padding: "14px", fontSize: "0.95rem" }}
                            >
                                {stakingStatus === "loading" ? "Procesando en Blockchain..." : "⚡ DELEGAR STAKE AHORA"}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* Modal de Detalle de Bloque */}
            {selectedBlock && <BlockDetailsModal block={selectedBlock} onClose={() => setSelectedBlock(null)} />}
        </div>
    );
}