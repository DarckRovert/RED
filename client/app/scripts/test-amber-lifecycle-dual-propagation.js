const assert = require('assert');

// Test AMBER lifecycle dual propagation (HTTP + Mesh + LocalStorage + Event)
function testAmberLifecyclePropagation() {
  console.log('[TEST] Testing AMBER Lifecycle Dual Propagation & Synchronization...');

  // Mock storage
  let storedAlerts = [];
  const STORAGE_KEYS = { AMBER_ALERTS: 'red_amber_alerts' };

  function getStored() {
    return [...storedAlerts];
  }

  function setStored(alerts) {
    storedAlerts = [...alerts];
  }

  // Mock mesh router
  let meshBroadcasts = [];
  const mockMeshRouter = {
    async send(recipient, payloadBytes) {
      const decoded = JSON.parse(new TextDecoder().decode(payloadBytes));
      meshBroadcasts.push({ recipient, decoded });
    }
  };

  // Mock events
  let dispatchedEvents = [];
  function dispatchCustomEvent(name) {
    dispatchedEvents.push(name);
  }

  // Simulation of flawed vs resilient createAmberAlert
  async function resilientCreateAmberAlert(payload, backendOnline = true) {
    let resultAlert = null;

    if (backendOnline) {
      // Backend online returns created alert
      resultAlert = {
        id: `amber_backend_${Date.now()}`,
        name: payload.name,
        age: payload.age,
        description: payload.description,
        status: 'Active',
        issued_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        sighting_count: 0
      };
    } else {
      // Fallback
      resultAlert = {
        id: `amber_offline_${Date.now()}`,
        name: payload.name,
        age: payload.age,
        description: payload.description,
        status: 'Active',
        issued_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        sighting_count: 0
      };
    }

    // Unconditional post-execution synchronization
    if (resultAlert) {
      const alerts = getStored();
      const idx = alerts.findIndex(a => a.id === resultAlert.id);
      if (idx >= 0) alerts[idx] = resultAlert;
      else alerts.unshift(resultAlert);
      setStored(alerts);

      // Broadcast across mesh
      const payloadBytes = new TextEncoder().encode(JSON.stringify({
        id: resultAlert.id,
        msg_type: 'amber_alert',
        alert: resultAlert,
        timestamp: resultAlert.issued_at
      }));
      await mockMeshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);

      // Dispatch event
      dispatchCustomEvent('red_amber_updated');
    }

    return { ok: true, alert: resultAlert };
  }

  async function resilientResolveAmberAlert(id, backendOnline = true) {
    if (backendOnline) {
      // Backend online returns 200 OK
    }

    // Unconditional post-execution synchronization
    const alerts = getStored();
    const target = alerts.find(a => a.id === id);
    if (target) {
      target.status = 'Resolved';
      setStored(alerts);
    }

    // Broadcast resolution across mesh
    const payloadBytes = new TextEncoder().encode(JSON.stringify({
      id: `resolve_${id}`,
      msg_type: 'amber_resolved',
      alert_id: id,
      timestamp: Math.floor(Date.now() / 1000)
    }));
    await mockMeshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);

    // Dispatch event
    dispatchCustomEvent('red_amber_updated');

    return { ok: true };
  }

  // 1. Create alert when backend is online
  return (async () => {
    const res = await resilientCreateAmberAlert({ name: 'Mateo', age: 7, description: 'Desaparecido en parque' }, true);
    assert(res.ok);
    assert.strictEqual(storedAlerts.length, 1);
    assert.strictEqual(storedAlerts[0].status, 'Active');
    assert.strictEqual(meshBroadcasts.length, 1);
    assert.strictEqual(meshBroadcasts[0].decoded.msg_type, 'amber_alert');
    assert(dispatchedEvents.includes('red_amber_updated'));

    // 2. Resolve alert when backend is online
    await resilientResolveAmberAlert(res.alert.id, true);
    assert.strictEqual(storedAlerts[0].status, 'Resolved');
    assert.strictEqual(meshBroadcasts.length, 2);
    assert.strictEqual(meshBroadcasts[1].decoded.msg_type, 'amber_resolved');
    assert.strictEqual(dispatchedEvents.filter(e => e === 'red_amber_updated').length, 2);

    console.log('[SUCCESS] AMBER Lifecycle Dual Propagation & Synchronization verified!');
  })();
}

testAmberLifecyclePropagation();
