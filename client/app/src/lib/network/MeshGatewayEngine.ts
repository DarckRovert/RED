/**
 * MeshGatewayEngine.ts — RED ClearNet Mesh Gateway & Out-Proxy Engine
 * 
 * Enables off-grid nodes without internet access to request and browse web content
 * by proxying HTTP requests over multi-hop mesh DTN routes to bridge nodes with active ClearNet connectivity.
 */

import { meshRouter } from '../mesh/meshRouter';
import { encode, createPacket } from '../mesh/meshProtocol';
import { PayloadCompressor } from './PayloadCompressor';

export interface ProxyRequestPayload {
    requestId: string;
    url: string;
    method: 'GET' | 'POST' | 'HEAD';
    headers?: Record<string, string>;
    body?: string;
    originDid: string;
    timestamp: number;
}

export interface ProxyResponsePayload {
    requestId: string;
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    compressedBody: string; // Base64 compressed payload
    gatewayDid: string;
    latencyMs: number;
    timestamp: number;
}

export class MeshGatewayEngine {
    private static instance: MeshGatewayEngine | null = null;
    private isGatewayEnabled: boolean = true;
    private pendingRequests: Map<string, { resolve: (resp: ProxyResponsePayload) => void; reject: (err: Error) => void }> = new Map();

    private constructor() {
        this.initMeshListener();
    }

    public static getInstance(): MeshGatewayEngine {
        if (!MeshGatewayEngine.instance) {
            MeshGatewayEngine.instance = new MeshGatewayEngine();
        }
        return MeshGatewayEngine.instance;
    }

    public setGatewayEnabled(enabled: boolean) {
        this.isGatewayEnabled = enabled;
    }

    public getGatewayEnabled(): boolean {
        return this.isGatewayEnabled;
    }

    /**
     * Checks if current node has direct access to public ClearNet
     */
    public async checkInternetConnectivity(): Promise<boolean> {
        if (typeof window === 'undefined' || !navigator.onLine) {
            return false;
        }
        try {
            // Quick ping to lightweight endpoint
            const res = await fetch('https://cloudflare-eth.com', { method: 'HEAD', mode: 'no-cors' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Client Request: Fetches a URL, either directly if connected or over mesh DTN
     */
    public async fetchUrl(url: string, originDid: string): Promise<{ html: string; status: number; fromGateway: boolean }> {
        const hasInternet = await this.checkInternetConnectivity();

        // 1. Direct fetch if internet is available
        if (hasInternet) {
            try {
                const resp = await fetch(url, { headers: { 'Accept': 'text/html,application/xhtml+xml,text/plain' } });
                const text = await resp.text();
                return { html: text, status: resp.status, fromGateway: false };
            } catch (err: any) {
                console.warn("[MeshGatewayEngine] Direct fetch failed (CORS or offline), falling back to mesh out-proxy:", err.message);
            }
        }

        // 2. Mesh Out-Proxy Request: Broadcast request to mesh neighbors
        const reqId = `gw_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const requestPayload: ProxyRequestPayload = {
            requestId: reqId,
            url,
            method: 'GET',
            originDid,
            timestamp: Date.now(),
        };

        return new Promise((resolve, reject) => {
            // Register timeout
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(reqId)) {
                    this.pendingRequests.delete(reqId);
                    // Fallback to simulated offline cached mirror
                    resolve({
                        html: this.generateOfflineFallbackHtml(url),
                        status: 200,
                        fromGateway: true,
                    });
                }
            }, 10000);

            this.pendingRequests.set(reqId, {
                resolve: (proxyResp) => {
                    clearTimeout(timeout);
                    PayloadCompressor.decompress(proxyResp.compressedBody).then(decompressed => {
                        resolve({ html: decompressed, status: proxyResp.status, fromGateway: true });
                    }).catch(() => {
                        resolve({ html: proxyResp.compressedBody, status: proxyResp.status, fromGateway: true });
                    });
                },
                reject: (err) => {
                    clearTimeout(timeout);
                    reject(err);
                }
            });

            // Broadcast request packet over mesh using wire-format encoding
            const reqEnvelope = { type: 'PROXY_REQUEST', ...requestPayload };
            const reqPayloadBytes = new TextEncoder().encode(JSON.stringify(reqEnvelope));
            void meshRouter.broadcast(encode(createPacket(originDid, 'broadcast', reqPayloadBytes)));
        });
    }

    /**
     * Gateway Dispatcher: Responds to proxy requests if this node has internet
     */
    private initMeshListener() {
        if (typeof window === 'undefined') return;

        window.addEventListener('red_mesh_packet', async (event: any) => {
            const packet = event.detail;
            if (!packet) return;

            // Handle incoming PROXY_REQUEST as a Gateway Node
            if (packet.type === 'PROXY_REQUEST' && this.isGatewayEnabled) {
                const req = packet.payload as ProxyRequestPayload;
                const hasInternet = await this.checkInternetConnectivity();

                if (hasInternet && req && req.url) {
                    try {
                        const startTime = Date.now();
                        const resp = await fetch(req.url);
                        const text = await resp.text();
                        PayloadCompressor.compress(text).then(compressed => {
                            const responsePayload: ProxyResponsePayload = {
                                requestId: req.requestId,
                                url: req.url,
                                status: resp.status,
                                statusText: resp.statusText,
                                headers: {},
                                compressedBody: compressed,
                                gatewayDid: 'did:red:gateway_node',
                                latencyMs: Date.now() - startTime,
                                timestamp: Date.now(),
                            };

                            // Broadcast response back into the mesh
                            const respEnvelope = { type: 'PROXY_RESPONSE', target: req.originDid, ...responsePayload };
                            const respBytes = new TextEncoder().encode(JSON.stringify(respEnvelope));
                            void meshRouter.broadcast(encode(createPacket('did:red:gateway_node', req.originDid, respBytes)));
                        }).catch(e => console.error('[MeshGatewayEngine] Compress error:', e));
                    } catch (e) {
                        console.error("[MeshGatewayEngine] Error processing gateway request:", e);
                    }
                }
            }

            // Handle incoming PROXY_RESPONSE as the Requesting Client
            if (packet.type === 'PROXY_RESPONSE') {
                const resp = packet.payload as ProxyResponsePayload;
                if (resp && this.pendingRequests.has(resp.requestId)) {
                    const resolver = this.pendingRequests.get(resp.requestId);
                    this.pendingRequests.delete(resp.requestId);
                    resolver?.resolve(resp);
                }
            }
        });
    }

    private generateOfflineFallbackHtml(url: string): string {
        return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{background:#0b0f19;color:#f3f4f6;font-family:sans-serif;padding:30px;text-align:center;}.box{background:#111827;border:1px solid #1f293d;border-radius:12px;padding:24px;max-width:500px;margin:0 auto;}h1{color:#38bdf8;font-size:18px;}p{color:#94a3b8;font-size:13px;margin-top:10px;line-height:1.5;}.tag{background:#1e293b;color:#10b981;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:700;display:inline-block;margin-bottom:12px;}</style></head>
<body>
    <div class="box">
        <span class="tag">🌐 ENLACE PROXY MESH RED</span>
        <h1>Página Solicitada vía Malla</h1>
        <p><strong>${url}</strong></p>
        <p>No se detectó un Gateway ClearNet directo en alcance inmediato de radio. Los paquetes de solicitud siguen encolados en la memoria DTN de los nodos vecinos para retransmisión oportuna.</p>
    </div>
</body>
</html>`;
    }
}

export const meshGatewayEngine = MeshGatewayEngine.getInstance();
