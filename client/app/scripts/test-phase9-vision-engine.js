const assert = require('assert');

console.log('================================================================================');
console.log('👁️  INICIANDO SUITE DE PRUEBAS — FASE 9: VISIÓN TÁCTICA & ANTI-FALSOS POSITIVOS');
console.log('================================================================================\n');

// Mock frame simulation helper
function createMockFrame(width, height, backgroundRgb, drawEntities = []) {
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
function analyzeFrameData(data, width = 320, height = 240, envMode = 'AUTO') {
    const detections = [];

    // 1. Sky / Upper hemisphere sampling
    let skyLumaSum = 0;
    let skyPixelCount = 0;
    let skyBlueExcess = 0;
    let skyRedSum = 0;
    let skyBlueSum = 0;
    for (let y = 4; y < 65; y += 4) {
        for (let x = 4; x < 316; x += 4) {
            const idx = (y * 320 + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            skyLumaSum += lum;
            skyRedSum += r;
            skyBlueSum += b;
            skyPixelCount++;
            if (b > r + 15) skyBlueExcess++;
        }
    }
    const meanSkyLuma = skyPixelCount > 0 ? skyLumaSum / skyPixelCount : 128;
    const meanSkyRed = skyPixelCount > 0 ? skyRedSum / skyPixelCount : 128;
    const meanSkyBlue = skyPixelCount > 0 ? skyBlueSum / skyPixelCount : 128;
    const skyBlueRatio = skyPixelCount > 0 ? skyBlueExcess / skyPixelCount : 0;

    let skyLumaVarianceSum = 0;
    for (let y = 8; y < 65; y += 8) {
        for (let x = 8; x < 316; x += 8) {
            const idx = (y * 320 + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            skyLumaVarianceSum += Math.abs(lum - meanSkyLuma);
        }
    }
    const skyVariance = skyPixelCount > 0 ? skyLumaVarianceSum / (skyPixelCount / 4) : 999;

    // Un cielo abierto real es azul diurno (meanSkyBlue > meanSkyRed) o blanco nublado muy brillante (meanSkyLuma > 185)
    // Paredes y techos interiores típicos son cálidos (meanSkyRed > meanSkyBlue + 8) con luminancia moderada
    const isWarmIndoorWall = (meanSkyRed > meanSkyBlue + 8) && (meanSkyLuma < 185);

    let isOutdoorSkyEnvironment = false;
    if (envMode === 'OUTDOOR_SKY') {
        isOutdoorSkyEnvironment = true;
    } else if (envMode === 'INDOOR_CQB') {
        isOutdoorSkyEnvironment = false;
    } else {
        isOutdoorSkyEnvironment = !isWarmIndoorWall && ((meanSkyLuma > 120 && skyVariance < 38) || (skyBlueRatio > 0.25));
    }

    let firePixels = 0;
    let fireIncandescentCorePixels = 0;
    let minFireX = 320, maxFireX = 0, minFireY = 240, maxFireY = 0;
    const darkAerialCoords = [];

    for (let y = 0; y < 240; y += 4) {
        for (let x = 0; x < 320; x += 4) {
            const idx = (y * 320 + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Strict flame color + Incandescent core check
            const isFlameColor = (r > 205 && g > 95 && b < 85 && (r - g) > 40 && lum > 130);
            const isIncandescentCore = (r > 235 && g > 190 && b > 90 && lum > 185);

            if (isFlameColor || isIncandescentCore) {
                firePixels++;
                if (isIncandescentCore) fireIncandescentCorePixels++;
                if (x < minFireX) minFireX = x;
                if (x > maxFireX) maxFireX = x;
                if (y < minFireY) minFireY = y;
                if (y > maxFireY) maxFireY = y;
            }

            // Aerial Dark Candidate (Only in verified open sky)
            if (isOutdoorSkyEnvironment && y >= 14 && y <= 135 && x >= 16 && x <= 304) {
                if (lum < 60 && (meanSkyLuma - lum) > 55) {
                    darkAerialCoords.push({ x, y });
                }
            }
        }
    }

    // Morphological evaluation for Drone / UAV
    if (isOutdoorSkyEnvironment && darkAerialCoords.length >= 8 && darkAerialCoords.length <= 160) {
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
        const aspectRatio = spanW / Math.max(1, spanH);

        const isTouchingFrameBorder = (minDX <= 10 || maxDX >= 310 || minDY <= 10 || maxDY >= 230);
        const isTallVerticalDoor = (aspectRatio < 0.65) || (relH > 0.35);
        const isWideCeilingBeam = (aspectRatio > 4.5) || (relW > 0.65);
        const isTooMassive = (relW * relH > 0.22);
        const isTooSparse = (count / ((spanW / 4) * (spanH / 4) + 1)) < 0.15;

        if (!isTouchingFrameBorder && !isTallVerticalDoor && !isWideCeilingBeam && !isTooMassive && !isTooSparse) {
            let haloDarkPixels = 0;
            let haloTotalSamples = 0;
            const haloMargin = 12;

            const checkHaloPixel = (hx, hy) => {
                if (hx >= 0 && hx < 320 && hy >= 0 && hy < 240) {
                    const hIdx = (hy * 320 + hx) * 4;
                    const hLum = 0.299 * data[hIdx] + 0.587 * data[hIdx + 1] + 0.114 * data[hIdx + 2];
                    if (hLum < 70) haloDarkPixels++;
                    haloTotalSamples++;
                }
            };

            for (let hx = Math.max(0, minDX - haloMargin); hx <= Math.min(316, maxDX + haloMargin); hx += 8) {
                checkHaloPixel(hx, Math.max(0, minDY - haloMargin));
                checkHaloPixel(hx, Math.min(236, maxDY + haloMargin));
            }
            for (let hy = Math.max(0, minDY - haloMargin); hy <= Math.min(236, maxDY + haloMargin); hy += 8) {
                checkHaloPixel(Math.max(0, minDX - haloMargin), hy);
                checkHaloPixel(Math.min(316, maxDX + haloMargin), hy);
            }

            const haloOcclusionRatio = haloTotalSamples > 0 ? haloDarkPixels / haloTotalSamples : 0;
            if (haloOcclusionRatio < 0.25) {
                detections.push({
                    type: 'AERIAL_DRONE',
                    label: 'DRON UAV / AMENAZA AÉREA',
                    bbox: { x: minDX / 320, y: minDY / 240, width: relW, height: relH }
                });
            }
        }
    }

    // Fire evaluation (Requires core incandescence or thermal dynamic variance)
    if (firePixels >= 28 && fireIncandescentCorePixels >= 2) {
        const spanW = maxFireX - minFireX;
        const spanH = maxFireY - minFireY;
        const relW = spanW / 320;
        const relH = spanH / 240;

        if (relW <= 0.65 && relH <= 0.65 && relW >= 0.05 && relH >= 0.05) {
            detections.push({
                type: 'FIRE_HAZARD',
                label: 'AMENAZA TÉRMICA / FUEGO',
                bbox: { x: minFireX / 320, y: minFireY / 240, width: relW, height: relH }
            });
        }
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

// 3. TEST DE RECHAZO DE LÁMPARA DE TECHO / CUADRO EN HABITACIÓN INTERIOR (INDOOR FALSE POSITIVE REJECTION)
console.log('\n3️⃣ Probando Rechazo de Objetos en Habitación Interior (Lámpara/Cuadro)...');
const indoorLampFrame = createMockFrame(320, 240, { r: 140, g: 130, b: 110 }, [
    // Compact black ceiling lamp or picture frame in an indoor room (wall is beige/warm, not sky)
    { x: 130, y: 40, w: 45, h: 30, color: { r: 20, g: 20, b: 20 } }
]);
const indoorDetections = analyzeFrameData(indoorLampFrame, 320, 240, 'AUTO');
assert.strictEqual(indoorDetections.filter(d => d.type === 'AERIAL_DRONE').length, 0, 'Objetos en habitación interior no deben ser clasificados como drones');
console.log('  ✅ [PASS] Lámpara/cuadro en habitación interior rechazado con éxito (Inhibición CQB)');

// 4. TEST DE DETECCIÓN REAL DE DRON UAV EN CIELO ABIERTO
console.log('\n4️⃣ Probando Detección Real de Dron Quadcopter en Cielo Abierto...');
const realDroneFrame = createMockFrame(320, 240, { r: 190, g: 215, b: 245 }, [
    // Compact quadcopter drone in sky: x: 130, y: 45, w: 48, h: 32 (symmetrical, aspect ratio 1.5, floating)
    { x: 130, y: 45, w: 48, h: 32, color: { r: 15, g: 18, b: 22 } }
]);
const droneDetections = analyzeFrameData(realDroneFrame, 320, 240, 'OUTDOOR_SKY');
assert.strictEqual(droneDetections.length, 1, 'Debe detectar 1 dron UAV en cielo despejado');
assert.strictEqual(droneDetections[0].type, 'AERIAL_DRONE', 'Tipo de amenaza debe ser AERIAL_DRONE');
console.log('  ✅ [PASS] Dron UAV genuino en cielo abierto detectado con alta precisión (AERIAL_DRONE)');

// 5. TEST DE RECHAZO DE OBJETO NARANJA INERTE (COJÍN / CARTÓN / ROPA NARANJA)
console.log('\n5️⃣ Probando Rechazo de Objetos Naranjas Inertes (Cojines, Cartón, Ropa)...');
const inertOrangeFrame = createMockFrame(320, 240, { r: 50, g: 50, b: 50 }, [
    // Static orange cushion: uniform orange without incandescent core (r: 210, g: 100, b: 20)
    { x: 120, y: 90, w: 50, h: 45, color: { r: 210, g: 100, b: 20 } }
]);
const inertOrangeDetections = analyzeFrameData(inertOrangeFrame);
assert.strictEqual(inertOrangeDetections.filter(d => d.type === 'FIRE_HAZARD').length, 0, 'Un cojín naranja sin núcleo incandescente no debe ser fuego');
console.log('  ✅ [PASS] Objeto naranja inerte rechazado exitosamente (0 falsos positivos de Fuego)');

// 6. TEST DE DETECCIÓN REAL DE AMENAZA TÉRMICA / FUEGO CON NÚCLEO INCANDESCENTE
console.log('\n6️⃣ Probando Detección de Fuego Real con Núcleo Incandescente...');
const realFireFrame = createMockFrame(320, 240, { r: 40, g: 40, b: 40 }, [
    // Outer flame envelope
    { x: 135, y: 105, w: 45, h: 40, color: { r: 230, g: 110, b: 25 } },
    // Inner incandescent core (yellow-white combustion center)
    { x: 150, y: 118, w: 16, h: 14, color: { r: 255, g: 220, b: 120 } }
]);
const realFireDetections = analyzeFrameData(realFireFrame);
assert.strictEqual(realFireDetections.length, 1, 'Debe detectar 1 amenaza de fuego real');
assert.strictEqual(realFireDetections[0].type, 'FIRE_HAZARD', 'Tipo de amenaza debe ser FIRE_HAZARD');
console.log('  ✅ [PASS] Fuego real con núcleo incandescente detectado con éxito (FIRE_HAZARD)');

console.log('\n================================================================================');
console.log('📊 RESUMEN FASE 9: 6/6 PRUEBAS DE VISIÓN SUPERADAS EXITOSAMENTE (100% PASS)');
console.log('================================================================================\n');
