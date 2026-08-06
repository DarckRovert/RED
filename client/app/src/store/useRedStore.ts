import { create } from 'zustand';
import { RedAPI, IdentityResponse, ConversationItem, MessageItem, StatusResponse } from '../lib/api';
import { localTransport } from '../lib/mesh/localTransport';
import { meshRouter } from '../lib/mesh/meshRouter';
import { toast } from '../components/Toast';

// ── Live Streaming Types ──────────────────────────────────────────────────────
export interface LiveStreamItem {
    stream_id: string;
    broadcaster_hash: string;
    broadcaster_name: string;
    started_at: number;
    is_active: boolean;
    frames: string[];          // last 3 base64 JPEG frames (ring buffer)
    frame_seq: number;         // last received sequence number
    comments: { sender: string; text: string; ts: number }[];
}

export interface StoryEntry {
    id: string;
    content: string;           // text or empty if photo
    media_data?: string;       // base64 JPEG if photo story
    theme?: number;            // 0-7 gradient index for text stories
    timestamp: number;         // ms since epoch
    sender: string;            // own identity_hash
    is_mine: true;
}

// ── Module-level cleanup handles (prevent duplicate connections on hot-reload) ──
let _fetchInterval: ReturnType<typeof setInterval> | null = null;
let _mainSSE: EventSource | null = null;
let _outboundSSE: EventSource | null = null;
let _sseDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * RED 2.0 SPA Store.
 * Central hub for memory and UI View routing (No next/router).
 */

export type ScreenView = 'sidebar' | 'chat' | 'settings' | 'status' | 'crypto' | 'broadcast' | 'radar' | 'contacts' | 'call' | 'nodemap' | 'groupAdmin' | 'explorer' | 'network' | 'dms' | 'amber' | 'guardian' | 'compass' | 'channels' | 'sos' | 'walkie' | 'weather' | 'idVault' | 'proximity' | 'canvas' | 'ecoMesh' | 'proximitySettings' | 'aiCopilot' | 'nearby' | 'liveStream';


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
    initNodeConnection: () => Promise<boolean>;
    fetchData: () => Promise<void>;
    
    // Navigation Action
    navigate: (screen: ScreenView, contextId?: string) => void;
    goBack: () => void;
    
    // Chat Actions
    sendMessage:  (content: string, options?: Record<string, any>) => Promise<void>;
    sendTyping:   () => void;
    addIncomingMessage: (rawEvent: any) => void;
    addContact:   (identity_hash: string, display_name: string, public_key?: string | null) => Promise<boolean>;
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
    setProfile: (nickname: string) => Promise<void>;

    // ── Stories & Live Streaming ───────────────────────────────────────────────
    liveStreams: Record<string, LiveStreamItem>;
    myStories: StoryEntry[];
    peerStories: Record<string, MessageItem[]>;
    activeLiveStreamId: string | null;   // stream being viewed
    isStreaming: boolean;                 // true when broadcasting
    streamId: string | null;             // own active stream id

    publishStatus: (content: string, media?: string | null, theme?: number) => Promise<void>;
    openLiveStream: (streamId: string) => void;
    closeLiveStream: () => void;
    addLiveFrame: (streamId: string, frame: string, seq: number) => void;
    removeLiveStream: (streamId: string) => void;
    addLiveComment: (streamId: string, sender: string, text: string) => void;
}

/** Screens that act as overlays and must NOT clear activeConversationId */
const OVERLAY_SCREENS = new Set<ScreenView>([
    'sos', 'aiCopilot', 'proximity', 'canvas', 'walkie', 'weather',
    'proximitySettings', 'radar', 'contacts', 'settings', 'nodemap',
    'compass', 'idVault', 'amber', 'guardian', 'channels', 'crypto',
    'network', 'explorer', 'nearby', 'liveStream', 'status', 'broadcast'
]);

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

    // Stories & Live Streaming
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

    // Advanced Chat Management (v8.0)
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
    
    // We start displaying the sidebar (contacts/chats list)
    currentScreen: 'sidebar',
    activeConversationId: null,

    // Navigation mechanism for SPA
    navigate: (screen: ScreenView, contextId?: string) => {
        // Overlay screens: navigate without touching activeConversationId
        // so the user returns to the same chat after dismissing the overlay.
        if (OVERLAY_SCREENS.has(screen) && !contextId) {
            set({ currentScreen: screen });
            return;
        }

        if (screen === 'chat' && contextId) {
            const conversations = Array.isArray(get().conversations) ? get().conversations : [];
            const identity = get().identity;
            const existingConv = conversations.find(c => c && (c.id === contextId || c.peer === contextId));
            
            let finalId = contextId;
            if (existingConv) {
                finalId = existingConv.id;
            } else if (contextId.length >= 32 || !contextId.includes('-')) {
                finalId = contextId;
            } else if (identity) {
                finalId = `${identity.short_id}-${contextId.substring(0, 8)}`;
            }

            set({ currentScreen: screen, activeConversationId: finalId, messages: [] });

            const fetchMessages = async () => {
                try {
                    let msgs = await RedAPI.getMessages(finalId);
                    const altPeer = existingConv?.peer || (contextId !== finalId ? contextId : null);
                    if ((!msgs || !msgs.length) && altPeer && altPeer !== finalId) {
                        const fallbackMsgs = await RedAPI.getMessages(altPeer).catch(() => []);
                        if (fallbackMsgs && fallbackMsgs.length > 0) msgs = fallbackMsgs;
                    }
                    set({ messages: Array.isArray(msgs) ? msgs : [] });
                } catch {
                    const altPeer = existingConv?.peer || (contextId !== finalId ? contextId : null);
                    if (altPeer && altPeer !== finalId) {
                        RedAPI.getMessages(altPeer)
                            .then(msgs => set({ messages: Array.isArray(msgs) ? msgs : [] }))
                            .catch(() => set({ messages: [] }));
                    } else {
                        set({ messages: [] });
                    }
                }
            };
            fetchMessages();

            // Load starred messages for this conversation from localStorage
            try {
                const raw = localStorage.getItem(`red_starred_${finalId}`);
                const parsed = raw ? JSON.parse(raw) : [];
                set({ starredMessages: Array.isArray(parsed) ? parsed : [] });
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
            const isDecoy = password === '9999';
            set({ isDecoyMode: isDecoy });

            const { Capacitor, registerPlugin } = await import('@capacitor/core');
            const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

            if (isNative) {
                const RedNode = registerPlugin<any>('RedNode');
                await RedNode.start({ password, decoyMode: isDecoy });
                console.log("[RED] Requested Rust Node boot via JNI (Decoy:", isDecoy, ")");
                await new Promise(r => setTimeout(r, 1000));
                const connected = await get().initNodeConnection();
                if (connected) {
                    set({ isAuthenticated: true });
                    return true;
                }
                return false;
            } else {
                // Web Browser Platform (GitHub Pages SPA)
                let localHash = typeof window !== 'undefined' ? localStorage.getItem("red_identity_hash") : null;
                let shortId = typeof window !== 'undefined' ? localStorage.getItem("red_short_id") : null;
                const savedNick = typeof window !== 'undefined' ? (localStorage.getItem("red_displayName") || localStorage.getItem("user_nickname")) : null;
                if (!localHash || !shortId) {
                    const randomBytes = new Uint8Array(32);
                    if (typeof window !== 'undefined' && window.crypto) {
                        window.crypto.getRandomValues(randomBytes);
                    }
                    localHash = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('') || "af10d57e5a4179e83b24f1c900e5";
                    shortId = "red_" + localHash.substring(0, 10);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem("red_identity_hash", localHash);
                        localStorage.setItem("red_short_id", shortId);
                    }
                }
                set({
                    identity: { identity_hash: localHash, short_id: shortId, public_key: localHash, nickname: savedNick || 'Operador RED' },
                    status: { is_running: true, peer_count: 0, identity_hash: localHash, version: "24.1.0-web", chain_height: 1 },
                    nodeOnline: true,
                    isAuthenticated: true
                });
                return true;
            }
        } catch (e) {
            console.error("[RED] Login Error:", e);
            // Do NOT authenticate on error — fail clearly so the user can retry.
            set({ isAuthenticated: false, nodeOnline: false });
            return false;
        }
    },

    setProfile: async (nickname: string) => {
        const cleanName = nickname.trim();
        if (!cleanName) return;
        if (typeof window !== 'undefined') {
            localStorage.setItem('red_displayName', cleanName);
            localStorage.setItem('user_nickname', cleanName);
            try {
                import('@capacitor/core').then(({ Capacitor }) => {
                    if (Capacitor.isNativePlatform()) {
                        import('capacitor-secure-storage-plugin').then(({ SecureStoragePlugin }) => {
                            SecureStoragePlugin.set({ key: "red_displayName", value: cleanName }).catch(() => null);
                            SecureStoragePlugin.set({ key: "user_nickname", value: cleanName }).catch(() => null);
                        });
                    }
                });
            } catch {}
        }
        const currentIdentity = get().identity;
        if (currentIdentity) {
            set({ identity: { ...currentIdentity, nickname: cleanName } });
        } else {
            set({
                identity: {
                    identity_hash: 'local_' + Math.random().toString(36).substring(2, 10),
                    short_id: cleanName.substring(0, 8).toLowerCase(),
                    nickname: cleanName
                }
            });
        }
        RedAPI.setProfile(cleanName).catch(() => {});
    },

    initNodeConnection: async (): Promise<boolean> => {
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

                let savedNick = typeof window !== 'undefined' ? localStorage.getItem("red_displayName") : null;
                if (!savedNick) {
                    try {
                        const { Capacitor } = await import('@capacitor/core');
                        if (Capacitor.isNativePlatform()) {
                            const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
                            const res = await SecureStoragePlugin.get({ key: "red_displayName" }).catch(() => null);
                            if (res?.value) {
                                savedNick = res.value;
                                if (typeof window !== 'undefined') localStorage.setItem("red_displayName", savedNick);
                            }
                        }
                    } catch {}
                }

                const finalIdentity = {
                    ...identity,
                    nickname: savedNick || identity.nickname || 'Operador RED'
                };
                
                if (!status.is_running || status.identity_hash === 'INITIALIZING') {
                    if (process.env.NODE_ENV === 'development') {
                        console.log("[RED] Node online but still in PoW — retrying...");
                    }
                    retries--;
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                set({ identity: finalIdentity, status, nodeOnline: true });
                if (process.env.NODE_ENV === 'development') {
                    console.log("[RED] Attached to Rust Node Natively (PoW complete):", identity.short_id);
                }
                
                await get().fetchData();
                
                const connectSSE = () => {
                    if (_mainSSE) { _mainSSE.close(); _mainSSE = null; }
                    const es = RedAPI.subscribeToEvents((data) => {
                        if (data.message_item || data.payload || (data.id && data.sender) || data.msg_type || data.content) {
                            get().addIncomingMessage(data);
                        }
                        if (data.event_type === 'conv_update' || data.event_type === 'contact_update') {
                            if (process.env.NODE_ENV === 'development') {
                                console.log('[RED] SSE conv_update — refreshing sidebar (debounced)');
                            }
                            if (_sseDebounceTimer) clearTimeout(_sseDebounceTimer);
                            _sseDebounceTimer = setTimeout(() => get().fetchData(), 500);
                        }
                    });
                    _mainSSE = es;
                    if (es) {
                        es.onerror = () => {
                            if (process.env.NODE_ENV === 'development') {
                                console.warn('[RED] SSE connection lost — reconnecting in 3s...');
                            }
                            es.close();
                            _mainSSE = null;
                            setTimeout(connectSSE, 3000);
                        };
                    }
                };
                connectSSE();

                if (_fetchInterval) clearInterval(_fetchInterval);
                _fetchInterval = setInterval(() => {
                    if (get().nodeOnline) get().fetchData();
                    else { if (_fetchInterval) { clearInterval(_fetchInterval); _fetchInterval = null; } }
                }, 30000);

                const connectOutboundSSE = () => {
                    if (_outboundSSE) { _outboundSSE.close(); _outboundSSE = null; }
                    const es = new EventSource(`${RedAPI.getBaseURL()}/network/outbound`);
                    _outboundSSE = es;
                    es.addEventListener('mesh_payload', (e: any) => {
                        try {
                            const data = JSON.parse(e.data);
                            if (data && data.payload_hex) {
                                const hex = data.payload_hex;
                                const buf = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
                                meshRouter.broadcast(buf).catch(() => {});
                            }
                        } catch (err) {
                            console.error('[MeshRouter] Failed to parse outbound SSE payload', err);
                        }
                    });
                    es.onerror = () => {
                        console.warn('[RED] Outbound Radio SSE lost — reconnecting in 3s...');
                        es.close();
                        _outboundSSE = null;
                        setTimeout(connectOutboundSSE, 3000);
                    };
                };
                connectOutboundSSE();

                localTransport.init(identity.identity_hash).catch(e =>
                    console.warn('[RED] Mesh init failed (non-critical):', e)
                );

                return true;
            } catch (err) {
                retries--;
                if (retries > 0) {
                    await new Promise(r => setTimeout(r, 1000));
                } else {
                    console.warn("[RED] Rust Node unreachable after retries.");
                    set({ nodeOnline: false });
                    return false;
                }
            }
        }
        return false;
    },

    fetchData: async () => {
        try {
            const [convs, conts, grps] = await Promise.all([
                RedAPI.getConversations(),
                RedAPI.getContacts(),
                RedAPI.getGroups()
            ]);
            const safeConvs = Array.isArray(convs) ? convs : [];
            const safeConts = Array.isArray(conts) ? conts : [];
            const safeGrps  = Array.isArray(grps)  ? grps  : [];

            const { currentScreen, activeConversationId } = get();
            let newActiveId = activeConversationId;
            if (currentScreen === 'chat' && activeConversationId) {
                const matched = safeConvs.find((c: any) =>
                    c && (
                        c.id === activeConversationId ||
                        c.peer === activeConversationId ||
                        (c.peer && activeConversationId.includes(c.peer.substring(0, 8))) ||
                        (c.id && activeConversationId.includes(c.id.split('-')[1] || '____'))
                    )
                );
                if (matched && matched.id && matched.id !== activeConversationId) {
                    newActiveId = matched.id;
                }
            }

            set({
                conversations: safeConvs,
                contacts: safeConts,
                groups: safeGrps,
                activeConversationId: newActiveId
            });
        } catch {
            set({ conversations: [], contacts: [], groups: [] });
        }
    },

    sendMessage: async (content: string, options?: Record<string, any>) => {
        const { activeConversationId, conversations, contacts, groups } = get();
        if (!activeConversationId) return;

        // BUG-3 FIX: resolve peer hash from conversation or synthesised ID
        const conv = conversations.find(c => c.id === activeConversationId);

        let peerHash = conv ? conv.peer : '';
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

        if (!peerHash) {
            console.warn('[RED] sendMessage: peerHash not resolved for conv', activeConversationId, '— refreshing contacts');
            get().fetchData().catch(() => {});
            return;
        }

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
    // the addIncomingMessage handler sets peerTyping:true for 5 seconds.
    sendTyping: (() => {
        let lastSent = 0;
        return () => {
            const now = Date.now();
            if (now - lastSent < 3000) return; // ← rate limit
            lastSent = now;
            const { activeConversationId, conversations, contacts } = get();
            if (!activeConversationId) return;
            const conv = conversations.find(c => c.id === activeConversationId);
            let peerHash = conv ? conv.peer : '';
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

    // ── Stories & Live Streaming actions ─────────────────────────────────────
    publishStatus: async (content: string, media?: string | null, theme?: number) => {
        const { contacts, conversations, identity } = get();
        if (!identity) return;
        const payload: Record<string, any> = { msg_type: 'status' };
        if (media) payload.media_data = media;
        if (theme !== undefined) payload.theme = String(theme);

        // Persist own story locally (24h TTL)
        const entry: StoryEntry = {
            id: `story-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

        // Aggregate unique peer hashes from both contacts and active conversations
        const recipients = new Set<string>();
        for (const contact of contacts || []) {
            if (contact?.identity_hash) recipients.add(contact.identity_hash);
        }
        for (const conv of conversations || []) {
            if (conv?.peer) recipients.add(conv.peer);
        }

        // Broadcast to all unique peers
        for (const peerHash of recipients) {
            try {
                await RedAPI.sendMessage(peerHash, content, payload);
            } catch (e) {
                console.warn(`[RED] Status no enviado a ${peerHash.substring(0, 8)}:`, e);
            }
        }
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

    addIncomingMessage: (data: any) => {
        if (!data) return;
        const item: MessageItem = data.message_item || data.payload || (data.id && data.sender ? data : null);
        if (!item) return;

        const { activeConversationId, messages, typingTimeout } = get();

        // ── Live stream events ────────────────────────────────────────────────
        if (item.msg_type === 'live_announce') {
            const streamId = item.content || '';
            if (!streamId) return;
            const contacts = get().contacts;
            const contact = contacts.find((c: any) => c.identity_hash === item.sender);
            const broadcasterName = contact?.display_name || `${item.sender.substring(0, 8)}…`;
            const liveStreams = { ...get().liveStreams };
            liveStreams[streamId] = {
                stream_id: streamId,
                broadcaster_hash: item.sender,
                broadcaster_name: broadcasterName,
                started_at: Date.now(),
                is_active: true,
                frames: [],
                frame_seq: -1,
                comments: [],
            };
            set({ liveStreams });
            return;
        }

        if (item.msg_type === 'live_frame') {
            const streamId = item.conversation_id || '';
            const frame = item.media_data || '';
            const seq = typeof item.duration_ms === 'number' ? item.duration_ms : 0; // reuse field for seq
            if (streamId && frame) {
                get().addLiveFrame(streamId, frame, seq);
            }
            return;
        }

        if (item.msg_type === 'live_end') {
            const streamId = item.content || '';
            if (streamId) get().removeLiveStream(streamId);
            return;
        }

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

        // ── Typing pulse: show indicator for 5s, then auto-clear ──────────────
        if (item.msg_type === 'typing') {
            if (typingTimeout) clearTimeout(typingTimeout);
            const t = setTimeout(() => set({ peerTyping: false, typingTimeout: null }), 5000);
            set({ peerTyping: true, typingTimeout: t });
            return; // do NOT add to message list
        }

        // ── Contact Request & Response: Reciprocal P2P auto-add & nickname exchange ──
        if (item.msg_type === 'contact_request' || item.msg_type === 'contact_response') {
            try {
                const data = JSON.parse(item.content);
                const senderHash = data.sender_hash || item.sender;
                const senderName = data.sender_name || `Operador ${senderHash.substring(0, 6)}`;
                const senderPk   = data.sender_pk || null;

                RedAPI.addContact(senderHash, senderName, senderPk).then(() => {
                    if (item.msg_type === 'contact_request') {
                        toast.success(`🤝 ${senderName} te ha agregado como contacto.`);
                        const myIdentity = get().identity;
                        const myName = myIdentity?.nickname || 'Operador RED';
                        if (myIdentity?.identity_hash) {
                            RedAPI.sendMessage(senderHash, JSON.stringify({
                                sender_hash: myIdentity.identity_hash,
                                sender_name: myName,
                                sender_pk: myIdentity.public_key || null
                            }), { msg_type: 'contact_response' }).catch(() => {});
                        }
                    }
                    get().fetchData();
                }).catch(() => {});
            } catch {
                RedAPI.addContact(item.sender, `Operador ${item.sender.substring(0, 6)}`, null).then(() => {
                    get().fetchData();
                }).catch(() => {});
            }
            return;
        }

        // ── Auto-register un-added sender as contact on incoming message ─────────
        if (!item.is_mine && item.sender && !item.sender.startsWith('local_')) {
            const contactsList = get().contacts;
            const exists = Array.isArray(contactsList) && contactsList.some((c: any) => c.identity_hash === item.sender);
            if (!exists) {
                const autoName = `Operador ${item.sender.substring(0, 6)}`;
                RedAPI.addContact(item.sender, autoName, null).then(() => {
                    const myIdentity = get().identity;
                    const myName = myIdentity?.nickname || 'Operador RED';
                    if (myIdentity?.identity_hash) {
                        RedAPI.sendMessage(item.sender, JSON.stringify({
                            sender_hash: myIdentity.identity_hash,
                            sender_name: myName,
                            sender_pk: myIdentity.public_key || null
                        }), { msg_type: 'contact_request' }).catch(() => {});
                    }
                    get().fetchData();
                }).catch(() => {});
            }
        }

        // If we are looking at this exact chat right now — add if not already present
        const currentConv = get().conversations.find((c: any) => c && (c.id === activeConversationId || c.peer === activeConversationId));
        const myHash = get().identity?.identity_hash;
        const itemRecipient = (item as any).recipient as string | undefined;
        const itemSender = item.sender || '';

        const isCurrentChat =
            activeConversationId === item.conversation_id ||
            (currentConv && (
                currentConv.peer === itemSender ||
                (itemRecipient && currentConv.peer === itemRecipient) ||
                currentConv.id === item.conversation_id
            )) ||
            (itemSender.length >= 8 && itemSender !== myHash && activeConversationId?.includes(itemSender.substring(0, 8))) ||
            (itemRecipient && itemRecipient.length >= 8 && itemRecipient !== myHash && activeConversationId?.includes(itemRecipient.substring(0, 8)));

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
                if (isCurrentChat) set({ messages: updated });
            }
            get().fetchData();
            return;
        }

        if (isCurrentChat) {
            // DEDUP / IN-PLACE REPLACE: replace optimistic temp_ message or update existing
            const existingIndex = messages.findIndex((m: MessageItem) =>
                m.id === item.id ||
                (m.id.startsWith('temp_') && m.content === item.content)
            );
            if (existingIndex !== -1) {
                const updated = [...messages];
                updated[existingIndex] = item as MessageItem;
                set({ messages: updated });
            } else {
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
            // ALWAYS REFRESH CONVERSATIONS & UNREAD BADGES IN SIDEBAR
            get().fetchData();
        }
        
        // FIX 2.3: Only refresh sidebar when the message belongs to a DIFFERENT conversation.
        // If it's the active chat, the bubble was already appended locally — no HTTP round-trip needed.
        if (activeConversationId !== item.conversation_id) {
            get().fetchData();
        }
    },

    addContact: async (identity_hash: string, display_name: string, public_key?: string | null) => {
        const inputStr = identity_hash.trim();
        const cleanName = display_name.trim();

        let cleanHash = inputStr;
        let pubKey: string | null = public_key ?? null;

        // If no explicit pk was provided, try to parse did:red:<hash>:<pk> or <hash>:<pk> format
        if (!pubKey) {
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
        }

        const MAX_RETRIES = 10;
        const RETRY_DELAY_MS = 2000;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                await RedAPI.addContact(cleanHash, cleanName, pubKey);
                // Send background contact request to peer so they automatically add us back!
                const myIdentity = get().identity;
                const myName = myIdentity?.nickname || 'Operador RED';
                if (myIdentity?.identity_hash) {
                    RedAPI.sendMessage(cleanHash, JSON.stringify({
                        sender_hash: myIdentity.identity_hash,
                        sender_name: myName
                    }), { msg_type: 'contact_request' }).catch(() => {});
                }
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
                // Handle 404/Short ID gracefully: Add to local contacts store so user can communicate over mesh!
                const is404 = msg.includes('404') || msg.toLowerCase().includes('short id') || msg.toLowerCase().includes('not found');
                if (is404) {
                    console.log(`[addContact] Peer ${cleanHash} not resolved via REST API, registering in local store`);
                    const existingContacts = get().contacts || [];
                    if (!existingContacts.some(c => c.identity_hash === cleanHash || c.display_name === cleanName)) {
                        const localContact = {
                            identity_hash: cleanHash,
                            display_name: cleanName,
                            public_key: pubKey
                        };
                        set({ contacts: [...existingContacts, localContact] });
                    }
                    const myIdentity = get().identity;
                    const myName = myIdentity?.nickname || 'Operador RED';
                    if (myIdentity?.identity_hash) {
                        RedAPI.sendMessage(cleanHash, JSON.stringify({
                            sender_hash: myIdentity.identity_hash,
                            sender_name: myName
                        }), { msg_type: 'contact_request' }).catch(() => {});
                    }
                    return true;
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
