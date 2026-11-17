/**
 * test-amber-admin-sar-resilience.js — Test de verificación empírica de resiliencia
 * para el Centro de Comando y Panel Administrativo de Alertas AMBER SAR.
 */

const assert = require('assert');

// 1. Mock de almacenamiento local
const mockStorage = new Map();
function getStored(key, def) {
    if (!mockStorage.has(key)) return def;
    try { return JSON.parse(mockStorage.get(key)); } catch { return def; }
}
function setStored(key, val) {
    mockStorage.set(key, JSON.stringify(val));
}

// 2. Simulación de getAmberAlerts con soporte para includeResolved
function simulateGetAmberAlerts(includeResolved = false) {
    const alerts = getStored('red_amber_alerts', []);
    const nowSecs = Math.floor(Date.now() / 1000);
    if (includeResolved) {
        return alerts;
    }
    return alerts.filter(a => a.status === 'Active' && (!a.expires_at || a.expires_at > nowSecs));
}

// 3. Simulación de reportSighting con actualización local inmediata
function simulateReportSighting(alertId, payload) {
    const alerts = getStored('red_amber_alerts', []);
    const target = alerts.find(a => a.id === alertId);
    if (target) {
        target.sighting_count = (target.sighting_count || 0) + 1;
        setStored('red_amber_alerts', alerts);
    }
    return { ok: true };
}

// 4. Normalizador de foto
function normalizePhotoSrc(photo_b64) {
    if (!photo_b64 || photo_b64 === '[PHOTO_AVAILABLE]') return null;
    return photo_b64.startsWith('data:') ? photo_b64 : `data:image/jpeg;base64,${photo_b64}`;
}

// 5. Determinador de estado resuelto
function isAlertResolved(a) {
    return a.status === 'Resolved' || Boolean(a.resolved);
}

console.log("--- TEST 1: getAmberAlerts(includeResolved) ---");
const testAlerts = [
    { id: 'amber_1', name: 'Niño A', age: 8, status: 'Active', sighting_count: 0 },
    { id: 'amber_2', name: 'Niño B', age: 12, status: 'Resolved', sighting_count: 3, resolution_notes: 'Localizado con bien' }
];
setStored('red_amber_alerts', testAlerts);

const activeOnly = simulateGetAmberAlerts(false);
assert.strictEqual(activeOnly.length, 1, "Banner solo debe ver activas");
assert.strictEqual(activeOnly[0].id, 'amber_1');

const allAlerts = simulateGetAmberAlerts(true);
assert.strictEqual(allAlerts.length, 2, "Panel admin SAR debe ver activas y resueltas");
console.log("✅ getAmberAlerts distingue correctamente entre vista banner y vista admin.");

console.log("--- TEST 2: Determinación higiénica de estado resuelto ---");
assert.strictEqual(isAlertResolved(testAlerts[0]), false, "Alerta activa no debe estar resuelta");
assert.strictEqual(isAlertResolved(testAlerts[1]), true, "Alerta con status Resolved debe reconocerse como resuelta");
assert.strictEqual(isAlertResolved({ id: 'amber_3', status: 'Active', resolved: true }), true, "Alerta legacy resolved:true debe ser resuelta");
console.log("✅ isAlertResolved resuelve sin ambigüedad en ambos esquemas de datos.");

console.log("--- TEST 3: Reporte de avistamiento local y telemetría ---");
simulateReportSighting('amber_1', { lat: 19.43, lon: -99.13, notes: 'Visto en terminal' });
const updatedAlerts = simulateGetAmberAlerts(true);
const target = updatedAlerts.find(a => a.id === 'amber_1');
assert.strictEqual(target.sighting_count, 1, "El contador de avistamientos debe incrementarse");
console.log("✅ reportSighting incrementa sighting_count inmediatamente.");

console.log("--- TEST 4: Normalización de foto y descarte de marcadores de ancho de banda ---");
assert.strictEqual(normalizePhotoSrc(null), null);
assert.strictEqual(normalizePhotoSrc('[PHOTO_AVAILABLE]'), null);
assert.strictEqual(normalizePhotoSrc('abc123raw'), 'data:image/jpeg;base64,abc123raw');
assert.strictEqual(normalizePhotoSrc('data:image/png;base64,png123'), 'data:image/png;base64,png123');
console.log("✅ Fotos sanitizadas sin duplicación de esquema data:.");

console.log("\n>>> TODOS LOS TESTS DE SAR RESILIENCE PASARON CON ÉXITO <<<");
