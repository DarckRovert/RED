import { StateCreator } from 'zustand';
import { RedStore, StoryEntry, LiveStreamItem } from '../types';
import { MessageItem, ConversationItem } from '../../api/types';
import { RedAPI } from '../../api/client';
import { meshRouter, normalizeIdentity, generateDeterministicMsgId } from '../../lib/mesh/meshRouter';
import { localTransport } from '../../lib/mesh/localTransport';
import { TacticalAudioEngine } from '../../lib/audio/TacticalAudioEngine';
import { GuardianEngine } from '../../lib/ai/guardianEngine';
import { indexedMediaVault } from '../../lib/storage/indexedMediaVault';
import { SettingsManager } from '../../lib/settingsManager';
import { MeshProofOfWork } from '../../lib/crypto/MeshProofOfWork';
import { toast } from '../../components/Toast';
import { dispatchIncomingMessage, recordProcessedMessageId } from '../events/messageDispatcher';

export const createChatSlice: StateCreator<RedStore, [], [], Partial<RedStore>> = (set, get) => ({
    conversations: [],

    messages: [],

    starredMessages: [],

    peerTyping: false,

    typingTimeout: null,

    peerPresence: {},

    peerTypingStatus: {},

    liveStreams: {},

    myStories: typeof window !== 'undefined' ? (() => {
        try {
            const raw = localStorage.getItem('red_my_stories');
            const arr = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(arr)) return [];
            const cutoff = Date.now() - 24 * 3600 * 1000;
            return arr.filter((s: StoryEntry) => s.timestamp > cutoff);
        } catch { return []; }
    })() : [],

    peerStories: typeof window !== 'undefined' ? (() => {
        try {
            const raw = localStorage.getItem('red_peer_stories');
            const map = raw ? JSON.parse(raw) : {};
            if (typeof map !== 'object' || !map) return {};
            const cutoff = Date.now() - 24 * 3600 * 1000;
            const cleaned: Record<string, MessageItem[]> = {};
            for (const sender of Object.keys(map)) {
                const arr = Array.isArray(map[sender]) ? map[sender] : [];
                const valid = arr.filter((m: MessageItem) => {
                    const ts = m.timestamp > 1e10 ? m.timestamp : m.timestamp * 1000;
                    return ts > cutoff;
                });
                if (valid.length > 0) cleaned[sender] = valid;
            }
            return cleaned;
        } catch { return {}; }
    })() : {},

    activeLiveStreamId: null,

    isStreaming: false,

    streamId: null,

    // Advanced Chat Management (v8.0),

    pinnedChatIds: typeof window !== 'undefined' ? (() => {
        try {
            const raw = localStorage.getItem('red_pinned_chats');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    })() : [],

    archivedChatIds: typeof window !== 'undefined' ? (() => {
        try {
            const raw = localStorage.getItem('red_archived_chats');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    })() : [],

    activeConversationId: null,

    // WebRTC Call Signaling State,

    togglePinChat: (id: string) => {
        const current = Array.isArray(get().pinnedChatIds) ? get().pinnedChatIds : [];
        const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
        if (typeof window !== 'undefined') localStorage.setItem('red_pinned_chats', JSON.stringify(next));
        set({ pinnedChatIds: next });
    },

    toggleArchiveChat: (id: string) => {
        const current = Array.isArray(get().archivedChatIds) ? get().archivedChatIds : [];
        const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
        if (typeof window !== 'undefined') localStorage.setItem('red_archived_chats', JSON.stringify(next));
        set({ archivedChatIds: next });
    },
    
    // We start displaying the sidebar (contacts/chats list),

    sendMessage: async (content: string, options?: Record<string, any>) => {
        const { activeConversationId, conversations, contacts, groups } = get();
        if (!activeConversationId) return;

        // Resolve peer hash canonically from meshRouter and conversations
        const canonicalFromMesh = meshRouter.getCanonicalId(activeConversationId);
        const conv = conversations.find(c => c && (
            c.id === activeConversationId || 
            c.peer === activeConversationId || 
            (canonicalFromMesh && (c.peer === canonicalFromMesh || c.id === canonicalFromMesh))
        ));

        let peerHash = conv ? conv.peer : (canonicalFromMesh && canonicalFromMesh.length === 64 ? canonicalFromMesh : '');
        if (!peerHash) {
            if (activeConversationId.includes('-')) {
                const parts = activeConversationId.split('-');
                const secondPart = parts[1] || '';
                const potentialPeer = (contacts as any[]).find((c: any) =>
                    c && c.identity_hash && (c.identity_hash.substring(0, 8) === secondPart || c.identity_hash === secondPart)
                );
                if (potentialPeer) {
                    peerHash = potentialPeer.identity_hash;
                } else if (secondPart.length >= 4) {
                    peerHash = secondPart;
                }
            } else if (activeConversationId.length >= 3) {
                peerHash = activeConversationId;
            }
        }

        if (!peerHash) {
            console.warn('[RED] sendMessage: peerHash not resolved for conv', activeConversationId, '— refreshing contacts');
            get().fetchData().catch(() => {});
            return;
        }

        let cleanPeerHash = normalizeIdentity(peerHash);
        const resolvedCanonical = meshRouter.getCanonicalId(cleanPeerHash);
        if (resolvedCanonical && resolvedCanonical.length === 64) {
            cleanPeerHash = resolvedCanonical;
        }

        // ── GROUP ROUTING FIX ──────────────────────────────────────────────────
        // Check if peerHash matches a known group id (hex-encoded GroupId)
        const rawGroups = groups || [];
        let localWebGroups: any[] = [];
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('red_web_groups');
                if (stored) localWebGroups = JSON.parse(stored);
            } catch {}
        }
        const allKnownGroups = [...rawGroups, ...localWebGroups];
        const matchedGroup = allKnownGroups.find((g: any) => g && (g.id === cleanPeerHash || g.id === peerHash || g.group_id === cleanPeerHash || g.group_id === peerHash));
        const isGroupConv = Boolean(matchedGroup);

        // Control messages (handshake, reactions, typing, signals) are not appended as visible chat bubbles
        const isControlMessage = 
            options?.msg_type === 'reaction' ||
            options?.msg_type === 'typing' ||
            options?.msg_type === 'typing_status' ||
            options?.msg_type === 'read_receipt' ||
            options?.msg_type === 'message_delete' ||
            options?.msg_type === 'message_edit' ||
            options?.msg_type === 'contact_request' ||
            options?.msg_type === 'contact_response' ||
            options?.msg_type === 'webrtc_signal' ||
            options?.msg_type === 'location_ping' ||
            options?.msg_type === 'timer_update' ||
            options?.msg_type === 'group_invite' ||
            options?.msg_type === 'status' ||
            options?.msg_type === 'media_chunk' ||
            (typeof content === 'string' && content.startsWith('{') && (
                content.includes('"sender_hash"') || 
                content.includes('"delete_for_everyone"') || 
                content.includes('"read_up_to"') ||
                content.includes('"status":')
            ));

        // ── RED GUARDIAN IA MODERATION EVALUATION ──────────────────────────────
        if (content && !isControlMessage && (!options?.msg_type || options.msg_type === 'text')) {
            const verdict = GuardianEngine.evaluateText(content);
            if (!verdict.allowed) {
                toast.error(`⛔ RED Guardian: ${verdict.reason}`);
                return;
            }
        }
        if (options?.media_data || options?.msg_type === 'image') {
            const imgData = options.media_data || content;
            if (imgData) {
                const verdict = await GuardianEngine.evaluateImage(imgData);
                if (!verdict.allowed) {
                    toast.error(`⛔ RED Guardian: ${verdict.reason}`);
                    return;
                }
            }
        }

        let tempId: string | null = null;
        const defaultTtlSec = SettingsManager.getAutoDestructSeconds(get().preferences?.autoDestructDefault);
        const effectiveTtl = options?.ttl || (defaultTtlSec > 0 ? defaultTtlSec : undefined);
        const myIdentity = get().identity;
        const myDid = myIdentity?.identity_hash || 'me';
        const msgId = options?.id || generateDeterministicMsgId(myDid, cleanPeerHash, content);
        const detectedMediaData = options?.media_data || (content?.startsWith('data:') ? content : undefined);

        if (!isControlMessage) {
            // Persist heavy media to IndexedDB
            if (detectedMediaData && detectedMediaData.length > 512) {
                indexedMediaVault.saveMedia(msgId, detectedMediaData, options?.mime_type).catch(() => {});
            }

            const optimisticMsg: MessageItem = {
                id: msgId,
                sender: myDid,
                recipient: cleanPeerHash,
                content,
                timestamp: Date.now() / 1000,
                is_mine: true,
                msg_type: options?.msg_type || (content?.startsWith('data:image') ? 'image' : content?.startsWith('data:audio') ? 'voice' : content?.startsWith('data:video') ? 'video' : 'text'),
                media_data: detectedMediaData,
                duration_ms: options?.duration_ms,
                latitude:    options?.latitude,
                longitude:   options?.longitude,
                accuracy:    options?.accuracy,
                file_name:   options?.file_name,
                file_size:   options?.file_size,
                mime_type:   options?.mime_type,
                reply_to:    options?.reply_to,
                ttl:         effectiveTtl,
                expires_at:  effectiveTtl ? (Date.now() / 1000 + effectiveTtl) : options?.expires_at,
                status: 'Pending',
            };
            tempId = msgId;

            // 1. Optimistically update conversations list in store and localStorage
            const currentConvs = get().conversations || [];
            const msgType = optimisticMsg.msg_type;
            const snippet = msgType === 'image' ? '📷 Foto' :
                            msgType === 'voice' ? '🎤 Nota de voz' :
                            msgType === 'video' ? '📹 Video' :
                            msgType === 'location' ? '📍 Ubicación' :
                            (content?.startsWith('data:image') ? '📷 Foto' :
                             content?.startsWith('data:audio') ? '🎤 Nota de voz' :
                             content?.startsWith('data:video') ? '📹 Video' :
                             content || 'Mensaje P2P');

            const canonicalPeer = isGroupConv ? cleanPeerHash : (meshRouter.getCanonicalId(cleanPeerHash) || cleanPeerHash);
            const groupName = matchedGroup?.name || `Escuadrón ${cleanPeerHash.slice(0, 6)}`;
            const existingIdx = currentConvs.findIndex(c => 
                c && (
                    c.peer === cleanPeerHash ||
                    c.id === cleanPeerHash ||
                    c.peer === canonicalPeer ||
                    c.id === canonicalPeer ||
                    (!isGroupConv && canonicalPeer.length >= 8 && c.peer?.startsWith(canonicalPeer.slice(0, 8))) ||
                    (!isGroupConv && !!c.peer && c.peer.length >= 8 && canonicalPeer.startsWith(c.peer.slice(0, 8)))
                )
            );

            let updatedConvs = [...currentConvs];
            const nowSec = Date.now() / 1000;
            if (existingIdx >= 0) {
                const existing = updatedConvs[existingIdx];
                const updatedItem: ConversationItem = {
                    ...existing,
                    id: canonicalPeer,
                    peer: canonicalPeer,
                    peer_name: isGroupConv ? (groupName || existing.peer_name) : existing.peer_name,
                    last_message: snippet,
                    last_timestamp: nowSec,
                    unread_count: 0,
                    is_group: isGroupConv || existing.is_group
                };
                updatedConvs.splice(existingIdx, 1);
                updatedConvs.unshift(updatedItem);
            } else {
                const newConv: ConversationItem = {
                    id: canonicalPeer,
                    peer: canonicalPeer,
                    peer_name: isGroupConv ? groupName : undefined,
                    last_message: snippet,
                    last_timestamp: nowSec,
                    unread_count: 0,
                    is_group: isGroupConv
                };
                updatedConvs.unshift(newConv);
            }

            // Deduplicate conversations list strictly
            const seenPeerSet = new Set<string>();
            updatedConvs = updatedConvs.filter(c => {
                if (!c || !c.peer) return false;
                const p = c.is_group ? c.peer : (meshRouter.getCanonicalId(c.peer) || c.peer);
                if (seenPeerSet.has(p)) return false;
                seenPeerSet.add(p);
                return true;
            });

            set({
                messages: [...get().messages.filter(m => m.id !== msgId), optimisticMsg],
                conversations: updatedConvs
            });
            RedAPI.setWebStore('red_web_conversations', updatedConvs);
            recordProcessedMessageId(msgId);
        }

        try {
            const apiOptions: Record<string, any> = { ...options, id: msgId, media_data: detectedMediaData };
            if (effectiveTtl && !apiOptions.ttl) {
                apiOptions.ttl = effectiveTtl;
            }
            if (options?.reply_to?.id) {
                apiOptions.target_message_id = options.reply_to.id;
            }

            // Compute Proof-of-Work — anti-spam guard for the mesh.
            // Aborted after 2.5s to prevent blocking UI on heavily-loaded devices (Moto G22).
            // On timeout, the message still dispatches (graceful degradation) but logs a warning.
            try {
                const powAbort = new AbortController();
                const powTimeout = setTimeout(() => powAbort.abort(), 2500);
                const powProof = await MeshProofOfWork.mineProof(content, myDid, 3, powAbort.signal);
                clearTimeout(powTimeout);
                if (powProof) apiOptions.pow = powProof;
            } catch (powErr: any) {
                if (powErr?.message?.includes('abortada')) {
                    console.warn('[PoW] Timeout 2.5s — mensaje enviado sin PoW (degradación controlada)');
                } else {
                    console.warn('[PoW] Error en minería:', powErr?.message);
                }
            }


            if (isGroupConv) {
                // Group message → dedicated fan-out endpoint
                await RedAPI.sendGroupMessage(cleanPeerHash, content, apiOptions);
            } else {
                // Direct message → standard DM endpoint (RedAPI handles native & mesh dispatch)
                await RedAPI.sendMessage(cleanPeerHash, content, apiOptions);
            }

            // Upgrade status Pending → Sent after API confirms delivery
            if (tempId) {
                set({ messages: get().messages.map(m =>
                    m.id === tempId ? { ...m, status: 'Sent' as const } : m
                )});
            }

            // Mirror to active Live Companion (Web <-> Mobile Real-Time Sync)
            try {
                const { companionSyncEngine } = await import('../../lib/mesh/companionSyncEngine');
                if (companionSyncEngine.isLiveSessionActive()) {
                    companionSyncEngine.publishLiveEvent('LIVE_MSG_SEND', {
                        recipient: cleanPeerHash,
                        content,
                        options: apiOptions,
                        id: msgId
                    }).catch(() => {});
                }
            } catch {}
        } catch (e) {
            console.error('Message send failed', e);
            if (tempId) {
                set({ messages: get().messages.map(m =>
                    m.id === tempId ? { ...m, status: 'Failed' as const } : m
                )});
            }
        }
    },

    // ── Real typing indicator ─────────────────────────────────────────────────
    // Rate-limited to 1 signal per 3s so it doesn't flood the Rust node.
    // Called by ChatWindow onChange. The other device receives it via SSE and
    // the addIncomingMessage handler sets peerTyping:true for 5 seconds.,

    sendTyping: (() => {
        let lastSent = 0;
        return () => {
            const now = Date.now();
            if (now - lastSent < 3000) return; // ← rate limit
            lastSent = now;
            const { activeConversationId, conversations, contacts } = get();
            if (!activeConversationId) return;
            const canonicalFromMesh = meshRouter.getCanonicalId(activeConversationId);
            const conv = conversations.find(c => c && (
                c.id === activeConversationId || 
                c.peer === activeConversationId || 
                (canonicalFromMesh && (c.peer === canonicalFromMesh || c.id === canonicalFromMesh))
            ));
            let peerHash = conv ? conv.peer : (canonicalFromMesh && canonicalFromMesh.length === 64 ? canonicalFromMesh : '');
            if (!peerHash) {
                if (activeConversationId.includes('-')) {
                    const parts = activeConversationId.split('-');
                    const secondPart = parts[1] || '';
                    const potentialPeer = (contacts as any[]).find((c: any) =>
                        c && c.identity_hash && (c.identity_hash.substring(0, 8) === secondPart || c.identity_hash === secondPart)
                    );
                    if (potentialPeer) {
                        peerHash = potentialPeer.identity_hash;
                    } else if (secondPart.length >= 8) {
                        const matchByPrefix = (contacts as any[]).find((c: any) => c && c.identity_hash && c.identity_hash.startsWith(secondPart));
                        if (matchByPrefix) {
                            peerHash = matchByPrefix.identity_hash;
                        }
                    }
                } else if (activeConversationId.length >= 16) {
                    peerHash = activeConversationId;
                }
            }
            if (!peerHash) return;
            RedAPI.sendMessage(peerHash, 'typing', { msg_type: 'typing' }).catch(() => {});
        };
    })(),

    // ── Stories & Live Streaming actions ─────────────────────────────────────,

    publishStatus: async (content: string, media?: string | null, theme?: number) => {
        const { contacts, identity } = get();
        if (!identity) return;
        const payload: Record<string, any> = { msg_type: 'status_packet' };
        if (media) payload.media_data = media;
        if (theme !== undefined) payload.theme = String(theme);

        // Persist own story locally (24h TTL)
        const entry: StoryEntry = {
            id: `story-${Date.now()}-${identity.identity_hash.slice(0, 8)}`,
            content,
            media_data: media || undefined,
            theme,
            timestamp: Date.now(),
            sender: identity.identity_hash,
            is_mine: true,
        };
        const current = Array.isArray(get().myStories) ? get().myStories : [];
        const updated = [...current, entry].slice(-10); // keep last 10
        set({ myStories: updated });
        if (typeof window !== 'undefined') {
            try { localStorage.setItem('red_my_stories', JSON.stringify(updated)); } catch {}
        }

        // Tactical Privacy: Broadcast exclusively to verified mutual contacts from address book
        const recipients = new Set<string>();
        for (const contact of contacts || []) {
            if (contact?.identity_hash && (contact as any).verified !== false) {
                recipients.add(contact.identity_hash);
            }
        }

        // Broadcast concurrently to all verified contacts without blocking UI or polluting DMs
        const statusContent = content || 'Story';
        await Promise.allSettled(
            Array.from(recipients).map(async (peerHash) => {
                try {
                    await RedAPI.sendMessage(peerHash, statusContent, payload);
                } catch (e) {
                    console.warn(`[RED] Status no enviado a ${peerHash.substring(0, 8)}:`, e);
                }
            })
        );
    },

    openLiveStream: (streamId: string) => {
        set({ activeLiveStreamId: streamId });
    },

    closeLiveStream: () => {
        set({ activeLiveStreamId: null });
    },

    addLiveFrame: (streamId: string, frame: string, seq: number) => {
        const liveStreams = { ...get().liveStreams };
        const existing = liveStreams[streamId];
        // Ring buffer: keep last 5 frames
        const existingFrames = existing?.frames || [];
        const frames = [...existingFrames, frame].slice(-5);
        liveStreams[streamId] = {
            ...(existing || {
                stream_id: streamId,
                broadcaster_hash: streamId,
                broadcaster_name: `Streamer ${streamId.substring(0, 6)}…`,
                started_at: Date.now(),
                is_active: true,
                comments: [],
            }),
            frames,
            frame_seq: seq,
            is_active: true,
        };
        set({ liveStreams });
    },

    removeLiveStream: (streamId: string) => {
        const liveStreams = { ...get().liveStreams };
        if (liveStreams[streamId]) {
            liveStreams[streamId] = { ...liveStreams[streamId], is_active: false };
        }
        const activeLiveStreamId = get().activeLiveStreamId === streamId ? null : get().activeLiveStreamId;
        set({ liveStreams, activeLiveStreamId });
    },

    addLiveComment: (streamId: string, sender: string, text: string) => {
        const liveStreams = { ...get().liveStreams };
        const existing = liveStreams[streamId];
        if (!existing) return;
        const comments = [...(existing.comments || []), { sender, text, ts: Date.now() }].slice(-50);
        liveStreams[streamId] = { ...existing, comments };
        set({ liveStreams });
    },

    deleteMessage: async (messageId: string) => {
        const { activeConversationId, messages } = get();
        if (!activeConversationId) return;
        // Optimistic remove
        set({ messages: messages.filter(m => m.id !== messageId) });
        try {
            await RedAPI.deleteMessage(activeConversationId, messageId);
        } catch (e) {
            // Restore on failure
            const restored = await RedAPI.getMessages(activeConversationId).catch(() => messages);
            set({ messages: restored });
            console.error('Delete failed', e);
        }
    },

    // ── A3: Edit message ──────────────────────────────────────────────────────,

    editMessage: async (messageId: string, newContent: string) => {
        const { activeConversationId, messages } = get();
        if (!activeConversationId) return;
        // Optimistic update
        set({
            messages: messages.map(m =>
                m.id === messageId ? { ...m, content: newContent, edited: true } : m
            ) as MessageItem[],
        });
        try {
            await RedAPI.editMessage(activeConversationId, messageId, newContent);
        } catch (e) {
            const restored = await RedAPI.getMessages(activeConversationId).catch(() => messages);
            set({ messages: restored });
            console.error('Edit failed', e);
        }
    },

    // ── Clear conversation ────────────────────────────────────────────────────,

    clearConversation: async () => {
        const { activeConversationId } = get();
        if (!activeConversationId) return;
        set({ messages: [] });
        await RedAPI.clearConversation(activeConversationId).catch(e => console.error('Clear failed', e));
    },

    // ── A4: Star/unstar a message (persisted in localStorage) ─────────────────,

    starMessage: (messageId: string) => {
        const { activeConversationId, starredMessages } = get();
        const key = `red_starred_${activeConversationId}`;
        let updated: string[];
        if (starredMessages.includes(messageId)) {
            updated = starredMessages.filter(id => id !== messageId);
        } else {
            updated = [...starredMessages, messageId];
        }
        set({ starredMessages: updated });
        try { localStorage.setItem(key, JSON.stringify(updated)); } catch {}
    },

    sendReaction: async (messageId: string, emoji: string) => {
        const { activeConversationId, messages, conversations, identity } = get();
        if (!activeConversationId) return;
        const myHash = identity?.identity_hash || 'me';
        const conv = conversations.find(c => c.id === activeConversationId || c.peer === activeConversationId);
        const peerHash = conv?.peer || activeConversationId;

        // Optimistic update
        const updated = messages.map(m => {
            if (m.id !== messageId) return m;
            const reactions = { ...(m.reactions || {}) };
            if (reactions[emoji]?.includes(myHash)) {
                reactions[emoji] = reactions[emoji].filter((id: string) => id !== myHash);
                if (!reactions[emoji].length) delete reactions[emoji];
            } else {
                reactions[emoji] = [...(reactions[emoji] || []), myHash];
            }
            return { ...m, reactions };
        });
        set({ messages: updated });

        // Broadcast reaction to peer
        if (peerHash) {
            RedAPI.sendMessage(peerHash, JSON.stringify({
                target_id: messageId,
                emoji: emoji,
                sender_hash: myHash
            }), { msg_type: 'reaction' }).catch(() => {});
        }
    },

    deleteMessageForEveryone: async (messageId: string) => {
        const { activeConversationId, messages, conversations } = get();
        if (!activeConversationId) return;
        const conv = conversations.find(c => c.id === activeConversationId || c.peer === activeConversationId);
        const peerHash = conv?.peer || activeConversationId;
        
        // Optimistic update
        set({
            messages: messages.map(m => m.id === messageId ? {
                ...m,
                is_deleted: true,
                content: "Este mensaje fue eliminado",
                media_data: undefined
            } : m)
        });

        // Broadcast delete order across mesh
        if (peerHash) {
            RedAPI.sendMessage(peerHash, JSON.stringify({
                target_id: messageId,
                delete_for_everyone: true
            }), { msg_type: 'message_delete' }).catch(() => {});
        }
    },

    sendTypingStatus: (status: 'typing' | 'recording_voice' | 'idle' = 'typing') => {
        const { activeConversationId, conversations, identity } = get();
        if (!activeConversationId) return;
        const conv = conversations.find(c => c.id === activeConversationId || c.peer === activeConversationId);
        const peerHash = conv?.peer || activeConversationId;
        if (!peerHash) return;
        RedAPI.sendMessage(peerHash, JSON.stringify({
            status,
            sender_hash: identity?.identity_hash || 'me'
        }), { msg_type: 'typing_status' }).catch(() => {});
    },

    // ── Mark conversation as read (clear badge + notify Rust + send ACK) ───────,

    markAsRead: (conversationId: string) => {
        if (!conversationId) return;
        const { conversations, identity } = get();
        const conv = conversations.find(c => c.id === conversationId || c.peer === conversationId);
        const peerHash = conv?.peer || conversationId;
        const hasUnread = conv && (conv.unread_count || 0) > 0;
        if (hasUnread) {
            set({
                conversations: conversations.map(c =>
                    (c.id === conversationId || c.peer === conversationId) ? { ...c, unread_count: 0 } : c
                )
            });
        }
        // Send E2E Read Receipt to peer
        if (peerHash && identity?.identity_hash) {
            RedAPI.sendMessage(peerHash, JSON.stringify({
                conversation_id: conversationId,
                read_up_to: Date.now() / 1000,
                reader_hash: identity.identity_hash
            }), { msg_type: 'read_receipt' }).catch(() => {});
        }
        // Best-effort: tell Rust the conversation is read
        RedAPI.req(`/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => {});
    },

    addIncomingMessage: async (item: any) => {
        return dispatchIncomingMessage(item, set, get);
    },
});
