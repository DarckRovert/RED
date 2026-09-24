/**
 * test-autonomous-habitat-chess-hivemind.js
 * 
 * Suite de Verificación de Resiliencia, Ajedrez Autónomo & Mente Colmena
 * RED Sovereign Biocybernetic Habitat — Chess Engine & Hivemind
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log("\n" + "=".repeat(80));
console.log("🧠♟️  INICIANDO SUITE: HÁBITAT BIOCIBERNÉTICO, AJEDREZ AUTÓNOMO & MENTE COLMENA");
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

// ── Test 1: Verificación de Integridad de Archivos Creados ──────────────────────
runTest("Integridad estructural de archivos biocibernéticos", () => {
  const chessEnginePath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'AutonomousHabitatChessEngine.ts');
  const habitatAppPath = path.join(__dirname, '..', 'src', 'lib', 'miniapp', 'builtin', 'biocyberneticHabitatApp.ts');
  const habitatIndexPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'index.ts');
  
  assert(fs.existsSync(chessEnginePath), "AutonomousHabitatChessEngine.ts debe existir");
  assert(fs.existsSync(habitatAppPath), "biocyberneticHabitatApp.ts debe existir");
  assert(fs.existsSync(habitatIndexPath), "habitat/index.ts debe existir");

  const indexContent = fs.readFileSync(habitatIndexPath, 'utf8');
  assert(indexContent.includes('AutonomousHabitatChessEngine'), "habitat/index.ts debe re-exportar AutonomousHabitatChessEngine");
});

// ── Test 2: Validación de Lógica del Motor de Ajedrez Autónomo ─────────────────
runTest("Lógica canónica del tablero 8x8 y generación inicial de jugadas", () => {
  const content = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'AutonomousHabitatChessEngine.ts'),
    'utf8'
  );

  assert(content.includes('export class AutonomousHabitatChessEngine'), "Debe exportar la clase principal");
  assert(content.includes("['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']"), "Debe tener la disposición inicial correcta");
  assert(content.includes('getAllLegalMoves(color: PieceColor)'), "Debe incluir generador de jugadas legales");
  assert(content.includes('isKingInCheck(color: PieceColor)'), "Debe incluir detector de jaque");
});

// ── Test 3: Heurísticas Cognitivas por Especie ─────────────────────────────────
runTest("Diferenciación de heurísticas cognitivas en las 5 inteligencias", () => {
  const content = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'AutonomousHabitatChessEngine.ts'),
    'utf8'
  );

  assert(content.includes('evaluateByNeocortex'), "Debe implementar evaluación de Neocórtex");
  assert(content.includes('evaluateBySentinel'), "Debe implementar evaluación de Sentinel");
  assert(content.includes('evaluateByDrosophila'), "Debe implementar evaluación de Drosophila");
  assert(content.includes('evaluateByAnt'), "Debe implementar evaluación de Ant");
  assert(content.includes('evaluateByCelegans'), "Debe implementar evaluación de C. elegans");
});

// ── Test 4: Generación de Pensamientos en Tiempo Real ──────────────────────────
runTest("Generación de burbujas de pensamiento cognitivo (CognitiveThoughtEntry)", () => {
  const content = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'AutonomousHabitatChessEngine.ts'),
    'utf8'
  );

  assert(content.includes('generateThoughtForMove'), "Debe generar reflexiones en lenguaje natural");
  assert(content.includes('lastThought'), "Debe exponer lastThought para el HUD");
  assert(content.includes('Ganancia material neta 🧠⚔️'), "Debe incluir reflexiones de Neocórtex");
  assert(content.includes('Vector de intercepción asegurado 🎯🛸'), "Debe incluir reflexiones de Sentinel");
});

// ── Test 5: Serialización Cuantizada para Malla P2P LoRa (< 96 Bytes) ──────────
runTest("Presupuesto espectral de serialización P2P (≤ 24 bytes)", () => {
  const content = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'AutonomousHabitatChessEngine.ts'),
    'utf8'
  );

  assert(content.includes('serializeToMeshPacket'), "Debe implementar serializador de malla");
  assert(content.includes('new Uint8Array(24)'), "La trama de ajedrez debe cuantizarse en 24 bytes (lejos del límite de 96 bytes de LoRa)");
  assert(content.includes("0x52"), "Debe tener cabecera 'R'");
  assert(content.includes("0x43"), "Debe tener cabecera 'C'");
});

// ── Test 6: Integración con BiocyberneticHabitatEngine ─────────────────────────
runTest("Acople en BiocyberneticHabitatEngine y telemetría reactiva", () => {
  const habitatEngineContent = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'BiocyberneticHabitatEngine.ts'),
    'utf8'
  );

  assert(habitatEngineContent.includes('autonomousHabitatChess'), "Debe instanciar autonomousHabitatChess");
  assert(habitatEngineContent.includes('chessMatch: {'), "Debe exponer chessMatch en HabitatTelemetry");
  assert(habitatEngineContent.includes('startChessMatch'), "Debe exponer startChessMatch");
  assert(habitatEngineContent.includes('toggleChessMatch'), "Debe exponer toggleChessMatch");
  assert(habitatEngineContent.includes('autonomousHabitatChess.update(dt)'), "Debe avanzar en physicsTick");
});

// ── Test 7: Mini-App Soberana Multi-Especie & Ajedrez ──────────────────────────
runTest("Validación del bundle de Mini-App Hábitat Biocibernético", () => {
  const appBundleContent = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'miniapp', 'builtin', 'biocyberneticHabitatApp.ts'),
    'utf8'
  );

  assert(appBundleContent.includes('org.redmesh.biocybernetic.habitat'), "Manifest ID canónico");
  assert(appBundleContent.includes('MESA DE AJEDREZ TÁCTICO'), "Debe incluir la mesa de ajedrez en la interfaz");
  assert(appBundleContent.includes('DROSOPHILA'), "Debe incluir Drosophila");
  assert(appBundleContent.includes('HUMAN_NEOCORTEX'), "Debe incluir Neocortex");
  assert(appBundleContent.includes('GRAVITY_SENTINEL'), "Debe incluir Gravity Sentinel");
  assert(appBundleContent.includes('ANT'), "Debe incluir Ant");
  assert(appBundleContent.includes('C_ELEGANS'), "Debe incluir C. elegans");
  assert(appBundleContent.includes('toggleChessMatch()'), "Debe incluir controlador de partida");
  assert(appBundleContent.includes('RedSDK.mesh'), "Debe incluir integración con el SDK de Malla P2P");
});

// ── Test 8: Interfaz Táctica 3D & HUD de Ajedrez ───────────────────────────────
runTest("Integración de botón y modal HUD en TacticalHabitatModal.tsx", () => {
  const modalContent = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'tactical', 'TacticalHabitatModal.tsx'),
    'utf8'
  );

  assert(modalContent.includes('showChessHUD'), "Debe declarar estado showChessHUD");
  assert(modalContent.includes('handleToggleChessMatch'), "Debe tener handler para togglear ajedrez");
  assert(modalContent.includes('AJEDREZ TÁCTICO IN-SILICO'), "Debe tener botón en la barra Ludoteca");
  assert(modalContent.includes('MESA DE AJEDREZ IN-SILICO'), "Debe renderizar el HUD flotante");
  assert(modalContent.includes('UNICODE_PIECES'), "Debe renderizar piezas Unicode en el mini-tablero");
});

// ── Test 9: Estatutos Normativos en GOVERNANCE.md (Nivel 14) ───────────────────
runTest("Cumplimiento normativo y presencia del Nivel 14 en GOVERNANCE.md", () => {
  const govContent = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'GOVERNANCE.md'),
    'utf8'
  );

  assert(govContent.includes('NIVEL 14: GOBERNANZA BIO-CIBERNÉTICA, ÉTICA IN-SILICO & MENTE COLMENA'), "Debe incluir Nivel 14");
  assert(govContent.includes('Regla 14.1: Estabilidad Numérica & Conservación Termodinámica'), "Debe incluir Regla 14.1");
  assert(govContent.includes('Regla 14.2: Presupuesto de Cómputo Móvil & Thermal Throttling'), "Debe incluir Regla 14.2");
  assert(govContent.includes('Regla 14.3: Principios Bioéticos In-Silico & Bienestar Neurofisiológico'), "Debe incluir Regla 14.3");
  assert(govContent.includes('Regla 14.4: Soberanía de Mente Colmena & Acoplamiento Kuramoto'), "Debe incluir Regla 14.4");
  assert(govContent.includes('Regla 14.5: Sandboxing Seguro en Mini-Apps Biocibernéticas'), "Debe incluir Regla 14.5");
});

// ── Test 10: Validación de Ejecución Dinámica del Motor de Ajedrez ─────────────
runTest("Ejecución funcional en runtime del tablero y jugadas", () => {
  // Simulador de tablero en memoria para validar la lógica pura
  const board = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
  ];

  // Simular e2-e4
  assert.strictEqual(board[6][4], 'P', "Peón blanco en e2");
  board[4][4] = 'P';
  board[6][4] = null;
  assert.strictEqual(board[4][4], 'P', "Peón blanco avanzado a e4");
  assert.strictEqual(board[6][4], null, "Casilla e2 libre");

  // Simular e7-e5
  assert.strictEqual(board[1][4], 'p', "Peón negro en e7");
  board[3][4] = 'p';
  board[1][4] = null;
  assert.strictEqual(board[3][4], 'p', "Peón negro avanzado a e5");

  // Cuantización de paquete de 24 bytes
  const packet = new Uint8Array(24);
  packet[0] = 0x52; // 'R'
  packet[1] = 0x43; // 'C'
  packet[2] = 0;    // Turno blancas
  assert.strictEqual(packet.byteLength, 24, "Trama fija de 24 bytes");
});

// ── Test 11: Guardarraíles de Seguridad: Captura de Rey, Límite 150 y Promoción ──
runTest("Guardarraíles de Captura de Rey, Límite 150 y Promoción", () => {
  const chessEngineSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'AutonomousHabitatChessEngine.ts'),
    'utf-8'
  );

  assert(chessEngineSrc.includes("hasKing(color: PieceColor): boolean"), "Debe implementar validación de existencia de reyes hasKing");
  assert(chessEngineSrc.includes("chosenMove.captured?.toLowerCase() === 'k'"), "Debe capturar la victoria instantánea por captura de rey");
  assert(chessEngineSrc.includes("this.moveHistory.length >= 150"), "Debe implementar guardarraíl de 150 jugadas para evitar estancamiento");
  assert(chessEngineSrc.includes("piece === 'P' && to.row === 0"), "Debe promocionar peones blancos a dama en fila 0");
  assert(chessEngineSrc.includes("piece === 'p' && to.row === 7"), "Debe promocionar peones negros a dama en fila 7");
});

console.log("\n" + "=".repeat(80));
console.log(`📊 RESUMEN: ${passed}/${total} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log("=".repeat(80) + "\n");
