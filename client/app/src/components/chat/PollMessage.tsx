"use client";

import React from "react";
import { MessageItem } from "../../lib/api";
import { useRedStore } from "../../store/useRedStore";

interface PollMessageProps {
    msg: MessageItem;
    onVote: (optIdx: number) => void;
}

export function PollMessage({ msg, onVote }: PollMessageProps) {
    const { identity } = useRedStore();
    const pd = msg.poll_data;
    if (!pd) return null;

    const votesMap = pd.votes || {};
    const totalVotes = Object.keys(votesMap).length;
    const myIdentityHash = identity?.identity_hash || "";
    const myVoteStr = myIdentityHash ? String(votesMap[myIdentityHash]) : null;

    return (
        <div style={{ minWidth: 230 }}>
            <div style={{ fontWeight: 800, fontSize: "0.92rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, color: "#fff" }}>
                <span>📊</span> {pd.question}
            </div>
            {pd.options.map((opt: any, i: number) => {
                const optStr = String(i);
                const votesCount = Object.values(votesMap).filter((v: any) => String(v) === optStr).length;
                const pct = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                const isMyVote = myVoteStr === optStr;

                return (
                    <div
                        key={i}
                        onClick={() => onVote(i)}
                        style={{
                            position: "relative",
                            color: "#fff",
                            cursor: "pointer",
                            padding: "8px 12px",
                            borderRadius: "10px",
                            marginBottom: "6px",
                            background: isMyVote ? "rgba(0,230,118,0.15)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${isMyVote ? "var(--accent-emerald)" : "var(--glass-border)"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            overflow: "hidden"
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                top: 0, bottom: 0, left: 0,
                                width: `${pct}%`,
                                background: isMyVote ? "rgba(0,230,118,0.25)" : "rgba(0,229,255,0.15)",
                                transition: "width 0.3s ease",
                                pointerEvents: "none"
                            }}
                        />
                        <span style={{ position: "relative", zIndex: 1, fontSize: "0.85rem", fontWeight: isMyVote ? 800 : 500 }}>
                            {isMyVote ? "✓ " : ""}{opt}
                        </span>
                        <span style={{ position: "relative", zIndex: 1, fontSize: "0.74rem", color: isMyVote ? "var(--accent-emerald)" : "var(--text-muted)", marginLeft: 8, flexShrink: 0, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                            {pct}% ({votesCount})
                        </span>
                    </div>
                );
            })}
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 6, display: "flex", justifyContent: "space-between", fontFamily: "JetBrains Mono, monospace" }}>
                <span>{totalVotes} voto{totalVotes !== 1 ? "s" : ""} auditado{totalVotes !== 1 ? "s" : ""}</span>
                {myVoteStr !== null && <span style={{ color: "var(--accent-emerald)", fontWeight: 700 }}>Voto Registrado</span>}
            </div>
        </div>
    );
}