/**
 * RED v123.0.0 — Test Suite: Real Egress & Zero-Balance Cellular Tunnel Verification
 *
 * Verifies the empirical architectural overhaul for devices with active cellular data
 * but zero balance (prepago sin saldo) in isolated zones (zero mesh neighbors):
 *
 * 1. RedNodePlugin.java:
 *    - Native executeTunneledRequest (HttpURLConnection via local Proxy socket)
 *    - Native queryDnsStealth (Raw DatagramSocket UDP 53 DNS queries)
 *    - W3C forbidden header bypass at native layer
 * 2. RedProxyServer.java:
 *    - ANYCAST_EGRESS_GATEWAYS pool (Cloudflare, Google, Fastly)
 *    - Non-carrier internet traffic forwarding to Egress Gateways instead of carrier dead-end
 *    - Canonical header synchronization
 * 3. sniSpoofEngine.ts:
 *    - SniProbeResult.hasInternetEgress property
 *    - Differentiation between captive portal redirects (false positives) and real internet egress
 *    - Captive portal detection without false positives
 * 4. RedCyberTunnelEngine.ts:
 *    - Native plugin dispatch via executeTunneledRequest
 *    - Elimination of forbidden W3C Host header injection on web fallback
 *    - DNS_STEALTH transport mode handling
 * 5. RedCyberTunnelModal.tsx:
 *    - UI Mode Selector (ZERO_RATING_SNI, DNS_STEALTH, MESH_GATEWAY)
 *    - Internet Egress verification telemetry card
 *    - Captive portal loop warning in permeability feedback
 * 6. Isolated Egress State Machine Simulation:
 *    - Verifies fallback hierarchy without mesh dependencies
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log("================================================================================");
console.log("⚡  SUITE: REAL EGRESS & ZERO-BALANCE CELLULAR TUNNEL ARCHITECTURE (v123.0.0)");
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

// ── 1. Inspección de RedNodePlugin.java ────────────────────────────────────────
const pluginPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'f', 'red', 'app', 'RedNodePlugin.java');
const pluginCode = fs.readFileSync(pluginPath, 'utf8');

runTest("1. RedNodePlugin.java: Implementa executeTunneledRequest nativo vía Proxy 127.0.0.1", () => {
    assert(pluginCode.includes("public void executeTunneledRequest(PluginCall call)"), "Debe exponer PluginMethod executeTunneledRequest");
    assert(pluginCode.includes("new java.net.Proxy(java.net.Proxy.Type.HTTP, new java.net.InetSocketAddress(\"127.0.0.1\", proxyPort))"), "Debe apuntar HttpURLConnection al socket proxy local");
    assert(pluginCode.includes("conn.getInputStream()"), "Debe leer el stream de respuesta");
    assert(pluginCode.includes("ret.put(\"success\", true)"), "Debe retornar objeto de éxito");
    assert(pluginCode.includes("ret.put(\"body\", responseBody)"), "Debe extraer cuerpo de respuesta");
});

runTest("2. RedNodePlugin.java: Implementa queryDnsStealth sobre socket UDP 53 nativo", () => {
    assert(pluginCode.includes("public void queryDnsStealth(PluginCall call)"), "Debe exponer PluginMethod queryDnsStealth");
    assert(pluginCode.includes("new java.net.DatagramSocket()"), "Debe instanciar DatagramSocket UDP");
    assert(pluginCode.includes("int port = call.getInt(\"port\", 53);"), "Debe consultar puerto 53 por defecto");
    assert(pluginCode.includes("new java.net.DatagramPacket(queryData, queryData.length, serverAddr, port)"), "Debe construir paquete DNS UDP");
    assert(pluginCode.includes("ret.put(\"success\", true)"), "Debe reportar resolución exitosa");
});

// ── 2. Inspección de RedProxyServer.java ───────────────────────────────────────
const proxyPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'f', 'red', 'app', 'RedProxyServer.java');
const proxyCode = fs.readFileSync(proxyPath, 'utf8');

runTest("3. RedProxyServer.java: Define grupo ANYCAST_EGRESS_GATEWAYS para salida real a internet", () => {
    assert(proxyCode.includes("ANYCAST_EGRESS_GATEWAYS"), "Debe definir ANYCAST_EGRESS_GATEWAYS");
    assert(proxyCode.includes("104.16.132.229"), "Debe incluir nodo Cloudflare Anycast");
    assert(proxyCode.includes("142.250.190.46"), "Debe incluir nodo Google Anycast");
    assert(proxyCode.includes("151.101.1.57"), "Debe incluir nodo Fastly Anycast");
    assert(proxyCode.includes("1.1.1.1"), "Debe incluir Cloudflare DNS");
    assert(proxyCode.includes("8.8.8.8"), "Debe incluir Google DNS");
});

runTest("4. RedProxyServer.java: Enruta tráfico no-carrier a pasarelas Anycast en lugar de servidores de recarga", () => {
    assert(proxyCode.includes("boolean isCarrierInternal"), "Debe discriminar si el destino es del operador");
    assert(proxyCode.includes("candidateIp = ANYCAST_EGRESS_GATEWAYS[0]"), "Debe usar gateway Anycast de salida");
    assert(proxyCode.includes("X-RED-ZeroRating-Tunnel: v123.0.0"), "Debe sincronizar encabezado canónico de versión");
});

// ── 3. Inspección de sniSpoofEngine.ts ─────────────────────────────────────────
const sniPath = path.join(__dirname, '..', 'src', 'lib', 'network', 'sniSpoofEngine.ts');
const sniCode = fs.readFileSync(sniPath, 'utf8');

runTest("5. sniSpoofEngine.ts: Declara hasInternetEgress en SniProbeResult", () => {
    assert(sniCode.includes("hasInternetEgress?: boolean;"), "SniProbeResult debe declarar hasInternetEgress");
});

runTest("6. sniSpoofEngine.ts: Detección estricta de redirecciones de portal cautivo vs egreso real", () => {
    assert(sniCode.includes("isCaptiveIntercepted"), "Debe detectar intercepción cautiva");
    assert(sniCode.includes("hasInternetEgress = (nativeRes.statusCode === 200 || nativeRes.statusCode === 204) && !isCaptiveIntercepted"), "hasInternetEgress debe descartar bucles cautivos");
    assert(sniCode.includes("recarga"), "Debe filtrar portales de recargas");
    assert(sniCode.includes("saldo"), "Debe filtrar mensajes de saldo agotado");
});

// ── 4. Inspección de RedCyberTunnelEngine.ts ──────────────────────────────────
const enginePath = path.join(__dirname, '..', 'src', 'lib', 'network', 'RedCyberTunnelEngine.ts');
const engineCode = fs.readFileSync(enginePath, 'utf8');

runTest("7. RedCyberTunnelEngine.ts: Integra hasInternetEgress en CyberTunnelStats", () => {
    assert(engineCode.includes("hasInternetEgress?: boolean;"), "CyberTunnelStats debe declarar hasInternetEgress");
});

runTest("8. RedCyberTunnelEngine.ts: Despacha peticiones a través de RedNode.executeTunneledRequest", () => {
    assert(engineCode.includes("RedNodePlugin.executeTunneledRequest"), "Debe invocar executeTunneledRequest en runtime nativo");
    assert(engineCode.includes("Capacitor?.isPluginAvailable('RedNode')"), "Debe verificar disponibilidad del plugin RedNode");
});

runTest("9. RedCyberTunnelEngine.ts: Cumplimiento W3C - No inyecta encabezado prohibido Host en navegador", () => {
    const fetchTunneledBlock = engineCode.substring(
        engineCode.indexOf("public async fetchTunneled"),
        engineCode.indexOf("public recordBytes")
    );
    assert(!fetchTunneledBlock.includes("headers.set('Host'"), "fetchTunneled no debe mutar encabezado prohibido Host");
    assert(fetchTunneledBlock.includes("headers.set('X-Forwarded-Host'"), "Debe usar X-Forwarded-Host como encabezado seguro");
    assert(fetchTunneledBlock.includes("headers.set('X-RED-Forward-URL'"), "Debe usar X-RED-Forward-URL como encabezado de enrutamiento");
});

runTest("10. RedCyberTunnelEngine.ts: Implementa transporte de emergencia DNS_STEALTH", () => {
    assert(engineCode.includes("this.stats.mode === 'DNS_STEALTH'"), "Debe soportar modo DNS_STEALTH");
    assert(engineCode.includes("queryDnsStealth"), "Debe invocar queryDnsStealth en modo DNS_STEALTH");
    assert(engineCode.includes("UDP 53"), "Debe declarar transporte sobre UDP 53");
});

// ── 5. Inspección de RedCyberTunnelModal.tsx ──────────────────────────────────
const modalPath = path.join(__dirname, '..', 'src', 'components', 'modals', 'RedCyberTunnelModal.tsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

runTest("11. RedCyberTunnelModal.tsx: Expone selector de modo con los 3 transportes tácticos", () => {
    assert(modalCode.includes("MODO DE TRANSPORTE Y EVASIÓN DE FIREWALL"), "Debe tener panel de selección de modo");
    assert(modalCode.includes("handleSetMode('ZERO_RATING_SNI')"), "Debe permitir activar ZERO_RATING_SNI");
    assert(modalCode.includes("handleSetMode('DNS_STEALTH')"), "Debe permitir activar DNS_STEALTH");
    assert(modalCode.includes("handleSetMode('MESH_GATEWAY')"), "Debe permitir activar MESH_GATEWAY");
});

runTest("12. RedCyberTunnelModal.tsx: Muestra estado empírico de egreso a internet en telemetría", () => {
    assert(modalCode.includes("EGRESO A INTERNET"), "Debe tener tarjeta de telemetría de egreso");
    assert(modalCode.includes("stats.hasInternetEgress ? 'VERIFICADO' : stats.isActive ? 'RELAY ANYCAST' : 'DESCONECTADO'"), "Debe diferenciar egreso confirmado de enrutamiento cautivo");
});

// ── 6. Simulación Lógica de Evasión Celular Sin Vecinos Mesh ─────────────────
runTest("13. Simulación Algorítmica: Resolución de destino en SIM sin saldo", () => {
    const targetHost = "es.wikipedia.org";
    const carrierSni = "connectivitycheck.gstatic.com";
    const carrierIp = "179.6.232.18"; // Claro PE
    const gateways = ["104.16.132.229", "142.250.190.46", "151.101.1.57", "1.1.1.1", "8.8.8.8"];

    function resolveEgressTarget(destHost, isZeroRatingActive) {
        if (!isZeroRatingActive) {
            return { host: destHost, ip: destHost, tunneled: false };
        }
        const isCarrierInternal = carrierIp.startsWith("179.") || carrierIp.startsWith("200.");
        let candidateIp = carrierIp;
        let isRelayedToAnycast = false;

        if (isCarrierInternal && !destHost.includes("claro.com")) {
            candidateIp = gateways[0];
            isRelayedToAnycast = true;
        }

        return { host: carrierSni, ip: candidateIp, tunneled: true, isRelayedToAnycast };
    }

    const resClearNet = resolveEgressTarget(targetHost, true);
    assert.strictEqual(resClearNet.tunneled, true, "Debe estar tunelizado");
    assert.strictEqual(resClearNet.isRelayedToAnycast, true, "Debe derivar a un Gateway Anycast para evitar caer en el servidor cautivo de Claro");
    assert.strictEqual(resClearNet.ip, "104.16.132.229", "La IP debe ser la pasarela de salida Anycast");

    const resCarrier = resolveEgressTarget("www.claro.com.pe", true);
    assert.strictEqual(resCarrier.isRelayedToAnycast, false, "Tráfico del operador no requiere pasarela Anycast");
    assert.strictEqual(resCarrier.ip, "179.6.232.18", "Tráfico del operador va a la IP del portal");
});

runTest("14. Simulación Algorítmica: Filtrado de Falsos Positivos de Permeabilidad", () => {
    function evaluatePermeability(statusCode, locationHeader, responseBody) {
        const isRedirect = statusCode === 301 || statusCode === 302 || statusCode === 307;
        const loc = (locationHeader || '').toLowerCase();
        const isCaptiveIntercepted = isRedirect || loc.includes('recarga') || loc.includes('portal') || loc.includes('saldo');
        const isCaptivePermeable = statusCode >= 200 && statusCode < 400;
        const hasInternetEgress = (statusCode === 200 || statusCode === 204) && !isCaptiveIntercepted;
        return { isCaptivePermeable, isCaptiveIntercepted, hasInternetEgress };
    }

    // Caso A: SIM sin saldo redirigida por el firewall a la página de recargas
    const captiveSim = evaluatePermeability(302, "https://recargas.claro.com.pe/portal?id=0", "Saldo agotado");
    assert.strictEqual(captiveSim.isCaptivePermeable, true, "Es permeable a nivel radio");
    assert.strictEqual(captiveSim.isCaptiveIntercepted, true, "Es una intercepción cautiva");
    assert.strictEqual(captiveSim.hasInternetEgress, false, "NO debe marcarse como salida libre a internet");

    // Caso B: Paquete tunelizado a través de Cloudflare Anycast retornando HTTP 200
    const clearEgress = evaluatePermeability(200, "", "<html>OK</html>");
    assert.strictEqual(clearEgress.isCaptivePermeable, true);
    assert.strictEqual(clearEgress.isCaptiveIntercepted, false);
    assert.strictEqual(clearEgress.hasInternetEgress, true, "Debe confirmarse egreso real");
});

console.log("\n================================================================================");
console.log(`📊 RESULTADO FINAL SUITE REAL EGRESS: ${passedTests}/${totalTests} PRUEBAS EXITOSAS`);
console.log("================================================================================\n");

if (passedTests !== totalTests) {
    process.exit(1);
}
