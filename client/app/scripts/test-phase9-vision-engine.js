const assert = require('assert');

console.log('================================================================================');
console.log('👁️  INICIANDO SUITE DE PRUEBAS — FASE 9: VISIÓN TÁCTICA & ANTI-FALSOS POSITIVOS');
console.log('================================================================================\n');

// Mock frame simulation helper
function createMockFrame(width, height, backgroundRgb, drawEntities) {
    const data = new Uint8ClampedArray(width * height * 4);
    
    // Fill background
    for (let i = 0; i < width * height; i++) {
        data[i * 4] = backgroundRgb.r;
        data[i * 4 + 1] = backgroundRgb.g;
        data[i * 4 + 2] = backgroundRgb.b;
        data[i * 4 + 3] = 255;
    }

    // Draw entities
    for (const ent of drawEntities) {
        for (let y = ent.y; y < ent.y + ent.h && y < height; y++) {
            for (let x = ent.x; x < ent.x + ent.w && x < width; x++) {
                const idx = (y * width + x) * 4;
                data[idx] = ent.color.r;
                data[idx + 1] = ent.color.g;
                data[idx + 2] = ent.color.b;
            }
        }
    }

    return data;
}

// Logic mirror of TacticalEdgeVisionEngine analysis loop for node environment
function analyzeFrameData(data, width = 320, height = 240) {
    const detections = [];

    // 1. Sky luma
    let skyLumaSum = 0;
    let skyPixelCount = 0;
    for (let y = 4; y < 70; y += 4) {
        for (let x = 4; x < 316; x += 4) {
            const idx = (y * 320 + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            skyLumaSum += lum;
            skyPixelCount++;
        }
    }
    const meanSkyLuma = skyPixelCount > 0 ? skyLumaSum / skyPixelCount : 128;

    let firePixels = 0;
    let minFireX = 320, maxFireX = 0, minFireY = 240, maxFireY = 0;
    const darkAerialCoords = [];

    for (let y = 0; y < 240; y += 4) {
        for (let x = 0; x < 320; x += 4) {
            const idx = (y * 320 + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Fire
            if (r > 190 && g > 85 && b < 80 && (r - g) > 35) {
                firePixels++;
                if (x < minFireX) minFireX = x;
                if (x > maxFireX) maxFireX = x;
                if (y < minFireY) minFireY = y;
                if (y > maxFireY) maxFireY = y;
            }

            // Dark Aerial Candidate
            if (y >= 12 && y <= 130 && x >= 16 && x <= 304 && meanSkyLuma > 105) {
                if (lum < 55 && (meanSkyLuma - lum) > 55) {
                    darkAerialCoords.push({ x, y });
                }
            }
        }
    }

    // Morphological evaluation for Drone / UAV
    if (darkAerialCoords.length >= 6 && darkAerialCoords.length <= 180) {
        let minDX = 320, maxDX = 0, minDY = 240, maxDY = 0;
        for (const pt of darkAerialCoords) {
            if (pt.x < minDX) minDX = pt.x;
            if (pt.x > maxDX) maxDX = pt.x;
            if (pt.y < minDY) minDY = pt.y;
            if (pt.y > maxDY) maxDY = pt.y;
        }

        const count = darkAerialCoords.length;
        const spanW = maxDX - minDX;
        const spanH = maxDY - minDY;
        const relW = spanW / 320;
        const relH = spanH / 240;

        const isTouchingFrameBorder = (minDX <= 8 || maxDX >= 312 || minDY <= 8 || maxDY >= 232);
        const isTallVerticalDoor = (spanH > spanW * 1.8) || (relH > 0.38);
        const isWideCeilingBeam = (spanW > spanH * 4.2) || (relW > 0.70);
        const isTooMassive = (relW * relH > 0.25);
        const isTooSparse = (count / ((spanW / 4) * (spanH / 4) + 1)) < 0.12;

        if (!isTouchingFrameBorder && !isTallVerticalDoor && !isWideCeilingBeam && !isTooMassive && !isTooSparse) {
            let haloDarkPixels = 0;
            let haloTotalSamples = 0;
            const haloMargin = 12;

            const checkHaloPixel = (hx, hy) => {
                if (hx >= 0 && hx < 320 && hy >= 0 && hy < 240) {
                    const hIdx = (hy * 320 + hx) * 4;
                    const hLum = 0.299 * data[hIdx] + 0.587 * data[hIdx + 1] + 0.114 * data[hIdx + 2];
                    if (hLum < 65) haloDarkPixels++;
                    haloTotalSamples++;
                }
            };

            for (let hx = Math.max(0, minDX - haloMargin); hx <= Math.min(316, maxDX + haloMargin); hx += 8) {
                checkHaloPixel(hx, Math.max(0, minDY - haloMargin));
                checkHaloPixel(hx, Math.min(236, maxDY + haloMargin));
            }

            const haloOcclusionRatio = haloTotalSamples > 0 ? haloDarkPixels / haloTotalSamples : 0;
            if (haloOcclusionRatio < 0.35) {
                detections.push({
                    type: 'AERIAL_DRONE',
                    label: 'DRON UAV / AMENAZA AÉREA',
                    bbox: { x: minDX / 320, y: minDY / 240, width: relW, height: relH }
                });
            }
        }
    }

    // Fire evaluation
    if (firePixels >= 18) {
        const spanW = maxFireX - minFireX;
        const spanH = maxFireY - minFireY;
        detections.push({
            type: 'FIRE_HAZARD',
            label: 'AMENAZA TÉRMICA / FUEGO',
            bbox: { x: minFireX / 320, y: minFireY / 240, width: spanW / 320, height: spanH / 240 }
        });
    }

    return detections;
}

// 1. TEST DE RECHAZO DE PUERTA / MARCO DE PUERTA (DOOR REJECTION TEST)
console.log('1️⃣ Probando Rechazo de Puertas, Marcos y Muros Interiores...');
const doorFrame = createMockFrame(320, 240, { r: 160, g: 155, b: 150 }, [
    // Tall vertical dark wooden door: x: 100, y: 20, w: 70, h: 190 (RelH = 0.79)
    { x: 100, y: 20, w: 70, h: 190, color: { r: 25, g: 20, b: 18 } }
]);
const doorDetections = analyzeFrameData(doorFrame);
const falseDroneDetections = doorDetections.filter(d => d.type === 'AERIAL_DRONE');
assert.strictEqual(falseDroneDetections.length, 0, 'Una puerta vertical no debe ser clasificada como dron');
console.log('  ✅ [PASS] Puerta interior alta (190px) rechazada con éxito (0 falsos positivos de Dron)');

// 2. TEST DE RECHAZO DE VIGA / MARCO SUPERIOR DE TECHO
console.log('\n2️⃣ Probando Rechazo de Vigas y Molduras de Techo...');
const ceilingBeamFrame = createMockFrame(320, 240, { r: 180, g: 180, b: 180 }, [
    // Wide horizontal beam touching the top border: x: 0, y: 0, w: 320, h: 40
    { x: 0, y: 0, w: 320, h: 40, color: { r: 30, g: 30, b: 30 } }
]);
const beamDetections = analyzeFrameData(ceilingBeamFrame);
assert.strictEqual(beamDetections.filter(d => d.type === 'AERIAL_DRONE').length, 0, 'Viga pegada al borde no es un dron');
console.log('  ✅ [PASS] Viga horizontal y bordes de marco rechazados con éxito');

// 3. TEST DE DETECCIÓN REAL DE DRON UAV FLOTANDO EN EL CIELO
console.log('\n3️⃣ Probando Detección Real de Dron Quadcopter en Cielo Abierto...');
const realDroneFrame = createMockFrame(320, 240, { r: 190, g: 215, b: 245 }, [
    // Compact quadcopter drone in sky: x: 130, y: 45, w: 48, h: 32 (symmetrical, aspect ratio 1.5, floating)
    { x: 130, y: 45, w: 48, h: 32, color: { r: 15, g: 18, b: 22 } }
]);
const droneDetections = analyzeFrameData(realDroneFrame);
assert.strictEqual(droneDetections.length, 1, 'Debe detectar 1 dron UAV en cielo despejado');
assert.strictEqual(droneDetections[0].type, 'AERIAL_DRONE', 'Tipo de amenaza debe ser AERIAL_DRONE');
console.log('  ✅ [PASS] Dron UAV genuino en cielo abierto detectado con alta precisión (AERIAL_DRONE)');

// 4. TEST DE DETECCIÓN DE AMENAZA TÉRMICA / FUEGO
console.log('\n4️⃣ Probando Detección de Amenaza Térmica y Fuego...');
const fireFrame = createMockFrame(320, 240, { r: 60, g: 60, b: 60 }, [
    // Flame cluster: x: 140, y: 110, w: 40, h: 35, color: intense red-orange
    { x: 140, y: 110, w: 40, h: 35, color: { r: 245, g: 115, b: 25 } }
]);
const fireDetections = analyzeFrameData(fireFrame);
assert.strictEqual(fireDetections.length, 1, 'Debe detectar 1 amenaza de fuego');
assert.strictEqual(fireDetections[0].type, 'FIRE_HAZARD', 'Tipo de amenaza debe ser FIRE_HAZARD');
console.log('  ✅ [PASS] Amenaza térmica / fuego detectada con éxito (FIRE_HAZARD)');

console.log('\n================================================================================');
console.log('📊 RESUMEN FASE 9: 4/4 PRUEBAS DE VISIÓN SUPERADAS EXITOSAMENTE (100% PASS)');
console.log('================================================================================\n');
