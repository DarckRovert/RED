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
    onPin?: (msg: MessageItem) => void;
    onReply?: (msg: MessageItem) => void;
    onEdit?: (msg: MessageItem) => void;
    onDeleteForEveryone?: (msgId: string) => void;
    onOpenMediaGallery?: (msg: MessageItem) => void;
}

function datePill(ts: number): string {
    const raw = ts > 1e11 ? ts / 1000 : ts;
    const d = new Date(raw * 1000), now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return "Hoy";
    if (diff === 1) return "Ayer";
    if (diff < 7) return d.toLocaleDateString([], { weekday: "long" });
    return d.toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" });
}

function timeStr(ts: number) {
    const raw = ts > 1e11 ? ts / 1000 : ts;
    return new Date(raw * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatBytes(bytes?: number): string {
    if (!bytes || isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name?: string, mime?: string): string {
    const ext = (name || "").split(".").pop()?.toLowerCase() || "";
    if (ext === "pdf" || mime?.includes("pdf")) return "📕";
    if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) return "📦";
    if (["txt", "md", "json", "csv"].includes(ext)) return "📝";
    if (["apk"].includes(ext)) return "🤖";
    if (["gpx", "kml"].includes(ext)) return "🗺️";
    if (["doc", "docx"].includes(ext)) return "📄";
    return "📁";
}

const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

// Context menu floating
function ContextMenu({
    x, y, isMine, isDeleted, onReply, onCopy, onPin, onEdit, onDeleteForEveryone, onDeleteLocal, onReact, onClose
}: {
    x: number; y: number; isMine: boolean; isDeleted: boolean;
    onReply: () => void; onCopy: () => void; onPin?: () => void;
    onEdit?: () => void; onDeleteForEveryone?: () => void; onDeleteLocal: () => void;
    onReact: (e: string) => void; onClose: () => void;
}) {
    return (
        <>
            {/* Backdrop */}
            <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
            {/* Reaction bar */}
            {!isDeleted && (
                <div style={{
                    position: "fixed",
                    left: Math.min(x, window.innerWidth - 240),
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
            )}
            {/* Action menu */}
            <div style={{
                position: "fixed",
                left: Math.min(x, window.innerWidth - 190),
                top: Math.max(y - 10, 70),
                zIndex: 1000,
                background: "rgba(18,20,36,0.97)", backdropFilter: "blur(16px)",
                borderRadius: "14px", overflow: "hidden", minWidth: "170px",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                animation: "contextMenuIn 0.15s ease"
            }}>
                {[
                    ...(!isDeleted ? [{ label: "Responder", icon: "↩️", action: onReply }] : []),
                    ...(!isDeleted ? [{ label: "Copiar", icon: "📋", action: onCopy }] : []),
                    ...(onPin && !isDeleted ? [{ label: "Fijar Mensaje", icon: "📌", action: onPin }] : []),
                    ...(onEdit && isMine && !isDeleted ? [{ label: "Editar", icon: "✏️", action: onEdit }] : []),
                    ...(onDeleteForEveryone && isMine && !isDeleted ? [{ label: "Eliminar para todos", icon: "🗑️", action: onDeleteForEveryone, danger: true }] : []),
                    { label: "Eliminar para mí", icon: "❌", action: onDeleteLocal, danger: true },
                ].map((item: any) => (
                    <button key={item.label} onClick={() => { item.action(); onClose(); }}
                        style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            width: "100%", padding: "12px 16px",
                            background: "transparent", border: "none",
                            color: item.danger ? "#FF4B6B" : "#fff",
                            fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
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
    onLongPress, onCancelLongPress, onReaction, onVote, onPin, onReply, onEdit, onDeleteForEveryone, onOpenMediaGallery
}: MessageBubbleProps) => {
    const [viewingImageSrc, setViewingImageSrc] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [swipeOffset, setSwipeOffset] = useState<number>(0);
    const touchStartCoords = useRef<{ x: number; y: number } | null>(null);
    const longPressTimer = useRef<any>(null);

    const tl = isMine ? (isFirst ? 16 : 6) : 16;
    const tr = isMine ? 16 : (isFirst ? 16 : 6);
    const br = isMine ? (isLast ? 6 : 16) : (isLast ? 16 : 6);
    const bl = isMine ? 6 : (isLast ? 6 : 16);

    const isSystem = msg.msg_type === "system";
    const isDeleted = Boolean(msg.is_deleted);
    const isEdited = Boolean(msg.is_edited || (msg as any).edited);

    const openContextMenu = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : (e as React.MouseEvent).clientX;
        const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : (e as React.MouseEvent).clientY;
        setContextMenu({ x: clientX, y: clientY });
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartCoords.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        longPressTimer.current = setTimeout(() => openContextMenu(e), 500);
        onTouchStart(e, msg);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartCoords.current) return;
        const diffX = e.touches[0].clientX - touchStartCoords.current.x;
        const diffY = Math.abs(e.touches[0].clientY - touchStartCoords.current.y);

        if (diffY > 15) {
            clearTimeout(longPressTimer.current);
            setSwipeOffset(0);
            return;
        }

        // Swipe right to reply gesture
        if (diffX > 0 && diffX < 80) {
            clearTimeout(longPressTimer.current);
            setSwipeOffset(diffX);
        }
        onTouchMove(e, msg);
    };

    const handleTouchEnd = () => {
        clearTimeout(longPressTimer.current);
        if (swipeOffset > 45 && onReply) {
            onReply(msg);
        }
        setSwipeOffset(0);
        touchStartCoords.current = null;
        onTouchEnd();
    };

    const handleCopy = () => {
        if (msg.content && !msg.content.startsWith("data:")) {
            navigator.clipboard?.writeText(msg.content);
        }
    };

    const handleDownloadDocument = () => {
        const url = msg.media_data || msg.content;
        if (!url || !url.startsWith("data:")) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = (msg as any).file_name || `archivo_${msg.id.substring(0, 8)}.dat`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const scrollToRepliedMessage = (repliedId: string) => {
        const el = document.querySelector(`[data-msgid="${repliedId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("highlight-flash");
            setTimeout(() => el.classList.remove("highlight-flash"), 1500);
        }
    };

    // Read receipt color & symbol
    const isDelivered = msg.status === "Delivered" || (msg as any).delivered === true;
    const isRead = msg.status === "Read" || (msg as any).read === true;
    const isPending = msg.status === "Pending";
    const isFailed = msg.status === "Failed";

    const checkColor = isMine
        ? (isRead ? "var(--accent-cyan)" : (isDelivered ? "#00E676" : (isFailed ? "#FF5252" : "rgba(255,255,255,0.65)")))
        : undefined;
    const checkSymbol = isFailed ? "⚠️" : (isPending ? "🕒" : (isRead ? "✓✓" : (isDelivered ? "✓✓" : "✓")));

    // Location message detector
    const isLocationMessage = typeof msg.content === "string" && msg.content.includes("📍 Ubicación Táctica:");
    const locationCoords = isLocationMessage
        ? msg.content.match(/📍 Ubicación Táctica:\s*([-\d.]+),\s*([-\d.]+)/)
        : null;

    // Document detector
    const isDocumentMessage = msg.msg_type === "document" ||
        (msg.content && msg.content.startsWith("data:") && !msg.content.startsWith("data:image") && !msg.content.startsWith("data:video") && !msg.content.startsWith("data:audio")) ||
        (msg.media_data && msg.media_data.startsWith("data:") && !msg.media_data.startsWith("data:image") && !msg.media_data.startsWith("data:video") && !msg.media_data.startsWith("data:audio"));

    const documentName = (msg as any).file_name || "Documento Adjunto";
    const documentSize = (msg as any).file_size || 0;

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
                    x={contextMenu.x} y={contextMenu.y} isMine={isMine} isDeleted={isDeleted}
                    onClose={() => setContextMenu(null)}
                    onReply={() => onReply ? onReply(msg) : onLongPress({} as any, msg)}
                    onCopy={handleCopy}
                    onPin={onPin ? () => onPin(msg) : undefined}
                    onEdit={onEdit ? () => onEdit(msg) : undefined}
                    onDeleteForEveryone={onDeleteForEveryone ? () => onDeleteForEveryone(msg.id) : undefined}
                    onDeleteLocal={() => onLongPress({} as any, msg)}
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
                transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : (isSwiping ? (isMine ? "translateX(-12px)" : "translateX(12px)") : "none"),
                transition: swipeOffset > 0 ? "none" : "transform 0.2s ease",
                position: "relative",
            }}>
                {/* Swipe to reply icon indicator */}
                {swipeOffset > 20 && (
                    <div style={{
                        position: "absolute",
                        left: "-28px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: "1.2rem",
                        color: "var(--accent-cyan)",
                        opacity: Math.min(1, swipeOffset / 40)
                    }}>
                        ↩️
                    </div>
                )}

                <div
                    data-msgid={msg.id}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={openContextMenu}
                    style={{
                        maxWidth: "84%",
                        padding: msg.msg_type === "image" ? "4px" : "8px 12px",
                        borderRadius: `${tl}px ${tr}px ${br}px ${bl}px`,
                        background: isSearchHighlight
                            ? "linear-gradient(135deg, rgba(255,167,38,0.4) 0%, rgba(255,109,0,0.6) 100%)"
                            : (isMine
                                ? "linear-gradient(135deg, rgba(232, 33, 58, 0.32) 0%, rgba(170, 18, 40, 0.46) 100%)"
                                : "rgba(18, 22, 36, 0.95)"),
                        color: "#FFFFFF",
                        border: isSearchHighlight
                            ? "2px solid var(--accent-amber)"
                            : (isMine ? "1px solid rgba(255, 60, 95, 0.42)" : "1px solid rgba(255, 255, 255, 0.09)"),
                        boxShadow: isMine
                            ? "0 4px 16px rgba(232, 33, 58, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.16)"
                            : "0 2px 10px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
                        display: "flex", flexDirection: "column", gap: "4px",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        opacity: isDeleted ? 0.75 : 1,
                    }}
                >
                    {/* Reply Quote Header */}
                    {msg.reply_to && !isDeleted && (
                        <div
                            onClick={() => msg.reply_to?.id && scrollToRepliedMessage(msg.reply_to.id)}
                            style={{
                                padding: "6px 10px",
                                borderRadius: "8px",
                                background: "rgba(0, 0, 0, 0.32)",
                                borderLeft: `3px solid ${isMine ? "var(--primary-bright, #FF3355)" : "var(--accent-cyan, #00E5FF)"}`,
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                marginBottom: "2px",
                            }}
                        >
                            <div style={{ fontWeight: 800, color: isMine ? "#FF8599" : "var(--accent-cyan)", marginBottom: "1px" }}>
                                {msg.reply_to.sender ? `Operador ${msg.reply_to.sender.substring(0, 8)}` : "Respondiendo a mensaje"}
                            </div>
                            <div style={{ color: "rgba(255, 255, 255, 0.88)", opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {msg.reply_to.content || `[${msg.reply_to.msg_type || "Medio"}]`}
                            </div>
                        </div>
                    )}

                    {/* Deleted Message Notice */}
                    {isDeleted ? (
                        <div style={{ fontStyle: "italic", fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", padding: "4px 6px" }}>
                            🚫 Este mensaje fue eliminado
                        </div>
                    ) : (
                        <>
                            {/* Media Image */}
                            {(msg.msg_type === "image" || msg.media_data?.startsWith("data:image") || msg.content?.startsWith("data:image") || msg.content?.startsWith("/9j/") || msg.content?.startsWith("iVBORw0")) && (
                                <div
                                    style={{ borderRadius: "12px", overflow: "hidden", cursor: "pointer" }}
                                    onClick={() => {
                                        if (onOpenMediaGallery) {
                                            onOpenMediaGallery(msg);
                                        } else {
                                            const src = msg.media_data || (
                                                msg.content?.startsWith("data:image") ? msg.content : (
                                                    msg.content?.startsWith("/9j/") ? `data:image/jpeg;base64,${msg.content}` : (
                                                        msg.content?.startsWith("iVBORw0") ? `data:image/png;base64,${msg.content}` : null
                                                    )
                                                )
                                            );
                                            setViewingImageSrc(src);
                                        }
                                    }}
                                >
                                    <img
                                        src={
                                            msg.media_data || (
                                                msg.content?.startsWith("data:image") ? msg.content : (
                                                    msg.content?.startsWith("/9j/") ? `data:image/jpeg;base64,${msg.content}` : (
                                                        msg.content?.startsWith("iVBORw0") ? `data:image/png;base64,${msg.content}` : ""
                                                    )
                                                )
                                            )
                                        }
                                        alt="Foto"
                                        style={{ maxWidth: "100%", maxHeight: "240px", objectFit: "cover", display: "block", borderRadius: "8px" }}
                                    />
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

                            {/* Document / File Card */}
                            {isDocumentMessage && (
                                <div
                                    onClick={handleDownloadDocument}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "10px",
                                        padding: "8px 12px", borderRadius: "10px",
                                        background: "rgba(0, 0, 0, 0.28)",
                                        border: `1px solid ${isMine ? "rgba(255, 60, 95, 0.35)" : "rgba(255,255,255,0.12)"}`,
                                        cursor: "pointer", minWidth: "180px"
                                    }}
                                    title="Toca para descargar archivo"
                                >
                                    <span style={{ fontSize: "1.8rem" }}>{getFileIcon(documentName)}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {documentName}
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.75)", fontFamily: "JetBrains Mono, monospace" }}>
                                            {formatBytes(documentSize) || "Documento"} · Toca para guardar
                                        </div>
                                    </div>
                                    <span style={{ fontSize: "1.1rem", opacity: 0.9 }}>⬇️</span>
                                </div>
                            )}

                            {/* Tactical GPS Location Card */}
                            {isLocationMessage && locationCoords && (
                                <div style={{
                                    borderRadius: "10px", padding: "10px 12px",
                                    background: "rgba(0, 0, 0, 0.32)",
                                    border: `1px solid ${isMine ? "rgba(255, 60, 95, 0.35)" : "rgba(0,230,118,0.3)"}`,
                                    display: "flex", flexDirection: "column", gap: "6px"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "0.85rem", color: "var(--accent-emerald)" }}>
                                        <span>📍</span>
                                        <span>COORDENADA TÁCTICA GPS</span>
                                    </div>
                                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.78rem", fontWeight: 700, color: "#FFFFFF" }}>
                                        Lat: {locationCoords[1]}<br/>
                                        Lon: {locationCoords[2]}
                                    </div>
                                    <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard?.writeText(`${locationCoords[1]}, ${locationCoords[2]}`);
                                            }}
                                            style={{
                                                flex: 1, padding: "5px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)",
                                                background: "rgba(255,255,255,0.1)",
                                                color: "#FFFFFF", fontSize: "0.68rem", fontWeight: 700, cursor: "pointer"
                                            }}
                                        >
                                            📋 Copiar
                                        </button>
                                        <a
                                            href={`https://maps.google.com/?q=${locationCoords[1]},${locationCoords[2]}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                flex: 1, padding: "5px 8px", borderRadius: "6px", textAlign: "center", textDecoration: "none",
                                                background: "var(--accent-emerald)",
                                                color: "#000000", fontSize: "0.68rem", fontWeight: 800
                                            }}
                                        >
                                            🗺️ Abrir Mapa
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Poll */}
                            {msg.msg_type === "poll" && (
                                <PollMessage msg={msg} onVote={optIdx => onVote(msg.id, optIdx)} />
                            )}

                            {/* Standard Text content */}
                            {!isDocumentMessage && !isLocationMessage && msg.msg_type !== "voice" && msg.msg_type !== "audio" && msg.msg_type !== "poll" && msg.msg_type !== "image" && msg.msg_type !== "video" && msg.content && !msg.content.startsWith("data:") && !msg.content.startsWith("/9j/") && !msg.content.startsWith("iVBORw0") && !msg.content.startsWith("[Image]") && !msg.content.startsWith("[Voice Note]") && !msg.content.startsWith("[Video]") && !msg.content.startsWith('{"text":') && (
                                <div style={{ fontSize: "0.92rem", lineHeight: 1.48, fontWeight: 500, color: "#FFFFFF", wordBreak: "break-word" }}>
                                    {msg.content}
                                </div>
                            )}
                        </>
                    )}

                    {/* Timestamp & Status footer */}
                    <div style={{
                        display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "4px",
                        fontSize: "0.65rem", color: isMine ? "rgba(255,255,255,0.72)" : "var(--text-muted)",
                        fontFamily: "JetBrains Mono, monospace", marginTop: "1px"
                    }}>
                        {isEdited && !isDeleted && <span>(editado)</span>}
                        <span>{timeStr(msg.timestamp)}</span>
                        {isMine && !isDeleted && (
                            <span style={{ fontSize: "0.75rem", fontWeight: 900, color: checkColor }}>
                                {checkSymbol}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Reaction Badges Container */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && !isDeleted && (
                <div style={{
                    display: "flex", flexWrap: "wrap", gap: "4px",
                    justifyContent: isMine ? "flex-end" : "flex-start",
                    margin: "-2px 8px 4px 8px"
                }}>
                    {Object.entries(msg.reactions).map(([emoji, senders]) => (
                        <button
                            key={emoji}
                            onClick={() => onReaction(msg.id, emoji)}
                            style={{
                                display: "flex", alignItems: "center", gap: "3px",
                                background: "rgba(18,20,36,0.9)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: "12px",
                                padding: "2px 6px",
                                fontSize: "0.75rem",
                                color: "#fff",
                                cursor: "pointer",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.4)"
                            }}
                        >
                            <span>{emoji}</span>
                            <span style={{ fontSize: "0.65rem", fontWeight: 800 }}>{senders.length}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Image Viewer Lightbox Fallback */}
            {viewingImageSrc && (
                <ImageViewerModal src={viewingImageSrc} onClose={() => setViewingImageSrc(null)} />
            )}
        </React.Fragment>
    );
});
