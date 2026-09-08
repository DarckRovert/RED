/**
 * deep_audit_modals_and_logic.js — Recursive version across all src/
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../src');

function getAllFiles(dir, exts = ['.tsx', '.ts']) {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            files = files.concat(getAllFiles(full, exts));
        } else if (exts.some(ext => e.name.endsWith(ext))) {
            files.push(full);
        }
    }
    return files;
}

const allFiles = getAllFiles(SRC_DIR);
console.log(`Auditing ${allFiles.length} files recursively in ${SRC_DIR}...\n`);

const findings = [];

allFiles.forEach(fullPath => {
    const relPath = path.relative(SRC_DIR, fullPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    const fileFindings = {
        file: relPath,
        randomSimulations: [],
        mockData: [],
        stubsAndTodos: [],
        emptyHandlers: [],
        hardcodedSensors: []
    };

    lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const trimmed = line.trim();

        // 1. Math.random() simulando mediciones o señales
        if (line.includes('Math.random()') && !line.includes('//') && !relPath.includes('crypto') && !relPath.includes('Shamir') && !relPath.includes('Landing')) {
            const isParticle = line.includes('particle') || line.includes('Particle') || line.includes('canvas') || line.includes('star');
            const isLegitId = line.includes('Math.random().toString(36)') || line.includes('id:') || line.includes('key:') || line.includes('nonce') || line.includes('backoff') || line.includes('jitter') || isParticle;
            if (!isLegitId) {
                fileFindings.randomSimulations.push({ lineNum, text: trimmed });
            }
        }

        // 2. Mocks / Dummies
        const mockMatch = line.match(/(const|let|var)\s+(mock|dummy|fake|sample)[A-Za-z0-9_]*\s*=/i);
        if (mockMatch && !relPath.includes('test') && !line.includes('sampleRate') && !line.includes('sampleCount') && !line.includes('sampleDigest') && !line.includes('sampleBuffer')) {
            fileFindings.mockData.push({ lineNum, text: trimmed });
        }

        // 3. TODOs, "Próximamente", "En desarrollo", etc.
        if ((trimmed.toLowerCase().includes('próximamente') || trimmed.toLowerCase().includes('en desarrollo') || trimmed.includes('TODO:') || trimmed.includes('FIXME:')) && !trimmed.startsWith('*')) {
            fileFindings.stubsAndTodos.push({ lineNum, text: trimmed });
        }

        // 4. Handlers vacíos onClick={() => {}}
        if (trimmed.includes('onClick={() => {}}') || trimmed.includes('onClick={() => { }}')) {
            fileFindings.emptyHandlers.push({ lineNum, text: trimmed });
        }
    });

    if (fileFindings.randomSimulations.length > 0 || fileFindings.mockData.length > 0 || fileFindings.stubsAndTodos.length > 0 || fileFindings.emptyHandlers.length > 0) {
        findings.push(fileFindings);
    }
});

console.log(`================================================================================`);
console.log(`REPORTE DE AUDITORÍA RECURSIVA: MAQUETAS, DATOS HARDCODEADOS Y FUNCIONALIDAD APARENTE`);
console.log(`================================================================================\n`);
console.log(`Archivos analizados: ${allFiles.length}`);
console.log(`Archivos con posibles carencias de lógica real o datos simulados: ${findings.length}\n`);

findings.forEach(f => {
    console.log(`\n📄 [ARCHIVO]: ${f.file}`);
    if (f.mockData.length > 0) {
        console.log(`   🔸 Mock / Dummy Data (${f.mockData.length}):`);
        f.mockData.forEach(m => console.log(`      - L${m.lineNum}: ${m.text}`));
    }
    if (f.randomSimulations.length > 0) {
        console.log(`   ⚠️  Simulaciones con Math.random() (${f.randomSimulations.length}):`);
        f.randomSimulations.forEach(m => console.log(`      - L${m.lineNum}: ${m.text}`));
    }
    if (f.stubsAndTodos.length > 0) {
        console.log(`   🚫 TODOs / Próximamente / Stubs (${f.stubsAndTodos.length}):`);
        f.stubsAndTodos.forEach(m => console.log(`      - L${m.lineNum}: ${m.text}`));
    }
    if (f.emptyHandlers.length > 0) {
        console.log(`   ⚠️  Botones con Handlers Vacíos (${f.emptyHandlers.length}):`);
        f.emptyHandlers.forEach(m => console.log(`      - L${m.lineNum}: ${m.text}`));
    }
});
