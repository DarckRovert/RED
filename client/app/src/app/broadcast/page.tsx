"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";

interface BroadcastList {
    id: string;
    name: string;
    recipients: string[];
    lastSent?: string;
}

const INITIAL_LISTS: BroadcastList[] = [
    { id: "bc1", name: "Nodos Prioritarios", recipients: ["Satoshi Nakamoto", "Alice (RED Dev)"], lastSent: "Hace 2 días" },
];

export default function BroadcastPage() {
    const { contacts, sendMessage } = useRedStore();
    const [lists, setLists] = useState<BroadcastList[]>(INITIAL_LISTS);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [broadcasting, setBroadcasting] = useState<BroadcastList | null>(null);
    const [broadcastText, setBroadcastText] = useState("");
    const [sent, setSent] = useState(false);

    const createList = () => {
        if (!newName.trim() || selected.length === 0) return;
        const newList: BroadcastList = { id: "bc" + Date.now(), name: newName, recipients: selected };
        setLists([...lists, newList]);
        setCreating(false);
        setNewName(""); setSelected([]);
    };

    const sendBroadcast = async () => {
        if (!broadcastText.trim() || !broadcasting) return;
        // In real app, send to each recipient's conversation
        await sendMessage(`📢 ${broadcastText}`);
        setSent(true);
        setTimeout(() => { setSent(false); setBroadcasting(null); setBroadcastText(""); }, 2000);
    };

    return (
        <main className="broadcast-page bg-dark">
            <header className="mobile-settings-header glass">
                <Link href="/chat" className="back-btn">←</Link>
                <h2>📢 Listas de difusión</h2>
                <button className="icon-btn" onClick={() => setCreating(true)}>+</button>
            </header>

            <section className="broadcast-content">
                {lists.map(list => (
                    <div key={list.id} className="broadcast-item glass">
                        <div className="broadcast-meta">
                            <span className="broadcast-name">{list.name}</span>
                            <span className="broadcast-count">{list.recipients.length} destinatarios</span>
                            {list.lastSent && <span className="broadcast-last">Último envío: {list.lastSent}</span>}
                        </div>
                        <div className="broadcast-actions">
                            <span className="broadcast-recipients">{list.recipients.slice(0, 2).join(", ")}{list.recipients.length > 2 ? "..." : ""}</span>
                            <button className="btn-primary broadcast-send-btn" onClick={() => setBroadcasting(list)}>📤 Enviar</button>
                        </div>
                    </div>
                ))}

                {lists.length === 0 && (
                    <div className="empty-state-full">
                        <div style={{ fontSize: "3rem" }}>📢</div>
                        <h3>Sin listas de difusión</h3>
                        <p>Crea una lista para enviar el mismo mensaje a varios contactos a la vez.</p>
                        <button className="btn-primary" onClick={() => setCreating(true)}>Crear lista</button>
                    </div>
                )}
            </section>

            {/* Create modal */}
            {creating && (
                <div className="modal-overlay animate-fade">
                    <div className="modal-content glass">
                        <h3>Nueva lista de difusión</h3>
                        <input className="poll-input" placeholder="Nombre de la lista" value={newName} onChange={e => setNewName(e.target.value)} />
                        <p className="section-title">Selecciona destinatarios:</p>
                        <div className="contact-selector scrollbar-hide">
                            {contacts.map(c => (
                                <button key={c.id} className={`contact-chip ${selected.includes(c.displayName) ? "selected" : ""}`} onClick={() => {
                                    setSelected(s => s.includes(c.displayName) ? s.filter(x => x !== c.displayName) : [...s, c.displayName]);
                                }}>
                                    {selected.includes(c.displayName) ? "✓ " : ""}{c.displayName}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                            <button className="btn-secondary" onClick={() => setCreating(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={createList}>Crear</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Send modal */}
            {broadcasting && (
                <div className="modal-overlay animate-fade">
                    <div className="modal-content glass">
                        {sent ? (
                            <div className="broadcast-sent">✅ Mensaje enviado a {broadcasting.recipients.length} destinatarios</div>
                        ) : (
                            <>
                                <h3>📤 Enviar a &ldquo;{broadcasting.name}&rdquo;</h3>
                                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{broadcasting.recipients.join(", ")}</p>
                                <textarea className="message-input" rows={4} placeholder="Escribe tu mensaje..." value={broadcastText} onChange={e => setBroadcastText(e.target.value)} />
                                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                                    <button className="btn-secondary" onClick={() => setBroadcasting(null)}>Cancelar</button>
                                    <button className="btn-primary" onClick={sendBroadcast}>Enviar</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
