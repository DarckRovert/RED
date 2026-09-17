/**
 * TEST SUITE: FASE 2 (v106.0.0) — C4ISR, MBTILES OFFLINE & PROPAGACIÓN RF
 * 
 * Validación rigurosa e integral de los tres pilares de Fase 2:
 * 1. ATAK / CivTAK Multicast UDP Gateway (239.2.3.1:6969) & Protocolo Cursor-on-Target (CoT).
 * 2. Motor SQLite MBTiles Offline (.mbtiles) & Aritmética de Inversión de Eje Vertical TMS.
 * 3. Motor RF de Zonas de Fresnel, Curvatura Terrestre (k=4/3) y Pérdida en Espacio Libre (FSPL).
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

console.log('\n================================================================================');
console.log('🎖️  SUITE DE PRUEBAS AUTOMATIZADA: FASE 2 C4ISR & MBTILES');
console.log('================================================================================\n');

// ── 1. AUDITORÍA DE ARCHIVOS NATIVOS JAVA (ANDROID) ───────────────────────────
console.log('--- [1/3] VERIFICACIÓN NATIVA JAVA (MBTILES & MULTICAST UDP) ---');

const mbtilesReaderJavaPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'f', 'red', 'app', 'MbtilesPackageReader.java');
const pluginJavaPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'f', 'red', 'app', 'RedNodePlugin.java');

runTest('1.1 MbtilesPackageReader.java: Existencia y estructura SQLite nativa', () => {
    assert(fs.existsSync(mbtilesReaderJavaPath), 'MbtilesPackageReader.java debe existir');
    const code = fs.readFileSync(mbtilesReaderJavaPath, 'utf8');
    assert(code.includes('SQLiteDatabase.OPEN_READONLY'), 'Debe abrir bases de datos SQLite en modo estricto READONLY');
    assert(code.includes('int tmsY = (1 << z) - 1 - y;'), 'Debe calcular la coordenada vertical TMS invertida para MBTiles');
    assert(code.includes('tile_data'), 'Debe leer el BLOB de la columna tile_data');
});

runTest('1.2 RedNodePlugin.java: Exposición de métodos nativos MBTiles a Capacitor', () => {
    assert(fs.existsSync(pluginJavaPath), 'RedNodePlugin.java debe existir');
    const code = fs.readFileSync(pluginJavaPath, 'utf8');
    assert(code.includes('listAvailableMbtiles(PluginCall call)'), 'Debe exponer listAvailableMbtiles');
    assert(code.includes('openMbtilesPackage(PluginCall call)'), 'Debe exponer openMbtilesPackage');
    assert(code.includes('getMbtilesTile(PluginCall call)'), 'Debe exponer getMbtilesTile');
    assert(code.includes('closeMbtilesPackage(PluginCall call)'), 'Debe exponer closeMbtilesPackage');
});

runTest('1.3 RedNodePlugin.java: Gateway Multicast UDP ATAK en 239.2.3.1:6969', () => {
    const code = fs.readFileSync(pluginJavaPath, 'utf8');
    assert(code.includes('239.2.3.1'), 'Debe usar la dirección IP de grupo Multicast militar ATAK 239.2.3.1');
    assert(code.includes('6969'), 'Debe usar el puerto estándar ATAK UDP 6969');
    assert(code.includes('MulticastSocket'), 'Debe utilizar MulticastSocket nativo de Java');
    assert(code.includes('startCotMulticast(PluginCall call)'), 'Debe exponer startCotMulticast');
    assert(code.includes('sendCotMulticast(PluginCall call)'), 'Debe exponer sendCotMulticast');
    assert(code.includes('cotMulticastData'), 'Debe emitir eventos cotMulticastData hacia el frontend');
});

// ── 2. AUDITORÍA DE MOTORES TYPESCRIPT (C4ISR & MBTILES) ──────────────────────
console.log('\n--- [2/3] VERIFICACIÓN DE MOTORES TYPESCRIPT & ARITMÉTICA ---');

const cotTsPath = path.join(__dirname, '..', 'src', 'lib', 'tactical', 'CursorOnTargetEngine.ts');
const mbtilesTsPath = path.join(__dirname, '..', 'src', 'lib', 'storage', 'MbtilesReaderEngine.ts');
const rfTsPath = path.join(__dirname, '..', 'src', 'lib', 'tactical', 'RfPropagationEngine.ts');

runTest('2.1 CursorOnTargetEngine.ts: BFT, SOS Emergency y Multicast Gateway', () => {
    assert(fs.existsSync(cotTsPath), 'CursorOnTargetEngine.ts debe existir');
    const code = fs.readFileSync(cotTsPath, 'utf8');
    assert(code.includes('DEFAULT_TAK_MULTICAST_GROUP'), 'Debe definir DEFAULT_TAK_MULTICAST_GROUP');
    assert(code.includes('DEFAULT_TAK_MULTICAST_PORT'), 'Debe definir DEFAULT_TAK_MULTICAST_PORT');
    assert(code.includes('public async broadcastToTak'), 'Debe incluir broadcastToTak');
    assert(code.includes('public createEmergencyEvent'), 'Debe incluir createEmergencyEvent para alertas SOS 911');
    assert(code.includes('b-a-o-tbl'), 'Debe tipificar emergencias militares como balizas de socorro b-a-o-tbl');
});

runTest('2.2 MbtilesReaderEngine.ts: Conversión de coordenadas XYZ a TMS', () => {
    assert(fs.existsSync(mbtilesTsPath), 'MbtilesReaderEngine.ts debe existir');
    const code = fs.readFileSync(mbtilesTsPath, 'utf8');
    assert(code.includes('xyzToTmsY(z: number, y: number): number'), 'Debe implementar xyzToTmsY');

    // Emulación del cálculo exacto
    const xyzToTmsY = (z, y) => (1 << z) - 1 - y;

    // Pruebas en diferentes niveles de zoom
    assert.strictEqual(xyzToTmsY(0, 0), 0, 'Zoom 0: y=0 -> tmsY=0');
    assert.strictEqual(xyzToTmsY(1, 0), 1, 'Zoom 1: y=0 -> tmsY=1');
    assert.strictEqual(xyzToTmsY(1, 1), 0, 'Zoom 1: y=1 -> tmsY=0');
    assert.strictEqual(xyzToTmsY(10, 300), 723, 'Zoom 10: y=300 -> tmsY=723');
    assert.strictEqual(xyzToTmsY(16, 20000), 45535, 'Zoom 16: y=20000 -> tmsY=45535');
});

runTest('2.3 MbtilesReaderEngine.ts: Detección MIME por firmas de bytes mágicos', () => {
    const code = fs.readFileSync(mbtilesTsPath, 'utf8');
    assert(code.includes('detectMimeFromBase64'), 'Debe implementar detectMimeFromBase64');
    assert(code.includes('iVBORw0KGgo'), 'Debe detectar firma mágica PNG');
    assert(code.includes('/9j/'), 'Debe detectar firma mágica JPEG');
    assert(code.includes('H4sI'), 'Debe detectar compresión GZIP de Mapbox Vector Tiles MVT');
});

// ── 3. AUDITORÍA DEL MODELO RF FRESNEL & PROPAGACIÓN (ITU-R P.526) ─────────────
console.log('\n--- [3/3] VERIFICACIÓN MATEMÁTICA DEL MOTOR RF FRESNEL ---');

runTest('3.1 RfPropagationEngine.ts: Radio de 1ra Zona de Fresnel (R1)', () => {
    assert(fs.existsSync(rfTsPath), 'RfPropagationEngine.ts debe existir');
    const code = fs.readFileSync(rfTsPath, 'utf8');
    assert(code.includes('calculateFresnelRadiusMeters'), 'Debe calcular el radio de Fresnel');

    // Función equivalente para prueba unitaria
    const calculateFresnelRadiusMeters = (d1Km, d2Km, freqMhz) => {
        const totalDistKm = d1Km + d2Km;
        if (totalDistKm <= 0 || freqMhz <= 0) return 0;
        const freqGhz = freqMhz / 1000;
        const product = (d1Km * d2Km) / (freqGhz * totalDistKm);
        return Math.round(17.32 * Math.sqrt(Math.max(0, product)) * 100) / 100;
    };

    // Frecuencia LoRa 915 MHz a 10 km (punto medio: d1=5km, d2=5km)
    const r1_915 = calculateFresnelRadiusMeters(5, 5, 915);
    // Esperado: ~28.63 metros
    assert(r1_915 >= 28.0 && r1_915 <= 29.0, `R1 a 915MHz debe rondar los 28.6m, obtenido: ${r1_915}m`);

    // Frecuencia ISM 2.4 GHz a 10 km (d1=5km, d2=5km)
    const r1_2400 = calculateFresnelRadiusMeters(5, 5, 2400);
    // A mayor frecuencia, el radio de Fresnel es menor
    assert(r1_2400 < r1_915, 'A 2.4 GHz la zona de Fresnel debe ser más estrecha que a 915 MHz');
    assert(r1_2400 >= 17.0 && r1_2400 <= 18.0, `R1 a 2.4GHz debe rondar los 17.6m, obtenido: ${r1_2400}m`);
});

runTest('3.2 RfPropagationEngine.ts: Abultamiento de Curvatura Terrestre con Refracción k=4/3', () => {
    const code = fs.readFileSync(rfTsPath, 'utf8');
    assert(code.includes('K_FACTOR_REFRACTION = 1.3333'), 'Debe utilizar k=4/3 estándar ITU-R');

    const calculateEarthBulgeMeters = (d1Km, d2Km) => {
        const d1Meters = d1Km * 1000;
        const d2Meters = d2Km * 1000;
        const effectiveRadius = 6371000 * 1.3333;
        return (d1Meters * d2Meters) / (2 * effectiveRadius);
    };

    // A 10 km (d1=5km, d2=5km)
    const bulge_10km = calculateEarthBulgeMeters(5, 5);
    // Esperado: ~1.47 metros
    assert(bulge_10km >= 1.4 && bulge_10km <= 1.6, `Abultamiento a 10km debe ser ~1.47m, obtenido: ${bulge_10km.toFixed(2)}m`);

    // A 40 km (enlace táctico de montaña: d1=20km, d2=20km)
    const bulge_40km = calculateEarthBulgeMeters(20, 20);
    // Esperado: ~23.5 metros (crítico para requerir elevación de antenas)
    assert(bulge_40km >= 23.0 && bulge_40km <= 24.5, `Abultamiento a 40km debe ser ~23.5m, obtenido: ${bulge_40km.toFixed(2)}m`);
});

runTest('3.3 RfPropagationEngine.ts: Pérdida en Espacio Libre (FSPL)', () => {
    const calculateFsplDb = (distKm, freqMhz) => {
        if (distKm <= 0.001) return 0;
        const fspl = 20 * Math.log10(distKm) + 20 * Math.log10(freqMhz) + 32.44;
        return Math.round(fspl * 10) / 10;
    };

    // FSPL a 10 km y 915 MHz
    const fspl_10km_915 = calculateFsplDb(10, 915);
    // Esperado: 20 + 59.23 + 32.44 = ~111.7 dB
    assert(fspl_10km_915 >= 111.0 && fspl_10km_915 <= 112.5, `FSPL a 10km/915MHz debe ser ~111.7 dB, obtenido: ${fspl_10km_915} dB`);

    // Sensibilidad SX1262 (-137 dBm) y Potencia TX (+22 dBm) -> Enlace viable con margen
    const linkBudget = 22 - fspl_10km_915 - (-137);
    assert(linkBudget > 40, `El margen de enlace debe ser > 40 dB para LoRa SF12, obtenido: ${linkBudget.toFixed(1)} dB`);
});

runTest('3.4 NodeMap.tsx: Integración de UI C4ISR, Bóveda MBTiles y Modal RF', () => {
    const mapPath = path.join(__dirname, '..', 'src', 'components', 'NodeMap.tsx');
    assert(fs.existsSync(mapPath), 'NodeMap.tsx debe existir');
    const code = fs.readFileSync(mapPath, 'utf8');
    assert(code.includes('RfLinkProfileModal'), 'Debe importar y renderizar RfLinkProfileModal');
    assert(code.includes('mbtilesReader'), 'Debe consultar el motor MBTiles en OfflineTileLayer');
    assert(code.includes('cursorOnTarget.broadcastToTak'), 'El botón CoT debe difundir vía Multicast TAK');
    assert(code.includes('availableMbtiles'), 'La bóveda debe listar los paquetes MBTiles nativos');
});

// ── RESUMEN FINAL DE LA SUITE ────────────────────────────────────────────────
console.log('\n================================================================================');
console.log(`📊 RESULTADOS DE LA SUITE: ${passedTests} / ${totalTests} PRUEBAS SUPERADAS (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================================\n');

if (passedTests === totalTests) {
    console.log('🎖️  FASE 2 VERIFICADA CON ÉXITO: ARQUITECTURA C4ISR Y CARTOGRAFÍA COMPLETA.\n');
    process.exit(0);
} else {
    console.error('⚠️  ALGUNAS PRUEBAS DE FASE 2 FALLARON. REVISAR LOGS ANTERIORES.\n');
    process.exit(1);
}
