// RED 2.0 Central Zustand Store (Modular Slices Composition)

import { create } from 'zustand';
import { RedStore } from './types';
import { createUiSlice } from './slices/uiSlice';
import { createAuthSlice } from './slices/authSlice';
import { createChatSlice } from './slices/chatSlice';
import { createContactsSlice } from './slices/contactsSlice';
import { createCallSlice } from './slices/callSlice';
import { createEmergencySlice } from './slices/emergencySlice';
import { createSocialSlice } from './slices/socialSlice';

export * from './types';

export const useRedStore = create<RedStore>((set, get, api) => ({
    ...createUiSlice(set, get, api),
    ...createAuthSlice(set, get, api),
    ...createChatSlice(set, get, api),
    ...createContactsSlice(set, get, api),
    ...createCallSlice(set, get, api),
    ...createEmergencySlice(set, get, api),
    ...createSocialSlice(set, get, api),
} as RedStore));

if (typeof window !== 'undefined') {
    (window as any).__RED_STORE__ = useRedStore;
}

export default useRedStore;
