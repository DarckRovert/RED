"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { RedAPI, MessageItem } from "../../lib/api";
import { STORY_THEMES } from "./StoryCreator";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

const STORY_DURATION_MS = 5500;
const QUICK_REACTIONS = ["❤️", "🔥", "👏", "⚡", "😂", "👍"];

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
    const [isHolding, setIsHolding] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [replyText, setReplyText] = useState("");

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentSegmentStartRef = useRef<number>(Date.now());
    const accumulatedMsRef = useRef<number>(0);
    const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pointerDownTimeRef = useRef<number>(0);
    const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const currentStory = stories[idx];

    const goNext = useCallback(() => {
        if (idx < stories.length - 1) {
            setIdx(i => i + 1);
            setProgress(0);
            accumulatedMsRef.current = 0;
            currentSegmentStartRef.current = Date.now();
        } else {
            onClose?.();
        }
    }, [idx, stories.length, onClose]);

    const goPrev = useCallback(() => {
        if (idx > 0) {
            setIdx(i => i - 1);
            setProgress(0);
            accumulatedMsRef.current = 0;
            currentSegmentStartRef.current = Date.now();
        } else {
            // Restart current
            setProgress(0);
            accumulatedMsRef.current = 0;
            currentSegmentStartRef.current = Date.now();
        }
    }, [idx]);

    // Timer loop with resume from exact accumulated milliseconds
    useEffect(() => {
        const isPaused = isHolding || isInputFocused;
        if (isPaused) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        currentSegmentStartRef.current = Date.now();

        intervalRef.current = setInterval(() => {
            const elapsed = accumulatedMsRef.current + (Date.now() - currentSegmentStartRef.current);
            const p = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
            setProgress(p);

            if (p >= 100) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                accumulatedMsRef.current = 0;
                goNext();
            }
        }, 40);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [idx, isHolding, isInputFocused, goNext]);

    if (!currentStory) {
        onClose?.();
        return null;
    }

    const themeIdx = typeof currentStory.theme === "string" ? parseInt(currentStory.theme) : undefined;
    const theme = (themeIdx !== undefined && !isNaN(themeIdx)) ? STORY_THEMES[themeIdx % 8] : STORY_THEMES[0];
    const hasPhoto = !!currentStory.media_data;

    // Pointer events for hold-to-pause
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return;
        pointerDownTimeRef.current = Date.now();
        pointerDownPosRef.current = { x: e.clientX, y: e.clientY };

        holdTimeoutRef.current = setTimeout(() => {
            // Snapshot accumulated milliseconds up to freeze point
            accumulatedMsRef.current += Date.now() - currentSegmentStartRef.current;
            setIsHolding(true);
        }, 180);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
        }

        if (isHolding) {
            // Resume timer
            currentSegmentStartRef.current = Date.now();
            setIsHolding(false);
            return;
        }

        // Tap detected (not held)
        const dt = Date.now() - pointerDownTimeRef.current;
        const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
        const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);

        if (dt < 280 && dx < 15 && dy < 15) {
            const screenWidth = typeof window !== "undefined" ? window.innerWidth : 400;
            if (e.clientX < screenWidth * 0.35) {
                goPrev();
            } else {
                goNext();
            }
        }
    };

    const handlePointerCancel = () => {
        if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
        }
        if (isHolding) {
            currentSegmentStartRef.current = Date.now();
            setIsHolding(false);
        }
    };

    const handleSendReply = async (textToSend?: string) => {
        const body = (textToSend || replyText).trim();
        if (!body) return;
        try {
            await RedAPI.sendMessage(senderHash, body, {
                msg_type: "story_reply",
                conversation_id: currentStory.id,
            });
            toast.success("Respuesta enviada");
            setReplyText("");
            onReply?.(currentStory.id, senderHash);
            onClose?.();
        } catch {
            toast.error("Error al enviar respuesta");
        }
    };

    return (
        <div
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className="animate-fade-scale"
            style={{
                position: "fixed", inset: 0, zIndex: 9999,
                background: hasPhoto ? "#04060A" : `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
                color: "white", display: "flex", flexDirection: "column",
                overflow: "hidden", userSelect: "none", touchAction: "none"
            }}
        >
            {/* Segmented Progress Bars con brillo y transición suave */}
            <div style={{
                position: "absolute", top: "calc(8px + var(--safe-top, 0px))", left: 12, right: 12,
                display: "flex", gap: "4px", zIndex: 30,
                opacity: isHolding ? 0.2 : 1, transition: "opacity 0.2s ease"
            }}>
                {stories.map((s, i) => (
                    <div
                        key={s.id || i}
                        style={{
                            flex: 1, height: 3.5,
                            background: "rgba(255, 255, 255, 0.22)",
                            borderRadius: 3, overflow: "hidden"
                        }}
                    >
                        <div style={{
                            height: "100%",
                            background: "#FFFFFF",
                            boxShadow: i === idx ? "0 0 8px rgba(255,255,255,0.8)" : "none",
                            width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%",
                            transition: i === idx && !isHolding ? "width 0.04s linear" : "none"
                        }} />
                    </div>
                ))}
            </div>

            {/* Top Author Header */}
            <div style={{
                position: "absolute", top: "calc(20px + var(--safe-top, 0px))", left: 16, right: 16,
                display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 30,
                opacity: isHolding ? 0 : 1, transition: "opacity 0.2s ease"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--accent-cyan, #00E5FF) 0%, #0077B6 100%)",
                        border: "1.5px solid rgba(255, 255, 255, 0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 900, color: "#000", fontSize: "1rem",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.5)"
                    }}>
                        {senderName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: "0.92rem", fontWeight: 800, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                            {senderName}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.8)", fontFamily: "JetBrains Mono, monospace" }}>
                            ESTADO EFÍMERO · {idx + 1}/{stories.length}
                        </div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    style={{
                        background: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(255,255,255,0.2)",
                        color: "#FFFFFF", width: 36, height: 36, borderRadius: "50%",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 900, fontSize: "1rem"
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Story Content Canvas */}
            <div style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                padding: "20px", position: "relative", zIndex: 10
            }}>
                {hasPhoto ? (
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        <img
                            src={currentStory.media_data?.startsWith("data:") ? currentStory.media_data : `data:image/jpeg;base64,${currentStory.media_data}`}
                            alt="Estado"
                            style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "16px" }}
                        />
                        {currentStory.content && currentStory.content !== "Story" && !currentStory.content.startsWith("📷") && (
                            <div style={{
                                position: "absolute",
                                bottom: "30px",
                                left: "16px",
                                right: "16px",
                                background: "rgba(6, 10, 20, 0.85)",
                                backdropFilter: "blur(12px)",
                                border: "1px solid rgba(255,255,255,0.18)",
                                padding: "12px 18px",
                                borderRadius: "16px",
                                textAlign: "center",
                                fontSize: "0.95rem",
                                fontWeight: 700,
                                color: "#FFFFFF",
                                textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                                opacity: isHolding ? 0 : 1,
                                transition: "opacity 0.2s ease"
                            }}>
                                {currentStory.content}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{
                        fontSize: "1.45rem", fontWeight: 800, textAlign: "center",
                        maxWidth: "440px", textShadow: "0 2px 12px rgba(0,0,0,0.7)",
                        lineHeight: 1.4, padding: "20px"
                    }}>
                        {currentStory.content}
                    </div>
                )}
            </div>

            {/* Bottom Quick Reactions & Reply Bar */}
            <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "10px 16px calc(14px + var(--safe-bottom, 0px)) 16px",
                display: "flex", flexDirection: "column", gap: "10px",
                background: "linear-gradient(0deg, rgba(4,6,12,0.92) 0%, rgba(4,6,12,0.6) 65%, transparent 100%)",
                zIndex: 30, opacity: isHolding ? 0 : 1, transition: "opacity 0.2s ease"
            }}>
                {/* Fast Emoji Reactions */}
                <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                    {QUICK_REACTIONS.map((emoji) => (
                        <button
                            key={emoji}
                            onClick={() => handleSendReply(emoji)}
                            style={{
                                background: "rgba(255, 255, 255, 0.12)",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                borderRadius: "20px",
                                padding: "6px 12px",
                                fontSize: "1.2rem",
                                cursor: "pointer",
                                transition: "transform 0.15s ease",
                                backdropFilter: "blur(8px)"
                            }}
                            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.2)")}
                            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>

                {/* Reply Input Form */}
                <div style={{ display: "flex", gap: "8px" }}>
                    <input
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onFocus={() => {
                            accumulatedMsRef.current += Date.now() - currentSegmentStartRef.current;
                            setIsInputFocused(true);
                        }}
                        onBlur={() => {
                            currentSegmentStartRef.current = Date.now();
                            setIsInputFocused(false);
                        }}
                        onKeyDown={e => { if (e.key === "Enter") handleSendReply(); }}
                        placeholder={t.stories_module?.caption_placeholder || "Responder a este estado..."}
                        style={{
                            flex: 1, background: "rgba(0,0,0,0.65)",
                            border: "1px solid rgba(255,255,255,0.25)",
                            borderRadius: "var(--radius-full)",
                            padding: "11px 18px", color: "#FFFFFF", fontSize: "0.85rem",
                            outline: "none"
                        }}
                    />
                    <button
                        onClick={() => handleSendReply()}
                        disabled={!replyText.trim()}
                        className="btn-tactical-primary"
                        style={{
                            padding: "11px 22px", borderRadius: "var(--radius-full)",
                            fontSize: "0.85rem", fontWeight: 800,
                            background: replyText.trim() ? "var(--primary-bright, #FF3355)" : "rgba(255,255,255,0.1)",
                            color: "#FFFFFF", border: "none", cursor: replyText.trim() ? "pointer" : "default"
                        }}
                    >
                        {t.chat_extended?.send_audio || "Enviar"}
                    </button>
                </div>
            </div>
        </div>
    );
}