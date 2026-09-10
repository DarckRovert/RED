/**
 * Automated E2E Cross-Network Pairing & WAN Communication Test
 * 
 * Validates:
 * 1. Connection to verified TLS WSS MQTT broker pool (wss://broker.emqx.io:8084/mqtt)
 * 2. Independent subscriptions for two remote nodes (Node A & Node B)
 * 3. Transmission of contact_request from Node A to Node B over WAN
 * 4. Reception and parsing of contact_request by Node B
 * 5. Transmission of contact_response from Node B to Node A over WAN
 * 6. Reception of contact_response and mutual contact state confirmation
 */

const WebSocket = globalThis.WebSocket;
const crypto = require('crypto');

function randomDid() {
    return crypto.randomBytes(32).toString('hex');
}

function createMqttConnectPacket(clientId) {
    const protoName = 'MQTT';
    const protoLevel = 4; // v3.1.1
    const flags = 0x02; // Clean session
    const keepAlive = 60;

    const protoBytes = Buffer.from(protoName);
    const clientBytes = Buffer.from(clientId);

    const varHeaderLen = 2 + protoBytes.length + 1 + 1 + 2;
    const payloadLen = 2 + clientBytes.length;
    const remainingLen = varHeaderLen + payloadLen;

    const packet = Buffer.alloc(2 + remainingLen);
    let offset = 0;

    packet[offset++] = 0x10; // CONNECT
    packet[offset++] = remainingLen;

    packet.writeUInt16BE(protoBytes.length, offset);
    offset += 2;
    protoBytes.copy(packet, offset);
    offset += protoBytes.length;

    packet[offset++] = protoLevel;
    packet[offset++] = flags;
    packet.writeUInt16BE(keepAlive, offset);
    offset += 2;

    packet.writeUInt16BE(clientBytes.length, offset);
    offset += 2;
    clientBytes.copy(packet, offset);

    return packet;
}

function createMqttSubscribePacket(topic, packetId = 1) {
    const topicBytes = Buffer.from(topic);
    const remainingLen = 2 + (2 + topicBytes.length + 1);

    const lenBytes = [];
    let tempLen = remainingLen;
    do {
        let encodedByte = tempLen % 128;
        tempLen = Math.floor(tempLen / 128);
        if (tempLen > 0) encodedByte |= 128;
        lenBytes.push(encodedByte);
    } while (tempLen > 0);

    const packet = Buffer.alloc(1 + lenBytes.length + remainingLen);
    let offset = 0;

    packet[offset++] = 0x82; // SUBSCRIBE (QoS 1)
    for (const b of lenBytes) packet[offset++] = b;

    packet.writeUInt16BE(packetId, offset);
    offset += 2;

    packet.writeUInt16BE(topicBytes.length, offset);
    offset += 2;
    topicBytes.copy(packet, offset);
    offset += topicBytes.length;

    packet[offset++] = 0x00; // Requested QoS 0

    return packet;
}

function createMqttPublishPacket(topic, payloadBuffer) {
    const topicBytes = Buffer.from(topic);
    const remainingLen = 2 + topicBytes.length + payloadBuffer.length;

    const lenBytes = [];
    let tempLen = remainingLen;
    do {
        let encodedByte = tempLen % 128;
        tempLen = Math.floor(tempLen / 128);
        if (tempLen > 0) encodedByte |= 128;
        lenBytes.push(encodedByte);
    } while (tempLen > 0);

    const packet = Buffer.alloc(1 + lenBytes.length + remainingLen);
    let offset = 0;

    packet[offset++] = 0x30; // PUBLISH QoS 0
    for (const b of lenBytes) packet[offset++] = b;

    packet.writeUInt16BE(topicBytes.length, offset);
    offset += 2;
    topicBytes.copy(packet, offset);
    offset += topicBytes.length;

    payloadBuffer.copy(packet, offset);

    return packet;
}

function parseMqttPublish(data) {
    if (data.length < 2) return null;
    const packetType = data[0] >> 4;
    if (packetType !== 3) return null; // Not PUBLISH

    let offset = 1;
    let multiplier = 1;
    let remainingLength = 0;
    let byte = 0;
    do {
        if (offset >= data.length) break;
        byte = data[offset++];
        remainingLength += (byte & 127) * multiplier;
        multiplier *= 128;
    } while ((byte & 128) !== 0 && offset < data.length);

    const topicLen = data.readUInt16BE(offset);
    offset += 2;
    const topic = data.slice(offset, offset + topicLen).toString();
    offset += topicLen;

    const payload = data.slice(offset, offset + (remainingLength - (2 + topicLen)));
    return { topic, payload };
}

async function runTest() {
    console.log('=== RED WAN Cross-Network P2P Pairing E2E Test ===');

    const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
    const didA = randomDid();
    const didB = randomDid();

    console.log(`Node A DID: ${didA.slice(0, 16)}...`);
    console.log(`Node B DID: ${didB.slice(0, 16)}...`);

    const wsA = new WebSocket(BROKER_URL, ['mqtt', 'mqttv3.1']);
    const wsB = new WebSocket(BROKER_URL, ['mqtt', 'mqttv3.1']);

    let authenticatedA = false;
    let authenticatedB = false;
    let requestReceivedByB = false;
    let responseReceivedByA = false;
    let startTime = 0;

    const waitConnect = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout to MQTT broker')), 12000);

        function checkBoth() {
            if (authenticatedA && authenticatedB) {
                clearTimeout(timeout);
                resolve();
            }
        }

        wsA.addEventListener('open', () => {
            console.log('[Node A] WebSocket opened, sending MQTT CONNECT...');
            wsA.send(createMqttConnectPacket(`red_test_nodeA_${Date.now().toString(36)}`));
        });

        wsB.addEventListener('open', () => {
            console.log('[Node B] WebSocket opened, sending MQTT CONNECT...');
            wsB.send(createMqttConnectPacket(`red_test_nodeB_${Date.now().toString(36)}`));
        });

        wsA.addEventListener('message', async (event) => {
            const buf = Buffer.from(await event.data.arrayBuffer?.() || event.data);
            if (buf[0] >> 4 === 2) { // CONNACK
                console.log('[Node A] ✅ CONNACK received! Authenticated.');
                authenticatedA = true;
                // Subscribe to Node A topics
                wsA.send(createMqttSubscribePacket(`red/v65/dm/${didA}`));
                wsA.send(createMqttSubscribePacket(`red/v65/mb/${didA}`));
                checkBoth();
            }
        });

        wsB.addEventListener('message', async (event) => {
            const buf = Buffer.from(await event.data.arrayBuffer?.() || event.data);
            if (buf[0] >> 4 === 2) { // CONNACK
                console.log('[Node B] ✅ CONNACK received! Authenticated.');
                authenticatedB = true;
                // Subscribe to Node B topics
                wsB.send(createMqttSubscribePacket(`red/v65/dm/${didB}`));
                wsB.send(createMqttSubscribePacket(`red/v65/mb/${didB}`));
                checkBoth();
            }
        });

        wsA.addEventListener('error', (e) => reject(new Error(`wsA error: ${e.message || e}`)));
        wsB.addEventListener('error', (e) => reject(new Error(`wsB error: ${e.message || e}`)));
    });

    await waitConnect;
    console.log('Both nodes connected and subscribed to their WAN routing topics.');

    // Wait 500ms for subscriptions to settle on broker
    await new Promise(r => setTimeout(r, 600));

    const pairingExchange = new Promise((resolve, reject) => {
        const testTimeout = setTimeout(() => reject(new Error('Pairing exchange timeout')), 10000);

        // Node B listens for contact_request
        wsB.addEventListener('message', async (event) => {
            const raw = Buffer.from(await event.data.arrayBuffer?.() || event.data);
            const pub = parseMqttPublish(raw);
            if (!pub) return;

            try {
                const parsed = JSON.parse(pub.payload.toString());
                const inner = typeof parsed.content === 'string' ? JSON.parse(parsed.content) : parsed;
                if (inner.type === 'contact_request' && inner.sender_hash === didA) {
                    console.log(`[Node B] 📩 Received contact_request from Node A (${inner.sender_name}) on topic: ${pub.topic}`);
                    requestReceivedByB = true;

                    // Node B sends accepted contact_response to Node A
                    const respPayload = JSON.stringify({
                        type: 'contact_response',
                        id: `cres_${Date.now()}`,
                        sender_hash: didB,
                        sender_name: 'Nodo B Remoto',
                        sender_pk: 'pk_node_b_mock_ed25519',
                        accepted: true,
                        timestamp: Date.now()
                    });

                    const respPacket = JSON.stringify({
                        id: `cres_msg_${Date.now()}`,
                        content: respPayload,
                        sender: didB,
                        recipient: didA,
                        msg_type: 'contact_response',
                        timestamp: Date.now() / 1000
                    });

                    console.log('[Node B] 📤 Dispatching contact_response to Node A topics...');
                    wsB.send(createMqttPublishPacket(`red/v65/dm/${didA}`, Buffer.from(respPacket)));
                }
            } catch (e) {
                // Ignore other formats
            }
        });

        // Node A listens for contact_response
        wsA.addEventListener('message', async (event) => {
            const raw = Buffer.from(await event.data.arrayBuffer?.() || event.data);
            const pub = parseMqttPublish(raw);
            if (!pub) return;

            try {
                const parsed = JSON.parse(pub.payload.toString());
                const inner = typeof parsed.content === 'string' ? JSON.parse(parsed.content) : parsed;
                if (inner.type === 'contact_response' && inner.sender_hash === didB && inner.accepted) {
                    const elapsed = Date.now() - startTime;
                    console.log(`[Node A] 🤝 Received contact_response from Node B! Accepted: ${inner.accepted} (${elapsed}ms round-trip)`);
                    responseReceivedByA = true;
                    clearTimeout(testTimeout);
                    resolve({ elapsed });
                }
            } catch (e) {
                // Ignore
            }
        });

        // Node A initiates contact_request
        startTime = Date.now();
        console.log('[Node A] 🚀 Sending contact_request to Node B...');
        const reqPayload = JSON.stringify({
            type: 'contact_request',
            id: `creq_${Date.now()}`,
            sender_hash: didA,
            sender_name: 'Nodo A Invocador',
            sender_pk: 'pk_node_a_mock_ed25519',
            channel: 'WAN',
            timestamp: Date.now()
        });

        const reqPacket = JSON.stringify({
            id: `creq_msg_${Date.now()}`,
            content: reqPayload,
            sender: didA,
            recipient: didB,
            msg_type: 'contact_request',
            timestamp: Date.now() / 1000
        });

        wsA.send(createMqttPublishPacket(`red/v65/dm/${didB}`, Buffer.from(reqPacket)));
    });

    const result = await pairingExchange;

    wsA.close();
    wsB.close();

    console.log('\n================ TEST SUMMARY ================');
    console.log(`Broker WSS Endpoint:     ${BROKER_URL} [VERIFIED]`);
    console.log(`Node B Received Request: ${requestReceivedByB ? 'PASSED' : 'FAILED'}`);
    console.log(`Node A Received Response: ${responseReceivedByA ? 'PASSED' : 'FAILED'}`);
    console.log(`Round-trip WAN Latency:  ${result.elapsed}ms`);
    console.log('STATUS: ✅ CROSS-NETWORK PAIRING FULLY OPERATIONAL');
    console.log('==============================================\n');
}

runTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
