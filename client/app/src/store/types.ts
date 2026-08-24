// RED 2.0 Store Types & Protocol Contracts

import {
    IdentityResponse, StatusResponse, ConversationItem, ContactItem,
    GroupItem, MessageItem, SosBeacon, WeatherReport, ChannelMessage,
    VoiceBurst, SocialPost
} from '../api/types';
import { UserPreferences } from '../lib/settingsManager';

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

// ── P2P Contact Authorization ──────────────────────────────────────────────────
export interface PendingContactRequest {
    id: string;           // unique request id
    senderHash: string;
    senderName: string;
    senderPk: string | null;
    channel: string;      // 'BLE' | 'Mesh' | 'WiFi' | 'QR'
    timestamp: number;
    avatarUrl?: string | null;
    bio?: string | null;
}


/**
 * RED 2.0 SPA Store.
 * Central hub for memory and UI View routing (No next/router).
 */

export type ScreenView = 'sidebar' | 'commandCenter' | 'chat' | 'settings' | 'updater' | 'status' | 'crypto' | 'broadcast' | 'radar' | 'contacts' | 'call' | 'nodemap' | 'explorer' | 'network' | 'dms' | 'amber' | 'amberAdmin' | 'guardian' | 'compass' | 'channels' | 'publicChannels' | 'sos' | 'walkie' | 'weather' | 'weatherAlert' | 'idVault' | 'identityVault' | 'proximity' | 'proximityWave' | 'canvas' | 'liveCanvas' | 'ecoMesh' | 'proximitySettings' | 'proximity_settings' | 'aiCopilot' | 'copilot' | 'nearby' | 'liveStream' | 'offGridCompass' | 'vitalScan' | 'survivalBeacon' | 'rfSpectrum' | 'stegoVault' | 'security' | 'groups' | 'p2pCompass' | 'socialFeed' | 'shakePair' | 'p2pPay' | 'redP2PPay' | 'blackout' | 'health' | 'systemHealth' | 'nodeLogs' | 'logs' | 'calculator' | 'secReport' | 'backup' | 'landing' | 'commercialHub' | 'hub' | 'globalShield' | 'web3Vault' | 'webCompanionLink' | 'companionLink';

export interface RedStore {
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
    restoreCompanionVault: (payload: any) => Promise<boolean>;
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
    addContact:   (identity_hash: string, display_name: string, public_key?: string | null) => Promise<string>;
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
    incomingCall: { callerHash: string; callerName: string; offer: any; callType: 'audio' | 'video'; callId?: string } | null;
    activeCallOffer: any | null;
    activeCallSignal: { senderHash: string; signal: any } | null;
    callSignalQueue: { senderHash: string; signal: any; timestamp: number }[];
    activeCallType: 'audio' | 'video';
    activeCallPeer: string | null;
    activeCallId: string | null;
    setActiveCallId: (id: string | null) => void;
    setActiveCallPeer: (peer: string | null) => void;
    setActiveCallType: (type: 'audio' | 'video') => void;
    setActiveCallOffer: (offer: any | null) => void;
    setIncomingCall: (call: { callerHash: string; callerName: string; offer: any; callType: 'audio' | 'video'; callId?: string } | null) => void;
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
    pendingChatNavigation: string | null;
    setPendingChatNavigation: (target: string | null) => void;

    // ── Contact Authorization, Blocking & Deletion ─────────────────────────────
    pendingContactRequests: PendingContactRequest[];
    blockedNodes: string[];
    activeContactRequestModal: PendingContactRequest | null;
    acceptContactRequest: (req: PendingContactRequest) => Promise<void>;
    rejectContactRequest: (req: PendingContactRequest) => void;
    blockNode: (hash: string) => void;
    unblockNode: (hash: string) => void;
    deleteContact: (hash: string) => Promise<void>;
    dismissContactRequestModal: () => void;
}

/** Screens that act as overlays and must NOT clear activeConversationId */
const OVERLAY_SCREENS = new Set<ScreenView>([
    'sos', 'aiCopilot', 'proximity', 'canvas', 'walkie', 'weather',
    'proximitySettings', 'radar', 'contacts', 'settings', 'updater', 'nodemap',
    'compass', 'idVault', 'amber', 'guardian', 'channels', 'crypto',
    'network', 'explorer', 'nearby', 'liveStream', 'status', 'broadcast', 'call',
    'security', 'groups', 'p2pCompass', 'socialFeed', 'shakePair', 'p2pPay', 'blackout', 'health', 'nodeLogs', 'calculator', 'secReport', 'backup', 'commercialHub', 'hub', 'webCompanionLink', 'companionLink'
]);

