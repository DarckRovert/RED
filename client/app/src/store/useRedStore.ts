import { create } from 'zustand';
import { RedAPI, IdentityResponse, ConversationItem, MessageItem, StatusResponse } from '../lib/api';
import { localTransport } from '../lib/mesh/localTransport';

/**
 * RED 2.0 SPA Store.
 * Central hub for memory and UI View routing (No next/router).
 */

export type ScreenView = 'sidebar' | 'chat' | 'settings' | 'status' | 'crypto' | 'broadcast' | 'radar' | 'contacts' | 'call' | 'nodemap' | 'groupAdmin' | 'explorer' | 'network';

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
    sendMessage: (content: string, options?: Record<string, any>) => Promise<void>;
    addIncomingMessage: (rawEvent: any) => void;
    addContact: (identity_hash: string, display_name: string) => Promise<boolean>;
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
    
    // We start displaying the sidebar (contacts/chats list)
    currentScreen: 'sidebar',
    activeConversationId: null,

    // Navigation mechanism for SPA
    navigate: (screen: ScreenView, contextId?: string) => {
        if (screen === 'chat' && contextId) {
            set({ currentScreen: screen, activeConversationId: contextId, messages: [] });
            RedAPI.getMessages(contextId).then(msgs => set({ messages: msgs }));
        } else {
            set({ currentScreen: screen });
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
            // Give the node time to boot the Axum server (3s is more reliable than 1s
            // since key derivation + first-time storage setup takes ~2 seconds)
            await new Promise(r => setTimeout(r, 3000));
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
        let retries = 60; // Increased to 60 (1 minute) for mobile PoW / slow boots
        console.log("[RED] Initializing Node Connection...");
        while (retries > 0) {
            try {
                if (retries % 5 === 0) console.log(`[RED] Polling Rust API... (${60 - retries}s elapsed)`);
                const [identity, status] = await Promise.all([
                    RedAPI.getIdentity(),
                    RedAPI.getStatus(),
                ]);
                
                set({ identity, status, nodeOnline: true });
                console.log("[RED] Attached to Rust Node Natively:", identity.short_id);
                
                await get().fetchData();
                
                // Realtime events
                RedAPI.subscribeToEvents((data) => {
                    get().addIncomingMessage(data);
                });
                
                // Wake up Offline Mesh Radar
                localTransport.init(identity.short_id);
                localTransport.startBackgroundSensing();
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
        const { activeConversationId, conversations } = get();
        if (!activeConversationId) return;

        const conv = conversations.find(c => c.id === activeConversationId);
        if (!conv) return;

        // Optimistic UI update
        const tempMsg: MessageItem = {
            id: 'temp_' + Date.now(),
            sender: 'me',
            content,
            timestamp: Date.now() / 1000,
            is_mine: true,
            msg_type: options?.msg_type || 'text',
            media_data: options?.media_data
        };
        set({ messages: [...get().messages, tempMsg] });

        try {
            await RedAPI.sendMessage(conv.peer, content, options);
        } catch (e) {
            console.error("Message send failed natively", e);
        }
    },

    addIncomingMessage: (data: any) => {
        const item = data.message_item;
        if (!item) return;

        const { activeConversationId, messages } = get();
        
        // If we are looking at this exact chat right now
        if (activeConversationId === item.conversation_id) {
            set({ messages: [...messages, item as MessageItem] });
        } else {
            // FIRE LOCAL NOTIFICATION IF CHAT IS NOT FOCUSED OR APP IS BACKGROUNDED
            import('@capacitor/core').then(({ Capacitor }) => {
                if (Capacitor.isNativePlatform()) {
                    import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
                        LocalNotifications.schedule({
                            notifications: [
                                {
                                    title: "Red Encriptada",
                                    body: `Nuevo mensaje P2P de ${item.sender.substring(0, 8)}...`,
                                    id: new Date().getTime(),
                                    schedule: { at: new Date(Date.now() + 100) },
                                    sound: undefined,
                                    attachments: undefined,
                                    actionTypeId: "",
                                    extra: null
                                }
                            ]
                        });
                    });
                }
            });
        }
        
        // And regardless, refresh conversations list to bump it to top
        get().fetchData();
    },

    addContact: async (identity_hash: string, display_name: string) => {
        try {
            await RedAPI.addContact(identity_hash, display_name);
            await get().fetchData(); // Refresh contacts list
            return true;
        } catch (e) {
            console.error("Failed to add contact", e);
            return false;
        }
    }
}));
