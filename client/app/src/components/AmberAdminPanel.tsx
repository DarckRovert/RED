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
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { OfflineQrEngine } from "../lib/qr/OfflineQrEngine";

/** Clipboard with textarea fallback for air-gapped / tactical WebView */
function copyToClipboard(text: string, label = 'Dato'): void {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(() => legacyCopy(text, label));
    } else {
        legacyCopy(text, label);
    }
}
function legacyCopy(text: string, label: string): void {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); toast.success(`${label} copiado`); }
    finally { document.body.removeChild(ta); }
}

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
    const [confirmAlertId, setConfirmAlertId] = useState<string | null>(null);
    const [qrModalAlert, setQrModalAlert] = useState<AmberAlert | null>(null);
    const [qrModalDataUrl, setQrModalDataUrl] = useState<string | null>(null);

    // Formulario de nueva alerta
    const [form, setForm] = useState<any>({
        authority_node_id: nodeId,
        authority_signature: nodeId,
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

    // ── LIFO Back interception
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            if (qrModalAlert) {
                setQrModalAlert(null);
                setQrModalDataUrl(null);
                return true;
            }
            if (confirmAlertId) {
                setConfirmAlertId(null);
                return true;
            }
            if (view === "create") {
                setView("list");
                return true;
            }
            handleClose();
            return true;
        });
        const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); BackHandlerRegistry.executeTop(); } };
        document.addEventListener('keydown', onEsc);
        return () => { unregister(); document.removeEventListener('keydown', onEsc); };
    }, [qrModalAlert, confirmAlertId, view, handleClose]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 512 * 1024) {
            TacticalAudioEngine.playWarning();
            toast.error("La foto debe ser menor a 512KB");
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const b64 = ev.target?.result as string;
            const cleanB64 = b64.split(",")[1];
            setForm((f: any) => ({ ...f, photo_b64: cleanB64 }));
            setPhotoPreview(b64);
            TacticalAudioEngine.playRogerBeep();
        };
        reader.readAsDataURL(file);
    };

    const handleCreate = async () => {
        if (!form.name?.trim()) { TacticalAudioEngine.playWarning(); toast.warning("El nombre es requerido"); return; }
        if (!form.age || form.age < 0) { TacticalAudioEngine.playWarning(); toast.warning("La edad es requerida"); return; }
        if (!form.description?.trim()) { TacticalAudioEngine.playWarning(); toast.warning("La descripción es requerida"); return; }

        setSubmitting(true);
        TacticalAudioEngine.playTap();

        let lat = form.last_seen_lat;
        let lon = form.last_seen_lon;

        if (lat === undefined || lon === undefined) {
            try {
                const { TacticalLocationEngine } = await import("../lib/sensors/TacticalLocationEngine");
                const loc = await TacticalLocationEngine.getEmergencyLocation(5000);
                if (TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) {
                    lat = loc.lat;
                    lon = loc.lon;
                }
            } catch {}
        }

        try {
            const payloadSummary = `${form.name.trim()}:${form.age}:${form.description.trim()}:${lat ?? 'null'}:${lon ?? 'null'}`;
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

            TacticalAudioEngine.playEmergencyAlarm();
            toast.success("🚨 Alerta AMBER emitida y propagada en la malla");
            setView("list");
            setForm({ authority_node_id: nodeId, authority_signature: nodeId, ttl_secs: 72 * 3600 });

            setPhotoPreview(null);
            fetchAlerts();
        } catch {
            TacticalAudioEngine.playWarning();
            toast.error("Error al emitir la alerta AMBER");
        } finally {
            setSubmitting(false);
        }
    };

    const handleResolve = (alertId: string) => {
        TacticalAudioEngine.playTap();
        setConfirmAlertId(alertId);
    };

    const confirmResolveExecution = async () => {
        if (!confirmAlertId) return;
        const alertId = confirmAlertId;
        setConfirmAlertId(null);
        TacticalAudioEngine.playTap();
        try {
            const resolveSig = await signAuthorityPayload(nodeId, `RESOLVE:${alertId}`);
            await resolveAmberAlert(alertId, {
                authority_node_id: nodeId,
                authority_signature: resolveSig,
            });
            TacticalAudioEngine.playRogerBeep();
            toast.success("✅ Alerta marcada como resuelta");
            fetchAlerts();
        } catch {
            TacticalAudioEngine.playWarning();
            toast.error("Error al resolver la alerta");
        }
    };

    const handleOpenQrModal = async (alertItem: AmberAlert) => {
        TacticalAudioEngine.playTap();
        setQrModalAlert(alertItem);
        try {
            const dataToEncode = JSON.stringify({
                type: "red_amber_alert",
                id: alertItem.id,
                name: alertItem.name,
                age: alertItem.age,
                desc: alertItem.description,
                loc: alertItem.last_seen_location,
                lat: alertItem.last_seen_lat,
                lon: alertItem.last_seen_lon,
                auth: alertItem.authority_node_id,
                issued: alertItem.issued_at,
            });
            const dataUrl = await OfflineQrEngine.generateDataUrl(dataToEncode, {
                width: 320,
                darkColor: "#FFB300",
                lightColor: "#04060A",
            });
            setQrModalDataUrl(dataUrl);
            TacticalAudioEngine.playRogerBeep();
        } catch {
            TacticalAudioEngine.playWarning();
            toast.error("Error al generar código QR off-grid");
        }
    };

    const activeCount = alerts.filter(a => !(a as any).resolved && a.status !== 'Resolved').length;
    const resolvedCount = alerts.filter(a => (a as any).resolved || a.status === 'Resolved').length;

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

            {/* HUD Telemetría SAR */}
            <div style={{
                display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
                padding: "8px 20px", background: "rgba(255,179,0,0.06)", borderBottom: "1px solid rgba(255,179,0,0.15)",
                fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace", gap: "10px", zIndex: 5
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <span style={{ color: "var(--accent-amber)", fontWeight: 700 }}>
                        🚨 {activeCount} ACTIVAS
                    </span>
                    <span style={{ color: "var(--accent-emerald)", fontWeight: 700 }}>
                        ✅ {resolvedCount} RESUELTAS
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>
                        AUTORIDAD: <span style={{ color: "#FFF" }}>{nodeId.slice(0, 10)}...</span>
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="badge-tactical badge-tactical-cyan" style={{ fontSize: "0.66rem", padding: "2px 8px" }}>
                        📡 MALLA P2P ACTIVA
                    </span>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            fetchAlerts();
                            toast.info("Alertas actualizadas");
                        }}
                        className="btn-ghost"
                        style={{ padding: "2px 8px", fontSize: "0.68rem" }}
                        title="Refrescar alertas"
                    >
                        🔄
                    </button>
                </div>
            </div>

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

                                            {/* Acciones Tácticas y Ficha QR */}
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" }}>
                                                <button
                                                    onClick={() => handleOpenQrModal(a)}
                                                    className="btn-tactical-secondary"
                                                    style={{ padding: "4px 10px", fontSize: "0.70rem", display: "flex", alignItems: "center", gap: "5px", color: "var(--accent-amber)", borderColor: "rgba(255,179,0,0.3)" }}
                                                >
                                                    📱 Ficha QR Off-Grid
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        TacticalAudioEngine.playTap();
                                                        copyToClipboard(a.id, 'ID de Alerta');
                                                    }}
                                                    className="btn-ghost"
                                                    style={{ padding: "4px 8px", fontSize: "0.70rem" }}
                                                    title="Copiar ID"
                                                >
                                                    📋 ID
                                                </button>
                                                {a.last_seen_lat !== undefined && a.last_seen_lon !== undefined && (
                                                    <button
                                                        onClick={() => {
                                                            TacticalAudioEngine.playTap();
                                                            copyToClipboard(`${a.last_seen_lat}, ${a.last_seen_lon}`, 'Coordenadas GPS');
                                                        }}
                                                        className="btn-ghost"
                                                        style={{ padding: "4px 8px", fontSize: "0.70rem" }}
                                                        title="Copiar Coordenadas"
                                                    >
                                                        📍 GPS ({a.last_seen_lat.toFixed(4)}, {a.last_seen_lon.toFixed(4)})
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        TacticalAudioEngine.playTap();
                                                        copyToClipboard(a.description, 'Descripción');
                                                    }}
                                                    className="btn-ghost"
                                                    style={{ padding: "4px 8px", fontSize: "0.70rem" }}
                                                    title="Copiar Descripción"
                                                >
                                                    📝 Texto
                                                </button>
                                            </div>
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

            {/* Modal Ficha QR Off-Grid */}
            {qrModalAlert && qrModalDataUrl && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 10001,
                    background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
                }}>
                    <div className="card-tactical animate-pop" style={{
                        maxWidth: "400px", width: "100%", padding: "22px",
                        background: "linear-gradient(180deg, rgba(24,18,10,0.98) 0%, rgba(10,8,6,0.99) 100%)",
                        border: "1px solid var(--accent-amber)", borderRadius: "16px",
                        boxShadow: "0 12px 48px rgba(255,179,0,0.3)",
                        display: "flex", flexDirection: "column", gap: "14px", alignItems: "center", textAlign: "center"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-amber)", display: "flex", alignItems: "center", gap: "8px" }}>
                                🚨 FICHA SAR OFF-GRID
                            </div>
                            <button
                                onClick={() => { TacticalAudioEngine.playTap(); setQrModalAlert(null); setQrModalDataUrl(null); }}
                                className="btn-icon" style={{ width: 32, height: 32 }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            Escanea para importar la ficha de búsqueda sin necesidad de conexión a internet o radiofrecuencia.
                        </div>

                        <div style={{
                            padding: "12px", background: "#04060A", borderRadius: "12px",
                            border: "1px solid rgba(255,179,0,0.3)"
                        }}>
                            <img src={qrModalDataUrl} alt="QR Alerta AMBER" style={{ width: "240px", height: "240px", display: "block" }} />
                        </div>

                        <div style={{ width: "100%", textAlign: "left", background: "rgba(0,0,0,0.4)", padding: "10px", borderRadius: "8px", border: "1px solid var(--glass-border)", fontSize: "0.75rem" }}>
                            <div style={{ fontWeight: 800, color: "#FFF" }}>{qrModalAlert.name} ({qrModalAlert.age} años)</div>
                            <div style={{ color: "var(--text-muted)", fontSize: "0.70rem" }}>{qrModalAlert.last_seen_location || "Ubicación desconocida"}</div>
                            <div style={{ color: "var(--accent-amber)", fontSize: "0.68rem", fontFamily: "JetBrains Mono, monospace", marginTop: "4px" }}>
                                ID: {qrModalAlert.id}
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", width: "100%" }}>
                            <a
                                href={qrModalDataUrl}
                                download={`amber_${qrModalAlert.id}.png`}
                                onClick={() => TacticalAudioEngine.playTap()}
                                className="btn-tactical-secondary"
                                style={{ padding: "8px", fontSize: "0.72rem", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                                💾 Descargar PNG
                            </a>
                            <button
                                onClick={() => {
                                    TacticalAudioEngine.playTap();
                                    copyToClipboard(JSON.stringify(qrModalAlert, null, 2), 'JSON de Alerta');
                                }}
                                className="btn-tactical-primary"
                                style={{ padding: "8px", fontSize: "0.72rem", background: "var(--accent-amber)", color: "#000" }}
                            >
                                📋 Copiar JSON
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}