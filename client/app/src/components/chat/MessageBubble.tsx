"use client";

import React, { memo, useState, useRef, useCallback } from "react";
import { MessageItem } from "../../lib/api";
import { VoiceMessage } from "./VoiceMessage";
import { PollMessage } from "./PollMessage";
import { ImageViewerModal } from "./ImageViewerModal";

interface MessageBubbleProps {
    msg: MessageItem;
    isMine: boolean;
    isFirst: boolean;
    isLast: boolean;
    showDate: boolean;
    peerName: string;
    starredMessages: string[];
    searchQuery: string;
    isSearchHighlight: boolean;
    isSwiping: boolean;
    onTouchStart: (e: React.TouchEvent, msg: MessageItem) => void;
    onTouchMove: (e: React.TouchEvent, msg: MessageItem) => void;
    onTouchEnd: () => void;
    onLongPress: (e: React.TouchEvent | React.MouseEvent, msg: MessageItem) => void;
    onCancelLongPress: () => void;
    onReaction: (msgId: string, emoji: string) => void;
    onVote: (msgId: string, optIdx: number) => void;
}

function datePill(ts: number): string {
    const d = new Date(ts * 1000), now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return "Hoy";
    if (diff === 1) return "Ayer";
    if (diff < 7)  return d.toLocaleDateString([], { weekday: "long" });
    return d.toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" });
}

function timeStr(ts: number) {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

// Context menu floating
function ContextMenu({ x, y, isMine, onReply, onCopy, onEdit, onDelete, onReact, onClose }: {
    x: number; y: number; isMine: boolean;
    onReply: () => void; onCopy: () => void; onEdit?: () => void;
    onDelete: () => void; onReact: (e: string) => void; onClose: () => void;
}) {
    return (
        <>
            {/* Backdrop */}
            <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
            {/* Reaction bar */}
            <div style={{
                position: "fixed",
                left: Math.min(x, window.innerWidth - 220),
                top: Math.max(y - 60, 10),
                zIndex: 1000,
                display: "flex", gap: "6px",
                background: "rgba(18,20,36,0.97)", backdropFilter: "blur(16px)",
                borderRadius: "40px", padding: "8px 14px",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                animation: "contextMenuIn 0.15s ease"
            }}>
                {REACTIONS.map(e => (
                    <button key={e} onClick={() => { onReact(e); onClose(); }}
                        style={{ background: "transparent", border: "none", fontSize: "1.3rem", cursor: "pointer", padding: "2px 4px", borderRadius: "8px", transition: "transform 0.1s" }}
                        onMouseEnter={ev => (ev.currentTarget.style.transform = "scale(1.3)")}
                        onMouseLeave={ev => (ev.currentTarget.style.transform = "scale(1)")}
                    >{e}</button>
                ))}
            </div>
            {/* Action menu */}
            <div style={{
                position: "fixed",
                left: Math.min(x, window.innerWidth - 180),
                top: Math.max(y - 10, 70),
                zIndex: 1000,
                background: "rgba(18,20,36,0.97)", backdropFilter: "blur(16px)",
                borderRadius: "14px", overflow: "hidden", minWidth: "160px",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                animation: "contextMenuIn 0.15s ease"
            }}>
                {[
                    { label: "Responder", icon: "↩️", action: onReply },
                    { label: "Copiar", icon: "📋", action: onCopy },
                    ...(isMine ? [{ label: "Editar", icon: "✏️", action: onEdit || (() => {}) }] : []),
                    { label: "Eliminar", icon: "🗑️", action: onDelete, danger: true },
                ].map((item: any) => (
                    <button key={item.label} onClick={() => { item.action(); onClose(); }}
                        style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            width: "100%", padding: "12px 16px",
                            background: "transparent", border: "none",
                            color: item.danger ? "#FF4B6B" : "#fff",
                            fontSize: "0.88rem", fontWeight: 600, cursor: "pointer",
                            textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)",
                            transition: "background 0.1s"
                        }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                        onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                    >
                        <span style={{ fontSize: "1rem" }}>{item.icon}</span>{item.label}
                    </button>
                ))}
            </div>
        </>
    );
}

export const MessageBubble = memo(({
    msg, isMine, isFirst, isLast, showDate, peerName, starredMessages,
    searchQuery, isSearchHighlight, isSwiping, onTouchStart, onTouchMove, onTouchEnd,
    onLongPress, onCancelLongPress, onReaction, onVote
}: MessageBubbleProps) => {
    const [viewingImageSrc, setViewingImageSrc] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const longPressTimer = useRef<any>(null);

    const tl = isMine ? (isFirst ? 16 : 6) : 16;
    const tr = isMine ? 16 : (isFirst ? 16 : 6);
    const br = isMine ? (isLast ? 6 : 16) : (isLast ? 16 : 6);
    const bl = isMine ? 6 : (isLast ? 6 : 16);

    const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;
    const isSystem = msg.msg_type === "system";

    const openContextMenu = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : (e as React.MouseEvent).clientX;
        const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : (e as React.MouseEvent).clientY;
        setContextMenu({ x: clientX, y: clientY });
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
        longPressTimer.current = setTimeout(() => openContextMenu(e), 500);
        onTouchStart(e, msg);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        clearTimeout(longPressTimer.current);
        onTouchMove(e, msg);
    };

    const handleTouchEnd = () => {
        clearTimeout(longPressTimer.current);
        onTouchEnd();
    };

    const handleCopy = () => {
        if (msg.content && !msg.content.startsWith("data:")) {
            navigator.clipboard?.writeText(msg.content);
        }
    };

    // Read receipt color
    const checkColor = isMine
        ? (msg.read ? "#00E5FF" : (msg.delivered ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.3)"))
        : undefined;
    const checkSymbol = msg.read ? "✓✓" : (msg.delivered ? "✓✓" : "✓");

    if (isSystem) {
        return (
            <div style={{ textAlign: "center", padding: "6px 12px", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                🔐 {msg.content}
            </div>
        );
    }

    return (
        <React.Fragment>
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x} y={contextMenu.y} isMine={isMine}
                    onClose={() => setContextMenu(null)}
                    onReply={() => onLongPress({} as any, msg)}
                    onCopy={handleCopy}
                    onDelete={() => onLongPress({} as any, msg)}
                    onReact={(e) => onReaction(msg.id, e)}
                />
            )}

            {showDate && (
                <div style={{ display: "flex", justifyContent: "center", margin: "10px 0 4px 0" }}>
                    <span className="badge-tactical" style={{ fontSize: "0.68rem", background: "rgba(18,18,30,0.85)" }}>
                        {datePill(msg.timestamp)}
                    </span>
                </div>
            )}

            <div style={{
                display: "flex", flexDirection: isMine ? "row-reverse" : "row",
                alignItems: "flex-end", gap: "6px",
                marginTop: isFirst ? "8px" : "2px",
                transform: isSwiping ? (isMine ? "translateX(-12px)" : "translateX(12px)") : "none",
                transition: "transform 0.2s ease",
            }}>
                <div
                    data-msgid={msg.id}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={openContextMenu}
                    style={{
                        maxWidth: "80%",
                        padding: msg.msg_type === "image" ? "4px" : "10px 14px",
                        borderRadius: `${tl}px ${tr}px ${br}px ${bl}px`,
                        background: isMine
                            ? "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)"
                            : "rgba(18, 18, 30, 0.95)",
                        color: isMine ? "#000" : "#fff",
                        border: isMine ? "none" : "1px solid var(--glass-border)",
                        boxShadow: isMine ? "0 4px 14px rgba(0,229,255,0.25)" : "0 2px 8px rgba(0,0,0,0.5)",
                        display: "flex", flexDirection: "column", gap: "4px",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                    }}
                >
                    {/* Media Image */}
                    {(msg.msg_type === "image" || msg.media_data?.startsWith("data:image") || msg.content?.startsWith("data:image")) && (
                        <div style={{ borderRadius: "12px", overflow: "hidden", cursor: "pointer" }} onClick={() => setViewingImageSrc(msg.media_data || (msg.content?.startsWith("data:image") ? msg.content : null))}>
                            <img src={msg.media_data || (msg.content?.startsWith("data:image") ? msg.content : "")} alt="Foto" style={{ maxWidth: "100%", maxHeight: "240px", objectFit: "cover", display: "block", borderRadius: "8px" }} />
                        </div>
                    )}

                    {/* Media Video */}
                    {(msg.msg_type === "video" || msg.media_data?.startsWith("data:video") || msg.content?.startsWith("data:video")) && (
                        <div style={{ borderRadius: "12px", overflow: "hidden", maxWidth: "100%" }}>
                            <video src={msg.media_data || (msg.content?.startsWith("data:video") ? msg.content : "")} controls playsInline style={{ maxWidth: "100%", maxHeight: "240px", borderRadius: "8px", display: "block", background: "#000" }} />
                        </div>
                    )}

                    {/* Audio Voice */}
                    {(msg.msg_type === "voice" || msg.msg_type === "audio" || msg.media_data?.startsWith("data:audio") || msg.content?.startsWith("data:audio")) && (
                        <VoiceMessage msg={msg} isMine={isMine} />
                    )}

                    {/* Poll */}
                    {msg.msg_type === "poll" && (
                        <PollMessage msg={msg} onVote={optIdx => onVote(msg.id, optIdx)} />
                    )}

                    {/* Text content */}
                    {msg.msg_type !== "voice" && msg.msg_type !== "audio" && msg.msg_type !== "poll" && msg.msg_type !== "image" && msg.msg_type !== "video" && msg.content && !msg.content.startsWith("data:") && !msg.content.startsWith("[Image]") && !msg.content.startsWith("[Voice Note]") && !msg.content.startsWith("[Video]") && (
                        <div style={{ fontSize: "0.90rem", lineHeight: 1.45, fontWeight: isMine ? 600 : 400, wordBreak: "break-word" }}>
                            {msg.content}
                        </div>
                    )}

                    {/* Timestamp & Status footer */}
                    <div style={{
                        display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "4px",
                        fontSize: "0.65rem", color: isMine ? "rgba(0,0,0,0.65)" : "var(--text-muted)",
                        fontFamily: "JetBrains Mono, monospace", marginTop: "2px"
                    }}>
                        <span>{timeStr(msg.timestamp)}</span>
                        {isMine && (
                            <span style={{ fontSize: "0.75rem", fontWeight: 900, color: checkColor }}>
                                {checkSymbol}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Image Viewer Lightbox */}
            {viewingImageSrc && (
                <ImageViewerModal src={viewingImageSrc} onClose={() => setViewingImageSrc(null)} />
            )}
        </React.Fragment>
    );
});

