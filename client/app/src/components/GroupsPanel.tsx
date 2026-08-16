"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { GroupAdminModal } from "./GroupAdminModal";
import { toast } from "./Toast";

export default function GroupsPanel() {
    const { contacts: rawContacts, groups: rawGroups, goBack, navigate, fetchData } = useRedStore();
    const contacts = Array.isArray(rawContacts) ? rawContacts : [];
    const groups = Array.isArray(rawGroups) ? rawGroups : [];
    const [groupName, setGroupName] = useState("");
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [creationStatus, setCreationStatus] = useState("");
    const [adminGroup, setAdminGroup] = useState<any | null>(null);

    const toggleContact = (hash: string) => {
        if (selectedContacts.includes(hash)) {
            setSelectedContacts(selectedContacts.filter(c => c !== hash));
        } else {
            setSelectedContacts([...selectedContacts, hash]);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            toast.warning("Ingresa el nombre del escuadrón o grupo");
            return;
        }
        if (selectedContacts.length === 0) {
            toast.warning("Selecciona al menos un miembro para el grupo");
            return;
        }

        setCreationStatus("Sincronizando llaves compartidas (SenderKey)...");
        try {
            await RedAPI.req("/groups", {
                method: "POST",
                body: JSON.stringify({ name: groupName.trim(), members: selectedContacts })
            });
            setCreationStatus("Grupo federado con éxito.");
            toast.success(`Escuadrón ${groupName} creado con éxito`);
            await fetchData();
            setTimeout(() => goBack(), 1200);
        } catch (e) {
            console.error("Group creation failed natively", e);
            setCreationStatus("Error al crear el grupo.");
            toast.error("Error al federar contrato de grupo");
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
                        background: "linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(124,77,255,0.4)"
                    }}>👥</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Escuadrones & Canales P2P
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-purple, #B388FF)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            SIGNAL SENDERKEY · CIFRADO MULTI-PAR
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

                    {/* Creador de Nuevo Grupo */}
                    <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            ⚡ CREAR NUEVO ESCUADRÓN CIFRADO
                        </div>

                        <input
                            type="text"
                            placeholder="Nombre del Escuadrón (Ej: Brigada Alfa, Rescate Norte)..."
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            style={{ fontSize: "0.92rem" }}
                        />

                        <div>
                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "8px" }}>
                                AÑADIR MIEMBROS ({selectedContacts.length}/{contacts.length})
                            </div>

                            {contacts.length === 0 ? (
                                <div className="empty-state-tactical" style={{ padding: "16px" }}>
                                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                                        No hay contactos disponibles. Añade pares desde Radar P2P.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
                                    {contacts.map(c => {
                                        const selected = selectedContacts.includes(c.identity_hash);
                                        return (
                                            <div
                                                key={c.identity_hash}
                                                onClick={() => toggleContact(c.identity_hash)}
                                                className="card-tactical-interactive"
                                                style={{
                                                    padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                                                    background: selected ? "rgba(124,77,255,0.12)" : "rgba(255,255,255,0.02)",
                                                    borderColor: selected ? "rgba(124,77,255,0.5)" : "var(--glass-border)"
                                                }}
                                            >
                                                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: selected ? "#fff" : "var(--text-primary)" }}>{c.display_name}</span>
                                                <span style={{ color: selected ? "#B388FF" : "var(--text-muted)", fontWeight: 900, fontSize: "0.85rem" }}>
                                                    {selected ? "✓" : "+"}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleCreateGroup}
                            disabled={!groupName.trim() || selectedContacts.length === 0}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "14px", fontSize: "0.95rem", background: "linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)" }}
                        >
                            {creationStatus || "FEDERAR CONTRATO DE GRUPO"}
                        </button>
                    </div>

                    {/* Lista de Grupos Activos */}
                    <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            GRUPOS & ESCUADRONES ACTIVOS ({groups.length})
                        </div>

                        {groups.length === 0 ? (
                            <div className="empty-state-tactical">
                                <div className="empty-state-icon">👥</div>
                                <div className="empty-state-title">Sin Grupos Federados</div>
                                <div className="empty-state-desc">
                                    Crea un escuadrón con tus contactos para chatear en canales multi-par cifrados.
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {groups.map((g: any) => (
                                    <div
                                        key={g.id}
                                        onClick={() => navigate("chat", g.id)}
                                        className="card-tactical-interactive"
                                        style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            <div style={{
                                                width: 38, height: 38, borderRadius: "10px",
                                                background: "linear-gradient(135deg, #7C4DFF, #5E35B1)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontWeight: 900, color: "white", fontSize: "1.1rem"
                                            }}>
                                                #
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text-primary)" }}>{g.name}</div>
                                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {Array.isArray(g.members) ? g.members.length : 0} miembros
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setAdminGroup(g);
                                                }}
                                                className="btn-icon"
                                                title="Gestionar Miembros & Ajustes del Grupo"
                                                style={{ width: 34, height: 34 }}
                                            >
                                                ⚙️
                                            </button>
                                            <button
                                                className="btn-tactical-secondary"
                                                style={{ padding: "6px 14px", fontSize: "0.76rem" }}
                                            >
                                                Entrar ➔
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Administración de Grupo */}
            {adminGroup && (
                <GroupAdminModal
                    groupId={adminGroup.id}
                    groupName={adminGroup.name}
                    members={adminGroup.members || []}
                    onClose={() => {
                        setAdminGroup(null);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}