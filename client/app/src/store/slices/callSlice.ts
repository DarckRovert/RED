import { StateCreator } from 'zustand';
import { RedStore } from '../types';
import { CallRingtoneEngine } from '../../lib/audio/CallRingtoneEngine';

export const createCallSlice: StateCreator<RedStore, [], [], Partial<RedStore>> = (set, get) => ({
    incomingCall: null,

    activeCallOffer: null,

    activeCallSignal: null,

    callSignalQueue: [],

    activeCallType: 'video',

    activeCallPeer: null,

    activeCallId: null,

    isCallPipMinimized: false,

    setActiveCallId: (id) => set({ activeCallId: id }),

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

    // Navigation mechanism for SPA,

    setCallPipMinimized: (minimized) => set({ isCallPipMinimized: minimized }),

    // Stories & Live Streaming,
});
