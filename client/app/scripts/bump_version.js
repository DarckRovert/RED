#!/usr/bin/env node
/**
 * bump_version.js — Delegador Canónico al Script Raíz de Gobernanza SSOT de RED
 *
 * Delega la ejecución directamente a scripts/bump_version.js para garantizar
 * 100% de paridad SSOT (Single Source of Truth) en los 22 archivos del ecosistema RED.
 *
 * Uso:
 *   node client/app/scripts/bump_version.js <version> [release_name]
 *   npm run bump -- <version> [release_name]
 */

'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const ROOT_BUMP_SCRIPT = path.join(ROOT_DIR, 'scripts', 'bump_version.js');

const result = spawnSync(process.execPath, [ROOT_BUMP_SCRIPT, ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: ROOT_DIR,
});

process.exit(result.status !== null ? result.status : (result.error ? 1 : 0));
