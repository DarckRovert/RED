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
  private brokerSockets: Map<string, { ws: WebSocket; isAuthed: boolean }> = new Map();
  private myId: string;
  private messageListeners: ((msg: { from: string; payload: Uint8Array }) => void)[] = [];
  private signalingListeners: ((msg: any) => void)[] = [];
  private connectListeners: (() => void)[] = [];
  private pingInterval: any = null;
  public isConnected = false;
  private seenMqttHashes: Set<string> = new Set();
  private reconnectTimers: Map<string, any> = new Map();

  private static readonly BROKER_POOL: string[] = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
  ];

  private cleanId(raw: string): string {
    if (!raw) return '';
    let clean = raw.trim();
    if (clean.startsWith('did:red:')) clean = clean.replace(/^did:red:/i, '');
    if (clean.includes(':') && !/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/i.test(clean)) {
      const parts = clean.split(':');
      if (parts[0].length >= 16) clean = parts[0].trim();
    }
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
      this.subscribeToMyTopics();
    }
  }

  public onConnect(callback: () => void) {
    this.connectListeners.push(callback);
    if (this.isConnected) {
      try { callback(); } catch {}
    }
  }

  async connect(): Promise<void> {
    if (typeof window === 'undefined') return;

    for (const url of MqttRelayTransport.BROKER_POOL) {
      this.connectBroker(url);
    }
    this.startPing();
  }

  private connectBroker(url: string) {
    const existing = this.brokerSockets.get(url);
    if (existing && (existing.ws.readyState === WebSocket.OPEN || existing.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      console.log(`[MqttRelay] Connecting to global broker: ${url}...`);
      const socket = new WebSocket(url, ['mqtt', 'mqttv3.1']);
      socket.binaryType = 'arraybuffer';
      this.brokerSockets.set(url, { ws: socket, isAuthed: false });

      socket.onopen = () => {
        this.sendMqttConnect(socket);
      };

      socket.onmessage = (event: MessageEvent) => {
        try {
          const data = new Uint8Array(event.data as ArrayBuffer);
          this.handleMqttPacket(data, socket, url);
        } catch (e) {
          console.warn(`[MqttRelay] Error handling packet on ${url}:`, e);
        }
      };

      socket.onclose = () => {
        const entry = this.brokerSockets.get(url);
        if (entry) entry.isAuthed = false;
        this.updateConnectedState();
        this.scheduleBrokerReconnect(url);
      };

      socket.onerror = () => {
        try { socket.close(); } catch {}
      };
    } catch (err) {
      console.warn(`[MqttRelay] WebSocket creation failed for ${url}:`, err);
      this.scheduleBrokerReconnect(url);
    }
  }

  private scheduleBrokerReconnect(url: string) {
    if (this.reconnectTimers.has(url)) return;
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(url);
      this.connectBroker(url);
    }, 3000);
    this.reconnectTimers.set(url, timer);
  }

  private updateConnectedState() {
    let anyAuthed = false;
    for (const [, entry] of this.brokerSockets) {
      if (entry.isAuthed && entry.ws.readyState === WebSocket.OPEN) {
        anyAuthed = true;
        break;
      }
    }
    this.isConnected = anyAuthed;
  }

  private startPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      const pingPacket = new Uint8Array([0xC0, 0x00]);
      for (const [, entry] of this.brokerSockets) {
        if (entry.ws.readyState === WebSocket.OPEN) {
          try { entry.ws.send(pingPacket); } catch {}
        }
      }
    }, 20000);
  }

  // ─── MQTT Protocol Implementation ──────────────────────────────────────────

  private sendMqttConnect(socket: WebSocket) {
    if (socket.readyState !== WebSocket.OPEN) return;

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

    try {
      socket.send(packet.buffer);
    } catch {}
  }

  private subscribeToMyTopics(targetWs?: WebSocket) {
    if (!this.myId) return;

    const topics = [
      `red/v65/dm/${this.myId}`,
      `red/v65/sig/${this.myId}`,
      `red/v65/mb/${this.myId}`,
      `red/mesh/dm/${this.myId}`,
      `red/mesh/sig/${this.myId}`,
      `red/v40/dm/${this.myId}`,
      `red/v40/sig/${this.myId}`,
      `red/v40/mb/${this.myId}`,
      `red/v32/dm/${this.myId}`,
      `red/v32/sig/${this.myId}`,
      `red/v32/mb/${this.myId}`,
      'red/v65/broadcast',
      'red/mesh/broadcast',
      'red/v40/broadcast',
      'red/v32/broadcast'
    ];

    if (this.myId.length >= 8) {
      const short = this.myId.slice(0, 8);
      topics.push(`red/v65/dm/${short}`);
      topics.push(`red/v65/sig/${short}`);
      topics.push(`red/v65/mb/${short}`);
      topics.push(`red/mesh/dm/${short}`);
      topics.push(`red/mesh/sig/${short}`);
      topics.push(`red/v40/dm/${short}`);
      topics.push(`red/v40/sig/${short}`);
      topics.push(`red/v40/mb/${short}`);
      topics.push(`red/v32/dm/${short}`);
      topics.push(`red/v32/sig/${short}`);
      topics.push(`red/v32/mb/${short}`);
    }

    topics.forEach(t => this.subscribe(t, 0, targetWs));
    console.log(`[MqttRelay] Subscribed to ${topics.length} routing topics for DID ${this.myId.slice(0, 8)} across active brokers`);
  }

  private subscribe(topic: string, qos: number = 0, targetWs?: WebSocket) {
    const topicBytes = new TextEncoder().encode(topic);
    const packetId = Math.floor(Math.random() * 65535) + 1;
    const remainingLen = 2 + (2 + topicBytes.length + 1);

    // Variable length remaining length encoding
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

    packet[offset++] = 0x82; // SUBSCRIBE (QoS 1 header)
    for (const b of lenBytes) packet[offset++] = b;

    // Packet ID
    packet[offset++] = (packetId >> 8) & 0xFF;
    packet[offset++] = packetId & 0xFF;

    // Topic
    packet[offset++] = (topicBytes.length >> 8) & 0xFF;
    packet[offset++] = topicBytes.length & 0xFF;
    packet.set(topicBytes, offset);
    offset += topicBytes.length;

    packet[offset++] = qos;

    if (targetWs) {
      if (targetWs.readyState === WebSocket.OPEN) {
        try { targetWs.send(packet.buffer); } catch {}
      }
    } else {
      for (const [, entry] of this.brokerSockets) {
        if (entry.ws.readyState === WebSocket.OPEN) {
          try { entry.ws.send(packet.buffer); } catch {}
        }
      }
    }
  }

  public publish(topic: string, payload: Uint8Array | string): boolean {
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

    let publishedCount = 0;
    for (const [, entry] of this.brokerSockets) {
      if (entry.ws.readyState === WebSocket.OPEN) {
        try {
          entry.ws.send(packet.buffer);
          publishedCount++;
        } catch {}
      }
    }

    return publishedCount > 0;
  }

  // ─── Packet Dispatcher ──────────────────────────────────────────────────────

  private handleMqttPacket(data: Uint8Array, socket: WebSocket, url: string) {
    let cursor = 0;
    while (cursor < data.length) {
      if (data.length - cursor < 2) break;
      const packetType = data[cursor] >> 4;
      let offset = cursor + 1;
      let multiplier = 1;
      let remainingLength = 0;
      let byte = 0;
      do {
        if (offset >= data.length) break;
        byte = data[offset++];
        remainingLength += (byte & 127) * multiplier;
        multiplier *= 128;
      } while ((byte & 128) !== 0 && offset < data.length);

      const packetEnd = offset + remainingLength;
      if (packetEnd > data.length) break;

      // 1. CONNACK (Type 2)
      if (packetType === 2) {
        const returnCode = data[offset + 1];
        if (returnCode === 0) {
          const entry = this.brokerSockets.get(url);
          if (entry) entry.isAuthed = true;
          this.updateConnectedState();
          console.log(`[MqttRelay] ✅ Connected and authenticated with broker: ${url}`);
          this.subscribeToMyTopics(socket);
          this.connectListeners.forEach(cb => {
            try { cb(); } catch (err) { console.warn('[MqttRelay] Error in connect listener:', err); }
          });
        } else {
          console.warn(`[MqttRelay] Connection rejected by broker ${url} (code ${returnCode})`);
          try { socket.close(); } catch {}
        }
      }
      // 2. PINGRESP (Type 13)
      else if (packetType === 13) {
        // Keep-alive ack, no action needed
      }
      // 3. PUBLISH (Type 3)
      else if (packetType === 3) {
        const qos = (data[cursor] & 0x06) >> 1;
        const topicLen = (data[offset] << 8) | data[offset + 1];
        offset += 2;
        const topic = new TextDecoder().decode(data.slice(offset, offset + topicLen));
        offset += topicLen;
        if (qos > 0) {
          const packetId = (data[offset] << 8) | data[offset + 1];
          offset += 2;
          if (qos === 1 && socket.readyState === WebSocket.OPEN) {
            try {
              socket.send(new Uint8Array([0x40, 0x02, (packetId >> 8) & 0xFF, packetId & 0xFF]));
            } catch {}
          }
        }
        const payload = data.slice(offset, packetEnd);
        this.routeIncomingMqttMessage(topic, payload);
      }

      cursor = packetEnd;
    }
  }

  private routeIncomingMqttMessage(topic: string, payload: Uint8Array) {
    try {
      // Deduplicate identical MQTT payloads delivered across multiple topic subscriptions & brokers
      let hash = '';
      const sampleLen = Math.min(payload.length, 32);
      for (let i = 0; i < sampleLen; i++) {
        hash += payload[i].toString(16).padStart(2, '0');
      }
      hash += '_' + payload.length;
      if (this.seenMqttHashes.has(hash)) return;
      this.seenMqttHashes.add(hash);
      if (this.seenMqttHashes.size > 1000) {
        const first = this.seenMqttHashes.values().next().value;
        if (first) this.seenMqttHashes.delete(first);
      }

      const payloadStr = new TextDecoder().decode(payload);

      // A) Signaling message (SDP / ICE / Handshake)
      const isSignaling = topic.includes('/sig/') ||
        (payloadStr.startsWith('{') && (
          payloadStr.includes('"offer":') ||
          payloadStr.includes('"answer":') ||
          payloadStr.includes('"candidate":') ||
          payloadStr.includes('"hangup":') ||
          payloadStr.includes('webrtc_signal')
        ));

      if (isSignaling) {
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
   * Sends an encrypted packet directly to a recipient's topics (realtime DM + Blind Mailbox).
   */
  public sendPacket(recipientHash: string, payload: Uint8Array): boolean {
    const clean = this.cleanId(recipientHash);
    if (!clean) return false;
    
    // Publish to primary v65, mesh, v40 and v32 realtime topics
    let published = this.publish(`red/v65/dm/${clean}`, payload);
    this.publish(`red/v65/mb/${clean}`, payload);
    this.publish(`red/mesh/dm/${clean}`, payload);
    this.publish(`red/v40/dm/${clean}`, payload);
    this.publish(`red/v40/mb/${clean}`, payload);
    this.publish(`red/v32/dm/${clean}`, payload);
    this.publish(`red/v32/mb/${clean}`, payload);

    if (clean.length > 8) {
      const short = clean.slice(0, 8);
      this.publish(`red/v65/dm/${short}`, payload);
      this.publish(`red/v65/mb/${short}`, payload);
      this.publish(`red/mesh/dm/${short}`, payload);
      this.publish(`red/v40/dm/${short}`, payload);
      this.publish(`red/v40/mb/${short}`, payload);
      this.publish(`red/v32/dm/${short}`, payload);
      this.publish(`red/v32/mb/${short}`, payload);
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

    let published = this.publish(`red/v65/sig/${clean}`, jsonStr);
    this.publish(`red/mesh/sig/${clean}`, jsonStr);
    this.publish(`red/v40/sig/${clean}`, jsonStr);
    this.publish(`red/v32/sig/${clean}`, jsonStr);

    if (clean.length > 8) {
      const short = clean.slice(0, 8);
      this.publish(`red/v65/sig/${short}`, jsonStr);
      this.publish(`red/mesh/sig/${short}`, jsonStr);
      this.publish(`red/v40/sig/${short}`, jsonStr);
      this.publish(`red/v32/sig/${short}`, jsonStr);
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
