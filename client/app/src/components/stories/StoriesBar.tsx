"use client";

import React, { useMemo } from "react";
import { useRedStore } from "../../store/useRedStore";

const AVATAR_COLORS = [
    ["#E8213A","#C0152A"], ["#FF7043","#E64A19"], ["#FFA726","#F57C00"],
    ["#26C6DA","#00ACC1"], ["#29B6F6","#0288D1"], ["#7E57C2","#5E35B1"],
    ["#26A69A","#00897B"], ["#EC407A","#C2185B"],
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

function StoryBubble({
    label,
    initials,
    seed,
    hasStory,
    isNew,
    isLive,
    onClick,
}: {
    label: string;
    initials: string;
    seed: string;
    hasStory: boolean;
    isNew: boolean;
    isLive: boolean;
    onClick: () => void;
}) {
    return (
        <div
            onClick={onClick}
            style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: "6px", cursor: "pointer", flexShrink: 0, width: "64px",
            }}
        >
            <div
                style={{
                    position: "relative", width: 54, height: 54, borderRadius: "50%",
                    padding: "2px",
                    background: isLive
                        ? "linear-gradient(135deg, #FF3355, #E8213A)"
                        : hasStory
                        ? "linear-gradient(135deg, #00E5FF, #0284C7)"
                        : "rgba(255,255,255,0.1)",
                    boxShadow: isLive ? "0 0 12px rgba(255,51,85,0.5)" : hasStory ? "0 0 10px rgba(0,229,255,0.4)" : "none"
                }}
            >
                <div
                    style={{
                        width: "100%", height: "100%", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.1rem", fontWeight: 800, color: "#fff",
                        border: "2px solid #060810",
                        ...avStyle(seed),
                    }}
                >
                    {initials}
                </div>

                {isLive && (
                    <span style={{
                        position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
                        background: "var(--accent-crimson)", color: "#fff", fontSize: "0.55rem",
                        fontWeight: 900, padding: "1px 4px", borderRadius: "4px", letterSpacing: "0.5px"
                    }}>
                        LIVE
                    </span>
                )}

                {!hasStory && !isLive && (
                    <span style={{
                        position: "absolute", bottom: 0, right: 0,
                        width: 18, height: 18, borderRadius: "50%",
                        background: "var(--accent-cyan)", color: "#000", fontSize: "0.75rem",
                        fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
                        border: "2px solid #060810"
                    }}>
                        +
                    </span>
                )}
            </div>

            <span style={{
                fontSize: "0.70rem", color: "var(--text-secondary)",
                maxWidth: "60px", overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", textAlign: "center"
            }}>
                {label}
            </span>
        </div>
    );
}

export default function StoriesBar({ onMyStory, onContactStory, onLiveStream }: StoriesBarProps) {
    const { messages, contacts, identity, myStories, liveStreams } = useRedStore();
    const now = Date.now();

    const activeLives = useMemo(() =>
        Object.values(liveStreams).filter(s => s.is_active),
    [liveStreams]);

    const peerStoryMap = useMemo(() => {
        const map: Record<string, { sender: string; ts: number; hasMedia: boolean }> = {};
        const msgs = Array.isArray(messages) ? messages : [];
        for (const m of msgs) {
            if (m.msg_type !== "status" || m.is_mine) continue;
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

    return (
        <div style={{
            display: "flex", overflowX: "auto", gap: "10px",
            padding: "10px 16px",
            borderBottom: "1px solid var(--glass-border)",
            background: "rgba(10, 12, 22, 0.6)",
            scrollbarWidth: "none",
        }}>
            {/* Mi Estado */}
            <StoryBubble
                label="Mi Estado"
                initials={(identity?.short_id || "M").charAt(0).toUpperCase()}
                seed={identity?.identity_hash || "me"}
                hasStory={hasMyStory}
                isNew={!hasMyStory}
                isLive={false}
                onClick={onMyStory}
            />

            {/* Directos LIVE activos */}
            {activeLives.map(s => {
                const c = contacts.find((c: any) => c.identity_hash === s.broadcaster_hash);
                const name = c?.display_name || s.broadcaster_name || s.broadcaster_hash.substring(0, 6);
                return (
                    <StoryBubble
                        key={s.stream_id}
                        label={name.split(" ")[0]}
                        initials={name.charAt(0).toUpperCase()}
                        seed={s.broadcaster_hash}
                        hasStory={true}
                        isNew={true}
                        isLive={true}
                        onClick={() => onLiveStream(s.stream_id)}
                    />
                );
            })}

            {/* Estados de contactos */}
            {peerStoryMap.map(s => {
                const c = contacts.find((c: any) => c.identity_hash === s.sender);
                const name = c?.display_name || s.sender.substring(0, 6);
                return (
                    <StoryBubble
                        key={s.sender}
                        label={name.split(" ")[0]}
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