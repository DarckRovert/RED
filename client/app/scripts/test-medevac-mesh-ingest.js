const assert = require('assert');

// Simulation of MEDEVAC 9-Line packet dispatch and ingest
function testMedevacDispatch() {
  console.log('[TEST] Testing Tactical MEDEVAC 9-Line Mesh Ingest & SITREP Synergy...');

  // 1. Packet sent by TcccBallisticsModal
  const sentPayload = {
    type: "TACTICAL_MEDEVAC_9LINE",
    sender: "Delta-6",
    senderHash: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
    triageCategory: "URGENTE",
    victimLabel: "Baja T1",
    vitals: { bpm: 135, spo2: 89, respRate: 28 },
    tourniquetsCount: 2,
    bloodType: "O+",
    allergies: "Penicilina",
    emergencyContact: "+1234567890",
    location: { lat: 4.60971, lon: -74.08175 },
    timestamp: Date.now()
  };

  // 2. Mock sitrepEngine
  let sitrepCreated = null;
  const mockSitrepEngine = {
    createSitrep(report) {
      sitrepCreated = {
        ...report,
        id: `SITREP-MOCK`,
        timestamp: Date.now()
      };
      return sitrepCreated;
    }
  };

  // 3. Mock incoming handler in authSlice
  function handleMeshPacket(parsed, myHash) {
    if (parsed.type === 'TACTICAL_MEDEVAC_9LINE') {
      // Ignore if sent by ourselves
      if (myHash && parsed.senderHash && myHash.toLowerCase() === parsed.senderHash.toLowerCase()) {
        return null;
      }

      // 1. Create SITREP report on receiving peer
      const sitrep = mockSitrepEngine.createSitrep({
        unitCallsign: parsed.sender || 'Operador RED',
        operatorName: parsed.sender || 'Operador RED',
        location: {
          lat: typeof parsed.location?.lat === 'number' ? parsed.location.lat : 0,
          lon: typeof parsed.location?.lon === 'number' ? parsed.location.lon : 0
        },
        threatStatus: 'RED_CONTACT',
        friendlyTroopsCount: 1,
        casualties: {
          t1ImmediateRed: parsed.triageCategory === 'ROJO' || parsed.triageCategory === 'URGENTE' ? (parsed.tourniquetsCount || 1) : 0,
          t2DelayedYellow: parsed.triageCategory === 'AMARILLO' ? 1 : 0,
          t3MinimalGreen: parsed.triageCategory === 'VERDE' ? 1 : 0,
          t4ExpectantBlack: parsed.triageCategory === 'NEGRO' ? 1 : 0
        },
        suppliesAmmoPct: 100,
        suppliesMedicalPct: Math.max(10, 100 - ((parsed.tourniquetsCount || 1) * 25)),
        suppliesBatteryPct: 100,
        remarks: `🚨 MEDEVAC 9-LINE RECIBIDO: ${parsed.tourniquetsCount || 0} Torniquete(s) · Sangre: ${parsed.bloodType || 'DESCONOCIDO'} · Alergias: ${parsed.allergies || 'NINGUNA'}${parsed.victimLabel ? ` [Baja: ${parsed.victimLabel}]` : ''}`
      });

      // 2. Build human-readable formatted message for tactical chat
      const formattedContent = [
        `🚨 **SOLICITUD 9-LINE MEDEVAC URGENTE**`,
        `• **Operador / Víctima:** ${parsed.victimLabel || parsed.sender || 'Operador RED'}`,
        `• **Triage:** ${parsed.triageCategory || 'URGENTE'}`,
        `• **Torniquetes CAT:** ${parsed.tourniquetsCount || 0}`,
        `• **Grupo Sanguíneo:** ${parsed.bloodType || 'DESCONOCIDO'}`,
        `• **Alergias:** ${parsed.allergies || 'NINGUNA'}`,
        parsed.vitals?.bpm ? `• **Signos Vitales:** ${parsed.vitals.bpm} BPM / ${parsed.vitals.spo2 ?? '--'}% SpO2` : null,
        parsed.location?.lat ? `• **GPS:** ${parsed.location.lat.toFixed(5)}, ${parsed.location.lon.toFixed(5)}` : null,
        parsed.emergencyContact ? `• **Contacto Emergencia:** ${parsed.emergencyContact}` : null
      ].filter(Boolean).join('\n');

      const incomingMsg = {
        id: `medevac_${(parsed.senderHash || 'mesh').slice(0, 8)}_${Date.now()}`,
        sender: parsed.senderHash || parsed.sender,
        recipient: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        content: formattedContent,
        timestamp: parsed.timestamp ? parsed.timestamp / 1000 : Date.now() / 1000,
        is_mine: false,
        msg_type: 'medevac',
        status: 'Delivered',
        priority: 'EMERGENCY'
      };

      return { sitrep, incomingMsg };
    }
    return null;
  }

  // Execute receiver handler on remote peer
  const result = handleMeshPacket(sentPayload, 'remote_peer_11223344');
  assert(result, 'MEDEVAC packet must be processed');
  assert(sitrepCreated, 'SITREP must be created on receiver node');
  assert.strictEqual(sitrepCreated.threatStatus, 'RED_CONTACT');
  assert.strictEqual(sitrepCreated.casualties.t1ImmediateRed, 2);
  assert(result.incomingMsg.content.includes('SOLICITUD 9-LINE MEDEVAC URGENTE'));
  assert.strictEqual(result.incomingMsg.msg_type, 'medevac');

  // Verify self-echo is suppressed
  const selfResult = handleMeshPacket(sentPayload, sentPayload.senderHash);
  assert.strictEqual(selfResult, null, 'Self-echo must be cleanly suppressed to avoid double alarms');

  console.log('[SUCCESS] Tactical MEDEVAC 9-Line Mesh Ingest logic verified!');
}

testMedevacDispatch();
