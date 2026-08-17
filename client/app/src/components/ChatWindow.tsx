"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { MessageItem, RedAPI, summarizeChannelAI, translateTextAI } from "../lib/api";
import { mediaChunker } from "../lib/mesh/mediaChunker";
import { MessageBubble } from "./chat/MessageBubble";
import { ChatInput } from "./chat/ChatInput";
import { toast } from "./Toast";
import { meshRouter } from "../lib/mesh/meshRouter";
import { TacticalAudioEngine } from "../lib/TacticalAudioEngine";
import { SettingsManager } from "../lib/settingsManager";

/* ── Avatar helpers ───────────────────────────────────────────────────────── */
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
    return { background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: `0 2px 12px ${a}55` };
}

/* ── Main ChatWindow Component ────────────────────────────────────────────── */
export default function ChatWindow() {
    const {
        activeConversationId, conversations, contacts, groups, messages,
        sendMessage, sendTyping, goBack, navigate, peerTyping, addContact,
        deleteMessage, editMessage, clearConversation, starMessage, starredMessages,
        identity, peerPresence, markAsRead, preferences,
    } = useRedStore();

    const canonicalFromMesh = activeConversationId ? meshRouter.getCanonicalId(activeConversationId) : '';
    const activeConv = conversations.find(c => c && (
        c.id === activeConversationId || 
        c.peer === activeConversationId || 
        (canonicalFromMesh && (c.peer === canonicalFromMesh || c.id === canonicalFromMesh))
    ));
    
    const rawPeerHash = activeConv?.peer || (
        canonicalFromMesh && canonicalFromMesh.length === 64 ? canonicalFromMesh : (
            activeConversationId?.includes('-') ? activeConversationId.split('-')[1] : (activeConversationId || '')
        )
    );
    const peerHash = rawPeerHash.replace(/^did:red:/i, '').split(':')[0].trim().toLowerCase();
    const peerContact = contacts.find((c: any) => 
        c.identity_hash === peerHash ||
        (canonicalFromMesh && c.identity_hash === canonicalFromMesh) ||
        (peerHash.length >= 8 && c.identity_hash.startsWith(peerHash)) ||
        (c.identity_hash.length >= 8 && peerHash.startsWith(c.identity_hash))
    );
    // Full 64-character identity hash of peer for crypto & WebRTC signaling
    const fullPeerHash = activeConv?.peer || peerContact?.identity_hash || (
        canonicalFromMesh && canonicalFromMesh.length === 64 ? canonicalFromMesh : (
            peerHash && peerHash.length === 64 ? peerHash : (
                contacts.find((c: any) => peerHash && peerHash.length >= 8 && c.identity_hash.includes(peerHash))?.identity_hash || peerHash
            )
        )
    );
    const peerName = peerContact?.display_name || (peerHash ? `${peerHash.substring(0, 12)}…` : "Desconocido");

    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const [burnTimer, setBurnTimer] = useState<number | undefined>(undefined);
    const [isSummarizing, setIsSummarizing] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const convMessages = useMemo(() => {
        const list = Array.isArray(messages) ? messages : ((messages as any)?.[activeConversationId || ""] || []);
        return [...list];
    }, [messages, activeConversationId]);

    const scrollToBottom = useCallback((smooth = true) => {
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }, []);

    useEffect(() => {
        scrollToBottom(false);
        // Mark conversation as read when opened
        if (activeConversationId) markAsRead(activeConversationId);
    }, [activeConversationId]);

    useEffect(() => {
        scrollToBottom(true);
    }, [convMessages.length]);

    const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
    const mediaInputRef = useRef<HTMLInputElement | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordSec, setRecordSec] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordTimerRef = useRef<any>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    // Voice preview state
    const [voicePreviewBlob, setVoicePreviewBlob] = useState<Blob | null>(null);
    const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
    const [voiceDurationSec, setVoiceDurationSec] = useState(0);
    // Media preview state
    const [mediaPreview, setMediaPreview] = useState<{ dataUrl: string; type: "image" | "video"; mimeType: string; caption: string } | null>(null);

    const isOnline = peerPresence?.[peerHash] === 'online' || peerPresence?.[peerHash] === 'nearby';

    const handleSendText = async (text: string, replyToId?: string) => {
        if (!text.trim() || !peerHash) return;
        try {
            await sendMessage(text.trim(), { msg_type: "text", reply_to_id: replyToId || replyTo?.id });
            TacticalAudioEngine.playMessageSent();
            setReplyTo(null);
        } catch {
            toast.error("Error al enviar mensaje");
        }
    };

    const handleSendVoice = async (blob?: Blob) => {
        if (!blob || !peerHash) return;
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const b64 = reader.result as string;
                await sendMessage(b64, { msg_type: "voice", duration_ms: recordSec * 1000 });
            };
            reader.readAsDataURL(blob);
            toast.success("Nota de voz enviada");
        } catch {
            toast.error("Error al enviar nota de voz");
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            const mr = new MediaRecorder(stream);
            mediaRecorderRef.current = mr;
            mr.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            mr.start(100);
            setIsRecording(true);
            setRecordSec(0);
            recordTimerRef.current = setInterval(() => {
                setRecordSec(s => s + 1);
            }, 1000);
        } catch (e) {
            console.error("Error al iniciar grabación de audio:", e);
            toast.error("Permiso de micrófono denegado");
        }
    };

    const stopRecording = async () => {
        if (!isRecording) return;
        setIsRecording(false);
        if (recordTimerRef.current) {
            clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
        }
        const mr = mediaRecorderRef.current;
        if (mr && mr.state !== "inactive") {
            mr.stop();
            mr.stream.getTracks().forEach(t => t.stop());
            await new Promise(resolve => { mr.onstop = resolve; });
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            if (blob.size > 100) {
                // Show preview instead of sending directly
                const url = URL.createObjectURL(blob);
                setVoicePreviewBlob(blob);
                setVoicePreviewUrl(url);
                setVoiceDurationSec(recordSec);
            }
        }
    };

    const cancelVoicePreview = () => {
        if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
        setVoicePreviewBlob(null);
        setVoicePreviewUrl(null);
        setVoiceDurationSec(0);
    };

    const confirmVoiceSend = async () => {
        if (!voicePreviewBlob) return;
        const blob = voicePreviewBlob;
        const dur = voiceDurationSec;
        cancelVoicePreview();
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const b64 = reader.result as string;
                await sendMessage(b64, { msg_type: "voice", duration_ms: dur * 1000 });
                TacticalAudioEngine.playMessageSent();
            };
            reader.readAsDataURL(blob);
            toast.success("Nota de voz enviada");
        } catch { toast.error("Error al enviar nota de voz"); }
    };

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const compConfig = SettingsManager.getImageCompressionConfig(preferences?.imageCompression);
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;
                    const maxDim = compConfig.maxDim;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        resolve(e.target?.result as string);
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL("image/jpeg", compConfig.qualityFactor));
                };
                img.onerror = () => resolve(e.target?.result as string);
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleGallery = () => {
        if (mediaInputRef.current) {
            mediaInputRef.current.removeAttribute("capture");
            mediaInputRef.current.accept = "image/*,video/*";
            mediaInputRef.current.click();
        }
    };

    const handleCamera = () => {
        if (mediaInputRef.current) {
            mediaInputRef.current.setAttribute("capture", "environment");
            mediaInputRef.current.accept = "image/*";
            mediaInputRef.current.click();
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !peerHash) return;
        e.target.value = "";

        try {
            if (file.type.startsWith("video/")) {
                if (file.size > 15 * 1024 * 1024) {
                    toast.error("El video no puede superar 15 MB");
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (ev.target?.result) {
                        // Show preview first
                        setMediaPreview({ dataUrl: ev.target.result as string, type: "video", mimeType: file.type || "video/mp4", caption: "" });
                    }
                };
                reader.readAsDataURL(file);
            } else {
                const compressedB64 = await compressImage(file);
                // Show preview first
                setMediaPreview({ dataUrl: compressedB64, type: "image", mimeType: "image/jpeg", caption: "" });
            }
        } catch (err) {
            console.error("Error al procesar archivo:", err);
            toast.error("Error al enviar multimedia");
        }
    };

    const confirmMediaSend = async () => {
        if (!mediaPreview) return;
        const { dataUrl, type, mimeType, caption } = mediaPreview;
        setMediaPreview(null);
        try {
            await sendMessage(dataUrl, { msg_type: type, mime_type: mimeType });
            TacticalAudioEngine.playMessageSent();
            if (caption.trim()) {
                await sendMessage(caption.trim(), { msg_type: "text" });
            }
            toast.success(type === "video" ? "Video enviado" : "Foto enviada");
        } catch {
            toast.error("Error al enviar multimedia");
        }
    };

    const handleLocation = async () => {
        if (!peerHash) return;
        try {
            if (typeof navigator !== "undefined" && "geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        const lat = pos.coords.latitude.toFixed(6);
                        const lon = pos.coords.longitude.toFixed(6);
                        const locText = `📍 Ubicación Táctica: ${lat}, ${lon}\nhttps://maps.google.com/?q=${lat},${lon}`;
                        await sendMessage(locText, { msg_type: "text" });
                        toast.success("Ubicación GPS enviada");
                    },
                    () => {
                        toast.error("No se pudo obtener la ubicación GPS");
                    },
                    { enableHighAccuracy: true, timeout: 5000 }
                );
            }
        } catch {
            toast.error("Error al obtener ubicación");
        }
    };

    const handleReaction = async (msgId: string, emoji: string) => {
        if (!peerHash) return;
        try {
            await sendMessage(emoji, { msg_type: "reaction", reply_to_id: msgId });
            toast.success(`Reacción ${emoji} enviada`);
        } catch {
            // handled
        }
    };

    const handleVote = async (msgId: string, optIdx: number) => {
        try {
            await sendMessage(String(optIdx), { msg_type: "poll_vote", reply_to_id: msgId });
            toast.success("Voto registrado");
        } catch {
            // handled
        }
    };

    const handleLongPress = (e: any, msg: MessageItem) => {
        if (msg.content && typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(msg.content);
            toast.info("Mensaje copiado");
        }
    };

    const handleSummarize = async () => {
        if (convMessages.length === 0) return;
        setIsSummarizing(true);
        try {
            const msgStrings = convMessages.map(m => `${m.sender.substring(0, 6)}: ${m.content}`);
            const summary = await summarizeChannelAI(activeConversationId || 'chat', msgStrings);
            if (summary?.summary_bullets?.length > 0) {
                toast.info(`🤖 Resumen IA:\n${summary.summary_bullets.join('\n')}`);
            }
        } catch {
            toast.error("Error al resumir conversación");
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div className="modal-screen-container">
            <input
                ref={mediaInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={handleFileSelected}
            />

            {/* Header Táctico E2E */}
            <header className="safe-header" style={{
                padding: "12px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title="Volver a la lista"
                        style={{ width: 36, height: 36 }}
                    >
                        ←
                    </button>

                    {/* Avatar del Interlocutor */}
                    <div style={{ position: "relative" }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: "50%",
                            ...avStyle(peerHash || "RED"),
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 900, color: "white", fontSize: "1rem"
                        }}>
                            {peerName[0]?.toUpperCase() || "🔴"}
                        </div>
                        <div style={{
                            position: "absolute", bottom: -1, right: -1,
                            width: 10, height: 10, borderRadius: "50%",
                            background: isOnline ? "var(--accent-emerald)" : "var(--text-muted)",
                            border: "2px solid var(--bg-void)",
                            boxShadow: isOnline ? "0 0 6px var(--accent-emerald)" : "none"
                        }} />
                    </div>

                    <div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>{peerName}</span>
                            <span className="badge-tactical badge-tactical-cyan" style={{ fontSize: "0.62rem", padding: "1px 6px" }}>NOISE E2E</span>
                        </div>
                        <div style={{ fontSize: "0.68rem", color: isOnline ? "var(--accent-emerald)" : "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                            {isOnline ? "● CONECTADO EN MALLA" : `DID: ${peerHash.substring(0, 10)}…`}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                        onClick={() => {
                            const target = fullPeerHash || peerHash;
                            navigate("call", target);
                        }}
                        className="btn-icon"
                        title="Llamada WebRTC Cifrada"
                        style={{ width: 36, height: 36, color: "var(--accent-emerald)" }}
                    >
                        📞
                    </button>

                    <button
                        onClick={handleSummarize}
                        disabled={isSummarizing}
                        className="btn-icon"
                        title="Resumen IA del Canal"
                        style={{ width: 36, height: 36, color: "var(--accent-cyan)" }}
                    >
                        {isSummarizing ? "..." : "🤖"}
                    </button>

                    <button
                        onClick={() => navigate("walkie")}
                        className="btn-icon"
                        title="Walkie Talkie PTT"
                        style={{ width: 36, height: 36, color: "var(--accent-amber)" }}
                    >
                        🎙️
                    </button>
                </div>
            </header>

            {/* Voice Preview Sheet */}
            {voicePreviewUrl && (
                <div style={{
                    position: "absolute", inset: 0, zIndex: 50,
                    background: "rgba(6,6,16,0.96)", backdropFilter: "blur(12px)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px"
                }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontFamily: "monospace" }}>Vista previa — Nota de voz</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", background: "rgba(20,22,40,0.9)", borderRadius: "40px", padding: "14px 22px", border: "1px solid var(--glass-border)" }}>
                        <span style={{ fontSize: "1.4rem" }}>🎤</span>
                        <audio src={voicePreviewUrl} controls style={{ width: "200px", accentColor: "var(--accent-cyan)" }} />
                        <span style={{ fontSize: "0.78rem", fontFamily: "monospace", color: "var(--text-muted)" }}>{voiceDurationSec}s</span>
                    </div>
                    <div style={{ display: "flex", gap: "16px" }}>
                        <button onClick={cancelVoicePreview} className="btn-tactical-secondary" style={{ padding: "10px 28px", borderRadius: "40px" }}>✕ Cancelar</button>
                        <button onClick={confirmVoiceSend} className="btn-tactical-primary" style={{ padding: "10px 28px", borderRadius: "40px" }}>➤ Enviar</button>
                    </div>
                </div>
            )}

            {/* Media Preview Sheet */}
            {mediaPreview && (
                <div style={{
                    position: "absolute", inset: 0, zIndex: 50,
                    background: "rgba(6,6,16,0.96)", backdropFilter: "blur(12px)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
                    padding: "20px 0 0 0"
                }}>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "0 16px 12px 16px" }}>
                        <button onClick={() => setMediaPreview(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "1.3rem", cursor: "pointer" }}>✕</button>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>{mediaPreview.type === "video" ? "Vista previa de video" : "Vista previa de foto"}</span>
                        <button onClick={confirmMediaSend} style={{ background: "transparent", border: "none", color: "var(--accent-cyan)", fontSize: "0.9rem", fontWeight: 800, cursor: "pointer" }}>Enviar ➤</button>
                    </div>
                    {/* Preview */}
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", overflow: "hidden" }}>
                        {mediaPreview.type === "image" ? (
                            <img src={mediaPreview.dataUrl} alt="preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "8px" }} />
                        ) : (
                            <video src={mediaPreview.dataUrl} controls muted autoPlay playsInline style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "8px" }} />
                        )}
                    </div>
                    {/* Caption input */}
                    <div style={{ width: "100%", padding: "12px 16px", background: "rgba(10,12,24,0.95)", borderTop: "1px solid var(--glass-border)" }}>
                        <input
                            type="text"
                            value={mediaPreview.caption}
                            onChange={e => setMediaPreview(p => p ? { ...p, caption: e.target.value } : p)}
                            placeholder="Añadir un comentario…"
                            style={{ width: "100%", padding: "10px 14px", background: "rgba(20,22,38,0.9)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-full)", color: "#fff", fontSize: "0.88rem", outline: "none", boxSizing: "border-box" }}
                        />
                    </div>
                </div>
            )}

            {/* Lista de Mensajes con Scroll Suave */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {convMessages.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", gap: "10px" }}>
                        <span style={{ fontSize: "2.4rem" }}>🔐</span>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>Canal Cifrado Noise Handshake</div>
                        <div style={{ fontSize: "0.75rem", maxWidth: "260px", textAlign: "center", lineHeight: 1.4 }}>
                            Los mensajes viajan cifrados de extremo a extremo y se guardan únicamente en la base local Sled DB.
                        </div>
                    </div>
                ) : (
                    convMessages.map((msg, index) => {
                        const isMine = Boolean(
                            msg.is_mine ||
                            msg.sender === "me" ||
                            (identity?.identity_hash && (
                                msg.sender?.toLowerCase() === identity.identity_hash.toLowerCase() ||
                                identity.identity_hash.toLowerCase().startsWith(msg.sender?.toLowerCase() || "_____") ||
                                (msg.sender && msg.sender.toLowerCase().startsWith(identity.identity_hash.toLowerCase()))
                            )) ||
                            (identity?.short_id && msg.sender?.toLowerCase() === identity.short_id.toLowerCase())
                        );
                        const prevMsg = convMessages[index - 1];
                        const nextMsg = convMessages[index + 1];

                        const prevIsMine = prevMsg ? Boolean(
                            prevMsg.is_mine ||
                            prevMsg.sender === "me" ||
                            (identity?.identity_hash && (
                                prevMsg.sender?.toLowerCase() === identity.identity_hash.toLowerCase() ||
                                identity.identity_hash.toLowerCase().startsWith(prevMsg.sender?.toLowerCase() || "_____") ||
                                (prevMsg.sender && prevMsg.sender.toLowerCase().startsWith(identity.identity_hash.toLowerCase()))
                            )) ||
                            (identity?.short_id && prevMsg.sender?.toLowerCase() === identity.short_id.toLowerCase())
                        ) : null;

                        const nextIsMine = nextMsg ? Boolean(
                            nextMsg.is_mine ||
                            nextMsg.sender === "me" ||
                            (identity?.identity_hash && (
                                nextMsg.sender?.toLowerCase() === identity.identity_hash.toLowerCase() ||
                                identity.identity_hash.toLowerCase().startsWith(nextMsg.sender?.toLowerCase() || "_____") ||
                                (nextMsg.sender && nextMsg.sender.toLowerCase().startsWith(identity.identity_hash.toLowerCase()))
                            )) ||
                            (identity?.short_id && nextMsg.sender?.toLowerCase() === identity.short_id.toLowerCase())
                        ) : null;

                        const isFirst = prevIsMine === null || prevIsMine !== isMine;
                        const isLast  = nextIsMine === null || nextIsMine !== isMine;

                        return (
                            <MessageBubble
                                key={msg.id || index}
                                msg={msg}
                                isMine={isMine}
                                isFirst={isFirst}
                                isLast={isLast}
                                showDate={index === 0 || !prevMsg || Math.abs(msg.timestamp - prevMsg.timestamp) > 3600}
                                peerName={peerName}
                                starredMessages={starredMessages || []}
                                searchQuery={searchQuery}
                                isSearchHighlight={Boolean(searchQuery && msg.content?.toLowerCase().includes(searchQuery.toLowerCase()))}
                                isSwiping={false}
                                onTouchStart={() => {}}
                                onTouchMove={() => {}}
                                onTouchEnd={() => {}}
                                onLongPress={(e) => handleLongPress(e, msg)}
                                onCancelLongPress={() => {}}
                                onReaction={handleReaction}
                                onVote={handleVote}
                            />
                        );
                    })
                )}
                {/* Typing Indicator */}
                {peerTyping && (
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", marginTop: "4px" }}>
                        <div style={{
                            padding: "10px 16px", borderRadius: "16px 16px 16px 4px",
                            background: "rgba(18, 18, 30, 0.95)", border: "1px solid var(--glass-border)",
                            display: "flex", alignItems: "center", gap: "4px"
                        }}>
                            {[0, 1, 2].map(i => (
                                <span key={i} style={{
                                    width: 7, height: 7, borderRadius: "50%",
                                    background: "var(--text-muted)",
                                    display: "inline-block",
                                    animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`
                                }} />
                            ))}
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Hidden Media Picker for Camera / Gallery / Video */}
            <input
                type="file"
                ref={mediaInputRef}
                style={{ display: "none" }}
                onChange={handleFileSelected}
            />

            {/* Input Bar Táctica */}
            <div style={{ borderTop: "1px solid var(--glass-border)", background: "rgba(10, 10, 20, 0.95)", backdropFilter: "blur(20px)" }}>
                <ChatInput
                    onSendMessage={handleSendText}
                    onSendVoice={handleSendVoice}
                    replyTo={replyTo}
                    setReplyTo={setReplyTo}
                    handleCamera={handleCamera}
                    handleGallery={handleGallery}
                    handleLocation={handleLocation}
                    peerHash={peerHash}
                    peerName={peerName}
                    burnTimer={burnTimer}
                    isRecording={isRecording}
                    recordSec={recordSec}
                    startRecording={startRecording}
                    stopRecording={stopRecording}
                />
            </div>
        </div>
    );
}
