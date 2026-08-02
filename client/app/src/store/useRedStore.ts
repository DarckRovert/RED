import { create } from 'zustand';
import { RedAPI, IdentityResponse, ConversationItem, MessageItem, StatusResponse } from '../lib/api';
import { localTransport } from '../lib/mesh/localTransport';
import { meshRouter } from '../lib/mesh/meshRouter';

/**
 * RED 2.0 SPA Store.
 * Central hub for memory and UI View routing (No next/router).
 */

export type ScreenView = 'sidebar' | 'chat' | 'settings' | 'status' | 'crypto' | 'broadcast' | 'radar' | 'contacts' | 'call' | 'nodemap' | 'groupAdmin' | 'explorer' | 'network' | 'dms' | 'amber' | 'guardian' | 'compass' | 'channels' | 'sos' | 'walkie' | 'weather' | 'idVault' | 'proximity' | 'canvas' | 'ecoMesh' | 'proximitySettings';

interface RedStore {
    // 1. Data Mode
    isAuthenticated: boolean;
    isDecoyMode: boolean;
    identity: IdentityResponse | null;
    status: StatusResponse | null;
    nodeOnline: boolean;
    conversations: ConversationItem[];
    contacts: any[];
    groups: any[];
    
    // 2. Chat Data
    messages: MessageItem[];
    
    // 3. SPA UI State (The core of Mobile-First architecture)
    currentScreen: ScreenView;
    activeConversationId: string | null;
    
    // 4. Actions
    login: (password: string) => Promise<boolean>;
    initNodeConnection: () => Promise<void>;
    fetchData: () => Promise<void>;
    
    // Navigation Action
    navigate: (screen: ScreenView, contextId?: string) => void;
    goBack: () => void;
    
    // Chat Actions
    sendMessage:  (content: string, options?: Record<string, any>) => Promise<void>;
    sendTyping:   () => void;
    addIncomingMessage: (rawEvent: any) => void;
    addContact:   (identity_hash: string, display_name: string) => Promise<boolean>;
    deleteMessage: (messageId: string) => Promise<void>;
    editMessage: (messageId: string, newContent: string) => Promise<void>;
    clearConversation: () => Promise<void>;
    starMessage: (messageId: string) => void;
    starredMessages: string[]; // stored in localStorage by conv
    connectPeer: (multiaddr: string) => Promise<boolean>;
    // Real-time typing state (set by incoming SSE typing messages)
    peerTyping: boolean;
    typingTimeout: ReturnType<typeof setTimeout> | null;

    // Advanced Chat Management (v8.0)
    pinnedChatIds: string[];
    archivedChatIds: string[];
    togglePinChat: (id: string) => void;
    toggleArchiveChat: (id: string) => void;
}

export const useRedStore = create<RedStore>((set, get) => ({
    isAuthenticated: false,
    isDecoyMode: false,
    identity: null,
    status: null,
    nodeOnline: false,
    conversations: [],
    contacts: [],
    groups: [],
    messages: [],
    starredMessages: [],
    peerTyping: false,
    typingTimeout: null,

    // Advanced Chat Management (v8.0)
    pinnedChatIds: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('red_pinned_chats') || '[]') : [],
    archivedChatIds: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('red_archived_chats') || '[]') : [],

    togglePinChat: (id: string) => {
        const { pinnedChatIds } = get();
        const next = pinnedChatIds.includes(id) ? pinnedChatIds.filter(x => x !== id) : [...pinnedChatIds, id];
        if (typeof window !== 'undefined') localStorage.setItem('red_pinned_chats', JSON.stringify(next));
        set({ pinnedChatIds: next });
    },

    toggleArchiveChat: (id: string) => {
        const { archivedChatIds } = get();
        const next = archivedChatIds.includes(id) ? archivedChatIds.filter(x => x !== id) : [...archivedChatIds, id];
        if (typeof window !== 'undefined') localStorage.setItem('red_archived_chats', JSON.stringify(next));
        set({ archivedChatIds: next });
    },
    
    // We start displaying the sidebar (contacts/chats list)
    currentScreen: 'sidebar',
    activeConversationId: null,

    // Navigation mechanism for SPA
    navigate: (screen: ScreenView, contextId?: string) => {
        if (screen === 'chat' && contextId) {
            // FIX A2: Convert full 64-char peer hash to short-short conversation ID
            const { conversations, identity } = get();
            const existingConv = conversations.find(c => c.peer === contextId);
            
            let finalId = contextId;
            if (existingConv) {
                finalId = existingConv.id;
            } else if (identity) {
                finalId = `${identity.short_id}-${contextId.substring(0, 8)}`;
            }

            set({ currentScreen: screen, activeConversationId: finalId, messages: [] });
            RedAPI.getMessages(finalId).then(msgs => set({ messages: msgs })).catch(() => {});

            // Load starred messages for this conversation from localStorage
            try {
                const raw = localStorage.getItem(`red_starred_${finalId}`);
                if (raw) set({ starredMessages: JSON.parse(raw) });
                else set({ starredMessages: [] });
            } catch { set({ starredMessages: [] }); }

            // FASE 1.4: Clear unread badge locally AND notify Rust so the
            // badge doesn't reappear on next fetchData.
            const convForReceipt = existingConv || conversations.find(c => c.id === finalId);
            if (convForReceipt && (convForReceipt.unread_count || 0) > 0) {
                set({
                    conversations: get().conversations.map(c =>
                        c.id === finalId ? { ...c, unread_count: 0 } : c
                    )
                });
                // Tell Rust the conversation was read (best-effort, non-blocking)
                RedAPI.req(`/conversations/${finalId}/read`, { method: 'POST' }).catch(() => {});
            }
        } else {
            set({ currentScreen: screen, activeConversationId: null });
        }
    },
    
    goBack: () => {
        set({ currentScreen: 'sidebar', activeConversationId: null });
    },
    login: async (password: string) => {
        try {
            // Anti-Torture (Phase 17): If PIN is 9999, boot the fake SQLite vault
            const isDecoy = password === '9999';
            set({ isDecoyMode: isDecoy });

            const { Capacitor, registerPlugin } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const RedNode = registerPlugin<any>('RedNode');
                await RedNode.start({ password, decoyMode: isDecoy });
                console.log("[RED] Requested Rust Node boot via JNI (Decoy:", isDecoy, ")");
            }
            // Give the node time to boot the Axum server.
            // First boot: PoW identity generation on mobile ARM takes 5-15s.
            // Subsequent boots: storage open + key derivation takes ~1-2s.
            // initNodeConnection() has a 60-retry loop that handles the rest.
            await new Promise(r => setTimeout(r, 8000));
            await get().initNodeConnection();
            
            if (get().nodeOnline) {
                set({ isAuthenticated: true });
                return true;
            }
            return false;
        } catch (e) {
            console.error("Login Error:", e);
            return false;
        }
    },

    initNodeConnection: async () => {
        let retries = 60; // 60 retries × 1s = up to 1 minute for mobile PoW / slow boots
        if (process.env.NODE_ENV === 'development') console.log("[RED] Initializing Node Connection...");
        while (retries > 0) {
            try {
                if (process.env.NODE_ENV === 'development' && retries % 5 === 0) {
                    console.log(`[RED] Polling Rust API... (${60 - retries}s elapsed)`);
                }
                const [identity, status] = await Promise.all([
                    RedAPI.getIdentity(),
                    RedAPI.getStatus(),
                ]);

                // ROOT-CAUSE FIX: The Axum server responds to /identity and /status
                // BEFORE the node finishes PoW. The /status endpoint returns
                // is_running: false (and identity_hash: "INITIALIZING") during PoW.
                // We must wait until is_running is true before declaring nodeOnline.
                if (!status.is_running || status.identity_hash === 'INITIALIZING') {
                    if (process.env.NODE_ENV === 'development') {
                        console.log("[RED] Node online but still in PoW — retrying...");
                    }
                    retries--;
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                set({ identity, status, nodeOnline: true });
                if (process.env.NODE_ENV === 'development') {
                    console.log("[RED] Attached to Rust Node Natively (PoW complete):", identity.short_id);
                }
                
                await get().fetchData();
                              // FASE 1.1: SSE con reconexión automática.
                // Escucha eventos tipo 'conv_update' para actualizar sidebar SOLO cuando
                // hay cambios reales — elimina el polling agresivo de batería.
                const connectSSE = () => {
                    const es = RedAPI.subscribeToEvents((data) => {
                        // Nuevo mensaje → agregar al chat activo
                        if (data.message_item) {
                            get().addIncomingMessage(data);
                        }
                        // Actualización de conversaciones (badges, nuevos chats, confirmaciones)
                        if (data.event_type === 'conv_update' || data.event_type === 'contact_update') {
                            if (process.env.NODE_ENV === 'development') {
                                console.log('[RED] SSE conv_update — refreshing sidebar');
                            }
                            get().fetchData();
                        }
                    });
                    if (es) {
                        es.onerror = () => {
                            if (process.env.NODE_ENV === 'development') {
                                console.warn('[RED] SSE connection lost — reconnecting in 3s...');
                            }
                            es.close();
                            setTimeout(connectSSE, 3000);
                        };
                    }
                };
                connectSSE();

                // Heartbeat de seguridad: refresco cada 30s como red de seguridad
                // en caso de que algún evento SSE se pierda. Mucho menos agresivo que 8s.
                const fetchInterval = setInterval(() => {
                    if (get().nodeOnline) get().fetchData();
                    else clearInterval(fetchInterval);
                }, 30000);

    // ── MESH BRIDGING: Pipe Rust outbound payloads to the radio ──
                // Whenever the Rust Node generates an encrypted OnionPacket (e.g. after resolving
                // a POST /api/messages/send), it streams the bytes back to us natively. We then
                // hand those bytes to the MeshRouter so they can actually leave the phone's antenna (BLE/WiFi).
                const connectOutboundSSE = () => {
                    const es = new EventSource(`${RedAPI.getBaseURL()}/network/outbound`);
                    es.addEventListener('mesh_payload', (e: any) => {
                        try {
                            const data = JSON.parse(e.data);
                            if (data && data.payload_hex) {
                                const hex = data.payload_hex;
                                const buf = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
                                // Broadcast physical bytes over BLE/WiFi
                                meshRouter.broadcast(buf).catch(() => {});
                            }
                        } catch (err) {
                            console.error('[MeshRouter] Failed to parse outbound SSE payload', err);
                        }
                    });
                    es.onerror = () => {
                        console.warn('[RED] Outbound Radio SSE lost — reconnecting in 3s...');
                        es.close();
                        setTimeout(connectOutboundSSE, 3000);
                    };
                };
                connectOutboundSSE();


                // Initialize the multi-transport mesh layer with our FULL identity hash.
                // Uses mDNS (same WiFi), WiFi Direct (WebRTC), and BLE to create
                // a self-healing hop-by-hop network that works without internet.
                localTransport.init(identity.identity_hash).catch(e =>
                    console.warn('[RED] Mesh init failed (non-critical):', e)
                );

                return; // Connected successfully
            } catch (err) {
                retries--;
                if (retries > 0) {
                    await new Promise(r => setTimeout(r, 1000));
                } else {
                    console.warn("[RED] Rust Node unreachable after retries.");
                    set({ nodeOnline: false });
                }
            }
        }
    },

    fetchData: async () => {
        const [convs, conts, grps] = await Promise.all([
            RedAPI.getConversations(),
            RedAPI.getContacts(),
            RedAPI.getGroups()
        ]);
        set({ conversations: convs, contacts: conts, groups: grps });
    },

    sendMessage: async (content: string, options?: Record<string, any>) => {
        const { activeConversationId, conversations, contacts, groups } = get();
        if (!activeConversationId) return;

        // BUG-3 FIX: resolve peer hash from conversation or synthesised ID
        const conv = conversations.find(c => c.id === activeConversationId);

        let peerHash = conv ? conv.peer : '';
        if (!conv && activeConversationId.includes('-')) {
            const extractedShort = activeConversationId.split('-')[1];
            const potentialPeer = contacts.find((c: any) => c.identity_hash.substring(0, 8) === extractedShort);
            if (potentialPeer) peerHash = potentialPeer.identity_hash;
        }

        if (!peerHash) return;

        // ── GROUP ROUTING FIX ──────────────────────────────────────────────────
        // Check if peerHash matches a known group id (hex-encoded GroupId)
        const matchedGroup = (groups as any[]).find((g: any) => g.id === peerHash);
        const isGroupConv = !!matchedGroup;

        // Reactions and typing pulses are not appended as new bubbles
        const isReaction = options?.msg_type === 'reaction';
        const isTyping   = options?.msg_type === 'typing';

        let tempId: string | null = null;
        if (!isReaction && !isTyping) {
            const tempMsg: MessageItem = {
                id: 'temp_' + Date.now(),
                sender: 'me',
                content,
                timestamp: Date.now() / 1000,
                is_mine: true,
                msg_type: options?.msg_type || 'text',
                media_data: options?.media_data,
                duration_ms: options?.duration_ms,
                latitude:    options?.latitude,
                longitude:   options?.longitude,
                accuracy:    options?.accuracy,
                reply_to:    options?.reply_to,
                status: 'Pending',
            };
            tempId = tempMsg.id;
            set({ messages: [...get().messages, tempMsg] });
        }

        try {
            const apiOptions: Record<string, any> = { ...options };
            if (options?.reply_to?.id) {
                apiOptions.target_message_id = options.reply_to.id;
            }

            if (isGroupConv) {
                // Group message → dedicated fan-out endpoint
                await RedAPI.sendGroupMessage(peerHash, content, apiOptions);
            } else {
                // Direct message → standard DM endpoint
                await RedAPI.sendMessage(peerHash, content, apiOptions);
            }

            // Upgrade status Pending → Sent after Rust API confirms delivery to node
            if (tempId) {
                set({ messages: get().messages.map(m =>
                    m.id === tempId ? { ...m, status: 'Sent' as const } : m
                )});
            }
        } catch (e) {
            console.error('Message send failed', e);
        }
    },

    // ── Real typing indicator ─────────────────────────────────────────────────
    // Rate-limited to 1 signal per 3s so it doesn't flood the Rust node.
    // Called by ChatWindow onChange. The other device receives it via SSE and
    // the addIncomingMessage handler sets peerTyping:true for 5 seconds.
    sendTyping: (() => {
        let lastSent = 0;
        return () => {
            const now = Date.now();
            if (now - lastSent < 3000) return; // ← rate limit
            lastSent = now;
            const { activeConversationId, conversations, identity } = get();
            if (!activeConversationId) return;
            const conv    = conversations.find(c => c.id === activeConversationId);
            const peerHash = conv?.peer || '';
            if (!peerHash) return;
            RedAPI.sendMessage(peerHash, 'typing', { msg_type: 'typing' }).catch(() => {});
        };
    })(),

    addIncomingMessage: (data: any) => {
        const item = data.message_item;
        if (!item) return;

        const { activeConversationId, messages, typingTimeout } = get();

        // ── Typing pulse: show indicator for 5s, then auto-clear ──────────────
        if (item.msg_type === 'typing') {
            if (typingTimeout) clearTimeout(typingTimeout);
            const t = setTimeout(() => set({ peerTyping: false, typingTimeout: null }), 5000);
            set({ peerTyping: true, typingTimeout: t });
            return; // do NOT add to message list
        }

        // ── Reactions: apply to target bubble, never append as new message ──
        if (item.msg_type === 'reaction' && typeof item.content === 'string') {
            // Format: "reaction:❤️:target_msg_id"
            const parts = item.content.split(':');
            if (parts.length >= 3) {
                const emoji    = parts[1];
                const targetId = parts.slice(2).join(':');
                const senderId = item.sender;
                const updated  = messages.map((m: MessageItem) => {
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
                if (activeConversationId === item.conversation_id) set({ messages: updated });
            }
            get().fetchData();
            return;
        }

        // If we are looking at this exact chat right now — add if not already present
        if (activeConversationId === item.conversation_id) {
            // DEDUP: skip if a message with this ID is already in the list
            // (can happen if SSE reconnects and replays the last event)
            const alreadyExists = messages.some((m: MessageItem) => m.id === item.id);
            if (!alreadyExists) {
                set({ messages: [...messages, item as MessageItem] });
            }
        } else {
            // FIRE LOCAL NOTIFICATION IF CHAT IS NOT FOCUSED OR APP IS BACKGROUNDED
            import('@capacitor/core').then(({ Capacitor }) => {
                if (Capacitor.isNativePlatform()) {
                    const contacts = get().contacts;
                    const contact = contacts.find((c: any) => c.identity_hash === item.sender);
                    const senderDisplayName = contact?.display_name || `${item.sender.substring(0, 8)}…`;

                    import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
                        LocalNotifications.schedule({
                            notifications: [
                                {
                                    title: `💬 ${senderDisplayName}`,
                                    body: item.msg_type === 'image' ? '📷 Foto cifrada' :
                                          item.msg_type === 'voice' ? '🎤 Nota de voz' :
                                          item.content || 'Nuevo mensaje P2P',
                                    id: Math.floor(Math.random() * 100000),
                                    schedule: { at: new Date(Date.now() + 100) },
                                    sound: undefined,
                                    attachments: undefined,
                                    actionTypeId: "",
                                    extra: null
                                }
                            ]
                        }).catch(() => {});
                    });
                }
            });
        }
        
        // And regardless, refresh conversations list to bump it to top
        get().fetchData();
    },

    addContact: async (identity_hash: string, display_name: string) => {
        const inputStr = identity_hash.trim();
        const cleanName = display_name.trim();

        let cleanHash = inputStr;
        let pubKey: string | null = null;

        // Parsear did:red:<hash>:<pk> o <hash>:<pk>
        if (inputStr.startsWith("did:red:")) {
            const parts = inputStr.split(":");
            if (parts.length >= 4) {
                cleanHash = parts[2];
                pubKey = parts[3];
            }
        } else if (inputStr.includes(":")) {
            const parts = inputStr.split(":");
            if (parts.length >= 2) {
                cleanHash = parts[0];
                pubKey = parts[1];
            }
        }

        const MAX_RETRIES = 10;
        const RETRY_DELAY_MS = 2000;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                await RedAPI.addContact(cleanHash, cleanName, pubKey);
                await get().fetchData();
                return true;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                const isInitializing =
                    msg.includes('503') ||
                    msg.toLowerCase().includes('initializing') ||
                    msg.toLowerCase().includes('pow');
                if (isInitializing && attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                    continue;
                }
                throw new Error(
                    isInitializing
                        ? `El nodo aún está iniciando. Espera unos segundos y vuelve a intentarlo.`
                        : msg
                );
            }
        }
        return false;
    },

    // ── A2: Delete message ────────────────────────────────────────────────────
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

    // ── A3: Edit message ──────────────────────────────────────────────────────
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

    // ── Clear conversation ────────────────────────────────────────────────────
    clearConversation: async () => {
        const { activeConversationId } = get();
        if (!activeConversationId) return;
        set({ messages: [] });
        await RedAPI.clearConversation(activeConversationId).catch(e => console.error('Clear failed', e));
    },

    // ── A4: Star/unstar a message (persisted in localStorage) ─────────────────
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
    
    connectPeer: async (multiaddr: string) => {
        const ok = await RedAPI.connectPeer(multiaddr);
        if (ok) {
            get().fetchData().catch(() => {});
        }
        return ok;
    },
}));
