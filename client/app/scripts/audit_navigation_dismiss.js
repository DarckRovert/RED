const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, '..', 'src', 'components');
const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));

console.log('=== AUDITORÍA DE NAVEGACIÓN Y CIERRE DE MODALES/PANTALLAS ===\n');

const issues = [];

files.forEach(file => {
    const fullPath = path.join(componentsDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');

    // Check if it's a modal, panel or screen
    const isModalOrScreen = file.includes('Modal') || file.includes('Panel') || file.includes('Screen') || file.includes('Window');
    if (!isModalOrScreen) return;

    const hasOnCloseProp = /onClose\??\s*:/.test(content);
    const callsOnClose = /onClose\s*\(/.test(content);
    const callsGoBack = /goBack\s*\(/.test(content);
    const callsNavigate = /navigate\s*\(/.test(content);
    const usesBackHandler = /BackHandlerRegistry/.test(content);
    const hasCloseIconOrText = /["'`]([✕xX×‹←]|Cerrar|Salir|Volver|close|back)["'`]/i.test(content) || /aria-label=["'](Cerrar|Close|Volver)["']/i.test(content);

    const canBeDismissed = callsOnClose || callsGoBack || callsNavigate;

    if (!canBeDismissed) {
        issues.push({
            file,
            type: 'NO_DISMISS_ACTION',
            detail: 'No llama a onClose, goBack ni navigate en ninguna parte del componente'
        });
    }

    // Also check if it registers with BackHandlerRegistry
    if (!usesBackHandler && (file.includes('Modal') || file.includes('Overlay'))) {
        issues.push({
            file,
            type: 'NO_BACK_HANDLER_REGISTRY',
            detail: 'Es un Modal pero no registra interceptor en BackHandlerRegistry (el botón atrás de Android no lo cerrará primero)'
        });
    }
});

console.log(`Analizados ${files.length} componentes. Problemas encontrados:\n`);
issues.forEach(iss => {
    console.log(`[${iss.type}] ${iss.file}: ${iss.detail}`);
});

console.log(`\nTotal problemas detectados: ${issues.length}`);
