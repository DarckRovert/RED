import { create } from 'zustand';
import { RedAPI, IdentityResponse, ConversationItem, MessageItem, StatusResponse } from '../lib/api';
import { localTransport } from '../lib/mesh/localTransport';
import { meshRouter, normalizeIdentity, generateDeterministicMsgId } from '../lib/mesh/meshRouter';
import { toast } from '../components/Toast';
import { GuardianEngine } from '../lib/guardianEngine';
import { RED_VERSION } from '../lib/version';
import { SettingsManager, UserPreferences, DEFAULT_PREFERENCES } from '../lib/settingsManager';
import { TacticalAudioEngine } from '../lib/TacticalAudioEngine';
import { StateIntegrityEngine } from '../lib/StateIntegrityEngine';
import { MeshProofOfWork } from '../lib/MeshProofOfWork';
import { CallRingtoneEngine } from '../lib/CallRingtoneEngine';

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

// Persistent cross-session message deduplication set
const _processedMessageIds = new Set<string>(typeof window !== 'undefined' ? (() => {
    try {
        const raw = localStorage.getItem('red_processed_msg_ids');
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch { return []; }
})() : []);

function recordProcessedMessageId(id: string) {
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

/**
 * RED 2.0 SPA Store.
 * Central hub for memory and UI View routing (No next/router).
 */

export type ScreenView = 'sidebar' | 'chat' | 'settings' | 'updater' | 'status' | 'crypto' | 'broadcast' | 'radar' | 'contacts' | 'call' | 'nodemap' | 'explorer' | 'network' | 'dms' | 'amber' | 'amberAdmin' | 'guardian' | 'compass' | 'channels' | 'publicChannels' | 'sos' | 'walkie' | 'weather' | 'weatherAlert' | 'idVault' | 'identityVault' | 'proximity' | 'proximityWave' | 'canvas' | 'liveCanvas' | 'ecoMesh' | 'proximitySettings' | 'proximity_settings' | 'aiCopilot' | 'copilot' | 'nearby' | 'liveStream' | 'offGridCompass' | 'vitalScan' | 'survivalBeacon' | 'rfSpectrum' | 'stegoVault' | 'security' | 'groups' | 'p2pCompass' | 'socialFeed' | 'shakePair' | 'p2pPay' | 'redP2PPay' | 'blackout' | 'health' | 'systemHealth' | 'nodeLogs' | 'logs' | 'calculator' | 'secReport' | 'backup' | 'landing' | 'commercialHub' | 'hub' | 'globalShield' | 'web3Vault';

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
    sendTypingStatus: (status: 'typing' | 'recording_voice' | 'idle') => void;
    sendReaction: (messageId: string, emoji: string) => Promise<void>;
    deleteMessageForEveryone: (messageId: string) => Promise<void>;
    addIncomingMessage: (rawEvent: any) => void;
    addContact:   (identity_hash: string, display_name: string, public_key?: string | null) => Promise<string | boolean>;
    deleteMessage: (messageId: string) => Promise<void>;
    editMessage: (messageId: string, newContent: string) => Promise<void>;
    clearConversation: () => Promise<void>;
    starMessage: (messageId: string) => void;
    markAsRead: (conversationId: string) => void;
    starredMessages: string[]; // stored in localStorage by conv
    connectPeer: (multiaddr: string) => Promise<boolean>;
    // Real-time typing state (set by incoming SSE typing messages)
    peerTyping: boolean;
    peerTypingStatus: Record<string, 'typing' | 'recording_voice' | 'idle'>;
    typingTimeout: ReturnType<typeof setTimeout> | null;
    peerPresence: Record<string, 'online' | 'offline' | 'nearby'>;

    // Advanced Chat Management (v8.0)
    pinnedChatIds: string[];
    archivedChatIds: string[];
    togglePinChat: (id: string) => void;
    toggleArchiveChat: (id: string) => void;
    setProfile: (profile: string | { nickname?: string; phone_number?: string; bio?: string }) => Promise<void>;
    enableDecoyVault: () => void;
    selectedContactForProfile: any | null;
    setSelectedContactForProfile: (contact: any | null) => void;
    isCallPipMinimized: boolean;
    setCallPipMinimized: (minimized: boolean) => void;

    // ── Stories & Live Streaming ───────────────────────────────────────────────
    liveStreams: Record<string, LiveStreamItem>;
    myStories: StoryEntry[];
    peerStories: Record<string, MessageItem[]>;
    activeLiveStreamId: string | null;   // stream being viewed
    isStreaming: boolean;                 // true when broadcasting
    streamId: string | null;             // own active stream id

    // ── WebRTC Voice & Video Call State ───────────────────────────────────────
    incomingCall: { callerHash: string; callerName: string; offer: any; callType: 'audio' | 'video' } | null;
    activeCallOffer: any | null;
    activeCallSignal: { senderHash: string; signal: any } | null;
    callSignalQueue: { senderHash: string; signal: any; timestamp: number }[];
    activeCallType: 'audio' | 'video';
    activeCallPeer: string | null;
    setActiveCallPeer: (peer: string | null) => void;
    setActiveCallType: (type: 'audio' | 'video') => void;
    setActiveCallOffer: (offer: any | null) => void;
    setIncomingCall: (call: { callerHash: string; callerName: string; offer: any; callType: 'audio' | 'video' } | null) => void;
    setActiveCallSignal: (sig: { senderHash: string; signal: any } | null) => void;
    pushCallSignal: (sig: { senderHash: string; signal: any }) => void;
    clearCallSignals: () => void;

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
    'security', 'groups', 'p2pCompass', 'socialFeed', 'shakePair', 'p2pPay', 'blackout', 'health', 'nodeLogs', 'calculator', 'secReport', 'backup', 'commercialHub', 'hub'
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
    peerTypingStatus: {},
    isCallPipMinimized: false,
    selectedContactForProfile: null,
    setSelectedContactForProfile: (contact) => set({ selectedContactForProfile: contact }),
    setCallPipMinimized: (minimized) => set({ isCallPipMinimized: minimized }),

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
    activeCallOffer: null,
    activeCallSignal: null,
    callSignalQueue: [],
    activeCallType: 'video',
    activeCallPeer: null,
    setActiveCallPeer: (peer) => set({ activeCallPeer: peer }),
    setActiveCallType: (type) => set({ activeCallType: type }),
    setActiveCallOffer: (offer) => set({ activeCallOffer: offer }),
    setIncomingCall: (call) => {
        if (!call) CallRingtoneEngine.stop();
        set({ incomingCall: call });
    },
    setActiveCallSignal: (sig) => set({ activeCallSignal: sig }),
    pushCallSignal: (sig) => set((state) => ({
        activeCallSignal: sig,
        callSignalQueue: [...state.callSignalQueue, { ...sig, timestamp: Date.now() }].slice(-50)
    })),
    clearCallSignals: () => set({ activeCallSignal: null, callSignalQueue: [] }),

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

            const sanitizeMsgs = (list: any[]): MessageItem[] => {
                if (!Array.isArray(list)) return [];
                return list.filter(m => {
                    if (!m) return false;
                    if (m.msg_type === 'typing' || m.msg_type === 'typing_status') return false;
                    if (typeof m.content === 'string' && m.content.startsWith('{') && m.content.includes('"status":') && m.content.includes('"sender_hash"')) return false;
                    return true;
                });
            };

            const fetchMessages = async () => {
                try {
                    let msgs = await RedAPI.getMessages(finalId);
                    const altPeer = existingConv?.peer || (canonicalPeer !== finalId ? canonicalPeer : null);
                    if ((!msgs || !msgs.length) && altPeer && altPeer !== finalId) {
                        const fallbackMsgs = await RedAPI.getMessages(altPeer).catch(() => []);
                        if (fallbackMsgs && fallbackMsgs.length > 0) msgs = fallbackMsgs;
                    }
                    set({ messages: sanitizeMsgs(msgs) });
                } catch {
                    const altPeer = existingConv?.peer || (canonicalPeer !== finalId ? canonicalPeer : null);
                    if (altPeer && altPeer !== finalId) {
                        RedAPI.getMessages(altPeer)
                            .then(msgs => set({ messages: sanitizeMsgs(msgs) }))
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

                // Initialize Global WebRTC P2P Mesh & Blind Relay
                localTransport.init(localHash).catch(e =>
                    console.warn('[RED Web] Mesh init failed:', e)
                );

                // Load initial data (conversations, contacts from web storage)
                await get().fetchData();

                // Wire meshRouter local packet delivery
                meshRouter.onLocalDelivery((packet) => {
                    try {
                        const payloadStr = new TextDecoder().decode(packet.payload);
                        let parsed: any;
                        const normTs = packet.timestamp ? (packet.timestamp > 1e11 ? packet.timestamp / 1000 : packet.timestamp) : Date.now() / 1000;
                        try {
                            parsed = JSON.parse(payloadStr);
                        } catch {
                            parsed = {
                                id: packet.nonce || `msg_${packet.sender.slice(0, 8)}_${Math.floor(normTs)}`,
                                content: payloadStr,
                                sender: packet.sender,
                                timestamp: normTs,
                                is_mine: false,
                                msg_type: 'text'
                            };
                        }
                        if (parsed) {
                            if (!parsed.sender) parsed.sender = packet.sender;
                            if (parsed.timestamp && parsed.timestamp > 1e11) parsed.timestamp = parsed.timestamp / 1000;
                            if (!parsed.timestamp) parsed.timestamp = normTs;
                            get().addIncomingMessage(parsed);
                        }
                    } catch (deliveryErr) {
                        console.warn('[RED Web] Error handling mesh packet delivery:', deliveryErr);
                    }
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

                if (typeof window !== 'undefined' && identity.identity_hash) {
                    localStorage.setItem("red_identity_hash", identity.identity_hash);
                    if (identity.short_id) localStorage.setItem("red_short_id", identity.short_id);
                }
                try {
                    const { Capacitor } = await import('@capacitor/core');
                    if (Capacitor.isNativePlatform() && identity.identity_hash) {
                        const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
                        SecureStoragePlugin.set({ key: "red_identity_hash", value: identity.identity_hash }).catch(() => null);
                        if (identity.short_id) SecureStoragePlugin.set({ key: "red_short_id", value: identity.short_id }).catch(() => null);
                    }
                } catch {}

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

                localTransport.init(identity.identity_hash).then(() => {
                    meshRouter.onLocalDelivery((packet) => {
                        try {
                            const payloadStr = new TextDecoder().decode(packet.payload);
                            let parsed: any;
                            const normTs = packet.timestamp ? (packet.timestamp > 1e11 ? packet.timestamp / 1000 : packet.timestamp) : Date.now() / 1000;
                            try {
                                parsed = JSON.parse(payloadStr);
                            } catch {
                                parsed = {
                                    id: packet.nonce || `msg_${packet.sender.slice(0, 8)}_${Math.floor(normTs)}`,
                                    content: payloadStr,
                                    sender: packet.sender,
                                    timestamp: normTs,
                                    is_mine: false,
                                    msg_type: 'text'
                                };
                            }
                            if (parsed) {
                                if (!parsed.sender) parsed.sender = packet.sender;
                                if (parsed.timestamp && parsed.timestamp > 1e11) parsed.timestamp = parsed.timestamp / 1000;
                                if (!parsed.timestamp) parsed.timestamp = normTs;
                                get().addIncomingMessage(parsed);
                            }
                        } catch (deliveryErr) {
                            console.warn('[RED Native] Error handling mesh packet delivery:', deliveryErr);
                        }
                    });
                }).catch(err => {
                    console.warn('[RED Native] LocalTransport init failed:', err);
                });

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
            const myHash = get().identity?.identity_hash?.toLowerCase();

            // Filter out corrupt / self entries: 'me', 'local', myHash, 'Operador me'
            const cleanConvs = (Array.isArray(convs) ? convs : []).filter((c: any) => {
                if (!c) return false;
                const peer = (c.peer || c.id || '').toLowerCase();
                const name = (c.name || c.display_name || '').toLowerCase();
                if (peer === 'me' || peer === 'local' || peer === 'unknown' || name === 'operador me') return false;
                if (myHash && (peer === myHash || (peer.length >= 16 && myHash.startsWith(peer)))) return false;
                if (c.last_message && (c.last_message.startsWith('{"') || c.last_message.includes('"sender_hash"') || c.last_message.includes('contact_request') || c.last_message.includes('contact_response'))) {
                    c.last_message = 'Contacto P2P establecido';
                }
                return true;
            });

            // Deduplicate conversations by peer
            const seenPeers = new Set<string>();
            const dedupedConvs: ConversationItem[] = [];
            for (const c of cleanConvs) {
                const p = (c.peer || c.id || '').toLowerCase();
                const shortP = p.slice(0, 16);
                if (!seenPeers.has(shortP)) {
                    seenPeers.add(shortP);
                    dedupedConvs.push(c);
                }
            }

            const cleanConts = (Array.isArray(conts) ? conts : []).filter((c: any) => {
                if (!c) return false;
                const hash = (c.identity_hash || '').toLowerCase();
                const name = (c.display_name || '').toLowerCase();
                if (hash === 'me' || hash === 'local' || hash === 'unknown' || name === 'operador me') return false;
                if (myHash && (hash === myHash || (hash.length >= 16 && myHash.startsWith(hash)))) return false;
                return true;
            });

            // Deduplicate contacts by identity_hash
            const seenContacts = new Set<string>();
            const dedupedConts: any[] = [];
            for (const ct of cleanConts) {
                const h = (ct.identity_hash || '').toLowerCase();
                const shortH = h.slice(0, 16);
                if (!seenContacts.has(shortH)) {
                    seenContacts.add(shortH);
                    dedupedConts.push(ct);
                }
            }

            const safeGrps = Array.isArray(grps) ? grps : [];

            // Purge dirty entries from Web storage
            if (typeof window !== 'undefined') {
                try {
                    localStorage.removeItem('red_web_messages_me');
                    localStorage.removeItem('red_web_messages_local');
                    const rawWebConvs = localStorage.getItem('red_web_conversations');
                    if (rawWebConvs) {
                        const parsed = JSON.parse(rawWebConvs);
                        const filtered = parsed.filter((c: any) => {
                            const p = (c.peer || c.id || '').toLowerCase();
                            const n = (c.name || c.display_name || '').toLowerCase();
                            return p !== 'me' && p !== 'local' && n !== 'operador me' && (!myHash || (p !== myHash && !myHash.startsWith(p)));
                        }).map((c: any) => {
                            if (c.last_message && (c.last_message.startsWith('{"') || c.last_message.includes('contact_request') || c.last_message.includes('contact_response'))) {
                                c.last_message = 'Contacto P2P establecido';
                            }
                            return c;
                        });
                        localStorage.setItem('red_web_conversations', JSON.stringify(filtered));
                    }
                    const rawWebConts = localStorage.getItem('red_web_contacts');
                    if (rawWebConts) {
                        const parsed = JSON.parse(rawWebConts);
                        const filtered = parsed.filter((c: any) => {
                            const h = (c.identity_hash || '').toLowerCase();
                            const n = (c.display_name || '').toLowerCase();
                            return h !== 'me' && h !== 'local' && n !== 'operador me' && (!myHash || (h !== myHash && !myHash.startsWith(h)));
                        });
                        localStorage.setItem('red_web_contacts', JSON.stringify(filtered));
                    }
                } catch {}
            }

            const { currentScreen, activeConversationId } = get();
            let newActiveId = activeConversationId;
            if (currentScreen === 'chat' && activeConversationId) {
                const matched = dedupedConvs.find((c: any) =>
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
                conversations: dedupedConvs,
                contacts: dedupedConts,
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

        let cleanPeerHash = peerHash.trim();
        if (cleanPeerHash.startsWith('did:red:')) cleanPeerHash = cleanPeerHash.replace(/^did:red:/i, '');
        if (cleanPeerHash.includes(':')) cleanPeerHash = cleanPeerHash.split(':')[0].trim();
        cleanPeerHash = cleanPeerHash.toLowerCase();

        // ── GROUP ROUTING FIX ──────────────────────────────────────────────────
        // Check if peerHash matches a known group id (hex-encoded GroupId)
        const matchedGroup = (groups as any[]).find((g: any) => g.id === cleanPeerHash || g.id === peerHash);
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

        // Control messages (handshake, reactions, typing, signals) are not appended as visible chat bubbles
        const isControlMessage = 
            options?.msg_type === 'reaction' ||
            options?.msg_type === 'typing' ||
            options?.msg_type === 'contact_request' ||
            options?.msg_type === 'contact_response' ||
            options?.msg_type === 'webrtc_signal' ||
            options?.msg_type === 'location_ping' ||
            options?.msg_type === 'timer_update' ||
            (typeof content === 'string' && content.startsWith('{') && content.includes('"sender_hash"') && content.includes('"sender_pk"'));

        let tempId: string | null = null;
        const defaultTtlSec = SettingsManager.getAutoDestructSeconds(get().preferences?.autoDestructDefault);
        const effectiveTtl = options?.ttl || (defaultTtlSec > 0 ? defaultTtlSec : undefined);
        const myIdentity = get().identity;
        const myDid = myIdentity?.identity_hash || 'me';
        const msgId = options?.id || generateDeterministicMsgId(myDid, cleanPeerHash, content);
        const detectedMediaData = options?.media_data || (content?.startsWith('data:') ? content : undefined);

        if (!isControlMessage) {
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
            set({ messages: [...get().messages.filter(m => m.id !== msgId), optimisticMsg] });
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

            // Compute Proof-of-Work to protect mesh from flooding
            try {
                const powProof = await MeshProofOfWork.mineProof(content, myDid, 3);
                if (powProof) apiOptions.pow = powProof;
            } catch {}

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
                        set(s => ({
                            peerTyping: false,
                            typingTimeout: null,
                            peerTypingStatus: { ...s.peerTypingStatus, [senderHash]: 'idle' }
                        }));
                    }, 4000);
                    set(s => ({
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

        // ── Delivery Acknowledgment (ACK) Handling ─────────────────────────────
        if (item.msg_type === 'ack' || item.msg_type === 'delivery_ack') {
            const targetId = (item as any).target_id || item.content;
            if (targetId) {
                set(s => ({
                    messages: s.messages.map(m =>
                        (m.id === targetId || m.id === item.id) ? { ...m, status: 'Delivered' as const, delivered: true } : m
                    )
                }));
            }
            return;
        }

        // ── Identity Handshake Protocol (contact_request / contact_response) ─────
        const isHandshakePacket = 
            item.msg_type === 'contact_request' || 
            item.msg_type === 'contact_response' ||
            (typeof item.content === 'string' && item.content.startsWith('{') && item.content.includes('"sender_hash"') && item.content.includes('"sender_pk"'));

        if (isHandshakePacket) {
            try {
                const parsed = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : data;
                const senderHash = meshRouter.getCanonicalId(parsed.sender_hash || item.sender);
                const senderName = parsed.sender_name || `Operador ${senderHash.substring(0, 6)}`;
                const senderPk = parsed.sender_pk || null;
                const myHash = get().identity?.identity_hash?.toLowerCase();

                if (!senderHash || senderHash === 'me' || senderHash === 'local' || (myHash && senderHash.toLowerCase() === myHash)) {
                    return;
                }

                const existingContacts = get().contacts || [];
                const existing = existingContacts.find((c: any) => 
                    c.identity_hash?.toLowerCase() === senderHash.toLowerCase() ||
                    (senderHash.length >= 8 && c.identity_hash?.toLowerCase().startsWith(senderHash.substring(0, 8).toLowerCase())) ||
                    (c.identity_hash?.length >= 8 && senderHash.toLowerCase().startsWith(c.identity_hash.substring(0, 8).toLowerCase()))
                );

                const isGenericName = !existing?.display_name || 
                    existing.display_name.startsWith('Operador ') || 
                    existing.display_name.startsWith('Nodo ') ||
                    existing.display_name.startsWith('Par Escaneado') ||
                    existing.display_name === 'Nuevo Par';
                const finalName = (existing && !isGenericName) ? existing.display_name : senderName;

                const handshakeKey = `${senderHash.toLowerCase()}_${item.msg_type || (parsed.sender_pk ? 'req' : 'res')}`;
                const alreadyHandshaked = _processedHandshakes.has(handshakeKey);
                _processedHandshakes.add(handshakeKey);

                RedAPI.addContact(senderHash, finalName, senderPk).catch(() => {
                    if (!existing) {
                        set({ contacts: [...existingContacts, { identity_hash: senderHash, display_name: finalName, public_key: senderPk }] });
                    }
                }).finally(() => {
                    if (!alreadyHandshaked) {
                        if (item.msg_type === 'contact_request' || (!item.msg_type && isHandshakePacket)) {
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
                    }
                    get().fetchData();
                });
            } catch {
                const senderHash = meshRouter.getCanonicalId(item.sender);
                const myHash = get().identity?.identity_hash?.toLowerCase();
                if (senderHash && senderHash !== 'me' && senderHash !== 'local' && (!myHash || senderHash.toLowerCase() !== myHash)) {
                    const existingContacts = get().contacts || [];
                    const existing = existingContacts.find((c: any) => 
                        c.identity_hash?.toLowerCase() === senderHash.toLowerCase() ||
                        (senderHash.length >= 8 && c.identity_hash?.toLowerCase().startsWith(senderHash.substring(0, 8).toLowerCase()))
                    );
                    if (!existing) {
                        const senderName = `Operador ${senderHash.substring(0, 6)}`;
                        set({ contacts: [...existingContacts, { identity_hash: senderHash, display_name: senderName }] });
                        get().fetchData();
                    }
                }
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
                        set({
                            incomingCall: {
                                callerHash: senderHash,
                                callerName: callerName,
                                offer: signal.offer,
                                callType: determinedType
                            },
                            activeCallType: determinedType
                        });
                    }
                    get().pushCallSignal({ senderHash, signal });
                } else if (signal.hangup) {
                    CallRingtoneEngine.stop();
                    set({ incomingCall: null });
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
                    set((s) => ({
                        activeSosBeacons: [...s.activeSosBeacons.filter(b => b.beacon_id !== beacon.beacon_id), { ...beacon, active: true }]
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
                    set((s) => ({
                        activeSosBeacons: s.activeSosBeacons.filter(b => b.beacon_id !== beaconId)
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
                    set((s) => ({
                        activeWeatherReports: [report, ...s.activeWeatherReports.filter(r => r.id !== report.id)].slice(0, 30)
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

        const myHash = get().identity?.identity_hash;
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
                (myHash && (
                    item.sender?.toLowerCase() === myHash.toLowerCase() ||
                    myHash.toLowerCase().startsWith(item.sender?.toLowerCase() || '_____') ||
                    (item.sender && item.sender.toLowerCase().startsWith(myHash.toLowerCase()))
                ))
            );
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

                // 2. Pending optimistic message replacement by content / media / type
                if (m.id.startsWith('temp_') || m.id.startsWith('msg_pending_')) {
                    if (m.content && item.content && m.content === item.content) return true;
                    if (m.media_data && item.media_data && (m.media_data === item.media_data || m.media_data.length === item.media_data.length)) return true;
                    if (m.msg_type === item.msg_type && timeDiff < 30) return true;
                }

                // 3. Sender & Content / Media deduplication within 30-second window (prevents duplicate bubbles from dual SSE + MeshRouter channels)
                const mPayload = m.media_data || m.content;
                const nPayload = normalizedItem.media_data || normalizedItem.content;
                if (mPayload && nPayload && (mPayload === nPayload || (mPayload.length > 60 && nPayload.length > 60 && mPayload.slice(0, 60) === nPayload.slice(0, 60))) && timeDiff < 30) {
                    if (m.is_mine && normalizedItem.is_mine) return true;
                    if (!m.is_mine && !normalizedItem.is_mine) {
                        const mSender = (m.sender || '').toLowerCase();
                        const nSender = (normalizedItem.sender || item.sender || '').toLowerCase();
                        if (mSender === nSender || mSender.startsWith(nSender.slice(0, 8)) || nSender.startsWith(mSender.slice(0, 8))) {
                            return true;
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

            if (typeof window !== 'undefined' && item.sender) {
                try {
                    const convId = item.conversation_id || item.sender;
                    const convKey = `red_web_messages_${convId}`;
                    const rawMsgs = localStorage.getItem(convKey);
                    const list: MessageItem[] = rawMsgs ? JSON.parse(rawMsgs) : [];
                    if (!list.some(m => m.id === item.id)) {
                        list.push(normalizedItem);
                        localStorage.setItem(convKey, JSON.stringify(list));
                    }
                    const rawConvs = localStorage.getItem('red_web_conversations');
                    const convs: ConversationItem[] = rawConvs ? JSON.parse(rawConvs) : [];
                    const idx = convs.findIndex(c => c.id === convId || c.peer === convId);
                    const convObj: ConversationItem = {
                        id: convId,
                        peer: item.sender,
                        last_message: item.content || 'Mensaje P2P',
                        last_timestamp: normTimestamp,
                        unread_count: 0
                    };
                    if (idx >= 0) {
                        convs[idx] = { ...convs[idx], ...convObj };
                    } else {
                        convs.unshift(convObj);
                    }
                    localStorage.setItem('red_web_conversations', JSON.stringify(convs));
                } catch {}
            }
            return;
        } else {
            if (typeof window !== 'undefined' && item.sender) {
                try {
                    const convId = item.conversation_id || item.sender;
                    const convKey = `red_web_messages_${convId}`;
                    const rawMsgs = localStorage.getItem(convKey);
                    const list: MessageItem[] = rawMsgs ? JSON.parse(rawMsgs) : [];
                    if (!list.some(m => m.id === item.id)) {
                        list.push(item as MessageItem);
                        localStorage.setItem(convKey, JSON.stringify(list));
                    }

                    const rawConvs = localStorage.getItem('red_web_conversations');
                    const convs: ConversationItem[] = rawConvs ? JSON.parse(rawConvs) : [];
                    const idx = convs.findIndex(c => c.id === convId || c.peer === convId);
                    const convObj: ConversationItem = {
                        id: convId,
                        peer: item.sender,
                        last_message: item.content || 'Mensaje P2P',
                        last_timestamp: item.timestamp || Date.now() / 1000,
                        unread_count: (convs[idx]?.unread_count || 0) + 1
                    };
                    if (idx >= 0) {
                        convs[idx] = { ...convs[idx], ...convObj };
                    } else {
                        convs.unshift(convObj);
                    }
                    localStorage.setItem('red_web_conversations', JSON.stringify(convs));
                    set({ conversations: convs });
                    get().fetchData().catch(() => {});
                } catch {}
            }
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
        let cleanName = display_name ? display_name.trim() : '';

        let cleanHash = inputStr;
        let pubKey: string | null = public_key ?? null;

        // 1. Parse did:red:<hash>:<pk> or did:red:<hash> or <hash>:<pk> or red_<shortId>
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
                if (parts.length >= 2 && parts[0].length >= 16) {
                    cleanHash = parts[0];
                    pubKey = parts[1];
                }
            }
        }

        // 2. Resolve canonical hash from meshRouter if input is a hardware device ID (BLE MAC / UUID)
        const canonicalFromMesh = meshRouter.getCanonicalId(cleanHash);
        if (canonicalFromMesh && canonicalFromMesh !== cleanHash && canonicalFromMesh.length >= 16) {
            cleanHash = canonicalFromMesh;
            const peerInfo = meshRouter.getPeerByAnyId(cleanHash);
            if (peerInfo?.publicKey && !pubKey) {
                pubKey = peerInfo.publicKey;
            }
        }

        if (!cleanName || cleanName === "Nuevo Par" || cleanName === "Operador RED") {
            cleanName = `Nodo ${cleanHash.slice(0, 8)}`;
        }

        const localContact = {
            identity_hash: cleanHash,
            display_name: cleanName,
            public_key: pubKey
        };

        // 3. Immediately update UI state with zero lag
        const currentContacts = get().contacts || [];
        const existingIdx = currentContacts.findIndex(c => 
            c.identity_hash?.toLowerCase() === cleanHash.toLowerCase() || 
            (cleanHash.length >= 8 && c.identity_hash?.toLowerCase().startsWith(cleanHash.slice(0, 8).toLowerCase())) ||
            (c.identity_hash?.length >= 8 && cleanHash.toLowerCase().startsWith(c.identity_hash.slice(0, 8).toLowerCase()))
        );
        let updatedContacts = [...currentContacts];
        if (existingIdx >= 0) {
            const currentEntry = updatedContacts[existingIdx];
            const isOldGeneric = !currentEntry.display_name || 
                currentEntry.display_name.startsWith('Operador ') || 
                currentEntry.display_name.startsWith('Nodo ') || 
                currentEntry.display_name.startsWith('Par Escaneado') || 
                currentEntry.display_name === 'Nuevo Par';
            const resolvedName = (isOldGeneric || (!cleanName.startsWith('Nodo ') && !cleanName.startsWith('Par Escaneado') && !cleanName.startsWith('Operador '))) ? cleanName : currentEntry.display_name;
            updatedContacts[existingIdx] = { ...currentEntry, ...localContact, display_name: resolvedName };
        } else {
            updatedContacts.push(localContact);
        }

        // 4. Ensure conversation entry exists in active chat list
        const currentConvs = get().conversations || [];
        let updatedConvs = [...currentConvs];
        if (!updatedConvs.some(c => c.id === cleanHash || c.peer === cleanHash)) {
            updatedConvs.unshift({
                id: cleanHash,
                peer: cleanHash,
                last_message: 'Contacto agregado. Chat P2P cifrado listo.',
                last_timestamp: Date.now() / 1000,
                unread_count: 0
            });
        }

        set({ contacts: updatedContacts, conversations: updatedConvs });

        // Save in localStorage WebStore for persistence across refreshes
        RedAPI.setWebStore('red_web_contacts', updatedContacts);
        RedAPI.setWebStore('red_web_conversations', updatedConvs);

        // 5. Proactively announce identity & initiate WebRTC P2P link over meshRouter
        meshRouter.sendIdentityAnnounce(cleanHash).catch(() => {});

        try {
            await RedAPI.addContact(cleanHash, cleanName, pubKey);
        } catch (err) {
            console.log(`[addContact] Local P2P contact registered: ${cleanHash.slice(0, 8)}`);
        }

        // 6. Send background contact request to peer so they automatically add us back!
        const myIdentity = get().identity;
        const myName = myIdentity?.nickname || 'Operador RED';
        if (myIdentity?.identity_hash) {
            _processedHandshakes.add(`${cleanHash.toLowerCase()}_res`);
            RedAPI.sendMessage(cleanHash, JSON.stringify({
                sender_hash: myIdentity.identity_hash,
                sender_name: myName,
                sender_pk: myIdentity.public_key || null
            }), { msg_type: 'contact_request' }).catch(() => {});
        }

        return cleanHash;
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
                reactions[emoji] = reactions[emoji].filter(id => id !== myHash);
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

    // ── Mark conversation as read (clear badge + notify Rust + send ACK) ───────
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
}));

if (typeof window !== 'undefined') {
    (window as any).__RED_STORE__ = useRedStore;
}
