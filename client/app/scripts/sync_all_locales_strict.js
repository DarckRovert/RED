const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/lib/i18n/locales');
const esPath = path.join(localesDir, 'es.ts');

// Read es.ts to get the exact canonical template
const esContent = fs.readFileSync(esPath, 'utf8');

const languages = ['en', 'zh', 'pt', 'fr', 'de', 'ru', 'ja', 'ar', 'it', 'ko', 'qu'];

// Helper to convert ES content to another language with translations map
const translations = {
    en: {
        // Core overrides
        "BÓVEDA CRIPTOGRÁFICA RED": "RED CRYPTOGRAPHIC VAULT",
        "Sistema Operativo Malla Táctico & Descentralizado": "Tactical & Decentralized Mesh Operating System",
        "Ingresa tu PIN de Seguridad (4-8 dígitos)": "Enter Security PIN (4-8 digits)",
        "DESBLOQUEAR BÓVEDA": "UNLOCK VAULT",
        "Acceso con Huella / Biometría": "Biometric / Fingerprint Access",
        "PIN de Coacción: montará una bóveda señuelo vacía": "Duress PIN: mounts an empty decoy vault",
        "BIENVENIDO A RED": "WELCOME TO RED",
        "Establece tu identidad soberana P2P": "Establish your sovereign P2P identity",
        "Tu distintivo o apodo de operador": "Your operator handle or nickname",
        "INICIAR NODO SOBERANO": "INITIALIZE SOVEREIGN NODE",
        "Restaurar con Frase Semilla BIP-39": "Restore from BIP-39 Seed Phrase",
        "Mensajes P2P": "P2P Messages",
        "Escuadrones": "Squads",
        "Canales Malla": "Mesh Channels",
        "Radar Radio": "Radio Radar",
        "Mapa Offline": "Offline Map",
        "Brújula Táctica": "Tactical Compass",
        "Walkie-Talkie HQ": "Walkie-Talkie HQ",
        "Pizarra Táctica": "Tactical Canvas",
        "Transmisión en Vivo": "Live Stream",
        "Pagos & Vales P2P": "P2P Payments & Vouchers",
        "Bóveda PQC": "PQC Vault",
        "Triaje START": "START Triage",
        "Alerta AMBER": "AMBER Alert",
        "Baliza SOS": "SOS Beacon",
        "Ajustes del Sistema": "System Settings",
        "Auditoría de Seguridad": "Security Audit",
        "Registros del Nodo": "Node Logs",
        "Simulador de Apagón": "Blackout Simulator",
        "Bóveda Esteganográfica": "Steganographic Vault",
        "Hombre Muerto (DMS)": "Dead Man's Switch (DMS)",
        "Copiloto IA Offline": "Offline AI Copilot",
        "Barómetro & Clima": "Barometer & Weather",
        "Analizador Espectro RF": "RF Spectrum Analyzer",
        "Actualizador OTA": "OTA Updater",
        "Diagnóstico de Salud": "System Health",
        "Calculadora Señuelo": "Decoy Calculator",
        "RED MESH": "RED MESH",
        "Buscar operadores, canales o DIDs...": "Search operators, channels, or DIDs...",
        "Sin contactos agregados": "No contacts added",
        "Escanea un código QR o agrega operadores cercanos desde el Radar Radio.": "Scan a QR code or add nearby operators from Radio Radar.",
        "AGREGAR CONTACTO": "ADD CONTACT",
        "ESCUADRONES CIFRADOS P2P": "P2P ENCRYPTED SQUADS",
        "CREAR NUEVO ESCUADRÓN P2P": "CREATE NEW P2P SQUAD",
        "Sin Escuadrones Creados": "No Squads Created",
        "Canal de Emergencia Global": "Global Emergency Channel",
        "Canal Local Malla": "Local Mesh Channel",
        "EN LÍNEA": "ONLINE",
        "OFF-GRID": "OFF-GRID",
        "MALLA ACTIVA": "MESH ACTIVE",
        "CONTACTOS REGISTRADOS": "REGISTERED CONTACTS",
        "Cancelar": "Cancel",
        "Confirmar": "Confirm",
        "Guardar": "Save",
        "Cerrar": "Close",
        "Volver": "Back",
        "Error": "Error",
        "Éxito": "Success",
        "Copiado al portapapeles": "Copied to clipboard",
        "Cargando...": "Loading...",
        "Apariencia": "Appearance",
        "Llamadas & Video": "Calls & Video",
        "Sonido & Tonos": "Sound & Tones",
        "Almacenamiento": "Storage",
        "Privacidad": "Privacy",
        "Malla & Batería": "Mesh & Battery",
        "Identidad & Claves": "Identity & Keys",
        "Respaldo & Nube": "Backup & Cloud",
        "Actualizador": "Updater",
        "Ajustes & Configuración Soberana": "Settings & Sovereign Configuration",
        "Mapa Táctico GPS": "GPS Tactical Map",
        "GPS FIJADO": "GPS LOCKED",
        "BUSCANDO SATÉLITES…": "SEARCHING SATELLITES…",
        "Telemetría": "Telemetry",
        "Centrar en mi ubicación": "Recenter on my position",
        "Nodos Visibles": "Visible Nodes",
        "Distancia": "Distance",
        "Señal": "Signal",
        "Última baliza": "Last beacon",
        "Mi Posición": "My Position",
        "Detalles del Nodo Táctico": "Tactical Node Details",
        "Radio 25m": "25m Range",
        "Radio 50m": "50m Range",
        "Radio 100m": "100m Range",
        "Auditoría de Seguridad & Ciberdefensa": "Security Audit & Cyberdefense",
        "PROTECCIÓN CRIPTOGRÁFICA ZERO-TRUST": "ZERO-TRUST CRYPTOGRAPHIC PROTECTION",
        "Hub Comercial & Recompensas Malla": "Commercial Hub & Mesh Rewards",
        "Canales Públicos Malla": "Public Mesh Channels",
        "Walkie-Talkie HQ P2P": "Walkie-Talkie HQ P2P",
        "Brújula Táctica & Navegación": "Tactical Compass & Navigation",
        "Número de Seguridad Criptográfico": "Cryptographic Safety Number",
        "Barómetro Táctico & Alertas Meteorológicas": "Tactical Barometer & Weather Alerts",
    }
};

for (const lang of languages) {
    const filePath = path.join(localesDir, `${lang}.ts`);
    let langContent = esContent.replace('export const es = {', `import { I18nSchema } from './es';\n\nexport const ${lang}: I18nSchema = {`);
    langContent = langContent.replace('export type I18nSchema = typeof es;', '');

    // Apply translations if available
    const dict = translations[lang] || translations.en;
    for (const [esStr, transStr] of Object.entries(dict)) {
        langContent = langContent.split(`"${esStr}"`).join(`"${transStr}"`);
    }

    fs.writeFileSync(filePath, langContent, 'utf8');
    console.log(`Synced strictly: ${lang}.ts`);
}
