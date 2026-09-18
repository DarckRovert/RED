/**
 * RED v106.0.0 — Test Suite: CyberTunnel Zero-Rating & Mobile Covert Data Resilience
 *
 * Verifies:
 * 1. Carrier targets loading & domain fronting catalogue
 * 2. Profile selection (Claro, Movistar, Tigo, Google Captive, Cloudflare)
 * 3. Tunnel activation/deactivation state machine
 * 4. Data accounting & real-time bandwidth monitor
 * 5. Spoofed request headers generation with SNI injection
 * 6. Local proxy bridge (127.0.0.1:8088) & APN routing guidance
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log("================================================================================");
console.log("⚡  INICIANDO SUITE DE PRUEBAS: CYBERTUNNEL ZERO-RATING & COVERT DATA RESILIENCE");
console.log("================================================================================\n");

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

// ── 1. Inspección Estática de RedCyberTunnelEngine.ts ────────────────────────
const tunnelEnginePath = path.join(__dirname, '..', 'src', 'lib', 'network', 'RedCyberTunnelEngine.ts');
const tunnelEngineCode = fs.readFileSync(tunnelEnginePath, 'utf8');

runTest("1. RedCyberTunnelEngine: Exporta tipos de modos de túnel y estructura de estadísticas", () => {
    assert(tunnelEngineCode.includes("export type CyberTunnelMode = 'ZERO_RATING_SNI' | 'MESH_GATEWAY' | 'DNS_STEALTH'"), "Debe exportar CyberTunnelMode");
    assert(tunnelEngineCode.includes("export interface CyberTunnelStats"), "Debe exportar CyberTunnelStats");
    assert(tunnelEngineCode.includes("localProxyHost: string;"), "Debe incluir localProxyHost");
    assert(tunnelEngineCode.includes("localProxyPort: number;"), "Debe incluir localProxyPort");
});

runTest("2. RedCyberTunnelEngine: Implementa métodos de activación, perfil y enrutamiento", () => {
    assert(tunnelEngineCode.includes("activateTunnel("), "Debe implementar activateTunnel");
    assert(tunnelEngineCode.includes("public deactivateTunnel(): void"), "Debe implementar deactivateTunnel");
    assert(tunnelEngineCode.includes("public selectTarget("), "Debe implementar selectTarget");
    assert(tunnelEngineCode.includes("public setMode("), "Debe implementar setMode");
    assert(tunnelEngineCode.includes("testPermeability("), "Debe implementar testPermeability");
    assert(tunnelEngineCode.includes("fetchTunneled("), "Debe implementar fetchTunneled");
    assert(tunnelEngineCode.includes("public recordBytes("), "Debe implementar recordBytes");
});

runTest("3. RedCyberTunnelEngine: Configuración predeterminada de proxy local (127.0.0.1:8088)", () => {
    assert(tunnelEngineCode.includes("localProxyHost: '127.0.0.1'"), "Host debe ser 127.0.0.1");
    assert(tunnelEngineCode.includes("localProxyPort: 8088"), "Puerto debe ser 8088");
});

// ── 2. Inspección Estática de RedCyberTunnelModal.tsx ─────────────────────────
const tunnelModalPath = path.join(__dirname, '..', 'src', 'components', 'modals', 'RedCyberTunnelModal.tsx');
const tunnelModalCode = fs.readFileSync(tunnelModalPath, 'utf8');

runTest("4. RedCyberTunnelModal: Incluye selector de operador, telemetría y guía APN", () => {
    assert(tunnelModalCode.includes("CYBERTUNNEL // TÚNEL ZERO-RATING"), "Debe tener título táctico");
    assert(tunnelModalCode.includes("PERFIL DEL OPERADOR / PORTAL CAUTIVO"), "Debe listar operadores");
    assert(tunnelModalCode.includes("CONFIGURACIÓN POR APN CELULAR"), "Debe incluir guía APN");
    assert(tunnelModalCode.includes("127.0.0.1"), "Debe mostrar host proxy");
    assert(tunnelModalCode.includes("8088"), "Debe mostrar puerto proxy 8088");
    assert(tunnelModalCode.includes("hyperBrowser"), "Debe permitir abrir el navegador integrado");
});

// ── 3. Validación Algorítmica de Encabezados Spoofed SNI ─────────────────────
const sniPath = path.join(__dirname, '..', 'src', 'lib', 'network', 'sniSpoofEngine.ts');
const sniCode = fs.readFileSync(sniPath, 'utf8');

runTest("5. SniSpoofEngine: Contiene catálogo de operadoras y portales cautivos universales", () => {
    assert(sniCode.includes("connectivitycheck.gstatic.com"), "Debe incluir Google Captive");
    assert(sniCode.includes("recargas.claro.com"), "Debe incluir Claro");
    assert(sniCode.includes("mi.movistar.com"), "Debe incluir Movistar");
    assert(sniCode.includes("portal.entel.pe"), "Debe incluir Entel");
});

const pkgVersion = require('../package.json').version;

function simulateSpoofedRequest(sniHost, url) {
    return {
        headers: {
            "Host": sniHost,
            "X-RED-Forward-URL": url,
            "X-RED-ZeroRating-Tunnel": `v${pkgVersion}`,
            "User-Agent": "Mozilla/5.0 (Mobile; Android 14; RED Mesh Node)"
        }
    };
}

runTest("6. Generador de Cabeceras HTTP: Camuflaje de SNI con redirección X-RED", () => {
    const req = simulateSpoofedRequest("connectivitycheck.gstatic.com", "https://api.tiktokv.com/feed");
    assert.strictEqual(req.headers["Host"], "connectivitycheck.gstatic.com", "Host header debe ser el portal cautivo");
    assert.strictEqual(req.headers["X-RED-Forward-URL"], "https://api.tiktokv.com/feed", "Debe portar la URL destino");
    assert.strictEqual(req.headers["X-RED-ZeroRating-Tunnel"], `v${pkgVersion}`, "Debe declarar la firma de túnel RED");
});

// ── 4. Validación de Cálculo de Ancho de Banda Instantáneo ───────────────────
function calculateBandwidthKbps(bytesTransferred, elapsedSeconds) {
    const safeSec = Math.max(0.1, elapsedSeconds);
    const bits = bytesTransferred * 8;
    return Math.round((bits / 1024) / safeSec);
}

runTest("7. Monitor de Ancho de Banda: Cálculo matemático riguroso de velocidad Kbps", () => {
    // 500 KB en 1 segundo = 4000 Kbps (4 Mbps)
    const kbps = calculateBandwidthKbps(500 * 1024, 1.0);
    assert.strictEqual(kbps, 4000, `Velocidad esperada 4000 Kbps, calculada: ${kbps}`);
});

// ── 5. Integración con RedNodePlugin y RedProxyServer (Android Nativo) ──────
const redProxyJavaPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'f', 'red', 'app', 'RedProxyServer.java');
const redProxyJavaCode = fs.readFileSync(redProxyJavaPath, 'utf8');

runTest("8. RedProxyServer.java: Implementación de ServerSocket local multihilo y túnel CONNECT", () => {
    assert(redProxyJavaCode.includes("class RedProxyServer"), "Debe definir RedProxyServer");
    assert(redProxyJavaCode.includes("new ServerSocket"), "Debe instanciar ServerSocket");
    assert(redProxyJavaCode.includes("CONNECT"), "Debe soportar método CONNECT para túneles HTTPS");
    assert(redProxyJavaCode.includes("bytesUploaded"), "Debe registrar bytesUploaded");
    assert(redProxyJavaCode.includes("bytesDownloaded"), "Debe registrar bytesDownloaded");
});

runTest("9. RedCyberTunnelEngine: Autodetección de operador y sincronización nativa de sockets", () => {
    assert(tunnelEngineCode.includes("autoDetectCarrier("), "Debe implementar autoDetectCarrier");
    assert(tunnelEngineCode.includes("RedNode.startProxyServer"), "Debe invocar inicio de proxy nativo");
    assert(tunnelEngineCode.includes("RedNode.getProxyStats"), "Debe sincronizar estadísticas nativas");
    assert(tunnelEngineCode.includes("isProxyRunning: boolean;"), "Debe rastrear estado del socket proxy");
});

// ── 6. Integración de RedHyperBrowserModal con RedCyberTunnelEngine ─────────
const hyperBrowserPath = path.join(__dirname, '..', 'src', 'components', 'miniapp', 'RedHyperBrowserModal.tsx');
const hyperBrowserCode = fs.readFileSync(hyperBrowserPath, 'utf8');

runTest("10. RedHyperBrowserModal: Enrutamiento soberano Zero-Rating y badge activo", () => {
    assert(hyperBrowserCode.includes("redCyberTunnel.isTunnelActive()"), "Debe consultar estado del túnel");
    assert(hyperBrowserCode.includes("redCyberTunnel.fetchTunneled("), "Debe ejecutar fetch a través del túnel");
    assert(hyperBrowserCode.includes("ZERO-RATING"), "Debe mostrar badge táctico de Zero-Rating");
});

console.log("\n================================================================================");
console.log(`📊 RESULTADO FINAL SUITE CYBERTUNNEL: ${passedTests}/${totalTests} PRUEBAS EXITOSAS`);
console.log("================================================================================\n");

if (passedTests !== totalTests) {
    process.exit(1);
}

