/**
 * copy-wasm.js — RED Build Script
 *
 * Copies the ONNX Runtime WebAssembly files from node_modules to /public/ort-wasm/
 * so the AI model engine runs 100% offline (no CDN dependency).
 *
 * Without this, @xenova/transformers loads .wasm files from:
 *   https://cdn.jsdelivr.net/npm/@xenova/transformers@X.Y.Z/dist/
 * which fails completely when the device is offline — defeating the off-grid purpose.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'node_modules', '@xenova', 'transformers', 'dist');
const DEST_DIR = path.join(__dirname, '..', 'public', 'ort-wasm');

const WASM_FILES = [
    'ort-wasm.wasm',
    'ort-wasm-simd.wasm',
    'ort-wasm-threaded.wasm',
    'ort-wasm-simd-threaded.wasm',
];

if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
    console.log(`[copy-wasm] Created directory: ${DEST_DIR}`);
}

let copied = 0;
let skipped = 0;

for (const file of WASM_FILES) {
    const src = path.join(SRC_DIR, file);
    const dest = path.join(DEST_DIR, file);

    if (!fs.existsSync(src)) {
        console.warn(`[copy-wasm] WARNING: Source file not found: ${src}`);
        continue;
    }

    // Only copy if missing or outdated (saves time on repeated installs)
    const srcStat = fs.statSync(src);
    if (fs.existsSync(dest)) {
        const destStat = fs.statSync(dest);
        if (destStat.size === srcStat.size && destStat.mtime >= srcStat.mtime) {
            skipped++;
            continue;
        }
    }

    fs.copyFileSync(src, dest);
    const sizeMB = (srcStat.size / 1024 / 1024).toFixed(1);
    console.log(`[copy-wasm] ✅ Copied ${file} (${sizeMB} MB)`);
    copied++;
}

// Ensure onnx/ subdirectories exist inside each model in public/models/
// @xenova/transformers constructSession requires .onnx files at path/to/model/onnx/*.onnx
const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');
if (fs.existsSync(MODELS_DIR)) {
    const models = fs.readdirSync(MODELS_DIR);
    for (const m of models) {
        const mPath = path.join(MODELS_DIR, m);
        if (fs.statSync(mPath).isDirectory()) {
            const onnxSubdir = path.join(mPath, 'onnx');
            if (!fs.existsSync(onnxSubdir)) {
                fs.mkdirSync(onnxSubdir, { recursive: true });
            }
            const files = fs.readdirSync(mPath);
            for (const f of files) {
                if (f.endsWith('.onnx')) {
                    const src = path.join(mPath, f);
                    const dest = path.join(onnxSubdir, f);
                    if (!fs.existsSync(dest)) {
                        fs.copyFileSync(src, dest);
                        console.log(`[copy-wasm] 📦 Ensured ONNX subfolder file: ${m}/onnx/${f}`);
                    }
                }
            }
        }
    }
}

// Auto-patch @xenova/transformers src/env.js to prevent TypeError on undefined fs/path in browser bundles
const ENV_JS_PATH = path.join(__dirname, '..', 'node_modules', '@xenova', 'transformers', 'src', 'env.js');
if (fs.existsSync(ENV_JS_PATH)) {
    let envContent = fs.readFileSync(ENV_JS_PATH, 'utf8');
    if (envContent.includes('return Object.keys(obj).length === 0;')) {
        envContent = envContent.replace(
            'return Object.keys(obj).length === 0;',
            'return !obj || typeof obj !== \'object\' || Object.keys(obj).length === 0;'
        );
        fs.writeFileSync(ENV_JS_PATH, envContent, 'utf8');
        console.log('[copy-wasm] 🛠️ Patched @xenova/transformers/src/env.js for browser safety.');
    }
}

if (copied > 0) {
    console.log(`[copy-wasm] Done. ${copied} file(s) copied to /public/ort-wasm/ for offline ONNX inference.`);
} else {
    console.log(`[copy-wasm] All WASM files up-to-date (${skipped} skipped).`);
}
