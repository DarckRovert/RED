const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Open APK as a ZIP file by reading end of central directory
const apkPath = path.resolve('android/app/build/outputs/apk/release/app-release.apk');
const fd = fs.openSync(apkPath, 'r');
const stat = fs.statSync(apkPath);
const bufferSize = Math.min(stat.size, 65536);
const buffer = Buffer.alloc(bufferSize);
fs.readSync(fd, buffer, 0, bufferSize, stat.size - bufferSize);

// Find End of Central Directory record (0x06054b50)
let eocdOffset = -1;
for (let i = bufferSize - 22; i >= 0; i--) {
  if (buffer.readUInt32LE(i) === 0x06054b50) {
    eocdOffset = stat.size - bufferSize + i;
    break;
  }
}

if (eocdOffset === -1) {
  console.error('Could not find EOCD');
  process.exit(1);
}

const eocdBuffer = Buffer.alloc(22);
fs.readSync(fd, eocdBuffer, 0, 22, eocdOffset);
const totalEntries = eocdBuffer.readUInt16LE(10);
const cdSize = eocdBuffer.readUInt32LE(12);
const cdOffset = eocdBuffer.readUInt32LE(16);

const cdBuffer = Buffer.alloc(cdSize);
fs.readSync(fd, cdBuffer, 0, cdSize, cdOffset);

const entries = [];
let offset = 0;
while (offset < cdSize) {
  if (cdBuffer.readUInt32LE(offset) !== 0x02014b50) break;
  const compMethod = cdBuffer.readUInt16LE(offset + 10);
  const compressedSize = cdBuffer.readUInt32LE(offset + 20);
  const uncompressedSize = cdBuffer.readUInt32LE(offset + 24);
  const nameLen = cdBuffer.readUInt16LE(offset + 28);
  const extraLen = cdBuffer.readUInt16LE(offset + 30);
  const commentLen = cdBuffer.readUInt16LE(offset + 32);
  const name = cdBuffer.toString('utf8', offset + 46, offset + 46 + nameLen);

  entries.push({
    name,
    topFolder: name.split('/')[0],
    compressedSize,
    uncompressedSize,
  });

  offset += 46 + nameLen + extraLen + commentLen;
}

fs.closeSync(fd);

// Aggregate by top-level folder
const folderStats = {};
for (const e of entries) {
  if (!folderStats[e.topFolder]) {
    folderStats[e.topFolder] = { count: 0, compressed: 0, uncompressed: 0 };
  }
  folderStats[e.topFolder].count++;
  folderStats[e.topFolder].compressed += e.compressedSize;
  folderStats[e.topFolder].uncompressed += e.uncompressedSize;
}

console.log('══════════════════════════════════════════════════════════════');
console.log('         ANÁLISIS FORENSE DE TAMAÑO DEL APK (RELEASE)         ');
console.log('══════════════════════════════════════════════════════════════');
console.log(`Tamaño total del APK: ${(stat.size / 1024 / 1024).toFixed(2)} MB (${entries.length} archivos)\n`);

console.log('📁 DISTRIBUCIÓN POR CARPETA:');
const sortedFolders = Object.entries(folderStats).sort((a, b) => b[1].compressed - a[1].compressed);
for (const [folder, data] of sortedFolders) {
  console.log(`  - ${folder.padEnd(20)}: ${(data.compressed / 1024 / 1024).toFixed(2).padStart(6)} MB comprimido (${(data.uncompressed / 1024 / 1024).toFixed(2).padStart(6)} MB real, ${data.count} archivos)`);
}

console.log('\n📄 TOP 20 ARCHIVOS MÁS GRANDES DENTRO DEL APK:');
const sortedFiles = entries.sort((a, b) => b.compressedSize - a.compressedSize).slice(0, 20);
for (const f of sortedFiles) {
  console.log(`  - ${(f.compressedSize / 1024 / 1024).toFixed(2).padStart(6)} MB : ${f.name} (real: ${(f.uncompressedSize / 1024 / 1024).toFixed(2)} MB)`);
}
console.log('══════════════════════════════════════════════════════════════');
