"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { MessageItem, RedAPI } from "../lib/api";
import { mediaChunker } from "../lib/mesh/mediaChunker";
import { MessageBubble } from "./chat/MessageBubble";
import { ChatInput } from "./chat/ChatInput";

/* ── Avatar helpers (same palette as Sidebar) ─────────────────────────────── */
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
    return { background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: `0 2px 12px ${a}55` };
}

/* ── Date pill helper ──────────────────────────────────────────────────────── */
function datePill(ts: number): string {
    const d = new Date(ts * 1000), now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    if (diff < 7)  return d.toLocaleDateString('es', { weekday: 'long' });
    return d.toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });
}
function timeStr(ts: number) {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function sameDay(a: number, b: number) {
    const da = new Date(a * 1000), db = new Date(b * 1000);
    return da.getFullYear() === db.getFullYear() &&
           da.getMonth() === db.getMonth() &&
           da.getDate() === db.getDate();
}

/* ── Constants ────────────────────────────────────────────────────────────── */
const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];
const LONG_PRESS_MS = 620;

/* ── Typing dots ──────────────────────────────────────────────────────────── */
function TypingIndicator() {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '10px 14px', background: 'var(--bubble-them)',
            border: '1px solid var(--bubble-them-border)', borderRadius: '18px 18px 18px 4px',
            width: 56, marginTop: 10,
        }}>
            {[0, 1, 2].map(i => (
                <span key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
        </div>
    );
}

/* ── Voice waveform (For Input Recording Display) ─────────────────────────── */
export function VoiceWave({ playing, color }: { playing: boolean; color: string }) {
    const heights = [4, 8, 14, 10, 18, 12, 20, 14, 10, 8, 16, 12, 6, 14, 10, 8, 16, 12, 18, 10, 8, 14, 6, 10, 14];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: 24 }}>
            {heights.map((h, i) => (
                <div key={i} className={playing ? 'voice-bar' : ''} style={{
                    width: 3, height: h, borderRadius: 2, background: color,
                    opacity: playing ? 0.9 : 0.4,
                    animationDelay: playing ? `${(i * 40) % 800}ms` : '0ms',
                    transition: 'opacity 0.3s ease',
                }} />
            ))}
        </div>
    );
}

/* ── Main ChatWindow ───────────────────────────────────────────────────────── */
export default function ChatWindow() {
    const {
        activeConversationId, conversations, contacts, groups, messages,
        sendMessage, sendTyping, goBack, peerTyping,
        deleteMessage, editMessage, clearConversation, starMessage, starredMessages,
        identity,
    } = useRedStore();

    const activeConv = conversations.find(c => c.id === activeConversationId);
    const peerContact = contacts.find((c: any) => c.identity_hash === activeConv?.peer);
    const peerName    = peerContact?.display_name || (activeConv?.peer ? `${activeConv.peer.substring(0, 12)}…` : 'Desconocido');
    const peerHash    = activeConv?.peer || '';

    /* ── State ─────────────────────────────────────────────────────────── */
    const [inputText, setInputText]         = useState('');
    const [inputFocused, setInputFocused]   = useState(false);
    const [isRecording, setIsRecording]     = useState(false);
    const [recordSec, setRecordSec]         = useState(0);
    const [attachOpen, setAttachOpen]       = useState(false);
    const [showPollModal, setShowPollModal] = useState(false);
    const [pollQ, setPollQ]                 = useState('');
    const [pollOpts, setPollOpts]           = useState(['', '']);
    const [replyTo, setReplyTo]             = useState<MessageItem | null>(null);
    const [pickerFor, setPickerFor]         = useState<string | null>(null);
    const [pickerPos, setPickerPos]         = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const [typingPeer, setTypingPeer]       = useState(false);
    const [chatMessages, setChatMessages]   = useState<MessageItem[]>([]);
    const [swipingId, setSwipingId]         = useState<string | null>(null);
    const [chatMenuOpen, setChatMenuOpen]   = useState(false);
    const [clearingChat, setClearingChat]   = useState(false);
    const [showProfile, setShowProfile]     = useState(false);

    // ── NEW FEATURES ──
    // A2: Delete
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    // A3: Edit
    const [editingMsg, setEditingMsg]       = useState<MessageItem | null>(null);
    const [editText, setEditText]           = useState('');
    // A1: Forward
    const [forwardMsg, setForwardMsg]       = useState<MessageItem | null>(null);
    // B2: Search
    const [searchOpen, setSearchOpen]       = useState(false);
    const [searchQuery, setSearchQuery]     = useState('');
    const [searchIdx, setSearchIdx]         = useState(0);
    // B3: Pin
    const [pinnedMsg, setPinnedMsg]         = useState<MessageItem | null>(null);
    // Context menu (long-press)
    const [ctxMenu, setCtxMenu]             = useState<{ msg: MessageItem; x: number; y: number } | null>(null);
    // A6: File
    const fileInputRef                      = useRef<HTMLInputElement>(null);

    /* ── Refs ── */
    const endRef           = useRef<HTMLDivElement>(null);
    const timerRef         = useRef<NodeJS.Timeout | null>(null);
    const longPressRef     = useRef<NodeJS.Timeout | null>(null);
    const inputRef         = useRef<HTMLInputElement>(null);
    const searchInputRef   = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef   = useRef<BlobPart[]>([]);

    /* Sync messages from store — filter out reaction and typing entries */
    useEffect(() => {
        setChatMessages(messages.filter(m => m.msg_type !== 'reaction' && m.msg_type !== 'typing'));
    }, [messages]);

    /* Auto-scroll */
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, typingPeer]);

    /* Close pickers on outside tap */
    useEffect(() => {
        if (!pickerFor && !ctxMenu) return;
        const handler = () => { setPickerFor(null); setCtxMenu(null); };
        const t = setTimeout(() => document.addEventListener('pointerdown', handler, { once: true }), 10);
        return () => { clearTimeout(t); document.removeEventListener('pointerdown', handler); };
    }, [pickerFor, ctxMenu]);

    /* Focus search on open */
    useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);

    /* Derived search results */
    const searchResults = searchQuery.trim()
        ? chatMessages.filter(m =>
            typeof m.content === 'string' &&
            m.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : [];

    /* ── Handlers ─────────────────────────────────────────────────────────── */

    const handleSend = useCallback(() => {
        const txt = inputText.trim();
        if (!txt) return;
        sendMessage(txt, replyTo ? {
            reply_to: { id: replyTo.id, content: replyTo.content, sender: replyTo.sender, msg_type: replyTo.msg_type }
        } : undefined);
        setInputText('');
        setReplyTo(null);
    }, [inputText, replyTo, sendMessage]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Phase 2: Optimización Acústica (Voice Payloads P2P)
            // Bajar el bitrate a 12000 bps para transmisión táctica por LoRa/BLE
            const mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 12000 });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordSec(0);
            timerRef.current = setInterval(() => setRecordSec(p => p + 1), 1000);
        } catch (e) { console.error('Record start failed:', e); }
    };

    const stopRecording = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
        try {
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.onstop = () => {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => {
                        const base64data = reader.result as string;
                        const rawB64 = base64data.split(',')[1] || '';
                        
                        // FRAGMENTATION (JS CHUNKER)
                        if (rawB64.length > 48000) {
                            const chunks = mediaChunker.fragment(rawB64, 'audio/webm');
                            chunks.forEach(c => {
                                sendMessage(`[Fragment] Nota de voz [${c.chunkIndex}/${c.totalChunks}]`, {
                                    msg_type: 'media_chunk',
                                    media_data: JSON.stringify(c),
                                    duration_ms: recordSec * 1000
                                });
                            });
                        } else {
                            sendMessage('🎤 Nota de voz', {
                                msg_type: 'voice',
                                media_data: rawB64,
                                mime_type: 'audio/webm',
                                duration_ms: recordSec * 1000,
                            });
                        }
                    };

                    // Liberar hardware
                    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
                };
                mediaRecorderRef.current.stop();
            }
        } catch (e) { console.error('Record stop failed:', e); }
    };

    const handleCamera = async () => {
        setAttachOpen(false);
        try {
            const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
            const img = await Camera.getPhoto({ quality: 80, allowEditing: false, resultType: CameraResultType.Base64, source: CameraSource.Camera, width: 1280 });
            if (img.base64String) {
                const mime = `image/${img.format || 'jpeg'}`;
                if (img.base64String.length > 48000) {
                     const chunks = mediaChunker.fragment(img.base64String, mime);
                     chunks.forEach(c => sendMessage(`[Fragment] Foto [${c.chunkIndex}/${c.totalChunks}]`, { msg_type: 'media_chunk', media_data: JSON.stringify(c) }));
                } else {
                     sendMessage('📷 Foto cifrada', { msg_type: 'image', media_data: `data:${mime};base64,${img.base64String}`, mime_type: mime });
                }
            }
        } catch {}
    };

    const handleGallery = async () => {
        setAttachOpen(false);
        try {
            const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
            const img = await Camera.getPhoto({ quality: 80, allowEditing: false, resultType: CameraResultType.Base64, source: CameraSource.Photos, width: 1280 });
            if (img.base64String) {
                const mime = `image/${img.format || 'jpeg'}`;
                if (img.base64String.length > 48000) {
                     const chunks = mediaChunker.fragment(img.base64String, mime);
                     chunks.forEach(c => sendMessage(`[Fragment] Imagen [${c.chunkIndex}/${c.totalChunks}]`, { msg_type: 'media_chunk', media_data: JSON.stringify(c) }));
                } else {
                     sendMessage('🖼️ Imagen cifrada', { msg_type: 'image', media_data: `data:${mime};base64,${img.base64String}`, mime_type: mime });
                }
            }
        } catch {}
    };

    const handleLocation = async () => {
        setAttachOpen(false);
        try {
            const { Geolocation } = await import('@capacitor/geolocation');
            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
            sendMessage('📍 Ubicación GPS', { msg_type: 'location', latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        } catch (e) { console.error('Geolocation failed', e); }
    };

    const handlePollSend = () => {
        const validOpts = pollOpts.filter(o => o.trim());
        if (!pollQ.trim() || validOpts.length < 2) return;
        sendMessage(`📊 ${pollQ}`, { msg_type: 'poll', poll_data: { question: pollQ, options: validOpts, votes: {} } });
        setPollQ(''); setPollOpts(['', '']); setShowPollModal(false);
    };

    const handleReaction = (msgId: string, emoji: string) => {
        setPickerFor(null);
        // Update local state optimistically
        setChatMessages(prev => prev.map(m => {
            if (m.id !== msgId) return m;
            const reactions = { ...(m.reactions || {}) };
            const myId = 'me';
            if (reactions[emoji]?.includes(myId)) {
                reactions[emoji] = reactions[emoji].filter(id => id !== myId);
                if (!reactions[emoji].length) delete reactions[emoji];
            } else {
                reactions[emoji] = [...(reactions[emoji] || []), myId];
            }
            return { ...m, reactions };
        }));
        sendMessage(`reaction:${emoji}:${msgId}`, { msg_type: 'reaction' });
    };

    /* Long press → context menu (replaces inline reaction picker) */
    const startLongPress = (e: React.TouchEvent | React.MouseEvent, msg: MessageItem) => {
        longPressRef.current = setTimeout(() => {
            const rect = (e.target as HTMLElement).closest('[data-msgid]')?.getBoundingClientRect();
            if (rect) {
                const y = Math.max(8, rect.top - 20);
                const x = Math.min(Math.max(rect.left, 8), window.innerWidth - 220);
                setCtxMenu({ msg, x, y });
                // Also open emoji picker
                setPickerPos({ top: y - 52, left: x });
                setPickerFor(msg.id);
            }
        }, LONG_PRESS_MS);
    };
    const cancelLongPress = () => { if (longPressRef.current) clearTimeout(longPressRef.current); };

    /* Touch swipe → reply */
    const touchStartX = useRef(0);
    const onTouchStart = (e: React.TouchEvent, msg: MessageItem) => {
        touchStartX.current = e.touches[0].clientX;
        startLongPress(e, msg);
    };
    const onTouchMove = (e: React.TouchEvent, msg: MessageItem) => {
        cancelLongPress();
        const dx = e.touches[0].clientX - touchStartX.current;
        if (dx > 45 && !msg.is_mine) { setSwipingId(msg.id); setReplyTo(msg); }
        if (dx < -45 && msg.is_mine) { setSwipingId(msg.id); setReplyTo(msg); }
    };
    const onTouchEnd = () => { cancelLongPress(); setTimeout(() => setSwipingId(null), 300); };

    const handleClearHistory = async () => {
        setChatMenuOpen(false);
        if (!activeConversationId) return;
        setClearingChat(true);
        try {
            setChatMessages([]);
            await clearConversation();
        } finally {
            setClearingChat(false);
        }
    };

    // ── A2: Delete message ────────────────────────────────────────────────────────
    const handleDelete = async (msgId: string) => {
        setDeleteConfirmId(null);
        setCtxMenu(null);
        await deleteMessage(msgId);
    };

    // ── A3: Start editing ──────────────────────────────────────────────────────
    const startEdit = (msg: MessageItem) => {
        setCtxMenu(null);
        setEditingMsg(msg);
        setEditText(msg.content);
    };
    const confirmEdit = async () => {
        if (!editingMsg || !editText.trim()) return;
        await editMessage(editingMsg.id, editText.trim());
        setEditingMsg(null);
        setEditText('');
    };

    // ── A1: Forward message ──────────────────────────────────────────────────────
    const handleForward = (targetHash: string) => {
        if (!forwardMsg) return;
        const { sendMessage: send, groups: grps } = useRedStore.getState();
        const isGrp = (grps as any[]).some((g: any) => g.id === targetHash);
        // Use generic sendMessage — it already routes to group or DM
        useRedStore.setState({ activeConversationId: targetHash });
        send(`↪ ${forwardMsg.content}`, { msg_type: forwardMsg.msg_type === 'text' ? 'text' : forwardMsg.msg_type });
        setForwardMsg(null);
    };

    // ── A4: Star ───────────────────────────────────────────────────────────────
    const handleStar = (msg: MessageItem) => {
        setCtxMenu(null);
        starMessage(msg.id);
    };

    // ── A5: Share contact card ────────────────────────────────────────────────
    const [showContactPicker, setShowContactPicker] = useState(false);
    const handleShareContact = (c: any) => {
        setShowContactPicker(false);
        setAttachOpen(false);
        sendMessage(`👤 ${c.display_name}`, {
            msg_type: 'contact_card',
            media_data: JSON.stringify({ display_name: c.display_name, identity_hash: c.identity_hash }),
        });
    };

    // ── A6: Share file (document) ──────────────────────────────────────────────
    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('Archivo muy grande. Máximo 5 MB.'); return; }
        const reader = new FileReader();
        reader.onloadend = () => {
            const b64 = (reader.result as string).split(',')[1] || '';
            sendMessage(`📎 ${file.name}`, {
                msg_type: 'file',
                media_data: b64,
                mime_type: file.type || 'application/octet-stream',
                media_name: file.name,
            });
        };
        reader.readAsDataURL(file);
        setAttachOpen(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── B3: Pin ───────────────────────────────────────────────────────────────
    const handlePin = (msg: MessageItem) => {
        setCtxMenu(null);
        setPinnedMsg(prev => prev?.id === msg.id ? null : msg);
    };

    // ── Long-press → context menu ───────────────────────────────────────────────

    /* Render ─────────────────────────────────────────────────────────────── */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-deep)', overflow: 'hidden', position: 'relative' }}>

            {/* ── Context menu (long-press) ──────────────────────────────────── */}
            {ctxMenu && (
                <div
                    style={{
                        position: 'fixed', top: ctxMenu.y, left: ctxMenu.x,
                        zIndex: 500, minWidth: 200,
                        background: 'linear-gradient(145deg,rgba(15,15,28,0.99),rgba(8,8,18,0.99))',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
                        padding: '6px', boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
                        animation: 'var(--anim-pop)',
                    }}
                    onPointerDown={e => e.stopPropagation()}
                >
                    {[
                        { icon: '↩️', label: 'Responder',  action: () => { setReplyTo(ctxMenu.msg); setCtxMenu(null); } },
                        { icon: '➡️', label: 'Reenviar',   action: () => { setForwardMsg(ctxMenu.msg); setCtxMenu(null); } },
                        ctxMenu.msg.is_mine ? { icon: '✏️', label: 'Editar',     action: () => startEdit(ctxMenu.msg) } : null,
                        { icon: starredMessages.includes(ctxMenu.msg.id) ? '★' : '☆',
                          label: starredMessages.includes(ctxMenu.msg.id) ? 'Quitar estrella' : 'Marcar estrella',
                          action: () => handleStar(ctxMenu.msg) },
                        { icon: '📌', label: pinnedMsg?.id === ctxMenu.msg.id ? 'Desfijar' : 'Fijar mensaje', action: () => handlePin(ctxMenu.msg) },
                        ctxMenu.msg.is_mine ? { icon: '🗑️', label: 'Eliminar', danger: true, action: () => { setDeleteConfirmId(ctxMenu.msg.id); setCtxMenu(null); } } : null,
                    ].filter(Boolean).map((item: any) => (
                        <button
                            key={item.label}
                            onClick={item.action}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                padding: '11px 14px', background: 'transparent',
                                color: item.danger ? '#FF4444' : 'var(--text-primary)',
                                border: 'none', borderRadius: 10, fontSize: '0.9rem',
                                fontWeight: 500, cursor: 'pointer', textAlign: 'left',
                            }}
                            onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <span style={{ width: 22, textAlign: 'center' }}>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Reaction picker */}
            {pickerFor && (
                <div className="reaction-picker" style={{ top: pickerPos.top, left: pickerPos.left }}
                    onPointerDown={e => e.stopPropagation()}>
                    {REACTIONS.map(em => (
                        <button key={em} className="reaction-picker-emoji"
                            onClick={() => handleReaction(pickerFor, em)}>
                            {em}
                        </button>
                    ))}
                </div>
            )}

            {/* Poll modal */}
            {showPollModal && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}
                    onClick={() => setShowPollModal(false)}>
                    <div style={{
                        width: '100%', padding: '24px 20px', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
                        background: 'linear-gradient(180deg, #13131e 0%, #0a0a12 100%)',
                        border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none',
                        animation: 'slideUp 0.25s var(--ease-spring) both',
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontWeight: 800, marginBottom: 20, fontSize: '1.1rem' }}>📊 Nueva Encuesta</h3>
                        <input value={pollQ} onChange={e => setPollQ(e.target.value)}
                            placeholder="Pregunta..." style={{
                                width: '100%', padding: '12px 14px', background: 'var(--bg-lifted)',
                                border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none', marginBottom: 12,
                            }} />
                        {pollOpts.map((opt, i) => (
                            <input key={i} value={opt} onChange={e => {
                                const n = [...pollOpts]; n[i] = e.target.value; setPollOpts(n);
                            }} placeholder={`Opción ${i + 1}`} style={{
                                width: '100%', padding: '11px 14px', background: 'var(--bg-lifted)',
                                border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)', fontSize: '0.88rem', outline: 'none', marginBottom: 8,
                            }} />
                        ))}
                        {pollOpts.length < 5 && (
                            <button onClick={() => setPollOpts([...pollOpts, ''])} style={{
                                width: '100%', padding: 10, background: 'transparent', border: '1px dashed var(--glass-border)',
                                borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 16, fontSize: '0.85rem',
                            }}>+ Añadir opción</button>
                        )}
                        <button onClick={handlePollSend} className="btn-primary" style={{ width: '100%', padding: 14, borderRadius: 'var(--radius-md)' }}>
                            Publicar encuesta
                        </button>
                    </div>
                </div>
            )}

            {/* ── Delete confirm modal ───────────────────────────────────────────── */}
            {deleteConfirmId && (
                <div style={{ position:'absolute', inset:0, zIndex:600, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding: 24 }}
                    onClick={() => setDeleteConfirmId(null)}>
                    <div style={{ background:'linear-gradient(145deg,#0f0f1c,#0a0a14)', border:'1px solid rgba(255,255,255,0.12)',
                        borderRadius: 24, padding: '28px 24px', width:'100%', maxWidth: 340, textAlign:'center' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🗑️</div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>Eliminar mensaje</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 24 }}>Esta acción no se puede deshacer.</div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setDeleteConfirmId(null)}
                                style={{ flex: 1, padding: '13px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={() => handleDelete(deleteConfirmId)}
                                style={{ flex: 1, padding: '13px', borderRadius: 14, background: 'linear-gradient(135deg,#E8213A,#FF3355)', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit modal ─────────────────────────────────────────────────────── */}
            {editingMsg && (
                <div style={{ position:'absolute', inset:0, zIndex:600, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-end' }}
                    onClick={() => setEditingMsg(null)}>
                    <div style={{ width:'100%', padding:'20px', background:'linear-gradient(180deg,#13131e,#0a0a12)', borderRadius:'24px 24px 0 0',
                        border:'1px solid rgba(255,255,255,0.08)', borderBottom:'none' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ fontWeight: 800, marginBottom: 12, display:'flex', alignItems:'center', gap:8 }}>
                            <span>✏️</span> Editar mensaje
                        </div>
                        <textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            autoFocus
                            rows={3}
                            style={{ width:'100%', resize:'none', padding:'12px 14px', background:'var(--bg-lifted)',
                                border:'1px solid var(--glass-border)', borderRadius: 14,
                                color:'var(--text-primary)', fontSize:'0.95rem', outline:'none',
                                marginBottom: 14, boxSizing: 'border-box' }}
                        />
                        <div style={{ display:'flex', gap:12 }}>
                            <button onClick={() => setEditingMsg(null)}
                                style={{ flex:1, padding:'13px', borderRadius:14, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text-secondary)', fontWeight:700, cursor:'pointer' }}>Cancelar</button>
                            <button onClick={confirmEdit}
                                style={{ flex:1, padding:'13px', borderRadius:14, background:'linear-gradient(135deg,#E8213A,#FF3355)', border:'none', color:'white', fontWeight:700, cursor:'pointer' }}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Forward modal ─────────────────────────────────────────────────── */}
            {forwardMsg && (
                <div style={{ position:'absolute', inset:0, zIndex:600, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-end' }}
                    onClick={() => setForwardMsg(null)}>
                    <div style={{ width:'100%', maxHeight:'70vh', padding:'20px', background:'linear-gradient(180deg,#13131e,#0a0a12)',
                        borderRadius:'24px 24px 0 0', border:'1px solid rgba(255,255,255,0.08)', borderBottom:'none', overflowY:'auto' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ fontWeight:800, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>➡️ Reenviar a…</div>
                        {[...contacts.map((c:any) => ({ name: c.display_name, hash: c.identity_hash, isGroup: false })),
                          ...(groups as any[]).map((g:any) => ({ name: g.name, hash: g.id, isGroup: true }))]
                          .map(item => (
                            <button key={item.hash} onClick={() => handleForward(item.hash)}
                                style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'rgba(255,255,255,0.04)',
                                    border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, marginBottom:8,
                                    color:'var(--text-primary)', cursor:'pointer', fontSize:'0.9rem', fontWeight:600 }}>
                                <span style={{ fontSize:'1.1rem' }}>{item.isGroup ? '👥' : '👤'}</span>
                                {item.name || item.hash.substring(0,12)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Contact picker ────────────────────────────────────────────────── */}
            {showContactPicker && (
                <div style={{ position:'absolute', inset:0, zIndex:600, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-end' }}
                    onClick={() => setShowContactPicker(false)}>
                    <div style={{ width:'100%', maxHeight:'60vh', padding:'20px', background:'linear-gradient(180deg,#13131e,#0a0a12)',
                        borderRadius:'24px 24px 0 0', border:'1px solid rgba(255,255,255,0.08)', borderBottom:'none', overflowY:'auto' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ fontWeight:800, marginBottom:16 }}>👤 Compartir contacto</div>
                        {contacts.length === 0 && <div style={{ color:'var(--text-muted)', textAlign:'center', padding:16 }}>No tienes contactos aún.</div>}
                        {contacts.map((c:any) => (
                            <button key={c.identity_hash} onClick={() => handleShareContact(c)}
                                style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'rgba(255,255,255,0.04)',
                                    border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, marginBottom:8,
                                    color:'var(--text-primary)', cursor:'pointer', fontSize:'0.9rem', fontWeight:600 }}>
                                👤 {c.display_name || c.identity_hash.substring(0,16)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── File input (hidden) ─────────────────────────────────────────────── */}
            <input ref={fileInputRef} type="file" accept="*/*" style={{ display:'none' }} onChange={handleFileInput} />

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <header style={{
                height: 'var(--header-h)', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 14px',
                background: 'linear-gradient(180deg, rgba(12,12,22,0.99) 0%, rgba(8,8,16,0.98) 100%)',
                borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, zIndex: 10,
            }}>
                <button onClick={goBack} className="btn-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>

                {/* Avatar + info */}
                <div onClick={() => {/* Contact info screen future */}} style={{ display: 'flex', alignItems: 'center', gap: '11px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '1.1rem', color: 'white',
                        ...avStyle(peerHash || peerName),
                    }}>
                        {peerName.substring(0, 1).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.02rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {peerName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                            {typingPeer ? (
                                <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600, fontStyle: 'italic' }}>
                                    escribiendo…
                                </span>
                            ) : (
                                <>
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', boxShadow: '0 0 5px var(--success)' }} />
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {peerHash ? `${peerHash.substring(0, 10)}…` : ''}
                                    </span>
                                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                                    <span style={{ fontSize: '0.69rem', color: 'var(--success)', fontWeight: 600 }}>E2E cifrado</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Header actions */}
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0, position: 'relative' }}>
                    {/* B2: Search toggle */}
                    <button className="btn-icon" onClick={() => setSearchOpen(s => !s)} title="Buscar">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                    </button>
                    <button className="btn-icon" onClick={() => useRedStore.getState().navigate('call')} title="Llamada">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 10a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l1.27-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                    </button>
                    <button className="btn-icon" title="Más" onClick={() => setChatMenuOpen(m => !m)}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="5" r="1.2" fill="currentColor"/>
                            <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
                            <circle cx="12" cy="19" r="1.2" fill="currentColor"/>
                        </svg>
                    </button>

                    {/* Context menu */}
                    {chatMenuOpen && (
                        <div
                            style={{
                                position: 'absolute', top: 44, right: 0,
                                background: 'linear-gradient(145deg, rgba(15,15,28,0.99), rgba(8,8,18,0.99))',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 'var(--radius-lg)', padding: '6px',
                                zIndex: 200, minWidth: 200,
                                boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
                                animation: 'var(--anim-pop)',
                            }}
                            onPointerDown={e => e.stopPropagation()}
                        >
                            {[
                                { icon: '🔍', label: 'Buscar en chat',   danger: false, action: () => { setChatMenuOpen(false); setSearchOpen(true); } },
                                { icon: '📌', label: pinnedMsg ? 'Ver mensaje fijado' : 'No hay fijados', danger: false, action: () => setChatMenuOpen(false) },
                                { icon: '🗑️', label: clearingChat ? 'Limpiando...' : 'Limpiar historial', danger: true,  action: handleClearHistory },
                                { icon: '👤', label: 'Ver perfil', danger: false, action: () => { setChatMenuOpen(false); setShowProfile(true); } },
                            ].map(item => (
                                <button
                                    key={item.label}
                                    onPointerUp={e => { e.preventDefault(); item.action(); }}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '11px 14px', background: 'transparent',
                                        color: item.danger ? 'var(--danger)' : 'var(--text-primary)',
                                        border: 'none', borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', textAlign: 'left',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <span style={{ fontSize: '1.1rem', width: 24, textAlign: 'center' }}>{item.icon}</span>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            {/* ── B2: Search bar ─────────────────────────────────────────────────────── */}
            {searchOpen && (
                <div style={{ flexShrink:0, padding:'8px 12px', background:'rgba(8,8,16,0.97)',
                    borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:8, alignItems:'center' }}>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Buscar en la conversación…"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setSearchIdx(0); }}
                        style={{ flex:1, background:'rgba(20,20,32,0.9)', border:'1px solid rgba(255,255,255,0.1)',
                            borderRadius:20, padding:'8px 14px', color:'var(--text-primary)', fontSize:'0.9rem', outline:'none' }}
                    />
                    {searchResults.length > 0 && (
                        <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                            {searchIdx + 1}/{searchResults.length}
                        </span>
                    )}
                    {searchResults.length > 1 && (
                        <>
                            <button onClick={() => setSearchIdx(i => (i - 1 + searchResults.length) % searchResults.length)}
                                style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1rem' }}>↑</button>
                            <button onClick={() => setSearchIdx(i => (i + 1) % searchResults.length)}
                                style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1rem' }}>↓</button>
                        </>
                    )}
                    <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                        style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.2rem' }}>×</button>
                </div>
            )}

            {/* ── B3: Pin banner ────────────────────────────────────────────────────── */}
            {pinnedMsg && (
                <div onClick={() => setPinnedMsg(null)} style={{ flexShrink:0, padding:'6px 14px',
                    background:'rgba(232,33,58,0.08)', borderBottom:'1px solid rgba(232,33,58,0.15)',
                    display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                    <span style={{ fontSize:'0.9rem' }}>📌</span>
                    <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'0.65rem', color:'var(--primary-bright)', fontWeight:700, letterSpacing:'1px' }}>MENSAJE FIJADO</div>
                        <div style={{ fontSize:'0.82rem', color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {pinnedMsg.content}
                        </div>
                    </div>
                    <span style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>×</span>
                </div>
            )}

            {/* ── Messages ────────────────────────────────────────────────────── */}
            <div className="scroll-container" style={{
                flex: 1, padding: '12px 12px calc(16px + var(--safe-bottom, 0px))',
                display: 'flex', flexDirection: 'column',
                backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(232,33,58,0.025) 0%, transparent 55%), radial-gradient(circle at 80% 10%, rgba(41,182,246,0.02) 0%, transparent 55%)',
            }}>
                {chatMessages.length === 0 && (
                    <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '78%' }} className="animate-fade">
                        <div style={{
                            padding: '28px 24px', borderRadius: 'var(--radius-lg)',
                            background: 'linear-gradient(135deg, rgba(15,15,28,0.96), rgba(10,10,20,0.98))',
                            border: '1px solid rgba(232,33,58,0.12)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        }}>
                            <div style={{
                                width: 68, height: 68, borderRadius: '50%', margin: '0 auto 16px',
                                background: 'linear-gradient(135deg, rgba(232,33,58,0.2), rgba(200,20,45,0.1))',
                                border: '1px solid rgba(232,33,58,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem',
                            }}>🔐</div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem', marginBottom: 6 }}>Canal P2P Activo</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
                                AES-256-GCM · Curve25519<br/>Sin servidores · Multi-hop mesh
                            </div>
                            {['E2E', 'Sin internet?', 'Multi-hop'].map(t => (
                                <span key={t} style={{
                                    display: 'inline-block', margin: '2px 4px', padding: '3px 10px', borderRadius: 20,
                                    fontSize: '0.7rem', fontWeight: 700,
                                    background: 'rgba(232,33,58,0.1)', color: 'var(--primary-bright)', border: '1px solid rgba(232,33,58,0.2)',
                                }}>{t}</span>
                            ))}
                        </div>
                    </div>
                )}

                {chatMessages.map((msg, index) => {
                    const isMine = msg.is_mine;
                    const prev = index > 0 ? chatMessages[index - 1] : null;
                    const next = index < chatMessages.length - 1 ? chatMessages[index + 1] : null;
                    const isFirst = !prev || prev.is_mine !== isMine;
                    const isLast  = !next || next.is_mine !== isMine;
                    const showDate = !prev || !sameDay(prev.timestamp, msg.timestamp);
                    const isSwiping = swipingId === msg.id;
                    const isSearchHighlight = searchQuery && searchResults[searchIdx]?.id === msg.id;

                    return (
                        <MessageBubble
                            key={msg.id}
                            msg={msg}
                            isMine={isMine}
                            isFirst={isFirst}
                            isLast={isLast}
                            showDate={showDate}
                            peerName={peerName}
                            starredMessages={starredMessages}
                            searchQuery={searchQuery}
                            isSearchHighlight={!!isSearchHighlight}
                            isSwiping={isSwiping}
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                            onLongPress={startLongPress}
                            onCancelLongPress={cancelLongPress}
                            onReaction={handleReaction}
                            onVote={(msgId, optIdx) => {
                                setChatMessages(prevMsgs => prevMsgs.map(m => m.id !== msgId ? m : {
                                    ...m, poll_data: m.poll_data ? {
                                        ...m.poll_data,
                                        votes: { ...m.poll_data.votes, me: String(optIdx) },
                                    } : m.poll_data,
                                }));
                            }}
                        />
                    );
                })}

                {/* Typing indicator — driven by real SSE peerTyping from store */}
                {peerTyping && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
                        <TypingIndicator />
                    </div>
                )}

                <div ref={endRef} style={{ height: 8 }} />
            </div>

            {/* ── Chat Input Controls Component ─────────────────────────────── */}
            <ChatInput
                inputText={inputText}
                setInputText={setInputText}
                handleSend={handleSend}
                sendTyping={sendTyping}
                attachOpen={attachOpen}
                setAttachOpen={setAttachOpen}
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                peerName={peerName}
                isRecording={isRecording}
                recordSec={recordSec}
                startRecording={startRecording}
                stopRecording={stopRecording}
                handleCamera={handleCamera}
                handleGallery={handleGallery}
                handleLocation={handleLocation}
                setShowPollModal={setShowPollModal}
            />

            {/* ── Profile Modal ────────────────────────────────────────────────── */}
            {showProfile && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                }} onClick={() => setShowProfile(false)}>
                    <div 
                        className="animate-pop"
                        style={{
                            width: '100%', maxWidth: '340px',
                            background: 'linear-gradient(145deg, #0f0f1c, #0a0a14)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '28px', padding: '32px 24px',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
                            textAlign: 'center',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
                            ...avStyle(activeConversationId || ''),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2rem', fontWeight: 800, color: 'white',
                        }}>
                            {peerName[0].toUpperCase()}
                        </div>
                        
                        <h2 style={{ color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '1.4rem', fontWeight: 900 }}>{peerName}</h2>
                        {peerContact?.verified ? (
                            <div style={{ color: '#2ecc71', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1.5px', marginBottom: '24px' }}>
                                ☑️ CONTACTO VERIFICADO
                            </div>
                        ) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1.5px', marginBottom: '24px' }}>
                                🔵 NO VERIFICADO
                            </div>
                        )}

                        <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '24px' }}>
                            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, display: 'block', marginBottom: '8px' }}>
                                Identity Hash (P2P Address)
                            </label>
                            <div style={{ 
                                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', 
                                color: 'var(--text-primary)', wordBreak: 'break-all', lineHeight: 1.4,
                                background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px'
                            }}>
                                {activeConversationId?.split('-')[1] || 'Unknown'}
                            </div>
                            <button 
                                onClick={() => navigator.clipboard.writeText(activeConversationId?.split('-')[1] || '')}
                                style={{
                                    width: '100%', marginTop: '12px', padding: '8px', borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                                }}
                            >
                                📋 Copiar Identidad
                            </button>
                        </div>

                        {/* Safety numbers (fingerprint) section */}
                        <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '24px' }}>
                            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, display: 'block', marginBottom: '8px' }}>
                                HUELLA DE SEGURIDAD (SAFETY NUMBER)
                            </label>
                            <div style={{ 
                                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', 
                                color: 'var(--text-primary)', wordBreak: 'break-all', lineHeight: 1.4,
                                background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px',
                                textAlign: 'center', letterSpacing: '1px', fontWeight: 700
                            }}>
                                {(() => {
                                    const combined = (identity?.identity_hash || '') + (peerContact?.identity_hash || '');
                                    let h = 0;
                                    for (let i = 0; i < combined.length; i++) h = (h * 31 + combined.charCodeAt(i)) >>> 0;
                                    const s = String(h).padEnd(20, '9');
                                    return `${s.slice(0, 5)} ${s.slice(5, 10)} ${s.slice(10, 15)} ${s.slice(15, 20)}`;
                                })()}
                            </div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.3 }}>
                                Compara este número con el de tu contacto para asegurar que la encriptación de extremo a extremo no ha sido vulnerada.
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>CIFRADO</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 800 }}>AES-GCM</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>PROTOCOLO</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--primary-bright)', fontWeight: 800 }}>Red v18.3 Zenith</div>
                            </div>
                        </div>

                        {/* Security action controls */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                            <button 
                                onClick={async () => {
                                    if (peerContact) {
                                        await RedAPI.verifyContact(peerContact.identity_hash);
                                        await useRedStore.getState().fetchData();
                                    }
                                }}
                                style={{
                                    padding: '11px', borderRadius: '12px', border: '1px solid rgba(232,33,58,0.3)',
                                    background: peerContact?.verified ? 'rgba(232,33,58,0.08)' : 'rgba(232,33,58,0.25)',
                                    color: 'var(--primary-bright)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {peerContact?.verified ? '⚠️ Desverificar Contacto' : '☑️ Marcar como Verificado'}
                            </button>
                            <button 
                                onClick={async () => {
                                    if (peerContact) {
                                        if (peerContact.blocked) {
                                            await RedAPI.unblockContact(peerContact.identity_hash);
                                        } else {
                                            await RedAPI.blockContact(peerContact.identity_hash);
                                        }
                                        await useRedStore.getState().fetchData();
                                    }
                                }}
                                style={{
                                    padding: '11px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)',
                                    background: peerContact?.blocked ? 'rgba(46,204,113,0.12)' : 'rgba(231,76,60,0.12)',
                                    color: peerContact?.blocked ? '#2ecc71' : '#e74c3c', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {peerContact?.blocked ? '🔓 Desbloquear Contacto' : '🚫 Bloquear Contacto'}
                            </button>
                        </div>

                        <button 
                            className="btn-primary" 
                            style={{ width: '100%', padding: '14px', borderRadius: '14px' }}
                            onClick={() => setShowProfile(false)}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
