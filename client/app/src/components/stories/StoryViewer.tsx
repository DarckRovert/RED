"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { RedAPI, MessageItem } from "../../lib/api";
import { STORY_THEMES } from "./StoryCreator";
import { useTranslation } from "../../lib/i18n/i18nEngine";

const STORY_DURATION_MS = 6000;

interface StoryViewerProps {
    stories: MessageItem[];
    senderName: string;
    senderHash: string;
    onClose?: () => void;
    onReply?: (storyId: string, senderHash: string) => void;
}

export default function StoryViewer({ stories, senderName, senderHash, onClose, onReply }: StoryViewerProps) {
    const { t } = useTranslation();
    const [idx, setIdx] = useState(0);
    const [progress, setProgress] = useState(0);
    const [paused, setPaused] = useState(false);
    const [replyText, setReplyText] = useState("");
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startRef = useRef<number>(Date.now());

    const currentStory = stories[idx];

    const goNext = useCallback(() => {
        if (idx < stories.length - 1) {
            setIdx(i => i + 1);
            setProgress(0);
            startRef.current = Date.now();
        } else {
            onClose?.();
        }
    }, [idx, stories.length, onClose]);

    const goPrev = useCallback(() => {
        if (idx > 0) {
            setIdx(i => i - 1);
            setProgress(0);
            startRef.current = Date.now();
        }
    }, [idx]);

    useEffect(() => {
        if (paused) return;
        setProgress(0);
        startRef.current = Date.now();

        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startRef.current;
            const p = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
            setProgress(p);
            if (p >= 100) {
                clearInterval(intervalRef.current!);
                goNext();
            }
        }, 50);

        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [idx, paused, goNext]);

    if (!currentStory) { onClose?.(); return null; }

    const themeIdx = typeof currentStory.theme === "string" ? parseInt(currentStory.theme) : undefined;
    const theme = (themeIdx !== undefined && !isNaN(themeIdx)) ? STORY_THEMES[themeIdx % 8] : STORY_THEMES[0];
    const hasPhoto = !!currentStory.media_data;

    const handleSendReply = async () => {
        if (!replyText.trim()) return;
        try {
            await RedAPI.sendMessage(senderHash, replyText.trim(), {
                msg_type: "story_reply",
                conversation_id: currentStory.id,
            });
            setReplyText("");
            onClose?.();
        } catch {}
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: hasPhoto ? "#000" : `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
            color: "white", display: "flex", flexDirection: "column",
            overflow: "hidden", userSelect: "none"
        }}>
            {/* Segmented Progress Bars */}
            <div style={{
                position: "absolute", top: "calc(8px + var(--safe-top, 0px))", left: 12, right: 12,
                display: "flex", gap: "4px", zIndex: 20
            }}>
                {stories.map((s, i) => (
                    <div key={s.id || i} style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.25)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                            height: "100%", background: "#fff",
                            width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%",
                            transition: i === idx ? "width 0.05s linear" : "none"
                        }} />
                    </div>
                ))}
            </div>

            {/* Top Author Header */}
            <div style={{
                position: "absolute", top: "calc(20px + var(--safe-top, 0px))", left: 16, right: 16,
                display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 20
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                        {senderName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: "0.90rem", fontWeight: 800 }}>{senderName}</div>
                        <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.7)", fontFamily: "JetBrains Mono, monospace" }}>
                            ESTADO P2P EFÍMERO
                        </div>
                    </div>
                </div>

                <button onClick={onClose} className="btn-icon" style={{ background: "rgba(0,0,0,0.5)", width: 36, height: 36 }}>✕</button>
            </div>

            {/* Tap Navigation Areas */}
            <div style={{ position: "absolute", inset: 0, display: "flex", zIndex: 10 }}>
                <div style={{ flex: 1 }} onClick={goPrev} />
                <div style={{ flex: 1 }} onClick={goNext} />
            </div>

            {/* Story Content Canvas */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", zIndex: 5 }}>
                {hasPhoto ? (
                    <img
                        src={currentStory.media_data?.startsWith("data:") ? currentStory.media_data : `data:image/jpeg;base64,${currentStory.media_data}`}
                        alt="Estado"
                        style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "16px" }}
                    />
                ) : (
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, textAlign: "center", maxWidth: "420px", textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>
                        {currentStory.content}
                    </div>
                )}
            </div>

            {/* Bottom Reply Bar */}
            <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "12px 16px calc(14px + var(--safe-bottom, 0px)) 16px",
                display: "flex", gap: "8px",
                background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
                zIndex: 20
            }}>
                <input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onFocus={() => setPaused(true)}
                    onBlur={() => setPaused(false)}
                    onKeyDown={e => { if (e.key === "Enter") handleSendReply(); }}
                    placeholder={t.stories_module?.caption_placeholder || "Responder a este estado..."}
                    style={{ flex: 1, background: "rgba(0,0,0,0.7)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-full)", padding: "10px 16px", color: "#fff", fontSize: "0.85rem" }}
                />
                <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim()}
                    className="btn-tactical-primary"
                    style={{ padding: "10px 18px", borderRadius: "var(--radius-full)", fontSize: "0.85rem" }}
                >
                    {t.chat_extended?.send_audio || "Enviar"}
                </button>
            </div>
        </div>
    );
}