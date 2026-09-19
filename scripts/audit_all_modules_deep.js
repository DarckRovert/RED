const fs = require('fs');
const path = require('path');

console.log("================================================================================");
console.log("🔎 AUDITORÍA EXHAUSTIVA DE INTEGRIDAD DE TODOS LOS MÓDULOS DE RED OS (v110.0.0)");
console.log("================================================================================");

const rootDir = path.join(__dirname, '..');
const pagePath = path.join(rootDir, 'client/app/src/app/page.tsx');
const wsPath = path.join(rootDir, 'client/app/src/components/navigation/WorkspaceScreens.tsx');
const sidebarPath = path.join(rootDir, 'client/app/src/components/Sidebar.tsx');
const ccPath = path.join(rootDir, 'client/app/src/components/TacticalCommandCenter.tsx');

const wsContent = fs.readFileSync(wsPath, 'utf8');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
const ccContent = fs.readFileSync(ccPath, 'utf8');

// 1. Extraer acciones de Sidebar y Command Center
const sidebarActions = [...sidebarContent.matchAll(/action:\s*["']([^"']+)["']/g)].map(m => m[1]);
const ccActions = [...ccContent.matchAll(/action:\s*["']([^"']+)["']/g)].map(m => m[1]);

// 2. Extraer dynamic imports en WorkspaceScreens.tsx
const dynamicImports = {};
const dynamicRegex = /const\s+([A-Za-z0-9_]+)\s*=\s*dynamic\(\(\)\s*=>\s*import\(["']([^"']+)["']\)/g;
let dMatch;
while ((dMatch = dynamicRegex.exec(wsContent)) !== null) {
    dynamicImports[dMatch[1]] = dMatch[2];
}

const actionsToCheck = new Set([...sidebarActions, ...ccActions]);

// Mapping directo para casos con nombres derivados o wrappers
const ACTION_TO_COMP = {
    call: 'CallScreen',
    webCompanionLink: 'WebCompanionLinkModal',
    companionLink: 'WebCompanionLinkModal',
    swarmHealthHUD: 'SwarmHealthHUD',
    swarmHealth: 'SwarmHealthHUD',
    channels: 'PublicChannelsPanel',
    publicChannels: 'PublicChannelsPanel',
    canvas: 'LiveCanvasModal',
    liveCanvas: 'LiveCanvasModal',
    radar: 'RadarWindow',
    nodemap: 'NodeMap',
    appStore: 'SovereignAppStoreModal',
    hyperBrowser: 'RedHyperBrowserModal',
    settings: 'SettingsModal',
    updater: 'UpdateModal',
    groups: 'GroupsPanel',
    squads: 'GroupsPanel',
    chat: 'ChatWindow',
    security: 'SecurityPanel',
    broadcast: 'BroadcastPanel',
    crypto: 'CryptoPanel',
    status: 'StatusView',
    explorer: 'BlockchainExplorer',
    network: 'NetworkPanel',
    dms: 'DMSSettings',
    amber: 'AmberAdminPanel',
    amberAdmin: 'AmberAdminPanel',
    guardian: 'GuardianStatusPanel',
    nearby: 'NearbyDevicesPanel',
    contacts: 'NearbyDevicesPanel',
    globalShield: 'GlobalShieldPanel',
    web3Vault: 'Web3VaultModal',
    p2pCompass: 'P2PCompassModal',
    offGridCompass: 'OffGridCompassModal',
    compass: 'OffGridCompassModal',
    socialFeed: 'SocialFeedPanel',
    walkie: 'P2PWalkieTalkieModal',
    weather: 'WeatherAlertPanel',
    weatherAlert: 'WeatherAlertPanel',
    idVault: 'IdentityVaultModal',
    identityVault: 'IdentityVaultModal',
    proximity: 'ProximityWaveModal',
    proximityWave: 'ProximityWaveModal',
    ecoMesh: 'EcoMeshPanel',
    proximitySettings: 'ProximitySettingsModal',
    proximity_settings: 'ProximitySettingsModal',
    aiCopilot: 'AICopilotModal',
    copilot: 'AICopilotModal',
    liveStream: 'LiveStreamBroadcaster',
    vitalScan: 'VitalScanModal',
    survivalBeacon: 'SurvivalBeaconModal',
    sos: 'SurvivalBeaconModal',
    tacticalVisionScan: 'TacticalVisionScanModal',
    shamirRecovery: 'ShamirRecoveryModal',
    cbrnSatellite: 'CbrnSatelliteModal',
    zkBarterSubsurface: 'ZkBarterSubsurfaceModal',
    tcccBallistics: 'TcccBallisticsModal',
    c4isrEmpDrill: 'C4isrEmpDrillModal',
    airGapStego: 'AirGapStegoModal',
    celestialPdr: 'CelestialPdrModal',
    acousticWarfare: 'AcousticWarfareModal',
    vitalResources: 'VitalResourcesModal',
    sonarSeismic: 'SonarSeismicModal',
    tacticalFoxhunt: 'TacticalFoxhuntModal',
    atmosphericSafety: 'AtmosphericSafetyModal',
    rfSpectrum: 'RfSpectrumModal',
    stegoVault: 'StegoVaultModal',
    shakePair: 'ShakePairModal',
    p2pPay: 'RedP2PPayModal',
    redP2PPay: 'RedP2PPayModal',
    blackout: 'BlackoutSimulatorModal',
    systemHealth: 'SystemHealthModal',
    health: 'SystemHealthModal',
    nodeLogs: 'NodeLogsModal',
    logs: 'NodeLogsModal',
    calculator: 'CalculatorScreen',
    secReport: 'SecurityReportModal',
    backup: 'BackupRestoreModal',
    commercialHub: 'CommercialHubModal',
    hub: 'CommercialHubModal',
    loraTransceiver: 'LoraTransceiverModal',
    extremeSurvival: 'ExtremeSurvivalHudModal',
    survivalHud: 'ExtremeSurvivalHudModal',
    tacticalGhostGps: 'TacticalGhostGpsModal',
    ghostGps: 'TacticalGhostGpsModal',
    cyberTunnel: 'RedCyberTunnelModal',
    zeroRating: 'RedCyberTunnelModal',
    sovereignShield: 'SovereignShieldDashboard',
    shield: 'SovereignShieldDashboard',
    maleCnsConnectome: 'MaleCnsConnectomeHUD',
    connectome: 'MaleCnsConnectomeHUD'
};

const issues = [];
const moduleReport = [];

for (const action of actionsToCheck) {
    if (action === 'commandCenter' || action === 'sidebar' || action === 'landing') {
        continue;
    }

    // Verificar enrutamiento en WorkspaceScreens.tsx
    const isRouted = wsContent.includes(`"${action}"`) || wsContent.includes(`'${action}'`);

    let compName = ACTION_TO_COMP[action];
    if (!compName) {
        const actionIdx = wsContent.indexOf(`"${action}"`);
        if (actionIdx !== -1) {
            const slice = wsContent.slice(actionIdx, actionIdx + 300);
            const compMatch = slice.match(/<([A-Z][A-Za-z0-9_]+)/);
            compName = compMatch ? compMatch[1] : 'UNKNOWN';
        } else {
            compName = 'UNKNOWN';
        }
    }

    let compPath = dynamicImports[compName];
    let fileExists = false;
    let fileSize = 0;
    let fileLines = 0;
    let fullFilePath = '';

    if (compPath) {
        if (compPath.startsWith('.')) {
            fullFilePath = path.resolve(path.join(rootDir, 'client/app/src/components/navigation'), compPath);
            if (!fs.existsSync(fullFilePath)) {
                if (fs.existsSync(fullFilePath + '.tsx')) fullFilePath += '.tsx';
                else if (fs.existsSync(fullFilePath + '.ts')) fullFilePath += '.ts';
                else if (fs.existsSync(path.join(fullFilePath, 'index.tsx'))) fullFilePath = path.join(fullFilePath, 'index.tsx');
            }
        }
        if (fs.existsSync(fullFilePath)) {
            fileExists = true;
            const content = fs.readFileSync(fullFilePath, 'utf8');
            fileSize = content.length;
            fileLines = content.split('\n').length;
        }
    }

    const itemStatus = {
        action,
        component: compName,
        filePath: compPath || 'N/A',
        fileExists,
        fileSize,
        fileLines,
        isRouted,
        status: (isRouted && fileExists && fileSize > 500) ? 'OK' : 'FAIL'
    };

    moduleReport.push(itemStatus);

    if (itemStatus.status === 'FAIL') {
        issues.push(itemStatus);
    }
}

console.log(`Total acciones únicas auditadas: ${moduleReport.length}`);
console.log(`Acciones con estado OK: ${moduleReport.filter(m => m.status === 'OK').length}`);
console.log(`Acciones con fallas: ${issues.length}`);

if (issues.length > 0) {
    console.log("\n⚠️ DETALLES DE FALLAS:");
    console.dir(issues, { depth: null });
} else {
    console.log(`\n✅ ¡100% DE LOS ${moduleReport.length} MÓDULOS TIENEN COMPONENTE REAL EN DISCO, TAMAÑO SUSTANCIAL Y ENRUTAMIENTO VERIFICADO!`);
}

console.log("\n--- DETALLE DE TODOS LOS MÓDULOS Y SUS COMPONENTES EN DISCO ---");
moduleReport.sort((a, b) => a.action.localeCompare(b.action)).forEach((m, i) => {
    const kb = (m.fileSize / 1024).toFixed(1);
    console.log(`${String(i + 1).padStart(2, ' ')}. [${m.action.padEnd(24, ' ')}] -> <${m.component.padEnd(26, ' ')}> (${kb.padStart(5, ' ')} KB, ${String(m.fileLines).padStart(4, ' ')} líneas) [Ruta OK: ${m.isRouted ? '✓' : '✗'}]`);
});

console.log("\n================================================================================");
console.log("AUDITORÍA DE INTEGRIDAD FINALIZADA CON ÉXITO");
console.log("================================================================================");
