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

    const exportHtml = () => {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Exportación de Chat - RED: ${convName}</title>
    <style>
        body { font-family: sans-serif; background: #0f1015; color: #fff; max-width: 800px; margin: 0 auto; padding: 20px; }
        .msg { margin: 10px 0; display: flex; flex-direction: column; }
        .msg.me { align-items: flex-end; }
        .msg.them { align-items: flex-start; }
        .bubble { max-width: 70%; padding: 10px 14px; border-radius: 12px; font-size: 15px; line-height: 1.4; }
        .me .bubble { background: #E8001C; border-bottom-right-radius: 2px; }
        .them .bubble { background: #1c1d25; border-bottom-left-radius: 2px; }
        .meta { font-size: 11px; color: #888; margin-top: 4px; }
    </style>
</head>
<body>
    <h2 style="text-align: center; border-bottom: 1px solid #333; padding-bottom: 10px;">Chat: ${convName}</h2>
    <div class="chat-container">
        ${messages.map(m => `
            <div class="msg ${m.is_mine ? 'me' : 'them'}">
                <div class="bubble">${m.isDeleted ? '<em>Mensaje eliminado</em>' : (m.content || '[Archivo adjunto]')}</div>
                <div class="meta">${new Date(m.timestamp * 1000).toLocaleString()}</div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
        downloadFile(html, `${convName}_export.html`, "text/html");
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
                <Link href="/settings" className="back-btn">←</Link>
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
                    <button className="export-btn" onClick={exportHtml}>
                        <span className="export-btn-icon">🌐</span>
                        <div>
                            <strong>Exportar como HTML</strong>
                            <p>Formato visual con burbujas como el chat real</p>
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
