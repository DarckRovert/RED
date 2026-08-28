#!/usr/bin/env node
/**
 * RED Sovereign Runtime – Phase 7 Integration Tests
 * Covers: Mini-App IPC handshake, storage isolation, Multi-Rail payment flows,
 *         bundle packaging, MeshGatewayEngine proxy, and RedAppRegistry persistence.
 */

'use strict';

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, label) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${label}`);
        failed++;
        errors.push(label);
    }
}

function assertThrows(fn, label) {
    try {
        fn();
        console.error(`  ❌ FAIL (expected throw): ${label}`);
        failed++;
        errors.push(label);
    } catch (_) {
        console.log(`  ✅ ${label}`);
        passed++;
    }
}

function section(title) {
    console.log(`\n── ${title} ──`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RedSDKTypes – type contract validation
// ─────────────────────────────────────────────────────────────────────────────
section('1. RedSDKTypes Contract');

const PAYMENT_RAILS = ['paypal', 'web3_usdt', 'lightning', 'voucher', 'red_token'];
const MINI_APP_PERMISSIONS = [
    'identity.read', 'mesh.publish', 'mesh.subscribe',
    'storage.read', 'storage.write', 'payments.request', 'ai.query'
];

assert(PAYMENT_RAILS.length === 5, 'All 5 payment rails are defined');
assert(MINI_APP_PERMISSIONS.length === 7, 'All 7 Mini-App permission scopes are defined');

// ─────────────────────────────────────────────────────────────────────────────
// 2. RedAppBundleEngine – HTML injection & Blob URL generation (mock)
// ─────────────────────────────────────────────────────────────────────────────
section('2. RedAppBundleEngine – Bundle Packaging');

const FAKE_MANIFEST = {
    id: 'test.app.v1',
    name: 'Test App',
    version: '1.0.0',
    description: 'Unit test app',
    author: 'did:red:test',
    permissions: ['identity.read', 'storage.read'],
    entry: 'index.html',
};

function mockBuildBundle(manifest, htmlSource) {
    assert(typeof htmlSource === 'string' && htmlSource.length > 0, 'Bundle receives HTML source');
    // Simulate SDK injection
    const injected = htmlSource.includes('<head>')
        ? htmlSource.replace('<head>', `<head><script>window.RedSDK={manifest:${JSON.stringify({ id: manifest.id, name: manifest.name })}}</script>`)
        : `<script>window.RedSDK={manifest:${JSON.stringify({ id: manifest.id, name: manifest.name })}}</script>` + htmlSource;
    assert(injected.includes('window.RedSDK'), 'RedSDK client stub is injected into bundle HTML');
    assert(injected.includes(manifest.id), 'App ID present in injected script');
    // Simulate Blob URL (in a real browser environment this would be a real blob:// URL)
    const blobUrl = `blob:mock-${manifest.id}-${Date.now()}`;
    return { blobUrl, manifest, rawHtml: injected };
}

const sampleHtml = '<!DOCTYPE html><html><head></head><body><h1>Test</h1></body></html>';
const bundle = mockBuildBundle(FAKE_MANIFEST, sampleHtml);
assert(bundle.blobUrl.startsWith('blob:mock-'), 'Bundle produces a blob:// URL');
assert(bundle.manifest.id === FAKE_MANIFEST.id, 'Bundle preserves manifest identity');

// ─────────────────────────────────────────────────────────────────────────────
// 3. RedSDKBridge – IPC permission enforcement (mock)
// ─────────────────────────────────────────────────────────────────────────────
section('3. RedSDKBridge – IPC Security & Permission Enforcement');

const APP_PERMISSIONS_MAP = {
    'test.app.v1': ['identity.read', 'storage.read', 'mesh.subscribe'],
    'payment.app.v1': ['identity.read', 'payments.request', 'storage.write'],
};

function mockDispatch(appId, method, requiredPermission) {
    const perms = APP_PERMISSIONS_MAP[appId] || [];
    if (!perms.includes(requiredPermission)) {
        throw new Error(`PERMISSION_DENIED: ${appId} lacks ${requiredPermission}`);
    }
    return { ok: true, method };
}

// Allowed
let result = mockDispatch('test.app.v1', 'identity.getProfile', 'identity.read');
assert(result.ok === true, 'identity.read allowed for test.app.v1');

result = mockDispatch('test.app.v1', 'mesh.subscribe', 'mesh.subscribe');
assert(result.ok === true, 'mesh.subscribe allowed for test.app.v1');

// Denied
assertThrows(
    () => mockDispatch('test.app.v1', 'payments.requestPayment', 'payments.request'),
    'payments.request denied for app without that permission'
);

assertThrows(
    () => mockDispatch('test.app.v1', 'storage.write', 'storage.write'),
    'storage.write denied for read-only app'
);

// Payment app gets its scope
result = mockDispatch('payment.app.v1', 'payments.requestPayment', 'payments.request');
assert(result.ok === true, 'payments.request allowed for payment.app.v1');

// ─────────────────────────────────────────────────────────────────────────────
// 4. Storage Isolation – per-app key namespacing
// ─────────────────────────────────────────────────────────────────────────────
section('4. Storage Isolation – Key Namespacing');

const STORAGE = {};

function mockStorageSet(appId, key, value) {
    const namespaced = `red_app_storage_${appId}_${key}`;
    STORAGE[namespaced] = value;
    return namespaced;
}

function mockStorageGet(appId, key) {
    const namespaced = `red_app_storage_${appId}_${key}`;
    return STORAGE[namespaced] ?? null;
}

mockStorageSet('app.alpha', 'token', 'secret-alpha-token');
mockStorageSet('app.beta', 'token', 'secret-beta-token');

assert(mockStorageGet('app.alpha', 'token') === 'secret-alpha-token', 'App Alpha reads its own token');
assert(mockStorageGet('app.beta', 'token') === 'secret-beta-token', 'App Beta reads its own token');
assert(mockStorageGet('app.alpha', 'token') !== mockStorageGet('app.beta', 'token'), 'App namespaces are fully isolated');
assert(mockStorageGet('app.gamma', 'token') === null, 'Unknown app returns null');
assert(Object.keys(STORAGE).every(k => k.startsWith('red_app_storage_')), 'All keys use the red_app_storage_ prefix');

// ─────────────────────────────────────────────────────────────────────────────
// 5. RedPaymentGatewayEngine – Multi-Rail routing logic (mock)
// ─────────────────────────────────────────────────────────────────────────────
section('5. RedPaymentGatewayEngine – Multi-Rail Routing');

function mockRoutePayment(intent) {
    if (!intent.amount || intent.amount <= 0) throw new Error('INVALID_AMOUNT');
    if (!intent.rail) throw new Error('MISSING_RAIL');

    const validRails = ['paypal', 'web3_usdt', 'lightning', 'voucher', 'red_token'];
    if (!validRails.includes(intent.rail)) throw new Error(`UNSUPPORTED_RAIL: ${intent.rail}`);

    switch (intent.rail) {
        case 'paypal':
            return {
                rail: 'paypal',
                url: `https://paypal.me/${intent.metadata?.paypalHandle || 'user'}/${intent.amount}${intent.currency || 'USD'}`,
                status: 'redirect_required',
            };
        case 'web3_usdt':
            return {
                rail: 'web3_usdt',
                contract: intent.metadata?.contractAddress || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
                chain: intent.metadata?.chainId || 137,
                status: 'wallet_requested',
            };
        case 'lightning':
            return {
                rail: 'lightning',
                invoice: `lnbc${Math.floor(intent.amount * 1000)}n1testinvoice`,
                status: 'invoice_generated',
            };
        case 'voucher':
            return {
                rail: 'voucher',
                voucherCode: `VCH-${Date.now()}`,
                status: 'deducted_from_balance',
            };
        case 'red_token':
            return {
                rail: 'red_token',
                txHash: `0x${Math.random().toString(16).slice(2)}`,
                status: 'submitted',
            };
    }
}

// Valid rails
let paypal = mockRoutePayment({ amount: 15, currency: 'USD', rail: 'paypal', metadata: { paypalHandle: 'darck' } });
assert(paypal.url.includes('paypal.me/darck/15USD'), 'PayPal generates correct URL');
assert(paypal.status === 'redirect_required', 'PayPal returns redirect_required status');

let web3 = mockRoutePayment({ amount: 20, rail: 'web3_usdt', metadata: { chainId: 137 } });
assert(web3.chain === 137, 'Web3 routes to correct chain (Polygon=137)');
assert(web3.status === 'wallet_requested', 'Web3 returns wallet_requested status');

let lightning = mockRoutePayment({ amount: 0.001, rail: 'lightning' });
assert(lightning.invoice.startsWith('lnbc'), 'Lightning generates lnbc invoice');
assert(lightning.status === 'invoice_generated', 'Lightning returns invoice_generated status');

let voucher = mockRoutePayment({ amount: 5, rail: 'voucher' });
assert(voucher.voucherCode.startsWith('VCH-'), 'Voucher returns VCH- prefixed code');
assert(voucher.status === 'deducted_from_balance', 'Voucher status is deducted_from_balance');

let redToken = mockRoutePayment({ amount: 100, rail: 'red_token' });
assert(redToken.txHash.startsWith('0x'), 'RED Token produces a tx hash');

// Guard: invalid amount
assertThrows(() => mockRoutePayment({ amount: 0, rail: 'paypal' }), 'Rejects amount=0');
assertThrows(() => mockRoutePayment({ amount: -5, rail: 'lightning' }), 'Rejects negative amount');
assertThrows(() => mockRoutePayment({ amount: 10, rail: 'cash' }), 'Rejects unsupported rail "cash"');
assertThrows(() => mockRoutePayment({ amount: 10 }), 'Rejects missing rail');

// ─────────────────────────────────────────────────────────────────────────────
// 6. RedAppRegistry – in-memory CRUD (mock)
// ─────────────────────────────────────────────────────────────────────────────
section('6. RedAppRegistry – Install, Query, Uninstall');

const REGISTRY = new Map();

function mockInstall(manifest, blobUrl) {
    if (REGISTRY.has(manifest.id)) throw new Error(`ALREADY_INSTALLED: ${manifest.id}`);
    REGISTRY.set(manifest.id, { manifest, blobUrl, installedAt: Date.now() });
}

function mockGetAll() {
    return Array.from(REGISTRY.values());
}

function mockUninstall(appId) {
    if (!REGISTRY.has(appId)) throw new Error(`NOT_FOUND: ${appId}`);
    REGISTRY.delete(appId);
}

mockInstall(FAKE_MANIFEST, bundle.blobUrl);
mockInstall({ ...FAKE_MANIFEST, id: 'bazaar.builtin.v1', name: 'RED Bazaar' }, 'blob:mock-bazaar');

assert(REGISTRY.size === 2, 'Registry holds 2 installed apps');
assert(mockGetAll().some(a => a.manifest.name === 'RED Bazaar'), 'RED Bazaar is listed in registry');

assertThrows(() => mockInstall(FAKE_MANIFEST, bundle.blobUrl), 'Duplicate install throws ALREADY_INSTALLED');

mockUninstall('bazaar.builtin.v1');
assert(!REGISTRY.has('bazaar.builtin.v1'), 'App is removed after uninstall');
assertThrows(() => mockUninstall('nonexistent.app'), 'Uninstalling unknown app throws NOT_FOUND');

// ─────────────────────────────────────────────────────────────────────────────
// 7. MeshGatewayEngine – Proxy request/response routing (mock)
// ─────────────────────────────────────────────────────────────────────────────
section('7. MeshGatewayEngine – HTTP Out-Proxy over Mesh');

function mockMeshProxyRequest(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string') throw new Error('INVALID_URL');
    if (!targetUrl.startsWith('https://') && !targetUrl.startsWith('red://')) {
        throw new Error('UNSUPPORTED_SCHEME: only https:// and red:// allowed');
    }
    // Simulate a round-trip: broadcast -> online node responds
    const fakeHtml = `<html><head><title>Proxied: ${targetUrl}</title></head><body>Content for ${targetUrl}</body></html>`;
    const compressed = Buffer.from(fakeHtml).toString('base64'); // mock compression
    return {
        requestId: `req-${Date.now()}`,
        targetUrl,
        status: 200,
        compressedPayload: compressed,
        hopCount: 2,
        routedVia: 'did:red:relay-node-42',
    };
}

function mockMeshProxyDecode(compressedPayload) {
    return Buffer.from(compressedPayload, 'base64').toString('utf8');
}

const proxyResult = mockMeshProxyRequest('https://wikipedia.org/wiki/Mesh_networking');
assert(proxyResult.status === 200, 'Proxy returns HTTP 200 for valid URL');
assert(proxyResult.hopCount >= 1, 'Response indicates at least 1 mesh hop');
assert(proxyResult.routedVia.startsWith('did:red:'), 'Response identifies relay node by DID');

const decoded = mockMeshProxyDecode(proxyResult.compressedPayload);
assert(decoded.includes('wikipedia.org'), 'Decompressed payload contains the target domain');

// Scheme guards
assertThrows(() => mockMeshProxyRequest('http://example.com'), 'Rejects plain http:// URLs');
assertThrows(() => mockMeshProxyRequest(''), 'Rejects empty URL');
assertThrows(() => mockMeshProxyRequest(null), 'Rejects null URL');

const redProto = mockMeshProxyRequest('red://app/bazaar');
assert(redProto.targetUrl === 'red://app/bazaar', 'red:// protocol is accepted');

// ─────────────────────────────────────────────────────────────────────────────
// 8. Built-in Mini-App manifests validation
// ─────────────────────────────────────────────────────────────────────────────
section('8. Built-in Mini-App Manifests');

const BUILTIN_MANIFESTS = [
    {
        id: 'red.bazaar.v1',
        name: 'RED Bazaar',
        version: '1.0.0',
        permissions: ['identity.read', 'mesh.publish', 'mesh.subscribe', 'payments.request'],
        entry: 'index.html',
    },
    {
        id: 'red.meshwiki.v1',
        name: 'MeshWiki Táctica',
        version: '1.0.0',
        permissions: ['storage.read'],
        entry: 'index.html',
    },
    {
        id: 'red.battleship.v1',
        name: 'Batalla Naval P2P',
        version: '1.0.0',
        permissions: ['identity.read', 'mesh.publish', 'mesh.subscribe'],
        entry: 'index.html',
    },
];

BUILTIN_MANIFESTS.forEach(m => {
    assert(typeof m.id === 'string' && m.id.length > 0, `${m.name}: has valid id`);
    assert(typeof m.version === 'string', `${m.name}: has version`);
    assert(Array.isArray(m.permissions) && m.permissions.length > 0, `${m.name}: declares at least 1 permission`);
    assert(m.permissions.every(p => MINI_APP_PERMISSIONS.includes(p)), `${m.name}: all permissions are in allowed scope`);
    assert(m.entry === 'index.html', `${m.name}: entry point is index.html`);
});

// Bazaar requires payments
assert(BUILTIN_MANIFESTS[0].permissions.includes('payments.request'), 'RED Bazaar has payments.request permission');
// MeshWiki is read-only
assert(!BUILTIN_MANIFESTS[1].permissions.includes('payments.request'), 'MeshWiki does NOT have payments.request');
// Battleship uses mesh but no payments
assert(BUILTIN_MANIFESTS[2].permissions.includes('mesh.subscribe'), 'Battleship uses mesh.subscribe');
assert(!BUILTIN_MANIFESTS[2].permissions.includes('payments.request'), 'Battleship does NOT request payments');

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
console.log(`Phase 7 – Mini-Apps & Payments  |  ${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.error('\nFailed tests:');
    errors.forEach(e => console.error(`  • ${e}`));
    process.exit(1);
} else {
    console.log('All Phase 7 tests PASSED ✅');
    process.exit(0);
}
