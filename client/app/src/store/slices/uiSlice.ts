import { StateCreator } from 'zustand';
import { RedStore, ScreenView } from '../types';
import { SettingsManager, DEFAULT_PREFERENCES, UserPreferences } from '../../lib/settingsManager';
import { toast } from '../../components/Toast';
import { RedAPI } from '../../api/client';
import { localTransport } from '../../lib/mesh/localTransport';
import { meshRouter } from '../../lib/mesh/meshRouter';
import { ConversationItem, MessageItem } from '../../api/types';

const OVERLAY_SCREENS = new Set<string>(['call', 'updater']);

export const createUiSlice: StateCreator<RedStore, [], [], Partial<RedStore>> = (set, get) => ({
    preferences: typeof window !== 'undefined' ? SettingsManager.init() : DEFAULT_PREFERENCES,

    updatePreferences: (patch: Partial<UserPreferences>) => {
        const updated = SettingsManager.updatePreferences(patch);
        set({ preferences: updated });
        if (patch.meshPowerProfile) {
            const intervals = SettingsManager.getMeshPowerIntervals(patch.meshPowerProfile);
            localTransport.setScanInterval(intervals.bleScanMs);
        }
    },

    pendingChatNavigation: null,

    setPendingChatNavigation: (target: string | null) => set({ pendingChatNavigation: target }),
    // ── Contact Authorization initial state ──────────────────────────────────,

    currentScreen: 'sidebar',

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
                (!!c.peer && c.peer.length >= 8 && canonicalPeer.startsWith(c.peer.slice(0, 8)))
            ));
            
            let finalId = canonicalPeer;
            let updatedConvs = [...conversations];
            if (existingConv) {
                finalId = existingConv.id || canonicalPeer;
                updatedConvs = updatedConvs.map(c => (c.id === finalId || c.peer === canonicalPeer) ? { ...c, unread_count: 0 } : c);
            } else {
                finalId = canonicalPeer;
                const newPlaceholder: ConversationItem = {
                    id: finalId,
                    peer: canonicalPeer,
                    last_message: 'Nuevo chat P2P cifrado',
                    last_timestamp: Date.now() / 1000,
                    unread_count: 0
                };
                updatedConvs.unshift(newPlaceholder);
            }

            set({ currentScreen: screen, activeConversationId: finalId, conversations: updatedConvs, messages: [] });
            RedAPI.setWebStore('red_web_conversations', updatedConvs);

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
});
