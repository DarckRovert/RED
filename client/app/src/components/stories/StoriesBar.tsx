"use client";

import React, { useMemo } from "react";
import { useRedStore } from "../../store/useRedStore";

/* ── Palette helpers ──────────────────────────────────────────────────── */
const AVATAR_COLORS = [
    ['#E8213A','#C0152A'], ['#FF7043','#E64A19'], ['#FFA726','#F57C00'],
    ['#26C6DA','#00ACC1'], ['#29B6F6','#0288D1'], ['#7E57C2','#5E35B1'],
    ['#26A69A','#00897B'], ['#EC407A','#C2185B'],
];
function getAvIdx(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 8;
}
function avStyle(s: string) {
    const [a, b] = AVATAR_COLORS[getAvIdx(s)];
    return { background: `linear-gradient(135deg, ${a}, ${b})` };
}

const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

interface StoriesBarProps {
    onMyStory: () => void;
    onContactStory: (senderHash: string) => void;
    onLiveStream: (streamId: string) => void;
}

export default function StoriesBar({ onMyStory, onContactStory, onLiveStream }: StoriesBarProps) {
    const { messages, contacts, identity, myStories, liveStreams } = useRedStore();

    const now = Date.now();

    // Active live streams from contacts
    const activeLives = useMemo(() =>
        Object.values(liveStreams).filter(s => s.is_active),
    [liveStreams]);

    // Peer stories: one (most recent) per sender from last 24h
    const peerStoryMap = useMemo(() => {
        const map: Record<string, { sender: string; ts: number; hasMedia: boolean }> = {};
        const msgs = Array.isArray(messages) ? messages : [];
        for (const m of msgs) {
            if (m.msg_type !== 'status' || m.is_mine) continue;
            const msgTime = m.timestamp > 1e10 ? m.timestamp : m.timestamp * 1000;
            if (now - msgTime > STATUS_TTL_MS) continue;
            const existing = map[m.sender];
            if (!existing || msgTime > existing.ts) {
                map[m.sender] = { sender: m.sender, ts: msgTime, hasMedia: !!m.media_data };
            }
        }
        return Object.values(map);
    }, [messages, now]);

    const hasMyStory = myStories.length > 0 && (now - myStories[myStories.length - 1].timestamp) < STATUS_TTL_MS;
    const totalItems = (activeLives.length > 0 ? 1 : 0) + peerStoryMap.length;

    if (totalItems === 0 && !hasMyStory) return null;

    return (
        <div style={{
            display: 'flex', overflowX: 'auto', gap: '12px',
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
        }}>
            {/* My story bubble */}
            <StoryBubble
                label="Mi Estado"
                initials={(identity?.short_id || 'M').charAt(0).toUpperCase()}
                seed={identity?.identity_hash || 'me'}
                hasStory={hasMyStory}
                isNew={!hasMyStory}
                isLive={false}
                onClick={onMyStory}
            />

            {/* Live streams */}
            {activeLives.map(s => {
                const c = contacts.find((c: any) => c.identity_hash === s.broadcaster_hash);
                const name = c?.display_name || s.broadcaster_name || s.broadcaster_hash.substring(0, 6);
                return (
                    <StoryBubble
                        key={s.stream_id}
                        label={name.split(' ')[0]}
                        initials={name.charAt(0).toUpperCase()}
                        seed={s.broadcaster_hash}
                        hasStory={true}
                        isNew={true}
                        isLive={true}
                        onClick={() => onLiveStream(s.stream_id)}
                    />
                );
            })}

            {/* Peer stories */}
            {peerStoryMap.map(s => {
                const c = contacts.find((c: any) => c.identity_hash === s.sender);
                const name = c?.display_name || s.sender.substring(0, 8);
                return (
                    <StoryBubble
                        key={s.sender}
                        label={name.split(' ')[0]}
                        initials={name.charAt(0).toUpperCase()}
                        seed={s.sender}
                        hasStory={true}
                        isNew={true}
                        isLive={false}
                        onClick={() => onContactStory(s.sender)}
                    />
                );
            })}
        </div>
    );
}

/* ── StoryBubble ────────────────────────────────────────────────────────── */

interface BubbleProps {
    label: string;
    initials: string;
    seed: string;
    hasStory: boolean;
    isNew: boolean;
    isLive: boolean;
    onClick: () => void;
}

function StoryBubble({ label, initials, seed, hasStory, isNew, isLive, onClick }: BubbleProps) {
    const borderColor = isLive ? '#FF3B30' : hasStory ? '#E8213A' : 'rgba(255,255,255,0.15)';
    const borderWidth = hasStory ? 2.5 : 2;

    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '5px', background: 'transparent', border: 'none', cursor: 'pointer',
                flexShrink: 0, padding: '2px', minWidth: 60,
            }}
        >
            {/* Ring */}
            <div style={{
                width: 56, height: 56, borderRadius: '50%',
                padding: '2px',
                background: isLive
                    ? 'linear-gradient(135deg, #FF3B30, #FF6B35)'
                    : hasStory
                        ? 'linear-gradient(135deg, #E8213A, #FF6B35, #FFA726)'
                        : 'rgba(255,255,255,0.1)',
                animation: isLive ? 'story-live-pulse 1.8s ease-in-out infinite' : undefined,
            }}>
                {/* Avatar inner */}
                <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    border: '2px solid var(--bg-deep)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.15rem', color: 'white',
                    ...avStyle(seed),
                    position: 'relative',
                }}>
                    {initials}
                    {isLive && (
                        <div style={{
                            position: 'absolute', bottom: -1, left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#FF3B30', color: 'white',
                            fontSize: '0.45rem', fontWeight: 900,
                            padding: '1px 4px', borderRadius: 4,
                            letterSpacing: '0.5px', whiteSpace: 'nowrap',
                            border: '1px solid var(--bg-deep)',
                        }}>
                            LIVE
                        </div>
                    )}
                </div>
            </div>
            {/* Label */}
            <span style={{
                fontSize: '0.68rem', color: isNew ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: isNew ? 600 : 400, maxWidth: 56,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textAlign: 'center',
            }}>
                {label}
            </span>
        </button>
    );
}
