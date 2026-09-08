"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { toast } from "./Toast";
import { EmptyState } from "./ui/EmptyState";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";

type CoverageMode = "wildcard" | "selective";
type PriorityLevel = "normal" | "high" | "urgent";

interface TacticalTemplate {
    icon: string;
    title: string;
    text: string;
    priority: PriorityLevel;
}

const TEMPLATES: TacticalTemplate[] = [
    {
        icon: "🚨",
        title: "Evacuación",
        text: "¡ALERTA EVACUACIÓN! Proceder al punto de extracción designado de inmediato.",
        priority: "urgent"
    },
    {
        icon: "🛡️",
        title: "SITREP Seguro",
        text: "SITREP: Posición táctica asegurada. Mantener estricto silencio de radio.",
        priority: "normal"
    },
    {
        icon: "📍",
        title: "Solicitud Apoyo",
        text: "SOLICITUD DE APOYO: Se requiere asistencia técnica y logística en coordenadas de enlace.",
        priority: "high"
    },
    {
        icon: "⚠️",
        title: "Alerta RF",
        text: "ADVERTENCIA RF: Ruido o intento de interferencia detectado en canales locales de radio.",
        priority: "high"
    }
];

export default function BroadcastPanel() {
    const { contacts: rawContacts, goBack, identity } = useRedStore();
    const { t } = useTranslation();
    const contacts = Array.isArray(rawContacts) ? rawContacts : [];

    const [coverageMode, setCoverageMode] = useState<CoverageMode>("wildcard");
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [priority, setPriority] = useState<PriorityLevel>("normal");
    const [obfuscated, setObfuscated] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
    const [successCount, setSuccessCount] = useState(0);
    const [peerCount, setPeerCount] = useState(0);

    // ─── 1. Interceptor de Hardware Android (BackHandlerRegistry) ─────────────
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            goBack();
            return true;
        });
        return unregister;
    }, [goBack]);

    // ─── 2. Telemetría Reactiva de Nodos en Malla ─────────────────────────────
    useEffect(() => {
        let isMounted = true;
        const updatePeers = async () => {
            try {
                const { meshRouter } = await import("../lib/mesh/meshRouter");
                if (isMounted) {
                    setPeerCount(meshRouter.getAllPeers().length);
                }
            } catch {}
        };
        updatePeers();
        const interval = setInterval(updatePeers, 2500);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // ─── 3. Gestión de Selección de Nodos ─────────────────────────────────────
    const toggleContact = (hash: string) => {
        setSelectedContacts(prev =>
            prev.includes(hash) ? prev.filter(c => c !== hash) : [...prev, hash]
        );
    };

    const selectAll = () => {
        if (selectedContacts.length === contacts.length) {
            setSelectedContacts([]);
        } else {
            setSelectedContacts(contacts.map(c => c.identity_hash));
        }
    };

    // ─── 4. Emisión Concurrente y Blindada ─────────────────────────────────────
    const handleBroadcast = async () => {
        const textToSend = message.trim();
        if (!textToSend) {
            toast.warning("Escribe un mensaje táctico para difundir");
            return;
        }

        if (coverageMode === "selective" && selectedContacts.length === 0) {
            toast.warning("Selecciona al menos un nodo destinatario");
            return;
        }

        setStatus("sending");

        const isUrgent = priority === "urgent";
        const msgType = isUrgent ? "broadcast_alert" : "broadcast";
        const senderName = obfuscated ? "Operador Malla (Ofuscado)" : (identity?.nickname || "Operador RED");

        const options: any = {
            msg_type: msgType,
            priority,
            sender_name: senderName,
            ...(obfuscated ? { avatar_url: "", sender_pk: "" } : {})
        };

        if (coverageMode === "wildcard") {
            // Emisión total a toda la malla física por wildcard universal
            try {
                await RedAPI.sendMessage("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", textToSend, options);
                setSuccessCount(Math.max(1, peerCount));
                setStatus("done");
                toast.success(`Difusión general irradiada a toda la malla (${Math.max(1, peerCount)} nodos en alcance)`);
                setTimeout(() => goBack(), 2000);
            } catch (err) {
                console.error("Wildcard broadcast failed:", err);
                toast.error("Fallo al radiodifundir a la malla");
                setStatus("idle");
            }
            return;
        }

        // Modo Multicast Selectivo por lotes paralelos
        let count = 0;
        const targets = [...selectedContacts];
        const BATCH_SIZE = 4;

        for (let i = 0; i < targets.length; i += BATCH_SIZE) {
            const batch = targets.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map(hash => RedAPI.sendMessage(hash, textToSend, options))
            );
            count += results.filter(r => r.status === "fulfilled").length;
        }

        setSuccessCount(count);
        setStatus("done");
        toast.success(`Difusión selectiva completada (${count}/${selectedContacts.length} nodos confirmados)`);
        setTimeout(() => goBack(), 2000);
    };

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
                        background: priority === "urgent"
                            ? "linear-gradient(135deg, #FF1744 0%, #D50000 100%)"
                            : "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem",
                        boxShadow: priority === "urgent" ? "0 0 20px rgba(255,23,68,0.6)" : "0 4px 16px rgba(232,33,58,0.4)"
                    }}>
                        📢
                    </div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{t.modules?.broadcast || "Difusión Táctica de Emergencia"}</span>
                            <span style={{
                                fontSize: "0.65rem", padding: "2px 8px", borderRadius: "10px",
                                background: peerCount > 0 ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 179, 0, 0.2)",
                                color: peerCount > 0 ? "var(--accent-emerald)" : "var(--accent-amber)",
                                border: `1px solid ${peerCount > 0 ? "var(--accent-emerald)" : "var(--accent-amber)"}`,
                                fontWeight: 800
                            }}>
                                {peerCount > 0 ? `🟢 ${peerCount} EN ALCANCE` : "🟡 MODO LOCAL"}
                            </span>
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-crimson-bright)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            GOSSIPSUB MULTICAST · EMISIÓN PRIORITARIA SOBRE MALLA
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    className="btn-icon"
                    title={t.common?.close || "Cerrar panel"}
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Paso 1: Modo de Cobertura y Alcance */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", justifyContent: "space-between" }}>
                            <span>1. ALCANCE DE TRANSMISIÓN</span>
                            <span style={{ fontSize: "0.72rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                {coverageMode === "wildcard" ? "RF WILDCARD TOTAL" : "MULTICAST SELECTIVO"}
                            </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            <button
                                onClick={() => setCoverageMode("wildcard")}
                                className={coverageMode === "wildcard" ? "glow-pill-active" : "btn-tactical-secondary"}
                                style={{ padding: "12px 10px", textAlign: "left", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "4px" }}
                            >
                                <div style={{ fontSize: "0.88rem", fontWeight: 800 }}>🌐 Toda la Malla RF</div>
                                <div style={{ fontSize: "0.68rem", opacity: 0.8 }}>Emisión total a todos los nodos en alcance de radio</div>
                            </button>

                            <button
                                onClick={() => setCoverageMode("selective")}
                                className={coverageMode === "selective" ? "glow-pill-active" : "btn-tactical-secondary"}
                                style={{ padding: "12px 10px", textAlign: "left", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "4px" }}
                            >
                                <div style={{ fontSize: "0.88rem", fontWeight: 800 }}>👥 Nodos Seleccionados</div>
                                <div style={{ fontSize: "0.68rem", opacity: 0.8 }}>Multicast selectivo a contactos de tu libreta</div>
                            </button>
                        </div>

                        {coverageMode === "wildcard" ? (
                            <div style={{
                                padding: "10px 14px", borderRadius: "10px",
                                background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.3)",
                                fontSize: "0.76rem", color: "var(--accent-cyan)", lineHeight: 1.4
                            }}>
                                📡 <strong>Emisión Wildcard:</strong> El comunicado será recibido por cualquier dispositivo RED o transceptor LoRa/BLE en rango físico, sin importar si está registrado en tus contactos.
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                                        Destinatarios seleccionados: ({selectedContacts.length}/{contacts.length})
                                    </span>
                                    {contacts.length > 0 && (
                                        <button
                                            onClick={selectAll}
                                            className="btn-tactical-secondary"
                                            style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                                        >
                                            {selectedContacts.length === contacts.length ? "Deseleccionar" : "Seleccionar Todos"}
                                        </button>
                                    )}
                                </div>

                                {contacts.length === 0 ? (
                                    <EmptyState 
                                        title="Sin Contactos Guardados" 
                                        description="Usa el modo 'Toda la Malla RF' para transmitir a los nodos cercanos sin requerir contactos." 
                                        icon="📇" 
                                    />
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto" }}>
                                        {contacts.map(c => {
                                            const selected = selectedContacts.includes(c.identity_hash);
                                            return (
                                                <div
                                                    key={c.identity_hash}
                                                    onClick={() => toggleContact(c.identity_hash)}
                                                    className="card-tactical-interactive"
                                                    style={{
                                                        padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                                                        background: selected ? "rgba(255,51,85,0.08)" : "rgba(255,255,255,0.02)",
                                                        borderColor: selected ? "var(--accent-crimson)" : "var(--glass-border)"
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: selected ? "#fff" : "var(--text-primary)" }}>
                                                            {c.display_name}
                                                        </div>
                                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                            {c.identity_hash.substring(0, 16)}…
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        width: 22, height: 22, borderRadius: "50%",
                                                        background: selected ? "var(--accent-crimson)" : "rgba(255,255,255,0.1)",
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        color: "#fff", fontSize: "0.75rem", fontWeight: 900
                                                    }}>
                                                        {selected ? "✓" : "+"}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Paso 2: Prioridad y Modo Sigilo */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            2. PRIORIDAD TÁCTICA Y SEGURIDAD
                        </div>

                        {/* Selector de Prioridad */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                            <button
                                onClick={() => setPriority("normal")}
                                className={priority === "normal" ? "glow-pill-active" : "btn-tactical-secondary"}
                                style={{ padding: "8px", fontSize: "0.75rem", borderRadius: "8px", fontWeight: 700 }}
                            >
                                🔵 Normal / SITREP
                            </button>
                            <button
                                onClick={() => setPriority("high")}
                                className={priority === "high" ? "glow-pill-active" : "btn-tactical-secondary"}
                                style={{ padding: "8px", fontSize: "0.75rem", borderRadius: "8px", fontWeight: 700, borderColor: priority === "high" ? "var(--accent-amber)" : undefined }}
                            >
                                🟡 Operativo
                            </button>
                            <button
                                onClick={() => setPriority("urgent")}
                                className={priority === "urgent" ? "glow-pill-active" : "btn-tactical-secondary"}
                                style={{ padding: "8px", fontSize: "0.75rem", borderRadius: "8px", fontWeight: 700, borderColor: priority === "urgent" ? "var(--accent-crimson)" : undefined }}
                            >
                                🔴 Alerta Crítica
                            </button>
                        </div>

                        {/* Conmutador Modo Sigilo */}
                        <div
                            onClick={() => setObfuscated(o => !o)}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "10px 14px", borderRadius: "10px", cursor: "pointer",
                                background: obfuscated ? "rgba(217, 70, 239, 0.12)" : "rgba(255,255,255,0.02)",
                                border: `1px solid ${obfuscated ? "var(--accent-purple, #D946EF)" : "var(--glass-border)"}`,
                                transition: "all 0.2s ease"
                            }}
                        >
                            <div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: obfuscated ? "#fff" : "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>🔒 Modo Sigilo (Remitente Ofuscado)</span>
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                    Oculta tu nickname y clave pública para proteger la posición del emisor
                                </div>
                            </div>
                            <div style={{
                                width: 40, height: 22, borderRadius: "12px",
                                background: obfuscated ? "var(--accent-purple, #D946EF)" : "rgba(255,255,255,0.1)",
                                position: "relative", transition: "background 0.2s ease"
                            }}>
                                <div style={{
                                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                                    position: "absolute", top: 2, left: obfuscated ? 20 : 2,
                                    transition: "left 0.2s ease"
                                }} />
                            </div>
                        </div>
                    </div>

                    {/* Paso 3: Mensaje y Plantillas Rápidas */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                3. MENSAJE DE DIFUSIÓN
                            </div>
                            <span style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>
                                {message.length} caracteres
                            </span>
                        </div>

                        {/* Plantillas Tácticas 1-Toque */}
                        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
                            {TEMPLATES.map((tmpl, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setMessage(tmpl.text);
                                        setPriority(tmpl.priority);
                                    }}
                                    className="btn-tactical-secondary"
                                    style={{
                                        padding: "6px 10px", fontSize: "0.72rem",
                                        display: "flex", alignItems: "center", gap: "4px", flexShrink: 0,
                                        borderRadius: "8px"
                                    }}
                                >
                                    <span>{tmpl.icon}</span>
                                    <span>{tmpl.title}</span>
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Escribe el mensaje táctico, orden de operaciones o alerta de emergencia que se difundirá..."
                            rows={4}
                            style={{
                                fontSize: "0.90rem",
                                borderColor: priority === "urgent" ? "rgba(255,23,68,0.5)" : undefined
                            }}
                        />

                        <button
                            onClick={handleBroadcast}
                            disabled={status === "sending" || !message.trim() || (coverageMode === "selective" && selectedContacts.length === 0)}
                            className="btn-tactical-primary"
                            style={{
                                width: "100%", padding: "14px", fontSize: "0.95rem",
                                background: priority === "urgent"
                                    ? "linear-gradient(135deg, #FF1744 0%, #D50000 100%)"
                                    : undefined,
                                boxShadow: priority === "urgent" ? "0 4px 20px rgba(255,23,68,0.5)" : undefined
                            }}
                        >
                            {status === "sending"
                                ? "Transmitiendo por Malla RF..."
                                : status === "done"
                                ? `✅ DIFUSIÓN COMPLETADA (${successCount} NODOS)`
                                : coverageMode === "wildcard"
                                ? `🚀 DIFUNDIR A TODA LA MALLA (RF WILDCARD)`
                                : `🚀 DIFUNDIR A ${selectedContacts.length} DESTINATARIOS`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}