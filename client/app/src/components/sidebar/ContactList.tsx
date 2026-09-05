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
    const { 
        navigate, deleteContact, blockNode, 
        acceptContactRequest, rejectContactRequest, preferences 
    } = useRedStore();
    const isFamiliar = (preferences?.uiMode ?? 'familiar') === 'familiar';

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: isFamiliar ? "0px" : "8px" }}>
            {/* Pending Contact Requests Section */}
            {pendingCount > 0 && (
                <div style={{
                    padding: isFamiliar ? "12px 16px" : "10px 14px",
                    background: isFamiliar ? "#1F2C34" : "rgba(255,107,0,0.08)",
                    borderBottom: isFamiliar ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(255,107,0,0.25)",
                    borderRadius: isFamiliar ? "0px" : "12px",
                    display: "flex", flexDirection: "column", gap: 10,
                }}>
                    <div style={{
                        fontSize: "0.74rem", fontWeight: 700,
                        color: isFamiliar ? "#00A884" : "#FF9E40",
                        display: "flex", alignItems: "center", gap: 6
                    }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: isFamiliar ? "#00A884" : "#FF6B00",
                            display: "inline-block"
                        }} />
                        SOLICITUDES PENDIENTES ({pendingCount})
                    </div>
                    {pendingContactRequests.map(req => (
                        <div key={req.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: "50%",
                                background: isFamiliar ? "#00A884" : "linear-gradient(135deg,#FF6B00,#E64A19)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1rem", fontWeight: 700, color: "#fff", flexShrink: 0
                            }}>
                                {(req.senderName || "?")[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1, overflow: "hidden" }}>
                                <div style={{ fontSize: "0.90rem", fontWeight: 600, color: "#E9EDEF" }}>{req.senderName}</div>
                                <div style={{ fontSize: "0.70rem", color: "#8696A0" }}>{req.channel || "Enlace P2P"}</div>
                            </div>
                            <button
                                onClick={() => acceptContactRequest(req)}
                                title="Aceptar solicitud"
                                style={{
                                    background: isFamiliar ? "#00A884" : "rgba(0,200,83,0.15)",
                                    border: "none", borderRadius: "50%", width: 32, height: 32,
                                    color: "#FFFFFF", cursor: "pointer", display: "flex",
                                    alignItems: "center", justifyContent: "center", fontSize: "0.85rem"
                                }}
                            >
                                ✓
                            </button>
                            <button
                                onClick={() => rejectContactRequest(req)}
                                title="Rechazar solicitud"
                                style={{
                                    background: isFamiliar ? "#2A3942" : "rgba(255,255,255,0.05)",
                                    border: "none", borderRadius: "50%", width: 32, height: 32,
                                    color: "#8696A0", cursor: "pointer", display: "flex",
                                    alignItems: "center", justifyContent: "center", fontSize: "0.85rem"
                                }}
                            >
                                ✕
                            </button>
                            <button
                                onClick={() => blockNode(req.senderHash)}
                                title="Bloquear nodo"
                                style={{
                                    background: "transparent",
                                    border: "none", width: 32, height: 32,
                                    color: "#FF5A7E", cursor: "pointer", display: "flex",
                                    alignItems: "center", justifyContent: "center", fontSize: "0.85rem"
                                }}
                            >
                                🚫
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Quick Action: New Contact */}
            {isFamiliar ? (
                <div
                    onClick={() => setAddContactOpen(true)}
                    style={{
                        display: "flex", alignItems: "center", gap: "14px",
                        padding: "14px 16px", cursor: "pointer",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        transition: "background 0.15s ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#202C33"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                    <div style={{
                        width: 44, height: 44, borderRadius: "50%",
                        background: "#00A884", color: "#FFFFFF",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.2rem", flexShrink: 0
                    }}>
                        👤+
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#E9EDEF" }}>
                        Nuevo contacto
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setAddContactOpen(true)}
                    className="btn-tactical-primary"
                    style={{
                        width: "100%", padding: "10px 12px", fontSize: "0.82rem", fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        borderRadius: "var(--radius-md)"
                    }}
                >
                    <span>➕</span> {t('sidebar.add_contact_btn') || "AGREGAR NUEVO CONTACTO P2P"}
                </button>
            )}

            {filteredContacts.length === 0 ? (
                isFamiliar ? (
                    <div className="animate-fade-scale" style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        padding: "48px 24px", textAlign: "center", color: "#8696A0"
                    }}>
                        <div style={{
                            width: "60px", height: "60px", borderRadius: "50%",
                            background: "rgba(0, 168, 132, 0.1)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.6rem", marginBottom: "16px", color: "#00A884"
                        }}>
                            👥
                        </div>
                        <div style={{ fontSize: "1rem", fontWeight: 600, color: "#E9EDEF", marginBottom: "6px" }}>
                            Sin contactos guardados
                        </div>
                        <div style={{ fontSize: "0.82rem", lineHeight: 1.4, color: "#8696A0", maxWidth: "260px" }}>
                            Agrega el DID o escanea el código QR de un dispositivo para iniciar un chat privado.
                        </div>
                    </div>
                ) : (
                    <div className="empty-state-tactical animate-fade-scale">
                        <div className="empty-state-icon">👥</div>
                        <div className="empty-state-title">{t('sidebar.no_contacts') || "Sin Contactos Guardados"}</div>
                        <div className="empty-state-desc">{t('sidebar.no_contacts_desc') || "Agrega el DID o hash de un nodo para iniciar un chat cifrado E2E."}</div>
                    </div>
                )
            ) : (
                filteredContacts.map((ct, idx) => {
                    const peerRecord = meshRouter.getPeerByAnyId(ct.identity_hash);
                    const isCtOnline = Boolean(peerRecord);
                    const isVerified = Boolean(ct.is_verified || ct.verified);
                    const animDelay = `${Math.min(idx * 30, 300)}ms`;

                    if (isFamiliar) {
                        return (
                            <div
                                key={ct.identity_hash}
                                className="contact-item-enter"
                                onClick={() => { setActiveTab("chats"); navigate("chat", ct.identity_hash); }}
                                style={{
                                    display: "flex", alignItems: "center", gap: "14px",
                                    padding: "12px 16px", cursor: "pointer",
                                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                                    transition: "background 0.15s ease",
                                    animationDelay: animDelay,
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = "#202C33"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                                <div style={{ position: "relative", width: 46, height: 46, flexShrink: 0 }}>
                                    <div style={{
                                        width: 46, height: 46, borderRadius: "50%",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "1.1rem", fontWeight: 700, color: "#fff",
                                        ...avatarStyle(ct.identity_hash),
                                    }}>
                                        {(ct.display_name || "O").charAt(0).toUpperCase()}
                                    </div>
                                    {isCtOnline && (
                                        <span
                                            className="online-dot"
                                            title="En línea en la Malla"
                                        />
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#E9EDEF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {ct.display_name || ct.identity_hash.substring(0, 8)}
                                        </span>
                                        {isVerified && (
                                            <span title="Identidad Verificada" style={{ display: "inline-flex", alignItems: "center", color: "#00A884", flexShrink: 0 }}>
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                                                </svg>
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: "0.78rem", color: isCtOnline ? "#00A884" : "#8696A0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {isCtOnline ? "En línea • Enlace Malla" : `${ct.identity_hash.substring(0, 16)}…`}
                                    </div>
                                </div>
                                <button
                                    id={`btn-delete-contact-${ct.identity_hash.slice(0, 8)}`}
                                    title="Eliminar contacto"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirm(`¿Eliminar a ${ct.display_name}?`)) {
                                            await deleteContact(ct.identity_hash);
                                        }
                                    }}
                                    style={{
                                        width: 32, height: 32, borderRadius: "50%",
                                        background: "transparent", border: "none",
                                        color: "#8696A0", cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "0.9rem", transition: "background 0.15s, color 0.15s"
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = "rgba(255, 51, 85, 0.15)";
                                        e.currentTarget.style.color = "#FF3355";
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = "transparent";
                                        e.currentTarget.style.color = "#8696A0";
                                    }}
                                >
                                    🗑️
                                </button>
                            </div>
                        );
                    }

                    // Modo Táctico
                    return (
                        <div
                            key={ct.identity_hash}
                            className="card-tactical-interactive contact-item-enter"
                            style={{
                                padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px",
                                border: isCtOnline ? "1px solid rgba(0, 230, 118, 0.25)" : "1px solid var(--glass-border)",
                                animationDelay: animDelay,
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
                                        boxShadow: isCtOnline ? "0 0 12px rgba(0, 230, 118, 0.45)" : undefined,
                                        border: isCtOnline ? "2px solid rgba(0, 230, 118, 0.7)" : "2px solid rgba(255,255,255,0.08)",
                                    }}>
                                        {(ct.display_name || "O").charAt(0).toUpperCase()}
                                    </div>
                                    {isCtOnline && (
                                        <span
                                            className="online-dot online-dot--tactical"
                                            title="En línea en la Malla"
                                        />
                                    )}
                                </div>
                                <div style={{ flex: 1, overflow: "hidden" }}>
                                    <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {ct.display_name || ct.identity_hash.substring(0, 8)}
                                        </span>
                                        {isVerified && (
                                            <span title="Identidad Verificada" style={{ display: "inline-flex", alignItems: "center", color: "var(--accent-emerald, #00E676)" }}>
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                                                </svg>
                                            </span>
                                        )}
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
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                <button
                                    id={`btn-delete-contact-${ct.identity_hash.slice(0, 8)}`}
                                    title="Eliminar"
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
