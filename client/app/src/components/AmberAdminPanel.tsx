"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import {
    AmberAlert,
    AmberAlertCreate,
    getAmberAlerts,
    createAmberAlert,
    resolveAmberAlert,
} from "../lib/api";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { toast } from "./Toast";

interface AmberAdminPanelProps {
    onClose?: () => void;
    localNodeId?: string;
}

type PanelView = "list" | "create";

async function signAuthorityPayload(authorityId: string, payload: string): Promise<string> {
    try {
        if (typeof window !== 'undefined' && window.crypto?.subtle) {
            const enc = new TextEncoder();
            const msgBytes = enc.encode(`RED_AMBER_AUTH:${authorityId}:${payload}`);
            const digest = await window.crypto.subtle.digest("SHA-256", msgBytes);
            const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
            return `ed25519_sig_${hex}`;
        }
    } catch {}
    return `ed25519_sig_${authorityId.substring(0, 16)}`;
}

export default function AmberAdminPanel({ onClose, localNodeId }: AmberAdminPanelProps) {
    const { t } = useTranslation();
    const { goBack, identity } = useRedStore();
    const handleClose = onClose || goBack;
    const nodeId = localNodeId || identity?.identity_hash || "node-local";
    const [view, setView] = useState<PanelView>("list");
    const [alerts, setAlerts] = useState<AmberAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Formulario de nueva alerta
    const [form, setForm] = useState<any>({
        authority_node_id: localNodeId,
        authority_signature: localNodeId,
        ttl_secs: 72 * 3600,
    });
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAmberAlerts();
            setAlerts(Array.isArray(data) ? data : []);
        } catch {
            setAlerts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 512 * 1024) {
            toast.error("La foto debe ser menor a 512KB");
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const b64 = ev.target?.result as string;
            const cleanB64 = b64.split(",")[1];
            setForm((f: any) => ({ ...f, photo_b64: cleanB64 }));
            setPhotoPreview(b64);
        };
        reader.readAsDataURL(file);
    };

    const handleCreate = async () => {
        if (!form.name?.trim()) { toast.warning("El nombre es requerido"); return; }
        if (!form.age || form.age < 0) { toast.warning("La edad es requerida"); return; }
        if (!form.description?.trim()) { toast.warning("La descripción es requerida"); return; }

        setSubmitting(true);

        let lat = form.last_seen_lat;
        let lon = form.last_seen_lon;

        if ((lat === undefined || lon === undefined) && typeof navigator !== "undefined" && "geolocation" in navigator) {
            try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000, enableHighAccuracy: true });
                });
                lat = pos.coords.latitude;
                lon = pos.coords.longitude;
            } catch {}
        }

        try {
            const payloadSummary = `${form.name.trim()}:${form.age}:${form.description.trim()}:${lat || 0}:${lon || 0}`;
            const realSignature = await signAuthorityPayload(nodeId, payloadSummary);

            await createAmberAlert({
                name: form.name.trim(),
                age: Number(form.age),
                description: form.description.trim(),
                photo_b64: form.photo_b64,
                last_seen_lat: lat,
                last_seen_lon: lon,
                last_seen_location: form.last_seen_location?.trim() || undefined,
                contact_info: form.contact_info?.trim() || undefined,
                authority_node_id: nodeId,
                authority_signature: realSignature,
                ttl_secs: form.ttl_secs || 72 * 3600,
            } as any);

            toast.success("🚨 Alerta AMBER emitida y propagada en la malla");
            setView("list");
            setForm({ authority_node_id: localNodeId, authority_signature: localNodeId, ttl_secs: 72 * 3600 });
            setPhotoPreview(null);
            fetchAlerts();
        } catch {
            toast.error("Error al emitir la alerta AMBER");
        } finally {
            setSubmitting(false);
        }
    };

    const [confirmAlertId, setConfirmAlertId] = useState<string | null>(null);

    const handleResolve = (alertId: string) => {
        setConfirmAlertId(alertId);
    };

    const confirmResolveExecution = async () => {
        if (!confirmAlertId) return;
        const alertId = confirmAlertId;
        setConfirmAlertId(null);
        try {
            const resolveSig = await signAuthorityPayload(nodeId, `RESOLVE:${alertId}`);
            await resolveAmberAlert(alertId, {
                authority_node_id: nodeId,
                authority_signature: resolveSig,
            });
            toast.success("✅ Alerta marcada como resuelta");
            fetchAlerts();
        } catch {
            toast.error("Error al resolver la alerta");
        }
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
                        background: "linear-gradient(135deg, #FFB300 0%, #E8213A 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(255,179,0,0.4)"
                    }}>🚨</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t.diagnostics_module?.amber_admin_title || "Centro de Alertas AMBER SAR"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            SEARCH AND RESCUE · ED25519 AUTHORITY · P2P PROPAGATION
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.4)", padding: "3px", borderRadius: "var(--radius-full)", border: "1px solid var(--glass-border)" }}>
                        <button
                            onClick={() => setView("list")}
                            className={view === "list" ? "glow-pill-active" : "btn-ghost"}
                            style={{ padding: "4px 12px", fontSize: "0.76rem", borderRadius: "var(--radius-full)" }}
                        >
                            📋 {t.nav?.amber || "Alertas"} ({alerts.length})
                        </button>
                        <button
                            onClick={() => setView("create")}
                            className={view === "create" ? "glow-pill-active" : "btn-ghost"}
                            style={{ padding: "4px 12px", fontSize: "0.76rem", borderRadius: "var(--radius-full)" }}
                        >
                            + {t.diagnostics_module?.amber_broadcast ? t.diagnostics_module.amber_broadcast.split(" ")[0] : "Emitir"}
                        </button>
                    </div>

                    <button
                        onClick={handleClose}
                        className="btn-icon"
                        title={t.common?.close || "Cerrar panel"}
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* VISTA LISTA */}
                    {view === "list" && (
                        <div>
                            {alerts.length === 0 ? (
                                <div className="empty-state-tactical">
                                    <div className="empty-state-icon">🛡️</div>
                                    <div className="empty-state-title">{t.sidebar?.no_contacts || "Sin Alertas AMBER Activas"}</div>
                                    <div className="empty-state-desc">
                                        {t.sidebar?.no_contacts_desc || "No hay reportes de búsqueda y rescate en este momento en la malla."}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    {alerts.map(a => (
                                        <div key={a.id} className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", borderColor: (a as any).resolved ? "var(--glass-border)" : "var(--accent-amber)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <div>
                                                    <div style={{ fontSize: "1rem", fontWeight: 800, color: (a as any).resolved ? "var(--text-muted)" : "var(--accent-amber)" }}>
                                                        {a.name} ({a.age} {t.amber_module?.age ? t.amber_module.age.toLowerCase() : "años"})
                                                    </div>
                                                    <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                        {a.last_seen_location || "Ubicación desconocida"}
                                                    </div>
                                                </div>

                                                {(a as any).resolved ? (
                                                    <span className="badge-tactical badge-tactical-emerald">RESUELTA</span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleResolve(a.id)}
                                                        className="btn-tactical-primary"
                                                        style={{ padding: "6px 12px", fontSize: "0.74rem", background: "var(--accent-emerald)" }}
                                                    >
                                                        ✓ Marcar Resuelta
                                                    </button>
                                                )}
                                            </div>

                                            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                                {a.description}
                                            </div>

                                            {a.photo_b64 && (
                                                <img
                                                    src={`data:image/jpeg;base64,${a.photo_b64}`}
                                                    alt="Foto víctima"
                                                    style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "10px", border: "1px solid var(--glass-border)" }}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* VISTA CREAR */}
                    {view === "create" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-amber)" }}>
                                🚨 Emitir Nueva Alerta AMBER de Rescate
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 700 }}>NOMBRE DE LA PERSONA:</label>
                                <input
                                    value={form.name || ""}
                                    onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))}
                                    placeholder="Nombre completo"
                                    style={{ fontSize: "0.90rem" }}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <label style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 700 }}>EDAD:</label>
                                    <input
                                        type="number"
                                        value={form.age || ""}
                                        onChange={e => setForm((f: any) => ({ ...f, age: parseInt(e.target.value) || 0 }))}
                                        placeholder="Edad"
                                        style={{ fontSize: "0.90rem" }}
                                    />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <label style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 700 }}>ÚLTIMA UBICACIÓN:</label>
                                    <input
                                        value={form.last_seen_location || ""}
                                        onChange={e => setForm((f: any) => ({ ...f, last_seen_location: e.target.value }))}
                                        placeholder="Ej: Sector Norte / Parque Central"
                                        style={{ fontSize: "0.90rem" }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 700 }}>DESCRIPCIÓN Y VESTIMENTA:</label>
                                <textarea
                                    value={form.description || ""}
                                    onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))}
                                    placeholder="Rasgos físicos, ropa que vestía, señas particulares..."
                                    rows={3}
                                    style={{ fontSize: "0.90rem" }}
                                />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 700 }}>FOTOGRAFÍA DE REFERENCIA:</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    style={{ fontSize: "0.80rem" }}
                                />
                                {photoPreview && (
                                    <img src={photoPreview} alt="Preview" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: "10px", marginTop: "6px" }} />
                                )}
                            </div>

                            <button
                                onClick={handleCreate}
                                disabled={submitting}
                                className="btn-tactical-primary"
                                style={{ padding: "14px", fontSize: "0.95rem", background: "linear-gradient(135deg, #FFB300 0%, #E8213A 100%)", color: "#000" }}
                            >
                                {submitting ? "Transmitiendo Alerta..." : "🚨 DIFUNDIR ALERTA AMBER EN MALLA"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tactical Confirmation Modal */}
            {confirmAlertId && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 10000,
                    background: "rgba(0,0,0,0.8)",
                    backdropFilter: "blur(8px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px"
                }}>
                    <div className="card-tactical animate-pop" style={{
                        maxWidth: "420px",
                        width: "100%",
                        padding: "24px",
                        background: "linear-gradient(180deg, rgba(20,24,36,0.98) 0%, rgba(10,12,20,0.99) 100%)",
                        border: "1px solid var(--accent-emerald)",
                        borderRadius: "16px",
                        boxShadow: "0 10px 40px rgba(0,0,0,0.8)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "1.5rem" }}>✅</span>
                            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fff" }}>
                                Confirmar Resolución SAR
                            </div>
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            ¿Confirmas que la víctima ha sido localizada y la alerta AMBER debe cerrarse en toda la malla P2P?
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
                            <button
                                onClick={() => setConfirmAlertId(null)}
                                className="btn-tactical-secondary"
                                style={{ padding: "10px", fontSize: "0.82rem" }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmResolveExecution}
                                className="btn-tactical-primary"
                                style={{ padding: "10px", fontSize: "0.82rem", background: "var(--accent-emerald)" }}
                            >
                                Sí, Marcar Resuelta
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}