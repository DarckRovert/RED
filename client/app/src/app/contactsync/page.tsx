"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";

type SyncMethod = "qr" | "link" | "nearby";

export default function ContactSyncPage() {
    const { contacts, addContact } = useRedStore();
    const [method, setMethod] = useState<SyncMethod>("link");
    const [importLink, setImportLink] = useState("");
    const [syncing, setSyncing] = useState(false);
    const [result, setResult] = useState<"success" | "error" | null>(null);
    const [exported, setExported] = useState(false);

    const handleImport = async () => {
        if (!importLink.trim()) return;
        setSyncing(true);
        await new Promise(r => setTimeout(r, 1200)); // simulate
        try {
            const url = new URL(importLink.trim());
            const hash = url.pathname.replace("/add-contact/", "").replace("/", "");
            const name = url.searchParams.get("name") || "Contacto importado";
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

    return (
        <main className="contact-sync-page bg-dark">
            <header className="mobile-settings-header glass">
                <Link href="/chat" className="back-btn">←</Link>
                <h2>🔄 Sincronizar Contactos</h2>
            </header>

            {/* Method selector */}
            <div className="sync-method-tabs glass">
                {(["link", "nearby"] as SyncMethod[]).map(m => (
                    <button key={m} className={method === m ? "active" : ""} onClick={() => setMethod(m)}>
                        {m === "link" ? "🔗 Por enlace" : "📡 RED Nearby"}
                    </button>
                ))}
            </div>

            {method === "link" && (
                <section className="sync-section animate-fade">
                    <div className="glass sync-card">
                        <h3>📥 Importar contacto</h3>
                        <p>Pega un enlace RED de contacto (red://add-contact/...)</p>
                        <input
                            className="poll-input"
                            placeholder="red://add-contact/..."
                            value={importLink}
                            onChange={e => setImportLink(e.target.value)}
                        />
                        <button className="btn-primary" onClick={handleImport} disabled={syncing}>
                            {syncing ? "Importando..." : "Importar"}
                        </button>
                        {result === "success" && <p className="sync-ok">✅ Contacto añadido correctamente</p>}
                        {result === "error" && <p className="sync-err">❌ Enlace inválido o expirado</p>}
                    </div>

                    <div className="glass sync-card" style={{ marginTop: "1rem" }}>
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
                <section className="sync-section animate-fade">
                    <div className="glass sync-card nearby-card">
                        <div className="nearby-pulse" />
                        <h3>📡 RED Nearby</h3>
                        <p>Buscando dispositivos RED en la red local (LAN/BLE)...</p>
                        <p className="sync-count">Esta función requiere que el nodo backend esté activo.</p>
                        <div className="nearby-list">
                            {["Laptop-Alice.local", "Node-3f7a.lan"].map(n => (
                                <div key={n} className="nearby-device glass">
                                    <span>📱 {n}</span>
                                    <button className="btn-primary-small">Añadir</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </main>
    );
}
