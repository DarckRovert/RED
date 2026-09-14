#!/usr/bin/env node
/**
 * setup_git_hooks.js — Configura automáticamente core.hooksPath en .githooks
 */
'use strict';
const { execSync } = require('child_process');
const path = require('path');

try {
    const root = path.resolve(__dirname, '..', '..');
    execSync('git config core.hooksPath .githooks', { cwd: root, stdio: 'ignore' });
    console.log('🔒  Git hooks configurados automáticamente (.githooks)');
} catch {
    // Silencioso en entornos sin binario de git o CI desacoplado
}
