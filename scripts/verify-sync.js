const fs = require('fs');

const files = [
  'Cargo.toml',
  'core/Cargo.toml',
  'blockchain/Cargo.toml',
  'node/Cargo.toml',
  'red_mobile/Cargo.toml',
  'client/app/package.json'
];

console.log('=== VERIFICACIÓN DE VERSIONES ===');
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const match = content.match(/version\s*=\s*"([^"]+)"/) || content.match(/"version":\s*"([^"]+)"/);
  console.log(f.padEnd(28), '->', match ? match[1] : 'NOT FOUND');
}
