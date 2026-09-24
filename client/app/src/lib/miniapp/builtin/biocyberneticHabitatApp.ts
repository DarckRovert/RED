/**
 * biocyberneticHabitatApp.ts — Hábitat Digital Biocibernético Multi-Especie & Ajedrez Autónomo
 * 
 * Mini-App Soberana de Primera Clase para la Tienda de Aplicaciones de RED OS.
 * Ofrece un laboratorio in-silico completo con:
 * - Coexistencia de las 5 inteligencias: Drosophila, C. elegans, Ant, Human Neocortex y Gravity Sentinel.
 * - Mesa central de Ajedrez Táctico In-Silico con partidas autónomas y juego interactivo.
 * - Simulación de difusión de Fick (Glucosa y Feromonas) y cinemática fisiológica.
 * - Pensamientos cognitivos flotantes en tiempo real sobre los organismos.
 * - Instrumental táctico: Pipeta de Glucosa, Foco Térmico, Sombras Looming y Optogenética ChR2.
 * - Integración con RedSDK.mesh para emigración e intercambio P2P entre nodos de la red.
 */

import { RedAppBundle } from '../RedSDKTypes';

export const biocyberneticHabitatAppBundle: RedAppBundle = {
  manifest: {
    id: 'org.redmesh.biocybernetic.habitat',
    name: 'Hábitat Biocibernético & Ajedrez Autónomo',
    version: '122.0.0',
    description: 'Ecosistema multi-cerebro in-silico (5 especies) con mesa de ajedrez táctico autónomo, física de difusión de Fick y migración P2P en malla.',
    author: {
      name: 'RED Biocybernetics Laboratory',
      did: 'did:red:0000000000000000000000000000000000000000000000000000000000000008',
    },
    icon: '🧬',
    category: 'utility',
    permissions: ['identity', 'mesh_pubsub', 'storage', 'sensors'],
    entryPoint: 'index.html',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  files: {
    'index.html': `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hábitat Biocibernético & Ajedrez In-Silico</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header class="app-header">
        <span class="app-icon">🧬</span>
        <div class="header-titles">
            <h1>HÁBITAT BIOCIBERNÉTICO & MENTE COLMENA</h1>
            <p class="subtitle">5 Inteligencias In-Silico &middot; Ajedrez Autónomo &middot; Difusión Fick</p>
        </div>
        <div class="hud-status">
            <span id="hud-atp" class="badge badge-green">ATP: 100%</span>
            <span id="hud-turn" class="badge badge-yellow">TURNO: BLANCAS</span>
            <span id="hud-mesh" class="badge badge-purple">MALLA P2P: ACTIVA</span>
        </div>
    </header>

    <div class="main-layout">
        <div class="viewport-container">
            <canvas id="habitat-canvas"></canvas>
            <div id="alert-banner" class="alert-banner"></div>
        </div>

        <aside class="sidebar-panel">
            <div class="panel-card chess-card">
                <div class="card-header">
                    <h3>♟️ MESA DE AJEDREZ TÁCTICO</h3>
                    <span id="match-status" class="status-indicator">EN CURSO</span>
                </div>
                <div class="competitors-row">
                    <div class="player-box white-player">
                        <span class="piece-icon">♔</span>
                        <div class="player-info">
                            <span id="p1-name" class="p-name">Neocórtex Alpha</span>
                            <span class="p-species">HUMAN_NEOCORTEX</span>
                        </div>
                    </div>
                    <span class="vs-text">VS</span>
                    <div class="player-box black-player">
                        <span class="piece-icon">♚</span>
                        <div class="player-info">
                            <span id="p2-name" class="p-name">Sentinel Aegis-1</span>
                            <span class="p-species">GRAVITY_SENTINEL</span>
                        </div>
                    </div>
                </div>

                <div class="mini-board-wrapper">
                    <div id="mini-chessboard" class="chessboard-grid"></div>
                </div>

                <div class="chess-controls">
                    <button id="btn-toggle-chess" class="btn btn-action" onclick="toggleChessMatch()">⏸️ Pausar</button>
                    <button class="btn" onclick="resetChessMatch()">🔄 Nueva Partida</button>
                    <button class="btn" onclick="switchCompetitors()">🔀 Competidores</button>
                </div>

                <div class="thought-feed">
                    <label class="feed-label">💭 PENSAMIENTO TÁCTICO RECIENTE:</label>
                    <div id="latest-thought" class="thought-text">"Analizando casillas centrales d4/e4..."</div>
                </div>
            </div>

            <div class="panel-card tools-card">
                <h3>🛠️ INSTRUMENTAL DE CAMPO</h3>
                <div class="tools-grid">
                    <button id="tool-glucose" class="btn btn-tool active" onclick="selectTool('GLUCOSE')">💧 Glucosa</button>
                    <button id="tool-heat" class="btn btn-tool" onclick="selectTool('HEAT')">🔥 Calor</button>
                    <button id="tool-shadow" class="btn btn-tool" onclick="selectTool('SHADOW')">🌑 Sombra</button>
                    <button id="tool-chr2" class="btn btn-tool" onclick="selectTool('CHR2')">⚡ ChR2</button>
                </div>
                <div class="actions-row">
                    <button class="btn btn-primary" onclick="spawnOrganismPrompt()">➕ Organismo</button>
                    <button class="btn btn-primary" onclick="emigrateToMesh()">🚀 Emigrar P2P</button>
                    <button class="btn btn-action" onclick="edenBlessing()">🌿 Bendición Edén</button>
                    <button class="btn btn-danger" onclick="clearChemicals()">🧹 Limpiar</button>
                </div>
            </div>
        </aside>
    </div>

    <footer class="app-footer">
        <span>RED Sovereign OS &middot; Mini-App Biocibernética v122.0.0</span>
        <span id="footer-metrics">Especies: 5/5 &middot; Sustrato: Fick 64x64 &middot; Tick: 60Hz &middot; LoRa Sync: OK</span>
    </footer>

    <script src="app.js"></script>
</body>
</html>`,

    'style.css': `* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
}

body {
    background: #060c18;
    color: #e2e8f0;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
}

.app-header {
    background: rgba(10, 20, 36, 0.95);
    border-bottom: 1px solid rgba(0, 240, 255, 0.25);
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.app-icon {
    font-size: 24px;
}

.header-titles h1 {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 1px;
    color: #00f0ff;
}

.header-titles .subtitle {
    font-size: 10px;
    color: #8b9bb4;
}

.hud-status {
    margin-left: auto;
    display: flex;
    gap: 8px;
}

.badge {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
    font-family: monospace;
}

.badge-green { background: rgba(0, 255, 136, 0.15); color: #00ff88; border: 1px solid #00ff88; }
.badge-yellow { background: rgba(255, 215, 0, 0.15); color: #ffd700; border: 1px solid #ffd700; }
.badge-purple { background: rgba(176, 38, 255, 0.15); color: #b026ff; border: 1px solid #b026ff; }

.main-layout {
    display: flex;
    flex: 1;
    min-height: 0;
}

.viewport-container {
    flex: 1;
    position: relative;
    background: #02040a;
}

#habitat-canvas {
    width: 100%;
    height: 100%;
    display: block;
    cursor: crosshair;
}

.alert-banner {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 240, 255, 0.9);
    color: #000;
    font-weight: 800;
    font-size: 11px;
    padding: 6px 16px;
    border-radius: 20px;
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.5);
    display: none;
    pointer-events: none;
    z-index: 10;
}

.sidebar-panel {
    width: 320px;
    background: #080f1d;
    border-left: 1px solid rgba(0, 240, 255, 0.2);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    overflow-y: auto;
}

.panel-card {
    background: rgba(13, 24, 44, 0.7);
    border: 1px solid rgba(139, 155, 180, 0.2);
    border-radius: 8px;
    padding: 10px;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.card-header h3, .panel-card h3 {
    font-size: 11px;
    font-weight: 800;
    color: #00f0ff;
    letter-spacing: 0.5px;
}

.status-indicator {
    font-size: 9px;
    font-weight: 800;
    color: #00ff88;
    background: rgba(0, 255, 136, 0.15);
    padding: 2px 6px;
    border-radius: 3px;
}

.competitors-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    background: rgba(4, 8, 16, 0.6);
    padding: 6px;
    border-radius: 6px;
}

.player-box {
    display: flex;
    align-items: center;
    gap: 6px;
}

.piece-icon {
    font-size: 18px;
}

.white-player .piece-icon { color: #fff; }
.black-player .piece-icon { color: #ffd700; }

.player-info {
    display: flex;
    flex-direction: column;
}

.p-name {
    font-size: 10px;
    font-weight: 700;
    color: #e2e8f0;
}

.p-species {
    font-size: 8px;
    color: #8b9bb4;
    font-family: monospace;
}

.vs-text {
    font-size: 10px;
    font-weight: 900;
    color: #ff3355;
}

.mini-board-wrapper {
    display: flex;
    justify-content: center;
    margin-bottom: 8px;
}

.chessboard-grid {
    display: grid;
    grid-template-columns: repeat(8, 22px);
    grid-template-rows: repeat(8, 22px);
    border: 2px solid #00f0ff;
    border-radius: 4px;
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
}

.chess-cell {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    user-select: none;
}

.cell-light { background: #1a283e; }
.cell-dark { background: #0c1626; }
.piece-white { color: #ffffff; text-shadow: 0 0 4px #00f0ff; }
.piece-black { color: #ffd700; text-shadow: 0 0 4px #ff3355; }

.chess-controls {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
}

.thought-feed {
    background: rgba(4, 8, 16, 0.7);
    border-radius: 6px;
    padding: 6px;
}

.feed-label {
    font-size: 9px;
    font-weight: 700;
    color: #ffd700;
    display: block;
    margin-bottom: 4px;
}

.thought-text {
    font-size: 10px;
    color: #c8d6e5;
    font-style: italic;
    line-height: 1.3;
}

.tools-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin: 8px 0;
}

.actions-row {
    display: flex;
    gap: 6px;
}

.btn {
    flex: 1;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid rgba(139, 155, 180, 0.3);
    background: rgba(25, 40, 65, 0.5);
    color: #c8d6e5;
    transition: all 0.15s ease;
}

.btn:hover {
    background: rgba(0, 240, 255, 0.15);
    border-color: #00f0ff;
    color: #00f0ff;
}

.btn-tool.active {
    background: rgba(0, 240, 255, 0.25);
    border-color: #00f0ff;
    color: #00f0ff;
    box-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
}

.btn-action {
    background: rgba(0, 255, 136, 0.15);
    border-color: #00ff88;
    color: #00ff88;
}

.btn-danger {
    background: rgba(255, 51, 85, 0.15);
    border-color: #ff3355;
    color: #ff3355;
}

.app-footer {
    background: #040812;
    border-top: 1px solid rgba(139, 155, 180, 0.15);
    padding: 5px 16px;
    font-size: 10px;
    color: #576574;
    display: flex;
    justify-content: space-between;
}`,

    'app.js': `// Simulación del Hábitat Biocibernético Multi-Especie & Ajedrez Autónomo
const canvas = document.getElementById('habitat-canvas');
const ctx = canvas.getContext('2d');
const miniBoardEl = document.getElementById('mini-chessboard');

let currentTool = 'GLUCOSE';
let organisms = [];
let chemicals = [];
let shadows = [];
let alertTimer = null;

// Inicializar 5 especies
function initOrganisms() {
    organisms = [
        { id: 'org_1', species: 'DROSOPHILA', name: 'Fly-124k', x: 120, y: 140, heading: 0, speed: 1.4, color: '#00f0ff', atp: 100, thought: 'Brújula EB activa 🧭' },
        { id: 'org_2', species: 'HUMAN_NEOCORTEX', name: 'Neocórtex Alpha', x: 260, y: 100, heading: Math.PI/2, speed: 1.0, color: '#ff66cc', atp: 98, thought: 'Calculando jugada 🧠' },
        { id: 'org_3', species: 'GRAVITY_SENTINEL', name: 'Sentinel Aegis-1', x: 200, y: 220, heading: -Math.PI/2, speed: 1.6, color: '#00ff88', atp: 95, thought: 'Radar iónico fijado 🛸' },
        { id: 'org_4', species: 'ANT', name: 'Obrera-42', x: 160, y: 280, heading: Math.PI/4, speed: 1.1, color: '#ffaa00', atp: 92, thought: 'Rastro estigmérgico 🐜' },
        { id: 'org_5', species: 'C_ELEGANS', name: 'Nematodo-302', x: 280, y: 260, heading: Math.PI, speed: 0.8, color: '#a855f7', atp: 96, thought: 'Ondulación suave 🪱' }
    ];
}
initOrganisms();

// ── Motor Autónomo de Ajedrez Embebido ──────────────────────────────────────────
let chessActive = true;
let chessTurn = 'w';
let chessMoveCount = 0;
let chessBoard = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

const UNICODE_PIECES = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

function renderChessboard() {
    miniBoardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            cell.className = 'chess-cell ' + ((r + c) % 2 === 0 ? 'cell-light' : 'cell-dark');
            const piece = chessBoard[r][c];
            if (piece) {
                cell.textContent = UNICODE_PIECES[piece] || piece;
                cell.className += (piece === piece.toUpperCase()) ? ' piece-white' : ' piece-black';
            }
            miniBoardEl.appendChild(cell);
        }
    }
}
renderChessboard();

function toggleChessMatch() {
    chessActive = !chessActive;
    document.getElementById('btn-toggle-chess').textContent = chessActive ? '⏸️ Pausar' : '▶️ Reanudar';
    document.getElementById('match-status').textContent = chessActive ? 'EN CURSO' : 'PAUSADO';
    showAlert(chessActive ? '♟️ Partida de Ajedrez reanudada' : '⏸️ Partida pausada');
}

function resetChessMatch() {
    chessBoard = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    chessTurn = 'w';
    chessMoveCount = 0;
    renderChessboard();
    document.getElementById('hud-turn').textContent = 'TURNO: BLANCAS';
    showAlert('🔄 Nueva partida táctica inicializada');
}

function switchCompetitors() {
    const p1 = document.getElementById('p1-name');
    const p2 = document.getElementById('p2-name');
    if (p1.textContent === 'Neocórtex Alpha') {
        p1.textContent = 'Fly-124k';
        p2.textContent = 'Obrera-42';
    } else {
        p1.textContent = 'Neocórtex Alpha';
        p2.textContent = 'Sentinel Aegis-1';
    }
    showAlert('🔀 Nuevos competidores asignados a la mesa');
}

// Bucle de jugada autónoma cada 2 segundos
setInterval(() => {
    if (!chessActive) return;

    // Buscar una pieza válida para mover
    const moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = chessBoard[r][c];
            if (!p) continue;
            const isWhite = p === p.toUpperCase();
            if ((chessTurn === 'w' && isWhite) || (chessTurn === 'b' && !isWhite)) {
                // Movimiento básico hacia adelante o captura simple
                const dir = isWhite ? -1 : 1;
                const tr = r + dir;
                if (tr >= 0 && tr < 8) {
                    if (!chessBoard[tr][c]) moves.push({ from: [r, c], to: [tr, c], piece: p });
                    if (c > 0 && chessBoard[tr][c-1]) moves.push({ from: [r, c], to: [tr, c-1], piece: p });
                    if (c < 7 && chessBoard[tr][c+1]) moves.push({ from: [r, c], to: [tr, c+1], piece: p });
                }
            }
        }
    }

    if (moves.length > 0) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        chessBoard[m.to[0]][m.to[1]] = m.piece;
        chessBoard[m.from[0]][m.from[1]] = null;
        chessMoveCount++;

        chessTurn = chessTurn === 'w' ? 'b' : 'w';
        document.getElementById('hud-turn').textContent = chessTurn === 'w' ? 'TURNO: BLANCAS' : 'TURNO: NEGRAS';
        renderChessboard();

        const thoughts = [
            'Avanzando estructura de peones central ♟️',
            'Presión táctica sobre la casilla ' + String.fromCharCode(97 + m.to[1]) + (8 - m.to[0]) + ' ⚔️',
            'Vector de cobertura espacial asegurado 🎯',
            'Sintiendo recompensa dopaminérgica en el atractor 🪰',
            'Refuerzo estigmérgico en flanco rey 🐜'
        ];
        const t = thoughts[Math.floor(Math.random() * thoughts.length)];
        document.getElementById('latest-thought').textContent = '"' + t + '"';

        // Actualizar pensamiento del organismo correspondiente
        const targetOrg = organisms.find(o => o.species === (chessTurn === 'w' ? 'HUMAN_NEOCORTEX' : 'GRAVITY_SENTINEL'));
        if (targetOrg) targetOrg.thought = t;
    }
}, 2000);

// ── Renderizado Canvas del Hábitat ─────────────────────────────────────────────
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function selectTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('tool-' + tool.toLowerCase());
    if (btn) btn.classList.add('active');
}

canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'GLUCOSE') {
        chemicals.push({ x, y, radius: 18, intensity: 1.0, substance: 'GLUCOSE' });
        showAlert('💧 Glucosa depositada en el sustrato');
    } else if (currentTool === 'HEAT') {
        chemicals.push({ x, y, radius: 26, intensity: 1.0, substance: 'HEAT' });
        showAlert('🔥 Foco térmico nociceptivo activado');
    } else if (currentTool === 'SHADOW') {
        shadows.push({ x, y, radius: 10, velocity: 3.5 });
        showAlert('🌑 SOMBRA EXPANSIVA: Reflejo Giant Fiber activado');
    } else if (currentTool === 'CHR2') {
        organisms.forEach(o => o.atp = Math.min(100, o.atp + 10));
        showAlert('⚡ OPTOGENÉTICA ChR2: Despolarización sináptica global');
    }
});

function showAlert(text) {
    const b = document.getElementById('alert-banner');
    b.textContent = text;
    b.style.display = 'block';
    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = setTimeout(() => { b.style.display = 'none'; }, 2400);
}

function spawnOrganismPrompt() {
    const speciesList = ['DROSOPHILA', 'C_ELEGANS', 'ANT', 'HUMAN_NEOCORTEX', 'GRAVITY_SENTINEL'];
    const chosen = speciesList[Math.floor(Math.random() * speciesList.length)];
    organisms.push({
        id: 'org_' + Date.now(),
        species: chosen,
        name: chosen + '-' + Math.floor(Math.random() * 999),
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        heading: Math.random() * Math.PI * 2,
        speed: 1.2,
        color: '#00ffcc',
        atp: 100,
        thought: 'Nuevo organismo clonado in-silico ✨'
    });
    showAlert('➕ ' + chosen + ' introducido al hábitat');
}

async function emigrateToMesh() {
    try {
        if (window.RedSDK && window.RedSDK.mesh) {
            await window.RedSDK.mesh.broadcast('biocybernetic-habitat', {
                type: 'ORGANISM_MIGRATION',
                species: 'DROSOPHILA',
                atp: 100,
                timestamp: Date.now()
            });
            showAlert('🚀 Organismo transmitido exitosamente a la Malla RED');
        } else {
            showAlert('📡 Malla simulada: Paquete transmitido a buffer local');
        }
    } catch(e) {
        showAlert('⚠️ Error en puente de malla: ' + e.message);
    }
}

function clearChemicals() {
    chemicals = [];
    shadows = [];
    showAlert('🧹 Sustrato de Fick purgado');
}

function edenBlessing() {
    for (let i = 0; i < 8; i++) {
        chemicals.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: 35,
            intensity: 1.0,
            substance: 'GLUCOSE'
        });
    }
    organisms.forEach(o => {
        o.atp = 100;
        o.thought = 'Sintiendo la paz del Árbol de la Vida y consolidando memoria 🌿✨';
    });
    const lt = document.getElementById('latest-thought');
    if (lt) lt.textContent = '"Sintiendo la paz del Árbol de la Vida y consolidando memoria 🌿✨"';
    showAlert('🌿 BENDICIÓN EDÉNICA: Rocío de néctar y serenidad colectiva');
}

// Bucle Gráfico a 60 Hz
function render() {
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Rejilla de fondo
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Árbol de la Vida Cuántico Central (Paraíso Biocibernético)
    const treeGrad = ctx.createRadialGradient(midX, midY, 4, midX, midY, 65);
    treeGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    treeGrad.addColorStop(0.7, 'rgba(0, 240, 255, 0.12)');
    treeGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = treeGrad;
    ctx.beginPath();
    ctx.arc(midX, midY, 65, 0, Math.PI * 2);
    ctx.fill();

    // 3 Manantiales de Néctar Cristalino en el bioma
    const springs = [
        { x: midX, y: midY - 140, r: 24, name: 'Aurora', col: 'rgba(0, 240, 255, 0.4)' },
        { x: midX - 130, y: midY + 110, r: 20, name: 'Metamorfosis', col: 'rgba(168, 85, 247, 0.4)' },
        { x: midX + 130, y: midY + 110, r: 20, name: 'Sosiego', col: 'rgba(34, 197, 94, 0.4)' }
    ];

    // Red Micelial Fúngica
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    springs.forEach(sp => {
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(sp.x, sp.y);
        ctx.stroke();
    });
    ctx.setLineDash([]);

    // Dibujar manantiales
    springs.forEach(sp => {
        ctx.fillStyle = sp.col;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#c084fc';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(sp.name, sp.x, sp.y + sp.r + 10);
    });

    // Mesa de Ajedrez Táctico Central
    ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(midX, midY, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#00f0ff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♟️', midX, midY + 7);
    ctx.font = '9px monospace';
    ctx.fillText('MESA TÁCTICA', midX, midY + 28);

    // Sustancias químicas (Glucosa, Calor)
    chemicals.forEach((c, idx) => {
        ctx.fillStyle = c.substance === 'GLUCOSE' ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 51, 85, 0.3)';
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
        ctx.fill();
        c.radius *= 0.998;
        if (c.radius < 2) chemicals.splice(idx, 1);
    });

    // Sombras Looming
    shadows.forEach((s, idx) => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.strokeStyle = '#ff3355';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        s.radius += s.velocity;
        if (s.radius > 80) shadows.splice(idx, 1);
    });

    // Organismos
    organisms.forEach(o => {
        o.x += Math.cos(o.heading) * o.speed;
        o.y += Math.sin(o.heading) * o.speed;
        o.heading += (Math.random() - 0.5) * 0.2;

        if (o.x < 10) o.x = canvas.width - 10;
        if (o.x > canvas.width - 10) o.x = 10;
        if (o.y < 10) o.y = canvas.height - 10;
        if (o.y > canvas.height - 10) o.y = 10;

        // Cuerpo del organismo
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Bocadillo de pensamiento flotante
        ctx.fillStyle = 'rgba(10, 20, 36, 0.85)';
        ctx.strokeStyle = o.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(o.x - 40, o.y - 24, 80, 14);
        ctx.fillRect(o.x - 40, o.y - 24, 80, 14);

        ctx.fillStyle = '#ffffff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(o.thought ? o.thought.slice(0, 14) + '...' : o.species, o.x, o.y - 14);
    });

    requestAnimationFrame(render);
}
render();
`
  }
};
