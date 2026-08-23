/**
 * hiveMindProtocol.ts — RED Hive Mind Distributed AI Protocol
 *
 * Defines binary & JSON wire contracts for:
 * 1. Node Capacity Advertisements (RAM, CPU, loaded models)
 * 2. Task Delegation & Remote Inference Requests
 * 3. Token Streaming over Mesh (Chunked delivery)
 * 4. Pipeline Tensor Shard Routing (Phase 3 Layer Splits)
 */

export interface NodeCapacityAdvertisement {
    nodeId: string;
    availableRamMb: number;
    cpuUsagePercent: number;
    batteryLevel: number;
    isCharging: boolean;
    activeModel: string | null;
    maxContextTokens: number;
    supportsStreaming: boolean;
    timestamp: number;
}

export interface HiveInferenceRequest {
    requestId: string;
    senderId: string;
    targetNodeId?: string; // Optional: specific target or best available
    prompt: string;
    systemInstruction?: string;
    maxTokens: number;
    temperature: number;
    stream: boolean;
    timestamp: number;
}

export interface HiveInferenceStreamChunk {
    requestId: string;
    chunkIndex: number;
    token: string;
    isFinal: boolean;
    totalTokensGenerated: number;
    executionTimeMs: number;
}

export interface HiveInferenceResponse {
    requestId: string;
    fullAnswer: string;
    executorNodeId: string;
    modelUsed: string;
    executionTimeMs: number;
    tokensPerSecond: number;
}

/** Layer Shard definition for Pipeline Parallelism (Phase 3) */
export interface TensorShardPacket {
    requestId: string;
    sourceLayerStart: number;
    sourceLayerEnd: number;
    targetLayerStart: number;
    sequenceIndex: number;
    activationTensor: Float32Array; // Flattened activation tensor
}
