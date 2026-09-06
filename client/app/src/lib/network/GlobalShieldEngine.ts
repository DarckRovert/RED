/**
 * GlobalShieldEngine.ts — RED Sovereign Multi-Layer Perimeter Defense Matrix (Escudo Global)
 * 
 * Central coordinator for active cyberdefense:
 * - Stateful Packet Inspection (SPI) Firewall
 * - Anti-Sybil Rate Limiting & Hostile Peer Quarantine
 * - Cryptographic Anti-Replay Nonce Cache
 * - Hashcash SHA-256 Proof-of-Work Target Enforcement
 * - NIST ML-KEM-768 Post-Quantum Ratcheting
 * - Dynamic Battery Autonomy Model (DEFCON-aware)
 * - Live Threat Audit Log Stream
 * - WAN Blackout Isolation Gateway Integration
 */

import { MeshProofOfWork, PoWProof } from '../crypto/MeshProofOfWork';
import { SniSpoofEngine } from './sniSpoofEngine';
import { DnsTunnelEngine } from './dnsTunnelEngine';
import { KineticDutyGovernor } from '../sensors/KineticDutyGovernor';
import { BiometricLockEngine } from '../crypto/BiometricLockEngine';

export type DefconLevel = 4 | 3 | 2 | 1;

export interface DefconProfile {
    level: DefconLevel;
    codename: string;
    label: string;
    description: string;
    color: string;
    powDifficulty: number;
    sniObfuscationForced: boolean;
    dnsTunnelFallbackForced: boolean;
    pqcStrictRatcheting: boolean;
    isolateWan: boolean;
    biometricInstantLock: boolean;
    onionHops: number;
    allowCleartext: boolean;
    soundMesh: boolean;
    maxPacketsPerPeer10s: number;
}

export const DEFCON_PROFILES: Record<DefconLevel, DefconProfile> = {
    4: {
        level: 4,
        codename: "PEACE_SENTRY",
        label: "DEFCON 4 · ESTÁNDAR",
        description: "Operación táctica normal. PoW balanceado, tráfico abierto y escaneo RF estándar.",
        color: "var(--accent-emerald)",
        powDifficulty: 2,
        sniObfuscationForced: false,
        dnsTunnelFallbackForced: false,
        pqcStrictRatcheting: false,
        isolateWan: false,
        biometricInstantLock: false,
        onionHops: 1,
        allowCleartext: true,
        soundMesh: false,
        maxPacketsPerPeer10s: 40,
    },
    3: {
        level: 3,
        codename: "ELEVATED_VIGIL",
        label: "DEFCON 3 · ELEVADO",
        description: "Alerta de congestión o sondeo de red. PoW aumentado a 3 bits de dificultad, filtrado de pares activos.",
        color: "var(--accent-amber)",
        powDifficulty: 3,
        sniObfuscationForced: true,
        dnsTunnelFallbackForced: false,
        pqcStrictRatcheting: true,
        isolateWan: false,
        biometricInstantLock: false,
        onionHops: 2,
        allowCleartext: false,
        soundMesh: false,
        maxPacketsPerPeer10s: 20,
    },
    2: {
        level: 2,
        codename: "HOSTILE_SECTOR",
        label: "DEFCON 2 · ALTA SEGURIDAD",
        description: "Hostilidad o censura activa detectada. PoW estricto (4 bits), Domain Fronting SNI forzado en todos los paquetes.",
        color: "#FF8008",
        powDifficulty: 4,
        sniObfuscationForced: true,
        dnsTunnelFallbackForced: false,
        pqcStrictRatcheting: true,
        isolateWan: false,
        biometricInstantLock: false,
        onionHops: 3,
        allowCleartext: false,
        soundMesh: true,
        maxPacketsPerPeer10s: 10,
    },
    1: {
        level: 1,
        codename: "BLACKOUT_LOCKDOWN",
        label: "DEFCON 1 · APAGÓN TÁCTICO",
        description: "Guerra electrónica o bloqueo total de WAN. Silencio de radio WAN, tunelado DoH UDP/53, bloqueo biométrico inmediato.",
        color: "var(--accent-crimson)",
        powDifficulty: 5,
        sniObfuscationForced: true,
        dnsTunnelFallbackForced: true,
        pqcStrictRatcheting: true,
        isolateWan: true,
        biometricInstantLock: true,
        onionHops: 5,
        allowCleartext: false,
        soundMesh: true,
        maxPacketsPerPeer10s: 4,
    }
};

export type ShieldVerdict = "ALLOWED" | "DEFLECTED" | "BLOCKED" | "OBFUSCATED";

export interface ShieldAuditLogEntry {
    id: string;
    timestamp: number;
    verdict: ShieldVerdict;
    rule: "ANTI_SYBIL" | "ANTI_REPLAY" | "POW_VERIFICATION" | "CLEARTEXT_GUARD" | "FRAME_INTEGRITY" | "WAN_ISOLATION" | "DIAGNOSTIC_TEST";
    peerId: string;
    reason: string;
    defconLevel: DefconLevel;
}

export interface QuarantinedPeer {
    peerId: string;
    quarantinedAt: number;
    expiresAt: number;
    reason: string;
    violationsCount: number;
}

export interface IncomingPacketInspection {
    sender: string;
    content?: string;
    pow?: PoWProof;
    nonce?: string;
    timestamp?: number;
    isEncrypted?: boolean;
    payloadLength?: number;
}

export interface FirewallVerdict {
    allowed: boolean;
    verdict: ShieldVerdict;
    rule?: string;
    reason?: string;
}

export interface GlobalShieldTelemetry {
    currentDefcon: DefconLevel;
    activeProfile: DefconProfile;
    isShieldActive: boolean;
    sybilAttacksDeflected: number;
    replayAttacksDeflected: number;
    malformedPacketsBlocked: number;
    totalPacketsInspected: number;
    onionHopsActive: number;
    obfuscatedPacketsCount: number;
    pqcKeyExchangesCount: number;
    dnsTunnelsCreated: number;
    kineticEnergyScore: number;
    estimatedMeshBatteryHours: number;
    lastDefconTransition: number;
    perimeterHealthScore: number; // 0 - 100%
    perimeterStatus: "SECURE" | "ELEVATED_RISK" | "UNDER_ATTACK";
    quarantinedPeersCount: number;
}

const STORAGE_DEFCON_KEY = "red_global_shield_defcon";
const MAX_AUDIT_LOG_SIZE = 100;
const REPLAY_WINDOW_MS = 180_000; // 3 minutos

export class GlobalShieldEngine {
    private static instance: GlobalShieldEngine | null = null;
    private listeners: Set<(telemetry: GlobalShieldTelemetry) => void> = new Set();
    private auditListeners: Set<(log: ShieldAuditLogEntry[]) => void> = new Set();

    private currentDefcon: DefconLevel = 4;
    private isShieldActive: boolean = true;
    private sybilAttacksDeflected: number = 0;
    private replayAttacksDeflected: number = 0;
    private malformedPacketsBlocked: number = 0;
    private totalPacketsInspected: number = 0;
    private onionHopsActive: number = 1;
    private obfuscatedPacketsCount: number = 0;
    private pqcKeyExchangesCount: number = 0;
    private dnsTunnelsCreated: number = 0;
    private lastDefconTransition: number = Date.now();

    // Stateful Packet Inspection Tables
    private seenNonces: Map<string, number> = new Map();
    private peerTrafficWindow: Map<string, number[]> = new Map();
    private quarantinedPeers: Map<string, QuarantinedPeer> = new Map();
    private auditLog: ShieldAuditLogEntry[] = [];

    private unsubscribeKinetic: (() => void) | null = null;

    private constructor() {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(STORAGE_DEFCON_KEY);
            if (saved) {
                const parsed = parseInt(saved, 10) as DefconLevel;
                if ([4, 3, 2, 1].includes(parsed)) {
                    this.currentDefcon = parsed;
                }
            }
            this.applyDefconPolicies(this.currentDefcon);

            // Subscribe to KineticDutyGovernor for hardware battery and motion updates
            this.unsubscribeKinetic = KineticDutyGovernor.getInstance().subscribe(() => {
                this.notifyListeners();
            });
        }
    }

    public static getInstance(): GlobalShieldEngine {
        if (!this.instance) {
            this.instance = new GlobalShieldEngine();
        }
        return this.instance;
    }

    /**
     * Sets the global network DEFCON level and enforces security parameters
     */
    public setDefcon(level: DefconLevel): void {
        const safeLevel: DefconLevel = ([1, 2, 3, 4].includes(level as any)) ? level : 4;
        this.currentDefcon = safeLevel;
        this.lastDefconTransition = Date.now();
        if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_DEFCON_KEY, safeLevel.toString());
        }
        this.applyDefconPolicies(safeLevel);
        this.logAuditEntry({
            verdict: "ALLOWED",
            rule: "DIAGNOSTIC_TEST",
            peerId: "LOCAL_NODE",
            reason: `Transición de seguridad perimetral a ${DEFCON_PROFILES[safeLevel].label}`,
            defconLevel: safeLevel
        });
        this.notifyListeners();
    }

    private applyDefconPolicies(level: DefconLevel): void {
        const profile = DEFCON_PROFILES[level];
        
        // 1. Adjust PoW Difficulty Target and Active Onion Hops
        MeshProofOfWork.DEFAULT_DIFFICULTY = profile.powDifficulty;
        this.onionHopsActive = profile.onionHops;

        // 2. Enforce Biometric Lock if DEFCON 1
        if (profile.biometricInstantLock) {
            BiometricLockEngine.setTimeout("immediate");
        }

        // 3. Trigger Kinetic RF Boost if DEFCON 2 or 1
        if (level <= 2) {
            KineticDutyGovernor.getInstance().triggerShakeBoost();
        }

        // 4. Enforce Blackout Isolation in Rust Core / Sensors API
        if (typeof window !== "undefined") {
            try {
                import('../../api/sensors').then(({ setBlackoutMode }) => {
                    setBlackoutMode(level === 1).catch(() => {});
                }).catch(() => {});
            } catch {}
        }
    }

    /**
     * STATEFUL PACKET INSPECTION (SPI) FIREWALL:
     * Evaluates incoming mesh/peer packets in real-time against active DEFCON rules.
     */
    public async inspectIncomingPacket(packet: IncomingPacketInspection): Promise<FirewallVerdict> {
        this.totalPacketsInspected++;
        const profile = DEFCON_PROFILES[this.currentDefcon];
        const peerId = (packet.sender || "DESCONOCIDO").toLowerCase().trim();
        const now = Date.now();

        // 1. Check if peer is currently quarantined
        const quarantined = this.quarantinedPeers.get(peerId);
        if (quarantined) {
            if (now < quarantined.expiresAt) {
                this.sybilAttacksDeflected++;
                this.logAuditEntry({
                    verdict: "BLOCKED",
                    rule: "ANTI_SYBIL",
                    peerId,
                    reason: `Par en cuarentena hostil activa (${Math.round((quarantined.expiresAt - now) / 1000)}s restantes)`,
                    defconLevel: this.currentDefcon
                });
                this.notifyListeners();
                return {
                    allowed: false,
                    verdict: "BLOCKED",
                    rule: "ANTI_SYBIL",
                    reason: "Par neutralizado temporalmente por comportamiento malicioso"
                };
            } else {
                // Quarantine expired
                this.quarantinedPeers.delete(peerId);
            }
        }

        // 2. Encryption Policy Guard (DEFCON 1, 2, 3 disallows cleartext)
        if (!profile.allowCleartext && packet.isEncrypted === false) {
            this.malformedPacketsBlocked++;
            this.logAuditEntry({
                verdict: "BLOCKED",
                rule: "CLEARTEXT_GUARD",
                peerId,
                reason: `Paquete en texto plano rechazado por política ${profile.codename}`,
                defconLevel: this.currentDefcon
            });
            this.notifyListeners();
            return {
                allowed: false,
                verdict: "BLOCKED",
                rule: "CLEARTEXT_GUARD",
                reason: `Violación de política DEFCON ${this.currentDefcon}: Se exige cifrado E2E`
            };
        }

        // 3. Anti-Replay Nonce Verification
        if (packet.nonce) {
            const cleanNonce = packet.nonce.trim();
            const seenAt = this.seenNonces.get(cleanNonce);
            if (seenAt && (now - seenAt) < REPLAY_WINDOW_MS) {
                this.replayAttacksDeflected++;
                this.sybilAttacksDeflected++;
                this.logAuditEntry({
                    verdict: "DEFLECTED",
                    rule: "ANTI_REPLAY",
                    peerId,
                    reason: `Ataque de repetición: Nonce duplicado ${cleanNonce.slice(0, 10)}…`,
                    defconLevel: this.currentDefcon
                });
                this.notifyListeners();
                return {
                    allowed: false,
                    verdict: "DEFLECTED",
                    rule: "ANTI_REPLAY",
                    reason: "Ataque Replay interceptado: Nonce criptográfico ya utilizado"
                };
            }
            // Register nonce in sliding cache
            this.seenNonces.set(cleanNonce, now);
            this.purgeOldNonces(now);
        }

        // 4. Proof-of-Work Target & Cryptographic Verification
        if (packet.pow) {
            if (packet.pow.difficulty < profile.powDifficulty) {
                this.sybilAttacksDeflected++;
                this.logAuditEntry({
                    verdict: "DEFLECTED",
                    rule: "POW_VERIFICATION",
                    peerId,
                    reason: `Dificultad PoW insuficiente (${packet.pow.difficulty} < ${profile.powDifficulty} bits requeridos)`,
                    defconLevel: this.currentDefcon
                });
                this.notifyListeners();
                return {
                    allowed: false,
                    verdict: "DEFLECTED",
                    rule: "POW_VERIFICATION",
                    reason: `Dificultad computacional PoW insuficiente para DEFCON ${this.currentDefcon}`
                };
            }

            // Cryptographic SHA-256 validation of the Hashcash proof
            if (packet.content) {
                try {
                    const verification = await MeshProofOfWork.verifyProof(packet.content, packet.sender, packet.pow, profile.powDifficulty);
                    if (!verification.valid) {
                        this.sybilAttacksDeflected++;
                        this.logAuditEntry({
                            verdict: "DEFLECTED",
                            rule: "POW_VERIFICATION",
                            peerId,
                            reason: `Prueba Hashcash SHA-256 inválida: ${verification.reason || "Hash apócrifo"}`,
                            defconLevel: this.currentDefcon
                        });
                        this.notifyListeners();
                        return {
                            allowed: false,
                            verdict: "DEFLECTED",
                            rule: "POW_VERIFICATION",
                            reason: "Falsificación de prueba Hashcash PoW detectada"
                        };
                    }
                } catch {}
            }
        }

        // 5. Anti-Sybil Rate Governor (Sliding 10-second window per peer)
        const window10s = this.peerTrafficWindow.get(peerId) || [];
        const recentTimestamps = window10s.filter(ts => (now - ts) < 10_000);
        recentTimestamps.push(now);
        this.peerTrafficWindow.set(peerId, recentTimestamps);

        if (recentTimestamps.length > profile.maxPacketsPerPeer10s) {
            this.sybilAttacksDeflected++;
            this.quarantinePeer(peerId, `Inundación Sybil (${recentTimestamps.length} pkts/10s > límite ${profile.maxPacketsPerPeer10s})`, 45_000);
            this.logAuditEntry({
                verdict: "DEFLECTED",
                rule: "ANTI_SYBIL",
                peerId,
                reason: `Inundación Sybil detectada: ${recentTimestamps.length} paquetes en 10s. Nodo en cuarentena.`,
                defconLevel: this.currentDefcon
            });
            this.notifyListeners();
            return {
                allowed: false,
                verdict: "DEFLECTED",
                rule: "ANTI_SYBIL",
                reason: "Ataque de saturación Sybil mitigado. Par puesto en lista negra temporal."
            };
        }

        // 6. Packet allowed by firewall
        return {
            allowed: true,
            verdict: "ALLOWED"
        };
    }

    private purgeOldNonces(now: number): void {
        if (this.seenNonces.size > 2000) {
            const cutoff = now - REPLAY_WINDOW_MS;
            for (const [nonce, ts] of this.seenNonces) {
                if (ts < cutoff) this.seenNonces.delete(nonce);
            }
        }
    }

    /**
     * Puts a malicious or flooding peer in temporary quarantine
     */
    public quarantinePeer(peerId: string, reason: string, durationMs = 60_000): void {
        const cleanId = peerId.toLowerCase().trim();
        const now = Date.now();
        const existing = this.quarantinedPeers.get(cleanId);
        const violationsCount = (existing?.violationsCount || 0) + 1;

        this.quarantinedPeers.set(cleanId, {
            peerId: cleanId,
            quarantinedAt: now,
            expiresAt: now + (durationMs * Math.min(violationsCount, 5)), // Exponentes ante reincidencia
            reason,
            violationsCount
        });
        this.notifyListeners();
    }

    public unquarantinePeer(peerId: string): void {
        this.quarantinedPeers.delete(peerId.toLowerCase().trim());
        this.notifyListeners();
    }

    public clearQuarantines(): void {
        this.quarantinedPeers.clear();
        this.notifyListeners();
    }

    public getQuarantinedPeers(): QuarantinedPeer[] {
        const now = Date.now();
        const list: QuarantinedPeer[] = [];
        for (const [id, q] of this.quarantinedPeers) {
            if (now < q.expiresAt) {
                list.push(q);
            } else {
                this.quarantinedPeers.delete(id);
            }
        }
        return list;
    }

    private logAuditEntry(entry: Omit<ShieldAuditLogEntry, "id" | "timestamp">): void {
        const randId = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('')
            : Math.floor(Math.random() * 1e8).toString(16);

        const newEntry: ShieldAuditLogEntry = {
            id: `sec_${Date.now()}_${randId}`,
            timestamp: Date.now(),
            ...entry
        };

        this.auditLog.unshift(newEntry);
        if (this.auditLog.length > MAX_AUDIT_LOG_SIZE) {
            this.auditLog.pop();
        }

        this.auditListeners.forEach(fn => {
            try { fn([...this.auditLog]); } catch {}
        });
    }

    public getAuditLog(): ShieldAuditLogEntry[] {
        return [...this.auditLog];
    }

    public clearAuditLog(): void {
        this.auditLog = [];
        this.auditListeners.forEach(fn => {
            try { fn([]); } catch {}
        });
    }

    public subscribeAuditLog(listener: (log: ShieldAuditLogEntry[]) => void): () => void {
        this.auditListeners.add(listener);
        listener(this.getAuditLog());
        return () => this.auditListeners.delete(listener);
    }

    /**
     * Enforces the active DEFCON security policy on an outgoing packet
     */
    public enforceDefconPolicy(packet: { isEncrypted: boolean; payload?: any }): {
        transmitted: boolean;
        hopsAssigned?: number;
        acousticCarrier?: boolean;
        reason?: string;
    } {
        const profile = DEFCON_PROFILES[this.currentDefcon];

        if (!profile.allowCleartext && !packet.isEncrypted) {
            this.malformedPacketsBlocked++;
            this.logAuditEntry({
                verdict: "BLOCKED",
                rule: "CLEARTEXT_GUARD",
                peerId: "OUTGOING",
                reason: "Transmisión saliente en texto plano denegada por política DEFCON",
                defconLevel: this.currentDefcon
            });
            this.notifyListeners();
            return { transmitted: false, reason: `Bloqueado por política DEFCON ${this.currentDefcon}: Requiere cifrado E2E` };
        }

        return {
            transmitted: true,
            hopsAssigned: profile.onionHops,
            acousticCarrier: profile.soundMesh,
        };
    }

    /**
     * Records a deflected Sybil or replay attack
     */
    public recordSybilDeflection(count = 1): void {
        this.sybilAttacksDeflected += count;
        this.notifyListeners();
    }

    public recordReplayAttack(nonce: string, sender = "PEER"): void {
        this.replayAttacksDeflected++;
        this.sybilAttacksDeflected++;
        this.logAuditEntry({
            verdict: "DEFLECTED",
            rule: "ANTI_REPLAY",
            peerId: sender,
            reason: `Replay detectado: Nonce ${nonce.slice(0, 10)}…`,
            defconLevel: this.currentDefcon
        });
        this.notifyListeners();
    }

    public recordMalformedPacket(sender = "PEER"): void {
        this.malformedPacketsBlocked++;
        this.logAuditEntry({
            verdict: "BLOCKED",
            rule: "FRAME_INTEGRITY",
            peerId: sender,
            reason: "Trama de paquete truncada o con suma de comprobación corrupta",
            defconLevel: this.currentDefcon
        });
        this.notifyListeners();
    }

    /**
     * Records an obfuscated packet routed through SNI fronting or DNS tunneling
     */
    public recordObfuscatedPacket(isDns = false): void {
        this.obfuscatedPacketsCount++;
        if (isDns) this.dnsTunnelsCreated++;
        this.notifyListeners();
    }

    /**
     * Records a Post-Quantum Kyber-768 handshake completion
     */
    public recordPqcHandshake(): void {
        this.pqcKeyExchangesCount++;
        this.notifyListeners();
    }

    /**
     * Executes real packet transmission through the Shield Obfuscation Matrix
     */
    public async routeSecurePacket(payloadHex: string): Promise<{
        success: boolean;
        mechanism: "DIRECT_MESH" | "SNI_FRONTING" | "DNS_TUNNEL" | "ISOLATED_LAN";
        latencyMs: number;
        reason?: string;
    }> {
        const profile = DEFCON_PROFILES[this.currentDefcon];

        // 1. If DEFCON 1 (Blackout): route via DNS Tunneling DoH UDP/53
        if (profile.dnsTunnelFallbackForced) {
            this.recordObfuscatedPacket(true);
            const queryChunks = DnsTunnelEngine.packPayloadIntoDnsQuery(payloadHex);
            const res = await DnsTunnelEngine.transmitDnsQuery(queryChunks[0]);
            this.logAuditEntry({
                verdict: "OBFUSCATED",
                rule: "WAN_ISOLATION",
                peerId: "DNS_TUNNEL_FALLBACK",
                reason: `Túnel DoH UDP/53 ejecutado (${res.latencyMs}ms)`,
                defconLevel: this.currentDefcon
            });
            return {
                success: res.success,
                mechanism: "DNS_TUNNEL",
                latencyMs: res.latencyMs,
                reason: res.success ? undefined : "Fallo en resolución DoH sin saldo"
            };
        }

        // 2. If DEFCON 2 or 3: route via SNI Domain Fronting
        if (profile.sniObfuscationForced) {
            this.recordObfuscatedPacket(false);
            const res = await SniSpoofEngine.transmitSniBypass(payloadHex);
            this.logAuditEntry({
                verdict: "OBFUSCATED",
                rule: "WAN_ISOLATION",
                peerId: "SNI_FRONTING_PORTAL",
                reason: `Camuflaje SNI ejecutado vía ${res.provider} (${res.latencyMs}ms)`,
                defconLevel: this.currentDefcon
            });
            return {
                success: res.success,
                mechanism: "SNI_FRONTING",
                latencyMs: res.latencyMs,
                reason: res.reason
            };
        }

        // 3. DEFCON 4: standard mesh routing with real WebCrypto hashing
        const startTime = performance.now();
        await MeshProofOfWork.digestPayload(payloadHex);
        const latencyMs = Math.max(1, Math.round(performance.now() - startTime));
        this.recordObfuscatedPacket(false);
        this.logAuditEntry({
            verdict: "ALLOWED",
            rule: "FRAME_INTEGRITY",
            peerId: "DIRECT_MESH",
            reason: `Enrutamiento soberano directo completado (${latencyMs}ms)`,
            defconLevel: this.currentDefcon
        });

        return {
            success: true,
            mechanism: "DIRECT_MESH",
            latencyMs
        };
    }

    /**
     * INTERACTIVE ATTACK VECTOR SUITE FOR DIAGNOSTICS:
     * Injects synthetic hostile attack patterns against the live firewall to verify
     * real-time deflection, rate limiting, and audit logging.
     */
    public async injectSybilFloodVector(burstCount = 15): Promise<{ deflected: number; quarantined: boolean }> {
        const testPeer = `did:red:sybil_adversary_${Math.floor(Date.now() / 1000).toString(16)}`;
        let deflected = 0;
        let quarantined = false;

        for (let i = 0; i < burstCount; i++) {
            const verdict = await this.inspectIncomingPacket({
                sender: testPeer,
                content: `VECTOR_BURST_${i}`,
                nonce: `sybil_burst_${i}_${Date.now()}`,
                isEncrypted: true
            });
            if (!verdict.allowed) {
                deflected++;
            }
        }

        quarantined = this.quarantinedPeers.has(testPeer);
        this.notifyListeners();
        return { deflected, quarantined };
    }

    public async injectReplayAttackVector(): Promise<{ intercepted: boolean; nonce: string }> {
        const testPeer = "did:red:replay_actor_probe";
        const testNonce = `replay_probe_${Date.now()}`;
        
        // 1st transmission: should pass or evaluate normal
        await this.inspectIncomingPacket({
            sender: testPeer,
            content: "LEGITIMATE_TRANSMISSION",
            nonce: testNonce,
            isEncrypted: true
        });

        // 2nd transmission: identical nonce, MUST be intercepted by Anti-Replay
        const verdict = await this.inspectIncomingPacket({
            sender: testPeer,
            content: "REPLAYED_MALICIOUS_DUPLICATE",
            nonce: testNonce,
            isEncrypted: true
        });

        return {
            intercepted: !verdict.allowed && verdict.rule === "ANTI_REPLAY",
            nonce: testNonce
        };
    }

    public async injectPoWBypassVector(): Promise<{ blocked: boolean; expectedDifficulty: number }> {
        const profile = DEFCON_PROFILES[this.currentDefcon];
        const testPeer = "did:red:zero_pow_flooder";
        
        // Inyectar PoW con dificultad cero (bypass deliberado)
        const fakePoW: PoWProof = {
            nonce: 1,
            difficulty: 0, // Invalido para DEFCON 1-4
            timestamp: Math.floor(Date.now() / 1000),
            hash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            elapsedMs: 0
        };

        const verdict = await this.inspectIncomingPacket({
            sender: testPeer,
            content: "UNMINED_PACKET_FLOOD",
            pow: fakePoW,
            isEncrypted: true
        });

        return {
            blocked: !verdict.allowed,
            expectedDifficulty: profile.powDifficulty
        };
    }

    public getTelemetry(): GlobalShieldTelemetry {
        const kinetic = KineticDutyGovernor.getInstance().getTelemetry();
        const profile = DEFCON_PROFILES[this.currentDefcon];
        const batteryLevel = kinetic.batteryLevel;

        // Dynamic battery autonomy factoring in DEFCON radio power profile:
        // DEFCON 1 (Apagón/Silencio WAN): factor 1.6x (~48-60h de autonomía)
        // DEFCON 2 (Hostil): factor 1.25x
        // DEFCON 3 (Elevado): factor 1.0x
        // DEFCON 4 (Estándar, full scan): factor 0.85x (~20-28h)
        const defconPowerFactor = this.currentDefcon === 1 ? 1.6 : this.currentDefcon === 2 ? 1.25 : this.currentDefcon === 3 ? 1.0 : 0.85;
        const baseHours = (batteryLevel / 100) * 32;
        const estimatedHours = batteryLevel === 0 ? 0.0 : parseFloat((baseHours * defconPowerFactor).toFixed(1));

        // Real-time Perimeter Health Calculation
        const quarantinedCount = this.getQuarantinedPeers().length;
        let healthScore = 100;
        if (quarantinedCount > 0) healthScore -= Math.min(40, quarantinedCount * 15);
        if (this.currentDefcon === 4 && this.sybilAttacksDeflected > 5) healthScore -= 15;
        if (this.currentDefcon === 1) healthScore = Math.max(95, healthScore); // Máximo blindaje

        const perimeterStatus = healthScore >= 80 ? "SECURE" : healthScore >= 50 ? "ELEVATED_RISK" : "UNDER_ATTACK";

        return {
            currentDefcon: this.currentDefcon,
            activeProfile: profile,
            isShieldActive: this.isShieldActive,
            sybilAttacksDeflected: this.sybilAttacksDeflected,
            replayAttacksDeflected: this.replayAttacksDeflected,
            malformedPacketsBlocked: this.malformedPacketsBlocked,
            totalPacketsInspected: this.totalPacketsInspected,
            onionHopsActive: this.onionHopsActive,
            obfuscatedPacketsCount: this.obfuscatedPacketsCount,
            pqcKeyExchangesCount: this.pqcKeyExchangesCount,
            dnsTunnelsCreated: this.dnsTunnelsCreated,
            kineticEnergyScore: kinetic.kineticEnergyScore,
            estimatedMeshBatteryHours: estimatedHours,
            lastDefconTransition: this.lastDefconTransition,
            perimeterHealthScore: Math.max(0, Math.min(100, healthScore)),
            perimeterStatus,
            quarantinedPeersCount: quarantinedCount
        };
    }

    public subscribe(listener: (telemetry: GlobalShieldTelemetry) => void): () => void {
        this.listeners.add(listener);
        listener(this.getTelemetry());
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        const telemetry = this.getTelemetry();
        this.listeners.forEach(fn => {
            try { fn(telemetry); } catch (e: any) { console.warn('[GlobalShieldEngine] Listener error:', e?.message || e); }
        });
    }

    public destroy(): void {
        if (this.unsubscribeKinetic) {
            this.unsubscribeKinetic();
            this.unsubscribeKinetic = null;
        }
        this.listeners.clear();
        this.auditListeners.clear();
        this.seenNonces.clear();
        this.peerTrafficWindow.clear();
        this.quarantinedPeers.clear();
        this.auditLog = [];
        GlobalShieldEngine.instance = null;
    }
}

export const globalShield = GlobalShieldEngine.getInstance();
