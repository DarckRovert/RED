const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '../client/app/src/components/showcase/catalogData.ts');
const catalogContent = fs.readFileSync(catalogPath, 'utf8');

const regex = /id:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"]/g;
let m;
let i = 1;
while ((m = regex.exec(catalogContent)) !== null) {
    console.log(`${i++}. id: "${m[1]}" -> name: "${m[2]}"`);
}
