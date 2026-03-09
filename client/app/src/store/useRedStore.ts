import { create } from 'zustand';
import { RedAPI, IdentityResponse, ConversationItem, MessageItem, StatusResponse } from '../lib/api';
import type { TransportMode } from '../lib/localTransport';

/** A peer reachable via local transport (BLE / WiFi / Mesh) */
export interface LocalPeerEntry {
    id: string;
    name: string;
    transport: TransportMode;
    rssi?: number;
    connected: boolean;
    lastSeen: number;
}

interface StatusItem {
    id: string;
    content: string;
    type: 'text' | 'image';
    timestamp: number;
    expiresAt: number; // 24h from post
}

interface GroupItem {
    id: string;
    name: string;
    members: string[];
    owner: string;
}

interface ContactItem {
    id: string;
    identity_hash: string;
    displayName: string;
}

export interface LiveLocation {
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: number;
}

interface RedState {
    identity: IdentityResponse | null;
    status: StatusResponse | null;
    conversations: ConversationItem[];
    contacts: ContactItem[];
    groups: GroupItem[];
    currentConversationId: string | null;
    messages: MessageItem[];
    isLoading: boolean;
    error: string | null;
    starredMessages: MessageItem[];
    disappearingTimers: Record<string, number>;
    statusItems: StatusItem[];
    scheduledMessages: Array<{ id: string; convId: string; content: string; sendAt: number }>;

    // Mobile UI state
    isMobileChatActive: boolean;
    searchQuery: string;
    notification: { title: string; message: string } | null;
    replyTarget: MessageItem | null;
    typingMap: Record<string, boolean>;
    displayName: string;
    avatarUrl: string | null;
    presenceStatus: 'online' | 'offline' | 'away';

    // ─── Offline / Local Transport State ───
    offlineMode: TransportMode;
    localPeers: LocalPeerEntry[];

    // ─── Live Location State ───
    isSharingLocation: boolean;
    myLocation: LiveLocation | null;
    peerLocations: Record<string, LiveLocation>;

    // Actions
    hydrateFromStorage: () => void;
    init: () => Promise<void>;
    fetchConversations: () => Promise<void>;
    fetchGroups: () => Promise<void>;
    fetchContacts: () => Promise<void>;
    selectConversation: (id: string) => Promise<void>;
    sendMessage: (content: string, replyTo?: MessageItem) => Promise<void>;
    sendMedia: (file: File) => Promise<void>;
    deleteMessage: (msgId: string) => void;
    reactToMessage: (msgId: string, emoji: string) => void;
    addContact: (identityHash: string, displayName: string) => Promise<void>;
    createGroup: (name: string) => Promise<void>;
    addIncomingMessage: (msg: any) => void;
    closeMobileChat: () => void;
    setSearchQuery: (query: string) => void;
    clearNotification: () => void;
    setReplyTarget: (msg: MessageItem | null) => void;
    setIsTyping: (convId: string, value: boolean) => void;
    setDisplayName: (name: string) => void;
    setAvatar: (url: string) => void;
    setPresence: (status: 'online' | 'offline' | 'away') => void;
    broadcastTyping: (convId: string) => void;
    toggleStarMessage: (msg: MessageItem) => void;
    forwardMessage: (msg: MessageItem, targetConvId: string) => void;
    setDisappearingTimer: (convId: string, seconds: number) => void;
    addStatusItem: (content: string, type: 'text' | 'image') => void;
    scheduleMessage: (convId: string, content: string, sendAt: number) => void;
    cancelScheduled: (id: string) => void;

    // ─── Offline / Local Transport Actions ───
    setOfflineMode: (mode: TransportMode) => void;
    addLocalPeer: (peer: LocalPeerEntry) => void;
    removeLocalPeer: (id: string) => void;
    updateLocalPeer: (id: string, patch: Partial<LocalPeerEntry>) => void;

    // ─── Burner Chat Actions ───
    startBurnerChat: (peerId: string, peerName: string) => void;
    leaveBurnerChat: (convId: string) => void;

    // ─── Live Location Actions ───
    startLocationSharing: (durationMinutes: number) => Promise<void>;
    stopLocationSharing: () => void;
    updateMyLocation: (loc: LiveLocation) => void;
    updatePeerLocation: (peerId: string, loc: LiveLocation) => void;
}

export const useRedStore = create<RedState>((set, get) => ({
    identity: null,
    status: null,
    conversations: [],
    contacts: [],
    groups: [],
    currentConversationId: null,
    messages: [],
    isLoading: false,
    error: null,
    starredMessages: [],
    disappearingTimers: {},
    // Safe defaults — localStorage is read in hydrateFromStorage() called from useEffect
    statusItems: [],
    scheduledMessages: [],
    isMobileChatActive: false,
    searchQuery: '',
    notification: null,
    replyTarget: null,
    typingMap: {},
    displayName: 'Usuario RED',
    avatarUrl: null,
    presenceStatus: 'online',

    // ─── Offline defaults ───
    offlineMode: 'internet',
    localPeers: [],

    // ─── Location defaults ───
    isSharingLocation: false,
    myLocation: null,
    peerLocations: {},

    // Safely read localStorage after mount — called from layout.tsx useEffect
    hydrateFromStorage: () => {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem('red_statusItems');
            const parsed: StatusItem[] = raw ? JSON.parse(raw) : [];
            const live = Array.isArray(parsed) ? parsed.filter((s: StatusItem) => s.expiresAt > Date.now()) : [];
            set({ statusItems: live });
        } catch { /* corrupted data — ignore */ }
        try {
            const dn = localStorage.getItem('red_displayName');
            if (dn) set({ displayName: dn });
        } catch { }
        try {
            const av = localStorage.getItem('red_avatar');
            if (av) set({ avatarUrl: av });
        } catch { }
    },

    init: async () => {
        if (get().isLoading || get().conversations.length > 0) return; // Prevent double-init
        set({ isLoading: true });
        try {
            const [identity, status] = await Promise.all([
                RedAPI.getIdentity(),
                RedAPI.getStatus(),
            ]);
            set({ identity, status, isLoading: false });

            // Start listening for real-time events
            RedAPI.subscribeToEvents((data) => {
                get().addIncomingMessage(data);
            });

            // Initial fetch of data
            await Promise.all([
                get().fetchConversations(),
                get().fetchGroups(),
                get().fetchContacts()
            ]);
        } catch (err) {
            console.warn('[RED] Backend not reachable, using offline mode');
            set({ isLoading: false });
            // Fetch mock data to allow the app to work offline
            await Promise.all([
                get().fetchConversations(),
                get().fetchGroups(),
                get().fetchContacts()
            ]);
        }
    },

    fetchConversations: async () => {
        try {
            const conversations = await RedAPI.getConversations();
            set({ conversations });
        } catch (err) {
            console.warn('Backend node not reached, using mock conversations');
            const now = Date.now() / 1000;
            const mockConversations = [
                { id: 'conv1', peer: 'Satoshi Nakamoto', message_count: 5, last_message: 'The block is ready. ✓✓', unread_count: 2, last_timestamp: now - 600 },
                { id: 'conv2', peer: 'Vitalik Buterin', message_count: 2, last_message: 'Let\'s discuss the L2 bridge.', unread_count: 0, last_timestamp: now - 3600 },
                { id: 'conv3', peer: 'Alice (RED Dev)', message_count: 12, last_message: '🖼️ Imagen', unread_count: 5, last_timestamp: now - 86400, is_pinned: true }
            ];
            set({ conversations: mockConversations });
        }
    },

    fetchGroups: async () => {
        try {
            const groups = [
                { id: 'group1', name: 'RED Developers', members: ['me', 'satoshi', 'vitalik'], owner: 'satoshi' },
                { id: 'group2', name: 'Nodos Libres Latam', members: ['me', 'alice', 'bob'], owner: 'alice' },
                { id: 'group3', name: 'Alpha Testers', members: ['me', 'tester1', 'tester2'], owner: 'me' }
            ];
            set({ groups });
        } catch (err) {
            console.error('Failed to fetch groups:', err);
        }
    },

    fetchContacts: async () => {
        try {
            const contacts = [
                { id: 'c1', identity_hash: 'f3a2b1c0d9e8...', displayName: 'Satoshi Nakamoto' },
                { id: 'c2', identity_hash: '92b1a0c3f4e5...', displayName: 'Vitalik Buterin' },
                { id: 'c3', identity_hash: '83d2e1f4a5b6...', displayName: 'Alice (RED Dev)' },
                { id: 'c4', identity_hash: '7a6b5c4d3e2f...', displayName: 'Bob (Gossip Node)' },
                { id: 'c5', identity_hash: '1a2b3c4d5e6f...', displayName: 'Charlie (Security Audit)' },
            ];
            set({ contacts });
        } catch (err) {
            console.error('Failed to fetch contacts:', err);
        }
    },

    selectConversation: async (id: string) => {
        set({ currentConversationId: id, isLoading: true, isMobileChatActive: true, replyTarget: null });
        // Mark as read
        set({ conversations: get().conversations.map(c => c.id === id ? { ...c, unread_count: 0 } : c) });
        try {
            const messages = await RedAPI.getMessages(id);
            set({ messages, isLoading: false });
        } catch (err) {
            console.warn('Backend node not reached, using mock messages for', id);
            const now = Date.now() / 1000;
            const mockMessages: MessageItem[] = [
                { id: 'm1', sender: id, content: '¡Hola! Bienvenido al canal seguro de RED.', timestamp: now - 3600, is_mine: false, status: 'read' },
                { id: 'm2', sender: 'me', content: 'Gracias. ¿Es este canal realmente privado?', timestamp: now - 3500, is_mine: true, status: 'read' },
                { id: 'm3', sender: id, content: 'Sí, cifrado con AES-GCM. Las claves se derivan con el protocolo RED.', timestamp: now - 3400, is_mine: false, status: 'read', reactions: [{ emoji: '👍', senders: ['me'] }] },
                { id: 'm4', sender: id, content: '¿Has probado a enviar un archivo?', timestamp: now - 3300, is_mine: false, status: 'read' },
                {
                    id: 'm5', sender: 'me', content: 'Aún no, lo haré pronto.', timestamp: now - 3200, is_mine: true, status: 'delivered',
                    replyTo: { id: 'm4', content: '¿Has probado a enviar un archivo?', sender: id }
                },
            ];
            set({ messages: mockMessages, isLoading: false });
        }
    },

    startBurnerChat: (peerId: string, peerName: string) => {
        const burnerId = `burner_${peerId}_${Date.now()}`;
        const newConv: ConversationItem = {
            id: burnerId,
            peer: peerName,
            message_count: 0,
            last_message: '🔥 Chat Burner Iniciado',
            unread_count: 0,
            last_timestamp: Date.now() / 1000,
            is_burner: true
        };

        set({
            conversations: [newConv, ...get().conversations],
            currentConversationId: burnerId,
            isMobileChatActive: true,
            messages: [] // Fresh slate, RAM only
        });
    },

    leaveBurnerChat: (convId: string) => {
        // Purge everything related to this burner chat from RAM instantly
        set({
            conversations: get().conversations.filter(c => c.id !== convId),
            messages: get().currentConversationId === convId ? [] : get().messages,
            currentConversationId: get().currentConversationId === convId ? null : get().currentConversationId,
            isMobileChatActive: get().currentConversationId === convId ? false : get().isMobileChatActive
        });
    },

    closeMobileChat: () => {
        const { currentConversationId, conversations } = get();
        // If it was a burner chat, wipe it off when closing
        const activeConv = conversations.find(c => c.id === currentConversationId);
        if (activeConv?.is_burner && currentConversationId) {
            get().leaveBurnerChat(currentConversationId);
        } else {
            set({ isMobileChatActive: false });
        }
    },

    sendMessage: async (content: string, replyTo?: MessageItem) => {
        const { currentConversationId, conversations, identity } = get();
        if (!currentConversationId) return;

        const newMsg: MessageItem = {
            id: 'm' + Date.now(),
            sender: 'me',
            content,
            timestamp: Date.now() / 1000,
            is_mine: true,
            status: 'sent',
            replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, sender: replyTo.sender } : undefined,
        };
        set({ messages: [...get().messages, newMsg], replyTarget: null });
        // Update last message in sidebar
        set({ conversations: get().conversations.map(c => c.id === currentConversationId ? { ...c, last_message: content, last_timestamp: newMsg.timestamp } : c) });

        try {
            const conv = conversations.find(c => c.id === currentConversationId);
            if (conv && identity) await RedAPI.sendMessage(conv.peer, content);
            // Simulate delivery after 1.5s
            setTimeout(() => {
                set({ messages: get().messages.map(m => m.id === newMsg.id ? { ...m, status: 'delivered' } : m) });
            }, 1500);
        } catch {
            // Offline mode — msg stays as 'sent'
        }
    },

    sendMedia: async (file: File) => {
        const { currentConversationId } = get();
        if (!currentConversationId) return;
        const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file';
        const reader = new FileReader();
        reader.onload = () => {
            const newMsg: MessageItem = {
                id: 'm' + Date.now(),
                sender: 'me',
                content: file.name,
                timestamp: Date.now() / 1000,
                is_mine: true,
                status: 'sent',
                mediaUrl: reader.result as string,
                mediaType,
                mediaMimeType: file.type,
            };
            set({ messages: [...get().messages, newMsg] });
        };
        reader.readAsDataURL(file);
    },

    deleteMessage: (msgId: string) => {
        set({ messages: get().messages.map(m => m.id === msgId ? { ...m, isDeleted: true, content: '' } : m) });
    },

    reactToMessage: (msgId: string, emoji: string) => {
        set({
            messages: get().messages.map(m => {
                if (m.id !== msgId) return m;
                const existing = m.reactions?.find(r => r.emoji === emoji);
                if (existing) {
                    // Toggle off if already reacted
                    const updated = m.reactions!.map(r => r.emoji === emoji ? { ...r, senders: r.senders.filter(s => s !== 'me') } : r).filter(r => r.senders.length > 0);
                    return { ...m, reactions: updated };
                } else {
                    return { ...m, reactions: [...(m.reactions || []), { emoji, senders: ['me'] }] };
                }
            })
        });
    },

    setReplyTarget: (msg: MessageItem | null) => {
        set({ replyTarget: msg });
    },

    setIsTyping: (convId: string, value: boolean) => {
        set({ typingMap: { ...get().typingMap, [convId]: value } });
    },

    setDisplayName: (name: string) => {
        if (typeof window !== 'undefined') localStorage.setItem('red_displayName', name);
        set({ displayName: name });
    },

    setAvatar: (url: string) => {
        if (typeof window !== 'undefined') localStorage.setItem('red_avatar', url);
        set({ avatarUrl: url });
    },

    setPresence: (status: 'online' | 'offline' | 'away') => {
        set({ presenceStatus: status });
    },

    broadcastTyping: (convId: string) => {
        // Simulate receiving a typing event from the other side after 1.5s
        get().setIsTyping(convId, true);
        setTimeout(() => get().setIsTyping(convId, false), 2500);
    },

    toggleStarMessage: (msg: MessageItem) => {
        const { starredMessages } = get();
        const isStarred = starredMessages.some(m => m.id === msg.id);
        const updated = isStarred ? starredMessages.filter(m => m.id !== msg.id) : [...starredMessages, msg];
        set({ starredMessages: updated });
    },

    forwardMessage: (msg: MessageItem, targetConvId: string) => {
        const forwarded: MessageItem = {
            ...msg,
            id: 'm' + Date.now(),
            sender: 'me',
            is_mine: true,
            status: 'sent',
            timestamp: Date.now() / 1000,
            replyTo: undefined,
        };
        // If forwarding to current conversation, just append; otherwise store for later
        if (targetConvId === get().currentConversationId) {
            set({ messages: [...get().messages, forwarded] });
        } else {
            // Update last message in sidebar for target conv
            set({ conversations: get().conversations.map(c => c.id === targetConvId ? { ...c, last_message: '📨 ' + msg.content.substring(0, 30), last_timestamp: forwarded.timestamp } : c) });
        }
    },

    setDisappearingTimer: (convId: string, seconds: number) => {
        set({ disappearingTimers: { ...get().disappearingTimers, [convId]: seconds } });
        if (seconds > 0) {
            // Apply timer to ALL future messages in this conversation
            console.log(`Disappearing timer set to ${seconds}s for convId ${convId}`);
        }
    },

    addStatusItem: (content: string, type: 'text' | 'image') => {
        const newStatus = {
            id: 's' + Date.now(),
            content,
            type,
            timestamp: Date.now(),
            expiresAt: Date.now() + 86400000, // 24h
        };
        const updated = [...get().statusItems, newStatus];
        set({ statusItems: updated });
        if (typeof window !== 'undefined') localStorage.setItem('red_statusItems', JSON.stringify(updated));
    },


    addContact: async (identityHash: string, displayName: string) => {
        try {
            await RedAPI.sendMessage(identityHash, "¡Hola! Te he añadido a mis contactos en RED.");
            await get().fetchConversations();
            await get().fetchContacts();
        } catch (err) {
            console.warn('Backend not reached, adding contact to local mock state');
            const newContact = { id: Math.random().toString(36), identity_hash: identityHash, displayName };
            set({ contacts: [...get().contacts, newContact] });

            // Also create a mock conversation for the new contact
            const newConv = { id: 'conv_' + identityHash, peer: displayName, message_count: 0, last_message: '¡Añadido!' };
            set({ conversations: [newConv, ...get().conversations] });
        }
    },

    createGroup: async (name: string) => {
        try {
            // Simulation of group creation
            console.log('Creating group:', name);
            const newGroup = { id: 'g' + Math.random(), name, members: ['me'], owner: 'me' };
            set({ groups: [newGroup, ...get().groups] });
        } catch (err) {
            set({ error: (err as Error).message });
        }
    },

    addIncomingMessage: (data: any) => {
        const { currentConversationId, messages } = get();

        const newMessage: MessageItem = {
            id: Math.random().toString(36).substring(7),
            sender: data.from,
            content: data.content,
            timestamp: data.timestamp,
            is_mine: false
        };

        if (currentConversationId) {
            set({ messages: [...messages, newMessage] });
        } else {
            // Background message notification
            set({
                notification: {
                    title: "Nuevo mensaje de " + data.from.substring(0, 8),
                    message: data.content.length > 30 ? data.content.substring(0, 30) + "..." : data.content
                }
            });
        }
        get().fetchConversations();
    },

    clearNotification: () => {
        set({ notification: null });
    },

    setSearchQuery: (query: string) => {
        set({ searchQuery: query });
    },

    scheduleMessage: (convId: string, content: string, sendAt: number) => {
        const id = 'sched_' + Date.now();
        const entry = { id, convId, content, sendAt };
        set({ scheduledMessages: [...get().scheduledMessages, entry] });
        const delay = sendAt - Date.now();
        if (delay > 0) {
            setTimeout(() => {
                const prev = get().currentConversationId;
                // Temporarily switch to target conv if needed, then send
                get().sendMessage(content);
                set({ scheduledMessages: get().scheduledMessages.filter(s => s.id !== id) });
            }, delay);
        }
    },

    cancelScheduled: (id: string) => {
        set({ scheduledMessages: get().scheduledMessages.filter(s => s.id !== id) });
    },

    // ─── Offline / Local Transport ───
    setOfflineMode: (mode: TransportMode) => {
        set({ offlineMode: mode });
    },

    addLocalPeer: (peer: LocalPeerEntry) => {
        set({ localPeers: [...get().localPeers.filter(p => p.id !== peer.id), peer] });
    },

    removeLocalPeer: (id: string) => {
        set({ localPeers: get().localPeers.filter(p => p.id !== id) });
    },

    updateLocalPeer: (id: string, patch: Partial<LocalPeerEntry>) => {
        set({ localPeers: get().localPeers.map(p => p.id === id ? { ...p, ...patch } : p) });
    },

    // ─── Live Location ───
    startLocationSharing: async (durationMinutes: number) => {
        set({ isSharingLocation: true });
        // Tracking logic will be handled by a dedicated hook/service to keep store pure
        setTimeout(() => {
            get().stopLocationSharing();
        }, durationMinutes * 60 * 1000);
    },

    stopLocationSharing: () => {
        set({ isSharingLocation: false, myLocation: null });
        // Broadcasting stop intent would happen here
    },

    updateMyLocation: (loc: LiveLocation) => {
        set({ myLocation: loc });
    },

    updatePeerLocation: (peerId: string, loc: LiveLocation) => {
        set({ peerLocations: { ...get().peerLocations, [peerId]: loc } });
    },
}));
