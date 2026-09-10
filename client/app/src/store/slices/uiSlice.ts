import { StateCreator } from 'zustand';
import { RedStore, ScreenView, NavTab, NavigationEntry, OVERLAY_SCREENS } from '../types';
import { SettingsManager, DEFAULT_PREFERENCES, UserPreferences } from '../../lib/settingsManager';
import { RedAPI } from '../../api/client';
import { localTransport } from '../../lib/mesh/localTransport';
import { meshRouter } from '../../lib/mesh/meshRouter';
import { ConversationItem, MessageItem } from '../../api/types';
import { BackHandlerRegistry } from '../../lib/navigation/BackHandlerRegistry';

const MAX_HISTORY_LENGTH = 30;

export const createUiSlice: StateCreator<RedStore, [], [], Partial<RedStore>> = (set, get) => ({
    preferences: typeof window !== 'undefined' ? SettingsManager.init() : DEFAULT_PREFERENCES,

    paymentPassport: typeof window !== 'undefined' ? SettingsManager.getPaymentPassport() : {
        preferredChainId: 137,
        acceptsVouchers: true,
        isPublicOnMesh: false,
    },

    updatePaymentPassport: (patch) => {
        const updated = SettingsManager.updatePaymentPassport(patch);
        set({ paymentPassport: updated, preferences: SettingsManager.getPreferences() });
    },

    updatePreferences: (patch: Partial<UserPreferences>) => {
        const updated = SettingsManager.updatePreferences(patch);
        set({ preferences: updated, paymentPassport: updated.paymentPassport || get().paymentPassport });
        if (patch.meshPowerProfile) {
            const intervals = SettingsManager.getMeshPowerIntervals(patch.meshPowerProfile);
            localTransport.setScanInterval(intervals.bleScanMs);
        }
    },

    pendingChatNavigation: null,

    setPendingChatNavigation: (target: string | null) => set({ pendingChatNavigation: target }),
    // ── Contact Authorization initial state ──────────────────────────────────,

    currentScreen: 'sidebar',
    activeTab: 'chats' as NavTab,
    activeMiniAppBundle: null,
    navigationHistory: [] as NavigationEntry[],

    setActiveTab: (tab: NavTab) => {
        const prevTab = get().activeTab;
        if (prevTab !== tab) {
            set({ activeTab: tab });
        }
    },

    launchMiniApp: (bundle: any) => {
        get().navigate('miniApp', undefined);
        set({ activeMiniAppBundle: bundle, currentScreen: 'miniApp' });
    },

    navigate: (screen: ScreenView, contextId?: string, options?: { replace?: boolean; skipHistory?: boolean }) => {
        const current = get();
        const prevScreen = current.currentScreen;
        const prevContext = current.activeConversationId;
        const prevTab = current.activeTab;

        // Push to history unless skipped or replacing
        const isSameState = prevScreen === screen && (contextId !== undefined ? prevContext === contextId : true);
        if (!options?.skipHistory && !options?.replace && !isSameState) {
            const newEntry: NavigationEntry = {
                screen: prevScreen,
                contextId: prevContext,
                activeTab: prevTab,
                timestamp: Date.now()
            };
            const currentHistory = Array.isArray(current.navigationHistory) ? current.navigationHistory : [];
            const trimmed = [...currentHistory, newEntry].slice(-MAX_HISTORY_LENGTH);
            set({ navigationHistory: trimmed });

            if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
                try {
                    window.history.pushState({ screen, contextId, activeTab: prevTab }, '');
                } catch {}
            }
        }
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
            const rawGroups = get().groups || [];
            let localWebGroups: any[] = [];
            if (typeof window !== 'undefined') {
                try {
                    const stored = localStorage.getItem('red_web_groups');
                    if (stored) localWebGroups = JSON.parse(stored);
                } catch {}
            }
            const allKnownGroups = [...rawGroups, ...localWebGroups];
            const matchedGroup = allKnownGroups.find((g: any) => g && (g.id === contextId || g.group_id === contextId));
            const isGroup = Boolean(matchedGroup);
            const canonicalPeer = isGroup ? contextId : (meshRouter.getCanonicalId(contextId) || contextId);
            const conversations = Array.isArray(get().conversations) ? get().conversations : [];
            const groupName = matchedGroup?.name;
            
            const existingConv = conversations.find(c => c && (
                c.id === canonicalPeer ||
                c.peer === canonicalPeer ||
                c.id === contextId ||
                c.peer === contextId ||
                (!isGroup && canonicalPeer.length >= 8 && (c.peer?.startsWith(canonicalPeer.slice(0, 8)) || c.id?.startsWith(canonicalPeer.slice(0, 8)))) ||
                (!isGroup && !!c.peer && c.peer.length >= 8 && canonicalPeer.startsWith(c.peer.slice(0, 8)))
            ));
            
            const finalId = canonicalPeer;
            let updatedConvs = [...conversations];
            if (existingConv) {
                updatedConvs = updatedConvs.map(c => {
                    const matches = c.id === canonicalPeer || c.peer === canonicalPeer || c.id === existingConv.id || c.peer === existingConv.peer;
                    if (matches) {
                        return {
                            ...c,
                            id: finalId,
                            peer: finalId,
                            peer_name: isGroup ? (groupName || c.peer_name) : c.peer_name,
                            is_group: isGroup,
                            unread_count: 0
                        };
                    }
                    return c;
                });
            } else {
                const newPlaceholder: ConversationItem = {
                    id: finalId,
                    peer: finalId,
                    peer_name: isGroup ? groupName : undefined,
                    last_message: isGroup ? 'Escuadrón P2P activo' : 'Nuevo chat P2P cifrado',
                    last_timestamp: Date.now() / 1000,
                    unread_count: 0,
                    is_group: isGroup
                };
                updatedConvs.unshift(newPlaceholder);
            }

            // Deduplicate conversations list strictly
            const seenMap = new Map<string, ConversationItem>();
            for (const c of updatedConvs) {
                if (!c || !c.peer) continue;
                const p = c.is_group ? c.peer : (meshRouter.getCanonicalId(c.peer) || c.peer);
                if (!seenMap.has(p)) {
                    seenMap.set(p, { ...c, id: p, peer: p });
                }
            }
            updatedConvs = Array.from(seenMap.values());

            set({ currentScreen: screen, activeConversationId: finalId, conversations: updatedConvs, messages: [] });
            RedAPI.setWebStore('red_web_conversations', updatedConvs);

            const sanitizeMsgs = (list: any[]): MessageItem[] => {
                if (!Array.isArray(list)) return [];
                return list.filter(m => {
                    if (!m || !m.content) return false;
                    if (
                        m.msg_type === 'typing' || 
                        m.msg_type === 'typing_status' || 
                        m.msg_type === 'group_invite' || 
                        m.msg_type === 'group_kick' || 
                        m.msg_type === 'group_leave' ||
                        m.msg_type === 'webrtc_signal' ||
                        m.msg_type === 'read_receipt'
                    ) return false;
                    if (typeof m.content === 'string' && m.content.startsWith('{')) {
                        if (!isGroup && (m.content.includes('"type":"group_invite"') || m.content.includes('"type":"group_message"') || m.content.includes('"type":"squad_msg"'))) {
                            return false;
                        }
                        if (m.content.includes('"status":') && m.content.includes('"sender_hash"')) return false;
                        if (
                            m.content.includes('"type":"IDENTITY_ANNOUNCE"') || 
                            m.content.includes('"type":"IDENTITY_RESPONSE"') || 
                            m.content.includes('"type":"SHAKE_PAIR_') || 
                            m.content.includes('"type":"DELIVERY_ACK"') ||
                            m.content.includes('"type":"PROFILE_UPDATE"')
                        ) return false;
                    }
                    return true;
                }).map(m => {
                    if (isGroup && typeof m.content === 'string' && m.content.startsWith('{') && (m.content.includes('"type":"group_message"') || m.content.includes('"type":"squad_msg"'))) {
                        try {
                            const parsed = JSON.parse(m.content);
                            if (parsed.content !== undefined) {
                                return {
                                    ...m,
                                    content: parsed.content,
                                    sender: parsed.sender || m.sender,
                                    media_data: parsed.media_data || m.media_data,
                                    msg_type: parsed.msg_type || m.msg_type || 'text'
                                };
                            }
                        } catch {}
                    }
                    return m;
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

    goBack: (options?: { fromPopState?: boolean; skipInterceptors?: boolean } | unknown) => {
        const opts = (typeof options === 'object' && options !== null)
            ? options as { fromPopState?: boolean; skipInterceptors?: boolean }
            : {};

        // 1. Check LIFO back interceptors first (open modals, search bars, viewers) unless explicitly skipped
        if (!opts.skipInterceptors && BackHandlerRegistry.hasInterceptors()) {
            const handled = BackHandlerRegistry.executeTop();
            if (handled) return true;
        }

        const state = get();
        const history = Array.isArray(state.navigationHistory) ? [...state.navigationHistory] : [];

        // 2. Pop navigation stack if available (unwinding any duplicate entries of the current state)
        while (history.length > 0) {
            const prevEntry = history.pop()!;
            // Ensure we transition to a distinct screen or distinct conversation context
            const isDistinct = prevEntry.screen !== state.currentScreen || 
                (prevEntry.screen === 'chat' && prevEntry.contextId !== state.activeConversationId);
            
            if (isDistinct || history.length === 0) {
                set({ navigationHistory: history });

                if (prevEntry.screen === 'chat' && prevEntry.contextId) {
                    state.navigate('chat', prevEntry.contextId, { skipHistory: true });
                } else {
                    set({
                        currentScreen: prevEntry.screen,
                        activeConversationId: prevEntry.contextId || null,
                        activeTab: prevEntry.activeTab || state.activeTab
                    });
                }
                return true;
            }
        }
        set({ navigationHistory: [] });

        // 3. If on root ('sidebar') but in a secondary tab, return to 'chats'
        if (state.currentScreen === 'sidebar' && state.activeTab !== 'chats') {
            set({ activeTab: 'chats' });
            return true;
        }

        // 4. If on another screen without history, fallback to sidebar
        if (state.currentScreen !== 'sidebar') {
            set({ currentScreen: 'sidebar', activeConversationId: null });
            return true;
        }

        // 5. At root (sidebar + chats tab + empty history)
        return false;
    },
});
