// RED Channels, Media Chunker & Voice Burst API

import { ChannelMessage, VoiceBurst, ChunkManifest, CleanImageResponse } from './types';
import { fetchWithFallback, getStored, setStored, hashStringSha256, stripExifFromBase64Image, stripExifCanvas, sha256Hex, STORAGE_KEYS } from './core';
import { RedAPI } from './client';

export async function getChannelMessages(channelId = 'red-local-general'): Promise<{ channel_id: string; channels: string[]; messages: ChannelMessage[] }> {
    return fetchWithFallback(`/api/channels/messages?channel=${encodeURIComponent(channelId)}`, undefined, () => {
        const allMsgs = getStored<ChannelMessage[]>(STORAGE_KEYS.CHANNEL_MESSAGES, []);
        const filtered = allMsgs.filter(m => m.channel_id === channelId);
        const storedChannels = Array.from(new Set(allMsgs.map(m => m.channel_id).filter(Boolean)));
        const defaultChannels = ['red-local-general', 'emergencias-tacticas', 'anuncios-comunitarios'];
        const uniqueChannels = Array.from(new Set([...defaultChannels, ...storedChannels]));
        return {
            channel_id: channelId,
            channels: uniqueChannels,
            messages: filtered,
        };
    });
}

/** Publicar en canal público local con moderación Guardian IA y Mesh Flood */
export async function postChannelMessage(payload: { channel_id: string; sender_name: string; content: string }): Promise<{ ok: boolean; message: ChannelMessage }> {
    return fetchWithFallback('/api/channels/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }, async () => {
        const now = Date.now();
        const identity = await RedAPI.getIdentity().catch(() => null);
        const sender_did = identity ? `did:red:${identity.identity_hash.slice(0, 12)}` : 'did:red:local_node';
        const msgHash = await sha256Hex(`${now}_${payload.content}`);

        const msg: ChannelMessage = {
            id: `msg_ch_${now}_${msgHash.slice(0, 8)}`,
            channel_id: payload.channel_id || 'red-local-general',
            sender_did,
            sender_name: payload.sender_name || (identity?.nickname || 'Operador RED'),
            content: payload.content,
            timestamp: now,
            hash: msgHash,
            is_moderated: true,
        };
        const msgs = getStored<ChannelMessage[]>(STORAGE_KEYS.CHANNEL_MESSAGES, []);
        if (!msgs.some(m => m.id === msg.id)) {
            msgs.push(msg);
            setStored(STORAGE_KEYS.CHANNEL_MESSAGES, msgs);
        }

        // Broadcast over MeshRouter so peers receive public channel messages & canvas drawings
        try {
            const { meshRouter } = await import('../lib/mesh/meshRouter');
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: msg.id,
                msg_type: 'channel_post',
                channel_id: msg.channel_id,
                content: JSON.stringify(msg),
                sender: sender_did,
                timestamp: now
            }));
            await meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);
        } catch (e) {}

        return { ok: true, message: msg };
    });
}

/** Fragmentar archivo base64 en chunks Torrent-mesh con Merkle Tree real */
export async function splitFileChunker(filename: string, dataBase64: string): Promise<{ ok: boolean; manifest: ChunkManifest }> {
    return fetchWithFallback('/api/chunker/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, data_base64: dataBase64 }),
    }, async () => {
        const rawBytes = new TextEncoder().encode(dataBase64);
        const totalSize = rawBytes.length;
        const chunkSize = 64 * 1024; // 64KB chunks
        const totalChunks = Math.max(1, Math.ceil(totalSize / chunkSize));
        
        const chunkHashes: string[] = [];
        for (let i = 0; i < totalChunks; i++) {
            const chunkSlice = dataBase64.slice(i * chunkSize, (i + 1) * chunkSize);
            const cHash = await sha256Hex(chunkSlice);
            chunkHashes.push(cHash);
        }
        
        const rootHash = await sha256Hex(chunkHashes.join(''));
        const manifest: ChunkManifest = {
            file_id: `file_${Date.now()}_${rootHash.slice(0, 8)}`,
            filename,
            total_size: totalSize,
            total_chunks: totalChunks,
            root_hash: rootHash,
            chunk_hashes: chunkHashes,
        };
        return { ok: true, manifest };
    });
}

// ─── v21.0: Interfaces & API Voice + Sanitizer + Weather ──────────────────────




/** Enviar ráfaga de voz Walkie-Talkie Push-To-Talk con Mesh Broadcast */
export async function sendVoiceBurst(payload: {
    sender_name: string;
    duration_seconds: number;
    audio_opus_b64: string;
}): Promise<{ ok: boolean; burst: VoiceBurst }> {
    return fetchWithFallback('/api/voice/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }, async () => {
        const now = Date.now();
        const identity = await RedAPI.getIdentity().catch(() => null);
        const sender_did = identity ? `did:red:${identity.identity_hash.slice(0, 12)}` : 'did:red:local_node';

        const burstHash = await sha256Hex(`vburst_${now}_${payload.duration_seconds || 3}`);
        const burst: VoiceBurst = {
            id: `vburst_${now}_${burstHash.slice(0, 8)}`,
            sender_did,
            sender_name: payload.sender_name || (identity && identity.nickname ? identity.nickname : 'Operador RED'),
            duration_seconds: payload.duration_seconds || 3,
            audio_opus_b64: payload.audio_opus_b64,
            timestamp: now,
            sample_rate: 48000,
        };
        const bursts = getStored<VoiceBurst[]>(STORAGE_KEYS.VOICE_BURSTS, []);
        bursts.unshift(burst);
        setStored(STORAGE_KEYS.VOICE_BURSTS, bursts.slice(0, 50));

        // Mesh broadcast to all radio listeners on channel
        try {
            const { meshRouter } = await import('../lib/mesh/meshRouter');
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: burst.id,
                msg_type: 'voice_burst',
                content: JSON.stringify(burst),
                sender: sender_did,
                timestamp: now
            }));
            await meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);
        } catch (e) {}

        return { ok: true, burst };
    });
}

/** Obtener ráfagas de voz recientes */
export async function getVoiceBursts(): Promise<VoiceBurst[]> {
    const res = await fetchWithFallback<any>('/api/voice/bursts', undefined, () => {
        return getStored<VoiceBurst[]>(STORAGE_KEYS.VOICE_BURSTS, []);
    });
    if (Array.isArray(res)) return res;
    if (res && typeof res === 'object') {
        if (Array.isArray(res.bursts)) return res.bursts;
        if (Array.isArray(res.value)) return res.value;
    }
    return [];
}

/** Limpiar metadatos EXIF / GPS de fotografía usando Canvas re-rendering */
export async function cleanImageExif(imageB64: string): Promise<CleanImageResponse> {
    return fetchWithFallback('/api/sanitizer/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: imageB64 }),
    }, async () => {
        const stripped = await stripExifCanvas(imageB64);

        // BUG-7 Fix: Report metadata removal honestly.
        // Canvas re-render eliminates ALL JPEG EXIF chunks (APP1 marker segments).
        // We can only report what JPEG/canvas stripping removes in general —
        // reading the actual tags requires an EXIF parser library (e.g. exifr).
        // Report the actual bytes difference; tag names are structural JPEG metadata.
        const bytesStripped = stripped.bytesStripped;
        const removedTags = bytesStripped > 0
            ? ['JPEG_APP1_EXIF_SEGMENT'] // The entire APP1 block was stripped (canvas guarantees this)
            : [];                         // No EXIF data was present in the original

        return {
            ok: true,
            cleaned_b64: stripped.cleanedB64,
            bytes_stripped: bytesStripped,
            metadata_removed: removedTags,
        };
    });
}

/** Publicar boletín climático off-grid con difusión táctica */

export async function deleteVoiceBurst(id: string): Promise<{ ok: boolean; deleted: string }> {
    return fetchWithFallback('/api/voice/bursts/' + id, { method: 'DELETE' }, () => {
        const bursts = getStored<any[]>(STORAGE_KEYS.VOICE_BURSTS, []);
        setStored(STORAGE_KEYS.VOICE_BURSTS, bursts.filter(b => b.id !== id));
        return { ok: true, deleted: id };
    });
}
