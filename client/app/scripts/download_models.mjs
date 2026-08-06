import fs from 'fs';
import path from 'path';
import https from 'https';

const MODELS = [
    {
        name: 'toxic-bert',
        repo: 'Xenova/toxic-bert',
        files: ['onnx/model_quantized.onnx', 'config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json']
    },
    {
        name: 'all-MiniLM-L6-v2',
        repo: 'Xenova/all-MiniLM-L6-v2',
        files: ['onnx/model_quantized.onnx', 'config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json']
    },
    {
        name: 'LaMini-Flan-T5-77M',
        repo: 'Xenova/LaMini-Flan-T5-77M',
        files: ['onnx/decoder_model_merged_quantized.onnx', 'onnx/encoder_model_quantized.onnx', 'config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json']
    }
];

const BASE_DIR = path.resolve('public/models');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
            console.log(`[SKIP] Already exists (${(fs.statSync(dest).size / 1024).toFixed(1)} KB): ${dest}`);
            resolve();
            return;
        }

        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        console.log(`[DOWNLOADING] ${url}`);
        const file = fs.createWriteStream(dest);

        const request = (targetUrl) => {
            https.get(targetUrl, (response) => {
                if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                    let nextUrl = response.headers.location;
                    if (nextUrl.startsWith('/')) {
                        nextUrl = `https://huggingface.co${nextUrl}`;
                    }
                    request(nextUrl);
                    return;
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to fetch ${targetUrl}: HTTP ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close(() => {
                        console.log(`[SUCCESS] Saved ${dest}`);
                        resolve();
                    });
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });
        };

        request(url);
    });
}

async function main() {
    console.log('🚀 Starting Offline ONNX Model Downloader for RED v24.0...');

    for (const model of MODELS) {
        const modelDir = path.join(BASE_DIR, model.name);
        console.log(`\n📦 Processing model: ${model.name} (${model.repo})`);

        for (const fileRel of model.files) {
            const url = `https://huggingface.co/${model.repo}/resolve/main/${fileRel}`;
            const destName = fileRel.includes('/') ? path.basename(fileRel) : fileRel;
            const destPath = path.join(modelDir, destName);
            
            try {
                await downloadFile(url, destPath);
            } catch (err) {
                console.error(`❌ Failed to download ${fileRel} for ${model.name}:`, err.message);
            }
        }
    }

    console.log('\n====================================');
    console.log('✅ ALL OFFLINE ONNX MODELS DOWNLOADED SUCCESSFULLY!');
    console.log('====================================');
}

main().catch(console.error);
