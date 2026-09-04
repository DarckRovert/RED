"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRedStore } from "../../store/useRedStore";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { toast } from "../Toast";
import { avatarStyle } from "../sidebar/types";
import { OfflineQrEngine } from "../../lib/qr/OfflineQrEngine";

interface NewChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * NewChatModal — Authentic WhatsApp-Style "New Chat" Screen
 * 
 * Replaces cumbersome manual DID hash forms with a pristine, visual WhatsApp experience:
 * - Quick Actions: "New Group", "Scan QR Code", "My QR Code", "Link Web"
 * - Discovered Nearby Nodes (BLE / WiFi / LAN) in physical radio range
 * - Alphabetical contacts list with instant search
 * - Collapsible manual input for advanced operators
 */
export const NewChatModal: React.FC<NewChatModalProps> = ({ isOpen, onClose }) => {
    const { contacts, identity, navigate, addContact } = useRedStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [showMyQr, setShowMyQr] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState<string>("");
    const [manualOpen, setManualOpen] = useState(false);
    const [manualInput, setManualInput] = useState("");
    const [manualAlias, setManualAlias] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (showMyQr && identity?.identity_hash) {
            OfflineQrEngine.generateDataUrl(`did:red:${identity.identity_hash}`, {
                width: 200,
                darkColor: "#000000",
                lightColor: "#FFFFFF"
            }).then(setQrDataUrl).catch(console.error);
        }
    }, [showMyQr, identity?.identity_hash]);

    // Nearby discovered peers in radio range
    const nearbyPeers = useMemo(() => {
        const list: Array<{ hash: string; name: string; transport?: string }> = [];
        const seen = new Set<string>();
        meshRouter.peers.forEach((peer, peerId) => {
            const clean = (meshRouter.getCanonicalId(peerId) || peerId).toLowerCase();
            if (clean && !seen.has(clean) && clean !== (identity?.identity_hash || "").toLowerCase()) {
                seen.add(clean);
                list.push({
                    hash: clean,
                    name: peer.name || `Nodo ${clean.substring(0, 8)}`,
                    transport: (peer as any).transport || "Mesh P2P"
                });
            }
        });
        return list;
    }, [identity]);

    // Contacts filtered by search
    const filteredContacts = useMemo(() => {
        const list = Array.isArray(contacts) ? contacts : [];
        if (!searchQuery.trim()) {
            return [...list].sort((a, b) => (a.display_name || a.name || "").localeCompare(b.display_name || b.name || ""));
        }
        const q = searchQuery.toLowerCase().trim();
        return list.filter(c => 
            (c.display_name || c.name || "").toLowerCase().includes(q) ||
            (c.identity_hash || "").toLowerCase().includes(q)
        ).sort((a, b) => (a.display_name || a.name || "").localeCompare(b.display_name || b.name || ""));
    }, [contacts, searchQuery]);

    if (!isOpen) return null;

    const handleSelectContact = (peerHash: string) => {
        onClose();
        navigate("chat", peerHash);
    };

    const handleManualSubmit = async () => {
        const input = manualInput.trim();
        const alias = manualAlias.trim();
        if (!input) return;

        // Detection of Web Companion pairing code
        if (input.startsWith("RED_PAIR:1:")) {
            onClose();
            navigate("webCompanionLink");
            return;
        }

        setIsSubmitting(true);
        try {
            const cleanHash = await addContact(input, alias);
            toast.success("✅ Contacto guardado. Abriendo chat...");
            onClose();
            const targetChat = (typeof cleanHash === "string" && cleanHash) ? cleanHash : input;
            navigate("chat", targetChat);
        } catch (err: any) {
            toast.error(`❌ Error: ${err?.message || err}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                animation: "fadeIn 0.15s ease-out"
            }}
            onClick={onClose}
        >
            <div
                className="animate-enter modal-card-scrollable"
                style={{
                    width: "100%",
                    maxWidth: "480px",
                    maxHeight: "calc(100dvh - 32px)",
                    backgroundColor: "#111B21",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "20px",
                    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.95), 0 0 30px rgba(0, 168, 132, 0.15)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden"
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header (WhatsApp Style) */}
                <div style={{
                    padding: "14px 18px",
                    backgroundColor: "#1F2C34",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                            width: "38px", height: "38px", borderRadius: "50%",
                            backgroundColor: "#00A884", color: "#FFFFFF",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.2rem", fontWeight: 900
                        }}>
                            💬
                        </div>
                        <div>
                            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#E9EDEF" }}>
                                Nuevo chat
                            </div>
                            <div style={{ fontSize: "0.74rem", color: "#8696A0" }}>
                                {contacts.length} {contacts.length === 1 ? "contacto" : "contactos"} guardados
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#8696A0",
                            fontSize: "1.3rem",
                            cursor: "pointer",
                            padding: "4px 8px"
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Search Bar */}
                <div style={{ padding: "10px 16px", backgroundColor: "#111B21", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        backgroundColor: "#202C33",
                        borderRadius: "10px",
                        padding: "8px 12px"
                    }}>
                        <span style={{ color: "#8696A0", fontSize: "0.95rem" }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar nombre o contacto..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                flex: 1,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                color: "#E9EDEF",
                                fontSize: "0.88rem"
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                style={{ background: "transparent", border: "none", color: "#8696A0", cursor: "pointer" }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Scrollable Body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
                    {/* Primary Action Buttons (WhatsApp Standard) */}
                    <div style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", paddingBottom: "6px" }}>
                        {/* 1. Nuevo Grupo */}
                        <div
                            onClick={() => { onClose(); navigate("groups"); }}
                            style={{
                                display: "flex", alignItems: "center", gap: "16px",
                                padding: "12px 20px", cursor: "pointer", transition: "background 0.15s"
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#202C33")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                            <div style={{
                                width: "42px", height: "42px", borderRadius: "50%",
                                backgroundColor: "#00A884", color: "#FFFFFF",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.2rem"
                            }}>
                                👥
                            </div>
                            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#E9EDEF" }}>
                                Nuevo grupo / escuadrón
                            </div>
                        </div>

                        {/* 2. Escanear Código QR */}
                        <div
                            onClick={() => { onClose(); navigate("radar"); }}
                            style={{
                                display: "flex", alignItems: "center", gap: "16px",
                                padding: "12px 20px", cursor: "pointer", transition: "background 0.15s"
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#202C33")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                            <div style={{
                                width: "42px", height: "42px", borderRadius: "50%",
                                backgroundColor: "#202C33", border: "1px solid rgba(255, 255, 255, 0.12)",
                                color: "#00A884", display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.2rem"
                            }}>
                                📷
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#E9EDEF" }}>
                                    Escanear código QR
                                </div>
                                <div style={{ fontSize: "0.74rem", color: "#8696A0" }}>
                                    Añadir contacto al instante con la cámara
                                </div>
                            </div>
                        </div>

                        {/* 3. Mi Código QR */}
                        <div
                            onClick={() => setShowMyQr(v => !v)}
                            style={{
                                display: "flex", alignItems: "center", gap: "16px",
                                padding: "12px 20px", cursor: "pointer", transition: "background 0.15s"
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#202C33")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                            <div style={{
                                width: "42px", height: "42px", borderRadius: "50%",
                                backgroundColor: "#202C33", border: "1px solid rgba(255, 255, 255, 0.12)",
                                color: "#53BDEB", display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.2rem"
                            }}>
                                🪪
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#E9EDEF" }}>
                                    Mi código QR
                                </div>
                                <div style={{ fontSize: "0.74rem", color: "#8696A0" }}>
                                    Mostrar para que otro dispositivo me escanee
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* My QR Popover / Expandable */}
                    {showMyQr && (
                        <div style={{
                            margin: "12px 20px", padding: "16px",
                            backgroundColor: "#1F2C34", borderRadius: "16px",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
                            animation: "fadeIn 0.2s ease"
                        }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#00A884" }}>
                                TU CÓDIGO QR DE CONTACTO P2P
                            </div>
                            <div style={{
                                backgroundColor: "#FFFFFF", padding: "12px", borderRadius: "12px",
                                minWidth: 194, minHeight: 194, display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                                {qrDataUrl ? (
                                    <img src={qrDataUrl} alt="QR de Identidad" style={{ width: 170, height: 170, display: "block" }} />
                                ) : (
                                    <div style={{ color: "#666", fontSize: "0.78rem" }}>Generando QR...</div>
                                )}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#8696A0", textAlign: "center", wordBreak: "break-all" }}>
                                {identity?.nickname || "Mi Identidad"} • {identity?.identity_hash?.substring(0, 16)}…
                            </div>
                        </div>
                    )}

                    {/* Section: Discovered Nearby Radio Nodes */}
                    {nearbyPeers.length > 0 && (
                        <div style={{ padding: "14px 20px 6px 20px" }}>
                            <div style={{
                                fontSize: "0.72rem", fontWeight: 800, color: "#00A884",
                                letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "8px"
                            }}>
                                📡 DISPOSITIVOS CERCANOS EN RADIO FÍSICO
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                {nearbyPeers.map(p => (
                                    <div
                                        key={p.hash}
                                        onClick={() => handleSelectContact(p.hash)}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            padding: "10px 14px", backgroundColor: "#202C33", borderRadius: "12px",
                                            cursor: "pointer", border: "1px solid rgba(0, 168, 132, 0.25)"
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <span style={{ fontSize: "1.2rem" }}>📶</span>
                                            <div>
                                                <div style={{ fontSize: "0.90rem", fontWeight: 700, color: "#E9EDEF" }}>
                                                    {p.name}
                                                </div>
                                                <div style={{ fontSize: "0.70rem", color: "#00E676" }}>
                                                    ● En alcance ({p.transport})
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            style={{
                                                padding: "5px 12px", backgroundColor: "#00A884", border: "none",
                                                borderRadius: "14px", color: "#FFFFFF", fontSize: "0.74rem", fontWeight: 700,
                                                cursor: "pointer"
                                            }}
                                        >
                                            Chatear
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Section: Saved Contacts */}
                    <div style={{ padding: "14px 20px 6px 20px" }}>
                        <div style={{
                            fontSize: "0.72rem", fontWeight: 800, color: "#8696A0",
                            letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "6px"
                        }}>
                            CONTACTOS EN RED ({filteredContacts.length})
                        </div>

                        {filteredContacts.length === 0 ? (
                            <div style={{ padding: "20px 0", textAlign: "center", color: "#8696A0", fontSize: "0.85rem" }}>
                                {searchQuery ? "No se encontraron contactos para esta búsqueda" : "No tienes contactos guardados aún. Usa el escáner QR o detecta nodos cercanos."}
                            </div>
                        ) : (
                            filteredContacts.map(c => {
                                const name = c.display_name || c.name || "Contacto P2P";
                                return (
                                    <div
                                        key={c.identity_hash}
                                        onClick={() => handleSelectContact(c.identity_hash)}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "14px",
                                            padding: "10px 0", cursor: "pointer", borderBottom: "1px solid rgba(255, 255, 255, 0.04)"
                                        }}
                                    >
                                        <div style={{
                                            width: "40px", height: "40px", borderRadius: "50%",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: "0.95rem", fontWeight: 800, color: "#FFFFFF",
                                            flexShrink: 0, ...avatarStyle(c.identity_hash)
                                        }}>
                                            {name.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {name}
                                            </div>
                                            <div style={{ fontSize: "0.72rem", color: "#8696A0", fontFamily: "monospace" }}>
                                                {c.identity_hash.substring(0, 14)}…
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Section: Advanced Manual Entry (Collapsible) */}
                    <div style={{ padding: "10px 20px 20px 20px" }}>
                        <button
                            onClick={() => setManualOpen(v => !v)}
                            style={{
                                width: "100%", padding: "10px", backgroundColor: "transparent",
                                border: "1px dashed rgba(255, 255, 255, 0.15)", borderRadius: "10px",
                                color: "#8696A0", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600
                            }}
                        >
                            {manualOpen ? "▲ Ocultar entrada manual" : "▼ Ingresar DID o Clave Pública manualmente"}
                        </button>

                        {manualOpen && (
                            <div style={{
                                marginTop: "10px", padding: "14px", backgroundColor: "#1F2C34",
                                borderRadius: "12px", display: "flex", flexDirection: "column", gap: "10px"
                            }}>
                                <input
                                    type="text"
                                    placeholder="DID Soberano o Hash (64 caracteres)..."
                                    value={manualInput}
                                    onChange={e => setManualInput(e.target.value)}
                                    style={{
                                        padding: "9px 12px", backgroundColor: "#111B21", border: "1px solid rgba(255, 255, 255, 0.1)",
                                        borderRadius: "8px", color: "#FFFFFF", fontSize: "0.82rem", outline: "none",
                                        fontFamily: "monospace"
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="Alias o nombre del contacto (opcional)..."
                                    value={manualAlias}
                                    onChange={e => setManualAlias(e.target.value)}
                                    style={{
                                        padding: "9px 12px", backgroundColor: "#111B21", border: "1px solid rgba(255, 255, 255, 0.1)",
                                        borderRadius: "8px", color: "#FFFFFF", fontSize: "0.82rem", outline: "none"
                                    }}
                                />
                                <button
                                    onClick={handleManualSubmit}
                                    disabled={!manualInput.trim() || isSubmitting}
                                    style={{
                                        padding: "10px", backgroundColor: "#00A884", border: "none",
                                        borderRadius: "8px", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 700,
                                        cursor: "pointer", opacity: manualInput.trim() ? 1 : 0.5
                                    }}
                                >
                                    {isSubmitting ? "Conectando..." : "Iniciar Chat P2P"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewChatModal;
