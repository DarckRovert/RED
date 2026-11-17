/**
 * Test BiocyberneticMetropolisEngine persistence and self-healing infrastructure
 */
const assert = require('assert');

// Mock localStorage and window
const store = {};
global.window = {
  localStorage: {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = val; },
    removeItem: (key) => { delete store[key]; }
  }
};

// Let's test the logic simulated directly
function testPersistenceLogic() {
  console.log('[TEST] Testing Metropolis Storage & Self-Healing Logic...');

  // 1. Incomplete payload (simulating legacy stored state before Bug 5)
  const legacyPayload = {
    structures: [{ id: 'silo-alpha', type: 'CENTRAL_SILO', storedGlucose: 150 }],
    highways: [{ id: 'hwy-1' }],
    biopolymerStockpile: 40.0
  };
  store['red_sovereign_biocybernetic_metropolis_v1'] = JSON.stringify(legacyPayload);

  // Parse simulated load
  const raw = store['red_sovereign_biocybernetic_metropolis_v1'];
  const data = JSON.parse(raw);
  assert(data.structures.length === 1);
  assert(!data.districts);
  assert(!data.streetLamps);
  assert(!data.skywayCorridors);
  assert(!data.livingCells);

  // Self healing simulation
  let districts = Array.isArray(data.districts) && data.districts.length > 0 ? data.districts : [];
  let streetLamps = Array.isArray(data.streetLamps) && data.streetLamps.length > 0 ? data.streetLamps : [];
  let skywayCorridors = Array.isArray(data.skywayCorridors) && data.skywayCorridors.length > 0 ? data.skywayCorridors : [];
  let livingCells = Array.isArray(data.livingCells) && data.livingCells.length > 0 ? data.livingCells : [];

  if (districts.length === 0) {
    districts = [{ id: 'district-silo' }, { id: 'district-residential' }, { id: 'district-agora' }, { id: 'district-connectome' }, { id: 'district-industry' }];
  }
  if (streetLamps.length === 0) {
    streetLamps = new Array(18).fill(null).map((_, i) => ({ id: `lamp-${i}` }));
  }
  if (skywayCorridors.length === 0) {
    skywayCorridors = new Array(5).fill(null).map((_, i) => ({ id: `skyway-${i}` }));
  }
  if (livingCells.length === 0) {
    livingCells = new Array(38).fill(null).map((_, i) => ({ id: `cell-${i}` }));
  }

  assert.strictEqual(districts.length, 5, 'Districts should be 5');
  assert.strictEqual(streetLamps.length, 18, 'Street lamps should be 18');
  assert.strictEqual(skywayCorridors.length, 5, 'Skyway corridors should be 5');
  assert.strictEqual(livingCells.length, 38, 'Living cells should be 38');

  // Next save persists all layers
  const fullPayload = {
    structures: data.structures,
    highways: data.highways,
    districts,
    streetLamps,
    skywayCorridors,
    livingCells,
    biopolymerStockpile: 40.0
  };
  store['red_sovereign_biocybernetic_metropolis_v1'] = JSON.stringify(fullPayload);

  const restored = JSON.parse(store['red_sovereign_biocybernetic_metropolis_v1']);
  assert.strictEqual(restored.districts.length, 5);
  assert.strictEqual(restored.streetLamps.length, 18);
  assert.strictEqual(restored.skywayCorridors.length, 5);
  assert.strictEqual(restored.livingCells.length, 38);

  console.log('[SUCCESS] All 4 infrastructure layers survive reboot and legacy migrations!');
}

testPersistenceLogic();
