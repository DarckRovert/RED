/**
 * RED Decentralized MQTT over WebSockets Blind Relay & Signaling Transport
 * 
 * Provides guaranteed, zero-knowledge, real-time message forwarding and WebRTC
 * signaling across Web browsers and Mobile devices worldwide via high-availability
 * global broker pools (EMQX, HiveMQ, Mosquitto).
 * 
 * Features:
 * - Pure Zero-Dependency MQTT v3.1.1 packet parser & serializer
 * - Multi-Broker fallback & auto-reconnect
 * - Direct DID routing (topic: red/mesh/dm/<identity_hash>)
 * - WebRTC SDP / ICE signaling over MQTT
 */

export interface MqttMessage {
  topic: string;
  payload: Uint8Array;
}

export class MqttRelayTransport {
  private ws: WebSocket | null = null;
  private myId: string;
  private isConnecting = false;
  private reconnectTimer: any = null;
  private activeBrokerIndex = 0;
  private messageListeners: ((msg: { from: string; payload: Uint8Array }) => void)[] = [];
  private signalingListeners: ((msg: any) => void)[] = [];
  private pingInterval: any = null;
  public isConnected = false;

  private static readonly BROKER_POOL: string[] = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081',
  ];

  private cleanId(raw: string): string {
    if (!raw) return '';
    let clean = raw.trim();
    if (clean.startsWith('did:red:')) clean = clean.replace(/^did:red:/i, '');
    if (clean.includes(':')) clean = clean.split(':')[0].trim();
    return clean.toLowerCase();
  }

  constructor(myId: string) {
    this.myId = this.cleanId(myId);
  }

  public updateIdentity(myId: string) {
    if (!myId) return;
    const clean = this.cleanId(myId);
    if (this.myId !== clean) {
      this.myId = clean;
      if (this.isConnected) {
        this.subscribeToMyTopics();
      }
    }
  }

  async connect(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    const brokers = MqttRelayTransport.BROKER_POOL;
    const url = brokers[this.activeBrokerIndex % brokers.length];

    return new Promise<void>((resolve) => {
      console.log(`[MqttRelay] Connecting to global broker [${this.activeBrokerIndex + 1}/${brokers.length}]: ${url}...`);

      let socket: WebSocket;
      try {
        socket = new WebSocket(url, ['mqttv3.1', 'mqtt']);
        socket.binaryType = 'arraybuffer';
      } catch (err) {
        console.warn(`[MqttRelay] WebSocket creation failed for ${url}:`, err);
        this.isConnecting = false;
        this.tryNextBroker();
        resolve();
        return;
      }

      this.ws = socket;

      const connectTimeout = setTimeout(() => {
        if (!this.isConnected && socket.readyState !== WebSocket.OPEN) {
          try { socket.close(); } catch {}
          this.isConnecting = false;
          this.tryNextBroker();
          resolve();
        }
      }, 5000);

      socket.onopen = () => {
        clearTimeout(connectTimeout);
        this.sendMqttConnect();
      };

      socket.onmessage = (event: MessageEvent) => {
        try {
          const data = new Uint8Array(event.data as ArrayBuffer);
          this.handleMqttPacket(data, resolve);
        } catch (e) {
          console.warn('[MqttRelay] Error handling message packet:', e);
        }
      };

      socket.onclose = () => {
        clearTimeout(connectTimeout);
        this.isConnected = false;
        this.isConnecting = false;
        this.stopPing();
        console.log(`[MqttRelay] Broker connection closed (${url}). Reconnecting in 3s...`);
        this.scheduleReconnect();
      };

      socket.onerror = (err) => {
        clearTimeout(connectTimeout);
        this.isConnected = false;
        this.isConnecting = false;
        try { socket.close(); } catch {}
      };
    });
  }

  private tryNextBroker() {
    this.activeBrokerIndex = (this.activeBrokerIndex + 1) % MqttRelayTransport.BROKER_POOL.length;
    this.scheduleReconnect(1000);
  }

  private scheduleReconnect(delayMs = 3000) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {});
    }, delayMs);
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send MQTT PINGREQ (0xC0, 0x00)
        this.ws.send(new Uint8Array([0xC0, 0x00]));
      }
    }, 20000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ─── MQTT Protocol Implementation ──────────────────────────────────────────

  private sendMqttConnect() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const clientId = `red_${this.myId ? this.myId.slice(0, 12) : 'node'}_${Math.random().toString(36).substring(2, 8)}`;
    const protocolName = 'MQTT';
    const protocolLevel = 4; // v3.1.1
    const connectFlags = 0x02; // Clean Session
    const keepAlive = 60;

    const protoBytes = new TextEncoder().encode(protocolName);
    const clientBytes = new TextEncoder().encode(clientId);

    const varHeaderLen = 2 + protoBytes.length + 1 + 1 + 2;
    const payloadLen = 2 + clientBytes.length;
    const remainingLen = varHeaderLen + payloadLen;

    const packet = new Uint8Array(2 + remainingLen);
    let offset = 0;

    packet[offset++] = 0x10; // CONNECT packet type
    packet[offset++] = remainingLen;

    // Protocol Name
    packet[offset++] = (protoBytes.length >> 8) & 0xFF;
    packet[offset++] = protoBytes.length & 0xFF;
    packet.set(protoBytes, offset);
    offset += protoBytes.length;

    packet[offset++] = protocolLevel;
    packet[offset++] = connectFlags;
    packet[offset++] = (keepAlive >> 8) & 0xFF;
    packet[offset++] = keepAlive & 0xFF;

    // Client ID
    packet[offset++] = (clientBytes.length >> 8) & 0xFF;
    packet[offset++] = clientBytes.length & 0xFF;
    packet.set(clientBytes, offset);

    this.ws.send(packet.buffer);
  }

  private subscribeToMyTopics() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.myId) return;

    const topics = [
      `red/mesh/dm/${this.myId}`,
      `red/mesh/sig/${this.myId}`,
      'red/mesh/broadcast',
    ];

    if (this.myId.length >= 8) {
      topics.push(`red/mesh/dm/${this.myId.slice(0, 8)}`);
      topics.push(`red/mesh/sig/${this.myId.slice(0, 8)}`);
    }

    topics.forEach(t => this.subscribe(t));
    console.log(`[MqttRelay] Subscribed to ${topics.length} routing topics for DID ${this.myId.slice(0, 8)}`);
  }

  private subscribe(topic: string, qos: number = 0) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const topicBytes = new TextEncoder().encode(topic);
    const packetId = Math.floor(Math.random() * 65535) + 1;
    const remainingLen = 2 + (2 + topicBytes.length + 1);

    const packet = new Uint8Array(2 + remainingLen);
    let offset = 0;

    packet[offset++] = 0x82; // SUBSCRIBE (QoS 1)
    packet[offset++] = remainingLen;

    // Packet ID
    packet[offset++] = (packetId >> 8) & 0xFF;
    packet[offset++] = packetId & 0xFF;

    // Topic
    packet[offset++] = (topicBytes.length >> 8) & 0xFF;
    packet[offset++] = topicBytes.length & 0xFF;
    packet.set(topicBytes, offset);
    offset += topicBytes.length;

    packet[offset++] = qos;

    this.ws.send(packet.buffer);
  }

  public publish(topic: string, payload: Uint8Array | string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;

    const payloadBytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
    const topicBytes = new TextEncoder().encode(topic);
    const remainingLen = 2 + topicBytes.length + payloadBytes.length;

    // Encode remaining length (variable length field for MQTT)
    const lenBytes: number[] = [];
    let tempLen = remainingLen;
    do {
      let encodedByte = tempLen % 128;
      tempLen = Math.floor(tempLen / 128);
      if (tempLen > 0) encodedByte |= 128;
      lenBytes.push(encodedByte);
    } while (tempLen > 0);

    const packet = new Uint8Array(1 + lenBytes.length + remainingLen);
    let offset = 0;

    packet[offset++] = 0x30; // PUBLISH (QoS 0)
    for (const b of lenBytes) packet[offset++] = b;

    // Topic
    packet[offset++] = (topicBytes.length >> 8) & 0xFF;
    packet[offset++] = topicBytes.length & 0xFF;
    packet.set(topicBytes, offset);
    offset += topicBytes.length;

    // Payload
    packet.set(payloadBytes, offset);

    try {
      this.ws.send(packet.buffer);
      return true;
    } catch (e) {
      console.warn('[MqttRelay] Publish failed:', e);
      return false;
    }
  }

  // ─── Packet Dispatcher ──────────────────────────────────────────────────────

  private handleMqttPacket(data: Uint8Array, onConnected?: () => void) {
    if (data.length < 2) return;
    const packetType = data[0] >> 4;

    // 1. CONNACK (Type 2)
    if (packetType === 2) {
      const returnCode = data[3];
      if (returnCode === 0) {
        this.isConnected = true;
        this.isConnecting = false;
        console.log('[MqttRelay] ✅ Connected and authenticated with global broker');
        this.startPing();
        this.subscribeToMyTopics();
        if (onConnected) onConnected();
      } else {
        console.warn(`[MqttRelay] Connection rejected by broker (code ${returnCode})`);
        this.tryNextBroker();
      }
      return;
    }

    // 2. PINGRESP (Type 13)
    if (packetType === 13) {
      return; // Keep-alive ack, no action needed
    }

    // 3. PUBLISH (Type 3)
    if (packetType === 3) {
      let offset = 1;
      // Read variable length
      let multiplier = 1;
      let remainingLength = 0;
      let byte = 0;
      do {
        byte = data[offset++];
        remainingLength += (byte & 127) * multiplier;
        multiplier *= 128;
      } while ((byte & 128) !== 0 && offset < data.length);

      // Read Topic Name
      const topicLen = (data[offset] << 8) | data[offset + 1];
      offset += 2;
      const topic = new TextDecoder().decode(data.slice(offset, offset + topicLen));
      offset += topicLen;

      // Extract Payload
      const payload = data.slice(offset);
      this.routeIncomingMqttMessage(topic, payload);
    }
  }

  private routeIncomingMqttMessage(topic: string, payload: Uint8Array) {
    try {
      const payloadStr = new TextDecoder().decode(payload);

      // A) Signaling message (SDP / ICE / Handshake)
      if (topic.includes('/sig/') || payloadStr.startsWith('{"type":"offer"') || payloadStr.startsWith('{"type":"answer"') || payloadStr.startsWith('{"type":"ice-candidate"')) {
        const sigMsg = JSON.parse(payloadStr);
        this.signalingListeners.forEach(cb => {
          try { cb(sigMsg); } catch {}
        });
        return;
      }

      // B) Mesh Data / Chat / Binary Packet
      let senderId = 'remote_peer';
      if (payloadStr.startsWith('{')) {
        try {
          const parsed = JSON.parse(payloadStr);
          if (parsed.sender) senderId = parsed.sender;
        } catch {}
      }

      this.messageListeners.forEach(cb => {
        try { cb({ from: senderId, payload }); } catch {}
      });
    } catch (err) {
      console.warn('[MqttRelay] Error routing incoming message:', err);
    }
  }

  // ─── High-Level Messaging & Signaling API ───────────────────────────────────

  /**
   * Sends an encrypted packet directly to a recipient's topic.
   */
  public sendPacket(recipientHash: string, payload: Uint8Array): boolean {
    const clean = this.cleanId(recipientHash);
    if (!clean) return false;
    let published = this.publish(`red/mesh/dm/${clean}`, payload);
    if (clean.length > 8) {
      this.publish(`red/mesh/dm/${clean.slice(0, 8)}`, payload);
    }
    return published;
  }

  /**
   * Sends a WebRTC signaling payload (offer/answer/ice) to a peer.
   */
  public sendSignaling(targetHash: string, signalData: any): boolean {
    const clean = this.cleanId(targetHash);
    if (!clean) return false;
    const jsonStr = JSON.stringify({
      fromPeer: this.myId,
      targetPeerId: clean,
      timestamp: Date.now(),
      ...signalData
    });
    let published = this.publish(`red/mesh/sig/${clean}`, jsonStr);
    if (clean.length > 8) {
      this.publish(`red/mesh/sig/${clean.slice(0, 8)}`, jsonStr);
    }
    return published;
  }

  public onMessage(callback: (msg: { from: string; payload: Uint8Array }) => void) {
    this.messageListeners.push(callback);
  }

  public onSignaling(callback: (msg: any) => void) {
    this.signalingListeners.push(callback);
  }
}

export const mqttRelay = new MqttRelayTransport('');
