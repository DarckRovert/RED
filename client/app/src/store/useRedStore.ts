// RED 2.0 Central Zustand Store (Modular Slices Composition with Selective UI Persistence)

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { RedStore } from './types';
import { createUiSlice } from './slices/uiSlice';
import { createAuthSlice } from './slices/authSlice';
import { createChatSlice } from './slices/chatSlice';
import { createContactsSlice } from './slices/contactsSlice';
import { createCallSlice } from './slices/callSlice';
import { createEmergencySlice } from './slices/emergencySlice';
import { createSocialSlice } from './slices/socialSlice';

export * from './types';

const memoryStorage = {
    getItem: (_key: string) => null,
    setItem: (_key: string, _value: string) => {},
    removeItem: (_key: string) => {},
};

export const useRedStore = create<RedStore>()(
    persist(
        (set, get, api) => ({
            ...createUiSlice(set, get, api),
            ...createAuthSlice(set, get, api),
            ...createChatSlice(set, get, api),
            ...createContactsSlice(set, get, api),
            ...createCallSlice(set, get, api),
            ...createEmergencySlice(set, get, api),
            ...createSocialSlice(set, get, api),
        } as RedStore),
        {
            name: 'red_ui_state',
            storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : memoryStorage)),
            partialize: (state) => ({
                currentScreen: state.currentScreen !== 'call' && state.currentScreen !== 'updater' ? state.currentScreen : 'sidebar',
                activeConversationId: state.activeConversationId,
                preferences: state.preferences,
            }),
        }
    )
);

if (typeof window !== 'undefined') {
    (window as any).__RED_STORE__ = useRedStore;
}

export default useRedStore;
