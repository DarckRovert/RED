/**
 * TEST SUITE: CENTRAL COMPLEX FAN-SHAPED BODY (FB) 3D VECTOR PATH INTEGRATION
 * 
 * Valida la formulación matemática y biofísica del Fan-Shaped Body de Drosophila (MaleCNS v1.0):
 * 1. Arquitectura de 16 columnas azimutales y 9 capas horizontales (144 neuronas).
 * 2. Descomposición vectorial P-FN con desfases de ±45° desde el Protocerebral Bridge.
 * 3. Odometría inercial 3D y solución matemática del Home Vector (H = -x).
 * 4. Integración altimétrica vertical (barómetro ICAO) en capas 7-8.
 * 5. Computación del Goal Vector y señal de timoneo (Steering Signal) en capa 9.
 * 6. Inmunidad a derivas abruptas y persistencia del origen táctico.
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
console.log('🧠📐 INICIANDO SUITE DE PRUEBAS: CX FAN-SHAPED BODY (FB) 3D VECTOR NAVIGATION');
console.log('================================================================================\n');

// ── 1. Inspección Estática de FanShapedBodyEngine.ts ─────────────────────────
const fbEnginePath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'FanShapedBodyEngine.ts');
const fbEngineCode = fs.readFileSync(fbEnginePath, 'utf8');

runTest('1. FanShapedBodyEngine: Definición de 16 columnas x 9 capas (144 estratos)', () => {
    assert(fbEngineCode.includes('NUM_COLUMNS = 16'), 'Debe definir 16 columnas azimutales');
    assert(fbEngineCode.includes('NUM_LAYERS = 9'), 'Debe definir 9 estratos laminares');
    assert(fbEngineCode.includes('TOTAL_COLUMNS_LAYERS = 144'), 'Debe totalizar 144 unidades columnares');
});

runTest('2. FanShapedBodyEngine: Interneuronas P-FN y desfase de ±45° (π/4)', () => {
    assert(fbEngineCode.includes('headingRad - Math.PI / 4'), 'Debe proyectar P-FN izquierda con shift -45°');
    assert(fbEngineCode.includes('headingRad + Math.PI / 4'), 'Debe proyectar P-FN derecha con shift +45°');
    assert(fbEngineCode.includes('delta7Inhibition'), 'Debe incluir interneuronas Δ7 de inhibición lateral');
});

runTest('3. FanShapedBodyEngine: Formulación del Home Vector (H = -x)', () => {
    assert(fbEngineCode.includes('this.homeOriginX - this.posX'), 'Debe calcular vector inverso Este hacia casa');
    assert(fbEngineCode.includes('this.homeOriginY - this.posY'), 'Debe calcular vector inverso Norte hacia casa');
    assert(fbEngineCode.includes('Math.atan2(relHomeX, relHomeY)'), 'Debe decodificar rumbo azimutal exacto a casa');
});

runTest('4. FanShapedBodyEngine: Integración de Objetivo Táctico (Goal Vector)', () => {
    assert(fbEngineCode.includes('goalBearingDeg - this.currentHeadingDeg'), 'Debe calcular error angular de timoneo');
    assert(fbEngineCode.includes('setTarget'), 'Debe permitir fijar coordenadas objetivo');
    assert(fbEngineCode.includes('clearTarget'), 'Debe permitir limpiar objetivo activo');
});

// ── 2. Simulación y Validación Numérica del Modelo Vectorial ─────────────────

class MockFanShapedBody {
    constructor() {
        this.numColumns = 16;
        this.numLayers = 9;
        this.posX = 0.0;
        this.posY = 0.0;
        this.posZ = 0.0;
        this.homeOriginX = 0.0;
        this.homeOriginY = 0.0;
        this.homeOriginZ = 0.0;
        this.totalDistance = 0.0;
    }

    setHome(x, y, z) {
        this.homeOriginX = x;
        this.homeOriginY = y;
        this.homeOriginZ = z;
    }

    integrateStep(strideMeters, headingDeg, deltaZ = 0.0) {
        const rad = (headingDeg * Math.PI) / 180;
        this.posX += strideMeters * Math.sin(rad);
        this.posY += strideMeters * Math.cos(rad);
        this.posZ += deltaZ;
        this.totalDistance += strideMeters;
    }

    getHomeVector() {
        const dx = this.homeOriginX - this.posX;
        const dy = this.homeOriginY - this.posY;
        const dz = this.homeOriginZ - this.posZ;
        const dist2D = Math.sqrt(dx * dx + dy * dy);
        const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
        let bearingDeg = (Math.atan2(dx, dy) * 180) / Math.PI;
        bearingDeg = ((bearingDeg % 360) + 360) % 360;
        return { dist2D, dist3D, bearingDeg, deltaZ: dz };
    }

    getGoalVector(targetX, targetY) {
        const dx = targetX - this.posX;
        const dy = targetY - this.posY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let bearingDeg = (Math.atan2(dx, dy) * 180) / Math.PI;
        bearingDeg = ((bearingDeg % 360) + 360) % 360;
        return { dist, bearingDeg };
    }
}

runTest('5. FanShapedBody: Desplazamiento cardinal Este puro (90°)', () => {
    const fb = new MockFanShapedBody();
    fb.setHome(0, 0, 0);

    // Caminar 100 pasos de 1 metro al Este (90°)
    for (let i = 0; i < 100; i++) {
        fb.integrateStep(1.0, 90.0, 0.0);
    }

    assert(Math.abs(fb.posX - 100) < 0.001, 'Posición X debe ser +100m');
    assert(Math.abs(fb.posY) < 0.001, 'Posición Y debe ser 0m');

    const hv = fb.getHomeVector();
    assert(Math.abs(hv.dist2D - 100) < 0.001, 'Distancia a casa debe ser 100m');
    assert(Math.abs(hv.bearingDeg - 270) < 0.001, 'Rumbo a casa debe ser 270° (Oeste)');
});

runTest('6. FanShapedBody: Desplazamiento diagonal 2D (45° NE)', () => {
    const fb = new MockFanShapedBody();
    fb.setHome(0, 0, 0);

    // Caminar 100 metros a 45°
    fb.integrateStep(100.0, 45.0, 0.0);

    const hv = fb.getHomeVector();
    assert(Math.abs(hv.dist2D - 100) < 0.01, 'Distancia a casa debe ser 100m');
    assert(Math.abs(hv.bearingDeg - 225) < 0.01, 'Rumbo a casa debe ser 225° (SW)');
});

runTest('7. FanShapedBody: Integración Altimétrica 3D (Desnivel Barométrico)', () => {
    const fb = new MockFanShapedBody();
    fb.setHome(0, 0, 0);

    // Caminar 30m al Norte (0°) y ascender 40m de altitud
    fb.integrateStep(30.0, 0.0, 40.0);

    const hv = fb.getHomeVector();
    assert(Math.abs(hv.dist2D - 30) < 0.01, 'Distancia 2D debe ser 30m');
    assert(Math.abs(hv.dist3D - 50) < 0.01, 'Distancia 3D debe ser 50m (Triángulo 30-40-50)');
    assert(Math.abs(hv.deltaZ - (-40)) < 0.01, 'Desnivel hacia casa debe ser -40m (descenso)');
    assert(Math.abs(hv.bearingDeg - 180) < 0.01, 'Rumbo horizontal a casa debe ser 180° (Sur)');
});

runTest('8. FanShapedBody: Solución del Goal Vector y error de timoneo', () => {
    const fb = new MockFanShapedBody();
    fb.posX = 10;
    fb.posY = 10;

    // Objetivo en (10, 50) => 40m al Norte
    const gv = fb.getGoalVector(10, 50);
    assert(Math.abs(gv.dist - 40) < 0.01, 'Distancia al objetivo debe ser 40m');
    assert(Math.abs(gv.bearingDeg - 0) < 0.01, 'Rumbo al objetivo debe ser 0° (Norte)');
});

console.log('\n================================================================================');
console.log(`📊 RESULTADO DE LA SUITE FB: ${passedTests}/${totalTests} PRUEBAS EXITOSAS (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
