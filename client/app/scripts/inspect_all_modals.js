const fs = require('fs');
const path = require('path');

const modals = [
    'ExtremeSurvivalHudModal',
    'VitalScanModal',
    'TacticalFoxhuntModal',
    'CelestialPdrModal',
    'AirGapStegoModal',
    'CbrnSatelliteModal',
    'ZkBarterSubsurfaceModal',
    'TcccBallisticsModal',
    'C4isrEmpDrillModal',
    'AcousticWarfareModal',
    'VitalResourcesModal',
    'SonarSeismicModal',
    'RfSpectrumModal',
    'AtmosphericSafetyModal',
    'P2PCompassModal',
    'P2PWalkieTalkieModal',
    'OffGridCompassModal',
    'IdentityVaultModal',
    'ProximityWaveModal',
    'LiveCanvasModal',
    'ProximitySettingsModal',
    'AICopilotModal',
    'SurvivalBeaconModal',
    'TacticalVisionScanModal',
    'ShamirRecoveryModal',
    'StegoVaultModal',
    'ShakePairModal',
    'RedP2PPayModal',
    'Web3VaultModal',
    'SettingsModal',
    'BlackoutSimulatorModal',
    'SystemHealthModal',
    'NodeLogsModal',
    'SecurityReportModal',
    'BackupRestoreModal',
    'AmberAdminPanel',
    'GuardianStatusPanel',
    'CommercialHubModal',
    'LoraTransceiverModal'
];

const componentsDir = path.join(__dirname, '..', 'src', 'components');

console.log('=== INSPECCIÓN DE 39 MODALES Y PANELES TÁCTICOS ===\n');

modals.forEach(name => {
    const filePath = path.join(componentsDir, `${name}.tsx`);
    if (!fs.existsSync(filePath)) {
        console.log(`❌ NO EXISTE: ${name}.tsx`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    const acceptsOnClose = /interface\s+\w+Props[^{]*\{[^}]*onClose\??\s*:/.test(content) || /function\s+\w+\s*\(\s*\{[^}]*onClose/.test(content) || /const\s+\w+\s*:\s*React\.FC<[^>]*onClose/.test(content);
    const hasBackHandler = /BackHandlerRegistry\.register/.test(content);
    const backHandlerCallsGoBack = /BackHandlerRegistry\.register\s*\(\s*\(\)\s*=>\s*\{[^}]*goBack\s*\([^}]*\}/.test(content) || /BackHandlerRegistry\.register\s*\(\s*\(\)\s*=>\s*\{[^}]*handleClose\s*\([^}]*\}/.test(content);
    const hasVisualCloseButton = /onClick\s*=\s*\{[^}]*(?:goBack|onClose|handleClose|navigate\s*\(\s*['"]sidebar['"]\))/.test(content);
    
    // Check if it has a header with close/back button
    const hasBackButton = /‹|←|✕|x|X|Cerrar|Volver|close|back/i.test(content);

    console.log(`📌 ${name}:`);
    console.log(`   - Acepta prop onClose: ${acceptsOnClose ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   - Registra BackHandler: ${hasBackHandler ? '✅ SÍ' : '⚠️ NO'}`);
    console.log(`   - BackHandler llama goBack/handleClose: ${backHandlerCallsGoBack ? '⚠️ ALERTA (Riesgo de recursión si goBack llama a executeTop)' : 'ℹ️ NO'}`);
    console.log(`   - Botón visual de cierre en UI: ${hasVisualCloseButton ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   - Icono o texto visual de retorno: ${hasBackButton ? '✅ SÍ' : '❌ NO'}`);
});
