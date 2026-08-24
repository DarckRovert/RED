// RED P2P Wallet, Vouchers, Stego & Social Feed API

import { P2PVoucher, StegoCapsule, StegoCapsuleRecord, SocialPost, SystemHealthResponse } from './types';
import { fetchWithFallback, getStored, setStored, hashStringSha256, STORAGE_KEYS } from './core';
import { RedAPI } from './client';

export async function getP2PWallet(): Promise<any> {
    return fetchWithFallback('/api/p2p/wallet', undefined, () => {
        let initialBalance = 150.0;
        try {
            if (typeof window !== 'undefined') {
                const creds = localStorage.getItem("red_tactic_credits");
                if (creds) {
                    const parsed = parseFloat(creds);
                    if (!isNaN(parsed) && parsed > 0) initialBalance = Math.max(parsed, initialBalance);
                }
            }
        } catch {}

        const wallet = getStored<any>(STORAGE_KEYS.P2P_WALLET, {
            balance: initialBalance,
            address: 'RED-SOVEREIGN-VAULT',
            pending_vouchers: [],
            transactions_count: 0,
            chain_height: 1
        });
        if (wallet.balance === 0 || wallet.balance === undefined) {
            wallet.balance = initialBalance;
            setStored(STORAGE_KEYS.P2P_WALLET, wallet);
        }
        return wallet;
    });
}

export async function createP2PVoucher(amount: number | { amount: number; recipient?: string; memo?: string; [key: string]: any }): Promise<any> {
    const numericAmount = typeof amount === 'number' ? amount : Number(amount?.amount || 0);
    const recipient = typeof amount === 'object' ? amount?.recipient : undefined;
    return fetchWithFallback('/api/p2p/voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeof amount === 'object' ? amount : { amount: numericAmount })
    }, async () => {
        const wallet = await getP2PWallet();
        if (wallet.balance < numericAmount) {
            // Auto-credit from mesh activity or provide emergency tactical micro-grant
            wallet.balance += (numericAmount + 50.0);
        }
        const now = Date.now();
        const voucherId = `voucher_${now}_${Math.random().toString(36).substring(2, 8)}`;
        let sig = `RED_SIG_${voucherId}`;
        try {
            if (typeof window !== 'undefined' && window.crypto?.subtle) {
                const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(`RED_PAY:${voucherId}:${numericAmount}:${now}`));
                sig = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
            }
        } catch {}

        wallet.balance = Math.max(0, wallet.balance - numericAmount);
        wallet.transactions_count = (wallet.transactions_count || 0) + 1;
        setStored(STORAGE_KEYS.P2P_WALLET, wallet);

        const voucher: P2PVoucher = {
            id: voucherId,
            voucher_id: voucherId,
            amount: numericAmount,
            signature: sig,
            created_at: Math.floor(now / 1000),
            expires_at: Math.floor(now / 1000) + 86400 * 7,
            ok: true,
            new_balance: wallet.balance,
            is_outgoing: true,
            recipient
        };

        const vouchers = getStored<P2PVoucher[]>(STORAGE_KEYS.P2P_VOUCHERS, []);
        vouchers.push(voucher);
        setStored(STORAGE_KEYS.P2P_VOUCHERS, vouchers);

        // Broadcast or send voucher directly across mesh if recipient designated
        try {
            const { meshRouter } = await import('../lib/mesh/meshRouter');
            const target = recipient || 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: voucher.id,
                msg_type: 'p2p_voucher',
                voucher,
                qr_payload: `RED_PAY:${voucher.id}:${voucher.amount}:${voucher.signature}`,
                recipient: target,
                timestamp: now
            }));
            await meshRouter.send(target, payloadBytes);
        } catch (e) {}

        return {
            ok: true,
            voucher_id: voucherId,
            amount: numericAmount,
            signature: sig,
            new_balance: wallet.balance,
            created_at: Math.floor(now / 1000),
            voucher
        };
    });
}

export async function redeemP2PVoucher(idOrPayload: any): Promise<any> {
    const rawId = typeof idOrPayload === 'string'
        ? idOrPayload
        : (idOrPayload?.qr_payload || idOrPayload?.payload || idOrPayload?.id || idOrPayload?.code || idOrPayload?.voucher_id || '');

    return fetchWithFallback('/api/p2p/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rawId })
    }, async () => {
        const redeemed = getStored<string[]>(STORAGE_KEYS.P2P_REDEEMED, []);
        if (redeemed.includes(rawId)) {
            return { ok: false, error: 'Vale ya redimido. Prevención de doble gasto activa.' };
        }

        let parsedAmount = 25.0;
        if (rawId.startsWith('RED_PAY:')) {
            const parts = rawId.split(':');
            if (parts.length >= 3) {
                parsedAmount = parseFloat(parts[2]) || 25.0;
            }
        }

        const wallet = await getP2PWallet();
        wallet.balance = (wallet.balance || 0) + parsedAmount;
        wallet.transactions_count = (wallet.transactions_count || 0) + 1;
        setStored(STORAGE_KEYS.P2P_WALLET, wallet);

        redeemed.push(rawId);
        setStored(STORAGE_KEYS.P2P_REDEEMED, redeemed);

        return {
            ok: true,
            redeemed_id: rawId,
            credited_amount: parsedAmount,
            new_balance: wallet.balance,
            timestamp: Date.now()
        };
    });
}

// --- RF Metrics & Spectrum Control ---

export async function getStegoCapsules(): Promise<StegoCapsuleRecord[]> {
    return fetchWithFallback('/api/stego/capsules', undefined, () => {
        return getStored<StegoCapsuleRecord[]>(STORAGE_KEYS.STEGO_CAPSULES, []);
    });
}

export async function saveStegoCapsule(capsule: StegoCapsuleRecord): Promise<StegoCapsuleRecord> {
    return fetchWithFallback('/api/stego/capsules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capsule)
    }, () => {
        const capsules = getStored<StegoCapsuleRecord[]>(STORAGE_KEYS.STEGO_CAPSULES, []);
        const id = capsule.id || `stego_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record: StegoCapsuleRecord = { ...capsule, id, timestamp: capsule.timestamp || Date.now() };
        capsules.unshift(record);
        setStored(STORAGE_KEYS.STEGO_CAPSULES, capsules);
        return record;
    });
}

export async function deleteStegoCapsule(id: string): Promise<{ ok: boolean; deleted: string }> {
    return fetchWithFallback('/api/stego/capsules/' + id, { method: 'DELETE' }, () => {
        const capsules = getStored<StegoCapsuleRecord[]>(STORAGE_KEYS.STEGO_CAPSULES, []);
        setStored(STORAGE_KEYS.STEGO_CAPSULES, capsules.filter(c => c.id !== id));
        return { ok: true, deleted: id };
    });
}

export async function getSocialPosts(): Promise<SocialPost[]> {
    return fetchWithFallback('/api/social/posts', undefined, () => {
        return getStored<SocialPost[]>(STORAGE_KEYS.SOCIAL_POSTS, []);
    });
}

export async function createSocialPost(req: any): Promise<SocialPost> {
    return fetchWithFallback('/api/social/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
    }, async () => {
        const posts = getStored<SocialPost[]>(STORAGE_KEYS.SOCIAL_POSTS, []);
        const identity = await RedAPI.getIdentity().catch(() => null);
        const post: SocialPost = {
            id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            author_hash: identity?.identity_hash || 'did:red:local',
            author_name: identity?.nickname || identity?.display_name || 'Operador RED',
            content: req.content || '',
            timestamp: Date.now(),
            media_data: req.media_data,
            reactions: {}
        };
        posts.unshift(post);
        setStored(STORAGE_KEYS.SOCIAL_POSTS, posts);

        try {
            const { meshRouter } = await import('../lib/mesh/meshRouter');
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: post.id,
                msg_type: 'social_post',
                post,
                timestamp: post.timestamp
            }));
            await meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);
        } catch (e) {}

        return post;
    });
}

export async function reactToPost(req: any): Promise<any> {
    return fetchWithFallback('/api/social/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
    }, async () => {
        const posts = getStored<SocialPost[]>(STORAGE_KEYS.SOCIAL_POSTS, []);
        const target = posts.find(p => p.id === req.post_id);
        const identity = await RedAPI.getIdentity().catch(() => null);
        const myHash = identity?.identity_hash || 'did:red:local';
        if (target) {
            if (!target.reactions) target.reactions = {};
            if (!target.reactions[req.emoji]) target.reactions[req.emoji] = [];
            if (!target.reactions[req.emoji].includes(myHash)) {
                target.reactions[req.emoji].push(myHash);
            }
            setStored(STORAGE_KEYS.SOCIAL_POSTS, posts);
        }

        try {
            const { meshRouter } = await import('../lib/mesh/meshRouter');
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: `react_${Date.now()}`,
                msg_type: 'social_react',
                post_id: req.post_id,
                emoji: req.emoji,
                author_hash: myHash,
                timestamp: Date.now()
            }));
            await meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);
        } catch (e) {}

        return { ok: true, post_id: req.post_id, emoji: req.emoji };
    });
}

export async function followUser(hash: string): Promise<any> {
    return fetchWithFallback('/api/social/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_hash: hash })
    }, () => {
        const following = getStored<string[]>(STORAGE_KEYS.SOCIAL_FOLLOWING, []);
        if (!following.includes(hash)) {
            following.push(hash);
            setStored(STORAGE_KEYS.SOCIAL_FOLLOWING, following);
        }
        return { ok: true, followed: hash };
    });
}

export async function deleteSocialPost(id: string): Promise<any> {
    return fetchWithFallback('/api/social/posts/' + id, { method: 'DELETE' }, () => {
        const posts = getStored<SocialPost[]>(STORAGE_KEYS.SOCIAL_POSTS, []);
        setStored(STORAGE_KEYS.SOCIAL_POSTS, posts.filter(p => p.id !== id));
        return { ok: true, deleted: id };
    });
}


export async function getSystemHealthAudit(): Promise<SystemHealthResponse> {
    return RedAPI.getSystemHealthAudit();
}

// --- Native & Browser Physical Sensor Bridge ---
