"use client";

import React from "react";
import { useRedStore } from "../../store/useRedStore";
import Link from "next/link";

function downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export default function ExportPage() {
    const { messages, conversations, currentConversationId, identity } = useRedStore();
    const convName = conversations.find(c => c.id === currentConversationId)?.peer || "chat";

    const exportTxt = () => {
        const lines = messages.map(m =>
            `[${new Date(m.timestamp * 1000).toLocaleString()}] ${m.is_mine ? (identity?.short_id || "Tú") : m.sender.substring(0, 12)}: ${m.isDeleted ? "[mensaje eliminado]" : m.content}`
        );
        downloadFile(lines.join("\n"), `${convName}_export.txt`, "text/plain");
    };

    const exportJson = () => {
        const data = {
            exported_at: new Date().toISOString(),
            conversation: convName,
            messages: messages.map(m => ({
                id: m.id,
                sender: m.is_mine ? "me" : m.sender,
                content: m.isDeleted ? null : m.content,
                timestamp: m.timestamp,
                status: m.status,
                reactions: m.reactions,
                replyTo: m.replyTo,
            })),
        };
        downloadFile(JSON.stringify(data, null, 2), `${convName}_export.json`, "application/json");
    };

    return (
        <main className="export-page bg-dark">
            <header className="mobile-settings-header glass">
                <Link href="/chat" className="back-btn">←</Link>
                <h2>📤 Exportar Chat</h2>
            </header>

            <section className="export-content animate-fade">
                <div className="export-hero glass">
                    <div className="export-icon">📄</div>
                    <h3>Exportar conversación</h3>
                    <p>Se exportará <strong>{convName}</strong> con {messages.length} mensaje(s). Los mensajes eliminados se reemplazan con un marcador.</p>
                    <p className="export-warning">⚠️ El archivo exportado no está cifrado. Guárdalo en un lugar seguro.</p>
                </div>

                <div className="export-options glass">
                    <button className="export-btn" onClick={exportTxt}>
                        <span className="export-btn-icon">📝</span>
                        <div>
                            <strong>Exportar como texto (.txt)</strong>
                            <p>Format legible, sin adjuntos</p>
                        </div>
                    </button>
                    <button className="export-btn" onClick={exportJson}>
                        <span className="export-btn-icon">🗂️</span>
                        <div>
                            <strong>Exportar como JSON</strong>
                            <p>Datos completos, incluye reacciones y respuestas</p>
                        </div>
                    </button>
                </div>
            </section>
        </main>
    );
}
