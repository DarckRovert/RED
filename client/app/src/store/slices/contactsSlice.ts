import { StateCreator } from 'zustand';
import { RedStore, PendingContactRequest } from '../types';
import { ContactItem, GroupItem } from '../../api/types';
import { RedAPI } from '../../api/client';
import { meshRouter } from '../../lib/mesh/meshRouter';
import { toast } from '../../components/Toast';

const _processedHandshakes = new Set<string>();

export const createContactsSlice: StateCreator<RedStore, [], [], Partial<RedStore>> = (set, get) => ({
    contacts: [],

    groups: [],

    pendingContactRequests: typeof window !== 'undefined' ? (() => {
        try {
            const raw = localStorage.getItem('red_pending_contact_requests');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    })() : [],

    blockedNodes: typeof window !== 'undefined' ? (() => {
        try {
            const raw = localStorage.getItem('red_blocked_nodes');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    })() : [],

    activeContactRequestModal: null,

    selectedContactForProfile: null,

    setSelectedContactForProfile: (contact) => set({ selectedContactForProfile: contact }),

    acceptContactRequest: async (req: PendingContactRequest) => {
        const { pendingContactRequests, identity } = get();
        // Remove from pending
        const updated = pendingContactRequests.filter(r => r.id !== req.id);
        if (typeof window !== 'undefined') {
            try { localStorage.setItem('red_pending_contact_requests', JSON.stringify(updated)); } catch {}
        }
        set({ pendingContactRequests: updated, activeContactRequestModal: updated[0] || null });
        // Persist contact
        try {
            await RedAPI.addContact(req.senderHash, req.senderName, req.senderPk);
        } catch {
            const existing = get().contacts || [];
            if (!existing.find((c: any) => c.identity_hash === req.senderHash)) {
                const next = [...existing, { identity_hash: req.senderHash, display_name: req.senderName, public_key: req.senderPk }];
                set({ contacts: next });
                RedAPI.setWebStore('red_web_contacts', next);
            }
        }
        // Send contact_response
        if (identity?.identity_hash) {
            RedAPI.sendMessage(req.senderHash, JSON.stringify({
                sender_hash: identity.identity_hash,
                sender_name: identity.nickname || 'Operador RED',
                sender_pk: identity.public_key || null
            }), { msg_type: 'contact_response' }).catch(() => {});
        }
        toast.success(`✅ ${req.senderName} agregado a tus contactos`);
        await get().fetchData();
    },

    rejectContactRequest: (req: PendingContactRequest) => {
        const updated = get().pendingContactRequests.filter(r => r.id !== req.id);
        if (typeof window !== 'undefined') {
            try { localStorage.setItem('red_pending_contact_requests', JSON.stringify(updated)); } catch {}
        }
        set({ pendingContactRequests: updated, activeContactRequestModal: updated[0] || null });
        toast.info(`❌ Solicitud de ${req.senderName} rechazada`);
    },

    blockNode: (hash: string) => {
        const current = get().blockedNodes || [];
        if (current.includes(hash)) return;
        const next = [...current, hash];
        if (typeof window !== 'undefined') {
            try { localStorage.setItem('red_blocked_nodes', JSON.stringify(next)); } catch {}
        }
        // Also remove from pending
        const pending = get().pendingContactRequests.filter(r => r.senderHash !== hash && !r.senderHash.startsWith(hash.slice(0, 8)));
        if (typeof window !== 'undefined') {
            try { localStorage.setItem('red_pending_contact_requests', JSON.stringify(pending)); } catch {}
        }
        set({ blockedNodes: next, pendingContactRequests: pending, activeContactRequestModal: pending[0] || null });
        toast.warning(`🚫 Nodo bloqueado. No podrá contactarte nuevamente.`);
    },

    unblockNode: (hash: string) => {
        const next = get().blockedNodes.filter(h => h !== hash);
        if (typeof window !== 'undefined') {
            try { localStorage.setItem('red_blocked_nodes', JSON.stringify(next)); } catch {}
        }
        set({ blockedNodes: next });
        toast.info('Nodo desbloqueado');
    },

    deleteContact: async (hash: string) => {
        const target = hash.toLowerCase();
        const existing = get().contacts || [];
        const next = existing.filter((c: any) => {
            const cHash = (c.identity_hash || '').toLowerCase();
            if (cHash === target) return false;
            if (target.length >= 8 && cHash.startsWith(target.slice(0, 8))) return false;
            if (cHash.length >= 8 && target.startsWith(cHash.slice(0, 8))) return false;
            return true;
        });
        set({ contacts: next });
        RedAPI.setWebStore('red_web_contacts', next);
        // Also purge conversation
        const convs = get().conversations || [];
        const nextConvs = convs.filter(c => {
            const cPeer = (c.peer || '').toLowerCase();
            const cId = (c.id || '').toLowerCase();
            if (cPeer === target || cId === target) return false;
            if (target.length >= 8 && (cPeer.startsWith(target.slice(0, 8)) || cId.startsWith(target.slice(0, 8)))) return false;
            if (cPeer.length >= 8 && target.startsWith(cPeer.slice(0, 8))) return false;
            return true;
        });
        set({ conversations: nextConvs });
        RedAPI.setWebStore('red_web_conversations', nextConvs);
        try { await RedAPI.req(`/contacts/${hash}`, { method: 'DELETE' }); } catch {}
        toast.info('🗑️ Contacto eliminado');
    },

    dismissContactRequestModal: () => set({ activeContactRequestModal: null }),

    // Real-time Mesh SSE Events State,

    addContact: async (identity_hash: string, display_name: string, public_key?: string | null) => {
        const inputStr = identity_hash.trim();
        let cleanName = display_name ? display_name.trim() : '';

        let cleanHash = inputStr;
        let pubKey: string | null = public_key ?? null;

        // 1. Parse did:red:<hash>:<pk> or did:red:<hash> or <hash>:<pk> or red_<shortId>
        if (inputStr.startsWith("did:red:")) {
            const withoutScheme = inputStr.slice(8);
            const parts = withoutScheme.split(":");
            cleanHash = parts[0].trim();
            if (parts.length >= 2 && parts[1] && !pubKey) {
                pubKey = parts[1].trim();
            }
        } else if (inputStr.includes(":") && !/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/i.test(inputStr)) {
            const parts = inputStr.split(":");
            if (parts[0].length >= 16) {
                cleanHash = parts[0].trim();
                if (parts[1] && !pubKey) {
                    pubKey = parts[1].trim();
                }
            }
        }

        // 2. Resolve canonical hash from meshRouter if input is a hardware device ID (BLE MAC / UUID)
        const canonicalFromMesh = meshRouter.getCanonicalId(cleanHash);
        if (canonicalFromMesh && canonicalFromMesh.length === 64) {
            cleanHash = canonicalFromMesh;
        }

        // Check active peers in MeshRouter to extract public key or canonical DID
        const peerInfo = meshRouter.getPeerByAnyId(cleanHash) || meshRouter.getPeerByAnyId(inputStr);
        if (peerInfo) {
            if (peerInfo.canonicalId && peerInfo.canonicalId.length === 64) {
                cleanHash = peerInfo.canonicalId;
            }
            if (peerInfo.publicKey && !pubKey) {
                pubKey = peerInfo.publicKey;
            }
            if (peerInfo.name && (!cleanName || cleanName.startsWith('Nodo ') || cleanName.startsWith('Operador ') || cleanName === 'Par Malla')) {
                cleanName = peerInfo.name;
            }
        }

        const isGenericName = (name?: string) => !name || 
            name.startsWith('Operador ') || 
            name.startsWith('Nodo ') || 
            name.startsWith('Par Escaneado') || 
            name.startsWith('Dispositivo RED') ||
            name === 'Nuevo Par' || 
            name === 'Par Malla';

        if (!cleanName || cleanName === "Nuevo Par" || cleanName === "Operador RED" || cleanName === "Par Malla") {
            cleanName = `Nodo ${cleanHash.slice(0, 8)}`;
        }

        const localContact = {
            identity_hash: cleanHash,
            display_name: cleanName,
            public_key: pubKey
        };

        // 3. Smart Deduplication & Merging with zero lag
        const currentContacts = get().contacts || [];
        const existingIdx = currentContacts.findIndex(c => {
            if (!c) return false;
            const cHash = (c.identity_hash || '').toLowerCase();
            const targetHash = cleanHash.toLowerCase();
            const rawTarget = inputStr.toLowerCase();

            // A. Exact hash match
            if (cHash === targetHash || cHash === rawTarget) return true;

            // B. Mesh canonical equivalence
            const cCanonical = meshRouter.getCanonicalId(cHash);
            if (cCanonical && targetHash && cCanonical.toLowerCase() === targetHash) return true;

            // C. Prefix match for 64-char hashes
            if (cHash.length === 64 && targetHash.length === 64 && cHash.slice(0, 16) === targetHash.slice(0, 16)) return true;

            // D. Non-generic display name match (e.g. "Tab", "Moto G22", "Lenovo")
            if (!isGenericName(cleanName) && !isGenericName(c.display_name)) {
                const cName = c.display_name.trim().toLowerCase();
                const nName = cleanName.trim().toLowerCase();
                if (cName === nName || cName === `red-${nName}` || `red-${cName}` === nName) {
                    return true;
                }
            }

            return false;
        });

        let updatedContacts = [...currentContacts];
        const currentConvs = get().conversations || [];
        let updatedConvs = [...currentConvs];

        if (existingIdx >= 0) {
            const currentEntry = updatedContacts[existingIdx];
            const oldHash = currentEntry.identity_hash;
            const resolvedHash = (cleanHash.length === 64 && /^[0-9a-fA-F]+$/.test(cleanHash)) 
                ? cleanHash 
                : (currentEntry.identity_hash.length === 64 ? currentEntry.identity_hash : cleanHash);
            const resolvedName = !isGenericName(cleanName) ? cleanName : currentEntry.display_name;
            const resolvedPk = pubKey || currentEntry.public_key;

            updatedContacts[existingIdx] = { 
                ...currentEntry, 
                identity_hash: resolvedHash, 
                display_name: resolvedName, 
                public_key: resolvedPk 
            };

            // Migrate conversations and messages seamlessly
            if (oldHash && oldHash !== resolvedHash) {
                updatedConvs = updatedConvs.map(conv => {
                    if (conv.id === oldHash || conv.peer === oldHash) {
                        return { ...conv, id: resolvedHash, peer: resolvedHash };
                    }
                    return conv;
                });
            }
            cleanHash = resolvedHash;
        } else {
            updatedContacts.push(localContact);
        }

        // 4. Ensure conversation entry exists in active chat list
        if (!updatedConvs.some(c => c.id === cleanHash || c.peer === cleanHash)) {
            updatedConvs.unshift({
                id: cleanHash,
                peer: cleanHash,
                last_message: 'Contacto agregado. Chat P2P cifrado listo.',
                last_timestamp: Date.now() / 1000,
                unread_count: 0
            });
        }

        set({ contacts: updatedContacts, conversations: updatedConvs });

        // Save in localStorage WebStore for persistence across refreshes
        RedAPI.setWebStore('red_web_contacts', updatedContacts);
        RedAPI.setWebStore('red_web_conversations', updatedConvs);

        // 5. Proactively announce identity & initiate WebRTC P2P link over meshRouter
        meshRouter.sendIdentityAnnounce(cleanHash).catch(() => {});

        try {
            await RedAPI.addContact(cleanHash, cleanName, pubKey);
        } catch (err) {
            console.log(`[addContact] Local P2P contact registered: ${cleanHash.slice(0, 8)}`);
        }

        // 6. Send background contact request to peer so they automatically add us back!
        const myIdentity = get().identity;
        const myName = myIdentity?.nickname || 'Operador RED';
        if (myIdentity?.identity_hash) {
            _processedHandshakes.add(`${cleanHash.toLowerCase()}_res`);
            RedAPI.sendMessage(cleanHash, JSON.stringify({
                sender_hash: myIdentity.identity_hash,
                sender_name: myName,
                sender_pk: myIdentity.public_key || null
            }), { msg_type: 'contact_request' }).catch(() => {});
        }

        return cleanHash;
    },

    // ── A2: Delete message ────────────────────────────────────────────────────,

    connectPeer: async (multiaddr: string) => {
        const ok = await RedAPI.connectPeer(multiaddr);
        if (ok) {
            get().fetchData().catch(() => {});
        }
        return ok;
    },
});
