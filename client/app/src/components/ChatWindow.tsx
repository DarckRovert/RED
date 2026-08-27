"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { MessageItem, RedAPI, summarizeChannelAI, translateTextAI } from "../lib/api";
import { mediaChunker } from "../lib/mesh/mediaChunker";
import { MessageBubble } from "./chat/MessageBubble";
import { ChatInput } from "./chat/ChatInput";
import { ChatHeader } from "./chat/ChatHeader";
import { SquadVoiceRoom } from "./call/SquadVoiceRoom";
import { MediaGalleryViewer } from "./chat/MediaGalleryViewer";
import { MessageForwardModal } from "./chat/MessageForwardModal";
import { SafetyNumberModal } from "./chat/SafetyNumberModal";
import { PollCreationModal } from "./chat/PollCreationModal";
import { ContactProfileModal } from "./ContactProfileModal";
import { GroupAdminModal } from "./GroupAdminModal";
import { toast } from "./Toast";
import { meshRouter } from "../lib/mesh/meshRouter";
import { TacticalAudioEngine } from "../lib/TacticalAudioEngine";
import { SettingsManager } from "../lib/settingsManager";
import { useTranslation } from "../lib/i18n/i18nEngine";

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
    const { t } = useTranslation();
    const {
        activeConversationId, conversations, contacts, groups, messages,
        sendMessage, sendTyping, sendTypingStatus, sendReaction, goBack, navigate, peerTyping, peerTypingStatus, addContact,
        deleteMessage, deleteMessageForEveryone, editMessage, clearConversation, starMessage, starredMessages,
        identity, peerPresence, markAsRead, preferences, setActiveCallType, deleteContact, blockNode, fetchData,
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
    let cleanRaw = rawPeerHash.replace(/^did:red:/i, '').trim();
    if (cleanRaw.includes(':') && !/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/i.test(cleanRaw)) {
        const parts = cleanRaw.split(':');
        if (parts[0].length >= 16) cleanRaw = parts[0].trim();
    }
    const peerHash = cleanRaw.toLowerCase();
    const currentGroup = groups.find((g: any) => g && (g.id === activeConversationId || g.id === peerHash || g.id === canonicalFromMesh));
    const isGroupChat = Boolean(currentGroup);

    const peerContact = contacts.find((c: any) => 
        c.identity_hash === peerHash ||
        (canonicalFromMesh && c.identity_hash === canonicalFromMesh) ||
        (peerHash.length >= 8 && c.identity_hash?.startsWith(peerHash)) ||
        (c.identity_hash?.length >= 8 && peerHash.startsWith(c.identity_hash))
    );
    // Full 64-character identity hash of peer for crypto & WebRTC signaling
    const fullPeerHash = activeConv?.peer || peerContact?.identity_hash || (
        canonicalFromMesh && canonicalFromMesh.length === 64 ? canonicalFromMesh : (
            peerHash && peerHash.length === 64 ? peerHash : (
                contacts.find((c: any) => peerHash && peerHash.length >= 8 && c.identity_hash.includes(peerHash))?.identity_hash || peerHash
            )
        )
    );
    const meshPeer = meshRouter.getPeerByAnyId(peerHash) || (canonicalFromMesh ? meshRouter.getPeerByAnyId(canonicalFromMesh) : undefined);
    const peerPk = meshPeer?.publicKey || peerContact?.public_key || null;
    const peerName = isGroupChat
        ? (currentGroup.name || "Escuadrón Cifrado")
        : (peerContact?.display_name)
            ? peerContact.display_name
            : (meshPeer?.name && !meshPeer.name.startsWith('RED-') && !meshPeer.name.startsWith('Operador ') && !meshPeer.name.startsWith('Dispositivo RED')
                ? meshPeer.name
                : (peerHash ? `${peerHash.substring(0, 12)}…` : "Desconocido"));

    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
    const [pinnedMessage, setPinnedMessage] = useState<MessageItem | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [burnTimer, setBurnTimer] = useState<number | undefined>(undefined);
    const [burnMenuOpen, setBurnMenuOpen] = useState(false);
    const [forwardingMsg, setForwardingMsg] = useState<MessageItem | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [activeSquadCall, setActiveSquadCall] = useState<{ groupId: string; groupName: string; members: string[]; callType: 'audio' | 'video' } | null>(null);
    const [isContactProfileOpen, setIsContactProfileOpen] = useState(false);
    const [selectedViewerMedia, setSelectedViewerMedia] = useState<MessageItem | null>(null);
    const [editingMsg, setEditingMsg] = useState<MessageItem | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
    const [showPollModal, setShowPollModal] = useState(false);

    // Ref so selection callbacks can access convMessages without ordering issues
    const convMessagesRef = useRef<MessageItem[]>([]);

    const enterSelectionMode = useCallback((msg: MessageItem) => {
        setIsSelectionMode(true);
        setSelectedMsgIds(new Set([msg.id]));
    }, []);

    const toggleMsgSelect = useCallback((msgId: string) => {
        setSelectedMsgIds(prev => {
            const next = new Set(prev);
            if (next.has(msgId)) next.delete(msgId);
            else next.add(msgId);
            return next;
        });
    }, []);

    const exitSelectionMode = useCallback(() => {
        setIsSelectionMode(false);
        setSelectedMsgIds(new Set());
    }, []);

    const deleteSelected = useCallback(() => {
        selectedMsgIds.forEach(id => deleteMessage(id));
        exitSelectionMode();
        toast.success(`${selectedMsgIds.size} mensaje(s) eliminado(s)`);
    }, [selectedMsgIds, deleteMessage, exitSelectionMode]);

    const forwardSelected = useCallback(() => {
        const first = convMessagesRef.current.find(m => selectedMsgIds.has(m.id));
        if (first) setForwardingMsg(first);
        exitSelectionMode();
    }, [selectedMsgIds, exitSelectionMode]);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const mediaInputRef = useRef<HTMLInputElement | null>(null);
    const docInputRef = useRef<HTMLInputElement | null>(null);

    const convMessages = useMemo(() => {
        // ── Comprehensive Protocol Packet Filter ─────────────────────────────────
        // This is the LAST defensive line in the rendering pipeline.
        // Any packet that escaped addIncomingMessage handlers must be stopped here.
        const PROTOCOL_MSG_TYPES = new Set([
            'read_receipt', 'read_up_to', 'delivery_ack', 'ack',
            'typing', 'typing_status',
            'contact_request', 'contact_response',
            'profile_update',
            'group_history_request', 'group_history_response',
            'webrtc_signal',
            'voice_burst', 'voice_burst_ack',
            'live_announce', 'live_frame', 'live_end', 'live_comment',
            'social_react',
            'message_edit', 'message_delete',
            'conversation_wipe', 'message_wipe',
            'emergency_beacon_cancel',
            'channel_msg', 'channel_post',
            'group_invite', 'group_kick', 'group_leave', 'group_admin',
        ]);

        const isGroupConv = isGroupChat;

        // Detects JSON objects that are signaling packets by structure (content-based heuristic)
        const isJsonSignaling = (content: string): boolean => {
            if (!content || typeof content !== 'string') return false;
            const trimmed = content.trim();
            if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('{\\"')) return false;

            // Fast string signature detection for protocol control payloads (matches escaped and unescaped)
            if (
                trimmed.includes('sender_hash') ||
                trimmed.includes('sender_pk') ||
                trimmed.includes('read_up_to') ||
                trimmed.includes('reader_hash') ||
                trimmed.includes('delivery_ack') ||
                trimmed.includes('contact_request') ||
                trimmed.includes('contact_response') ||
                trimmed.includes('IDENTITY_ANNOUNCE') ||
                trimmed.includes('IDENTITY_RESPONSE') ||
                trimmed.includes('SHAKE_PAIR_') ||
                trimmed.includes('user_remote_wipe') ||
                trimmed.includes('webrtc_signal') ||
                trimmed.includes('"offer"') ||
                trimmed.includes('\\"offer\\"') ||
                trimmed.includes('"answer"') ||
                trimmed.includes('\\"answer\\"')
            ) {
                return true;
            }

            // In 1-to-1 chats, filter out raw group invites and raw group message JSON
            if (!isGroupConv && (trimmed.includes('"type":"group_invite"') || trimmed.includes('"type":"group_message"') || trimmed.includes('"type":"squad_msg"'))) {
                return true;
            }

            try {
                const c = JSON.parse(trimmed);
                // Type-tagged mesh packets
                if (c.type && typeof c.type === 'string' && (
                    c.type.startsWith('IDENTITY_') ||
                    c.type.startsWith('SHAKE_') ||
                    c.type.startsWith('RED_PAIR') ||
                    c.type === 'DELIVERY_ACK' ||
                    c.type === 'PROFILE_UPDATE' ||
                    c.type === 'NODE_LOCATION_UPDATE' ||
                    c.type === 'group_invite' ||
                    (!isGroupConv && (c.type === 'group_message' || c.type === 'squad_msg'))
                )) return true;

                // Inspect inner nested content if wrapped
                if (typeof c.content === 'string' && isJsonSignaling(c.content)) {
                    return true;
                }

                // Presence of ≥1 signaling-specific keys
                const SIGNAL_KEYS = ['read_up_to', 'reader_hash', 'offer', 'answer', 'candidate', 'hangup', 'sender_hash', 'sender_pk', 'beacon_id'];
                if (SIGNAL_KEYS.some(k => k in c || (typeof c.content === 'string' && c.content.includes(k)))) return true;
                // Remote wipe
                if (c.reason === 'user_remote_wipe') return true;
            } catch {}
            return false;
        };

        const isProtocolPacket = (m: MessageItem): boolean => {
            if (m.msg_type && PROTOCOL_MSG_TYPES.has(m.msg_type)) return true;
            if (!isGroupConv && (m.msg_type === 'group_message' || m.msg_type === 'squad_msg')) return true;
            if (typeof m.content === 'string' && isJsonSignaling(m.content)) return true;
            return false;
        };

        const list: MessageItem[] = Array.isArray(messages) ? messages : ((messages as any)?.[activeConversationId || ""] || []);
        const validMsgs = list.filter((m: MessageItem) => {
            if (!m || !m.content) return false;
            if (isProtocolPacket(m)) return false;
            return true;
        }).map((m: MessageItem) => {
            if (isGroupConv && typeof m.content === 'string' && m.content.startsWith('{') && (m.content.includes('"type":"group_message"') || m.content.includes('"type":"squad_msg"'))) {
                try {
                    const parsed = JSON.parse(m.content);
                    if (parsed.content !== undefined) {
                        return {
                            ...m,
                            content: parsed.content,
                            sender: parsed.sender || m.sender,
                            media_data: parsed.media_data || m.media_data,
                            msg_type: parsed.msg_type || m.msg_type || 'text'
                        };
                    }
                } catch {}
            }
            return m;
        });

        // Deterministic deduplication pass (eliminates duplicate bubbles from dual SSE + MeshRouter channels)
        const deduped: MessageItem[] = [];
        const seenIds = new Set<string>();
        for (const m of validMsgs) {
            if (m.id && seenIds.has(m.id)) continue;

            const mTs = m.timestamp ? (m.timestamp > 1e11 ? m.timestamp / 1000 : m.timestamp) : 0;
            const isDup = deduped.some(d => {
                if (d.id && m.id && d.id === m.id) return true;
                const dTs = d.timestamp ? (d.timestamp > 1e11 ? d.timestamp / 1000 : d.timestamp) : 0;
                const timeDiff = Math.abs(dTs - mTs);
                const dContent = (d.content || '').trim();
                const mContent = (m.content || '').trim();
                if (dContent === mContent && Boolean(d.is_mine) === Boolean(m.is_mine) && timeDiff < 30) {
                    return true;
                }
                return false;
            });

            if (!isDup) {
                if (m.id) seenIds.add(m.id);
                deduped.push(m);
            }
        }

        // Sort chronologically — messages arrive out-of-order (own: optimistic, peer: SSE delay)
        deduped.sort((a, b) => {
            const tsA = a.timestamp ? (a.timestamp > 1e11 ? a.timestamp / 1000 : a.timestamp) : 0;
            const tsB = b.timestamp ? (b.timestamp > 1e11 ? b.timestamp / 1000 : b.timestamp) : 0;
            return tsA - tsB;
        });

        return deduped;
    }, [messages, activeConversationId, isGroupChat, groups]);

    // Keep ref in sync with latest convMessages
    useEffect(() => { convMessagesRef.current = convMessages; }, [convMessages]);

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

    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [showScrollBottomFab, setShowScrollBottomFab] = useState(false);
    const [unreadInChatCount, setUnreadInChatCount] = useState(0);

    // P2P Quick Payment modal states
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [payAmount, setPayAmount] = useState("25");
    const [payMemo, setPayMemo] = useState("");

    // Security Sprint 4: Safety Number & Remote Wipe states
    const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
    const [isWipeConfirmOpen, setIsWipeConfirmOpen] = useState(false);
    const [isSecurityMenuOpen, setIsSecurityMenuOpen] = useState(false);

    const isVerified = Boolean(peerContact?.is_verified);
    const isKeyChanged = Boolean(peerContact?.key_changed || (peerContact?.previous_public_key && peerContact?.previous_public_key !== peerContact?.public_key));

    const handleRemoteWipe = async () => {
        if (!peerHash) return;
        try {
            await sendMessage(JSON.stringify({ reason: "user_remote_wipe", timestamp: Date.now() / 1000 }), {
                msg_type: "conversation_wipe",
            });
            await clearConversation();
            toast.success("💣 Orden de borrado remoto enviada y chat purgado.");
            setIsWipeConfirmOpen(false);
        } catch {
            toast.error("Error al ejecutar borrado remoto");
        }
    };

    const handleScroll = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const isUp = distFromBottom > 150;
        setShowScrollBottomFab(isUp);
        if (!isUp) {
            setUnreadInChatCount(0);
        }
    }, []);

    const scrollToBottom = useCallback((smooth = true) => {
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }, []);

    useEffect(() => {
        scrollToBottom(false);
        // Mark conversation as read when opened
        if (activeConversationId) markAsRead(activeConversationId);
    }, [activeConversationId]);

    useEffect(() => {
        if (showScrollBottomFab) {
            setUnreadInChatCount(c => c + 1);
        } else {
            scrollToBottom(true);
        }
    }, [convMessages.length]);

    const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordSec, setRecordSec] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordTimerRef = useRef<any>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordedMimeTypeRef = useRef<string>("audio/webm");
    // Voice preview state
    const [voicePreviewBlob, setVoicePreviewBlob] = useState<Blob | null>(null);
    const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
    const [voiceDurationSec, setVoiceDurationSec] = useState(0);
    // Media preview state
    const [mediaPreview, setMediaPreview] = useState<{ dataUrl: string; type: "image" | "video"; mimeType: string; caption: string } | null>(null);

    const isOnline = peerPresence?.[peerHash] === 'online' || peerPresence?.[peerHash] === 'nearby';

    const handleSendPayment = async (amount: number, memo?: string) => {
        if (!peerHash) return;
        try {
            const voucher = await RedAPI.createP2PVoucher({ amount, recipient: peerHash, memo });
            const payload = {
                voucher_id: voucher.id,
                amount: voucher.amount,
                memo: voucher.memo,
                signature: voucher.signature,
                recipient: peerHash,
                created_at: voucher.created_at,
                qr_payload: voucher.qr_payload
            };
            await sendMessage(JSON.stringify(payload), {
                msg_type: "p2p_payment",
            });
            TacticalAudioEngine.playMessageSent();
            toast.success(`🪙 Transferencia de ${amount} RED enviada`);
            setIsPayModalOpen(false);
            setPayMemo("");
        } catch {
            toast.error("Error al procesar transferencia P2P");
        }
    };

    const handleSendText = async (text: string, replyToMsg?: MessageItem | null) => {
        if (!text.trim() || !peerHash) return;

        // Command /pay support
        if (text.startsWith("/pay ") || text === "/pay") {
            const parts = text.trim().split(" ");
            const amt = parseFloat(parts[1] || "25");
            const memo = parts.slice(2).join(" ") || "Pago Táctico RED";
            if (isNaN(amt) || amt <= 0) {
                toast.error("Monto inválido. Ejemplo: /pay 50 Café");
                return;
            }
            await handleSendPayment(amt, memo);
            return;
        }

        const resolvedReply = replyToMsg || replyTo;
        try {
            await sendMessage(text.trim(), {
                msg_type: "text",
                ttl: burnTimer,
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
                await sendMessage(b64, { msg_type: "voice", mime_type: recordedMimeTypeRef.current, duration_ms: recordSec * 1000 });
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

            // Determine best supported tactical voice codec (Opus 24 kbps)
            let mimeType: string | undefined = undefined;
            if (typeof MediaRecorder !== "undefined") {
                if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
                    mimeType = "audio/webm;codecs=opus";
                } else if (MediaRecorder.isTypeSupported("audio/webm")) {
                    mimeType = "audio/webm";
                } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
                    mimeType = "audio/mp4";
                } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
                    mimeType = "audio/ogg;codecs=opus";
                }
            }

            // Tactical Opus audio at 24 kbps (5.3x lighter, crystal clear speech, instant mesh delivery)
            const recorderOptions: MediaRecorderOptions = {
                audioBitsPerSecond: 24000
            };
            if (mimeType) {
                recorderOptions.mimeType = mimeType;
            }
            recordedMimeTypeRef.current = mimeType || "audio/webm";

            const mr = new MediaRecorder(stream, recorderOptions);
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
            const blob = new Blob(audioChunksRef.current, { type: recordedMimeTypeRef.current });
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
                await sendMessage(b64, { msg_type: "voice", mime_type: recordedMimeTypeRef.current, duration_ms: dur * 1000 });
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

    const handleCreatePoll = async (pollData: { question: string; options: string[]; allowMultiple?: boolean }) => {
        if (!peerHash) return;
        try {
            const payload = {
                question: pollData.question,
                options: pollData.options.map((text, idx) => ({ id: idx, text, votes: 0 })),
                allow_multiple: Boolean(pollData.allowMultiple),
                created_at: Math.floor(Date.now() / 1000),
            };
            await sendMessage(JSON.stringify(payload), {
                msg_type: "poll",
            });
            TacticalAudioEngine.playMessageSent();
        } catch {
            toast.error("Error al publicar encuesta");
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
            <ChatHeader
                goBack={goBack}
                setIsContactProfileOpen={setIsContactProfileOpen}
                peerHash={peerHash}
                fullPeerHash={fullPeerHash}
                peerName={peerName}
                isOnline={isOnline}
                isVerified={isVerified}
                setIsSafetyModalOpen={setIsSafetyModalOpen}
                peerTypingStatus={peerTypingStatus}
                peerTyping={peerTyping}
                burnTimer={burnTimer}
                setBurnTimer={setBurnTimer}
                burnMenuOpen={burnMenuOpen}
                setBurnMenuOpen={setBurnMenuOpen}
                searchOpen={searchOpen}
                setSearchOpen={setSearchOpen}
                setActiveCallType={setActiveCallType}
                handleSummarize={handleSummarize}
                isSummarizing={isSummarizing}
                isSecurityMenuOpen={isSecurityMenuOpen}
                setIsSecurityMenuOpen={setIsSecurityMenuOpen}
                setIsWipeConfirmOpen={setIsWipeConfirmOpen}
                avStyle={avStyle}
                isGroupChat={isGroupChat}
                onStartGroupCall={(type) => {
                    if (currentGroup) {
                        const members = (currentGroup.members || []).map((m: any) => typeof m === 'string' ? m : (m.identity_hash || m.hash || ''));
                        setActiveSquadCall({
                            groupId: currentGroup.id,
                            groupName: currentGroup.name || 'Escuadrón',
                            members,
                            callType: type,
                        });
                    }
                }}
            />

            {/* Floating In-Chat Search HUD */}
            {searchOpen && (
                <div style={{
                    padding: "8px 14px",
                    background: "rgba(10, 14, 28, 0.98)",
                    backdropFilter: "blur(20px)",
                    borderBottom: "1px solid rgba(0, 229, 255, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    zIndex: 45,
                    animation: "fadeIn 0.15s ease-out",
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.6)"
                }}>
                    <span style={{ fontSize: "0.9rem", color: "var(--accent-cyan)" }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Buscar en esta conversación..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentMatchIdx(0);
                        }}
                        autoFocus
                        style={{
                            flex: 1,
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid var(--glass-border)",
                            borderRadius: "10px",
                            padding: "6px 12px",
                            color: "#FFFFFF",
                            fontSize: "0.85rem",
                            outline: "none"
                        }}
                    />
                    {searchMatches.length > 0 && (
                        <div style={{ fontSize: "0.74rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" }}>
                            {currentMatchIdx + 1} de {searchMatches.length}
                        </div>
                    )}
                    {searchQuery && searchMatches.length === 0 && (
                        <div style={{ fontSize: "0.74rem", color: "var(--accent-crimson)", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" }}>
                            Sin coincidencias
                        </div>
                    )}
                    <button
                        onClick={handlePrevMatch}
                        disabled={searchMatches.length <= 1}
                        className="btn-icon"
                        style={{ width: 28, height: 28, fontSize: "0.8rem", color: searchMatches.length > 1 ? "#fff" : "var(--text-muted)" }}
                        title="Coincidencia anterior"
                    >
                        ▲
                    </button>
                    <button
                        onClick={handleNextMatch}
                        disabled={searchMatches.length <= 1}
                        className="btn-icon"
                        style={{ width: 28, height: 28, fontSize: "0.8rem", color: searchMatches.length > 1 ? "#fff" : "var(--text-muted)" }}
                        title="Coincidencia siguiente"
                    >
                        ▼
                    </button>
                    <button
                        onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                        className="btn-icon"
                        style={{ width: 28, height: 28, fontSize: "0.85rem", color: "var(--text-muted)" }}
                        title="Cerrar búsqueda"
                    >
                        ✕
                    </button>
                </div>
            )}

            {activeSquadCall && (
                <SquadVoiceRoom
                    groupId={activeSquadCall.groupId}
                    groupName={activeSquadCall.groupName}
                    memberHashes={activeSquadCall.members}
                    callType={activeSquadCall.callType}
                    onClose={() => setActiveSquadCall(null)}
                />
            )}


            {/* Banner táctico de Agregar a Contactos si el interlocutor aún no está en la libreta */}
            {!isGroupChat && !peerContact && peerHash && peerHash !== 'me' && peerHash !== 'local' && (
                <div style={{
                    padding: "8px 14px", margin: "6px 12px 0px 12px", borderRadius: "10px",
                    background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.3)",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px"
                }}>
                    <div style={{ fontSize: "0.78rem", color: "#FFFFFF", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>👤</span>
                        <span>{t.sidebar?.no_contacts_desc || "Este interlocutor no está en tu lista de contactos."}</span>
                    </div>
                    <button
                        onClick={async () => {
                            await addContact(peerHash, peerName, peerPk);
                            toast.success(`🤝 ${peerName}`);
                        }}
                        className="btn-tactical-primary"
                        style={{ padding: "4px 10px", fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                        ➕ {t.sidebar?.add_contact_btn || "GUARDAR CONTACTO"}
                    </button>
                </div>
            )}

            {/* Key-Change Warning Banner */}
            {isKeyChanged && (
                <div
                    onClick={() => setIsSafetyModalOpen(true)}
                    style={{
                        padding: "10px 14px", margin: "8px 12px 0px 12px", borderRadius: "10px",
                        background: "rgba(255, 171, 0, 0.15)", border: "1px solid rgba(255, 171, 0, 0.4)",
                        color: "#FFD54F", fontSize: "0.78rem", fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer"
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>⚠️</span>
                        <span>{t.safety_number?.unverified || "La clave pública de este contacto ha cambiado. Toca para verificar su Safety Number."}</span>
                    </div>
                    <span style={{ textDecoration: "underline", fontSize: "0.72rem", flexShrink: 0 }}>{t.safety_number?.verify_action || "Verificar →"}</span>
                </div>
            )}

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
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="scroll-container"
                style={{ flex: 1, padding: "16px 14px", display: "flex", flexDirection: "column", gap: "4px", position: "relative" }}
            >
                {convMessages.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "24px 16px" }}>
                        <div className="cyber-hologram-shield" style={{ maxWidth: "340px", width: "100%", textAlign: "center" }}>
                            <div style={{
                                width: 64, height: 64, borderRadius: "20px",
                                background: "linear-gradient(135deg, rgba(0, 229, 255, 0.2) 0%, rgba(232, 33, 58, 0.2) 100%)",
                                border: "1px solid rgba(0, 229, 255, 0.4)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "2rem",
                                animation: "cyberShieldGlow 3s ease-in-out infinite",
                                boxShadow: "0 0 24px rgba(0, 229, 255, 0.35)"
                            }}>
                                🛡️
                            </div>
                            <div>
                                <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.4px" }}>
                                    CANAL TÁCTICO CIFRADO
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginTop: "2px" }}>
                                    NOISE XK • KYBER-768 PQC • SLED DB
                                </div>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                Este canal está blindado contra interceptación. Los mensajes viajan de par a par sin intermediarios centrales.
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginTop: "6px" }}>
                                <button
                                    onClick={() => setIsSafetyModalOpen(true)}
                                    className="tactical-action-chip"
                                >
                                    <span>🛡️</span> Safety Number
                                </button>
                                <button
                                    onClick={() => navigate("compass")}
                                    className="tactical-action-chip"
                                >
                                    <span>🧭</span> Brújula Táctica
                                </button>
                                <button
                                    onClick={() => navigate("radar")}
                                    className="tactical-action-chip"
                                >
                                    <span>📡</span> Radar Malla
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    convMessages.map((msg, index) => {
                        const isMine = Boolean(
                            msg.is_mine ||
                            msg.sender === "me" ||
                            (identity?.identity_hash && (
                                msg.sender?.toLowerCase() === identity.identity_hash.toLowerCase() ||
                                (msg.sender && (msg.sender.length >= 8 && msg.sender.length < identity.identity_hash.length) && identity.identity_hash.toLowerCase().startsWith(msg.sender.toLowerCase()))
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
                                showDate={index === 0 || !prevMsg || (() => { const a = msg.timestamp > 1e11 ? msg.timestamp / 1000 : msg.timestamp; const b = prevMsg.timestamp > 1e11 ? prevMsg.timestamp / 1000 : prevMsg.timestamp; const sameDay = new Date(a*1000).toDateString() === new Date(b*1000).toDateString(); return !sameDay; })()}
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
                                onForward={(m) => setForwardingMsg(m)}
                                onEdit={(m) => setEditingMsg(m)}
                                onDeleteForEveryone={(id) => deleteMessageForEveryone(id)}
                                onOpenMediaGallery={(m) => setSelectedViewerMedia(m)}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedMsgIds.has(msg.id)}
                                onToggleSelect={toggleMsgSelect}
                                onSelectMode={enterSelectionMode}
                                isGroupChat={isGroupChat}
                            />
                        );
                    })
                )}
                {/* Multi-Selection Toolbar */}
                {isSelectionMode && (
                    <div style={{
                        position: "sticky", bottom: 0,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 16px",
                        background: "rgba(14,16,30,0.98)", backdropFilter: "blur(16px)",
                        borderTop: "1px solid rgba(0,229,255,0.2)",
                        gap: "10px", zIndex: 50
                    }}>
                        <button
                            onClick={exitSelectionMode}
                            style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "0.82rem", cursor: "pointer", padding: "6px 10px" }}
                        >
                            ✕ Cancelar
                        </button>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>
                            {selectedMsgIds.size} seleccionado{selectedMsgIds.size !== 1 ? "s" : ""}
                        </span>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button
                                onClick={forwardSelected}
                                disabled={selectedMsgIds.size === 0}
                                style={{
                                    padding: "7px 14px", borderRadius: "20px",
                                    background: "rgba(0,229,255,0.12)", border: "1px solid rgba(0,229,255,0.3)",
                                    color: "var(--accent-cyan, #00E5FF)", fontSize: "0.8rem", fontWeight: 700,
                                    cursor: selectedMsgIds.size === 0 ? "not-allowed" : "pointer"
                                }}
                            >
                                ➡️ Reenviar
                            </button>
                            <button
                                onClick={deleteSelected}
                                disabled={selectedMsgIds.size === 0}
                                style={{
                                    padding: "7px 14px", borderRadius: "20px",
                                    background: "rgba(232,33,58,0.14)", border: "1px solid rgba(232,33,58,0.4)",
                                    color: "#FF4B6B", fontSize: "0.8rem", fontWeight: 700,
                                    cursor: selectedMsgIds.size === 0 ? "not-allowed" : "pointer"
                                }}
                            >
                                🗑️ Eliminar
                            </button>
                        </div>
                    </div>
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

            {/* Scroll-to-Bottom Floating Action Button (FAB) */}
            {showScrollBottomFab && (
                <button
                    onClick={() => {
                        scrollToBottom(true);
                        setUnreadInChatCount(0);
                        setShowScrollBottomFab(false);
                    }}
                    style={{
                        position: "absolute",
                        right: "20px",
                        bottom: "84px",
                        zIndex: 40,
                        background: "rgba(18, 22, 38, 0.96)",
                        backdropFilter: "blur(14px)",
                        border: "1.5px solid var(--accent-cyan)",
                        borderRadius: "28px",
                        padding: unreadInChatCount > 0 ? "8px 14px" : "10px 14px",
                        color: "#FFFFFF",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        boxShadow: "0 6px 24px rgba(0, 229, 255, 0.4)",
                        animation: "fadeIn 0.2s ease-out"
                    }}
                    title="Bajar al mensaje más reciente"
                >
                    <span style={{ fontSize: "1.1rem", color: "var(--accent-cyan)", fontWeight: 900 }}>↓</span>
                    {unreadInChatCount > 0 && (
                        <span style={{
                            background: "var(--accent-cyan)",
                            color: "#000",
                            fontSize: "0.72rem",
                            fontWeight: 900,
                            borderRadius: "12px",
                            padding: "2px 7px",
                            fontFamily: "JetBrains Mono, monospace"
                        }}>
                            {unreadInChatCount}
                        </span>
                    )}
                </button>
            )}

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
                    handlePay={() => setIsPayModalOpen(true)}
                    setShowPollModal={setShowPollModal}
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

            {/* Tactical Quick Pay Modal */}
            {isPayModalOpen && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 100,
                    background: "rgba(6, 8, 16, 0.88)", backdropFilter: "blur(14px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "16px"
                }}>
                    <div style={{
                        width: "100%", maxWidth: "360px",
                        background: "rgba(18, 22, 38, 0.98)",
                        border: "1.5px solid var(--accent-emerald)",
                        borderRadius: "20px", padding: "22px",
                        boxShadow: "0 12px 40px rgba(0, 230, 118, 0.25)",
                        display: "flex", flexDirection: "column", gap: "16px"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "1.4rem" }}>🪙</span>
                                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#FFFFFF" }}>
                                    Transferir RED Tokens
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPayModalOpen(false)}
                                className="btn-icon"
                                style={{ width: 30, height: 30 }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                            Destinatario: <strong style={{ color: "#FFFFFF" }}>{peerName}</strong>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                                MONTO (RED)
                            </label>
                            <input
                                type="number"
                                value={payAmount}
                                onChange={(e) => setPayAmount(e.target.value)}
                                min="1"
                                style={{
                                    width: "100%", padding: "10px 14px",
                                    borderRadius: "10px", background: "rgba(255,255,255,0.06)",
                                    border: "1px solid var(--glass-border)", color: "#FFFFFF",
                                    fontSize: "1.3rem", fontWeight: 900, fontFamily: "JetBrains Mono, monospace"
                                }}
                            />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
                                CONCEPTO / MEMO (OPCIONAL)
                            </label>
                            <input
                                type="text"
                                value={payMemo}
                                onChange={(e) => setPayMemo(e.target.value)}
                                placeholder="Ej: Pago café táctico"
                                style={{
                                    width: "100%", padding: "10px 14px",
                                    borderRadius: "10px", background: "rgba(255,255,255,0.06)",
                                    border: "1px solid var(--glass-border)", color: "#FFFFFF",
                                    fontSize: "0.88rem"
                                }}
                            />
                        </div>

                        <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                            <button
                                onClick={() => setIsPayModalOpen(false)}
                                className="btn-tactical-secondary"
                                style={{ flex: 1, padding: "12px", borderRadius: "12px" }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const amt = parseFloat(payAmount);
                                    if (isNaN(amt) || amt <= 0) {
                                        toast.error("Monto inválido");
                                        return;
                                    }
                                    handleSendPayment(amt, payMemo);
                                }}
                                className="btn-tactical-primary"
                                style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "var(--accent-emerald)", color: "#000" }}
                            >
                                💸 Enviar Pago
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contact Profile & Shared Media Modal */}
            {/* Contact Profile Modal (Direct) or Squad Admin Modal (Group) */}
            {isContactProfileOpen && (
                isGroupChat ? (
                    <GroupAdminModal
                        groupId={currentGroup?.id || activeConversationId || ""}
                        groupName={currentGroup?.name || peerName}
                        members={currentGroup?.members || []}
                        broadcastOnly={currentGroup?.broadcast_only}
                        onClose={() => {
                            setIsContactProfileOpen(false);
                            fetchData();
                        }}
                    />
                ) : (
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
                        onDeleteContact={() => {
                            const target = fullPeerHash || peerHash;
                            deleteContact(target);
                            setIsContactProfileOpen(false);
                            goBack();
                        }}
                        onBlockNode={() => {
                            const target = fullPeerHash || peerHash;
                            blockNode(target);
                            setIsContactProfileOpen(false);
                            goBack();
                        }}
                    />
                )
            )}

            {/* Media Gallery Full-Screen Modal */}
            {selectedViewerMedia && (
                <MediaGalleryViewer
                    activeMedia={selectedViewerMedia}
                    allMessages={convMessages}
                    onClose={() => setSelectedViewerMedia(null)}
                />
            )}

            {/* Message Forward Modal */}
            {forwardingMsg && (
                <MessageForwardModal
                    msg={forwardingMsg}
                    onClose={() => setForwardingMsg(null)}
                />
            )}

            {/* Signal-Class Safety Number Modal (Sprint 4) */}
            {isSafetyModalOpen && (
                <SafetyNumberModal
                    peerHash={peerHash}
                    peerName={peerName}
                    peerPublicKey={peerContact?.public_key}
                    isVerified={isVerified}
                    onClose={() => setIsSafetyModalOpen(false)}
                    onVerifiedChange={(verified) => {
                        if (peerContact) peerContact.is_verified = verified;
                    }}
                />
            )}

            {/* Remote Wipe Confirmation Modal */}
            {isWipeConfirmOpen && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 10000,
                        background: "rgba(4, 6, 14, 0.88)", backdropFilter: "blur(18px)",
                        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px"
                    }}
                    onClick={() => setIsWipeConfirmOpen(false)}
                >
                    <div
                        className="card-tactical animate-enter"
                        style={{
                            width: "100%", maxWidth: "420px", padding: "20px",
                            boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
                            display: "flex", flexDirection: "column", gap: "14px"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "1.3rem" }}>💣</span>
                            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--accent-crimson, #FF3C5F)" }}>
                                Confirmar Borrado Remoto P2P
                            </h2>
                        </div>
                        <div style={{ fontSize: "0.8rem", lineHeight: 1.5, color: "var(--text-secondary)" }}>
                            Esta acción enviará una orden criptográfica firmada a <strong>{peerName}</strong> para purgar inmediatamente todo el historial de chat en ambos dispositivos. Esta acción es <strong>irreversible</strong>.
                        </div>
                        <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                            <button
                                onClick={handleRemoteWipe}
                                className="btn-tactical-primary"
                                style={{
                                    flex: 1, padding: "10px", fontSize: "0.82rem", fontWeight: 800,
                                    background: "var(--accent-crimson, #FF3C5F)", borderColor: "rgba(255,60,95,0.6)"
                                }}
                            >
                                Sí, Purgar en Ambos Lados
                            </button>
                            <button
                                onClick={() => setIsWipeConfirmOpen(false)}
                                className="btn-secondary"
                                style={{ padding: "10px 16px", fontSize: "0.82rem" }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* P2P Decentralized Poll Creation Modal */}
            <PollCreationModal
                isOpen={showPollModal}
                onClose={() => setShowPollModal(false)}
                onCreatePoll={handleCreatePoll}
            />
        </div>
    );
}
