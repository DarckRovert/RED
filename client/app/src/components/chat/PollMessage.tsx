import React from "react";
import { MessageItem } from "../../lib/api";

interface PollMessageProps {
    msg: MessageItem;
    onVote: (optIdx: number) => void;
}

export function PollMessage({ msg, onVote }: PollMessageProps) {
    const pd = msg.poll_data;
    if (!pd) return null;
    const totalVotes = Object.keys(pd.votes || {}).length;
    return (
        <div style={{ minWidth: 210 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📊</span> {pd.question}
            </div>
            {pd.options.map((opt, i) => {
                const votes = Object.values(pd.votes || {}).filter((v: any) => v === String(i)).length;
                const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                return (
                    <div key={i} className="poll-option" onClick={() => onVote(i)}
                        style={{ color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <div className="poll-bar" style={{ width: `${pct}%` }} />
                        <span style={{ position: 'relative', zIndex: 1, fontSize: '0.86rem' }}>{opt}</span>
                        <span style={{ position: 'relative', zIndex: 1, fontSize: '0.76rem', color: 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>
                            {pct}%
                        </span>
                    </div>
                );
            })}
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {totalVotes} voto{totalVotes !== 1 ? 's' : ''}
            </div>
        </div>
    );
}
