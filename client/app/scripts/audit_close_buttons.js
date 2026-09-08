const fs = require('fs');
const path = require('path');

const compDir = path.join(__dirname, '..', 'src', 'components');

const modals = [
    'P2PCompassModal',
    'P2PWalkieTalkieModal',
    'IdentityVaultModal',
    'ProximityWaveModal',
    'LiveCanvasModal',
    'ProximitySettingsModal',
    'AICopilotModal',
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
    'ExtremeSurvivalHudModal',
    'StegoVaultModal',
    'ShakePairModal',
    'RedP2PPayModal',
    'WeatherAlertPanel',
    'EcoMeshPanel',
    'DMSSettings',
    'GlobalShieldPanel',
    'PublicChannelsPanel',
    'SocialFeedPanel',
    'NearbyDevicesPanel',
    'GroupsPanel',
    'StatusView',
    'SecurityPanel',
    'NetworkPanel',
    'CryptoPanel',
    'BroadcastPanel',
    'RadarWindow',
    'NodeMap'
];

console.log('=== CLOSE BUTTON AUDIT FOR MODALS ===\n');

for (const name of modals) {
    const p = path.join(compDir, `${name}.tsx`);
    if (!fs.existsSync(p)) continue;

    const code = fs.readFileSync(p, 'utf8');
    
    // Find all occurrences of buttons that might be back/close buttons
    const lines = code.split('\n');
    const closeButtons = [];
    lines.forEach((line, idx) => {
        if (/onClick\s*=.*(?:goBack|onClose|handleClose|navigate\(['"]sidebar['"]\))/.test(line)) {
            closeButtons.push({ lineNum: idx + 1, text: line.trim() });
        }
    });

    console.log(`[${name}] ${closeButtons.length} close trigger(s):`);
    closeButtons.forEach(b => console.log(`   L${b.lineNum}: ${b.text.substring(0, 100)}`));
}
