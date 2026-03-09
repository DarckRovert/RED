"use client";

import React, { useState, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { MessageItem } from "../lib/api";

interface SearchResult {
    msg: MessageItem;
    convName: string;
    convId: string;
}

function highlight(text: string, query: string) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
        <>
            {text.substring(0, idx)}
            <mark className="search-highlight">{text.substring(idx, idx + query.length)}</mark>
            {text.substring(idx + query.length)}
        </>
    );
}

export default function MessageSearch({ onClose }: { onClose: () => void }) {
    const [query, setQuery] = useState("");
    const { messages, conversations, selectConversation } = useRedStore();

    const results = useMemo<SearchResult[]>(() => {
        if (query.trim().length < 2) return [];
        return messages
            .filter(m => !m.isDeleted && m.content.toLowerCase().includes(query.toLowerCase()))
            .map(m => {
                const conv = conversations.find(c => c.id); // simplified — in real app, tag messages with convId
                return { msg: m, convName: conv?.peer || "Chat", convId: conv?.id || "" };
            })
            .slice(0, 50);
    }, [query, messages, conversations]);

    return (
        <div className="search-panel glass animate-fade">
            <div className="search-panel-header">
                <button className="back-btn" onClick={onClose}>←</button>
                <input
                    className="search-panel-input"
                    placeholder="Buscar en mensajes..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoFocus
                />
                {query && <button className="search-clear" onClick={() => setQuery("")}>✕</button>}
            </div>

            <div className="search-results scrollbar-hide">
                {query.length < 2 ? (
                    <p className="search-hint">Escribe al menos 2 caracteres para buscar</p>
                ) : results.length === 0 ? (
                    <p className="search-hint">Sin resultados para &ldquo;{query}&rdquo;</p>
                ) : (
                    results.map(r => (
                        <button
                            key={r.msg.id}
                            className="search-result-item"
                            onClick={() => { selectConversation(r.convId); onClose(); }}
                        >
                            <div className="search-result-meta">
                                <span className="search-result-conv">{r.convName}</span>
                                <span className="search-result-time">
                                    {new Date(r.msg.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                            <p className="search-result-text">
                                {r.msg.is_mine && <span className="search-me">Tú: </span>}
                                {highlight(r.msg.content, query)}
                            </p>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
