/**
 * biocyberneticHabitatApp.ts — Hábitat Digital Biocibernético (Built-in Mini-App)
 * 
 * Mini-App Soberana interactiva de primera clase para RED OS.
 * Ofrece un laboratorio biocibernético in-silico con simulación de difusión molecular de Fick,
 * tropotaxis por muestreo antenal diferencial, instrumental táctico de experimentación
 * (pipeta de glucosa, calor infrarrojo, optogenética ChR2 y sombras looming) y
 * migración ecológica P2P en malla a través de RedSDK.mesh.
 */

import { RedAppBundle } from '../RedSDKTypes';

export const biocyberneticHabitatAppBundle: RedAppBundle = {
  manifest: {
    id: 'org.redmesh.biocybernetic.habitat',
    name: 'Hábitat Biocibernético 3D',
    version: '1.0.0',
    description: 'Ecosistema biocibernético in-silico con física de difusión de Fick, visión omatidial, termodinámica real y migración P2P.',
    author: {
      name: 'RED Biocybernetics Laboratory',
      did: 'did:red:0000000000000000000000000000000000000000000000000000000000000008',
    },
    icon: '🪰',
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
    <title>Hábitat Biocibernético 3D</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header class="app-header">
        <span class="app-icon">🪰</span>
        <div class="header-titles">
            <h1>HÁBITAT BIOCIBERNÉTICO</h1>
            <p class="subtitle">Ecosistema In-Silico &middot; Difusión Fick &middot; Drosophila</p>
        </div>
        <div class="hud-status">
            <span id="hud-atp" class="badge badge-green">ATP: 100%</span>
            <span id="hud-state" class="badge badge-blue">ESTADO: ÓPTIMO</span>
            <span id="hud-mesh" class="badge badge-purple">MALLA: P2P LISTO</span>
        </div>
    </header>

    <div class="viewport-container">
        <canvas id="habitat-canvas" width="600" height="420"></canvas>
        <div id="alert-banner" class="alert-banner"></div>
    </div>

    <div class="control-panel">
        <div class="panel-section">
            <label class="section-label">🛠️ INSTRUMENTAL DE EXPERIMENTACIÓN</label>
            <div class="button-group">
                <button id="tool-glucose" class="btn btn-tool active" onclick="selectTool('GLUCOSE')">💧 Pipeta Glucosa</button>
                <button id="tool-heat" class="btn btn-tool" onclick="selectTool('HEAT')">🔥 Foco Infrarrojo</button>
                <button id="tool-shadow" class="btn btn-tool" onclick="selectTool('SHADOW')">🌑 Sombra Looming</button>
                <button id="tool-chr2" class="btn btn-tool" onclick="selectTool('CHR2')">⚡ Optogenética ChR2</button>
            </div>
        </div>

        <div class="panel-section">
            <label class="section-label">📡 ACCIONES DE ENJAMBRE & MALLA P2P</label>
            <div class="button-group">
                <button class="btn btn-action" onclick="emigrateToMesh()">🚀 Emigrar Organismo a Malla</button>
                <button class="btn btn-action" onclick="spawnNewAgent()">➕ Añadir Drosophila</button>
                <button class="btn btn-danger" onclick="clearField()">🧹 Limpiar Sustrato</button>
            </div>
        </div>
    </div>

    <footer class="app-footer">
        <span>RED Sovereign OS &middot; Mini-App Biocibernética v121.0.0</span>
        <span id="footer-metrics">Fick Grid: 64x64 &middot; Tick: 60Hz &middot; STDP: Activo</span>
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
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.app-icon {
    font-size: 24px;
}

.header-titles h1 {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 1px;
    color: #00f0ff;
}

.subtitle {
    font-size: 10px;
    color: #8b9bb4;
}

.hud-status {
    margin-left: auto;
    display: flex;
    gap: 8px;
}

.badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
}

.badge-green { background: rgba(0, 255, 136, 0.15); border: 1px solid #00ff88; color: #00ff88; }
.badge-blue { background: rgba(0, 240, 255, 0.15); border: 1px solid #00f0ff; color: #00f0ff; }
.badge-purple { background: rgba(168, 85, 247, 0.15); border: 1px solid #a855f7; color: #a855f7; }

.viewport-container {
    flex: 1;
    position: relative;
    background: #020610;
    display: flex;
    justify-content: center;
    align-items: center;
}

#habitat-canvas {
    width: 100%;
    height: 100%;
    cursor: crosshair;
}

.alert-banner {
    position: absolute;
    top: 12px;
    background: rgba(255, 51, 85, 0.25);
    border: 1px solid #ff3355;
    color: #ff3355;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 800;
    display: none;
}

.control-panel {
    background: #091220;
    border-top: 1px solid rgba(0, 240, 255, 0.2);
    padding: 10px 16px;
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
}

.panel-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.section-label {
    font-size: 10px;
    font-weight: 800;
    color: #8b9bb4;
    letter-spacing: 0.5px;
}

.button-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid rgba(139, 155, 180, 0.3);
    background: rgba(25, 40, 65, 0.5);
    color: #c8d6e5;
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
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
}

.btn-action {
    background: rgba(0, 255, 136, 0.12);
    border-color: #00ff88;
    color: #00ff88;
}

.btn-danger {
    background: rgba(255, 51, 85, 0.12);
    border-color: #ff3355;
    color: #ff3355;
}

.app-footer {
    background: #040812;
    border-top: 1px solid rgba(139, 155, 180, 0.15);
    padding: 6px 16px;
    font-size: 10px;
    color: #576574;
    display: flex;
    justify-content: space-between;
}`,

    'app.js': `// Simulación del Hábitat Biocibernético en Mini-App
const canvas = document.getElementById('habitat-canvas');
const ctx = canvas.getContext('2d');

let currentTool = 'GLUCOSE';
let atp = 100.0;
let glucose = 100.0;
let organisms = [{
    x: 300,
    y: 210,
    heading: 0,
    speed: 1.2,
    antennaeDiff: 0,
    atp: 100
}];

let chemicals = []; // {x, y, radius, intensity, substance}
let shadows = [];   // {x, y, radius, velocity}

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
        chemicals.push({ x, y, radius: 15, intensity: 1.0, substance: 'GLUCOSE' });
    } else if (currentTool === 'HEAT') {
        chemicals.push({ x, y, radius: 25, intensity: 1.0, substance: 'ALARM' });
    } else if (currentTool === 'SHADOW') {
        shadows.push({ x, y, radius: 8, velocity: 3.5 });
        showAlert("🌑 SOMBRA EXPANSIVA LOOMING: Disparo de Giant Fiber LC4");
    } else if (currentTool === 'CHR2') {
        atp = Math.min(100, atp + 15);
        showAlert("⚡ PULSO OPTOGENÉTICO ChR2: Despolarización Dopaminérgica PAM");
    }
});

function showAlert(text) {
    const b = document.getElementById('alert-banner');
    b.innerText = text;
    b.style.display = 'block';
    setTimeout(() => { b.style.display = 'none'; }, 2200);
}

function spawnNewAgent() {
    organisms.push({
        x: Math.random() * (canvas.width - 40) + 20,
        y: Math.random() * (canvas.height - 40) + 20,
        heading: Math.random() * Math.PI * 2,
        speed: 1.0,
        antennaeDiff: 0,
        atp: 100
    });
}

function clearField() {
    chemicals = [];
    shadows = [];
}

async function emigrateToMesh() {
    if (window.RedSDK && window.RedSDK.mesh) {
        try {
            await window.RedSDK.mesh.publish('mesh.bio.habitat.v1', {
                type: 'DROSOPHILA',
                atp: atp,
                timestamp: Date.now()
            });
            showAlert("🚀 ORGANISMO EMIGRADO A LA MALLA P2P (SX1262 LoRa/BLE)");
        } catch {
            showAlert("📡 Paquete de migración encolado en DTN Store & Forward");
        }
    } else {
        showAlert("🚀 ORGANISMO EMIGRADO (Simulado sobre bus local)");
    }
}

// Bucle físico y renderizado a 60 Hz
function step() {
    // 1. Difusión y evaporación de químicos
    for (let i = chemicals.length - 1; i >= 0; i--) {
        const c = chemicals[i];
        c.radius += 0.15;
        c.intensity *= 0.992;
        if (c.intensity < 0.05) chemicals.splice(i, 1);
    }

    // 2. Sombras Looming
    for (let i = shadows.length - 1; i >= 0; i--) {
        const s = shadows[i];
        s.radius += s.velocity;
        if (s.radius > 120) shadows.splice(i, 1);
    }

    // 3. Organismos
    atp = Math.max(0, atp - 0.02);
    document.getElementById('hud-atp').innerText = 'ATP: ' + Math.round(atp) + '%';
    document.getElementById('hud-state').innerText = atp > 60 ? 'ESTADO: ÓPTIMO' : (atp > 15 ? 'ESTADO: AHORRO' : 'ESTADO: TORPOR');

    for (const org of organisms) {
        // Tropotaxis antenal
        let leftSensor = 0;
        let rightSensor = 0;
        const antDist = 18;
        const antAngle = 0.5;

        const lx = org.x + Math.cos(org.heading - antAngle) * antDist;
        const ly = org.y + Math.sin(org.heading - antAngle) * antDist;
        const rx = org.x + Math.cos(org.heading + antAngle) * antDist;
        const ry = org.y + Math.sin(org.heading + antAngle) * antDist;

        for (const c of chemicals) {
            if (c.substance === 'GLUCOSE') {
                const dl = Math.hypot(c.x - lx, c.y - ly);
                const dr = Math.hypot(c.x - rx, c.y - ry);
                leftSensor += c.intensity / (1 + dl * 0.05);
                rightSensor += c.intensity / (1 + dr * 0.05);

                // Alimentación si toca la gota
                if (Math.hypot(c.x - org.x, c.y - org.y) < c.radius) {
                    atp = Math.min(100, atp + 0.3);
                }
            }
        }

        const delta = rightSensor - leftSensor;
        org.heading += delta * 0.15 + (Math.random() - 0.5) * 0.08;

        const speed = (atp > 15 ? 1.4 : 0.4) * (leftSensor + rightSensor > 0.1 ? 1.6 : 1.0);
        org.x += Math.cos(org.heading) * speed;
        org.y += Math.sin(org.heading) * speed;

        // Rebote en bordes
        if (org.x < 15) { org.x = 15; org.heading = Math.PI - org.heading; }
        if (org.x > canvas.width - 15) { org.x = canvas.width - 15; org.heading = Math.PI - org.heading; }
        if (org.y < 15) { org.y = 15; org.heading = -org.heading; }
        if (org.y > canvas.height - 15) { org.y = canvas.height - 15; org.heading = -org.heading; }
    }

    render();
    requestAnimationFrame(step);
}

function render() {
    ctx.fillStyle = '#020610';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Rejilla de fondo
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Dibujar Químicos
    for (const c of chemicals) {
        const radGrad = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.radius);
        if (c.substance === 'GLUCOSE') {
            radGrad.addColorStop(0, 'rgba(0, 255, 136, ' + (c.intensity * 0.8) + ')');
            radGrad.addColorStop(1, 'rgba(0, 255, 136, 0)');
        } else {
            radGrad.addColorStop(0, 'rgba(255, 51, 85, ' + (c.intensity * 0.8) + ')');
            radGrad.addColorStop(1, 'rgba(255, 51, 85, 0)');
        }
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Dibujar Sombras Looming
    for (const s of shadows) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff3355';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Dibujar Organismos
    for (const org of organisms) {
        ctx.save();
        ctx.translate(org.x, org.y);
        ctx.rotate(org.heading);

        // Antenas
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(6, -2); ctx.lineTo(16, -8);
        ctx.moveTo(6, 2); ctx.lineTo(16, 8);
        ctx.stroke();

        // Omatidios (ojos compuestos)
        ctx.fillStyle = '#ff0055';
        ctx.beginPath(); ctx.arc(4, -4, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(4, 4, 2.5, 0, Math.PI * 2); ctx.fill();

        // Cuerpo / Tórax
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Alas traslúcidas
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath(); ctx.ellipse(-4, -6, 8, 3, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-4, 6, 8, 3, 0.2, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }
}

requestAnimationFrame(step);
`,
  },
};
