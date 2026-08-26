import { RedStore, LiveStreamItem, PendingContactRequest, StoryEntry } from '../types';
import { MessageItem, ConversationItem, ContactItem, SosBeacon, WeatherReport, ChannelMessage, VoiceBurst, SocialPost } from '../../api/types';
import { RedAPI } from '../../api/client';
import { meshRouter, normalizeIdentity, generateDeterministicMsgId } from '../../lib/mesh/meshRouter';
import { localTransport } from '../../lib/mesh/localTransport';
import { TacticalAudioEngine } from '../../lib/audio/TacticalAudioEngine';
import { CallRingtoneEngine } from '../../lib/audio/CallRingtoneEngine';
import { GuardianEngine } from '../../lib/ai/guardianEngine';
import { MeshProofOfWork } from '../../lib/crypto/MeshProofOfWork';
import { StateIntegrityEngine } from '../../lib/storage/StateIntegrityEngine';
import { indexedMediaVault } from '../../lib/storage/indexedMediaVault';
import { toast } from '../../components/Toast';
import { MonetizationEngine } from '../../lib/network/MonetizationEngine';
import { companionSyncEngine } from '../../lib/mesh/companionSyncEngine';

// Persistent cross-session message deduplication set
const _processedMessageIds = new Set<string>(typeof window !== 'undefined' ? (() => {
    try {
        const raw = localStorage.getItem('red_processed_msg_ids');
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch { return []; }
})() : []);

export function recordProcessedMessageId(id: string) {
    if (!id) return;
    _processedMessageIds.add(id);
    if (_processedMessageIds.size > 2500) {
        const first = _processedMessageIds.values().next().value;
        if (first) _processedMessageIds.delete(first);
    }
    if (typeof window !== 'undefined') {
        try {
            const arr = Array.from(_processedMessageIds).slice(-1000);
            localStorage.setItem('red_processed_msg_ids', JSON.stringify(arr));
        } catch {}
    }
}

const _processedHandshakes = new Set<string>();

export async function dispatchIncomingMessage(
    item: MessageItem,
    set: any,
    get: () => RedStore
): Promise<void> {
    const handler = (data: any) => {
        if (!data) return;
        const item: MessageItem = data.message_item || data.payload || (data.id && data.sender ? data : null);
        if (!item) return;

        // 0. Global deduplication of incoming messages across transports/SSE
        if (item.id) {
            if (_processedMessageIds.has(item.id)) return;
            recordProcessedMessageId(item.id);
        }
        if (item.sender) {
            const bodyKey = (item.media_data || item.content || '').slice(0, 40);
            if (bodyKey) {
                const semanticKey = `sem_${item.sender}_${bodyKey}_${Math.round((item.timestamp || Date.now()) / 10000)}`;
                if (_processedMessageIds.has(semanticKey)) return;
                recordProcessedMessageId(semanticKey);
            }
        }

        // Anti-spam PoW verification for incoming peer messages
        const rawPacket = data as any;
        if (rawPacket?.pow && item.sender && !item.is_mine) {
            MeshProofOfWork.verifyProof(item.content || '', item.sender, rawPacket.pow).then((res) => {
                if (!res.valid) {
                    console.warn(`[RED-MeshPoW] Dropping invalid spam packet from ${item.sender}: ${res.reason}`);
                }
            }).catch(() => {});
        }

        const { activeConversationId, messages, typingTimeout } = get();

        // ── Incoming status/story entry from peer ─────────────────────────────
        if (item.msg_type === 'status') {
            if (!item.is_mine && item.sender) {
                const currentMap = { ...(get().peerStories || {}) };
                const senderArr = currentMap[item.sender] || [];
                if (!senderArr.some(m => m.id === item.id)) {
                    const updatedArr = [...senderArr, item];
                    currentMap[item.sender] = updatedArr;
                    set({ peerStories: currentMap });
                    if (typeof window !== 'undefined') {
                        try { localStorage.setItem('red_peer_stories', JSON.stringify(currentMap)); } catch {}
                    }
                }
            }
            return;
        }

        const rawItem = item as any;
        if (item.msg_type === 'live_comment' || (typeof rawItem.reaction === 'string' && rawItem.reaction.startsWith('live:'))) {
            const streamId = item.conversation_id || (typeof rawItem.reaction === 'string' ? rawItem.reaction.replace('live:', '') : '') || get().streamId || '';
            if (streamId && item.content) {
                const contacts = get().contacts;
                const contact = contacts.find((c: any) => c.identity_hash === item.sender);
                const senderName = contact?.display_name || `${item.sender.substring(0, 6)}…`;
                get().addLiveComment(streamId, senderName, item.content);
            }
            return;
        }

        // ── Protocol & Handshake Control Packets: never append to user chat bubbles ──
        if (
            typeof item.content === 'string' && item.content.startsWith('{') && (
                item.content.includes('"type":"IDENTITY_ANNOUNCE"') ||
                item.content.includes('"type":"IDENTITY_RESPONSE"') ||
                item.content.includes('"type":"IDENTITY_REQUEST"') ||
                item.content.includes('"type":"SHAKE_PAIR_') ||
                item.content.includes('"type":"DELIVERY_ACK"') ||
                item.content.includes('"type":"PROFILE_UPDATE"') ||
                item.content.includes('"type":"RED_PAIR') ||
                (item.content.includes('"sender_hash"') && item.content.includes('"sender_pk"')) ||
                (item.content.includes('"reason":"user_remote_wipe"'))
            )
        ) {
            try {
                const parsed = JSON.parse(item.content);
                if (parsed.type === 'IDENTITY_ANNOUNCE' || parsed.type === 'IDENTITY_RESPONSE') {
                    const idData = parsed.payload;
                    if (idData?.identity_hash) {
                        const peerHash = meshRouter.getCanonicalId(idData.identity_hash);
                        const peerName = idData.display_name || `Operador ${peerHash.slice(0, 6)}`;
                        const peerPk = idData.public_key;
                        // Only update P2P routing topology — contact isolation: never auto-add to contacts list
                        meshRouter.bindDeviceToCanonical(item.sender, peerHash, peerName, peerPk);
                        meshRouter.updatePeer(peerHash, 'ble', undefined, peerHash, peerName, peerPk);
                        // RedAPI.addContact removed: discovery ≠ consent. Contact list is user-curated only.
                    }
                }
            } catch {}
            return; // strictly do NOT add system protocol JSON to chat message bubbles
        }

        // ── Real-Time Typing & Recording Indicator: never append to message list ──
        if (
            item.msg_type === 'typing' ||
            item.msg_type === 'typing_status' ||
            (typeof item.content === 'string' && item.content.startsWith('{') && item.content.includes('"status":') && item.content.includes('"sender_hash"'))
        ) {
            try {
                let statusVal: 'typing' | 'recording_voice' | 'idle' = 'typing';
                let senderHash = item.sender;
                if (typeof item.content === 'string' && item.content.startsWith('{')) {
                    const parsed = JSON.parse(item.content);
                    statusVal = parsed.status || 'typing';
                    if (parsed.sender_hash) senderHash = parsed.sender_hash;
                }
                if (senderHash && senderHash !== 'me' && senderHash !== 'local') {
                    if (typingTimeout) clearTimeout(typingTimeout);
                    const t = setTimeout(() => {
                        set((s: any) => ({
                            peerTyping: false,
                            typingTimeout: null,
                            peerTypingStatus: { ...s.peerTypingStatus, [senderHash]: 'idle' }
                        }));
                    }, 4000);
                    set((s: any) => ({
                        peerTyping: statusVal !== 'idle',
                        typingTimeout: t,
                        peerTypingStatus: { ...s.peerTypingStatus, [senderHash]: statusVal }
                    }));
                }
            } catch {}
            return; // strictly do NOT add to message list
        }

        // ── LIVE Stream P2P Video Handlers ─────────────────────────────────────
        if (item.msg_type === 'live_announce') {
            const rawItem = item as any;
            const streamId = rawItem.content || rawItem.conversation_id;
            if (streamId) {
                const contactsList = get().contacts || [];
                const matchedContact = contactsList.find((c: any) => c.identity_hash === item.sender);
                const broadcasterName = matchedContact?.display_name || rawItem.sender_name || `Operador ${item.sender.substring(0, 6)}`;
                set((s: any) => ({
                    liveStreams: {
                        ...s.liveStreams,
                        [streamId]: {
                            stream_id: streamId,
                            broadcaster_hash: item.sender,
                            broadcaster_name: broadcasterName,
                            started_at: Date.now(),
                            is_active: true,
                            frames: [],
                            frame_seq: -1,
                            comments: [],
                        }
                    }
                }));
                toast.success(`🔴 ${broadcasterName} inició un LIVE en vivo`);
            }
            return;
        }

        if (item.msg_type === 'live_frame') {
            const rawItem = item as any;
            const streamId = rawItem.conversation_id || rawItem.content;
            const b64 = rawItem.media_data;
            const seq = typeof rawItem.duration_ms === 'number' ? rawItem.duration_ms : (rawItem.seq || 0);
            if (streamId && b64) {
                set((s: any) => {
                    const currentStream = s.liveStreams[streamId];
                    if (!currentStream) {
                        const contactsList = get().contacts || [];
                        const matchedContact = contactsList.find((c: any) => c.identity_hash === item.sender);
                        const broadcasterName = matchedContact?.display_name || rawItem.sender_name || `Operador ${item.sender.substring(0, 6)}`;
                        return {
                            liveStreams: {
                                ...s.liveStreams,
                                [streamId]: {
                                    stream_id: streamId,
                                    broadcaster_hash: item.sender,
                                    broadcaster_name: broadcasterName,
                                    started_at: Date.now(),
                                    is_active: true,
                                    frames: [{ seq, media_data: b64 }],
                                    frame_seq: seq,
                                    comments: [],
                                }
                            }
                        };
                    }
                    const prevFrames = currentStream.frames || [];
                    const newFrames = [...prevFrames, { seq, media_data: b64 }].slice(-10);
                    return {
                        liveStreams: {
                            ...s.liveStreams,
                            [streamId]: {
                                ...currentStream,
                                frames: newFrames,
                                frame_seq: seq,
                                is_active: true
                            }
                        }
                    };
                });
            }
            return;
        }

        if (item.msg_type === 'live_end') {
            const rawItem = item as any;
            const streamId = rawItem.content || rawItem.conversation_id;
            if (streamId) {
                set((s: any) => {
                    const currentStream = s.liveStreams[streamId];
                    if (!currentStream) return s;
                    return {
                        liveStreams: {
                            ...s.liveStreams,
                            [streamId]: { ...currentStream, is_active: false }
                        }
                    };
                });
                toast.info(`🔴 Transmisión en vivo finalizada`);
            }
            return;
        }

        // ── Social Feed Mesh Synchronization ──────────────────────────────────
        if (item.msg_type === 'social_post') {
            try {
                const rawPost = (item as any).post || (typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : null);
                if (rawPost && rawPost.id) {
                    const currentPosts = get().socialPosts || [];
                    if (!currentPosts.some(p => p.id === rawPost.id)) {
                        set((s: any) => ({
                            socialPosts: [rawPost, ...s.socialPosts]
                        }));
                        if (typeof window !== 'undefined') {
                            try {
                                const stored = JSON.parse(localStorage.getItem('red_social_posts') || '[]');
                                if (!stored.some((p: any) => p.id === rawPost.id)) {
                                    stored.unshift(rawPost);
                                    localStorage.setItem('red_social_posts', JSON.stringify(stored.slice(0, 100)));
                                }
                            } catch {}
                        }
                    }
                }
            } catch {}
            return;
        }

        if (item.msg_type === 'social_react') {
            try {
                const rawReact = (item as any) || (typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : null);
                if (rawReact && rawReact.post_id && rawReact.emoji && rawReact.author_hash) {
                    set((s: any) => {
                        const updated = s.socialPosts.map((p: any) => {
                            if (p.id === rawReact.post_id) {
                                const reactions = { ...(p.reactions || {}) };
                                if (!reactions[rawReact.emoji]) reactions[rawReact.emoji] = [];
                                if (!reactions[rawReact.emoji].includes(rawReact.author_hash)) {
                                    reactions[rawReact.emoji].push(rawReact.author_hash);
                                }
                                return { ...p, reactions };
                            }
                            return p;
                        });
                        return { socialPosts: updated };
                    });
                }
            } catch {}
            return;
        }

        // ── Public Channels Mesh Synchronization ──────────────────────────────
        if (item.msg_type === 'channel_post') {
            try {
                const rawChannelMsg = (item as any).message || (typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : null);
                if (rawChannelMsg && rawChannelMsg.id) {
                    if (typeof window !== 'undefined') {
                        try {
                            const stored = JSON.parse(localStorage.getItem('red_channel_messages') || '[]');
                            if (!stored.some((m: any) => m.id === rawChannelMsg.id)) {
                                stored.push(rawChannelMsg);
                                localStorage.setItem('red_channel_messages', JSON.stringify(stored.slice(-200)));
                                window.dispatchEvent(new CustomEvent('red_channel_message_received', { detail: rawChannelMsg }));
                            }
                        } catch {}
                    }
                }
            } catch {}
            return;
        }

        // ── Live Vectorial Canvas Real-Time Streaming ─────────────────────────
        if (item.msg_type === 'canvas_stroke' || item.msg_type === 'canvas_clear') {
            try {
                if (typeof window !== 'undefined') {
                    const detail = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : (item as any).payload || item;
                    window.dispatchEvent(new CustomEvent('red_canvas_remote_event', { detail: { type: item.msg_type, ...detail } }));
                }
            } catch {}
            return;
        }

        // ── Blockchain Mesh Propagation ───────────────────────────────────────
        if (item.msg_type === 'blockchain_block' || item.msg_type === 'blockchain_tx') {
            try {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('red_blockchain_remote_event', { detail: item }));
                }
            } catch {}
            return;
        }

        // ── Delivery Acknowledgment (ACK) Handling ─────────────────────────────
        if (item.msg_type === 'ack' || item.msg_type === 'delivery_ack') {
            const targetId = (item as any).target_id || item.content;
            if (targetId) {
                set((s: any) => ({
                    messages: s.messages.map((m: any) =>
                        (m.id === targetId || m.id === item.id) ? { ...m, status: 'Delivered' as const, delivered: true } : m
                    )
                }));
            }
            return;
        }

        // ── Real-Time Profile Update Mesh Synchronization (v51.1.0) ────────────
        if (item.msg_type === 'profile_update') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item as any;
                const senderHash = meshRouter.getCanonicalId(parsed.sender_hash || item.sender);
                const newName = parsed.nickname || parsed.display_name || parsed.sender_name;
                const newBio = parsed.bio;
                const newPhone = parsed.phone_number;
                const newPk = parsed.public_key;
                const myHash = get().identity?.identity_hash?.toLowerCase();

                if (!senderHash || senderHash === 'me' || senderHash === 'local' || (myHash && senderHash.toLowerCase() === myHash)) {
                    return;
                }

                // 1. Update MeshRouter peer registry with the latest identity data
                meshRouter.bindDeviceToCanonical(item.sender, senderHash, newName, newPk);
                meshRouter.updatePeer(senderHash, 'ble', undefined, senderHash, newName, newPk);

                // 2. Update Contacts list in Store & LocalStorage
                const existingContacts = get().contacts || [];
                const idx = existingContacts.findIndex((c: any) =>
                    c.identity_hash?.toLowerCase() === senderHash.toLowerCase() ||
                    (senderHash.length >= 8 && c.identity_hash?.toLowerCase().startsWith(senderHash.slice(0, 8).toLowerCase())) ||
                    (c.identity_hash?.length >= 8 && senderHash.toLowerCase().startsWith(c.identity_hash.slice(0, 8).toLowerCase()))
                );

                let updatedContacts = [...existingContacts];
                if (idx >= 0) {
                    const isGeneric = (n?: string) => !n || n.startsWith('Operador ') || n.startsWith('Nodo ') || n.startsWith('Par Escaneado') || n.startsWith('Dispositivo RED');
                    const resolvedDisplayName = (newName && !isGeneric(newName)) ? newName : updatedContacts[idx].display_name;

                    // Contact isolation: only update metadata for EXISTING contacts
                    updatedContacts[idx] = {
                        ...updatedContacts[idx],
                        display_name: resolvedDisplayName,
                        bio: newBio !== undefined ? newBio : updatedContacts[idx].bio,
                        phone_number: newPhone !== undefined ? newPhone : updatedContacts[idx].phone_number,
                        public_key: newPk || updatedContacts[idx].public_key,
                    };
                    set({ contacts: updatedContacts });
                    RedAPI.setWebStore('red_web_contacts', updatedContacts);
                    if (resolvedDisplayName) {
                        RedAPI.addContact(senderHash, resolvedDisplayName, newPk).catch(() => {});
                    }
                }
                // idx === -1: unknown peer broadcast their profile — stays in meshRouter.peers only.
                // Mesh presence ≠ user consent. No auto-insertion into contacts.

                // 3. Update Conversation item in Sidebar
                const currentConvs = get().conversations || [];
                const cIdx = currentConvs.findIndex(c =>
                    c && (
                        c.id === senderHash ||
                        c.peer === senderHash ||
                        (senderHash.length >= 8 && c.peer?.startsWith(senderHash.slice(0, 8))) ||
                        (!!c.peer && c.peer.length >= 8 && senderHash.startsWith(c.peer.slice(0, 8)))
                    )
                );
                if (cIdx >= 0) {
                    const updatedConvs = [...currentConvs];
                    updatedConvs[cIdx] = {
                        ...updatedConvs[cIdx],
                        peer_name: newName || updatedConvs[cIdx].peer_name,
                    };
                    set({ conversations: updatedConvs });
                    RedAPI.setWebStore('red_web_conversations', updatedConvs);
                }

                if (newName && !newName.startsWith('Operador ') && !newName.startsWith('Nodo ')) {
                    toast.info(`👤 ${newName} actualizó su perfil`);
                }
            } catch (e) {
                console.warn('[Profile Update Ingest Error]', e);
            }
            return;
        }

        // ── Identity Handshake Protocol (contact_request / contact_response) ─────
        const isHandshakePacket = 
            item.msg_type === 'contact_request' || 
            item.msg_type === 'contact_response' ||
            (typeof item.content === 'string' && item.content.startsWith('{') && (
                (item.content.includes('"sender_hash"') && item.content.includes('"sender_pk"')) ||
                item.content.includes('"type":"contact_request"') ||
                item.content.includes('"type":"contact_response"')
            ));

        if (isHandshakePacket) {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : data;
                const senderHash = meshRouter.getCanonicalId(parsed.sender_hash || item.sender);
                const senderPk = parsed.sender_pk || null;
                const myHash = get().identity?.identity_hash?.toLowerCase();

                if (!senderHash || senderHash === 'me' || senderHash === 'local' || (myHash && senderHash.toLowerCase() === myHash)) {
                    return;
                }

                // ── Anti-Acoso: Silently discard messages from blocked nodes ─────
                const blockedNodes = get().blockedNodes || [];
                if (blockedNodes.includes(senderHash) || blockedNodes.some(b => senderHash.startsWith(b.slice(0, 8)))) {
                    console.log(`[RED] Discarded packet from BLOCKED node: ${senderHash.slice(0, 12)}...`);
                    return;
                }

                const existingContacts = get().contacts || [];
                const existing = existingContacts.find((c: any) => {
                    const cHash = normalizeIdentity(c.identity_hash || '');
                    return cHash === senderHash ||
                        (senderHash.length >= 8 && cHash.startsWith(senderHash.substring(0, 8))) ||
                        (cHash.length >= 8 && senderHash.startsWith(cHash.substring(0, 8)));
                });

                const rawSenderName = parsed.sender_name || (item as any).sender_name || '';
                const isGenericName = !rawSenderName ||
                    rawSenderName.startsWith('Operador ') ||
                    rawSenderName.startsWith('Nodo ') ||
                    rawSenderName.startsWith('Par Escaneado') ||
                    rawSenderName === 'Nuevo Par' ||
                    rawSenderName === 'Par Malla';

                const finalName = !isGenericName 
                    ? rawSenderName 
                    : (existing?.display_name || `Operador ${senderHash.substring(0, 6)}`);

                // Register peer metadata in meshRouter
                meshRouter.updatePeer(
                    senderHash,
                    'ble',
                    undefined,
                    senderHash,
                    finalName,
                    senderPk || undefined
                );

                const msgType = item.msg_type || parsed.type || (parsed.accepted ? 'contact_response' : 'contact_request');

                // ── CASO A: SOLICITUD DE CONTACTO ENTRANTE (Requiere Consentimiento) ──
                if (msgType === 'contact_request') {
                    if (existing) {
                        // El contacto ya fue aceptado previamente: actualizamos metadatos y reconfirmamos
                        const updatedContacts = existingContacts.map(c => {
                            const cHash = normalizeIdentity(c.identity_hash || '');
                            if (cHash === senderHash || (senderHash.length >= 8 && cHash.startsWith(senderHash.slice(0, 8)))) {
                                return {
                                    ...c,
                                    identity_hash: senderHash,
                                    display_name: finalName,
                                    public_key: senderPk || c.public_key,
                                    avatar_url: parsed.avatar_url || c.avatar_url
                                };
                            }
                            return c;
                        });
                        set({ contacts: updatedContacts });
                        RedAPI.setWebStore('red_web_contacts', updatedContacts);

                        // Auto-respondemos con confirmación mutua
                        const myId = get().identity;
                        if (myId?.identity_hash) {
                            const respPayload = JSON.stringify({
                                type: 'contact_response',
                                id: `cres_${Date.now()}_${myId.identity_hash.slice(0, 8)}`,
                                sender_hash: myId.identity_hash,
                                sender_name: myId.nickname || 'Operador RED',
                                sender_pk: myId.public_key || null,
                                avatar_url: myId.avatar_url || null,
                                accepted: true,
                                timestamp: Date.now()
                            });
                            RedAPI.sendMessage(senderHash, respPayload, { msg_type: 'contact_response' }).catch(() => {});
                        }
                    } else {
                        // Nuevo contacto desconocido: Desplegar Flujo de Consentimiento (Modal de Aceptación)
                        const reqId = parsed.id || `creq_${Date.now()}_${senderHash.slice(0, 8)}`;
                        const pendingReq: PendingContactRequest = {
                            id: reqId,
                            senderHash,
                            senderName: finalName,
                            senderPk,
                            channel: parsed.channel || (item.channel ? String(item.channel).toUpperCase() : 'QR'),
                            timestamp: parsed.timestamp ? (parsed.timestamp > 1e11 ? parsed.timestamp : parsed.timestamp * 1000) : Date.now(),
                            avatarUrl: parsed.avatar_url || null,
                            bio: parsed.bio || null,
                        };

                        const currentPending = get().pendingContactRequests || [];
                        const filteredPending = currentPending.filter(r => r.senderHash !== senderHash && r.id !== reqId);
                        const updatedPending = [pendingReq, ...filteredPending];

                        if (typeof window !== 'undefined') {
                            try { localStorage.setItem('red_pending_contact_requests', JSON.stringify(updatedPending)); } catch {}
                        }

                        set({
                            pendingContactRequests: updatedPending,
                            activeContactRequestModal: pendingReq
                        });

                        TacticalAudioEngine.playMessageReceived();
                        toast.info(`🔔 Solicitud de contacto de ${finalName}`);
                    }
                }

                // ── CASO B: RESPUESTA DE CONTACTO ACEPTADA (Handshake Bidireccional) ──
                if (msgType === 'contact_response') {
                    if (parsed.accepted !== false) {
                        const currentContacts = get().contacts || [];
                        const cIdx = currentContacts.findIndex(c => {
                            if (!c) return false;
                            const cHash = normalizeIdentity(c.identity_hash || '');
                            return cHash === senderHash || (senderHash.length >= 8 && cHash.startsWith(senderHash.slice(0, 8)));
                        });

                        let nextContacts = [...currentContacts];
                        if (cIdx >= 0) {
                            nextContacts[cIdx] = {
                                ...nextContacts[cIdx],
                                identity_hash: senderHash,
                                display_name: finalName,
                                public_key: senderPk || nextContacts[cIdx].public_key,
                                avatar_url: parsed.avatar_url || nextContacts[cIdx].avatar_url
                            };
                        } else {
                            nextContacts.push({
                                identity_hash: senderHash,
                                display_name: finalName,
                                public_key: senderPk,
                                avatar_url: parsed.avatar_url || undefined
                            });
                        }

                        // Actualizar conversaciones también
                        const currentConvs = get().conversations || [];
                        let nextConvs = [...currentConvs];
                        const convIdx = nextConvs.findIndex(c => c.id === senderHash || c.peer === senderHash);
                        if (convIdx >= 0) {
                            nextConvs[convIdx] = {
                                ...nextConvs[convIdx],
                                id: senderHash,
                                peer: senderHash
                            };
                        } else {
                            nextConvs.unshift({
                                id: senderHash,
                                peer: senderHash,
                                last_message: 'Contacto mutuo verificado. Chat P2P cifrado listo.',
                                last_timestamp: Date.now() / 1000,
                                unread_count: 0
                            });
                        }

                        set({ contacts: nextContacts, conversations: nextConvs });
                        RedAPI.setWebStore('red_web_contacts', nextContacts);
                        RedAPI.setWebStore('red_web_conversations', nextConvs);
                        RedAPI.addContact(senderHash, finalName, senderPk).catch(() => {});

                        const handshakeKey = `${senderHash.toLowerCase()}_confirmed`;
                        if (!_processedHandshakes.has(handshakeKey)) {
                            _processedHandshakes.add(handshakeKey);
                            toast.success(`🤝 ${finalName} aceptó tu solicitud de contacto`);
                            TacticalAudioEngine.playMessageReceived();
                        }
                    }
                }

                get().fetchData();
            } catch (e) {
                console.warn('[RED] isHandshakePacket parse error:', e);
            }
            return;
        }

        // ── WebRTC Signaling: intercept for calls, never append as chat bubble ──
        const isWebrtcSignal = item.msg_type === 'webrtc_signal' ||
            (typeof item.content === 'string' && item.content.startsWith('{') && (
                item.content.includes('"offer":') ||
                item.content.includes('"answer":') ||
                item.content.includes('"candidate":') ||
                item.content.includes('"hangup":')
            ));

        if (isWebrtcSignal) {
            try {
                const myIdentity = get().identity;
                const myHash = myIdentity?.identity_hash;
                const senderHash = item.sender;

                // 1. Strict self-filtering: Never process signals sent by ourselves (prevents self-ringing)
                if (item.is_mine || (myHash && senderHash === myHash) || (myHash && senderHash && myHash.length >= 8 && senderHash.length >= 8 && (myHash.startsWith(senderHash) || senderHash.startsWith(myHash)))) {
                    return;
                }

                const signal = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;

                // Handle incoming P2P mesh commercial product offers
                if (signal && signal.type === 'tactical_product_offer' && signal.product) {
                    const added = MonetizationEngine.receiveMeshProduct(signal.product);
                    if (added) {
                        toast.info(`🛒 Nueva oferta táctica en la malla: ${signal.product.title}`);
                    }
                    return;
                }

                const contacts = get().contacts || [];
                const contact = contacts.find((c: any) => 
                    c.identity_hash === senderHash ||
                    (senderHash.length >= 8 && c.identity_hash?.startsWith(senderHash.substring(0, 8))) ||
                    (c.identity_hash?.length >= 8 && senderHash.startsWith(c.identity_hash.substring(0, 8)))
                );
                const callerName = contact?.display_name || `Operador ${senderHash.substring(0, 8)}`;

                if (signal.offer) {
                    // Only display incoming call banner if not already inside an active call
                    if (get().currentScreen !== 'call') {
                        const determinedType: 'audio' | 'video' = signal.callType === 'audio' || (signal.offer?.sdp && !signal.offer.sdp.includes('m=video')) ? 'audio' : 'video';
                        const callId = signal.callId || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                        set({
                            incomingCall: {
                                callerHash: senderHash,
                                callerName: callerName,
                                offer: signal.offer,
                                callType: determinedType,
                                callId: callId
                            },
                            activeCallType: determinedType,
                            activeCallId: callId
                        });
                    }
                    get().pushCallSignal({ senderHash, signal });
                } else if (signal.hangup) {
                    const currentCallId = get().activeCallId;
                    if (signal.callId && currentCallId && signal.callId !== currentCallId) {
                        // Discard hangup from different call session
                        return;
                    }
                    CallRingtoneEngine.stop();
                    set({ incomingCall: null, activeCallId: null });
                    const activePeer = get().activeCallPeer;
                    const activeConv = get().activeConversationId;
                    const isFromCurrentCallPeer = !activePeer || activePeer === senderHash || (activePeer.length >= 8 && senderHash.startsWith(activePeer.substring(0, 8))) || (senderHash.length >= 8 && activePeer.startsWith(senderHash.substring(0, 8))) || (activeConv && (activeConv === senderHash || activeConv.includes(senderHash.substring(0, 8))));

                    if (isFromCurrentCallPeer) {
                        get().pushCallSignal({ senderHash, signal });
                        if (get().currentScreen === 'call') {
                            toast.info('Llamada finalizada');
                            get().goBack();
                        }
                    }
                } else {
                    get().pushCallSignal({ senderHash, signal });
                }
            } catch (e) {
                console.warn('[WebRTC Signal Parse Error]', e);
            }
            return;
        }

        // ── Walkie-Talkie Voice Burst: ingest and save to bursts store ──
        if (item.msg_type === 'voice_burst') {
            try {
                const burst = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item;
                const raw = localStorage.getItem('red_voice_bursts');
                const bursts: any[] = raw ? JSON.parse(raw) : [];
                if (!bursts.some((b: any) => b.id === burst.id)) {
                    bursts.unshift(burst);
                    localStorage.setItem('red_voice_bursts', JSON.stringify(bursts.slice(0, 50)));
                    toast.info(`🎙️ Ráfaga PTT de ${burst.sender_name || 'Operador RED'}`);
                }
            } catch (e) {
                console.warn('[Voice Burst Parse Error]', e);
            }
            return;
        }

        // ── Public Channels & Canvas Sync: ingest into channel messages store ──
        if (item.msg_type === 'channel_post' || item.msg_type === 'channel_msg') {
            try {
                const chMsg = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item;
                const raw = localStorage.getItem('red_channel_messages');
                const msgs: any[] = raw ? JSON.parse(raw) : [];
                if (!msgs.some((m: any) => m.id === chMsg.id)) {
                    msgs.push(chMsg);
                    localStorage.setItem('red_channel_messages', JSON.stringify(msgs));
                }
            } catch (e) {
                console.warn('[Channel Post Parse Error]', e);
            }
            return;
        }

        // ── Emergency Distress SOS Beacon: ingest, alert & update activeSosBeacons ──
        if (item.msg_type === 'emergency_beacon') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item;
                const beacon = (parsed as any).beacon || parsed;
                const raw = localStorage.getItem('red_emergency_beacons');
                const list: any[] = raw ? JSON.parse(raw) : [];
                if (!list.some((b: any) => b.beacon_id === beacon.beacon_id)) {
                    list.unshift({ ...beacon, active: true });
                    localStorage.setItem('red_emergency_beacons', JSON.stringify(list));
                    set((s: any) => ({
                        activeSosBeacons: [...s.activeSosBeacons.filter((b: any) => b.beacon_id !== beacon.beacon_id), { ...beacon, active: true }]
                    }));
                    TacticalAudioEngine.playEmergencyAlarm();
                    toast.error(`🚨 SOS: ${beacon.sender_name || 'Alerta de Emergencia'} transmitió auxilio!`);
                }
            } catch (e) {
                console.warn('[Emergency Beacon Parse Error]', e);
            }
            return;
        }

        // ── Cancel SOS Beacon ──
        if (item.msg_type === 'emergency_beacon_cancel') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item;
                const beaconId = (parsed as any).beacon_id || (item as any).beacon_id;
                if (beaconId) {
                    const raw = localStorage.getItem('red_emergency_beacons');
                    const list: any[] = raw ? JSON.parse(raw) : [];
                    const updated = list.map((b: any) => b.beacon_id === beaconId ? { ...b, active: false } : b);
                    localStorage.setItem('red_emergency_beacons', JSON.stringify(updated));
                    set((s: any) => ({
                        activeSosBeacons: s.activeSosBeacons.filter((b: any) => b.beacon_id !== beaconId)
                    }));
                    toast.info(`Baliza SOS cancelada.`);
                }
            } catch (e) {
                console.warn('[Cancel SOS Error]', e);
            }
            return;
        }

        // ── Triage Report: ingest into medical records store ──
        if (item.msg_type === 'triage_report') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item;
                const report = (parsed as any).report || parsed;
                const raw = localStorage.getItem('red_triage_reports');
                const reports: any[] = raw ? JSON.parse(raw) : [];
                const id = report.id || report.report_id;
                if (id && !reports.some((r: any) => r.id === id || r.report_id === id)) {
                    reports.unshift(report);
                    localStorage.setItem('red_triage_reports', JSON.stringify(reports));
                    toast.info(`🏥 Reporte de triaje recibido: ${report.victim_label || 'Víctima'} [${report.category || 'TRIAGE'}]`);
                }
            } catch (e) {
                console.warn('[Triage Report Parse Error]', e);
            }
            return;
        }

        // ── Weather CAP Report: ingest into atmospheric bulletins store ──
        if (item.msg_type === 'weather_report') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item;
                const report = (parsed as any).report || parsed;
                const raw = localStorage.getItem('red_weather_reports');
                const reports: any[] = raw ? JSON.parse(raw) : [];
                if (!reports.some((r: any) => r.id === report.id)) {
                    reports.unshift(report);
                    localStorage.setItem('red_weather_reports', JSON.stringify(reports.slice(0, 30)));
                    set((s: any) => ({
                        activeWeatherReports: [report, ...s.activeWeatherReports.filter((r: any) => r.id !== report.id)].slice(0, 30)
                    }));
                    if (report.is_disaster_alert) {
                        toast.error(`⚠️ Alerta Meteorológica: ${report.condition_summary || 'Condición Severa'}`);
                    } else {
                        toast.info(`🌤️ Boletín Meteorológico de ${report.sender_name || 'Nodo'}`);
                    }
                }
            } catch (e) {
                console.warn('[Weather Report Parse Error]', e);
            }
            return;
        }

        // ── P2P Voucher: ingest into sovereign wallet ──
        if (item.msg_type === 'p2p_voucher') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item;
                const voucher = (parsed as any).voucher || parsed;
                if (voucher && voucher.id) {
                    const raw = localStorage.getItem('red_p2p_vouchers');
                    const vouchers: any[] = raw ? JSON.parse(raw) : [];
                    if (!vouchers.some((v: any) => v.id === voucher.id)) {
                        vouchers.unshift({ ...voucher, is_outgoing: false });
                        localStorage.setItem('red_p2p_vouchers', JSON.stringify(vouchers));
                        toast.success(`💳 ¡Vale P2P recibido de ${voucher.amount} créditos RED!`);
                    }
                }
            } catch (e) {
                console.warn('[P2P Voucher Ingest Error]', e);
            }
            return;
        }

        // ── Decentralized Social Post & Reactions ──
        if (item.msg_type === 'social_post') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item;
                const post = (parsed as any).post || parsed;
                if (post && post.id) {
                    const raw = localStorage.getItem('red_social_posts');
                    const posts: any[] = raw ? JSON.parse(raw) : [];
                    if (!posts.some((p: any) => p.id === post.id)) {
                        posts.unshift(post);
                        localStorage.setItem('red_social_posts', JSON.stringify(posts.slice(0, 100)));
                    }
                }
            } catch (e) {
                console.warn('[Social Post Ingest Error]', e);
            }
            return;
        }

        if (item.msg_type === 'social_react') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item;
                const postId = (parsed as any).post_id;
                const emoji = (parsed as any).emoji;
                const authorHash = (parsed as any).author_hash;
                if (postId && emoji) {
                    const raw = localStorage.getItem('red_social_posts');
                    const posts: any[] = raw ? JSON.parse(raw) : [];
                    const target = posts.find((p: any) => p.id === postId);
                    if (target) {
                        if (!target.reactions) target.reactions = {};
                        if (!target.reactions[emoji]) target.reactions[emoji] = [];
                        if (!target.reactions[emoji].includes(authorHash)) {
                            target.reactions[emoji].push(authorHash);
                        }
                        localStorage.setItem('red_social_posts', JSON.stringify(posts));
                    }
                }
            } catch (e) {}
            return;
        }

        // ── DTN Group History Sync (Sprint 3 v42.0.0) ─────────────────────────────
        // When a peer joins a group or reconnects, they broadcast group_history_request.
        // Any node with stored history responds with a group_history_response bundle.
        if (item.msg_type === 'group_history_request') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item as any;
                const groupId = parsed.group_id || (item as any).group_id;
                const sinceTs = parsed.since_timestamp || (item as any).since_timestamp || 0;
                const limit = Math.min(parsed.limit || 50, 100);
                const requesterHash = parsed.requester_hash || item.sender;

                if (!groupId || !requesterHash) return;

                // Gather local stored messages for this group
                const rawMsgs = localStorage.getItem(`red_web_messages_${groupId}`);
                const allMsgs: any[] = rawMsgs ? JSON.parse(rawMsgs) : [];
                const filtered = allMsgs
                    .filter((m: any) => {
                        const ts = m.timestamp > 1e11 ? m.timestamp / 1000 : m.timestamp;
                        return ts >= sinceTs;
                    })
                    .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0))
                    .slice(-limit);

                if (filtered.length === 0) return;

                const myIdentity = get().identity;
                if (!myIdentity?.identity_hash) return;

                // Send response over mesh
                const responsePayload = {
                    msg_type: 'group_history_response',
                    group_id: groupId,
                    responder_hash: myIdentity.identity_hash,
                    messages: filtered,
                    oldest_ts: filtered[0]?.timestamp || sinceTs,
                    has_more: allMsgs.length > limit,
                };
                RedAPI.sendMessage(requesterHash, JSON.stringify(responsePayload), {
                    msg_type: 'group_history_response',
                    group_id: groupId,
                }).catch(() => {});
            } catch (e) {
                console.warn('[DTN GroupHistoryRequest Error]', e);
            }
            return;
        }

        if (item.msg_type === 'group_history_response') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item as any;
                const groupId = parsed.group_id || (item as any).group_id;
                const incomingMsgs: any[] = parsed.messages || [];

                if (!groupId || incomingMsgs.length === 0) return;

                const storageKey = `red_web_messages_${groupId}`;
                const existing: any[] = (() => {
                    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
                })();

                // Merge: deduplicate by id, sort by timestamp
                const existingIds = new Set(existing.map((m: any) => m.id));
                const newMsgs = incomingMsgs.filter((m: any) => m.id && !existingIds.has(m.id));

                if (newMsgs.length === 0) return;

                const merged = [...existing, ...newMsgs].sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
                localStorage.setItem(storageKey, JSON.stringify(merged));

                // If this group is currently active, update the in-memory messages list
                const { activeConversationId } = get();
                if (activeConversationId === groupId || activeConversationId?.includes(groupId.slice(0, 8))) {
                    set((s: any) => {
                        const existingInMemory = new Set(s.messages.map((m: any) => m.id));
                        const toAdd = newMsgs.filter((m: any) => !existingInMemory.has(m.id));
                        if (toAdd.length === 0) return s;
                        const updated = [...s.messages, ...toAdd].sort((a, b) =>
                            ((a.timestamp || 0) > 1e11 ? (a.timestamp || 0) / 1000 : (a.timestamp || 0)) -
                            ((b.timestamp || 0) > 1e11 ? (b.timestamp || 0) / 1000 : (b.timestamp || 0))
                        );
                        return { messages: updated };
                    });
                }

                toast.success(`📡 ${newMsgs.length} mensajes sincronizados vía DTN`);
            } catch (e) {
                console.warn('[DTN GroupHistoryResponse Error]', e);
            }
            return;
        }

        // ── Real-Time Reactions: apply to target bubble, never append as new message ──
        if (item.msg_type === 'reaction') {
            try {
                let targetId = '';
                let emoji = '';
                let senderId = item.sender;
                if (typeof item.content === 'string' && item.content.startsWith('{')) {
                    const parsed = JSON.parse(item.content);
                    targetId = parsed.target_id || parsed.targetMsgId || '';
                    emoji = parsed.emoji || '';
                    senderId = parsed.sender_hash || item.sender;
                } else if (typeof item.content === 'string') {
                    const parts = item.content.split(':');
                    if (parts.length >= 3) {
                        emoji = parts[1];
                        targetId = parts.slice(2).join(':');
                    }
                }
                if (targetId && emoji) {
                    const updated = messages.map((m: MessageItem) => {
                        if (m.id !== targetId) return m;
                        const reactions = { ...(m.reactions || {}) };
                        if (reactions[emoji]?.includes(senderId)) {
                            reactions[emoji] = reactions[emoji].filter((id: string) => id !== senderId);
                            if (!reactions[emoji].length) delete reactions[emoji];
                        } else {
                            reactions[emoji] = [...(reactions[emoji] || []), senderId];
                        }
                        return { ...m, reactions };
                    });
                    set({ messages: updated });
                }
            } catch (e) {
                console.warn('[Reaction Parse Error]', e);
            }
            return;
        }

        // ── Real-Time Message Edit: update content in-place ──
        if (item.msg_type === 'message_edit') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item;
                const targetId = parsed.target_id || parsed.targetMsgId;
                const newContent = parsed.new_content || parsed.newContent;
                if (targetId && newContent) {
                    const updated = messages.map((m: MessageItem) => {
                        if (m.id !== targetId) return m;
                        return { ...m, content: newContent, is_edited: true, edited: true };
                    });
                    set({ messages: updated });
                }
            } catch (e) {
                console.warn('[Message Edit Parse Error]', e);
            }
            return;
        }

        // ── Real-Time Message Delete ("Delete for Everyone"): redact content ──
        if (item.msg_type === 'message_delete') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item;
                const targetId = parsed.target_id || parsed.targetMsgId;
                if (targetId) {
                    const updated = messages.map((m: MessageItem) => {
                        if (m.id !== targetId) return m;
                        return {
                            ...m,
                            is_deleted: true,
                            content: "Este mensaje fue eliminado",
                            media_data: undefined
                        };
                    });
                    set({ messages: updated });
                }
            } catch (e) {
                console.warn('[Message Delete Parse Error]', e);
            }
            return;
        }

        // ── Remote Conversation Wipe (Sprint 4 v42.1.0) ──
        const isWipePacket = item.msg_type === 'conversation_wipe' || 
                             item.msg_type === 'message_wipe' || 
                             (typeof item.content === 'string' && item.content.includes('"reason":"user_remote_wipe"'));

        if (isWipePacket) {
            try {
                const senderHash = meshRouter.getCanonicalId(item.sender) || item.sender;
                if (senderHash && senderHash !== 'me') {
                    // 1. Purge localStorage
                    localStorage.removeItem(`red_web_messages_${senderHash}`);
                    // 2. Clear from RedAPI backend
                    RedAPI.clearConversation(senderHash).catch(() => {});
                    // 3. Clear active in-memory messages if current chat matches
                    const { activeConversationId } = get();
                    if (activeConversationId === senderHash || (activeConversationId && senderHash.length >= 8 && activeConversationId.includes(senderHash.slice(0, 8)))) {
                        set({ messages: [] });
                    }
                    // 4. Remove any temporary conversation entry with ffffffff
                    const currentConvs = (get().conversations || []).filter(c => 
                        c && !c.id.startsWith('ffffffff') && !c.peer?.startsWith('ffffffff')
                    );
                    set({ conversations: currentConvs });
                    RedAPI.setWebStore('red_web_conversations', currentConvs);

                    toast.error(`⚠️ Orden de borrado remoto ejecutada por ${senderHash.slice(0, 8)}… Historial purgado.`);
                }
            } catch (e) {
                console.warn('[Remote Wipe Ingest Error]', e);
            }
            return;
        }

        // ── Real-Time Read Receipt E2E ACK: update outgoing ticks to Read ──
        if (item.msg_type === 'read_receipt') {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : item;
                const readUpTo = parsed.read_up_to || parsed.readUpToTs || (Date.now() / 1000);
                const updated = messages.map((m: MessageItem) => {
                    const mTs = m.timestamp > 1e11 ? m.timestamp / 1000 : m.timestamp;
                    if (m.is_mine && mTs <= readUpTo) {
                        return { ...m, status: 'Read' as const, read: true, delivered: true };
                    }
                    return m;
                });
                set({ messages: updated });
            } catch (e) {
                console.warn('[Read Receipt Parse Error]', e);
            }
            return;
        }

        // ── Last-Resort JSON Signaling Filter: catches packets that escaped all msg_type handlers ──
        // A message with an unknown or absent msg_type whose content is a JSON object containing
        // known signaling keys is treated as a control packet and discarded silently.
        if (!item.msg_type && typeof item.content === 'string' && item.content.startsWith('{')) {
            try {
                const c = JSON.parse(item.content);
                const SIGNAL_KEYS = ['read_up_to', 'reader_hash', 'delivery_ack', 'offer', 'answer', 'candidate', 'hangup', 'beacon_id', 'group_id'];
                const hitCount = SIGNAL_KEYS.filter(k => k in c).length;
                if (hitCount >= 1) return; // discard silently — signaling packet without proper msg_type
                if (c.type && typeof c.type === 'string' && (
                    c.type.startsWith('IDENTITY_') || c.type.startsWith('SHAKE_') || c.type.startsWith('RED_PAIR')
                )) return;
            } catch {}
        }

        const myHash = get().identity?.identity_hash;
        const resolvedIsMine = Boolean(
            item.is_mine ||
            item.sender === 'me' ||
            (myHash && item.sender &&
                (
                    item.sender.toLowerCase() === myHash.toLowerCase() ||
                    // Only match short_id scenario: full myHash starts with a genuine short sender prefix
                    (myHash.length > 16 && item.sender.length >= 8 && item.sender.length < myHash.length && myHash.toLowerCase().startsWith(item.sender.toLowerCase()))
                )
            )
        );
        const currentConv = get().conversations.find((c: any) => c && (c.id === activeConversationId || c.peer === activeConversationId));
        const itemRecipient = (item as any).recipient as string | undefined;
        const canonicalSender = meshRouter.getCanonicalId(item.sender) || item.sender;
        const canonicalRecipient = itemRecipient ? (meshRouter.getCanonicalId(itemRecipient) || itemRecipient) : undefined;

        const isCurrentChat =
            activeConversationId === item.conversation_id ||
            (currentConv && (
                currentConv.peer === item.sender ||
                currentConv.peer === canonicalSender ||
                (itemRecipient && (currentConv.peer === itemRecipient || currentConv.peer === canonicalRecipient)) ||
                currentConv.id === item.conversation_id
            )) ||
            (canonicalSender.length >= 8 && canonicalSender !== myHash && activeConversationId?.includes(canonicalSender.substring(0, 8))) ||
            (canonicalRecipient && canonicalRecipient.length >= 8 && canonicalRecipient !== myHash && activeConversationId?.includes(canonicalRecipient.substring(0, 8)));

        if (isCurrentChat) {
            const rawTs = (item as any).timestamp;
            const normTimestamp = rawTs ? (rawTs > 1e11 ? rawTs / 1000 : rawTs) : (Date.now() / 1000);

            const resolvedIsMine = Boolean(
                item.is_mine ||
                item.sender === 'me' ||
                (myHash && item.sender &&
                    (
                        item.sender.toLowerCase() === myHash.toLowerCase() ||
                        (myHash.length > 16 && item.sender.length >= 8 && item.sender.length < myHash.length && myHash.toLowerCase().startsWith(item.sender.toLowerCase()))
                    )
                )
            );

            // ── Guardian IA Incoming Protection: Filter incoming threats/CSAM in strict mode ──
            if (!resolvedIsMine && item.content && (!item.msg_type || item.msg_type === 'text')) {
                const incomingVerdict = GuardianEngine.evaluateText(item.content);
                if (!incomingVerdict.allowed && GuardianEngine.getConfig().mode === 'strict') {
                    console.warn('[RED Guardian] Intercepted hostile incoming packet:', incomingVerdict.reason);
                    return;
                }
            }

            const normalizedItem: MessageItem = {
                ...(item as MessageItem),
                timestamp: normTimestamp,
                is_mine: resolvedIsMine,
                status: (item as any).status || (resolvedIsMine ? 'Sent' : 'Delivered'),
            };

            const existingIndex = messages.findIndex((m: MessageItem) => {
                const mTs = m.timestamp ? (m.timestamp > 1e11 ? m.timestamp / 1000 : m.timestamp) : normTimestamp;
                const timeDiff = Math.abs(mTs - normTimestamp);

                // 1. Exact ID match
                if (m.id && item.id && m.id === item.id) return true;

                // 2. Pending optimistic message replacement
                if (m.status === 'Pending' || m.id.startsWith('temp_') || m.id.startsWith('msg_pending_') || m.id.startsWith('msg_')) {
                    if (m.content && item.content && m.content === item.content) return true;
                    if (m.media_data && item.media_data && (m.media_data === item.media_data || m.media_data.length === item.media_data.length)) return true;
                    if (m.msg_type === item.msg_type && timeDiff < 60) {
                        if (m.is_mine && normalizedItem.is_mine) return true;
                    }
                }

                // 3. Sender & Content / Media deduplication within 60-second window (prevents duplicate bubbles from dual SSE + MeshRouter channels)
                const mPayload = m.media_data || m.content;
                const nPayload = normalizedItem.media_data || normalizedItem.content;
                if (mPayload && nPayload && timeDiff < 60) {
                    const isMediaVaultMatch = 
                        (mPayload.startsWith('red_vault://') && nPayload.includes(m.id)) ||
                        (nPayload.startsWith('red_vault://') && mPayload.includes(normalizedItem.id)) ||
                        (mPayload.startsWith('red_vault://') && nPayload.startsWith('red_vault://') && mPayload === nPayload);
                    const isContentMatch = 
                        mPayload === nPayload ||
                        (mPayload.length > 60 && nPayload.length > 60 && mPayload.slice(0, 60) === nPayload.slice(0, 60));

                    if (isMediaVaultMatch || isContentMatch || (m.msg_type === normalizedItem.msg_type && (m.msg_type === 'image' || m.msg_type === 'video' || m.msg_type === 'voice'))) {
                        if (m.is_mine && normalizedItem.is_mine) return true;
                        if (!m.is_mine && !normalizedItem.is_mine) {
                            const mSender = (m.sender || '').toLowerCase();
                            const nSender = (normalizedItem.sender || item.sender || '').toLowerCase();
                            if (mSender === nSender || mSender.startsWith(nSender.slice(0, 8)) || nSender.startsWith(mSender.slice(0, 8))) {
                                return true;
                            }
                        }
                    }
                }

                return false;
            });
            
            if (existingIndex !== -1) {
                const updated = [...messages];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    ...normalizedItem,
                    timestamp: updated[existingIndex].timestamp || normalizedItem.timestamp,
                    media_data: normalizedItem.media_data || updated[existingIndex].media_data
                };
                set({ messages: updated });
            } else {
                set({ messages: [...messages, normalizedItem] });
                if (!normalizedItem.is_mine) {
                    TacticalAudioEngine.playMessageReceived();
                    if (item.sender && item.sender !== myHash && item.msg_type !== 'ack' && item.msg_type !== 'typing') {
                        meshRouter.sendDeliveryAck(item.sender, item.id || 'ack_nonce', item.id).catch(() => {});
                    }
                }
            }

            // Mirror incoming message to active Web Companion Live Bridge
            try {
                if (companionSyncEngine.isLiveSessionActive()) {
                    companionSyncEngine.publishLiveEvent('LIVE_MSG_RECV', normalizedItem).catch(() => {});
                }
            } catch {}

            // ── In-Memory & Storage Conversation List Update for Active Chat ──
            const msgType = normalizedItem.msg_type;
            const snippet = msgType === 'image' ? '📷 Foto' :
                            msgType === 'voice' ? '🎤 Nota de voz' :
                            msgType === 'video' ? '📹 Video' :
                            msgType === 'location' ? '📍 Ubicación' :
                            msgType === 'p2p_payment' ? '🪙 Pago RED P2P' :
                            msgType === 'p2p_voucher' ? '🪙 Vale RED P2P' :
                            (normalizedItem.content?.startsWith('data:image') ? '📷 Foto' :
                             normalizedItem.content?.startsWith('data:audio') ? '🎤 Nota de voz' :
                             normalizedItem.content?.startsWith('data:video') ? '📹 Video' :
                             (normalizedItem.content?.includes('"voucher_id"') ? '🪙 Pago RED P2P' : (normalizedItem.content || 'Mensaje P2P')));

            const canonicalSender = meshRouter.getCanonicalId(item.sender) || normalizeIdentity(item.sender);
            const convId = item.conversation_id ? item.conversation_id : (canonicalSender || item.sender);
            const currentConvs = get().conversations || [];
            const idx = currentConvs.findIndex(c => 
                c && (
                    c.id === convId ||
                    c.peer === item.sender ||
                    c.peer === canonicalSender ||
                    c.id === item.sender ||
                    (canonicalSender.length >= 8 && c.peer?.startsWith(canonicalSender.slice(0, 8))) ||
                    (!!c.peer && c.peer.length >= 8 && canonicalSender.startsWith(c.peer.slice(0, 8)))
                )
            );

            let updatedConvs = [...currentConvs];
            if (idx >= 0) {
                const existing = updatedConvs[idx];
                const updatedObj: ConversationItem = {
                    ...existing,
                    id: convId,
                    peer: canonicalSender || existing.peer,
                    last_message: snippet,
                    last_timestamp: normTimestamp,
                    unread_count: 0
                };
                updatedConvs.splice(idx, 1);
                updatedConvs.unshift(updatedObj);
            } else {
                const newObj: ConversationItem = {
                    id: convId,
                    peer: canonicalSender || item.sender,
                    last_message: snippet,
                    last_timestamp: normTimestamp,
                    unread_count: 0
                };
                updatedConvs.unshift(newObj);
            }
            set({ conversations: updatedConvs });
            RedAPI.setWebStore('red_web_conversations', updatedConvs);

            if (typeof window !== 'undefined' && item.sender) {
                try {
                    const convKey = `red_web_messages_${convId}`;
                    const rawMsgs = localStorage.getItem(convKey);
                    const list: MessageItem[] = rawMsgs ? JSON.parse(rawMsgs) : [];
                    if (!list.some(m => m.id === item.id)) {
                        const rawMedia = normalizedItem.media_data || (normalizedItem.content?.startsWith('data:') ? normalizedItem.content : undefined);
                        if (rawMedia && rawMedia.length > 512) {
                            indexedMediaVault.saveMedia(normalizedItem.id, rawMedia, normalizedItem.mime_type).catch(() => {});
                        }
                        const lightItem: MessageItem = {
                            ...normalizedItem,
                            media_data: rawMedia && rawMedia.length > 512 ? `red_vault://${normalizedItem.id}` : normalizedItem.media_data,
                            content: normalizedItem.content?.startsWith('data:') && normalizedItem.content.length > 512 ? `red_vault://${normalizedItem.id}` : normalizedItem.content
                        };
                        list.push(lightItem);
                        localStorage.setItem(convKey, JSON.stringify(list));
                    }
                } catch {}
            }
            return;
        } else {
            const rawTs = (item as any).timestamp;
            const normTimestamp = rawTs ? (rawTs > 1e11 ? rawTs / 1000 : rawTs) : (Date.now() / 1000);
            const msgType = item.msg_type;
            const snippet = msgType === 'image' ? '📷 Foto' :
                            msgType === 'voice' ? '🎤 Nota de voz' :
                            msgType === 'video' ? '📹 Video' :
                            msgType === 'location' ? '📍 Ubicación' :
                            msgType === 'p2p_payment' ? '🪙 Pago RED P2P' :
                            msgType === 'p2p_voucher' ? '🪙 Vale RED P2P' :
                            (item.content?.startsWith('data:image') ? '📷 Foto' :
                             item.content?.startsWith('data:audio') ? '🎤 Nota de voz' :
                             item.content?.startsWith('data:video') ? '📹 Video' :
                             (item.content?.includes('"voucher_id"') ? '🪙 Pago RED P2P' : (item.content || 'Mensaje P2P')));

            const canonicalSender = meshRouter.getCanonicalId(item.sender) || normalizeIdentity(item.sender);
            const convId = canonicalSender || normalizeIdentity(item.sender);

            // Never create conversations for broadcast addresses or control wipe packets
            const isBroadcastId = !convId || convId === 'me' || convId === 'local' ||
                convId.startsWith('ffffffff') || convId.startsWith('00000000') ||
                item.sender?.startsWith('ffffffff') || item.sender?.startsWith('00000000');
            
            const isControlPayload = (typeof item.content === 'string' && item.content.includes('"reason":"user_remote_wipe"')) ||
                item.msg_type === 'conversation_wipe' || item.msg_type === 'message_wipe' || item.msg_type === 'profile_update';

            if (isBroadcastId || isControlPayload) {
                return;
            }

            const currentConvs = get().conversations || [];
            const idx = currentConvs.findIndex(c => 
                c && (
                    c.id === convId ||
                    c.peer === item.sender ||
                    c.peer === canonicalSender ||
                    c.id === item.sender ||
                    (canonicalSender.length >= 8 && c.peer?.startsWith(canonicalSender.slice(0, 8))) ||
                    (!!c.peer && c.peer.length >= 8 && canonicalSender.startsWith(c.peer.slice(0, 8)))
                )
            );

            let updatedConvs = [...currentConvs];
            if (idx >= 0) {
                const existing = updatedConvs[idx];
                const updatedObj: ConversationItem = {
                    ...existing,
                    id: canonicalSender,
                    peer: canonicalSender,
                    last_message: snippet,
                    last_timestamp: normTimestamp,
                    unread_count: (existing.unread_count || 0) + 1
                };
                updatedConvs.splice(idx, 1);
                updatedConvs.unshift(updatedObj);
            } else {
                const newObj: ConversationItem = {
                    id: canonicalSender,
                    peer: canonicalSender,
                    last_message: snippet,
                    last_timestamp: normTimestamp,
                    unread_count: 1
                };
                updatedConvs.unshift(newObj);

                // Auto-register sender as contact if not present (WhatsApp/Signal/Telegram model)
                const currentContacts = get().contacts || [];
                const hasContact = currentContacts.some((c: any) => {
                    const cHash = normalizeIdentity(c.identity_hash || '');
                    return cHash === canonicalSender || cHash === item.sender || (canonicalSender.length >= 8 && cHash.startsWith(canonicalSender.slice(0, 8)));
                });
                if (!hasContact && canonicalSender && canonicalSender !== 'unknown' && canonicalSender !== 'local') {
                    const peerMeta = meshRouter.getPeerByAnyId(canonicalSender) || meshRouter.getPeerByAnyId(item.sender);
                    const newContactName = peerMeta?.name && !peerMeta.name.startsWith('Operador ') ? peerMeta.name : `Operador ${canonicalSender.slice(0, 6)}`;
                    const newContactPk = peerMeta?.publicKey || (item as any).sender_pk;
                    const newContact = {
                        identity_hash: canonicalSender,
                        display_name: newContactName,
                        public_key: newContactPk
                    };
                    const nextContacts = [...currentContacts, newContact];
                    set({ contacts: nextContacts });
                    RedAPI.setWebStore('red_web_contacts', nextContacts);
                    RedAPI.addContact(canonicalSender, newContactName, newContactPk).catch(() => {});
                }
            }
            set({ conversations: updatedConvs });
            RedAPI.setWebStore('red_web_conversations', updatedConvs);

            if (typeof window !== 'undefined' && canonicalSender) {
                try {
                    const convKey = `red_web_messages_${canonicalSender}`;
                    const rawMsgs = localStorage.getItem(convKey);
                    const list: MessageItem[] = rawMsgs ? JSON.parse(rawMsgs) : [];
                    if (!list.some(m => m.id === item.id)) {
                        const rawMedia = item.media_data || (item.content?.startsWith('data:') ? item.content : undefined);
                        if (rawMedia && rawMedia.length > 512) {
                            indexedMediaVault.saveMedia(item.id, rawMedia, (item as any).mime_type).catch(() => {});
                        }
                        const lightItem: MessageItem = {
                            ...(item as MessageItem),
                            media_data: rawMedia && rawMedia.length > 512 ? `red_vault://${item.id}` : item.media_data,
                            content: item.content?.startsWith('data:') && item.content.length > 512 ? `red_vault://${item.id}` : item.content
                        };
                        list.push(lightItem);
                        localStorage.setItem(convKey, JSON.stringify(list));
                    }
                } catch {}
            }
            if (!item.is_mine) {
                TacticalAudioEngine.playMessageReceived();
            }
            // FIRE LOCAL NOTIFICATION IF CHAT IS NOT FOCUSED OR APP IS BACKGROUNDED
            import('@capacitor/core').then(({ Capacitor }) => {
                if (Capacitor.isNativePlatform()) {
                    const contacts = get().contacts || [];
                    const contact = contacts.find((c: any) => c.identity_hash === item.sender || (item.sender?.length >= 8 && c.identity_hash?.startsWith(item.sender.slice(0, 8))));
                    const senderDisplayName = contact?.display_name || `Operador ${item.sender.substring(0, 8)}…`;

                    import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
                        LocalNotifications.schedule({
                            notifications: [
                                {
                                    title: `💬 ${senderDisplayName}`,
                                    body: snippet,
                                    id: Math.floor(Date.now() % 2147483647),
                                    schedule: { at: new Date(Date.now() + 100) },
                                    sound: undefined,
                                    attachments: undefined,
                                    actionTypeId: "",
                                    extra: {
                                        peer: item.sender,
                                        conversation_id: convId,
                                        sender: item.sender
                                    }
                                }
                            ]
                        }).catch(() => {});
                    });
                }
            });
            get().fetchData().catch(() => {});
        }
        
        // Only refresh sidebar for messages in OTHER conversations (badge count update).
        // The early `return` above handles the active chat case without a round-trip.
    };
    return handler(item);
}
