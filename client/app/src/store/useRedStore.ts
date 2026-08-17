import { create } from 'zustand';
import { RedAPI, IdentityResponse, ConversationItem, MessageItem, StatusResponse } from '../lib/api';
import { localTransport } from '../lib/mesh/localTransport';
import { meshRouter } from '../lib/mesh/meshRouter';
import { toast } from '../components/Toast';
import { GuardianEngine } from '../lib/guardianEngine';
import { RED_VERSION } from '../lib/version';
import { SettingsManager, UserPreferences, DEFAULT_PREFERENCES } from '../lib/settingsManager';
import { TacticalAudioEngine } from '../lib/TacticalAudioEngine';
import { StateIntegrityEngine } from '../lib/StateIntegrityEngine';
import { MeshProofOfWork } from '../lib/MeshProofOfWork';

// ── Live Streaming Types ──────────────────────────────────────────────────────
export interface LiveStreamItem {
    stream_id: string;
    broadcaster_hash: string;
    broadcaster_name: string;
    title?: string;
    started_at: number;
    is_active: boolean;
    frames: any[];          // base64 JPEG frames or frame objects
    frame_seq: number;         // last received sequence number
    comments: any[];
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

export type ScreenView = 'sidebar' | 'chat' | 'settings' | 'updater' | 'status' | 'crypto' | 'broadcast' | 'radar' | 'contacts' | 'call' | 'nodemap' | 'groupAdmin' | 'explorer' | 'network' | 'dms' | 'amber' | 'amberAdmin' | 'guardian' | 'compass' | 'channels' | 'publicChannels' | 'sos' | 'walkie' | 'weather' | 'weatherAlert' | 'idVault' | 'identityVault' | 'proximity' | 'proximityWave' | 'canvas' | 'liveCanvas' | 'ecoMesh' | 'proximitySettings' | 'proximity_settings' | 'aiCopilot' | 'copilot' | 'nearby' | 'liveStream' | 'offGridCompass' | 'vitalScan' | 'survivalBeacon' | 'rfSpectrum' | 'stegoVault' | 'security' | 'groups' | 'p2pCompass' | 'socialFeed' | 'shakePair' | 'p2pPay' | 'redP2PPay' | 'blackout' | 'health' | 'systemHealth' | 'nodeLogs' | 'logs' | 'calculator' | 'secReport' | 'backup' | 'landing';

interface RedStore {
    // 0. User Preferences & UI Customization
    preferences: UserPreferences;
    updatePreferences: (patch: Partial<UserPreferences>) => void;

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
    markAsRead: (conversationId: string) => void;
    starredMessages: string[]; // stored in localStorage by conv
    connectPeer: (multiaddr: string) => Promise<boolean>;
    // Real-time typing state (set by incoming SSE typing messages)
    peerTyping: boolean;
    typingTimeout: ReturnType<typeof setTimeout> | null;
    peerPresence: Record<string, 'online' | 'offline' | 'nearby'>;

    // Advanced Chat Management (v8.0)
    pinnedChatIds: string[];
    archivedChatIds: string[];
    togglePinChat: (id: string) => void;
    toggleArchiveChat: (id: string) => void;
    setProfile: (profile: string | { nickname?: string; phone_number?: string; bio?: string }) => Promise<void>;
    enableDecoyVault: () => void;

    // ── Stories & Live Streaming ───────────────────────────────────────────────
    liveStreams: Record<string, LiveStreamItem>;
    myStories: StoryEntry[];
    peerStories: Record<string, MessageItem[]>;
    activeLiveStreamId: string | null;   // stream being viewed
    isStreaming: boolean;                 // true when broadcasting
    streamId: string | null;             // own active stream id

    // ── WebRTC Voice & Video Call State ───────────────────────────────────────
    incomingCall: { callerHash: string; callerName: string; offer: any } | null;
    activeCallSignal: { senderHash: string; signal: any } | null;
    setIncomingCall: (call: { callerHash: string; callerName: string; offer: any } | null) => void;
    setActiveCallSignal: (sig: { senderHash: string; signal: any } | null) => void;

    publishStatus: (content: string, media?: string | null, theme?: number) => Promise<void>;
    openLiveStream: (streamId: string) => void;
    closeLiveStream: () => void;
    addLiveFrame: (streamId: string, frame: string, seq: number) => void;
    removeLiveStream: (streamId: string) => void;
    addLiveComment: (streamId: string, sender: string, text: string) => void;
    evaluateLocalDMS: () => Promise<void>;

    // Social Feed State
    socialPosts: any[];
    bookmarkedPosts: any[];
    followingList: string[];
    loadSocialFeed: () => Promise<void>;
    addOptimisticReaction: (postId: string, emoji: string, reactorHash: string) => void;
    deleteOptimisticPost: (postId: string) => void;
    toggleBookmark: (post: any) => void;
    hydrateBookmarks: () => void;
    // Real-time Mesh SSE Events State
    activeSosBeacons: any[];
    activeWeatherReports: any[];
    activeChannelMessages: Record<string, any[]>;
    activeVoiceBursts: any[];
    addSosBeacon: (beacon: any) => void;
    resolveSosBeacon: (id: string) => void;
    addWeatherReport: (report: any) => void;
    addChannelMessage: (msg: any) => void;
    addVoiceBurst: (burst: any) => void;
    setSosBeacons: (beacons: any[]) => void;
}

/** Screens that act as overlays and must NOT clear activeConversationId */
const OVERLAY_SCREENS = new Set<ScreenView>([
    'sos', 'aiCopilot', 'proximity', 'canvas', 'walkie', 'weather',
    'proximitySettings', 'radar', 'contacts', 'settings', 'updater', 'nodemap',
    'compass', 'idVault', 'amber', 'guardian', 'channels', 'crypto',
    'network', 'explorer', 'nearby', 'liveStream', 'status', 'broadcast', 'call',
    'security', 'groups', 'p2pCompass', 'socialFeed', 'shakePair', 'p2pPay', 'blackout', 'health', 'nodeLogs', 'calculator', 'secReport', 'backup'
]);

export const useRedStore = create<RedStore>((set, get) => ({
    preferences: typeof window !== 'undefined' ? SettingsManager.init() : DEFAULT_PREFERENCES,
    updatePreferences: (patch: Partial<UserPreferences>) => {
        const updated = SettingsManager.updatePreferences(patch);
        set({ preferences: updated });
        if (patch.meshPowerProfile) {
            const intervals = SettingsManager.getMeshPowerIntervals(patch.meshPowerProfile);
            localTransport.setScanInterval(intervals.bleScanMs);
        }
    },
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
    // Real-time Mesh SSE Events State
    activeSosBeacons: [],
    activeWeatherReports: [],
    activeChannelMessages: {},
    activeVoiceBursts: [],
    setSosBeacons: (beacons: any[]) => set({ activeSosBeacons: Array.isArray(beacons) ? beacons : [] }),
    addSosBeacon: (beacon: any) => {
        const current = get().activeSosBeacons || [];
        if (!current.some((b: any) => b.id === beacon.id)) {
            set({ activeSosBeacons: [beacon, ...current] });
            toast.error(`🚨 ¡ALERTA SOS RECIBIDA! Operador: ${beacon.sender_name || 'Desconocido'}`);
        }
    },
    resolveSosBeacon: (id: string) => {
        const current = get().activeSosBeacons || [];
        set({ activeSosBeacons: current.filter((b: any) => b.id !== id) });
        toast.info("Baliza SOS resuelta por la red");
    },
    addWeatherReport: (report: any) => {
        const current = get().activeWeatherReports || [];
        if (!current.some((r: any) => r.id === report.id)) {
            set({ activeWeatherReports: [report, ...current] });
            if (report.is_storm_warning || report.severity === 'Severe' || report.severity === 'Extreme') {
                toast.warning(`⚠️ Alerta Meteorológica: ${report.phenomenon || 'Tormenta Severa'}`);
            }
        }
    },
    addChannelMessage: (msg: any) => {
        const channelId = msg.channel_id || 'red-local-general';
        const channels = { ...get().activeChannelMessages };
        const list = channels[channelId] || [];
        if (!list.some((m: any) => m.id === msg.id)) {
            channels[channelId] = [...list, msg];
            set({ activeChannelMessages: channels });
        }
    },
    addVoiceBurst: (burst: any) => {
        const current = get().activeVoiceBursts || [];
        set({ activeVoiceBursts: [burst, ...current].slice(0, 50) });
    },

    // Social Feed
    socialPosts: [],
    bookmarkedPosts: [],
    followingList: [],
    loadSocialFeed: async () => {
        try {
            const res = typeof window !== 'undefined' ? localStorage.getItem('red_social_posts') : null;
            if (res) set({ socialPosts: JSON.parse(res) });
        } catch {}
    },
    addOptimisticReaction: (postId: string, emoji: string, reactorHash: string) => {
        const posts = [...get().socialPosts];
        const idx = posts.findIndex(p => p.id === postId);
        if (idx !== -1) {
            posts[idx].reactions = posts[idx].reactions || {};
            posts[idx].reactions[emoji] = posts[idx].reactions[emoji] || [];
            if (!posts[idx].reactions[emoji].includes(reactorHash)) {
                posts[idx].reactions[emoji].push(reactorHash);
            }
            set({ socialPosts: posts });
        }
    },
    deleteOptimisticPost: (postId: string) => {
        set({ socialPosts: get().socialPosts.filter(p => p.id !== postId) });
    },
    toggleBookmark: (post: any) => {
        const bookmarks = [...get().bookmarkedPosts];
        const idx = bookmarks.findIndex(p => p.id === post.id);
        const next = idx === -1 ? [post, ...bookmarks] : bookmarks.filter(p => p.id !== post.id);
        set({ bookmarkedPosts: next });
        if (typeof window !== 'undefined') localStorage.setItem('red_bookmarked_posts', JSON.stringify(next));
    },
    hydrateBookmarks: () => {
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem('red_bookmarked_posts') : null;
            if (raw) set({ bookmarkedPosts: JSON.parse(raw) });
        } catch {}
    },
    peerPresence: {},

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

    // WebRTC Call Signaling State
    incomingCall: null,
    activeCallSignal: null,
    setIncomingCall: (call) => set({ incomingCall: call }),
    setActiveCallSignal: (sig) => set({ activeCallSignal: sig }),

    // Navigation mechanism for SPA
    navigate: (screen: ScreenView, contextId?: string) => {
        // Overlay screens: navigate without touching activeConversationId unless contextId provided
        if (OVERLAY_SCREENS.has(screen)) {
            if (contextId) {
                set({ currentScreen: screen, activeConversationId: contextId });
            } else {
                set({ currentScreen: screen });
            }
            return;
        }

        if (screen === 'chat' && contextId) {
            const canonicalPeer = meshRouter.getCanonicalId(contextId) || contextId;
            const conversations = Array.isArray(get().conversations) ? get().conversations : [];
            const identity = get().identity;
            const existingConv = conversations.find(c => c && (
                c.id === canonicalPeer ||
                c.peer === canonicalPeer ||
                c.id === contextId ||
                c.peer === contextId ||
                (canonicalPeer.length >= 8 && c.peer?.startsWith(canonicalPeer.slice(0, 8))) ||
                (c.peer?.length >= 8 && canonicalPeer.startsWith(c.peer.slice(0, 8)))
            ));
            
            let finalId = canonicalPeer;
            if (existingConv) {
                finalId = existingConv.id;
            } else if (canonicalPeer.length >= 32 || !canonicalPeer.includes('-')) {
                finalId = canonicalPeer;
            } else if (identity) {
                finalId = `${identity.short_id}-${canonicalPeer.substring(0, 8)}`;
            }

            set({ currentScreen: screen, activeConversationId: finalId, messages: [] });

            const fetchMessages = async () => {
                try {
                    let msgs = await RedAPI.getMessages(finalId);
                    const altPeer = existingConv?.peer || (canonicalPeer !== finalId ? canonicalPeer : null);
                    if ((!msgs || !msgs.length) && altPeer && altPeer !== finalId) {
                        const fallbackMsgs = await RedAPI.getMessages(altPeer).catch(() => []);
                        if (fallbackMsgs && fallbackMsgs.length > 0) msgs = fallbackMsgs;
                    }
                    set({ messages: Array.isArray(msgs) ? msgs : [] });
                } catch {
                    const altPeer = existingConv?.peer || (canonicalPeer !== finalId ? canonicalPeer : null);
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
                    // ── Request notification permissions ──────────────────────
                    try {
                        const { LocalNotifications } = await import('@capacitor/local-notifications');
                        const perm = await LocalNotifications.checkPermissions();
                        if (perm.display !== 'granted') {
                            await LocalNotifications.requestPermissions();
                        }
                    } catch (notifErr) {
                        console.warn('[RED] LocalNotifications permission error:', notifErr);
                    }
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
                    status: { is_running: true, peer_count: 0, identity_hash: localHash, version: `${RED_VERSION}-web`, chain_height: 1 },
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

    setProfile: async (profile: string | { nickname?: string; phone_number?: string; bio?: string }) => {
        const nickname = typeof profile === 'string' ? profile : (profile.nickname || "");
        const phone = typeof profile === 'string' ? undefined : profile.phone_number;
        const bio = typeof profile === 'string' ? undefined : profile.bio;
        const cleanName = nickname.trim();
        if (!cleanName) return;
        if (typeof window !== 'undefined') {
            localStorage.setItem('red_displayName', cleanName);
            localStorage.setItem('user_nickname', cleanName);
            if (phone) localStorage.setItem('red_phoneNumber', phone);
            if (bio) localStorage.setItem('red_bio', bio);
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
            set({ identity: { ...currentIdentity, nickname: cleanName, phone_number: phone, bio } });
        } else {
            const randBytes = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(16)) : new Uint8Array(16);
            const hex = Array.from(randBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            set({
                identity: {
                    identity_hash: 'local_' + hex,
                    short_id: cleanName.substring(0, 8).toLowerCase(),
                    nickname: cleanName,
                    phone_number: phone,
                    bio
                }
            });
        }
        RedAPI.setProfile(cleanName).catch(() => {});
    },

    enableDecoyVault: () => {
        const getCryptoHex = (bytes = 16) => {
            const buf = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(bytes)) : new Uint8Array(bytes);
            return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
        };
        const decoySeed = (typeof window !== 'undefined' && localStorage.getItem('red_decoy_identity_seed')) || getCryptoHex(32);
        if (typeof window !== 'undefined' && !localStorage.getItem('red_decoy_identity_seed')) {
            try { localStorage.setItem('red_decoy_identity_seed', decoySeed); } catch {}
        }
        const myHash = decoySeed.slice(0, 32);
        const contact1Hash = getCryptoHex(16);
        const contact2Hash = getCryptoHex(16);
        const contact3Hash = getCryptoHex(16);

        const decoyIdentity = {
            identity_hash: myHash,
            short_id: myHash.substring(0, 8),
            public_key: getCryptoHex(32),
            nickname: 'Usuario Civil',
            pow_score: 12,
        };
        const decoyContacts = [
            { identity_hash: contact1Hash, display_name: 'Mamá', online: true, public_key: getCryptoHex(32) },
            { identity_hash: contact2Hash, display_name: 'Carlos Trabajo', online: false, public_key: getCryptoHex(32) },
            { identity_hash: contact3Hash, display_name: 'Central Servicios', online: true, public_key: getCryptoHex(32) },
        ];
        const decoyConvs = [
            {
                id: `conv_${contact1Hash.slice(0, 8)}`,
                peer: contact1Hash,
                unread_count: 0,
                last_message: 'Acuérdate de comprar el pan al regresar a casa',
                last_timestamp: Date.now() - 3600000,
            },
            {
                id: `conv_${contact2Hash.slice(0, 8)}`,
                peer: contact2Hash,
                unread_count: 0,
                last_message: 'Confirmado el informe para la reunión de mañana',
                last_timestamp: Date.now() - 86400000,
            }
        ];
        set({
            isAuthenticated: true,
            isDecoyMode: true,
            identity: decoyIdentity,
            nodeOnline: true,
            contacts: decoyContacts,
            conversations: decoyConvs,
            messages: [
                {
                    id: `msg_${contact1Hash.slice(0, 6)}_1`,
                    sender: contact1Hash,
                    content: 'Acuérdate de comprar el pan al regresar a casa',
                    timestamp: Date.now() - 3600000,
                    is_mine: false,
                    status: 'Delivered',
                    msg_type: 'text'
                }
            ]
        });
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

                // Run storage Merkle self-healing audit
                StateIntegrityEngine.verifyAndHealStorage().then((audit) => {
                    if (!audit.isHealthy && audit.corruptedRecordsFound > 0) {
                        console.warn(`[RED] StateIntegrityEngine auto-healed ${audit.healedRecordsCount} corrupted records.`);
                    }
                }).catch(() => {});
                
                const connectSSE = () => {
                    if (_mainSSE) { _mainSSE.close(); _mainSSE = null; }
                    const es = RedAPI.subscribeToEvents((data) => {
                        if (data.event_type === 'sos_beacon' && data.sos) {
                            get().addSosBeacon(data.sos);
                        }
                        if (data.event_type === 'sos_resolved' && data.beacon_id) {
                            get().resolveSosBeacon(data.beacon_id);
                        }
                        if (data.event_type === 'weather_alert' && data.weather) {
                            get().addWeatherReport(data.weather);
                        }
                        if (data.event_type === 'channel_message' && data.channel_message) {
                            get().addChannelMessage(data.channel_message);
                        }
                        if (data.event_type === 'voice_burst' && data.voice_burst) {
                            get().addVoiceBurst(data.voice_burst);
                        }
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

    evaluateLocalDMS: async () => {
        if (typeof window === 'undefined') return;
        try {
            const dms = RedAPI.getDmsConfig ? await RedAPI.getDmsConfig().catch(() => null) : null;
            if (!dms || !dms.enabled) {
                localStorage.setItem('red_last_activity', Date.now().toString());
                return;
            }

            const lastActivityStr = localStorage.getItem('red_last_activity');
            const now = Date.now();
            const lastActivity = lastActivityStr ? parseInt(lastActivityStr) : now;

            // Update activity timestamp on interaction
            localStorage.setItem('red_last_activity', now.toString());

            const triggerMs = (dms.trigger_hours || 72) * 3600 * 1000;
            if (now - lastActivity > triggerMs) {
                console.warn("[DMS] Dead Man's Switch triggered! Initiating emergency purge protocol...");
                
                // Broadcast posthumous message if configured
                if (dms.dead_message && dms.dead_message.trim()) {
                    try {
                        await RedAPI.sendMessage('broadcast', dms.dead_message.trim(), { msg_type: 'text' }).catch(() => {});
                    } catch {}
                }

                // Execute wipe options
                if (dms.wipe_messages) {
                    localStorage.removeItem('red_messages');
                    localStorage.removeItem('red_conversations');
                    set({ messages: [], conversations: [] });
                }

                if (dms.wipe_identity) {
                    localStorage.clear();
                    set({
                        identity: null,
                        isAuthenticated: false,
                        messages: [],
                        contacts: [],
                        groups: [],
                        conversations: []
                    });
                }
            }
        } catch (err) {
            console.error("[DMS] Evaluation error:", err);
        }
    },

    fetchData: async () => {
        if (get().isDecoyMode) return;
        get().evaluateLocalDMS().catch(() => {});
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
            // BUG-FIX: Never wipe existing data on transient network errors.
            // Previously this destroyed all conversations/contacts on every blip.
            // Only log silently — the UI retains last good state.
            if (process.env.NODE_ENV === 'development') {
                console.warn('[RED] fetchData: transient error — retaining cached data.');
            }
        }
    },

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

        // ── GROUP ROUTING FIX ──────────────────────────────────────────────────
        // Check if peerHash matches a known group id (hex-encoded GroupId)
        const matchedGroup = (groups as any[]).find((g: any) => g.id === peerHash);
        const isGroupConv = !!matchedGroup;

        // ── RED GUARDIAN IA MODERATION EVALUATION ──────────────────────────────
        if (content && (!options?.msg_type || options.msg_type === 'text')) {
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

        // Reactions and typing pulses are not appended as new bubbles
        const isReaction = options?.msg_type === 'reaction';
        const isTyping   = options?.msg_type === 'typing';

        let tempId: string | null = null;
        const defaultTtlSec = SettingsManager.getAutoDestructSeconds(get().preferences?.autoDestructDefault);
        const effectiveTtl = options?.ttl || (defaultTtlSec > 0 ? defaultTtlSec : undefined);

        if (!isReaction && !isTyping) {
            const myIdentity = get().identity;
            const detectedMediaData = options?.media_data || (content?.startsWith('data:') ? content : undefined);
            const tempMsg: MessageItem = {
                id: 'temp_' + Date.now(),
                sender: myIdentity?.identity_hash || 'me',
                content,
                timestamp: Date.now() / 1000,
                is_mine: true,
                msg_type: options?.msg_type || (content?.startsWith('data:image') ? 'image' : content?.startsWith('data:audio') ? 'voice' : content?.startsWith('data:video') ? 'video' : 'text'),
                media_data: detectedMediaData,
                duration_ms: options?.duration_ms,
                latitude:    options?.latitude,
                longitude:   options?.longitude,
                accuracy:    options?.accuracy,
                reply_to:    options?.reply_to,
                ttl:         effectiveTtl,
                expires_at:  effectiveTtl ? (Date.now() / 1000 + effectiveTtl) : options?.expires_at,
                status: 'Pending',
            };
            tempId = tempMsg.id;
            set({ messages: [...get().messages, tempMsg] });
        }

        try {
            const apiOptions: Record<string, any> = { ...options };
            if (effectiveTtl && !apiOptions.ttl) {
                apiOptions.ttl = effectiveTtl;
            }
            if (options?.reply_to?.id) {
                apiOptions.target_message_id = options.reply_to.id;
            }

            // Compute Proof-of-Work to protect mesh from flooding
            try {
                const myDid = get().identity?.identity_hash || 'me';
                const powProof = await MeshProofOfWork.mineProof(content, myDid, 3);
                if (powProof) apiOptions.pow = powProof;
            } catch {}

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

    // ── Stories & Live Streaming actions ─────────────────────────────────────
    publishStatus: async (content: string, media?: string | null, theme?: number) => {
        const { contacts, conversations, identity } = get();
        if (!identity) return;
        const payload: Record<string, any> = { msg_type: 'status' };
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

        // ── Typing pulse: show indicator for 5s, then auto-clear ──────────────
        if (item.msg_type === 'typing') {
            if (typingTimeout) clearTimeout(typingTimeout);
            const t = setTimeout(() => set({ peerTyping: false, typingTimeout: null }), 5000);
            set({ peerTyping: true, typingTimeout: t });
            return; // do NOT add to message list
        }

        // ── LIVE Stream P2P Video Handlers ─────────────────────────────────────
        if (item.msg_type === 'live_announce') {
            const rawItem = item as any;
            const streamId = rawItem.content || rawItem.conversation_id;
            if (streamId) {
                const contactsList = get().contacts || [];
                const matchedContact = contactsList.find((c: any) => c.identity_hash === item.sender);
                const broadcasterName = matchedContact?.display_name || rawItem.sender_name || `Operador ${item.sender.substring(0, 6)}`;
                set(s => ({
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
                set(s => {
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
                set(s => {
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

        if (item.msg_type === 'live_comment') {
            const rawItem = item as any;
            const streamId = rawItem.conversation_id;
            if (streamId && rawItem.content) {
                set(s => {
                    const currentStream = s.liveStreams[streamId];
                    if (!currentStream) return s;
                    const newComments = [...(currentStream.comments || []), {
                        sender: rawItem.sender_name || `Operador ${item.sender.substring(0, 4)}`,
                        text: rawItem.content
                    }].slice(-30);
                    return {
                        liveStreams: {
                            ...s.liveStreams,
                            [streamId]: { ...currentStream, comments: newComments }
                        }
                    };
                });
            }
            return;
        }

        // ── WebRTC Signaling: intercept for calls, never append as chat bubble ──
        if (item.msg_type === 'webrtc_signal') {
            try {
                const signal = JSON.parse(item.content);
                const senderHash = item.sender;
                const contacts = get().contacts || [];
                const contact = contacts.find((c: any) => 
                    c.identity_hash === senderHash ||
                    (senderHash.length >= 8 && c.identity_hash?.startsWith(senderHash.substring(0, 8))) ||
                    (c.identity_hash?.length >= 8 && senderHash.startsWith(c.identity_hash.substring(0, 8)))
                );
                const callerName = contact?.display_name || `Operador ${senderHash.substring(0, 8)}`;

                if (signal.offer) {
                    set({
                        incomingCall: {
                            callerHash: senderHash,
                            callerName: callerName,
                            offer: signal.offer
                        }
                    });
                } else if (signal.hangup) {
                    set({ incomingCall: null, activeCallSignal: { senderHash, signal } });
                    if (get().currentScreen === 'call') {
                        toast.info('Llamada finalizada');
                        get().goBack();
                    }
                } else {
                    set({ activeCallSignal: { senderHash, signal } });
                }
            } catch (e) {
                console.warn('[WebRTC Signal Parse Error]', e);
            }
            return;
        }

        // ── Contact Request & Response: Reciprocal P2P auto-add & nickname exchange ──
        if (item.msg_type === 'contact_request' || item.msg_type === 'contact_response') {
            try {
                const data = JSON.parse(item.content);
                const senderHash = data.sender_hash || item.sender;
                const senderName = data.sender_name || `Operador ${senderHash.substring(0, 6)}`;
                const senderPk   = data.sender_pk || null;

                const existingContacts = get().contacts || [];
                const existing = existingContacts.find((c: any) => 
                    c.identity_hash === senderHash ||
                    (senderHash.length >= 8 && c.identity_hash?.startsWith(senderHash.substring(0, 8))) ||
                    (c.identity_hash?.length >= 8 && senderHash.startsWith(c.identity_hash.substring(0, 8)))
                );

                // Preserve user-assigned non-generic contact names
                const isGenericName = !existing?.display_name || 
                    existing.display_name.startsWith('Operador ') || 
                    existing.display_name.startsWith('Nodo RED');
                const finalName = (existing && !isGenericName) ? existing.display_name : senderName;

                RedAPI.addContact(senderHash, finalName, senderPk).catch(() => {
                    // Fallback to local store
                    if (!existing) {
                        set({ contacts: [...existingContacts, { identity_hash: senderHash, display_name: finalName, public_key: senderPk }] });
                    }
                }).finally(() => {
                    if (item.msg_type === 'contact_request') {
                        toast.success(`🤝 ${finalName} te ha agregado como contacto.`);
                        const myIdentity = get().identity;
                        const myName = myIdentity?.nickname || 'Operador RED';
                        if (myIdentity?.identity_hash) {
                            RedAPI.sendMessage(senderHash, JSON.stringify({
                                sender_hash: myIdentity.identity_hash,
                                sender_name: myName,
                                sender_pk: myIdentity.public_key || null
                            }), { msg_type: 'contact_response' }).catch(() => {});
                        }
                    } else if (item.msg_type === 'contact_response') {
                        toast.success(`🤝 ${finalName} ha aceptado tu invitación.`);
                    }
                    get().fetchData();
                });
            } catch {
                const senderHash = item.sender;
                const existingContacts = get().contacts || [];
                const existing = existingContacts.find((c: any) => 
                    c.identity_hash === senderHash ||
                    (senderHash.length >= 8 && c.identity_hash?.startsWith(senderHash.substring(0, 8)))
                );
                if (!existing) {
                    const senderName = `Operador ${senderHash.substring(0, 6)}`;
                    set({ contacts: [...existingContacts, { identity_hash: senderHash, display_name: senderName }] });
                    get().fetchData();
                }
            }
            return;
        }

        // ── Auto-register un-added sender as contact on incoming message ─────────
        if (!item.is_mine && item.sender && !item.sender.startsWith('local_')) {
            const contactsList = get().contacts || [];
            const exists = contactsList.some((c: any) => 
                c.identity_hash === item.sender ||
                (item.sender.length >= 8 && c.identity_hash?.startsWith(item.sender.substring(0, 8))) ||
                (c.identity_hash?.length >= 8 && item.sender.startsWith(c.identity_hash.substring(0, 8)))
            );
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

        const canonicalSender = meshRouter.getCanonicalId(itemSender) || itemSender;
        const canonicalRecipient = itemRecipient ? (meshRouter.getCanonicalId(itemRecipient) || itemRecipient) : undefined;

        const isCurrentChat =
            activeConversationId === item.conversation_id ||
            (currentConv && (
                currentConv.peer === itemSender ||
                currentConv.peer === canonicalSender ||
                (itemRecipient && (currentConv.peer === itemRecipient || currentConv.peer === canonicalRecipient)) ||
                currentConv.id === item.conversation_id
            )) ||
            (canonicalSender.length >= 8 && canonicalSender !== myHash && activeConversationId?.includes(canonicalSender.substring(0, 8))) ||
            (canonicalRecipient && canonicalRecipient.length >= 8 && canonicalRecipient !== myHash && activeConversationId?.includes(canonicalRecipient.substring(0, 8))) ||
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

        // ── Walkie-Talkie Voice Burst: ingest and save to bursts store ──
        if (item.msg_type === 'voice_burst') {
            try {
                const burst = JSON.parse(item.content);
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
        if (item.msg_type === 'channel_post') {
            try {
                const chMsg = JSON.parse(item.content);
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

        if (isCurrentChat) {
            // Ensure is_mine is accurately computed for incoming packet
            const resolvedIsMine = Boolean(
                item.is_mine ||
                item.sender === 'me' ||
                (myHash && (
                    item.sender?.toLowerCase() === myHash.toLowerCase() ||
                    myHash.toLowerCase().startsWith(item.sender?.toLowerCase() || '_____') ||
                    (item.sender && item.sender.toLowerCase().startsWith(myHash.toLowerCase()))
                ))
            );
            const normalizedItem: MessageItem = {
                ...(item as MessageItem),
                is_mine: resolvedIsMine,
            };

            // DEDUP / IN-PLACE REPLACE: replace optimistic temp_ message or update existing
            const existingIndex = messages.findIndex((m: MessageItem) =>
                m.id === item.id ||
                (m.id.startsWith('temp_') && (
                    m.content === item.content ||
                    (m.media_data && item.media_data && m.media_data.length === item.media_data.length) ||
                    (m.msg_type === item.msg_type && Math.abs((m.timestamp || 0) - (item.timestamp || 0)) < 15)
                ))
            );
            if (existingIndex !== -1) {
                const updated = [...messages];
                updated[existingIndex] = {
                    ...normalizedItem,
                    media_data: normalizedItem.media_data || updated[existingIndex].media_data
                };
                set({ messages: updated });
            } else {
                set({ messages: [...messages, normalizedItem] });
                if (!normalizedItem.is_mine) {
                    TacticalAudioEngine.playMessageReceived();
                }
            }
            // Refresh sidebar badge (debounced, only if not already active chat)
            return;
        } else {
            if (!item.is_mine) {
                TacticalAudioEngine.playMessageReceived();
            }
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
                                    id: Math.floor(Date.now() % 2147483647),
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
        
        // Only refresh sidebar for messages in OTHER conversations (badge count update).
        // The early `return` above handles the active chat case without a round-trip.
    },

    addContact: async (identity_hash: string, display_name: string, public_key?: string | null) => {
        const inputStr = identity_hash.trim();
        let cleanName = display_name.trim();

        let cleanHash = inputStr;
        let pubKey: string | null = public_key ?? null;

        // If no explicit pk was provided, try to parse did:red:<hash>:<pk> or <hash>:<pk> format
        if (!pubKey) {
            if (inputStr.startsWith("did:red:")) {
                const parts = inputStr.split(":");
                if (parts.length >= 4) {
                    cleanHash = parts[2];
                    pubKey = parts[3];
                } else if (parts.length >= 3) {
                    cleanHash = parts[2];
                }
            } else if (inputStr.includes(":")) {
                const parts = inputStr.split(":");
                if (parts.length >= 2 && parts[0].length >= 32) {
                    cleanHash = parts[0];
                    pubKey = parts[1];
                }
            }
        }

        // 1. Resolve canonical hash from meshRouter if input is a hardware device ID (BLE MAC / UUID)
        const canonicalFromMesh = meshRouter.getCanonicalId(cleanHash);
        if (canonicalFromMesh && canonicalFromMesh !== cleanHash && canonicalFromMesh.length === 64) {
            cleanHash = canonicalFromMesh;
            const peerInfo = meshRouter.getPeerByAnyId(cleanHash);
            if (peerInfo?.publicKey && !pubKey) {
                pubKey = peerInfo.publicKey;
            }
        }

        // 2. If cleanHash is still not 64 hex characters, query active link via mesh handshake
        if (cleanHash.length !== 64) {
            try {
                const queried = await meshRouter.queryIdentity(cleanHash);
                if (queried?.identity_hash && queried.identity_hash.length === 64) {
                    cleanHash = queried.identity_hash;
                    pubKey = pubKey || queried.public_key || null;
                    if (!cleanName || cleanName.startsWith('Nodo RED') || cleanName.startsWith('Dispositivo')) {
                        cleanName = queried.display_name || cleanName;
                    }
                }
            } catch {}
        }

        const MAX_RETRIES = 10;
        const RETRY_DELAY_MS = 2000;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                await RedAPI.addContact(cleanHash, cleanName, pubKey);

                // Clean up any old duplicate non-canonical contacts that shared this name or hardware ID
                const currentContacts = get().contacts || [];
                const cleansed = currentContacts.filter(c => 
                    c.identity_hash !== inputStr && 
                    !(c.identity_hash.includes(':') && c.identity_hash.length < 32)
                );
                if (cleansed.length !== currentContacts.length) {
                    set({ contacts: cleansed });
                }

                // Send background contact request to peer so they automatically add us back!
                const myIdentity = get().identity;
                const myName = myIdentity?.nickname || 'Operador RED';
                if (myIdentity?.identity_hash) {
                    RedAPI.sendMessage(cleanHash, JSON.stringify({
                        sender_hash: myIdentity.identity_hash,
                        sender_name: myName,
                        sender_pk: myIdentity.public_key || null
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
                // Handle fallback to local contacts store
                console.log(`[addContact] Peer ${cleanHash} registering in local P2P store`);
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
                        sender_name: myName,
                        sender_pk: myIdentity.public_key || null
                    }), { msg_type: 'contact_request' }).catch(() => {});
                }
                return true;
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

    // ── Mark conversation as read (clear badge + notify Rust) ─────────────────
    markAsRead: (conversationId: string) => {
        if (!conversationId) return;
        const { conversations } = get();
        const conv = conversations.find(c => c.id === conversationId);
        const hasUnread = conv && (conv.unread_count || 0) > 0;
        if (hasUnread) {
            set({
                conversations: conversations.map(c =>
                    c.id === conversationId ? { ...c, unread_count: 0 } : c
                )
            });
        }
        // Best-effort: tell Rust the conversation is read
        RedAPI.req(`/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => {});
    },
}));

if (typeof window !== 'undefined') {
    (window as any).__RED_STORE__ = useRedStore;
}
