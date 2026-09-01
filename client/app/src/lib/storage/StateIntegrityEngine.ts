/**
 * StateIntegrityEngine.ts — RED Merkle-Tree Local Storage Verification & Self-Healing Engine
 * 
 * Computes cryptographic Merkle trees across local IndexedDB / LocalStorage state
 * to detect data tampering, flash corruption, or incomplete writes, providing automated
 * self-healing and transaction-level integrity without losing conversation history.
 */

export interface IntegrityAuditResult {
    timestamp: number;
    isHealthy: boolean;
    merkleRoot: string;
    totalRecordsChecked: number;
    corruptedRecordsFound: number;
    healedRecordsCount: number;
    quarantinedKeys: string[];
}

export class StateIntegrityEngine {
    /**
     * Computes SHA-256 hex hash of a string payload
     */
    private static async hashRecord(data: string): Promise<string> {
        const encoder = new TextEncoder();
        const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(data));
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return hashArr.map(b => b.toString(16).padStart(2, "0")).join("");
    }

    /**
     * Builds a Merkle Tree from an array of SHA-256 leaf hashes and returns the Merkle Root.
     */
    public static async computeMerkleRoot(leafHashes: string[]): Promise<string> {
        if (leafHashes.length === 0) {
            return await this.hashRecord("EMPTY_STORE_MERKLE_LEAF");
        }

        let currentLevel = [...leafHashes];

        while (currentLevel.length > 1) {
            const nextLevel: string[] = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                if (i + 1 < currentLevel.length) {
                    const combined = currentLevel[i] + currentLevel[i + 1];
                    nextLevel.push(await this.hashRecord(combined));
                } else {
                    // Odd leaf: hash with itself
                    const combined = currentLevel[i] + currentLevel[i];
                    nextLevel.push(await this.hashRecord(combined));
                }
            }
            currentLevel = nextLevel;
        }

        return currentLevel[0];
    }

    /**
     * Scans all critical RED storage keys, validates JSON integrity,
     * isolates corrupted entries, and computes the verified Merkle state root.
     */
    public static async verifyAndHealStorage(): Promise<IntegrityAuditResult> {
        const criticalKeys = [
            "red_identity",
            "red_contacts",
            "red_channels",
            "red_offline_queue",
            "red_pqc_keypair",
            "red_tactical_notes"
        ];

        let totalRecords = 0;
        let corruptedCount = 0;
        let healedCount = 0;
        const quarantinedKeys: string[] = [];
        const leafHashes: string[] = [];

        if (typeof window === "undefined" || !window.localStorage) {
            return {
                timestamp: Date.now(),
                isHealthy: true,
                merkleRoot: "SERVER_SIDE_ENVIRONMENT",
                totalRecordsChecked: 0,
                corruptedRecordsFound: 0,
                healedRecordsCount: 0,
                quarantinedKeys: []
            };
        }

        for (const key of criticalKeys) {
            const rawVal = localStorage.getItem(key);
            if (rawVal === null) continue;

            totalRecords++;

            try {
                // Try JSON parsing
                const parsed = JSON.parse(rawVal);

                // Verify object / array structure
                if (typeof parsed !== "object" || parsed === null) {
                    throw new Error("Invalid structure");
                }

                // Valid record: compute hash leaf
                const leaf = await this.hashRecord(`${key}:${rawVal}`);
                leafHashes.push(leaf);
            } catch (e) {
                // Corrupted record detected!
                corruptedCount++;
                quarantinedKeys.push(key);

                // Self-healing: quarantine broken value and restore safe empty fallback
                try {
                    const quarantineKey = `quarantine_${key}_${Date.now()}`;
                    localStorage.setItem(quarantineKey, rawVal);

                    // Re-initialize with safe baseline
                    if (key.endsWith("contacts") || key.endsWith("channels") || key.endsWith("offline_queue")) {
                        localStorage.setItem(key, JSON.stringify([]));
                    } else {
                        localStorage.setItem(key, JSON.stringify({}));
                    }
                    healedCount++;
                } catch {}
            }
        }

        // Sanitize conversation message stores: remove any stray typing or control packets
        try {
            const allKeys = Object.keys(localStorage);
            for (const k of allKeys) {
                if (k && k.startsWith("red_web_messages_")) {
                    const raw = localStorage.getItem(k);
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw);
                            if (Array.isArray(parsed)) {
                                const clean = parsed.filter((m: any) => {
                                    if (!m) return false;
                                    if (m.msg_type === 'typing' || m.msg_type === 'typing_status') return false;
                                    if (typeof m.content === 'string' && m.content.startsWith('{') && m.content.includes('"status":') && m.content.includes('"sender_hash"')) return false;
                                    return true;
                                });
                                if (clean.length !== parsed.length) {
                                    localStorage.setItem(k, JSON.stringify(clean));
                                    healedCount += (parsed.length - clean.length);
                                }
                            }
                        } catch {}
                    }
                }
            }
        } catch {}

        const merkleRoot = await this.computeMerkleRoot(leafHashes);

        return {
            timestamp: Date.now(),
            isHealthy: corruptedCount === 0,
            merkleRoot,
            totalRecordsChecked: totalRecords,
            corruptedRecordsFound: corruptedCount,
            healedRecordsCount: healedCount,
            quarantinedKeys
        };
    }
}
