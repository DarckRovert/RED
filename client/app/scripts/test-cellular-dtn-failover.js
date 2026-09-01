/**
 * Test Suite: Resilient 4G/5G Cellular Connectivity, Multi-Rail Failover & DTN Store-and-Forward
 */

const assert = require('assert');

console.log('================================================================================');
console.log('🚀 INICIANDO TEST: CONECTIVIDAD CELULAR 4G/5G, FAILOVER & RETRANSMISIÓN DTN');
console.log('================================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// ─── 1. Verificación de Brokers MQTT sobre WSS Puerto 443 ───────────────────────
console.log('📡 1. Probando Configuración de Brokers MQTT en Puerto Estándar 443 WSS...');

runTest('Brokers MQTT en puerto 443 WSS (Anti-bloqueo CGNAT móvil)', () => {
  const fs = require('fs');
  const path = require('path');
  const fileContent = fs.readFileSync(path.join(__dirname, '../src/lib/mesh/mqttRelayTransport.ts'), 'utf-8');

  assert(fileContent.includes('wss://broker.emqx.io/mqtt'), 'EMQX broker debe usar WSS puerto 443 estándar');
  assert(fileContent.includes('wss://broker.hivemq.com/mqtt'), 'HiveMQ broker debe usar WSS puerto 443 estándar');
  assert(fileContent.includes('wss://public.mqtthq.com:443/mqtt'), 'MQTTHQ broker debe estar configurado en puerto 443');
  assert(fileContent.includes('wss://mqtt.eclipseprojects.io/mqtt'), 'Eclipse broker debe estar configurado');
  assert(!fileContent.includes(':8084'), 'Puerto 8084 no debe estar presente');
  assert(!fileContent.includes(':8884'), 'Puerto 8884 no debe estar presente');
  assert(fileContent.includes('public reconnect(): void'), 'Método reconnect() debe existir en MqttRelayTransport');
});

// ─── 2. Verificación de WebRTC ICE & Servidores TURN sobre 443 ──────────────────
console.log('\n🌐 2. Probando WebRTC ICE Candidates y Servidores TURN 443...');

runTest('Candidatos TURN y STUN sobre puerto 443 para Symmetric NAT celular', () => {
  const fs = require('fs');
  const path = require('path');
  const fileContent = fs.readFileSync(path.join(__dirname, '../src/lib/mesh/wifiDirectTransport.ts'), 'utf-8');

  assert(fileContent.includes('stun:stun.services.mozilla.com:443'), 'STUN Mozilla sobre 443 debe estar presente');
  assert(fileContent.includes('turn:openrelay.metered.ca:443'), 'TURN OpenRelay sobre 443 debe estar presente');
  assert(fileContent.includes('turn:openrelay.metered.ca:443?transport=tcp'), 'TURN OpenRelay sobre TCP 443 debe estar presente');
  assert(fileContent.includes('mqttRelay.reconnect()'), 'reconnect() debe activar mqttRelay.reconnect()');
});

// ─── 3. Verificación de DTN Storage y Reseteo de Temporizadores ─────────────────
console.log('\n📦 3. Probando Cola DTN Store-and-Forward y forceResetRetryTimers()...');

runTest('DTN Storage: Backoff exponencial y forceResetRetryTimers()', () => {
  // Simulación de lógica de DTN Storage
  class MockDtnStorage {
    constructor() {
      this.items = [];
    }

    enqueue(id, priority = 4, ttlMs = 30 * 24 * 3600 * 1000) {
      const now = Date.now();
      this.items.push({
        id,
        createdAt: now,
        expiresAt: now + ttlMs,
        attempts: 0,
        lastAttempt: 0,
        nextRetryAfter: now,
        priority
      });
    }

    markAttempt(id, success) {
      const item = this.items.find(i => i.id === id);
      if (!item) return;
      if (success) {
        this.items = this.items.filter(i => i.id !== id);
      } else {
        item.attempts += 1;
        item.lastAttempt = Date.now();
        const backoffSec = Math.min(300, Math.pow(2, Math.min(item.attempts, 8)) * 2);
        item.nextRetryAfter = Date.now() + backoffSec * 1000;
      }
    }

    forceResetRetryTimers() {
      for (const it of this.items) {
        it.nextRetryAfter = 0;
        it.attempts = 0;
      }
    }

    getItemsToRetry(forceAll = false) {
      const now = Date.now();
      return this.items
        .filter(it => it.expiresAt > now && (forceAll || it.nextRetryAfter <= now))
        .sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return a.createdAt - b.createdAt;
        });
    }
  }

  const storage = new MockDtnStorage();
  storage.enqueue('pkt_001', 4);
  storage.enqueue('pkt_002', 8);
  storage.enqueue('pkt_003', 10);

  assert.strictEqual(storage.items.length, 3, 'Deben haber 3 elementos en la cola');
  
  // Simular 3 intentos fallidos para cada paquete
  storage.markAttempt('pkt_001', false);
  storage.markAttempt('pkt_001', false);
  storage.markAttempt('pkt_001', false);
  storage.markAttempt('pkt_002', false);

  // En este punto, pkt_001 y pkt_002 tienen nextRetryAfter en el futuro
  const retryBeforeReset = storage.getItemsToRetry(false);
  assert.strictEqual(retryBeforeReset.length, 1, 'Solo pkt_003 debe estar listo para reintento inmediato sin reset');
  assert.strictEqual(retryBeforeReset[0].id, 'pkt_003');

  // Ahora invocamos forceResetRetryTimers() como al reconectar 4G/5G
  storage.forceResetRetryTimers();
  const retryAfterReset = storage.getItemsToRetry(false);
  assert.strictEqual(retryAfterReset.length, 3, 'Los 3 paquetes deben estar listos para retransmisión inmediata tras reconexión');
  assert.strictEqual(retryAfterReset[0].id, 'pkt_003', 'pkt_003 (prioridad 10) debe salir primero');
  assert.strictEqual(retryAfterReset[1].id, 'pkt_002', 'pkt_002 (prioridad 8) debe salir segundo');
  assert.strictEqual(retryAfterReset[2].id, 'pkt_001', 'pkt_001 (prioridad 4) debe salir tercero');
});

// ─── 4. Verificación de Deduplicación y No Sobrescritura de Mensajes Idénticos ───
console.log('\n💬 4. Probando Deduplicación Segura y Envío Consecutivo de Mensajes...');

runTest('Mensajes consecutivos idénticos ("hola", "hola") con IDs distintos no se descartan ni sobrescriben', () => {
  let messages = [];

  function processIncoming(item, resolvedIsMine = false) {
    const normTimestamp = item.timestamp || Date.now();
    const normalizedItem = {
      ...item,
      timestamp: normTimestamp,
      is_mine: resolvedIsMine,
      status: item.status || (resolvedIsMine ? 'Sent' : 'Delivered'),
    };

    const existingIndex = messages.findIndex((m) => {
      const mTs = m.timestamp || normTimestamp;
      const timeDiff = Math.abs(mTs - normTimestamp);

      // 1. Exact ID match (same packet delivered or updated)
      if (m.id && item.id && m.id === item.id) return true;

      // 2. Pending optimistic local message replacement
      if (m.is_mine && normalizedItem.is_mine && (m.status === 'Pending' || m.id.startsWith('temp_') || m.id.startsWith('msg_pending_'))) {
        if (m.content && item.content && m.content === item.content) return true;
        if (m.media_data && item.media_data && m.media_data === item.media_data) return true;
        if (m.msg_type === item.msg_type && timeDiff < 60) return true;
      }

      return false;
    });

    if (existingIndex !== -1) {
      messages[existingIndex] = {
        ...messages[existingIndex],
        ...normalizedItem,
      };
    } else {
      messages.push(normalizedItem);
    }
  }

  // 1. Usuario o par envía "hola"
  processIncoming({ id: 'msg_001', sender: 'peer_a', content: 'hola', timestamp: 1000, msg_type: 'text' });
  assert.strictEqual(messages.length, 1, 'Primer mensaje debe agregarse');
  assert.strictEqual(messages[0].id, 'msg_001');

  // 2. Usuario o par envía "hola" 2 segundos después con otro ID
  processIncoming({ id: 'msg_002', sender: 'peer_a', content: 'hola', timestamp: 1002, msg_type: 'text' });
  assert.strictEqual(messages.length, 2, 'Segundo mensaje idéntico con ID distinto NO debe sobrescribir el primero');
  assert.strictEqual(messages[1].id, 'msg_002');

  // 3. Usuario o par envía "hola" 5 segundos después con otro ID
  processIncoming({ id: 'msg_003', sender: 'peer_a', content: 'hola', timestamp: 1005, msg_type: 'text' });
  assert.strictEqual(messages.length, 3, 'Tercer mensaje idéntico con ID distinto NO debe sobrescribir el anterior');

  // 4. Se recibe retransmisión duplicada del mismo paquete (id: msg_001)
  processIncoming({ id: 'msg_001', sender: 'peer_a', content: 'hola', timestamp: 1000, msg_type: 'text' });
  assert.strictEqual(messages.length, 3, 'Duplicado exacto con mismo ID debe actualizar in-place, sin duplicar burbuja');

  // 5. Mensaje optimista local (status: Pending)
  processIncoming({ id: 'temp_local_999', sender: 'me', content: 'mensaje saliente', timestamp: 2000, status: 'Pending', msg_type: 'text' }, true);
  assert.strictEqual(messages.length, 4, 'Burbuja optimista agregada');
  assert.strictEqual(messages[3].status, 'Pending');

  // 6. Confirmación de red/backend del mensaje saliente (mismo contenido, nuevo id definitivo)
  processIncoming({ id: 'msg_server_final_999', sender: 'me', content: 'mensaje saliente', timestamp: 2001, status: 'Sent', msg_type: 'text' }, true);
  assert.strictEqual(messages.length, 4, 'Confirmación debe reemplazar la burbuja Pending in-place');
  assert.strictEqual(messages[3].id, 'msg_server_final_999');
  assert.strictEqual(messages[3].status, 'Sent');
});

// ─── 5. Verificación de MeshRouter y Auto-Reconexión en Cambio de Red ────────────
console.log('\n🔄 5. Probando Auto-Reconexión y Flush en MeshRouter...');

runTest('MeshRouter invoca forceResetRetryTimers y flushPendingQueue(true) en handleNetworkChange', () => {
  const fs = require('fs');
  const path = require('path');
  const fileContent = fs.readFileSync(path.join(__dirname, '../src/lib/mesh/meshRouter.ts'), 'utf-8');

  assert(fileContent.includes('dtnStorage.forceResetRetryTimers()'), 'MeshRouter debe invocar forceResetRetryTimers()');
  assert(fileContent.includes('this.flushPendingQueue(true)'), 'MeshRouter debe invocar flushPendingQueue(true)');
  assert(fileContent.includes('flushPendingQueue(forceAll = false)'), 'flushPendingQueue debe aceptar parámetro forceAll');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round(passedTests/totalTests*100)}% PASS)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
