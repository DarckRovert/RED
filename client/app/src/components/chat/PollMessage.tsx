"use client";

import React from "react";
import { MessageItem } from "../../lib/api";
import { useRedStore } from "../../store/useRedStore";
import { useTranslation } from "../../lib/i18n/i18nEngine";

interface PollMessageProps {
    msg: MessageItem;
    onVote: (optIdx: number) => void;
}

export function PollMessage({ msg, onVote }: PollMessageProps) {
    const { t } = useTranslation();
    const { identity } = useRedStore();
    
    let pd = msg.poll_data;
    if (!pd && msg.content) {
        try {
            const parsed = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
            if (parsed && parsed.question && Array.isArray(parsed.options)) {
                pd = parsed;
            }
        } catch {}
    }

    if (!pd || !pd.question || !Array.isArray(pd.options)) {
        return (
            <div style={{ minWidth: 200, padding: "8px 12px", background: "rgba(0,0,0,0.25)", borderRadius: 10 }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#FFF", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📊</span>
                    <span>{typeof msg.content === "string" && !msg.content.startsWith("{") ? msg.content : "Encuesta P2P"}</span>
                </div>
            </div>
        );
    }

    const votesMap = pd.votes || {};
    const totalVotes = Object.keys(votesMap).length;
    const myIdentityHash = identity?.identity_hash || "";
    const myVoteVal = myIdentityHash ? votesMap[myIdentityHash] : undefined;

    return (
        <div style={{ minWidth: 240, maxWidth: 360 }}>
            <div style={{
                fontWeight: 800,
                fontSize: "0.94rem",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#FFFFFF",
                lineHeight: 1.3
            }}>
                <span style={{ fontSize: "1.2rem" }}>📊</span>
                <span>{pd.question}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pd.options.map((opt: any, i: number) => {
                    const optText = typeof opt === "object" && opt !== null ? (opt.text || opt.title || `Opción ${i + 1}`) : String(opt);
                    const optStr = String(i);
                    
                    const votesCount = Object.values(votesMap).filter((v: any) => {
                        if (Array.isArray(v)) return v.includes(i) || v.includes(optStr);
                        return String(v) === optStr;
                    }).length;

                    const pct = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                    const isMyVote = Array.isArray(myVoteVal) 
                        ? (myVoteVal.includes(i) || myVoteVal.includes(optStr))
                        : String(myVoteVal) === optStr;

                    return (
                        <div
                            key={i}
                            onClick={() => onVote(i)}
                            className="card-tactical-interactive"
                            style={{
                                position: "relative",
                                color: "#fff",
                                cursor: "pointer",
                                padding: "10px 12px",
                                borderRadius: "10px",
                                background: isMyVote ? "rgba(0, 230, 118, 0.14)" : "rgba(255, 255, 255, 0.04)",
                                border: `1.5px solid ${isMyVote ? "var(--accent-emerald)" : "rgba(255, 255, 255, 0.1)"}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                overflow: "hidden",
                                transition: "all 0.2s ease"
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    bottom: 0,
                                    left: 0,
                                    width: `${pct}%`,
                                    background: isMyVote ? "rgba(0, 230, 118, 0.28)" : "rgba(0, 229, 255, 0.18)",
                                    transition: "width 0.3s ease",
                                    pointerEvents: "none"
                                }}
                            />
                            <span style={{ position: "relative", zIndex: 1, fontSize: "0.86rem", fontWeight: isMyVote ? 800 : 500, display: "flex", alignItems: "center", gap: 6 }}>
                                {isMyVote && <span style={{ color: "var(--accent-emerald)", fontWeight: 900 }}>✓</span>}
                                {optText}
                            </span>
                            <span style={{
                                position: "relative",
                                zIndex: 1,
                                fontSize: "0.76rem",
                                color: isMyVote ? "var(--accent-emerald)" : "var(--text-muted)",
                                marginLeft: 8,
                                flexShrink: 0,
                                fontWeight: 800,
                                fontFamily: "JetBrains Mono, monospace"
                            }}>
                                {pct}% ({votesCount})
                            </span>
                        </div>
                    );
                })}
            </div>

            <div style={{
                fontSize: "0.68rem",
                color: "var(--text-muted)",
                marginTop: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "JetBrains Mono, monospace",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: 4
            }}>
                <span>{totalVotes} {t.chat_extended?.poll_votes || "votos registrados"}</span>
                {myVoteVal !== undefined && (
                    <span style={{ color: "var(--accent-emerald)", fontWeight: 800 }}>
                        ● VOTO ENCRIPTADO
                    </span>
                )}
            </div>
        </div>
    );
}