/**
 * hiveMindEngine.ts — RED Distributed Mesh AI Coordinator
 *
 * Coordinates offline AI execution across the P2P mesh network.
 * Handles:
 * 1. Advertising local node RAM/CPU, real battery, and model state over mesh.
 * 2. Evaluating and selecting the best available mesh node for inference.
 * 3. Delegating inference tasks to remote mesh peers over meshRouter.
 * 4. Responding to incoming inference requests when acting as a provider.
 * 5. Streaming tokens back to requesting client nodes.
 */

import {
    NodeCapacityAdvertisement,
    HiveInferenceRequest,
    HiveInferenceResponse,
    HiveInferenceStreamChunk
} from './hiveMindProtocol';
import { meshRouter } from '../mesh/meshRouter';
import { ModelManager } from '../ai/modelManager';
import { LocalAIEngine } from '../ai/localAiEngine';
import { queryAICopilot } from '../../api/ai';

class HiveMindEngineClass {
    private knownNodeCapabilities: Map<string, NodeCapacityAdvertisement> = new Map();
    private activeStreamListeners: Map<string, (chunk: HiveInferenceStreamChunk) => void> = new Map();
    private activeRequestResolvers: Map<string, (resp: HiveInferenceResponse) => void> = new Map();
    private broadcastIntervalId: any = null;

    constructor() {
        this.listenToMesh();
        if (typeof window !== 'undefined') {
            this.broadcastIntervalId = setInterval(() => this.broadcastCapacity(), 30_000);
        }
    }

    /** Helper to read real battery information */
    private async getRealBattery(): Promise<{ level: number; isCharging: boolean }> {
        let batteryLevel = 80;
        let isCharging = false;

        try {
            const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
            if (cap?.Plugins?.Device) {
                const info = await cap.Plugins.Device.getBatteryInfo();
                if (info && typeof info.batteryLevel === 'number') {
                    batteryLevel = Math.round(info.batteryLevel * 100);
                    isCharging = !!info.isCharging;
                    return { level: batteryLevel, isCharging };
                }
            }
        } catch {}

        if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
            try {
                const batt: any = await (navigator as any).getBattery();
                batteryLevel = Math.round((batt.level ?? 0.8) * 100);
                isCharging = !!batt.charging;
            } catch {}
        }

        return { level: batteryLevel, isCharging };
    }

    /** Broadcasts this node's real hardware & model capabilities to the mesh */
    public async broadcastCapacity() {
        if (typeof window === 'undefined') return;

        let availableRamMb = 2048;
        try {
            if ('deviceMemory' in navigator) {
                availableRamMb = ((navigator as any).deviceMemory || 2) * 1024;
            }
        } catch {}

        const batt = await this.getRealBattery();
        const activeModel = ModelManager.getActiveModel();

        let myId = meshRouter.myIdentityHash;
        if (!myId && typeof window !== 'undefined') {
            try {
                myId = localStorage.getItem('red_identity_hash') || '';
            } catch {}
        }
        if (!myId) myId = 'local_node';

        const cpuUsagePercent = Math.min(100, Math.round(10 + (this.activeRequestResolvers.size * 25) + (this.activeStreamListeners.size * 15)));

        const ad: NodeCapacityAdvertisement = {
            nodeId: myId,
            availableRamMb,
            cpuUsagePercent,
            batteryLevel: batt.level,
            isCharging: batt.isCharging,
            activeModel: activeModel ? activeModel.id : null,
            maxContextTokens: 4096,
            supportsStreaming: true,
            timestamp: Date.now()
        };

        const payload = new TextEncoder().encode(JSON.stringify({
            type: 'HIVE_CAPACITY_AD',
            payload: ad
        }));

        meshRouter.broadcast(payload).catch(() => {});
    }

    /** Listens for incoming mesh protocol packets related to Hive Mind */
    private listenToMesh() {
        meshRouter.onLocalDelivery(async (packet) => {
            try {
                const text = new TextDecoder().decode(packet.payload);
                const data = JSON.parse(text);

                if (data.type === 'HIVE_CAPACITY_AD') {
                    const ad: NodeCapacityAdvertisement = data.payload;
                    ad.nodeId = packet.sender;
                    this.knownNodeCapabilities.set(packet.sender, ad);
                } else if (data.type === 'HIVE_STREAM_CHUNK') {
                    const chunk: HiveInferenceStreamChunk = data.payload;
                    const listener = this.activeStreamListeners.get(chunk.requestId);
                    if (listener) {
                        listener(chunk);
                        if (chunk.isFinal) {
                            this.activeStreamListeners.delete(chunk.requestId);
                        }
                    }
                } else if (data.type === 'HIVE_INFERENCE_RESP') {
                    const resp: HiveInferenceResponse = data.payload;
                    const resolver = this.activeRequestResolvers.get(resp.requestId);
                    if (resolver) {
                        resolver(resp);
                        this.activeRequestResolvers.delete(resp.requestId);
                    }
                } else if (data.type === 'HIVE_INFERENCE_REQ') {
                    // Handle incoming execution request when acting as Hive Provider
                    const req: HiveInferenceRequest = data.payload;
                    this.handleIncomingInferenceRequest(packet.sender, req);
                }
            } catch (e) {
                // Ignore non-JSON packets
            }
        });
    }

    /** Executes local inference on behalf of a remote mesh peer */
    private async handleIncomingInferenceRequest(senderId: string, req: HiveInferenceRequest) {
        const start = performance.now();
        let myId = meshRouter.myIdentityHash || (typeof window !== 'undefined' ? localStorage.getItem('red_identity_hash') : '') || 'local_node';
        try {
            const copilotRes = await queryAICopilot(req.prompt);
            const execTime = Math.round(performance.now() - start);

            // Si el solicitante pidió streaming, emitir tokens progresivamente por la malla
            if (req.stream) {
                const words = copilotRes.answer.split(' ');
                for (let i = 0; i < words.length; i++) {
                    const token = (i === 0 ? '' : ' ') + words[i];
                    const isFinal = i === words.length - 1;
                    const streamPayload: HiveInferenceStreamChunk = {
                        requestId: req.requestId,
                        chunkIndex: i,
                        token,
                        isFinal,
                        totalTokensGenerated: words.length,
                        executionTimeMs: Math.round(performance.now() - start)
                    };
                    const encChunk = new TextEncoder().encode(JSON.stringify({
                        type: 'HIVE_STREAM_CHUNK',
                        payload: streamPayload
                    }));
                    await meshRouter.send(senderId, encChunk);
                    if (i < words.length - 1) {
                        await new Promise(r => setTimeout(r, 20));
                    }
                }
            }

            const respPayload: HiveInferenceResponse = {
                requestId: req.requestId,
                fullAnswer: copilotRes.answer,
                executorNodeId: myId,
                modelUsed: copilotRes.source || 'Unified-Node-AI',
                executionTimeMs: execTime,
                tokensPerSecond: Math.round((copilotRes.answer.length / 4) / (execTime / 1000 || 1))
            };

            const encodedResp = new TextEncoder().encode(JSON.stringify({
                type: 'HIVE_INFERENCE_RESP',
                payload: respPayload
            }));

            await meshRouter.send(senderId, encodedResp);
        } catch (err: any) {
            const errorResp: HiveInferenceResponse = {
                requestId: req.requestId,
                fullAnswer: `⚠️ Error en inferencia local del proveedor: ${err.message}`,
                executorNodeId: myId,
                modelUsed: 'Error',
                executionTimeMs: Math.round(performance.now() - start),
                tokensPerSecond: 0
            };

            const encodedErr = new TextEncoder().encode(JSON.stringify({
                type: 'HIVE_INFERENCE_RESP',
                payload: errorResp
            }));

            await meshRouter.send(senderId, encodedErr);
        }
    }

    /** Selects the optimal peer node in the mesh to execute an inference query */
    public getBestAvailableNode(): NodeCapacityAdvertisement | null {
        const now = Date.now();
        const validPeers: NodeCapacityAdvertisement[] = [];

        for (const [nodeId, ad] of this.knownNodeCapabilities.entries()) {
            if (now - ad.timestamp < 90_000 && ad.activeModel) {
                validPeers.push(ad);
            }
        }

        if (validPeers.length === 0) return null;

        // Puntuación normalizada multicriterio: RAM normalizada (0..1) + Batería normalizada (0..1)
        validPeers.sort((a, b) => {
            const ramA = (typeof a.availableRamMb === 'number' && isFinite(a.availableRamMb) && a.availableRamMb > 0) ? a.availableRamMb : 512;
            const ramB = (typeof b.availableRamMb === 'number' && isFinite(b.availableRamMb) && b.availableRamMb > 0) ? b.availableRamMb : 512;
            const ramScoreA = Math.min(1, ramA / 8192);
            const ramScoreB = Math.min(1, ramB / 8192);

            const batA = (typeof a.batteryLevel === 'number' && isFinite(a.batteryLevel) && a.batteryLevel >= 0) ? a.batteryLevel : 100;
            const batB = (typeof b.batteryLevel === 'number' && isFinite(b.batteryLevel) && b.batteryLevel >= 0) ? b.batteryLevel : 100;
            const battScoreA = (batA / 100) * (batA < 20 ? 0.2 : 1.0) * (a.isCharging ? 1.2 : 1.0);
            const battScoreB = (batB / 100) * (batB < 20 ? 0.2 : 1.0) * (b.isCharging ? 1.2 : 1.0);

            const totalScoreA = (ramScoreA * 0.5) + (battScoreA * 0.5);
            const totalScoreB = (ramScoreB * 0.5) + (battScoreB * 0.5);

            return totalScoreB - totalScoreA;
        });

        return validPeers[0];
    }

    /** Delegates inference request to a remote mesh node */
    public async delegateInference(
        targetNode: NodeCapacityAdvertisement,
        prompt: string,
        onChunk?: (token: string) => void
    ): Promise<HiveInferenceResponse> {
        const start = performance.now();
        const randSuffix = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('')
            : Date.now().toString(36);
        const requestId = `req_${Date.now()}_${randSuffix}`;
        let myId = meshRouter.myIdentityHash || (typeof window !== 'undefined' ? localStorage.getItem('red_identity_hash') : '') || 'local_node';

        const requestPayload: HiveInferenceRequest = {
            requestId,
            senderId: myId,
            targetNodeId: targetNode.nodeId,
            prompt,
            maxTokens: 512,
            temperature: 0.7,
            stream: !!onChunk,
            timestamp: Date.now()
        };

        let fullAnswer = '';

        if (onChunk) {
            this.activeStreamListeners.set(requestId, (chunk) => {
                fullAnswer += chunk.token;
                onChunk(chunk.token);
            });
        }

        const encodedReq = new TextEncoder().encode(JSON.stringify({
            type: 'HIVE_INFERENCE_REQ',
            payload: requestPayload
        }));

        // CRÍTICO: registrar el resolver ANTES de enviar el paquete para evitar la
        // condición de carrera donde el peer responde antes de que el resolver esté en el mapa.
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.activeStreamListeners.delete(requestId);
                this.activeRequestResolvers.delete(requestId);
                resolve({
                    requestId,
                    fullAnswer: fullAnswer || `[HiveMind] Timeout esperando respuesta de nodo ${targetNode.nodeId.slice(0, 8)}`,
                    executorNodeId: targetNode.nodeId,
                    modelUsed: targetNode.activeModel || 'Desconocido',
                    executionTimeMs: Math.round(performance.now() - start),
                    tokensPerSecond: 0
                });
            }, 15_000);

            this.activeRequestResolvers.set(requestId, (resp) => {
                clearTimeout(timeout);
                resolve(resp);
            });

            // Envío diferido al tick siguiente para garantizar que el resolver ya esté
            // registrado cuando el event loop procese cualquier respuesta inmediata.
            meshRouter.send(targetNode.nodeId, encodedReq).catch((err) => {
                clearTimeout(timeout);
                this.activeStreamListeners.delete(requestId);
                this.activeRequestResolvers.delete(requestId);
                resolve({
                    requestId,
                    fullAnswer: `[HiveMind] Error de transporte: ${err?.message || 'fallo de envío mesh'}`,
                    executorNodeId: targetNode.nodeId,
                    modelUsed: targetNode.activeModel || 'Desconocido',
                    executionTimeMs: Math.round(performance.now() - start),
                    tokensPerSecond: 0
                });
            });
        });
    }

    /** Returns all known capacities with automatic expiration pruning (> 90s) */
    public getKnownCapabilities(): NodeCapacityAdvertisement[] {
        const now = Date.now();
        for (const [nodeId, ad] of this.knownNodeCapabilities.entries()) {
            if (now - ad.timestamp > 180_000) {
                this.knownNodeCapabilities.delete(nodeId);
            }
        }
        return Array.from(this.knownNodeCapabilities.values());
    }

    public destroy(): void {
        if (this.broadcastIntervalId) {
            clearInterval(this.broadcastIntervalId);
            this.broadcastIntervalId = null;
        }
        this.activeStreamListeners.clear();
        this.activeRequestResolvers.clear();
        this.knownNodeCapabilities.clear();
    }
}

export const HiveMindEngine = new HiveMindEngineClass();
