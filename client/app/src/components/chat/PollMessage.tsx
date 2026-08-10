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
    const myIdentityHash = identity?.identity_hash || '';
    const myVoteStr = myIdentityHash ? String(votesMap[myIdentityHash]) : null;

    return (
        <div style={{ minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📊</span> {pd.question}
            </div>
            {pd.options.map((opt, i) => {
                const optStr = String(i);
                const votesCount = Object.values(votesMap).filter((v: any) => String(v) === optStr).length;
                const pct = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                const isMyVote = myVoteStr === optStr;

                return (
                    <div
                        key={i}
                        className="poll-option"
                        onClick={() => onVote(i)}
                        style={{
                            position: 'relative',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            marginBottom: '6px',
                            background: isMyVote ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${isMyVote ? '#00E676' : 'rgba(255,255,255,0.1)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            overflow: 'hidden'
                        }}
                    >
                        <div
                            className="poll-bar"
                            style={{
                                position: 'absolute',
                                top: 0, bottom: 0, left: 0,
                                width: `${pct}%`,
                                background: isMyVote ? 'rgba(0,230,118,0.25)' : 'rgba(255,255,255,0.12)',
                                transition: 'width 0.3s ease',
                                pointerEvents: 'none'
                            }}
                        />
                        <span style={{ position: 'relative', zIndex: 1, fontSize: '0.86rem', fontWeight: isMyVote ? 800 : 500 }}>
                            {isMyVote ? '✓ ' : ''}{opt}
                        </span>
                        <span style={{ position: 'relative', zIndex: 1, fontSize: '0.76rem', color: isMyVote ? '#00E676' : 'var(--text-muted)', marginLeft: 8, flexShrink: 0, fontWeight: 700 }}>
                            {pct}% ({votesCount})
                        </span>
                    </div>
                );
            })}
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>{totalVotes} voto{totalVotes !== 1 ? 's' : ''} registrado{totalVotes !== 1 ? 's' : ''}</span>
                {myVoteStr !== null && <span style={{ color: '#00E676', fontWeight: 700 }}>Voto registrado</span>}
            </div>
        </div>
    );
}
