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

class HiveMindEngineClass {
    private knownNodeCapabilities: Map<string, NodeCapacityAdvertisement> = new Map();
    private activeStreamListeners: Map<string, (chunk: HiveInferenceStreamChunk) => void> = new Map();
    private activeRequestResolvers: Map<string, (resp: HiveInferenceResponse) => void> = new Map();

    constructor() {
        this.listenToMesh();
        if (typeof window !== 'undefined') {
            setInterval(() => this.broadcastCapacity(), 30_000);
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

        const ad: NodeCapacityAdvertisement = {
            nodeId: 'local_node',
            availableRamMb,
            cpuUsagePercent: 10,
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
        try {
            const copilotRes = await LocalAIEngine.generateCopilotResponse(req.prompt);
            const execTime = Math.round(performance.now() - start);

            const respPayload: HiveInferenceResponse = {
                requestId: req.requestId,
                fullAnswer: copilotRes.answer,
                executorNodeId: 'local_node',
                modelUsed: copilotRes.modelInfo,
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
                executorNodeId: 'local_node',
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

        validPeers.sort((a, b) => (b.availableRamMb + b.batteryLevel) - (a.availableRamMb + a.batteryLevel));
        return validPeers[0];
    }

    /** Delegates inference request to a remote mesh node */
    public async delegateInference(
        targetNode: NodeCapacityAdvertisement,
        prompt: string,
        onChunk?: (token: string) => void
    ): Promise<HiveInferenceResponse> {
        const start = performance.now();
        const requestId = 'req_' + Math.random().toString(36).substring(2, 10);

        const requestPayload: HiveInferenceRequest = {
            requestId,
            senderId: 'local_node',
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

        await meshRouter.send(targetNode.nodeId, encodedReq);

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
        });
    }

    /** Returns all known capacities */
    public getKnownCapabilities(): NodeCapacityAdvertisement[] {
        return Array.from(this.knownNodeCapabilities.values());
    }
}

export const HiveMindEngine = new HiveMindEngineClass();
