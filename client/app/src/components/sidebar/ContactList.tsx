import React from "react";
import { useRedStore } from "../../store/useRedStore";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { avatarStyle } from "./types";
import { useTranslation } from "../../lib/i18n/i18nEngine";

interface ContactListProps {
    filteredContacts: any[];
    pendingContactRequests: any[];
    pendingCount: number;
    setActiveTab: (tab: "chats" | "contacts") => void;
    setAddContactOpen: (open: boolean) => void;
}

export const ContactList: React.FC<ContactListProps> = ({
    filteredContacts,
    pendingContactRequests,
    pendingCount,
    setActiveTab,
    setAddContactOpen,
}) => {
    const { t } = useTranslation();
    const { navigate, deleteContact, blockNode, acceptContactRequest, rejectContactRequest } = useRedStore();

    return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {/* Pending Contact Requests Section */}
                        {pendingCount > 0 && (
                            <div style={{
                                padding: "10px 14px",
                                background: "rgba(255,107,0,0.08)",
                                border: "1px solid rgba(255,107,0,0.25)",
                                borderRadius: 12,
                                display: "flex", flexDirection: "column", gap: 8,
                            }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#FF9E40", fontFamily: "JetBrains Mono, monospace", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF6B00", boxShadow: "0 0 6px #FF6B00", display: "inline-block", animation: "beaconPulse 1.5s infinite" }} />
                                    SOLICITUDES PENDIENTES ({pendingCount})
                                </div>
                                {pendingContactRequests.map(req => (
                                    <div key={req.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: "50%",
                                            background: "linear-gradient(135deg,#FF6B00,#E64A19)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: "0.9rem", fontWeight: 900, color: "#fff", flexShrink: 0
                                        }}>
                                            {(req.senderName || "?")[0].toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, overflow: "hidden" }}>
                                            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff" }}>{req.senderName}</div>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>{req.channel}</div>
                                        </div>
                                        <button onClick={() => acceptContactRequest(req)} title={t.common?.save || "Aceptar"} style={{ background: "rgba(0,200,83,0.15)", border: "1px solid rgba(0,200,83,0.4)", borderRadius: 8, color: "#00C853", cursor: "pointer", padding: "4px 8px", fontSize: "0.8rem" }}>✅</button>
                                        <button onClick={() => rejectContactRequest(req)} title={t.common?.cancel || "Rechazar"} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "var(--text-muted)", cursor: "pointer", padding: "4px 8px", fontSize: "0.8rem" }}>❌</button>
                                        <button onClick={() => blockNode(req.senderHash)} title="Bloquear" style={{ background: "rgba(245,0,87,0.08)", border: "1px solid rgba(245,0,87,0.25)", borderRadius: 8, color: "#FF5A7E", cursor: "pointer", padding: "4px 8px", fontSize: "0.8rem" }}>🚫</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => setAddContactOpen(true)}
                            className="btn-tactical-primary"
                            style={{
                                width: "100%", padding: "10px 12px", fontSize: "0.82rem", fontWeight: 800,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                borderRadius: "var(--radius-md)"
                            }}
                        >
                            <span>➕</span> {t.sidebar?.add_contact_btn || "AGREGAR NUEVO CONTACTO P2P"}
                        </button>
                        {filteredContacts.length === 0 ? (
                            <div className="empty-state-tactical">
                                <div className="empty-state-icon">👥</div>
                                <div className="empty-state-title">{t.sidebar?.no_contacts || "Sin Contactos Guardados"}</div>
                                <div className="empty-state-desc">{t.sidebar?.no_contacts_desc || "Agrega el DID o hash de un nodo para iniciar un chat cifrado E2E."}</div>
                            </div>
                        ) : (
                            filteredContacts.map(ct => {
                                const peerRecord = meshRouter.getPeerByAnyId(ct.identity_hash);
                                const isCtOnline = !!peerRecord;
                                return (
                                <div
                                    key={ct.identity_hash}
                                    className="card-tactical-interactive"
                                    style={{
                                        padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px",
                                        border: isCtOnline ? "1px solid rgba(0, 230, 118, 0.2)" : "1px solid var(--glass-border)"
                                    }}
                                >
                                    <div
                                        onClick={() => { setActiveTab("chats"); navigate("chat", ct.identity_hash); }}
                                        style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, cursor: "pointer" }}
                                    >
                                        <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
                                            <div style={{
                                                width: 44, height: 44, borderRadius: "50%",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: "1.1rem", fontWeight: 800, color: "#fff",
                                                ...avatarStyle(ct.identity_hash),
                                                boxShadow: isCtOnline ? "0 0 10px rgba(0, 230, 118, 0.4)" : undefined,
                                                border: isCtOnline ? "2px solid rgba(0, 230, 118, 0.7)" : "2px solid rgba(255,255,255,0.08)",
                                            }}>
                                                {(ct.display_name || "O").charAt(0).toUpperCase()}
                                            </div>
                                            {isCtOnline && (
                                                <span
                                                    title="En línea en la Malla"
                                                    style={{
                                                        position: "absolute", bottom: -1, right: -1,
                                                        width: 12, height: 12, borderRadius: "50%",
                                                        background: "#00E676",
                                                        border: "2px solid #06060c",
                                                        boxShadow: "0 0 6px #00E676",
                                                        animation: "beaconPulse 2s infinite"
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <div style={{ flex: 1, overflow: "hidden" }}>
                                            <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                                                <span>{ct.display_name || ct.identity_hash.substring(0, 8)}</span>
                                                {isCtOnline && (
                                                    <span style={{ fontSize: "0.55rem", padding: "1px 4px", borderRadius: "4px", background: "rgba(0, 230, 118, 0.15)", color: "#00E676", border: "1px solid rgba(0, 230, 118, 0.4)", fontFamily: "JetBrains Mono, monospace" }}>
                                                        MALLA
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                {ct.identity_hash.substring(0, 16)}…
                                            </div>
                                        </div>
                                    </div>
                                    {/* Delete & Block quick actions */}
                                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                        <button
                                            id={`btn-delete-contact-${ct.identity_hash.slice(0, 8)}`}
                                            title={t.common?.cancel || "Eliminar"}
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (confirm(`¿Eliminar a ${ct.display_name}?`)) {
                                                    await deleteContact(ct.identity_hash);
                                                }
                                            }}
                                            style={{
                                                width: 30, height: 30, borderRadius: 8,
                                                background: "rgba(245,0,87,0.08)",
                                                border: "1px solid rgba(245,0,87,0.2)",
                                                color: "#FF5A7E", cursor: "pointer",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: "0.82rem",
                                                transition: "background 0.15s",
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,0,87,0.18)")}
                                            onMouseLeave={e => (e.currentTarget.style.background = "rgba(245,0,87,0.08)")}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>

    );
};
