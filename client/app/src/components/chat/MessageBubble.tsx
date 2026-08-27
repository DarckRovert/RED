"use client";

import React, { memo, useState, useRef, useCallback, useEffect } from "react";
import { MessageItem, redeemP2PVoucher } from "../../lib/api";
import { indexedMediaVault } from "../../lib/indexedMediaVault";
import { AutoDestructEngine } from "../../lib/AutoDestructEngine";
import { toast } from "../Toast";
import { VoiceMessage } from "./VoiceMessage";
import { PollMessage } from "./PollMessage";
import { ImageViewerModal } from "./ImageViewerModal";
import { LocalAIEngine } from "../../lib/localAiEngine";
import { useRedStore } from "../../store/useRedStore";
import { useTranslation } from "../../lib/i18n/i18nEngine";

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
    onForward?: (msg: MessageItem) => void;
    onEdit?: (msg: MessageItem) => void;
    onDeleteForEveryone?: (msgId: string) => void;
    onOpenMediaGallery?: (msg: MessageItem) => void;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: (msgId: string) => void;
    onSelectMode?: (msg: MessageItem) => void;
    isGroupChat?: boolean;
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

function renderFormattedContent(content: string) {
    if (!content) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    return parts.map((part, i) => {
        if (part.match(urlRegex)) {
            return (
                <a
                    key={i}
                    href={part}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ color: "var(--accent-cyan, #00E5FF)", textDecoration: "underline", wordBreak: "break-all" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {part}
                </a>
            );
        }
        const mentionRegex = /(@[a-zA-Z0-9_\u00C0-\u017F]+)/g;
        const subParts = part.split(mentionRegex);
        return subParts.map((sub, j) => {
            if (sub.startsWith('@')) {
                return (
                    <span
                        key={`${i}-${j}`}
                        style={{
                            color: "var(--accent-cyan, #00E5FF)",
                            fontWeight: 800,
                            background: "rgba(0, 229, 255, 0.12)",
                            padding: "1px 4px",
                            borderRadius: "4px"
                        }}
                    >
                        {sub}
                    </span>
                );
            }
            return sub;
        });
    });
}

const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

// Context menu floating
function ContextMenu({
    x, y, isMine, isDeleted, onReply, onForward, onCopy, onPin, onEdit, onDeleteForEveryone, onDeleteLocal, onSelect, onReact, onTranslate, onAskCopilot, onClose
}: {
    x: number; y: number; isMine: boolean; isDeleted: boolean;
    onReply: () => void; onForward?: () => void; onCopy: () => void; onPin?: () => void;
    onEdit?: () => void; onDeleteForEveryone?: () => void; onDeleteLocal: () => void;
    onSelect?: () => void; onReact: (e: string) => void;
    onTranslate?: () => void; onAskCopilot?: () => void; onClose: () => void;
}) {
    const { t } = useTranslation();
    return (
        <>
            {/* Backdrop */}
            <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
            {/* Reaction bar */}
            {!isDeleted && (
                <div style={{
                    position: "fixed",
                    left: Math.max(12, Math.min(x - 40, typeof window !== "undefined" ? window.innerWidth - 260 : 100)),
                    top: Math.max(12, Math.min(y - 60, typeof window !== "undefined" ? window.innerHeight - 100 : 100)),
                    zIndex: 1000,
                    display: "flex", gap: "6px",
                    background: "rgba(18,20,36,0.97)", backdropFilter: "blur(16px)",
                    borderRadius: "40px", padding: "8px 14px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                    animation: "contextMenuIn 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
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
                left: Math.max(12, Math.min(x - 20, typeof window !== "undefined" ? window.innerWidth - 220 : 100)),
                top: Math.max(60, Math.min(y - 10, typeof window !== "undefined" ? window.innerHeight - 380 : 200)),
                zIndex: 1000,
                background: "rgba(18,20,36,0.97)", backdropFilter: "blur(16px)",
                borderRadius: "14px", overflow: "hidden", minWidth: "190px",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                animation: "contextMenuIn 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
            }}>
                {[
                    ...(!isDeleted ? [{ label: t.chat_extended?.reply_to || "Responder", icon: "↩️", action: onReply }] : []),
                    ...(!isDeleted && onTranslate ? [{ label: "Traducir con IA", icon: "🌐", action: onTranslate }] : []),
                    ...(!isDeleted && onAskCopilot ? [{ label: "Consultar a Copiloto", icon: "🤖", action: onAskCopilot }] : []),
                    ...(!isDeleted && onForward ? [{ label: t.chat_extended?.forward_btn || "Reenviar", icon: "➡️", action: onForward }] : []),
                    ...(!isDeleted ? [{ label: t.radar?.copy_did || "Copiar", icon: "📋", action: onCopy }] : []),
                    ...(!isDeleted && onSelect ? [{ label: "Seleccionar", icon: "☑️", action: onSelect }] : []),
                    ...(onPin && !isDeleted ? [{ label: "Fijar Mensaje", icon: "📌", action: onPin }] : []),
                    ...(onEdit && isMine && !isDeleted ? [{ label: t.profile?.edit_alias || "Editar", icon: "✏️", action: onEdit }] : []),
                    ...(onDeleteForEveryone && isMine && !isDeleted ? [{ label: t.chat?.wipe_chat || "Eliminar para todos", icon: "🗑️", action: onDeleteForEveryone, danger: true }] : []),
                    { label: t.chat?.delete_chat || "Eliminar", icon: "❌", action: onDeleteLocal, danger: true },
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
    onLongPress, onCancelLongPress, onReaction, onVote, onPin, onReply, onForward, onEdit, onDeleteForEveryone, onOpenMediaGallery,
    isSelectionMode = false, isSelected = false, onToggleSelect, onSelectMode,
    isGroupChat,
}: MessageBubbleProps) => {
    const { t } = useTranslation();
    const [viewingImageSrc, setViewingImageSrc] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [swipeOffset, setSwipeOffset] = useState<number>(0);
    const [resolvedImage, setResolvedImage] = useState<string>("");
    const [isRedeemed, setIsRedeemed] = useState<boolean>(false);
    const touchStartCoords = useRef<{ x: number; y: number } | null>(null);
    const longPressTimer = useRef<any>(null);

    const tl = isMine ? (isFirst ? 16 : 6) : 16;
    const tr = isMine ? 16 : (isFirst ? 16 : 6);
    const br = isMine ? (isLast ? 6 : 16) : (isLast ? 16 : 6);
    const bl = isMine ? 6 : (isLast ? 6 : 16);

    const isSystem = msg.msg_type === "system";
    const isDeleted = Boolean(msg.is_deleted);
    const isEdited = Boolean(msg.is_edited || (msg as any).edited);
    const isForwarded = Boolean((msg as any).forwarded);

    // Ephemeral / Self-Destruct Message Countdown Manager
    const [burnSecondsLeft, setBurnSecondsLeft] = useState<number | null>(null);

    useEffect(() => {
        if (!msg.id || isDeleted) return;

        // Register to engine for guaranteed persistence purge
        AutoDestructEngine.registerMessage(msg);

        const nowSec = Date.now() / 1000;
        let expiresAt: number | null = null;
        if (msg.expires_at && msg.expires_at > 0) {
            expiresAt = msg.expires_at;
        } else if (msg.ttl && msg.ttl > 0) {
            const base = msg.timestamp > 1e11 ? msg.timestamp / 1000 : (msg.timestamp || nowSec);
            expiresAt = base + msg.ttl;
        }

        if (!expiresAt) return;

        const updateCountdown = () => {
            const current = Date.now() / 1000;
            const diff = Math.max(0, Math.ceil(expiresAt! - current));
            setBurnSecondsLeft(diff);
            if (diff <= 0) {
                AutoDestructEngine.purgeMessage(msg.id);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [msg.id, msg.expires_at, msg.ttl, msg.timestamp, isDeleted]);

    // Resolve Image from IndexedDB if stored as red_vault://
    const rawImageCandidate = msg.media_data || (
        msg.content?.startsWith("data:image") ? msg.content : (
            msg.content?.startsWith("/9j/") ? `data:image/jpeg;base64,${msg.content}` : (
                msg.content?.startsWith("iVBORw0") ? `data:image/png;base64,${msg.content}` : (
                    msg.content?.startsWith("red_vault://") ? msg.content : null
                )
            )
        )
    );

    useEffect(() => {
        let active = true;
        if (rawImageCandidate) {
            if (rawImageCandidate.startsWith("red_vault://")) {
                indexedMediaVault.resolveMediaUrl(rawImageCandidate).then(resolved => {
                    if (active) setResolvedImage(resolved);
                }).catch(() => {
                    if (active) setResolvedImage("");
                });
            } else {
                setResolvedImage(rawImageCandidate);
            }
        }
        return () => { active = false; };
    }, [rawImageCandidate]);

    // Payment / Voucher message detector
    const isPaymentMessage = msg.msg_type === "p2p_payment" || msg.msg_type === "p2p_voucher" || (
        typeof msg.content === "string" && msg.content.includes('"voucher_id"') && msg.content.includes('"amount"')
    );

    let paymentData: any = null;
    if (isPaymentMessage) {
        try {
            paymentData = typeof msg.content === "string" && msg.content.startsWith("{") ? JSON.parse(msg.content) : msg;
            if (paymentData.voucher) paymentData = paymentData.voucher;
        } catch {}
    }

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

        if (diffY > 18) {
            clearTimeout(longPressTimer.current);
            setSwipeOffset(0);
            return;
        }

        // Swipe right to reply gesture with haptics
        if (diffX > 0 && diffX < 90) {
            clearTimeout(longPressTimer.current);
            if (diffX > 45 && swipeOffset <= 45 && typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(15);
            }
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
        if (msg.content && !msg.content.startsWith("data:") && !msg.content.startsWith("red_vault://")) {
            navigator.clipboard?.writeText(msg.content);
        }
    };

    const handleDownloadDocument = () => {
        const url = resolvedImage || msg.media_data || msg.content;
        if (!url || (!url.startsWith("data:") && !url.startsWith("blob:"))) return;
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

    const [translatedText, setTranslatedText] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);

    const handleTranslate = async () => {
        if (!msg.content) return;
        setIsTranslating(true);
        try {
            const res = await LocalAIEngine.translateText(msg.content, 'es');
            setTranslatedText(res.translatedText);
            toast.success("🌐 Traducción táctica generada con IA Local");
        } catch {
            toast.error("Error al traducir mensaje");
        } finally {
            setIsTranslating(false);
        }
    };

    const handleAskCopilot = () => {
        if (!msg.content) return;
        if (typeof window !== "undefined") {
            try {
                localStorage.setItem("red_copilot_quick_query", msg.content);
            } catch {}
            useRedStore.getState().navigate("aiCopilot");
            toast.info("🤖 Contexto del mensaje enviado al Copiloto");
        }
    };

    // Vital Sign / Triage Medical Card detector
    const isVitalSignMessage = msg.msg_type === "vital_sign" || (typeof msg.content === "string" && msg.content.includes("🫀 FICHA MÉDICA"));
    let vitalData: any = null;
    if (isVitalSignMessage && typeof msg.content === "string" && msg.content.startsWith("{")) {
        try { vitalData = JSON.parse(msg.content); } catch {}
    }

    if (isSystem) {
        return (
            <div style={{ textAlign: "center", padding: "6px 12px", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                🔐 {msg.content}
            </div>
        );
    }

    if (msg.msg_type === 'conversation_wipe' || msg.msg_type === 'message_wipe' || (typeof msg.content === 'string' && msg.content.includes('"user_remote_wipe"'))) {
        return (
            <div style={{ textAlign: "center", padding: "8px 14px", margin: "6px auto", maxWidth: "85%", borderRadius: "8px", background: "rgba(255,51,85,0.08)", border: "1px solid rgba(255,51,85,0.2)", fontSize: "0.72rem", color: "#FF5252", fontFamily: "JetBrains Mono, monospace" }}>
                ⚠️ Historial de conversación purgado remotamente
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
                    onForward={onForward ? () => onForward(msg) : undefined}
                    onCopy={handleCopy}
                    onPin={onPin ? () => onPin(msg) : undefined}
                    onEdit={onEdit ? () => onEdit(msg) : undefined}
                    onDeleteForEveryone={onDeleteForEveryone ? () => onDeleteForEveryone(msg.id) : undefined}
                    onDeleteLocal={() => onLongPress({} as any, msg)}
                    onSelect={onSelectMode ? () => onSelectMode(msg) : undefined}
                    onReact={(e) => onReaction(msg.id, e)}
                    onTranslate={msg.content && !msg.content.startsWith("data:") ? handleTranslate : undefined}
                    onAskCopilot={msg.content && !msg.content.startsWith("data:") ? handleAskCopilot : undefined}
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
                {/* Multi-selection Checkbox Indicator */}
                {isSelectionMode && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelect?.(msg.id);
                        }}
                        style={{
                            width: "22px", height: "22px", borderRadius: "50%",
                            border: `2px solid ${isSelected ? "var(--accent-red, #E8213A)" : "rgba(255,255,255,0.4)"}`,
                            background: isSelected ? "var(--accent-red, #E8213A)" : "rgba(0,0,0,0.4)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: "0.75rem", fontWeight: 900, cursor: "pointer",
                            flexShrink: 0, margin: isMine ? "0 0 6px 6px" : "0 6px 6px 0",
                            transition: "all 0.15s ease"
                        }}
                    >
                        {isSelected && "✓"}
                    </div>
                )}

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
                        padding: (msg.msg_type === "image" || resolvedImage) && !isPaymentMessage ? "4px" : "8px 12px",
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
                    {/* Group Chat Sender Nickname */}
                    {isGroupChat && !isMine && !isDeleted && (
                        <div style={{
                            display: "flex", alignItems: "center", gap: "6px",
                            fontSize: "0.72rem", fontWeight: 800,
                            color: "var(--accent-cyan, #00E5FF)",
                            marginBottom: "1px", letterSpacing: "0.2px"
                        }}>
                            <span>{msg.sender_name || (msg.sender ? `Operador ${msg.sender.substring(0, 8)}` : "Miembro")}</span>
                            {msg.sender && (
                                <span style={{ fontSize: "0.58rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                                    {msg.sender.substring(0, 6)}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Forwarded Message Header */}
                    {isForwarded && !isDeleted && (
                        <div style={{
                            display: "flex", alignItems: "center", gap: "4px",
                            fontSize: "0.68rem", color: isMine ? "rgba(255, 255, 255, 0.75)" : "var(--accent-cyan)",
                            fontWeight: 700, fontStyle: "italic", marginBottom: "2px"
                        }}>
                            <span>↩️ {t.chat_extended?.forward_btn || "Reenviado"}</span>
                        </div>
                    )}

                    {/* Ephemeral / Self-Destruct Burning Countdown Pill */}
                    {burnSecondsLeft !== null && burnSecondsLeft > 0 && !isDeleted && (
                        <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "3px 8px", borderRadius: "6px",
                            background: "rgba(255, 68, 68, 0.18)",
                            border: "1px solid rgba(255, 82, 82, 0.35)",
                            fontSize: "0.66rem", fontWeight: 800,
                            color: "#FF5252", fontFamily: "JetBrains Mono, monospace",
                            marginBottom: "2px", letterSpacing: "0.3px",
                            animation: "pulse 2s infinite"
                        }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <span>🔥</span>
                                <span>{t.settings?.burner_title ? "Expira" : "Expira en"}</span>
                            </span>
                            <span>
                                {Math.floor(burnSecondsLeft / 60)}:{(burnSecondsLeft % 60).toString().padStart(2, '0')}
                            </span>
                        </div>
                    )}

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
                                {msg.reply_to.sender ? `Operador ${msg.reply_to.sender.substring(0, 8)}` : (t.chat_extended?.reply_to || "Respondiendo a mensaje")}
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
                            {/* P2P Token Payment Card */}
                            {isPaymentMessage && (
                                <div style={{
                                    borderRadius: "12px", padding: "12px 14px",
                                    background: isMine
                                        ? "linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, rgba(0, 200, 83, 0.25) 100%)"
                                        : "linear-gradient(135deg, rgba(0, 230, 118, 0.22) 0%, rgba(20, 35, 30, 0.95) 100%)",
                                    border: "1.5px solid var(--accent-emerald)",
                                    boxShadow: "0 0 16px rgba(0, 230, 118, 0.25)",
                                    display: "flex", flexDirection: "column", gap: "8px",
                                    minWidth: "210px"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                                            <span>🪙</span>
                                            <span>PAGO P2P RED TOKEN</span>
                                        </div>
                                        <span className="badge-tactical" style={{ fontSize: "0.60rem", background: "rgba(0, 230, 118, 0.2)", color: "#00E676" }}>
                                            ED25519
                                        </span>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                        <span style={{ fontSize: "1.6rem", fontWeight: 900, color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace" }}>
                                            {paymentData?.amount || 25}
                                        </span>
                                        <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                            RED Tokens
                                        </span>
                                    </div>

                                    {paymentData?.memo && (
                                        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.85)", fontStyle: "italic" }}>
                                            💬 "{paymentData.memo}"
                                        </div>
                                    )}

                                    {!isMine ? (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const payload = paymentData?.qr_payload || `RED_PAY:${paymentData?.id || paymentData?.voucher_id}:${paymentData?.amount}:${paymentData?.signature}`;
                                                    const res = await redeemP2PVoucher(payload);
                                                    if (res.ok) {
                                                        setIsRedeemed(true);
                                                        toast.success(`🎉 ¡${paymentData?.amount || 25} RED acreditados en tu bóveda!`);
                                                    } else {
                                                        toast.info(res.error || "Vale ya procesado.");
                                                    }
                                                } catch {
                                                    toast.error("Error al canjear transferencia.");
                                                }
                                            }}
                                            disabled={isRedeemed}
                                            className="btn-tactical-primary"
                                            style={{
                                                padding: "8px 12px",
                                                fontSize: "0.78rem",
                                                fontWeight: 800,
                                                background: isRedeemed ? "rgba(255,255,255,0.1)" : "var(--accent-emerald)",
                                                color: isRedeemed ? "rgba(255,255,255,0.6)" : "#000000",
                                                borderRadius: "8px",
                                                marginTop: "4px"
                                            }}
                                        >
                                            {isRedeemed ? "✅ Acreditado en tu Bóveda" : "📥 Canjear en Bóveda (+RED)"}
                                        </button>
                                    ) : (
                                        <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.7)", fontFamily: "JetBrains Mono, monospace" }}>
                                            ✓ Enviado y firmado criptográficamente
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Media Image */}
                            {!isPaymentMessage && (msg.msg_type === "image" || Boolean(resolvedImage)) && (
                                <div
                                    className="chat-media-container"
                                    style={{ cursor: "pointer", margin: "2px 0" }}
                                    onClick={() => {
                                        if (onOpenMediaGallery) {
                                            onOpenMediaGallery(msg);
                                        } else {
                                            setViewingImageSrc(resolvedImage);
                                        }
                                    }}
                                >
                                    <img
                                        src={resolvedImage}
                                        alt="Foto adjunta"
                                        className="chat-media-img"
                                        loading="lazy"
                                    />
                                </div>
                            )}

                            {/* Media Video */}
                            {!isPaymentMessage && (msg.msg_type === "video" || msg.media_data?.startsWith("data:video") || msg.content?.startsWith("data:video")) && (
                                <div className="chat-media-container" style={{ margin: "2px 0" }}>
                                    <video 
                                        src={msg.media_data || (msg.content?.startsWith("data:video") ? msg.content : "")} 
                                        controls 
                                        playsInline 
                                        style={{ maxWidth: "100%", maxHeight: "min(260px, 42vh)", borderRadius: "10px", display: "block", background: "#000" }} 
                                    />
                                </div>
                            )}

                            {/* Audio Voice */}
                            {!isPaymentMessage && (msg.msg_type === "voice" || msg.msg_type === "audio" || msg.media_data?.startsWith("data:audio") || msg.content?.startsWith("data:audio")) && (
                                <VoiceMessage msg={msg} isMine={isMine} />
                            )}

                            {/* Document / File Card */}
                            {!isPaymentMessage && isDocumentMessage && (
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
                            {!isPaymentMessage && isLocationMessage && locationCoords && (
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

                            {/* Medical VitalScan / START Triage Card */}
                            {!isPaymentMessage && isVitalSignMessage && (
                                <div style={{
                                    borderRadius: "12px", padding: "10px 12px",
                                    background: isMine ? "linear-gradient(135deg, rgba(232,33,58,0.2) 0%, rgba(170,18,40,0.35) 100%)" : "rgba(10, 14, 28, 0.95)",
                                    border: "1.5px solid var(--accent-crimson, #FF3355)",
                                    boxShadow: "0 0 14px rgba(255,51,85,0.25)",
                                    display: "flex", flexDirection: "column", gap: "6px", minWidth: "220px"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.76rem", fontWeight: 900, color: "#FF5252", fontFamily: "JetBrains Mono, monospace" }}>
                                            <span>🫀</span>
                                            <span>FICHA MÉDICA TRIAJE</span>
                                        </div>
                                        <span className="badge-tactical" style={{
                                            fontSize: "0.62rem", fontWeight: 900,
                                            background: vitalData?.triage === "ROJO" || (msg.content && msg.content.includes("ROJO")) ? "#FF3355" :
                                                (vitalData?.triage === "AMARILLO" || (msg.content && msg.content.includes("AMARILLO")) ? "#FFB300" :
                                                (vitalData?.triage === "VERDE" || (msg.content && msg.content.includes("VERDE")) ? "#00E676" : "#2A2E3D")),
                                            color: vitalData?.triage === "AMARILLO" || (msg.content && msg.content.includes("AMARILLO")) ? "#000" : "#FFF"
                                        }}>
                                            {vitalData?.triage || "START TRIAJE"}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "4px 0" }}>
                                        {vitalData?.bpm && (
                                            <div>
                                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Frecuencia</div>
                                                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#FFF", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {vitalData.bpm} <span style={{ fontSize: "0.7rem", color: "#FF5252" }}>BPM</span>
                                                </div>
                                            </div>
                                        )}
                                        {vitalData?.spo2 && (
                                            <div>
                                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Oxígeno</div>
                                                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {vitalData.spo2}% <span style={{ fontSize: "0.7rem", color: "var(--accent-cyan)" }}>SpO2</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.9)", fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "4px" }}>
                                        {vitalData?.notes || (msg.content && !msg.content.startsWith("{") ? msg.content : "Evaluación médica táctica registrada en la malla.")}
                                    </div>
                                </div>
                            )}

                            {/* P2P Decentralized Poll Card */}
                            {msg.msg_type === "poll" && (
                                <PollMessage msg={msg} onVote={(optIdx) => onVote(msg.id, optIdx)} />
                            )}

                            {/* Standard Text content — with URL & mention highlighting */}
                            {!isPaymentMessage && !isVitalSignMessage && !isDocumentMessage && !isLocationMessage && msg.msg_type !== "voice" && msg.msg_type !== "audio" && msg.msg_type !== "poll" && msg.msg_type !== "image" && !resolvedImage && msg.msg_type !== "video" && msg.content && !msg.content.startsWith("data:") && !msg.content.startsWith("red_vault://") && !msg.content.startsWith("/9j/") && !msg.content.startsWith("iVBORw0") && !msg.content.startsWith("[Image]") && !msg.content.startsWith("[Voice Note]") && !msg.content.startsWith("[Video]") && !msg.content.startsWith('{"text":') && (
                                <div style={{ fontSize: "0.92rem", lineHeight: 1.48, fontWeight: 500, color: "#FFFFFF", wordBreak: "break-word" }}>
                                    {renderFormattedContent(msg.content)}
                                </div>
                            )}

                            {/* Inline AI Translation Pill Box */}
                            {translatedText && (
                                <div style={{
                                    marginTop: "4px", padding: "6px 10px", borderRadius: "8px",
                                    background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.3)",
                                    fontSize: "0.82rem", color: "#E0F7FA", animation: "fadeIn 0.2s ease"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                                        <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                            🌐 TRADUCCIÓN IA LOCAL
                                        </span>
                                        <button onClick={() => setTranslatedText(null)} style={{ background: "none", border: "none", color: "var(--accent-cyan)", cursor: "pointer", fontSize: "0.7rem", padding: 0 }}>
                                            ✕
                                        </button>
                                    </div>
                                    <div>{translatedText}</div>
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
                        {/* Flame self-destruct countdown */}
                        {burnSecondsLeft !== null && burnSecondsLeft > 0 && !isDeleted && (
                            <span style={{
                                display: "inline-flex", alignItems: "center", gap: "2px",
                                color: burnSecondsLeft <= 10 ? "#FF4B6B" : "rgba(255,180,0,0.95)",
                                fontWeight: 800, animation: burnSecondsLeft <= 10 ? "pulse 0.6s infinite alternate" : "none"
                            }}>
                                🔥{burnSecondsLeft < 3600
                                    ? `${Math.floor(burnSecondsLeft / 60)}:${String(burnSecondsLeft % 60).padStart(2, "0")}`
                                    : `${Math.floor(burnSecondsLeft / 3600)}h`
                                }
                            </span>
                        )}
                        {isForwarded && !isDeleted && (
                            <span style={{ opacity: 0.7, fontSize: "0.6rem" }}>↪ reenviado</span>
                        )}
                        {isEdited && !isDeleted && <span>(editado)</span>}
                        <span>{timeStr(msg.timestamp)}</span>
                        {isMine && !isDeleted && (
                            <span style={{ fontSize: "0.75rem", fontWeight: 900, color: checkColor }}>
                                {checkSymbol}
                            </span>
                        )}
                    </div>

                    {/* Reactions Pill List */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && !isDeleted && (
                        <div style={{
                            display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "2px",
                            justifyContent: isMine ? "flex-end" : "flex-start"
                        }}>
                            {Object.entries(msg.reactions).map(([emoji, senders]) => {
                                if (!Array.isArray(senders) || senders.length === 0) return null;
                                return (
                                    <button
                                        key={emoji}
                                        onClick={() => onReaction(msg.id, emoji)}
                                        style={{
                                            display: "inline-flex", alignItems: "center", gap: "3px",
                                            padding: "2px 6px", borderRadius: "12px",
                                            background: "rgba(0, 0, 0, 0.45)",
                                            border: "1px solid rgba(255, 255, 255, 0.15)",
                                            fontSize: "0.72rem", color: "#FFFFFF", cursor: "pointer",
                                            boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
                                        }}
                                    >
                                        <span>{emoji}</span>
                                        <span style={{ fontSize: "0.62rem", fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>
                                            {senders.length}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox Modal */}
            {viewingImageSrc && (
                <ImageViewerModal
                    src={viewingImageSrc}
                    onClose={() => setViewingImageSrc(null)}
                />
            )}
        </React.Fragment>
    );
});
