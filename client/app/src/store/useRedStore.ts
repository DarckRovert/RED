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

    // P2P/Node Status
    nodeStatus: 'online' | 'offline';
    peers: LocalPeerEntry[];
    // FIX L1: declare setNodeStatus in the interface
    setNodeStatus: (s: 'online' | 'offline') => void;
    fetchPeers: () => Promise<void>; // FIX M4

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
    mutedConversations: Record<string, number>; // M12
    
    // Actions
    hydrateFromStorage: () => void;
    init: () => Promise<void>;
    loadNotifSettings: () => void;
    fetchConversations: () => Promise<void>;
    fetchGroups: () => Promise<void>;
    fetchContacts: () => Promise<void>;
    selectConversation: (id: string) => Promise<void>;
    sendMessage: (content: string, replyTo?: MessageItem, options?: any) => Promise<void>;
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

    nodeStatus: 'offline',
    peers: [],

    // FIX M4: fetch live peers from the backend node and update store
    fetchPeers: async () => {
        try {
            const rawPeers = await RedAPI.getPeers();
            const peers: LocalPeerEntry[] = rawPeers.map((p: any) => ({
                id: String(p.id),
                name: p.id ? String(p.id).substring(0, 8) : 'Unknown',
                transport: 'internet' as const,
                connected: p.is_connected ?? false,
                lastSeen: Date.now(),
                rssi: p.latency_ms,
            }));
            set({ peers, nodeStatus: peers.length > 0 ? 'online' : get().nodeStatus });
        } catch {
            // Backend not available — silently fail (don't break the UI)
        }
    },

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
    mutedConversations: {},

    setNodeStatus: (status) => set({ nodeStatus: status }),

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
        if (get().isLoading || get().conversations.length > 0) return; 
        set({ isLoading: true });

        let retries = 20;
        const connectLoop = async () => {
            try {
                const [identity, status] = await Promise.all([
                    RedAPI.getIdentity(),
                    RedAPI.getStatus(),
                ]);
                set({ identity, status, isLoading: false, error: null });

                // Start listening for real-time events
                RedAPI.subscribeToEvents((data) => {
                    get().addIncomingMessage(data);
                });

                // Initial fetch of data
                get().loadNotifSettings();
                await Promise.all([
                    get().fetchConversations(),
                    get().fetchGroups(),
                    get().fetchContacts()
                ]);
                set({ nodeStatus: 'online' });
                console.log('[RED] Successfully connected to Rust Node');
            } catch (err) {
                retries--;
                if (retries > 0) {
                    console.log(`[RED] Node not ready. Retrying in 500ms... (${retries} left)`);
                    setTimeout(connectLoop, 500);
                } else {
                    console.warn('[RED] Backend not reachable after 10s, setting offline identifiers');
                    const offlineIdentity = {
                        identity_hash: 'offline_mode',
                        short_id: 'Desconectado'
                    };
                    const offlineStatus = {
                        is_running: false,
                        peer_count: 0,
                        identity_hash: 'offline_mode',
                        version: '5.0.0'
                    };
                    set({ identity: offlineIdentity, status: offlineStatus, isLoading: false, error: "Nodo local Inaccesible" });
                }
            }
        };
        connectLoop();
    },

    loadNotifSettings: () => {
        if (typeof window === "undefined") return;
        const mutes: Record<string, number> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith("red_mute_")) {
                const convId = key.replace("red_mute_", "");
                const val = parseInt(localStorage.getItem(key) || "0");
                if (val !== 0) mutes[convId] = val;
            }
        }
        set({ mutedConversations: mutes });
    },

    fetchConversations: async () => {
        try {
            const conversations = await RedAPI.getConversations();
            set({ conversations });
            // Sync local timers map
            const timers: Record<string, number> = {};
            conversations.forEach(c => {
                if (c.disappearing_timer) timers[c.id] = c.disappearing_timer;
            });
            set({ disappearingTimers: { ...get().disappearingTimers, ...timers } });
        } catch (err) {
            set({ conversations: [] });
        }
    },

    fetchGroups: async () => {
        try {
            const groups = await RedAPI.getGroups();
            set({ groups });
        } catch (err) {
            set({ groups: [] });
        }
    },

    fetchContacts: async () => {
        try {
            const contacts = await RedAPI.getContacts();
            set({ contacts });
        } catch (err) {
            set({ contacts: [] });
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
            set({ messages: [], isLoading: false });
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

    sendMessage: async (content: string, replyTo?: MessageItem, options?: any) => {
        const { currentConversationId, conversations, identity } = get();
        if (!currentConversationId) return;

        const newMsg: MessageItem = {
            id: 'm' + Date.now(),
            sender: 'me',
            content,
            msg_type: options?.msg_type || 'text',
            timestamp: Date.now() / 1000,
            is_mine: true,
            reply_to: replyTo ? replyTo.id : undefined,
            media_data: options?.media_data,
            mime_type: options?.mime_type,
            width: options?.width,
            height: options?.height,
            duration_ms: options?.duration_ms,
            latitude: options?.latitude,
            longitude: options?.longitude,
            accuracy: options?.accuracy,
        };
        set({ messages: [...get().messages, newMsg], replyTarget: null });
        // Update last message in sidebar
        const snippet = newMsg.msg_type !== 'text' ? `[${newMsg.msg_type.toUpperCase()}]` : content;
        set({ conversations: get().conversations.map(c => c.id === currentConversationId ? { ...c, last_message: snippet, last_timestamp: newMsg.timestamp } : c) });

        try {
            const conv = conversations.find(c => c.id === currentConversationId);
            if (conv && identity) {
                // Ephemeral check
                const ttl = get().disappearingTimers[conv.id];
                if (ttl && ttl > 0) {
                    options = { ...options, expires_at: Date.now() + (ttl * 1000) };
                }

                const isGroup = get().groups.some(g => g.id === conv.peer);
                if (isGroup) {
                    await RedAPI.sendGroupMessage(conv.peer, content, { ...options, target_message_id: replyTo?.id });
                } else {
                    await RedAPI.sendMessage(conv.peer, content, { ...options, target_message_id: replyTo?.id });
                }
            }
        } catch {
            // Offline mode — msg stays as 'sent'
        }
    },

    sendMedia: async (file: File) => {
        const { currentConversationId } = get();
        if (!currentConversationId) return;
        const msg_type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'voice' : 'file';
        const reader = new FileReader();
        reader.onload = () => {
            const base64data = (reader.result as string).split(',')[1];
            get().sendMessage(file.name, undefined, {
                msg_type,
                media_data: base64data,
                mime_type: file.type
            });
        };
        reader.readAsDataURL(file);
    },

    deleteMessage: (msgId: string) => {
        set({ messages: get().messages.map(m => m.id === msgId ? { ...m, isDeleted: true, content: '' } : m) });
        const { currentConversationId, conversations } = get();
        if (currentConversationId) {
            const conv = conversations.find(c => c.id === currentConversationId);
            if (conv) {
                const isGroup = get().groups.some(g => g.id === conv.peer);
                if (isGroup) {
                    RedAPI.sendGroupMessage(conv.peer, "", { msg_type: "delete", target_message_id: msgId }).catch(() => {});
                } else {
                    RedAPI.sendMessage(conv.peer, "", { msg_type: "delete", target_message_id: msgId }).catch(() => {});
                }
            }
        }
    },

    reactToMessage: (msgId: string, emoji: string) => {
        set({
            messages: get().messages.map(m => {
                if (m.id !== msgId) return m;
                const existing = m.reactions?.find(r => r.emoji === emoji);
                if (existing) {
                    const updated = m.reactions!.map(r => r.emoji === emoji ? { ...r, senders: r.senders.filter(s => s !== 'me') } : r).filter(r => r.senders.length > 0);
                    return { ...m, reactions: updated };
                } else {
                    return { ...m, reactions: [...(m.reactions || []), { emoji, senders: ['me'] }] };
                }
            })
        });
        const { currentConversationId, conversations } = get();
        if (currentConversationId) {
            const conv = conversations.find(c => c.id === currentConversationId);
            if (conv) {
                const isGroup = get().groups.some(g => g.id === conv.peer);
                if (isGroup) {
                    RedAPI.sendGroupMessage(conv.peer, emoji, { msg_type: "reaction", target_message_id: msgId }).catch(() => {});
                } else {
                    RedAPI.sendMessage(conv.peer, emoji, { msg_type: "reaction", target_message_id: msgId }).catch(() => {});
                }
            }
        }
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
        const { conversations } = get();
        const conv = conversations.find(c => c.id === convId);
        if (conv) {
             const isGroup = get().groups.some(g => g.id === conv.peer);
             if (isGroup) {
                 RedAPI.sendGroupMessage(conv.peer, "true", { msg_type: "typing" }).catch(() => {});
             } else {
                 RedAPI.sendMessage(conv.peer, "true", { msg_type: "typing" }).catch(() => {});
             }
        }
    },

    toggleStarMessage: (msg: MessageItem) => {
        const { starredMessages } = get();
        const isStarred = starredMessages.some(m => m.id === msg.id);
        const updated = isStarred ? starredMessages.filter(m => m.id !== msg.id) : [...starredMessages, msg];
        set({ starredMessages: updated });
    },

    // FIX L4: forwardMessage now correctly sets currentConversationId before sending
    forwardMessage: (msg: MessageItem, targetConvId: string) => {
        const { conversations, currentConversationId } = get();
        const targetConv = conversations.find(c => c.id === targetConvId);
        if (targetConv) {
            const prevConvId = currentConversationId;
            // Temporarily switch to target conversation so sendMessage sends to the right peer
            set({ currentConversationId: targetConvId });
            get().sendMessage(msg.content, undefined, {
                msg_type: msg.msg_type,
                media_data: msg.media_data,
                mime_type: msg.mime_type
            }).finally(() => {
                // Restore original conversation
                set({ currentConversationId: prevConvId });
            });
        }
    },

    setDisappearingTimer: async (convId: string, seconds: number) => {
        const { conversations } = get();
        const conv = conversations.find(c => c.id === convId);
        if (!conv) return;

        set({ disappearingTimers: { ...get().disappearingTimers, [convId]: seconds } });
        
        try {
            // Notify peer/group about the timer change
            await RedAPI.sendMessage(conv.peer, seconds.toString(), { msg_type: "timer_update" });
            console.log(`Disappearing timer set to ${seconds}s for convId ${convId}`);
        } catch (err) {
            console.error("Failed to sync timer update to node", err);
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


    // FIX L3: addContact now correctly calls POST /api/contacts instead of sending a message
    addContact: async (identityHash: string, displayName: string) => {
        try {
            await RedAPI.addContact(identityHash, displayName);
            await get().fetchContacts();
        } catch (err) {
            console.warn('Backend not reached, adding contact to local state');
            const newContact = { id: Math.random().toString(36), identity_hash: identityHash, displayName };
            set({ contacts: [...get().contacts, newContact] });

            // Also create a placeholder conversation for the new contact
            const newConv: ConversationItem = {
                id: 'conv_' + identityHash,
                peer: displayName,
                message_count: 0,
                last_message: null,
                last_timestamp: Date.now() / 1000,
                unread_count: 0
            };
            set({ conversations: [newConv, ...get().conversations] });
        }
    },

    createGroup: async (name: string) => {
        try {
            const newGroup = await RedAPI.createGroup(name);
            set({ groups: [newGroup, ...get().groups] });
        } catch (err) {
            set({ error: (err as Error).message });
        }
    },

    addIncomingMessage: (data: any) => {
        const { currentConversationId, messages } = get();

        // The Rust SSE now yields `message_item` containing the full rich media map
        const item: MessageItem | undefined = data.message_item;

        if (item?.msg_type === 'typing') {
             // We can locate the conversation by sender
             const conv = get().conversations.find(c => c.peer === data.from || c.id.includes(data.from));
             if (conv) {
                 get().setIsTyping(conv.id, item.content === 'true');
             }
             return;
        }

        if (item?.msg_type === 'timer_update') {
             const conv = get().conversations.find(c => c.peer === data.from || c.id.includes(data.from));
             if (conv) {
                 // Update the local state silently
                 set({ disappearingTimers: { ...get().disappearingTimers, [conv.id]: parseInt(item.content) || 0 }});
             }
             return;
        }

        if (item?.msg_type === 'read_receipt') {
             // Future: Update message status to 'read' (blue double check)
             return;
        }

        if (item?.msg_type === 'reaction' && item.target_message_id) {
            set({
                messages: get().messages.map(m => {
                    if (m.id !== item.target_message_id) return m;
                    const emoji = item.content;
                    const existing = m.reactions?.find(r => r.emoji === emoji);
                    if (existing) {
                        return { ...m, reactions: m.reactions?.map(r => r.emoji === emoji ? { ...r, senders: [...new Set([...r.senders, data.from])] } : r) };
                    } else {
                        return { ...m, reactions: [...(m.reactions || []), { emoji, senders: [data.from] }] };
                    }
                })
            });
            return;
        }

        const newMessage: MessageItem = item || {
            id: Math.random().toString(36).substring(7),
            sender: data.from,
            content: data.content,
            msg_type: 'text',
            timestamp: data.timestamp,
            is_mine: false
        };

        if (currentConversationId) {
            set({ messages: [...messages, newMessage] });
        } else {
            // Check if muted before notifying
            const muteUntil = get().mutedConversations[data.from];
            const isMuted = muteUntil !== undefined && (muteUntil === -1 || muteUntil > Date.now());
            
            if (!isMuted) {
                // Background message notification
                set({
                    notification: {
                        title: "Nuevo mensaje de " + data.from.substring(0, 8),
                        message: data.content.length > 30 ? data.content.substring(0, 30) + "..." : data.content
                    }
                });
            }
        }
        get().fetchConversations();
    },

    clearNotification: () => {
        set({ notification: null });
    },

    setSearchQuery: (query: string) => {
        set({ searchQuery: query });
    },

    // FIX A6: scheduleMessage captures convId in the closure and uses it correctly
    scheduleMessage: (convId: string, content: string, sendAt: number) => {
        const id = 'sched_' + Date.now();
        const entry = { id, convId, content, sendAt };
        set({ scheduledMessages: [...get().scheduledMessages, entry] });
        const delay = sendAt - Date.now();
        if (delay > 0) {
            setTimeout(() => {
                // Check the scheduled message still exists (not cancelled)
                const still = get().scheduledMessages.find(s => s.id === id);
                if (!still) return;
                // Temporarily switch to the right conversation, send, then restore
                const prevConvId = get().currentConversationId;
                set({ currentConversationId: convId });
                get().sendMessage(content).finally(() => {
                    set({
                        currentConversationId: prevConvId,
                        scheduledMessages: get().scheduledMessages.filter(s => s.id !== id)
                    });
                });
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
