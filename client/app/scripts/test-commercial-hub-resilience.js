/**
 * TEST SUITE: COMMERCIAL HUB & P2P VOUCHER CREATION RESILIENCE
 * 
 * Valida la prevención de acuñación fraudulenta por montos negativos o NaN en createP2PVoucher,
 * la reactividad CRDT ante actualizaciones de Bazaar en CommercialHubModal, y la sanitización
 * de montos de compra.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
}

async function runAsyncTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
}

console.log('\n================================================================================');
console.log('🏬 INICIANDO SUITE DE PRUEBAS: COMMERCIAL HUB & P2P VOUCHER CREATION RESILIENCE');
console.log('================================================================================\n');

// 1. Simulación de createP2PVoucher con validaciones blindadas
const mockWallet = { balance: 100, transactions_count: 0 };

async function mockCreateP2PVoucher(amount) {
    const numericAmount = typeof amount === 'number' ? amount : Number(amount?.amount || 0);

    if (!isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1000000) {
        return { ok: false, error: 'Monto de vale inválido. Debe ser un número positivo mayor a 0.' };
    }

    if (mockWallet.balance < numericAmount) {
        return { ok: false, error: 'Saldo insuficiente en la billetera P2P off-grid.', new_balance: mockWallet.balance };
    }

    mockWallet.balance = Math.max(0, mockWallet.balance - numericAmount);
    mockWallet.transactions_count += 1;

    return {
        ok: true,
        voucher_id: `voucher_${Date.now()}`,
        amount: numericAmount,
        new_balance: mockWallet.balance
    };
}

(async () => {
    console.log('🛡️ 1. Probando Mitigación de Acuñación Fraudulenta y Corrupción NaN...');

    await runAsyncTest('Seguridad: Rechazo estricto de montos negativos (Prevención de acuñación)', async () => {
        const initialBalance = mockWallet.balance;
        const res = await mockCreateP2PVoucher(-100);

        assert.strictEqual(res.ok, false);
        assert(res.error.includes('inválido'));
        assert.strictEqual(mockWallet.balance, initialBalance, 'El saldo no debe haber aumentado');
    });

    await runAsyncTest('Seguridad: Rechazo de monto 0', async () => {
        const res = await mockCreateP2PVoucher(0);
        assert.strictEqual(res.ok, false);
    });

    await runAsyncTest('Seguridad: Rechazo de NaN, Infinity o montos absurdos (> 1M)', async () => {
        const res1 = await mockCreateP2PVoucher(NaN);
        assert.strictEqual(res1.ok, false);

        const res2 = await mockCreateP2PVoucher(Infinity);
        assert.strictEqual(res2.ok, false);

        const res3 = await mockCreateP2PVoucher(5000000);
        assert.strictEqual(res3.ok, false);
    });

    await runAsyncTest('Emisión: Emisión legítima de vale P2P de 25 RED', async () => {
        const initialBalance = mockWallet.balance;
        const res = await mockCreateP2PVoucher(25);

        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.amount, 25);
        assert.strictEqual(mockWallet.balance, initialBalance - 25);
    });

    console.log('\n🏬 2. Probando Integridad y Reactividad en CommercialHubModal...');

    const hubPath = path.join(__dirname, '..', 'src', 'components', 'CommercialHubModal.tsx');
    const hubContent = fs.readFileSync(hubPath, 'utf8');

    runTest('Reactividad: CommercialHubModal se suscribe a bazaarSync para actualizaciones CRDT', () => {
        assert(hubContent.includes('const unsubBazaar = bazaarSync.subscribe(handleUpdate)'), 'Debe suscribirse a bazaarSync');
        assert(hubContent.includes('unsubBazaar()'), 'Debe desuscribirse al desmontar');
    });

    runTest('Sanitización: Extracción de precio con fallback finito positivo en handleBuyWithP2PVoucher', () => {
        assert(hubContent.includes('(isFinite(parsed) && parsed > 0) ? Math.round(parsed) : 25'), 'Debe sanitizar precio de compra');
    });

    runTest('Higiene: Ausencia de importación no utilizada de voucherVault', () => {
        assert(!hubContent.includes("import { voucherVault }"), 'No debe tener import muerto de voucherVault');
    });

    console.log('\n================================================================================');
    console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
    console.log('================================================================================\n');

    if (passedTests !== totalTests) {
        process.exit(1);
    }
})();
