"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";
import NearbyDevicesPanel from "../../components/NearbyDevicesPanel";

type SyncMethod = "link" | "nearby";

export default function ContactSyncPage() {
    const { contacts, addContact, identity } = useRedStore();
    const [method, setMethod] = useState<SyncMethod>("link");
    const [importLink, setImportLink] = useState("");
    const [syncing, setSyncing] = useState(false);
    const [result, setResult] = useState<"success" | "error" | null>(null);
    const [exported, setExported] = useState(false);

    const handleImport = async () => {
        const input = importLink.trim();
        if (!input) return;
        setSyncing(true);
        await new Promise(r => setTimeout(r, 1200));
        try {
            let hash = "";
            let name = "Contacto importado";
            
            if (input.startsWith("red://")) {
                const url = new URL(input);
                hash = url.pathname.replace("/add-contact/", "").replace("/", "");
                name = url.searchParams.get("name") || name;
            } else {
                // If it's a raw DID, typical length is 52 for ED25519 p2p id, but allowing lengths > 8
                hash = input.replace(/[^a-zA-Z0-9_-]/g, ""); 
            }

            if (hash.length > 8) {
                await addContact(hash, name);
                setResult("success");
            } else throw new Error("Invalid");
        } catch {
            setResult("error");
        }
        setSyncing(false);
        setTimeout(() => setResult(null), 3000);
    };

    const exportContacts = () => {
        const data = contacts.map(c => `red://add-contact/${c.identity_hash}?name=${encodeURIComponent(c.displayName)}`).join("\n");
        const blob = new Blob([data], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "red_contacts.txt"; a.click();
        URL.revokeObjectURL(url);
        setExported(true);
        setTimeout(() => setExported(false), 2000);
    };

    const localId = identity?.identity_hash || "local";

    return (
        <main className="contact-sync-page bg-dark">
            <header className="mobile-settings-header">
                <Link href="/contacts" className="back-btn">←</Link>
                <h2>🔄 Sincronizar Contactos</h2>
            </header>

            {/* Method selector */}
            <div className="sync-method-tabs" style={{ background: 'var(--surface-2)', margin: '0 1rem 1rem', borderRadius: '12px', display: 'flex', padding: '0.25rem' }}>
                {(["link", "nearby"] as SyncMethod[]).map(m => (
                    <button key={m} className={method === m ? "active" : ""} onClick={() => setMethod(m)}>
                        {m === "link" ? "🔗 Por enlace" : "📡 RED Nearby"}
                    </button>
                ))}
            </div>

            {method === "link" && (
                <section className="sync-section animate-fade" style={{ padding: '0 1rem' }}>
                    <div className="sync-card" style={{ background: 'var(--surface-2)', border: '1px solid var(--glass-border)', padding: '1.2rem', borderRadius: '12px' }}>
                        <h3>📥 Importar contacto</h3>
                        <p>Pega un enlace RED o directamente el DID del contacto</p>
                        <input
                            className="poll-input"
                            placeholder="red://add-contact/... o 12D3KooW..."
                            value={importLink}
                            onChange={e => setImportLink(e.target.value)}
                        />
                        <button className="btn-primary" onClick={handleImport} disabled={syncing}>
                            {syncing ? "Importando..." : "Importar"}
                        </button>
                        {result === "success" && <p className="sync-ok">✅ Contacto añadido correctamente</p>}
                        {result === "error" && <p className="sync-err">❌ Enlace inválido o expirado</p>}
                    </div>

                    <div className="sync-card" style={{ marginTop: "1rem", background: 'var(--surface-2)', border: '1px solid var(--glass-border)', padding: '1.2rem', borderRadius: '12px' }}>
                        <h3>📤 Exportar mis contactos</h3>
                        <p>Descarga un archivo .txt con los enlaces RED de todos tus contactos para importar en otro dispositivo.</p>
                        <p className="sync-count">{contacts.length} contacto(s) en tu lista</p>
                        <button className={`btn-primary ${exported ? "btn-saved" : ""}`} onClick={exportContacts}>
                            {exported ? "✅ Descargado" : "Exportar contactos (.txt)"}
                        </button>
                    </div>
                </section>
            )}

            {method === "nearby" && (
                <section className="sync-section animate-fade" style={{ padding: '1rem' }}>
                    {/* Real NearbyDevicesPanel — uses Capacitor BLE + WiFi Direct */}
                    <NearbyDevicesPanel
                        localId={localId}
                        onPeerConnected={(peer) => {
                            // Auto-add connected nearby peer as a contact
                            addContact(peer.id, peer.name)
                                .then(() => {/* toast handled inside panel */})
                                .catch(console.error);
                        }}
                    />
                </section>
            )}
        </main>
    );
}
