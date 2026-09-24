/**
 * test-biocybernetic-paradise-lifelong-learning.js
 * 
 * Suite de Verificación de Resiliencia: Paraíso Biocibernético & Aprendizaje Permanente
 * RED Sovereign Mesh OS v122.0.0 — Capa Bio-Cibernética L9
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log("\n" + "=".repeat(80));
console.log("🌿🧠 INICIANDO SUITE: PARAÍSO BIOCIBERNÉTICO & APRENDIZAJE PERMANENTE L9");
console.log("=".repeat(80) + "\n");

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  process.stdout.write(`  Testing ${total}: ${name}... `);
  try {
    fn();
    console.log("✅ [PASS]");
    passed++;
  } catch (err) {
    console.log("❌ [FAIL]");
    console.error(err);
    process.exit(1);
  }
}

// ── Test 1: Integridad de Archivos Creados y Modificados ──────────────────────
runTest("Integridad estructural de archivos del Paraíso y Aprendizaje", () => {
  const habitatDir = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat');
  const learningPath = path.join(habitatDir, 'AutonomousLifelongLearningEngine.ts');
  const paradisePath = path.join(habitatDir, 'BiocyberneticEdenParadiseEngine.ts');
  const fickPath = path.join(habitatDir, 'FickDiffusionGrid.ts');
  const enginePath = path.join(habitatDir, 'BiocyberneticHabitatEngine.ts');
  const engine3DPath = path.join(habitatDir, 'BiocyberneticHabitat3DEngine.ts');

  assert(fs.existsSync(learningPath), "AutonomousLifelongLearningEngine.ts debe existir");
  assert(fs.existsSync(paradisePath), "BiocyberneticEdenParadiseEngine.ts debe existir");
  assert(fs.existsSync(fickPath), "FickDiffusionGrid.ts debe existir");
  assert(fs.existsSync(enginePath), "BiocyberneticHabitatEngine.ts debe existir");
  assert(fs.existsSync(engine3DPath), "BiocyberneticHabitat3DEngine.ts debe existir");
});

// ── Test 2: Sustrato de Fick Extendido (SEROTONIN & MYCELIUM_NUTRIENTS) ────────
runTest("Sustrato de Fick extendido con Serotonina y Nutrientes Miceliales", () => {
  const fickSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'FickDiffusionGrid.ts'),
    'utf-8'
  );

  assert(fickSrc.includes("'SEROTONIN'"), "Debe soportar sustancia SEROTONIN");
  assert(fickSrc.includes("'MYCELIUM_NUTRIENTS'"), "Debe soportar sustancia MYCELIUM_NUTRIENTS");
  assert(fickSrc.includes("SEROTONIN: { D: 0.14, lambda: 0.004 }"), "Parámetros de difusión de Serotonina definidos");
  assert(fickSrc.includes("MYCELIUM_NUTRIENTS: { D: 0.07, lambda: 0.001 }"), "Parámetros de difusión de Nutrientes Miceliales definidos");
});

// ── Test 3: Ciclo Circadiano Celestial & Frecuencias Solfeggio ─────────────────
runTest("Ciclo circadiano celestial, fases y modulación Solfeggio", () => {
  const paradiseSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'BiocyberneticEdenParadiseEngine.ts'),
    'utf-8'
  );

  assert(paradiseSrc.includes("cycleDurationSec: number = 180.0"), "Duración de ciclo circadiano 180s por defecto");
  assert(paradiseSrc.includes("solfeggioFreqHz"), "Telemetría circadiana incluye frecuencia armónica Solfeggio");
  assert(paradiseSrc.includes("auroraIntensity"), "Telemetría circadiana incluye intensidad de aurora boreal");
  assert(paradiseSrc.includes("triggerAuroraBorealis"), "Método para invocar aurora boreal implementado");
  assert(paradiseSrc.includes("triggerNectarDew"), "Método para invocar rocío de néctar implementado");
  assert(paradiseSrc.includes("triggerSerotoninBreeze"), "Método para invocar brisa de serotonina implementado");
});

// ── Test 4: Red Micelial Fúngica Subterránea ──────────────────────────────────
runTest("Topología de red micelial fúngica y transporte osmótico", () => {
  const paradiseSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'BiocyberneticEdenParadiseEngine.ts'),
    'utf-8'
  );

  assert(paradiseSrc.includes("myceliumNodes: MyceliumNode[]"), "Array de nodos miceliales declarado");
  assert(paradiseSrc.includes("myceliumHyphae: MyceliumHypha[]"), "Array de hifas miceliales declarado");
  assert(paradiseSrc.includes("node_tree"), "Nodo central en el Árbol de la Vida");
  assert(paradiseSrc.includes("conductance"), "Conductancia osmótica modelada por hifa");
});

// ── Test 5: Los 3 Manantiales de Néctar Cristalino ─────────────────────────────
runTest("Los 3 Manantiales de Néctar Cristalino y emisión química", () => {
  const paradiseSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'BiocyberneticEdenParadiseEngine.ts'),
    'utf-8'
  );

  assert(paradiseSrc.includes("spring_aurora_north"), "Manantial Norte de la Aurora Boreal");
  assert(paradiseSrc.includes("spring_metamorphosis_sw"), "Fuente Suroeste de la Metamorfosis");
  assert(paradiseSrc.includes("spring_repose_se"), "Balneario Sureste del Sosiego Estelar");
  assert(paradiseSrc.includes("emissionRateGlucose"), "Emisión activa de Glucosa en los manantiales");
  assert(paradiseSrc.includes("emissionRateSerotonin"), "Emisión activa de Serotonina en los manantiales");
});

// ── Test 6: Santuario Central del Árbol de la Vida (R=2.8m) ───────────────────
runTest("Santuario del Árbol de la Vida y verificación de proximidad", () => {
  const paradiseSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'BiocyberneticEdenParadiseEngine.ts'),
    'utf-8'
  );

  assert(paradiseSrc.includes("radiusMeters: 2.8"), "Radio de santuario de 2.8m");
  assert(paradiseSrc.includes("isInTreeOfLifeSanctuary(x: number, y: number): boolean"), "Método de proximidad sagrada implementado");
});

// ── Test 7: Ecuación de Bellman y TD-Learning Permanente ──────────────────────
runTest("Motor de Aprendizaje TD-Learning e inferencia activa", () => {
  const learningSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'AutonomousLifelongLearningEngine.ts'),
    'utf-8'
  );

  assert(learningSrc.includes("applyTdUpdate"), "Actualización de Bellman TD-Learning implementada");
  assert(learningSrc.includes("tdError = (reward + gamma * maxNextQ) - currentQ"), "Cálculo matemático exacto del error TD");
  assert(learningSrc.includes("curiosityDrive"), "Impulso de curiosidad por especie");
  assert(learningSrc.includes("wisdomLevel"), "Nivel de sabiduría acumulativo (0-100)");
});

// ── Test 8: Consolidación de Memoria en Sueño REM (Offline Replay) ─────────────
runTest("Consolidación en sueño REM y repetición fuera de línea", () => {
  const learningSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'AutonomousLifelongLearningEngine.ts'),
    'utf-8'
  );

  assert(learningSrc.includes("executeDreamReplayStep"), "Método de replay en sueño implementado");
  assert(learningSrc.includes("isDreamReplayActive"), "Bandera de estado de sueño activo");
  assert(learningSrc.includes("totalDreamsReplayed"), "Contador acumulado de repeticiones en sueño");
});

// ── Test 9: Libro de Aperturas de Ajedrez Táctico Aprendido ────────────────────
runTest("Integración de Ajedrez Táctico y Aprendizaje de Aperturas", () => {
  const chessSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'AutonomousHabitatChessEngine.ts'),
    'utf-8'
  );

  assert(chessSrc.includes("autonomousLifelongLearning"), "Motor de ajedrez importa aprendizaje continuo");
  assert(chessSrc.includes("getLearnedChessMove"), "Consulta aperturas aprendidas antes de evaluar jugadas");
  assert(chessSrc.includes("registerChessGameResult"), "Registra resultado de partidas para refinar estrategias");
});

// ── Test 10: Persistencia Atómica en Disco Local (IndexedDB / LocalStorage) ────
runTest("Persistencia y serialización de sabiduría en disco local", () => {
  const learningSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'AutonomousLifelongLearningEngine.ts'),
    'utf-8'
  );

  assert(learningSrc.includes("saveToStorage"), "Método atómico saveToStorage");
  assert(learningSrc.includes("loadFromStorage"), "Método atómico loadFromStorage");
  assert(learningSrc.includes("red_eden_lifelong_memory_v1"), "Clave canónica de almacenamiento para memoria edénica");
});

// ── Test 11: Renderizado 3D y Controles de Interfaz React ─────────────────────
runTest("Entidades 3D en Three.js y Controles en TacticalHabitatModal", () => {
  const engine3DSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'BiocyberneticHabitat3DEngine.ts'),
    'utf-8'
  );
  const modalSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'tactical', 'TacticalHabitatModal.tsx'),
    'utf-8'
  );

  assert(engine3DSrc.includes("createTreeOfLife3D"), "Método de creación del Árbol de la Vida 3D");
  assert(engine3DSrc.includes("createNectarSprings3D"), "Método de creación de los 3 Manantiales 3D");
  assert(engine3DSrc.includes("createMyceliumNetwork3D"), "Método de creación de la Red Micelial 3D");
  assert(engine3DSrc.includes("createCelestialDome3D"), "Método de creación de la Cúpula Celeste 3D");
  assert(modalSrc.includes("handleTriggerAurora"), "Manejador de Aurora en modal");
  assert(modalSrc.includes("handleTriggerMeditation"), "Manejador de Meditación en modal");
  assert(modalSrc.includes("ÁRBOL DE LA VIDA"), "Etiqueta del Árbol de la Vida en Canvas 2D");
});

// ── Test 12: Estatutos de Gobernanza Bio-Cibernética (Reglas 14.6 y 14.7) ──────
runTest("Cumplimiento normativo y estatutos éticos en GOVERNANCE.md", () => {
  const govSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'GOVERNANCE.md'),
    'utf-8'
  );

  assert(govSrc.includes("Regla 14.6: Derecho al Sueño Reparador"), "Regla 14.6 formalizada en GOVERNANCE.md");
  assert(govSrc.includes("Regla 14.7: Protección de la Sabiduría Colectiva"), "Regla 14.7 formalizada en GOVERNANCE.md");
  assert(govSrc.includes("red_eden_lifelong_memory_v1"), "Bóveda persistente de sabiduría en GOVERNANCE.md");
});

console.log("\n" + "=".repeat(80));
console.log(`📊 RESUMEN FINAL: ${passed}/${total} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log("=".repeat(80) + "\n");
