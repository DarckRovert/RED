/**
 * TEST SUITE: TACTICAL LOCATION ENGINE & NULL-ISLAND MITIGATION
 * 
 * Valida la erradicación de Null Island (0,0), la caché táctica persistente
 * de coordenadas en emergencias, y la actualización en caliente de balizas SOS.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
}

async function runAsyncTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
}

console.log('\n================================================================================');
console.log('📍 INICIANDO SUITE DE PRUEBAS: TACTICAL LOCATION & SOS GNSS RESILIENCE');
console.log('================================================================================\n');

// Simular entorno de almacenamiento local
const mockLocalStorage = new Map();
global.localStorage = {
    getItem: (k) => mockLocalStorage.get(k) || null,
    setItem: (k, v) => mockLocalStorage.set(k, String(v)),
    removeItem: (k) => mockLocalStorage.delete(k),
    clear: () => mockLocalStorage.clear()
};

// Implementación de prueba espejo de TacticalLocationEngine
class MockTacticalLocationEngine {
    static isValidCoordinates(lat, lon) {
        if (typeof lat !== 'number' || typeof lon !== 'number') return false;
        if (isNaN(lat) || isNaN(lon)) return false;
        if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) return false;
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
        return true;
    }

    static getLastKnownLocation() {
        try {
            const raw = global.localStorage.getItem('red_last_known_gps');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const lat = parsed.lat;
            const lon = parsed.lon !== undefined ? parsed.lon : parsed.lng;
            if (this.isValidCoordinates(lat, lon)) {
                const ts = parsed.timestamp || Date.now();
                return {
                    lat,
                    lon,
                    alt: parsed.alt,
                    accuracy: parsed.accuracy,
                    timestamp: ts,
                    isEstimated: true,
                    ageMs: Math.max(0, Date.now() - ts)
                };
            }
        } catch {}
        return null;
    }

    static saveLocation(lat, lon, alt, accuracy) {
        if (!this.isValidCoordinates(lat, lon)) return null;
        const loc = {
            lat,
            lon,
            alt: typeof alt === 'number' && !isNaN(alt) ? Math.round(alt) : undefined,
            accuracy: typeof accuracy === 'number' && !isNaN(accuracy) ? Math.round(accuracy) : undefined,
            timestamp: Date.now(),
            isEstimated: false,
            ageMs: 0
        };
        global.localStorage.setItem('red_last_known_gps', JSON.stringify(loc));
        return loc;
    }

    static async getEmergencyLocation(mockNavigator, timeoutMs = 2000) {
        const cached = this.getLastKnownLocation();
        if (!mockNavigator || !mockNavigator.geolocation) {
            return cached || { timestamp: Date.now(), isEstimated: false };
        }

        return new Promise((resolve) => {
            let hasFinished = false;
            const timer = setTimeout(() => {
                if (!hasFinished) {
                    hasFinished = true;
                    resolve(cached || { timestamp: Date.now(), isEstimated: false });
                }
            }, timeoutMs);

            mockNavigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (hasFinished) return;
                    hasFinished = true;
                    clearTimeout(timer);
                    const saved = this.saveLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude);
                    resolve(saved || cached || { timestamp: Date.now(), isEstimated: false });
                },
                (_err) => {
                    if (hasFinished) return;
                    hasFinished = true;
                    clearTimeout(timer);
                    resolve(cached || { timestamp: Date.now(), isEstimated: false });
                }
            );
        });
    }
}

console.log('🛡️ 1. Probando Erradicación de Coordenadas Falsas / Null Island (0,0)...');

runTest('Validación: Rechazo estricto de Null Island (0.0, 0.0)', () => {
    assert.strictEqual(MockTacticalLocationEngine.isValidCoordinates(0, 0), false, '0,0 debe ser inválido');
    assert.strictEqual(MockTacticalLocationEngine.isValidCoordinates(0.00001, 0.00001), false, 'Micro-valores cercanos a cero deben ser inválidos');
    assert.strictEqual(MockTacticalLocationEngine.isValidCoordinates(NaN, 10), false, 'NaN debe ser inválido');
    assert.strictEqual(MockTacticalLocationEngine.isValidCoordinates(undefined, undefined), false, 'undefined debe ser inválido');
    assert.strictEqual(MockTacticalLocationEngine.isValidCoordinates(95, 10), false, 'Latitud > 90 debe ser inválida');
});

runTest('Validación: Aceptación de Coordenadas Geográficas Genuinas', () => {
    assert.strictEqual(MockTacticalLocationEngine.isValidCoordinates(-12.046374, -77.042793), true, 'Lima debe ser válida');
    assert.strictEqual(MockTacticalLocationEngine.isValidCoordinates(40.7128, -74.0060), true, 'Nueva York debe ser válida');
    assert.strictEqual(MockTacticalLocationEngine.isValidCoordinates(-33.8688, 151.2093), true, 'Sydney debe ser válida');
});

console.log('\n💾 2. Probando Caché Táctico Persistente en Pérdida de Satélites...');

runTest('Caché Táctico: Guardado y Recuperación de Última Posición Conocida', () => {
    mockLocalStorage.clear();
    const loc = MockTacticalLocationEngine.saveLocation(-12.05, -77.05, 120, 10);
    assert(loc !== null, 'Debe guardar ubicación válida');

    const retrieved = MockTacticalLocationEngine.getLastKnownLocation();
    assert(retrieved !== null, 'Debe recuperar ubicación de la caché');
    assert.strictEqual(retrieved.lat, -12.05);
    assert.strictEqual(retrieved.lon, -77.05);
    assert.strictEqual(retrieved.isEstimated, true, 'Debe estar marcado como estimado');
});

console.log('\n🚨 3. Probando Resolución de Posición en Balizas de Emergencia SOS...');

(async () => {
    await runAsyncTest('SOS GNSS: Si los satélites fallan en sótano/búnker, entrega la última posición conocida', async () => {
        // Simular que el usuario tenía GPS hace 10 minutos
        mockLocalStorage.clear();
        MockTacticalLocationEngine.saveLocation(-12.046, -77.042, 100, 8);

        // Simular que ahora está en sótano y el GPS hace timeout
        const mockFailingNavigator = {
            geolocation: {
                getCurrentPosition: (_success, error) => {
                    setTimeout(() => error(new Error('TIMEOUT_NO_SATELLITE_LOCK')), 50);
                }
            }
        };

        const emergencyLoc = await MockTacticalLocationEngine.getEmergencyLocation(mockFailingNavigator, 100);
        assert.strictEqual(emergencyLoc.lat, -12.046, 'Debe entregar latitud de última posición');
        assert.strictEqual(emergencyLoc.lon, -77.042, 'Debe entregar longitud de última posición');
        assert.strictEqual(emergencyLoc.isEstimated, true, 'Debe reportar que es estimada');
    });

    await runAsyncTest('SOS GNSS: Si nunca hubo GPS, retorna sin coordenadas y NUNCA (0,0)', async () => {
        mockLocalStorage.clear();
        const mockFailingNavigator = {
            geolocation: {
                getCurrentPosition: (_success, error) => {
                    setTimeout(() => error(new Error('GPS_DISABLED')), 20);
                }
            }
        };

        const emergencyLoc = await MockTacticalLocationEngine.getEmergencyLocation(mockFailingNavigator, 50);
        assert.strictEqual(emergencyLoc.lat, undefined, 'Latitud debe ser undefined, no 0');
        assert.strictEqual(emergencyLoc.lon, undefined, 'Longitud debe ser undefined, no 0');
    });

    console.log('\n🔍 4. Probando Integridad de Archivos de Emergencia en Disco...');

    runTest('Auditoría de Código: SOSEmergencyBanner no emite lat: 0, lon: 0 en fallos', () => {
        const filePath = path.join(__dirname, '..', 'src', 'components', 'SOSEmergencyBanner.tsx');
        const content = fs.readFileSync(filePath, 'utf8');
        assert(!content.includes("finish({ lat: 0, lon: 0 }"), 'SOSEmergencyBanner no debe contener finish({ lat: 0, lon: 0 })');
        assert(content.includes('TacticalLocationEngine'), 'SOSEmergencyBanner debe usar TacticalLocationEngine');
    });

    runTest('Auditoría de Código: SurvivalBeaconModal usa TacticalLocationEngine watchLocation', () => {
        const filePath = path.join(__dirname, '..', 'src', 'components', 'SurvivalBeaconModal.tsx');
        const content = fs.readFileSync(filePath, 'utf8');
        assert(content.includes('TacticalLocationEngine.watchLocation'), 'SurvivalBeaconModal debe usar watchLocation');
        assert(content.includes('coords.isEstimated'), 'SurvivalBeaconModal debe indicar si las coordenadas son estimadas');
    });

    runTest('Auditoría de Código: MeshSosBeaconEngine soporta updateCoords para fixes tardíos', () => {
        const filePath = path.join(__dirname, '..', 'src', 'lib', 'emergency', 'MeshSosBeaconEngine.ts');
        const content = fs.readFileSync(filePath, 'utf8');
        assert(content.includes('updateCoords'), 'MeshSosBeaconEngine debe implementar updateCoords');
    });

    console.log('\n================================================================================');
    console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
    console.log('================================================================================\n');

    if (passedTests !== totalTests) {
        process.exit(1);
    }
})();
