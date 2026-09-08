const fs = require('fs');
const path = require('path');

const screens = [
    'SecurityPanel',
    'StatusView',
    'NetworkPanel',
    'CryptoPanel',
    'BroadcastPanel',
    'EcoMeshPanel',
    'DMSSettings',
    'AmberAdminPanel',
    'GuardianStatusPanel',
    'WeatherAlertPanel',
    'P2PCompassModal',
    'P2PWalkieTalkieModal',
    'IdentityVaultModal',
    'ProximityWaveModal',
    'LiveCanvasModal',
    'ProximitySettingsModal',
    'AICopilotModal',
    'LiveStreamBroadcaster',
    'OffGridCompassModal',
    'VitalScanModal',
    'SurvivalBeaconModal',
    'TacticalVisionScanModal',
    'ShamirRecoveryModal',
    'CbrnSatelliteModal',
    'ZkBarterSubsurfaceModal',
    'TcccBallisticsModal',
    'C4isrEmpDrillModal',
    'AirGapStegoModal',
    'CelestialPdrModal',
    'AcousticWarfareModal',
    'VitalResourcesModal',
    'SonarSeismicModal',
    'TacticalFoxhuntModal',
    'RfSpectrumModal',
    'AtmosphericSafetyModal',
    'LoraTransceiverModal',
    'ExtremeSurvivalHudModal',
    'StegoVaultModal',
    'ShakePairModal',
    'RedP2PPayModal',
    'BlackoutSimulatorModal',
    'SystemHealthModal',
    'NodeLogsModal',
    'SecurityReportModal',
    'BackupRestoreModal',
    'SettingsModal',
    'UpdateModal',
    'GlobalShieldPanel',
    'Web3VaultModal',
    'CommercialHubModal',
    'NodeMap',
    'RadarWindow',
    'BlockchainExplorer',
    'GroupsPanel',
    'PublicChannelsPanel',
    'SocialFeedPanel',
    'NearbyDevicesPanel',
    'TacticalCommandCenter'
];

const compDir = path.join(__dirname, '..', 'src', 'components');

const report = [];

for (const name of screens) {
    let filePath = path.join(compDir, `${name}.tsx`);
    if (!fs.existsSync(filePath)) {
        // try subdirs
        const subdirs = ['tactical', 'settings', 'call', 'stories', 'ui'];
        let found = false;
        for (const sub of subdirs) {
            const p = path.join(compDir, sub, `${name}.tsx`);
            if (fs.existsSync(p)) {
                filePath = p;
                found = true;
                break;
            }
        }
        if (!found) {
            report.push({ name, error: 'FILE_NOT_FOUND' });
            continue;
        }
    }

    const code = fs.readFileSync(filePath, 'utf8');

    const acceptsOnClose = /interface\s+\w+Props[^{]*\{[^}]*onClose\??\s*:/.test(code) || 
                           /props:\s*\{[^}]*onClose/.test(code) ||
                           /\{\s*onClose\s*[,:\)]/.test(code);

    const hasBackHandler = code.includes('BackHandlerRegistry.register');

    // Check for visible close/back button in JSX
    const hasCloseButton = /<button[^>]*onClick\s*=\s*\{[^}]*(?:goBack|onClose|handleClose|navigate\s*\(\s*['"]sidebar['"]\))[^}]*\}[^>]*>[\s\S]*?(?:‹|←|✕|×|X|Cerrar|Volver|Close|Back|<svg|<span|<Chevron|<Arrow)[\s\S]*?<\/button>/i.test(code) ||
                           /<button[^>]*aria-label=['"][^'"]*(?:close|cerrar|volver|back)[^'"]*['"][^>]*onClick\s*=\s*\{[^}]*(?:goBack|onClose|handleClose|navigate)/i.test(code) ||
                           /onClick\s*=\s*\{[^}]*(?:goBack|onClose|handleClose|navigate\s*\(\s*['"]sidebar['"]\))\}[^>]*>\s*(?:‹|←|✕|×|X|Volver)/.test(code);

    // Any onClick with goBack / onClose / handleClose
    const hasAnyCloseClick = /onClick\s*=\s*\{[^}]*(?:goBack|onClose|handleClose|navigate\s*\(\s*['"]sidebar['"]\))/.test(code);

    report.push({
        name,
        acceptsOnClose,
        hasBackHandler,
        hasCloseButton,
        hasAnyCloseClick
    });
}

console.log(JSON.stringify(report, null, 2));
