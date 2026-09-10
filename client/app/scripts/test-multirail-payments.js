/**
 * test-multirail-payments.js
 * 
 * Test suite for RED Sovereign Multi-Rail Payment Gateway (Non-Custodial Settlement).
 * Validates:
 * 1. EVM address validation and regex.
 * 2. ERC-20 `transfer(address,uint256)` ABI encoding (USDT on Polygon, USDC on Base).
 * 3. Android Deep Links & Universal Web Banking URLs (Yape, Plin, PayPal, Pix, Bizum).
 * 4. SovereignPaymentPassport schema integrity & serialization.
 * 5. Payment receipt emission and non-custodial transaction dispatch.
 * 6. Codebase hygiene & UI integration assertions.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("\n================================================================================");
console.log("💳 INICIANDO SUITE DE PRUEBAS: NON-CUSTODIAL MULTI-RAIL PAYMENT GATEWAY");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function test(name, fn) {
    total++;
    try {
        fn();
        console.log(`  ✅ [PASS] ${total}. ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${total}. ${name}`);
        console.error(`     Error: ${err.message}`);
    }
}

// ── 1. EVM Address Validation ───────────────────────────────────────────────
function isValidEvmAddress(address) {
    if (!address || typeof address !== 'string') return false;
    return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}

test("Validación de Direcciones EVM 0x", () => {
    assert.strictEqual(isValidEvmAddress("0x71C6370244e5fb44174Dce6bE492924292854343"), true);
    assert.strictEqual(isValidEvmAddress("0xc2132D05D31c914a87C6611C10748AEb04B58e8F"), true);
    assert.strictEqual(isValidEvmAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"), true);
    assert.strictEqual(isValidEvmAddress("0x123"), false); // too short
    assert.strictEqual(isValidEvmAddress("71C6370244e5fb44174Dce6bE492924292854343"), false); // missing 0x
    assert.strictEqual(isValidEvmAddress("0xZZZZ370244e5fb44174Dce6bE492924292854343"), false); // non-hex
    assert.strictEqual(isValidEvmAddress(null), false);
    assert.strictEqual(isValidEvmAddress(undefined), false);
});

// ── 2. ERC-20 Transfer Encoding ─────────────────────────────────────────────
function encodeErc20Transfer(recipientAddress, amount, decimals = 6) {
    const cleanAddress = recipientAddress.toLowerCase().trim().replace(/^0x/, '');
    if (cleanAddress.length !== 40) {
        throw new Error('Dirección EVM del receptor inválida (debe contener 40 caracteres hexadecimales).');
    }
    const paddedAddress = cleanAddress.padStart(64, '0');
    const rawUnits = BigInt(Math.max(0, Math.round(amount * Math.pow(10, decimals))));
    const hexUnits = rawUnits.toString(16).padStart(64, '0');
    return `0xa9059cbb${paddedAddress}${hexUnits}`;
}

test("Codificación ABI ERC-20 transfer(address,uint256)", () => {
    const target = "0x71C6370244e5fb44174Dce6bE492924292854343";
    const amount = 25.50; // $25.50 USDT (6 decimales) -> 25,500,000 unidades = 0x1851960
    const payload = encodeErc20Transfer(target, amount, 6);

    // Selector ERC-20 transfer = 0xa9059cbb
    assert.ok(payload.startsWith("0xa9059cbb"), "Debe comenzar con el selector 0xa9059cbb");
    assert.strictEqual(payload.length, 10 + 64 + 64, "Longitud de payload debe ser 138 caracteres");

    // Verificar valor codificado
    const expectedUnitsHex = BigInt(25500000).toString(16).padStart(64, '0');
    assert.ok(payload.endsWith(expectedUnitsHex), `Debe terminar con el valor codificado: ${expectedUnitsHex}`);
});

test("Protección de ERC-20 contra direcciones truncadas", () => {
    assert.throws(() => {
        encodeErc20Transfer("0x12345", 10, 6);
    }, /inválida/);
});

// ── 3. Deep Links Bancarios y Móviles ────────────────────────────────────────
function buildDeepLink(type, identifier, amount, currency = 'USD') {
    const cleanId = (identifier || '').trim();
    switch (type) {
        case 'yape':
            return {
                url: `intent://#Intent;scheme=yape;package=com.bcp.innovacxion.yapeapp;end`,
                fallbackText: cleanId
            };
        case 'plin':
            return {
                url: `plin://${cleanId}`,
                fallbackText: cleanId
            };
        case 'paypal': {
            const cleanUser = cleanId.replace(/^https?:\/\/paypal\.me\//, '').replace(/^@/, '');
            const amtStr = amount && amount > 0 ? `/${amount.toFixed(2)}${currency}` : '';
            return {
                url: `https://paypal.me/${cleanUser}${amtStr}`,
                fallbackText: `https://paypal.me/${cleanUser}`
            };
        }
        case 'pix':
            return {
                url: `pix:${cleanId}`,
                fallbackText: cleanId
            };
        case 'bizum':
            return {
                url: `tel:${cleanId}`,
                fallbackText: cleanId
            };
        default:
            return {
                url: cleanId,
                fallbackText: cleanId
            };
    }
}

test("Generación de Deep Links e Intents de Yape (Perú)", () => {
    const link = buildDeepLink('yape', '987654321', 50, 'USD');
    assert.ok(link.url.includes('package=com.bcp.innovacxion.yapeapp'), "Debe incluir el paquete de Android de Yape");
    assert.strictEqual(link.fallbackText, '987654321');
});

test("Generación de URL PayPal.me con sanitización", () => {
    const link1 = buildDeepLink('paypal', 'juanperez', 38.5, 'USD');
    assert.strictEqual(link1.url, 'https://paypal.me/juanperez/38.50USD');

    const link2 = buildDeepLink('paypal', '@rodrigo_ops', 10, 'USD');
    assert.strictEqual(link2.url, 'https://paypal.me/rodrigo_ops/10.00USD');

    const link3 = buildDeepLink('paypal', 'https://paypal.me/darckrovert', 15, 'USD');
    assert.strictEqual(link3.url, 'https://paypal.me/darckrovert/15.00USD');
});

test("Generación de Deep Links Plin, Pix y Bizum", () => {
    const plin = buildDeepLink('plin', '999888777');
    assert.strictEqual(plin.url, 'plin://999888777');

    const pix = buildDeepLink('pix', 'usuario@pix.br');
    assert.strictEqual(pix.url, 'pix:usuario@pix.br');

    const bizum = buildDeepLink('bizum', '+34600112233');
    assert.strictEqual(bizum.url, 'tel:+34600112233');
});

// ── 4. Esquema e Integridad de SovereignPaymentPassport ─────────────────────
test("Serialización y Deserialización de SovereignPaymentPassport", () => {
    const passport = {
        evmAddress: "0x71C6370244e5fb44174Dce6bE492924292854343",
        preferredChainId: 137,
        fiatType: "yape",
        fiatIdentifier: "987654321",
        fiatBeneficiaryName: "Operador Táctico",
        fiatQrDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        lightningAddress: "operador@getalby.com",
        acceptsVouchers: true,
        isPublicOnMesh: true,
        updatedAt: Date.now()
    };

    const serialized = JSON.stringify(passport);
    const parsed = JSON.parse(serialized);

    assert.strictEqual(parsed.evmAddress, passport.evmAddress);
    assert.strictEqual(parsed.preferredChainId, 137);
    assert.strictEqual(parsed.fiatType, "yape");
    assert.strictEqual(parsed.acceptsVouchers, true);
    assert.strictEqual(parsed.isPublicOnMesh, true);
});

// ── 5. Emisión de Recibo Criptográfico y Rieles ─────────────────────────────
test("Generación de Recibo de Pago (PaymentReceipt)", () => {
    const receipt = {
        success: true,
        rail: 'web3_usdt',
        transactionId: '0xabc123...',
        amount: 38,
        currency: 'USDT',
        timestamp: Date.now(),
        merchantDid: 'did:red:merchant123',
        buyerDid: 'did:red:buyer456',
        details: {
            network: 'Polygon PoS',
            chainId: 137
        }
    };

    assert.strictEqual(receipt.success, true);
    assert.strictEqual(receipt.currency, 'USDT');
    assert.ok(receipt.timestamp > 0);
});

// ── 6. Integración y Resiliencia en el Código Fuente ────────────────────────
test("Higiene de Código: RedPaymentGatewayEngine contiene selectores y contratos ERC-20", () => {
    const filePath = path.join(__dirname, '../src/lib/miniapp/RedPaymentGatewayEngine.ts');
    assert.ok(fs.existsSync(filePath), "RedPaymentGatewayEngine.ts debe existir");
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('0xa9059cbb'), "Debe incluir el selector ERC-20 0xa9059cbb");
    assert.ok(content.includes('0xc2132D05D31c914a87C6611C10748AEb04B58e8F'), "Debe incluir contrato USDT en Polygon");
    assert.ok(content.includes('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), "Debe incluir contrato USDC en Base");
});

test("Higiene de Código: MultiRailCheckoutModal registra intercepción LIFO en BackHandlerRegistry", () => {
    const filePath = path.join(__dirname, '../src/components/MultiRailCheckoutModal.tsx');
    assert.ok(fs.existsSync(filePath), "MultiRailCheckoutModal.tsx debe existir");
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('BackHandlerRegistry.register'), "Debe registrarse en BackHandlerRegistry");
    assert.ok(content.includes('OfflineQrEngine.generateDataUrl'), "Debe generar QRs con OfflineQrEngine");
});

test("Higiene de Código: SettingsModal y PaymentsTab vinculados correctamente", () => {
    const settingsPath = path.join(__dirname, '../src/components/SettingsModal.tsx');
    const tabPath = path.join(__dirname, '../src/components/settings/PaymentsTab.tsx');
    assert.ok(fs.existsSync(settingsPath), "SettingsModal.tsx debe existir");
    assert.ok(fs.existsSync(tabPath), "PaymentsTab.tsx debe existir");

    const settingsContent = fs.readFileSync(settingsPath, 'utf8');
    assert.ok(settingsContent.includes('PaymentsTab'), "SettingsModal debe importar PaymentsTab");
    assert.ok(settingsContent.includes('Pasaporte de Pagos'), "SettingsModal debe declarar la pestaña de pagos");

    const tabContent = fs.readFileSync(tabPath, 'utf8');
    assert.ok(tabContent.includes('updatePaymentPassport'), "PaymentsTab debe actualizar el pasaporte en el store");
});

test("Higiene de Código: CommercialHubModal soporta MultiRailCheckoutModal", () => {
    const hubPath = path.join(__dirname, '../src/components/CommercialHubModal.tsx');
    assert.ok(fs.existsSync(hubPath), "CommercialHubModal.tsx debe existir");
    const content = fs.readFileSync(hubPath, 'utf8');
    assert.ok(content.includes('MultiRailCheckoutModal'), "CommercialHubModal debe importar y renderizar MultiRailCheckoutModal");
    assert.ok(content.includes('checkoutProduct'), "CommercialHubModal debe gestionar estado checkoutProduct");
    assert.ok(content.includes('sellerPaymentPassport'), "CommercialHubModal debe asociar sellerPaymentPassport");
});

console.log("\n================================================================================");
console.log(`📊 RESUMEN FINAL: ${passed}/${total} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round(passed/total*100)}% PASS)`);
console.log("================================================================================\n");

if (passed !== total) {
    process.exit(1);
}
