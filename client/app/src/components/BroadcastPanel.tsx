"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { toast } from "./Toast";
import { EmptyState } from "./ui/EmptyState";

export default function BroadcastPanel() {
    const { contacts: rawContacts, goBack } = useRedStore();
    const contacts = Array.isArray(rawContacts) ? rawContacts : [];
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
    const [successCount, setSuccessCount] = useState(0);

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

    const handleBroadcast = async () => {
        if (!message.trim()) {
            toast.warning("Escribe un mensaje para difundir");
            return;
        }
        if (selectedContacts.length === 0) {
            toast.warning("Selecciona al menos un destinatario");
            return;
        }

        setStatus("sending");
        let count = 0;
        for (const hash of selectedContacts) {
            try {
                await RedAPI.sendMessage(hash, message.trim());
                count++;
            } catch (e) {
                console.error("Broadcast failed for", hash, e);
            }
        }
        setSuccessCount(count);
        setStatus("done");
        toast.success(`Difusión enviada con éxito a ${count} nodos`);
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
                        background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(232,33,58,0.4)"
                    }}>📢</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Difusión Privada & Onion Routing
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-crimson-bright)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            MULTI-HOP GOSSIPSUB · REMITENTE OFUSCADO
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    className="btn-icon"
                    title="Cerrar panel"
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Paso 1: Selección de Destinatarios */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                1. DESTINATARIOS EN MALLA ({selectedContacts.length}/{contacts.length})
                            </div>
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
                                description="Añade pares mediante Radar P2P o escaneo de código QR para difundir mensajes." 
                                icon="📇" 
                            />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "200px", overflowY: "auto" }}>
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

                    {/* Paso 2: Mensaje de Difusión */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            2. MENSAJE TÁCTICO DE DIFUSIÓN
                        </div>

                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Escribe el mensaje o alerta que se enviará a todos los nodos seleccionados..."
                            rows={4}
                            style={{ fontSize: "0.90rem" }}
                        />

                        <button
                            onClick={handleBroadcast}
                            disabled={status === "sending" || !message.trim() || selectedContacts.length === 0}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "14px", fontSize: "0.95rem" }}
                        >
                            {status === "sending"
                                ? "Transmitiendo en Gossipsub Malla..."
                                : status === "done"
                                ? `✅ DIFUSIÓN COMPLETADA (${successCount} NODOS)`
                                : `🚀 DIFUNDIR A ${selectedContacts.length} DESTINATARIOS`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}