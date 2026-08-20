"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { MessageItem, RedAPI, summarizeChannelAI, translateTextAI } from "../lib/api";
import { mediaChunker } from "../lib/mesh/mediaChunker";
import { MessageBubble } from "./chat/MessageBubble";
import { ChatInput } from "./chat/ChatInput";
import { MediaGalleryViewer } from "./chat/MediaGalleryViewer";
import { ContactProfileModal } from "./ContactProfileModal";
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
        sendMessage, sendTyping, sendTypingStatus, sendReaction, goBack, navigate, peerTyping, peerTypingStatus, addContact,
        deleteMessage, deleteMessageForEveryone, editMessage, clearConversation, starMessage, starredMessages,
        identity, peerPresence, markAsRead, preferences, setActiveCallType,
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
    const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
    const [pinnedMessage, setPinnedMessage] = useState<MessageItem | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [burnTimer, setBurnTimer] = useState<number | undefined>(undefined);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isContactProfileOpen, setIsContactProfileOpen] = useState(false);
    const [selectedViewerMedia, setSelectedViewerMedia] = useState<MessageItem | null>(null);
    const [editingMsg, setEditingMsg] = useState<MessageItem | null>(null);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const mediaInputRef = useRef<HTMLInputElement | null>(null);
    const docInputRef = useRef<HTMLInputElement | null>(null);

    const convMessages = useMemo(() => {
        const list = Array.isArray(messages) ? messages : ((messages as any)?.[activeConversationId || ""] || []);
        return [...list];
    }, [messages, activeConversationId]);

    const searchMatches = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return convMessages.filter(m => m.content && m.content.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [convMessages, searchQuery]);

    const handleNextMatch = () => {
        if (searchMatches.length === 0) return;
        const nextIdx = (currentMatchIdx + 1) % searchMatches.length;
        setCurrentMatchIdx(nextIdx);
        const targetMsg = searchMatches[nextIdx];
        const el = document.querySelector(`[data-msgid="${targetMsg.id}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const handlePrevMatch = () => {
        if (searchMatches.length === 0) return;
        const prevIdx = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length;
        setCurrentMatchIdx(prevIdx);
        const targetMsg = searchMatches[prevIdx];
        const el = document.querySelector(`[data-msgid="${targetMsg.id}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const handlePinMessage = (msg: MessageItem) => {
        if (pinnedMessage?.id === msg.id) {
            setPinnedMessage(null);
            toast.info("Mensaje desfijado");
        } else {
            setPinnedMessage(msg);
            toast.success("Mensaje fijado en el canal");
        }
    };

    const scrollToPinned = () => {
        if (!pinnedMessage) return;
        const el = document.querySelector(`[data-msgid="${pinnedMessage.id}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const handleDocumentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !peerHash) return;
        e.target.value = "";
        if (file.size > 25 * 1024 * 1024) {
            toast.error("El archivo supera el límite de 25 MB");
            return;
        }
        const reader = new FileReader();
        reader.onload = async (ev) => {
            if (ev.target?.result) {
                try {
                    await sendMessage(ev.target.result as string, {
                        msg_type: "document",
                        file_name: file.name,
                        file_size: file.size,
                        mime_type: file.type || "application/octet-stream"
                    });
                    TacticalAudioEngine.playMessageSent();
                    toast.success(`Documento "${file.name}" enviado`);
                } catch {
                    toast.error("Error al enviar documento");
                }
            }
        };
        reader.readAsDataURL(file);
    };

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

    const handleSendText = async (text: string, replyToMsg?: MessageItem | null) => {
        if (!text.trim() || !peerHash) return;
        const resolvedReply = replyToMsg || replyTo;
        try {
            await sendMessage(text.trim(), {
                msg_type: "text",
                reply_to: resolvedReply ? {
                    id: resolvedReply.id,
                    content: resolvedReply.content,
                    sender: resolvedReply.sender,
                    msg_type: resolvedReply.msg_type
                } : undefined,
                reply_to_id: resolvedReply?.id
            });
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

    const handleCamera = async () => {
        try {
            const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
            const photo = await Camera.getPhoto({
                quality: 75,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Camera,
                correctOrientation: true,
                width: 1280,
                height: 1280,
            });
            if (photo.base64String) {
                const mimeType = `image/${photo.format || 'jpeg'}`;
                const dataUrl = `data:${mimeType};base64,${photo.base64String}`;
                await sendMessage(dataUrl, {
                    msg_type: "image",
                    mime_type: mimeType,
                    media_data: dataUrl
                });
                TacticalAudioEngine.playMessageSent();
                toast.success("Foto enviada");
                return;
            }
        } catch (err: any) {
            console.log("[ChatWindow] Native Camera fallback:", err?.message || err);
        }

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
                reader.onload = async (ev) => {
                    if (ev.target?.result) {
                        const dataUrl = ev.target.result as string;
                        await sendMessage(dataUrl, {
                            msg_type: "video",
                            mime_type: file.type || "video/mp4",
                            media_data: dataUrl
                        });
                        TacticalAudioEngine.playMessageSent();
                        toast.success("Video enviado");
                    }
                };
                reader.readAsDataURL(file);
            } else {
                const compressedB64 = await compressImage(file);
                await sendMessage(compressedB64, {
                    msg_type: "image",
                    mime_type: "image/jpeg",
                    media_data: compressedB64
                });
                TacticalAudioEngine.playMessageSent();
                toast.success("Foto enviada");
            }
        } catch (err) {
            console.error("Error al procesar archivo:", err);
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
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title="Volver a la lista"
                        style={{ width: 36, height: 36, flexShrink: 0 }}
                    >
                        ←
                    </button>

                    {/* Avatar y Datos del Interlocutor (Click para abrir perfil) */}
                    <div
                        onClick={() => setIsContactProfileOpen(true)}
                        style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden", cursor: "pointer" }}
                        title="Ver info y archivos del contacto"
                    >
                        <div style={{ position: "relative", flexShrink: 0 }}>
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

                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{peerName}</span>
                                <span className="badge-tactical badge-tactical-cyan" style={{ fontSize: "0.62rem", padding: "1px 6px", flexShrink: 0 }}>NOISE E2E</span>
                            </div>
                            <div style={{
                                fontSize: "0.68rem",
                                color: (peerTypingStatus?.[peerHash] && peerTypingStatus[peerHash] !== 'idle') || peerTyping
                                    ? "var(--accent-cyan)"
                                    : (isOnline ? "var(--accent-emerald)" : "var(--text-muted)"),
                                fontFamily: "JetBrains Mono, monospace",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                fontWeight: (peerTypingStatus?.[peerHash] && peerTypingStatus[peerHash] !== 'idle') || peerTyping ? 800 : 500
                            }}>
                                {peerTypingStatus?.[peerHash] === 'recording_voice'
                                    ? '🎙️ Grabando audio...'
                                    : ((peerTypingStatus?.[peerHash] === 'typing' || peerTyping)
                                        ? '✍️ Escribiendo...'
                                        : (isOnline ? "● CONECTADO EN MALLA" : `DID: ${peerHash.substring(0, 10)}…`))}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    <button
                        onClick={() => setSearchOpen(v => !v)}
                        className="btn-icon"
                        title="Buscar en conversación"
                        style={{ width: 36, height: 36, color: searchOpen ? "var(--accent-amber)" : "var(--text-secondary)" }}
                    >
                        🔍
                    </button>

                    <button
                        onClick={() => {
                            try {
                                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                                if (AudioContextClass) {
                                    const ctx = new AudioContextClass();
                                    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
                                }
                            } catch {}
                            const target = fullPeerHash || peerHash;
                            const newCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                            setActiveCallType('audio');
                            useRedStore.setState({
                                activeCallPeer: target,
                                activeCallId: newCallId,
                                activeCallOffer: null,
                                activeCallSignal: null,
                                callSignalQueue: []
                            });
                            navigate("call", target);
                        }}
                        className="btn-icon"
                        title="Llamada de Voz P2P WebRTC"
                        style={{ width: 36, height: 36, color: "var(--accent-emerald)" }}
                    >
                        📞
                    </button>

                    <button
                        onClick={() => {
                            try {
                                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                                if (AudioContextClass) {
                                    const ctx = new AudioContextClass();
                                    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
                                }
                            } catch {}
                            const target = fullPeerHash || peerHash;
                            const newCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                            setActiveCallType('video');
                            useRedStore.setState({
                                activeCallPeer: target,
                                activeCallId: newCallId,
                                activeCallOffer: null,
                                activeCallSignal: null,
                                callSignalQueue: []
                            });
                            navigate("call", target);
                        }}
                        className="btn-icon"
                        title="Videollamada HD P2P WebRTC"
                        style={{ width: 36, height: 36, color: "var(--accent-cyan)" }}
                    >
                        📹
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

            {/* In-Chat Search Bar Overlay */}
            {searchOpen && (
                <div style={{
                    display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px",
                    background: "rgba(18,20,36,0.98)", borderBottom: "1px solid var(--glass-border)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)", zIndex: 9
                }}>
                    <span style={{ fontSize: "1.1rem" }}>🔍</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => {
                            setSearchQuery(e.target.value);
                            setCurrentMatchIdx(0);
                        }}
                        placeholder="Buscar en esta conversación..."
                        autoFocus
                        style={{
                            flex: 1, padding: "6px 12px", background: "rgba(255,255,255,0.06)",
                            border: "1px solid var(--glass-border)", borderRadius: "var(--radius-full)",
                            color: "#fff", fontSize: "0.85rem", outline: "none"
                        }}
                    />
                    {searchMatches.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontFamily: "monospace", color: "var(--accent-amber)" }}>
                            <span>{currentMatchIdx + 1}/{searchMatches.length}</span>
                            <button onClick={handlePrevMatch} className="btn-icon" style={{ width: 28, height: 28 }} title="Anterior">▲</button>
                            <button onClick={handleNextMatch} className="btn-icon" style={{ width: 28, height: 28 }} title="Siguiente">▼</button>
                        </div>
                    )}
                    <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="btn-icon" style={{ width: 30, height: 30 }} title="Cerrar búsqueda">✕</button>
                </div>
            )}

            {/* Pinned Message Banner */}
            {pinnedMessage && (
                <div
                    onClick={scrollToPinned}
                    style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "6px 14px", background: "rgba(0,229,255,0.08)",
                        borderBottom: "1px solid rgba(0,229,255,0.2)", cursor: "pointer",
                        fontSize: "0.78rem", zIndex: 8
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: "var(--accent-cyan)", fontWeight: 800 }}>📌 Fijado:</span>
                        <span style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {pinnedMessage.content?.startsWith("data:") ? "📎 Archivo adjunto" : pinnedMessage.content}
                        </span>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setPinnedMessage(null);
                        }}
                        style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.9rem" }}
                        title="Desfijar"
                    >
                        ✕
                    </button>
                </div>
            )}

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
                                onReaction={(msgId, emoji) => sendReaction(msgId, emoji)}
                                onVote={handleVote}
                                onPin={handlePinMessage}
                                onReply={(m) => setReplyTo(m)}
                                onEdit={(m) => setEditingMsg(m)}
                                onDeleteForEveryone={(id) => deleteMessageForEveryone(id)}
                                onOpenMediaGallery={(m) => setSelectedViewerMedia(m)}
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

            {/* Hidden Document Picker */}
            <input
                type="file"
                ref={docInputRef}
                style={{ display: "none" }}
                onChange={handleDocumentSelected}
            />

            {/* Input Bar Táctica */}
            <div style={{ borderTop: "1px solid var(--glass-border)", background: "rgba(10, 10, 20, 0.95)", backdropFilter: "blur(20px)" }}>
                <ChatInput
                    onSendMessage={handleSendText}
                    onSendVoice={handleSendVoice}
                    sendTyping={() => sendTypingStatus('typing')}
                    replyTo={replyTo}
                    setReplyTo={setReplyTo}
                    editingMsg={editingMsg}
                    setEditingMsg={setEditingMsg}
                    handleCamera={handleCamera}
                    handleGallery={handleGallery}
                    handleDocument={() => docInputRef.current?.click()}
                    handleLocation={handleLocation}
                    peerHash={peerHash}
                    peerName={peerName}
                    burnTimer={burnTimer}
                    isRecording={isRecording}
                    recordSec={recordSec}
                    startRecording={startRecording}
                    stopRecording={stopRecording}
                    cancelRecording={() => {
                        setIsRecording(false);
                        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
                        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                            mediaRecorderRef.current.stop();
                            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
                        }
                        audioChunksRef.current = [];
                        setRecordSec(0);
                    }}
                />
            </div>

            {/* Contact Profile & Shared Media Modal */}
            {isContactProfileOpen && (
                <ContactProfileModal
                    contact={peerContact || { identity_hash: peerHash, display_name: peerName }}
                    conversation={activeConv}
                    messages={convMessages}
                    onClose={() => setIsContactProfileOpen(false)}
                    onStartCall={(type) => {
                        const target = fullPeerHash || peerHash;
                        setActiveCallType(type);
                        useRedStore.setState({
                            activeCallPeer: target,
                            activeCallOffer: null,
                            activeCallSignal: null,
                            callSignalQueue: []
                        });
                        navigate("call", target);
                    }}
                    onClearChat={clearConversation}
                />
            )}

            {/* Media Gallery Full-Screen Modal */}
            {selectedViewerMedia && (
                <MediaGalleryViewer
                    activeMedia={selectedViewerMedia}
                    allMessages={convMessages}
                    onClose={() => setSelectedViewerMedia(null)}
                />
            )}
        </div>
    );
}
