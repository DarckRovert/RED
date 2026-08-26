import { StateCreator } from 'zustand';
import { RedStore } from '../types';
import { IdentityResponse, StatusResponse, ConversationItem } from '../../api/types';
import { RedAPI } from '../../api/client';
import { localTransport } from '../../lib/mesh/localTransport';
import { meshRouter, normalizeIdentity, isNameSimilar } from '../../lib/mesh/meshRouter';
import { toast } from '../../components/Toast';
import { RED_VERSION } from '../../lib/version';
import { StateIntegrityEngine } from '../../lib/storage/StateIntegrityEngine';
import { indexedMediaVault } from '../../lib/storage/indexedMediaVault';
import { companionSyncEngine } from '../../lib/mesh/companionSyncEngine';

let _fetchInterval: ReturnType<typeof setInterval> | null = null;
let _mainSSE: EventSource | null = null;
let _outboundSSE: EventSource | null = null;
let _sseDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let _identityResolvedUnsub: (() => void) | null = null;

export const createAuthSlice: StateCreator<RedStore, [], [], Partial<RedStore>> = (set, get) => ({
    isAuthenticated: false,

    isDecoyMode: false,

    identity: null,

    status: null,

    nodeOnline: false,

    login: async (password: string) => {
        try {
            const { Capacitor, registerPlugin } = await import('@capacitor/core');
            const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

            if (isNative) {
                // 1. Check master_pin / panic_pin / decoy_pin in hardware Keystore & local storage
                let storedMasterPin: string | null = null;
                let storedPanicPin: string | null = null;
                let storedDecoyPin: string | null = null;

                try {
                    const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
                    const masterRes = await SecureStoragePlugin.get({ key: 'master_pin' }).catch(() => null);
                    const panicRes = await SecureStoragePlugin.get({ key: 'panic_pin' }).catch(() => null);
                    const decoyRes = await SecureStoragePlugin.get({ key: 'decoy_pin' }).catch(() => null);
                    storedMasterPin = masterRes?.value?.trim() || null;
                    storedPanicPin = panicRes?.value?.trim() || null;
                    storedDecoyPin = decoyRes?.value?.trim() || null;
                } catch {}

                if (!storedMasterPin && typeof window !== 'undefined') {
                    storedMasterPin = localStorage.getItem('master_pin') || sessionStorage.getItem('master_pin');
                }
                if (!storedPanicPin && typeof window !== 'undefined') {
                    storedPanicPin = localStorage.getItem('panic_pin');
                }
                if (!storedDecoyPin && typeof window !== 'undefined') {
                    storedDecoyPin = localStorage.getItem('decoy_pin');
                }

                // PANIC WIPE
                if (storedPanicPin && password === storedPanicPin) {
                    try {
                        const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
                        await SecureStoragePlugin.clear().catch(() => {});
                        const RedNode = registerPlugin<any>('RedNode');
                        await RedNode.destroy().catch(() => {});
                    } catch {}
                    if (typeof window !== 'undefined') {
                        localStorage.clear();
                        sessionStorage.clear();
                    }
                    toast.error("🔥 BÓVEDA DESTRUIDA POR PROTOCOLO DE PÁNICO");
                    window.location.reload();
                    return false;
                }

                // DECOY VAULT
                const isDecoy = (storedDecoyPin && password === storedDecoyPin) || password === '9999';
                set({ isDecoyMode: isDecoy });

                // STRICT MASTER PIN CHECK (If a master PIN has been registered, password MUST match)
                if (storedMasterPin && password !== storedMasterPin && !isDecoy) {
                    console.warn("[RED Native Auth] Acceso denegado: PIN maestro no coincide.");
                    return false;
                }

                // FIRST ONBOARDING: If no master_pin yet exists, store this password as master_pin
                if (!storedMasterPin && password && password.length >= 6) {
                    try {
                        const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
                        await SecureStoragePlugin.set({ key: 'master_pin', value: password }).catch(() => null);
                    } catch {}
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('master_pin', password);
                        sessionStorage.setItem('master_pin', password);
                    }
                }

                const RedNode = registerPlugin<any>('RedNode');
                await RedNode.start({ password, decoyMode: isDecoy });
                console.log("[RED] Requested Rust Node boot via JNI (Decoy:", isDecoy, ")");
                await new Promise(r => setTimeout(r, 1000));
                const connected = await get().initNodeConnection();
                if (connected) {
                    set({ isAuthenticated: true });
                    // ── Request notification permissions and register action listener ──────
                    try {
                        const { LocalNotifications } = await import('@capacitor/local-notifications');
                        const perm = await LocalNotifications.checkPermissions();
                        if (perm.display !== 'granted') {
                            await LocalNotifications.requestPermissions();
                        }
                        LocalNotifications.removeAllListeners().catch(() => {});
                        LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
                            try {
                                const extra = notificationAction.notification?.extra;
                                const targetPeer = extra?.peer || extra?.conversation_id || extra?.sender;
                                if (targetPeer) {
                                    if (get().isAuthenticated) {
                                        get().navigate('chat', targetPeer);
                                    } else {
                                        set({ pendingChatNavigation: targetPeer });
                                    }
                                }
                            } catch (e) {
                                console.warn('[RED] Failed to handle notification click:', e);
                            }
                        });
                    } catch (notifErr) {
                        console.warn('[RED] LocalNotifications setup error:', notifErr);
                    }

                    const pending = get().pendingChatNavigation;
                    if (pending) {
                        set({ pendingChatNavigation: null });
                        get().navigate('chat', pending);
                    }
                    return true;
                }
                return false;
            } else {
                // Web Browser Platform (GitHub Pages SPA)
                const masterPin = typeof window !== 'undefined' ? (localStorage.getItem("master_pin") || sessionStorage.getItem("master_pin")) : null;
                const panicPin = typeof window !== 'undefined' ? localStorage.getItem("panic_pin") : null;
                const decoyPin = typeof window !== 'undefined' ? localStorage.getItem("decoy_pin") : null;

                // 1. PROTOCOLO DE PÁNICO (Purga y reinicio seguro)
                if (panicPin && password === panicPin) {
                    if (typeof window !== 'undefined') {
                        localStorage.clear();
                        sessionStorage.clear();
                    }
                    toast.error("🔥 BÓVEDA DESTRUIDA POR PROTOCOLO DE PÁNICO");
                    window.location.reload();
                    return false;
                }

                // 2. BÓVEDA DE SEÑUELO (Modo encubierto)
                const isDecoy = Boolean(decoyPin && password === decoyPin);
                set({ isDecoyMode: isDecoy });

                // 3. VALIDACIÓN ESTRICTA DE PIN MAESTRO
                if (masterPin && password !== masterPin && !isDecoy) {
                    console.warn("[RED Web Auth] Acceso denegado: PIN maestro incorrecto.");
                    return false;
                }

                // Si no había master_pin guardado aún, lo establecemos con el PIN ingresado
                if (!masterPin && password && password.length >= 6 && typeof window !== 'undefined') {
                    localStorage.setItem("master_pin", password);
                    sessionStorage.setItem("master_pin", password);
                } else if (!masterPin) {
                    return false;
                }

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
                if (typeof window !== 'undefined') {
                    localStorage.setItem("red_landing_dismissed", "true");
                }
                set({
                    identity: { identity_hash: localHash, short_id: shortId, public_key: localHash, nickname: savedNick || 'Operador RED' },
                    status: { is_running: true, peer_count: 0, identity_hash: localHash, version: `${RED_VERSION}-web`, chain_height: 1 },
                    nodeOnline: true,
                    isAuthenticated: true
                });

                const pending = get().pendingChatNavigation;
                if (pending) {
                    set({ pendingChatNavigation: null });
                    get().navigate('chat', pending);
                }

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

                // Wire Live Companion Sync Bridge (WhatsApp Web Style Real-time Mirror)
                companionSyncEngine.onLiveEvent((event) => {
                    try {
                        if (event.type === 'LIVE_MSG_RECV') {
                            get().addIncomingMessage(event.data);
                        } else if (event.type === 'LIVE_MSG_SEND') {
                            const { recipient, content, options } = event.data;
                            RedAPI.sendMessage(recipient, content, options).catch((err) => {
                                console.warn('[CompanionEngine:Mobile] Error broadcasting web message to mesh:', err);
                            });
                        } else if (event.type === 'LIVE_READ_ACK') {
                            const { peer, conversationId } = event.data;
                            if (peer || conversationId) {
                                get().markAsRead(peer || conversationId);
                            }
                        } else if (event.type === 'LIVE_TYPING') {
                            const { peer, isTyping } = event.data;
                            if (peer) {
                                set((s: any) => ({
                                    peerTyping: Boolean(isTyping),
                                    peerTypingStatus: { ...s.peerTypingStatus, [peer]: isTyping ? 'typing' : 'idle' }
                                }));
                            }
                        } else if (event.type === 'LIVE_CONTACT_UPDATE') {
                            get().fetchData();
                        } else if (event.type === 'LIVE_CONV_WIPE') {
                            const { peer } = event.data;
                            if (peer) {
                                set((s: any) => ({
                                    conversations: s.conversations.filter((c: any) => c.peer !== peer && c.id !== peer),
                                    messages: s.activeConversationId === peer ? [] : s.messages
                                }));
                            }
                        }
                    } catch (liveErr) {
                        console.warn('[RED Live Companion] Error handling live event:', liveErr);
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

    restoreCompanionVault: async (payload: any) => {
        try {
            if (!payload || !payload.identity || !payload.identity.identity_hash) {
                throw new Error("Payload de vinculación inválido");
            }
            if (typeof window !== 'undefined') {
                localStorage.setItem("red_identity_hash", payload.identity.identity_hash);
                localStorage.setItem("red_short_id", payload.identity.short_id || `red_${payload.identity.identity_hash.slice(0, 8)}`);
                if (payload.identity.nickname) {
                    localStorage.setItem("red_displayName", payload.identity.nickname);
                    localStorage.setItem("user_nickname", payload.identity.nickname);
                }
                if (payload.masterPin) {
                    localStorage.setItem("master_pin", payload.masterPin);
                }
                if (Array.isArray(payload.contacts) && payload.contacts.length > 0) {
                    localStorage.setItem("red_web_contacts", JSON.stringify(payload.contacts));
                }
                if (Array.isArray(payload.conversations) && payload.conversations.length > 0) {
                    localStorage.setItem("red_web_conversations", JSON.stringify(payload.conversations));
                }
                localStorage.setItem("red_landing_dismissed", "true");
                localStorage.setItem("profile_created", "true");
                localStorage.setItem("red_onboarding_completed", "true");
            }

            const pinToUse = payload.masterPin || "123456";
            await get().login(pinToUse);
            await get().fetchData();
            toast.success(`🎉 ¡Dispositivo vinculado con éxito! Bienvenido ${payload.identity.nickname || 'Operador'}`);
            return true;
        } catch (err: any) {
            console.error("[RED] Error restaurando bóveda compañera:", err);
            toast.error(err?.message || "Error restaurando bóveda vinculada");
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
            if (phone) {
                localStorage.setItem('red_phoneNumber', phone);
                localStorage.setItem('user_phone_number', phone);
            }
            if (bio) {
                localStorage.setItem('red_bio', bio);
                localStorage.setItem('user_bio', bio);
            }
            try {
                import('@capacitor/core').then(({ Capacitor }) => {
                    if (Capacitor.isNativePlatform()) {
                        import('capacitor-secure-storage-plugin').then(({ SecureStoragePlugin }) => {
                            SecureStoragePlugin.set({ key: "red_displayName", value: cleanName }).catch(() => null);
                            SecureStoragePlugin.set({ key: "user_nickname", value: cleanName }).catch(() => null);
                            if (phone) SecureStoragePlugin.set({ key: "red_phoneNumber", value: phone }).catch(() => null);
                            if (bio) SecureStoragePlugin.set({ key: "red_bio", value: bio }).catch(() => null);
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
        RedAPI.setProfile(cleanName, bio).catch(() => {});

        // ── BROADCAST PROFILE UPDATE OVER MESH & TO ALL CONTACTS ─────────
        meshRouter.sendIdentityAnnounce().catch(() => {});

        const myIdentity = get().identity;
        if (myIdentity?.identity_hash) {
            const profilePayload = {
                sender_hash: myIdentity.identity_hash,
                sender_name: cleanName,
                nickname: cleanName,
                display_name: cleanName,
                phone_number: phone,
                bio: bio,
                public_key: myIdentity.public_key || null,
                timestamp: Date.now()
            };
            const payloadJson = JSON.stringify(profilePayload);

            // 1. Broadcast over mesh
            RedAPI.sendMessage('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadJson, { msg_type: 'profile_update' }).catch(() => {});

            // 2. Direct message to every registered contact
            const currentContacts = get().contacts || [];
            for (const c of currentContacts) {
                if (c.identity_hash && c.identity_hash !== myIdentity.identity_hash && !c.identity_hash.startsWith('00000000')) {
                    RedAPI.sendMessage(c.identity_hash, payloadJson, { msg_type: 'profile_update' }).catch(() => {});
                }
            }
            console.log(`[Store] 📡 Profile update broadcasted for ${cleanName} to ${currentContacts.length} contacts.`);
        }
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

                if (finalIdentity.identity_hash) {
                    meshRouter.init(finalIdentity.identity_hash);
                    meshRouter.updateIdentity(finalIdentity.identity_hash);
                }

                set({ identity: finalIdentity, status, nodeOnline: true });
                if (process.env.NODE_ENV === 'development') {
                    console.log("[RED] Attached to Rust Node Natively (PoW complete):", identity.short_id);
                }
                
                await get().fetchData();

                // Subscribe to real-time P2P identity resolution events
                if (_identityResolvedUnsub) { _identityResolvedUnsub(); _identityResolvedUnsub = null; }
                _identityResolvedUnsub = meshRouter.onIdentityResolved(({ hardwareId, canonicalId, displayName, publicKey }) => {
                    if (!canonicalId || canonicalId === get().identity?.identity_hash) return;
                    const cleanHw = hardwareId?.toLowerCase() || '';
                    const cleanCanon = canonicalId?.toLowerCase() || '';
                    const isGeneric = (name?: string) => !name || name.startsWith('Operador ') || name.startsWith('Nodo ') || name.startsWith('Par Escaneado') || name === 'Nuevo Par' || name === 'Par Malla';

                    // 1. Incondicionalmente actualizar y migrar contactos si coinciden
                    const currentContacts = get().contacts || [];
                    const idx = currentContacts.findIndex(c => {
                        if (!c) return false;
                        const cHash = (c.identity_hash || '').toLowerCase();
                        if (cHash === cleanHw || cHash === cleanCanon || (cleanHw.length >= 8 && cHash.startsWith(cleanHw.slice(0, 8))) || (cleanCanon.length >= 8 && cHash.startsWith(cleanCanon.slice(0, 8)))) return true;
                        if (displayName && !isGeneric(displayName) && !isGeneric(c.display_name)) {
                            if (c.display_name.trim().toLowerCase() === displayName.trim().toLowerCase() ||
                                c.display_name.trim().toLowerCase() === `red-${displayName.trim().toLowerCase()}`) return true;
                        }
                        return false;
                    });

                    let updatedContacts = [...currentContacts];
                    let oldContactHash = cleanHw;
                    if (idx >= 0) {
                        const oldEntry = updatedContacts[idx];
                        oldContactHash = oldEntry.identity_hash;
                        updatedContacts[idx] = {
                            ...oldEntry,
                            identity_hash: cleanCanon,
                            display_name: (!isGeneric(displayName)) ? displayName : oldEntry.display_name,
                            public_key: publicKey || oldEntry.public_key
                        };
                    }

                    // 2. INCONDICIONAL: Migrar y fusionar TODAS las conversaciones que coincidan con hardwareId o canonicalId
                    const currentConvs = get().conversations || [];
                    const dedupedMap = new Map<string, ConversationItem>();

                    for (const conv of currentConvs) {
                        if (!conv) continue;
                        const p = (conv.peer || conv.id || '').toLowerCase();
                        const isMatch = p === cleanHw || p === cleanCanon || (cleanHw.length >= 8 && p.startsWith(cleanHw.slice(0, 8))) || (cleanCanon.length >= 8 && p.startsWith(cleanCanon.slice(0, 8))) || p === oldContactHash;
                        const targetKey = isMatch ? cleanCanon : (meshRouter.getCanonicalId(p) || p);

                        const normalizedConv: ConversationItem = {
                            ...conv,
                            id: targetKey,
                            peer: targetKey,
                            peer_name: isMatch && !isGeneric(displayName) ? displayName : (conv.peer_name || (conv as any).name)
                        };

                        if (!dedupedMap.has(targetKey)) {
                            dedupedMap.set(targetKey, normalizedConv);
                        } else {
                            const existing = dedupedMap.get(targetKey)!;
                            const existingTs = (typeof existing.last_message === 'object' && (existing.last_message as any)?.timestamp) || existing.last_timestamp || 0;
                            const convTs = (typeof conv.last_message === 'object' && (conv.last_message as any)?.timestamp) || conv.last_timestamp || 0;
                            const bestTs = Math.max(existingTs, convTs);
                            const bestSnippet = convTs > existingTs ? (conv.last_message || existing.last_message) : (existing.last_message || conv.last_message);
                            dedupedMap.set(targetKey, {
                                ...existing,
                                last_message: bestSnippet,
                                last_timestamp: bestTs,
                                unread_count: (existing.unread_count || 0) + (conv.unread_count || 0)
                            });
                        }
                    }

                    const updatedConvs = Array.from(dedupedMap.values());

                    // 3. Fusión y migración del historial de mensajes en LocalStorage
                    if (typeof window !== 'undefined' && cleanHw && cleanHw !== cleanCanon) {
                        try {
                            const hwKey = `red_web_messages_${cleanHw}`;
                            const canonKey = `red_web_messages_${cleanCanon}`;
                            const rawHw = localStorage.getItem(hwKey);
                            const rawCanon = localStorage.getItem(canonKey);
                            const hwMsgs: any[] = rawHw ? JSON.parse(rawHw) : [];
                            const canonMsgs: any[] = rawCanon ? JSON.parse(rawCanon) : [];

                            if (hwMsgs.length > 0) {
                                const seenIds = new Set(canonMsgs.map(m => m.id));
                                const merged = [...canonMsgs];
                                for (const hm of hwMsgs) {
                                    if (hm && hm.id && !seenIds.has(hm.id)) {
                                        seenIds.add(hm.id);
                                        merged.push(hm);
                                    }
                                }
                                merged.sort((a, b) => {
                                    const tsA = a.timestamp ? (a.timestamp > 1e11 ? a.timestamp / 1000 : a.timestamp) : 0;
                                    const tsB = b.timestamp ? (b.timestamp > 1e11 ? b.timestamp / 1000 : b.timestamp) : 0;
                                    return tsA - tsB;
                                });
                                localStorage.setItem(canonKey, JSON.stringify(merged));
                                localStorage.removeItem(hwKey);
                            }
                        } catch {}
                    }

                    // 4. Si el chat activo era el hardwareId, migrar activeConversationId de inmediato
                    const { activeConversationId } = get();
                    const nextActiveId = (activeConversationId === cleanHw || (cleanHw.length >= 8 && activeConversationId?.startsWith(cleanHw.slice(0, 8))))
                        ? cleanCanon
                        : activeConversationId;

                    set({
                        contacts: updatedContacts,
                        conversations: updatedConvs,
                        activeConversationId: nextActiveId
                    });

                    RedAPI.setWebStore('red_web_contacts', updatedContacts);
                    RedAPI.setWebStore('red_web_conversations', updatedConvs);
                });

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

        // ── COLD BOOT INSTANT RESTORE ──────────────────────────────────────────────
        // Immediately seed the UI from localStorage BEFORE awaiting the Rust backend.
        // This guarantees zero perceived data loss during the seconds the native node takes to boot.
        // The Rust response will merge on top via the bidirectional merge in api.ts.
        if (typeof window !== 'undefined') {
            try {
                const snapConvs = localStorage.getItem('red_web_conversations');
                const snapConts = localStorage.getItem('red_web_contacts');
                const parsedConvs: ConversationItem[] = snapConvs ? JSON.parse(snapConvs) : [];
                const parsedConts: any[] = snapConts ? JSON.parse(snapConts) : [];
                const { conversations: currentConvs, contacts: currentConts } = get();
                // Only populate if the in-memory store is empty (true cold boot)
                if ((!currentConvs || currentConvs.length === 0) && parsedConvs.length > 0) {
                    set({ conversations: parsedConvs });
                }
                if ((!currentConts || currentConts.length === 0) && parsedConts.length > 0) {
                    set({ contacts: parsedConts });
                }
            } catch { /* ignore parse errors on corrupt localStorage */ }
        }
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
                const peer = normalizeIdentity(c.peer || c.id || '');
                const name = (c.name || c.display_name || '').toLowerCase();
                if (peer === 'me' || peer === 'local' || peer === 'unknown' || name === 'operador me') return false;
                if (myHash && (peer === myHash || (peer.length >= 16 && myHash.startsWith(peer)))) return false;
                if (c.last_message && (c.last_message.startsWith('{"') || c.last_message.includes('"sender_hash"') || c.last_message.includes('contact_request') || c.last_message.includes('contact_response'))) {
                    c.last_message = 'Contacto P2P establecido';
                }
                return true;
            });

            // Deduplicate conversations by canonical peer DID
            const seenPeers = new Set<string>();
            const dedupedConvs: ConversationItem[] = [];
            for (const c of cleanConvs) {
                const rawP = normalizeIdentity(c.peer || c.id || '');
                const canonicalP = meshRouter.getCanonicalId(rawP) || rawP;
                const shortP = canonicalP.slice(0, 16);
                if (!seenPeers.has(canonicalP) && !seenPeers.has(shortP)) {
                    seenPeers.add(canonicalP);
                    seenPeers.add(shortP);
                    dedupedConvs.push({
                        ...c,
                        id: canonicalP,
                        peer: canonicalP
                    });
                }
            }

            const cleanConts = (Array.isArray(conts) ? conts : []).filter((c: any) => {
                if (!c) return false;
                const hash = normalizeIdentity(c.identity_hash || '');
                const name = (c.display_name || '').toLowerCase();
                if (hash === 'me' || hash === 'local' || hash === 'unknown' || name === 'operador me') return false;
                if (myHash && (hash === myHash || (hash.length >= 16 && myHash.startsWith(hash)))) return false;
                return true;
            });

            // Deduplicate contacts by canonical identity_hash AND smart alias merging
            const dedupedConts: any[] = [];
            const staleHashesToPurge: string[] = [];

            for (const ct of cleanConts) {
                const rawH = normalizeIdentity(ct.identity_hash || '');
                const canonicalH = meshRouter.getCanonicalId(rawH) || rawH;
                const isCanonical64 = canonicalH.length === 64 && /^[0-9a-fA-F]+$/.test(canonicalH);
                const ctName = ct.display_name?.trim() || '';

                const existingIdx = dedupedConts.findIndex(existing => {
                    const eH = normalizeIdentity(existing.identity_hash || '');
                    if (eH === canonicalH || eH === rawH) return true;
                    if (canonicalH.length >= 16 && eH.length >= 16 && (canonicalH.startsWith(eH.slice(0, 16)) || eH.startsWith(canonicalH.slice(0, 16)))) return true;
                    // Name similarity match for non-generic names
                    const eName = existing.display_name?.trim() || '';
                    if (isNameSimilar(ctName, eName)) return true;
                    return false;
                });

                if (existingIdx === -1) {
                    dedupedConts.push({
                        ...ct,
                        identity_hash: canonicalH
                    });
                } else {
                    // Merge: prefer 64-char hex canonical DID over local_ or ephemeral hardware ID
                    const existing = dedupedConts[existingIdx];
                    const existingH = existing.identity_hash;
                    const existingIs64 = existingH.length === 64 && /^[0-9a-fA-F]+$/.test(existingH);

                    let bestHash = existingH;
                    let staleHash = '';

                    if (!existingIs64 && isCanonical64) {
                        bestHash = canonicalH;
                        staleHash = existingH;
                    } else if (existingIs64 && !isCanonical64) {
                        bestHash = existingH;
                        staleHash = canonicalH;
                    } else if (canonicalH.startsWith('local_') && !existingH.startsWith('local_')) {
                        bestHash = existingH;
                        staleHash = canonicalH;
                    } else if (existingH.startsWith('local_') && !canonicalH.startsWith('local_')) {
                        bestHash = canonicalH;
                        staleHash = existingH;
                    }

                    if (staleHash && staleHash !== bestHash) {
                        staleHashesToPurge.push(staleHash);
                    }

                    const isGeneric = (n?: string) => !n || n.startsWith('Operador ') || n.startsWith('Nodo ') || n.startsWith('Par Escaneado') || n.startsWith('Dispositivo RED');
                    const existingName = existing.display_name?.trim() || '';
                    const incomingName = ct.display_name?.trim() || '';
                    const chosenDisplayName = (!isGeneric(existingName)) 
                        ? existingName 
                        : (!isGeneric(incomingName) ? incomingName : (existingName || incomingName));

                    dedupedConts[existingIdx] = {
                        ...existing,
                        identity_hash: bestHash,
                        display_name: chosenDisplayName,
                        public_key: ct.public_key || existing.public_key
                    };
                }
            }

            // Purge stale ephemeral hashes from backend in the background
            if (staleHashesToPurge.length > 0) {
                for (const sh of staleHashesToPurge) {
                    RedAPI.req(`/contacts/${sh}`, { method: 'DELETE' }).catch(() => {});
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
                        const filtered = parsed.map((c: any) => {
                            const rawP = normalizeIdentity(c.peer || c.id || '');
                            const canonicalP = meshRouter.getCanonicalId(rawP) || rawP;
                            return {
                                ...c,
                                id: canonicalP,
                                peer: canonicalP
                            };
                        }).filter((c: any) => {
                            const p = normalizeIdentity(c.peer || c.id || '');
                            const n = (c.name || c.display_name || '').toLowerCase();
                            if (p === 'me' || p === 'local' || n === 'operador me' || (myHash && (p === myHash || myHash.startsWith(p)))) return false;
                            if (staleHashesToPurge.includes(p)) return false;
                            if (p.startsWith('local_') && dedupedConts.some(dc => isNameSimilar(dc.display_name, c.name || c.display_name))) return false;
                            return true;
                        }).map((c: any) => {
                            if (c.last_message && (c.last_message.startsWith('{"') || c.last_message.includes('contact_request') || c.last_message.includes('contact_response'))) {
                                c.last_message = 'Contacto P2P establecido';
                            }
                            return c;
                        });

                        const seenMap = new Map<string, any>();
                        for (const fc of filtered) {
                            const k = (fc.peer || fc.id || '').slice(0, 16);
                            if (k && !seenMap.has(k)) {
                                seenMap.set(k, fc);
                            }
                        }
                        localStorage.setItem('red_web_conversations', JSON.stringify(Array.from(seenMap.values())));
                    }
                    const rawWebConts = localStorage.getItem('red_web_contacts');
                    if (rawWebConts) {
                        const parsed = JSON.parse(rawWebConts);
                        const filtered = parsed.filter((c: any) => {
                            const h = normalizeIdentity(c.identity_hash || '');
                            const n = (c.display_name || '').toLowerCase();
                            if (h === 'me' || h === 'local' || n === 'operador me' || (myHash && (h === myHash || myHash.startsWith(h)))) return false;
                            if (staleHashesToPurge.includes(h)) return false;
                            return true;
                        });
                        localStorage.setItem('red_web_contacts', JSON.stringify(filtered));
                    }
                } catch {}
            }

            // Merge backend dedupedConvs with local / in-memory conversations
            const localConvs = get().conversations || [];
            const mergedMap = new Map<string, ConversationItem>();

            for (const c of dedupedConvs) {
                const rawP = normalizeIdentity(c.peer || c.id || '');
                if (staleHashesToPurge.includes(rawP)) continue;
                const canonicalP = meshRouter.getCanonicalId(rawP) || rawP;
                if (staleHashesToPurge.includes(canonicalP)) continue;
                const key = canonicalP.slice(0, 16);
                if (key) mergedMap.set(key, { ...c, id: canonicalP, peer: canonicalP });
            }

            for (const lc of localConvs) {
                const rawP = normalizeIdentity(lc.peer || lc.id || '');
                if (staleHashesToPurge.includes(rawP)) continue;
                const canonicalP = meshRouter.getCanonicalId(rawP) || rawP;
                if (staleHashesToPurge.includes(canonicalP)) continue;
                if (rawP.startsWith('local_') && dedupedConts.some(dc => isNameSimilar(dc.display_name, (lc as any).name || (lc as any).display_name))) continue;
                const key = canonicalP.slice(0, 16);
                if (!key) continue;
                if (!mergedMap.has(key)) {
                    mergedMap.set(key, { ...lc, id: canonicalP, peer: canonicalP });
                } else {
                    const existing = mergedMap.get(key)!;
                    const existingTs = (typeof existing.last_message === 'object' && (existing.last_message as any)?.timestamp) || existing.last_timestamp || 0;
                    const localTs = (typeof lc.last_message === 'object' && (lc.last_message as any)?.timestamp) || lc.last_timestamp || 0;
                    if (localTs > existingTs) {
                        mergedMap.set(key, {
                            ...existing,
                            id: canonicalP,
                            peer: canonicalP,
                            last_message: lc.last_message || existing.last_message,
                            last_timestamp: localTs,
                            unread_count: lc.unread_count ?? existing.unread_count
                        });
                    }
                }
            }

            const finalSortedConvs = Array.from(mergedMap.values())
                .filter(c => c && !c.id.startsWith('ffffffff') && !c.peer?.startsWith('ffffffff') && !c.id.startsWith('00000000') && !c.peer?.startsWith('00000000'))
                .sort((a, b) => {
                const tsA = (typeof a.last_message === 'object' && (a.last_message as any)?.timestamp) || a.last_timestamp || 0;
                const tsB = (typeof b.last_message === 'object' && (b.last_message as any)?.timestamp) || b.last_timestamp || 0;
                const normA = tsA < 1e10 ? tsA : tsA / 1000;
                const normB = tsB < 1e10 ? tsB : tsB / 1000;
                return normB - normA;
            });

            const { currentScreen, activeConversationId } = get();
            let newActiveId = activeConversationId;
            if (currentScreen === 'chat' && activeConversationId) {
                const matched = finalSortedConvs.find((c: any) =>
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
                conversations: finalSortedConvs,
                contacts: dedupedConts,
                groups: safeGrps,
                activeConversationId: newActiveId
            });
            RedAPI.setWebStore('red_web_conversations', finalSortedConvs);
            RedAPI.setWebStore('red_web_contacts', dedupedConts);
        } catch {
            // BUG-FIX: Never wipe existing data on transient network errors.
            // Previously this destroyed all conversations/contacts on every blip.
            // Only log silently — the UI retains last good state.
            if (process.env.NODE_ENV === 'development') {
                console.warn('[RED] fetchData: transient error — retaining cached data.');
            }
        }
    },
});
