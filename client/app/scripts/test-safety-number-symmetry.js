const crypto = require('crypto');
const assert = require('assert');

function normalizeIdentity(id) {
  if (!id) return '';
  let clean = id.trim();
  if (clean.startsWith('did:red:')) {
    clean = clean.slice(8).trim();
  }
  if (/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(clean)) {
    return clean.toLowerCase();
  }
  if (clean.includes(':')) {
    const parts = clean.split(':');
    if (parts[0].length >= 16) {
      return parts[0].trim().toLowerCase();
    }
  }
  return clean.toLowerCase();
}

async function computeSafetyNumber(myKey, peerKey) {
  const cleanMyKey = normalizeIdentity(myKey);
  const cleanPeerKey = normalizeIdentity(peerKey);
  if (!cleanMyKey || !cleanPeerKey) return [];

  const sorted = [cleanMyKey, cleanPeerKey].sort();
  const combined = `${sorted[0]}:${sorted[1]}:RED_SAFETY_V42`;

  const hash = crypto.createHash('sha256').update(combined).digest('hex');

  const blocks = [];
  for (let i = 0; i < 12; i++) {
    const start = (i * 4) % (hash.length - 4);
    const chunkHex = hash.slice(start, start + 4);
    const val = parseInt(chunkHex, 16);
    const num = Math.floor((val / 65536) * 100000);
    blocks.push(String(num).padStart(5, '0'));
  }
  return blocks;
}

async function runTest() {
  console.log('[TEST] Checking Safety Number Symmetry...');
  const aliceId = 'did:red:14a2b3c4d5e6f7a8b9c0d1e2f3a4b5c614a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6';
  const bobId = '98f7e6d5c4b3a2f1e0d9c8b7a6f5e4d398f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3';

  const aliceBlocks = await computeSafetyNumber(aliceId, bobId);
  const bobBlocks = await computeSafetyNumber(bobId, aliceId);

  console.log('Alice Safety Number:', aliceBlocks.join(' '));
  console.log('Bob Safety Number:  ', bobBlocks.join(' '));

  assert.strictEqual(aliceBlocks.length, 12);
  assert.strictEqual(bobBlocks.length, 12);
  assert.strictEqual(aliceBlocks.join(' '), bobBlocks.join(' '), 'Safety Numbers must be 100% identical!');
  console.log('[SUCCESS] Safety numbers are 100% identical and symmetric!');
}

runTest();
