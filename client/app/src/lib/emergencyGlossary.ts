/**
 * emergencyGlossary.ts — 100% Offline Tactical Emergency Glossary & Translator v31.0.0
 *
 * Provides deterministic, zero-hallucination translations and definitions for
 * critical survival, medical, evacuation, rescue, and defense terminology across
 * 6 supported languages: Spanish (es), English (en), Portuguese (pt),
 * French (fr), German (de), Quechua (qu).
 */

export type GlossaryLanguage = 'es' | 'en' | 'pt' | 'fr' | 'de' | 'qu';

export interface GlossaryEntry {
    id: string;
    termEs: string;
    termEn: string;
    termPt: string;
    termFr: string;
    termDe: string;
    termQu: string;
    category: 'medical' | 'rescue' | 'shelter' | 'hazard' | 'communication' | 'defense';
    definitionEs: string;
    phoneticQu?: string;
}

export const EMERGENCY_GLOSSARY: GlossaryEntry[] = [
    {
        id: 'tourniquet',
        termEs: 'Torniquete',
        termEn: 'Tourniquet',
        termPt: 'Torniquete',
        termFr: 'Tourniquet',
        termDe: 'Aderpresse / Tourniquet',
        termQu: "Hichi k'iri watana",
        phoneticQu: "Hee-chee kee-ree wah-tah-nah",
        category: 'medical',
        definitionEs: 'Dispositivo para detener hemorragias severas en extremidades. Aplicar 5-7 cm proximal a la lesión y registrar la hora.'
    },
    {
        id: 'hemorrhage',
        termEs: 'Hemorragia',
        termEn: 'Hemorrhage / Arterial Bleeding',
        termPt: 'Hemorragia Arterial',
        termFr: 'Hémorragie',
        termDe: 'Blutung / Arterieller Blutverlust',
        termQu: "Yawar hich'akuy",
        phoneticQu: "Yah-war heech-ah-kooy",
        category: 'medical',
        definitionEs: 'Pérdida masiva de sangre. Aplicar presión directa continua con gasa estéril o empaquetar herida en pliegues.'
    },
    {
        id: 'cpr',
        termEs: 'Reanimación Cardiopulmonar (RCP)',
        termEn: 'Cardiopulmonary Resuscitation (CPR)',
        termPt: 'Ressuscitação Cardiopulmonar (RCP)',
        termFr: 'Réanimation Cardio-Pulmonaire (RCP)',
        termDe: 'Herz-Lungen-Wiederbelebung (HLW)',
        termQu: "Sonqo samay kawsarichiy",
        phoneticQu: "Son-koh sah-my kow-sah-ree-cheey",
        category: 'medical',
        definitionEs: 'Maniobra de 30 compresiones torácicas (100-120 cpm, 5-6 cm profundidad) y 2 ventilaciones en paro cardíaco.'
    },
    {
        id: 'triage',
        termEs: 'Triage de Emergencia (START)',
        termEn: 'Emergency Triage (START)',
        termPt: 'Triagem de Emergência',
        termFr: 'Triage d\'Urgence',
        termDe: 'Sichtung / Notfalltriage',
        termQu: "K'irisqakuna allichay",
        phoneticQu: "Kee-rees-kah-koo-nah ah-yee-chye",
        category: 'medical',
        definitionEs: 'Clasificación rápida de víctimas en <60s: Rojo (Inmediato), Amarillo (Diferido), Verde (Leve), Negro (Fallecido).'
    },
    {
        id: 'fracture',
        termEs: 'Fractura Ósea',
        termEn: 'Bone Fracture',
        termPt: 'Fratura Óssea',
        termFr: 'Fracture Osseuse',
        termDe: 'Knochenbruch / Fraktur',
        termQu: "Tullu pakisqa",
        phoneticQu: "Tool-lyoo pah-kees-kah",
        category: 'medical',
        definitionEs: 'Ruptura de hueso. Inmovilizar articulación proximal y distal con férula rígida acolchada sin recolocar el hueso.'
    },
    {
        id: 'burn',
        termEs: 'Quemadura',
        termEn: 'Burn / Thermal Injury',
        termPt: 'Queimadura',
        termFr: 'Brûlure',
        termDe: 'Verbrennung',
        termQu: "Rupay k'iri",
        phoneticQu: "Roo-pye kee-ree",
        category: 'medical',
        definitionEs: 'Lesión térmica o química. Enfriar con agua corriente a temperatura ambiente 15-20 min. Prohibido aplicar hielo o cremas.'
    },
    {
        id: 'hypothermia',
        termEs: 'Hipotermia',
        termEn: 'Hypothermia',
        termPt: 'Hipotermia',
        termFr: 'Hypothermie',
        termDe: 'Unterkühlung / Hypothermie',
        termQu: "Chiri onqoy",
        phoneticQu: "Chee-ree on-koy",
        category: 'medical',
        definitionEs: 'Descenso de temperatura central <35°C. Retirar ropa húmeda, aislar del suelo y calentar tronco con manta térmica aluminizada.'
    },
    {
        id: 'evacuation',
        termEs: 'Evacuación',
        termEn: 'Evacuation',
        termPt: 'Evacuação',
        termFr: 'Évacuation',
        termDe: 'Evakuierung',
        termQu: "Lluqsiy / Ayqiy",
        phoneticQu: "Lyook-see / Eye-key",
        category: 'rescue',
        definitionEs: 'Desplazamiento ordenado de personas hacia una zona segura fuera del perímetro de riesgo.'
    },
    {
        id: 'assembly_point',
        termEs: 'Punto de Encuentro / Zona Segura',
        termEn: 'Assembly Point / Safe Zone',
        termPt: 'Ponto de Encontro',
        termFr: 'Point de Ralliement',
        termDe: 'Sammelplatz / Sicherheitszone',
        termQu: "Tinkuna pampa",
        phoneticQu: "Teen-koo-nah pahm-pah",
        category: 'shelter',
        definitionEs: 'Ubicación georreferenciada acordada previamente para reagrupamiento de operadores y población.'
    },
    {
        id: 'earthquake',
        termEs: 'Sismo / Terremoto',
        termEn: 'Earthquake / Seismic Event',
        termPt: 'Terremoto / Sismo',
        termFr: 'Séisme / Tremblement de terre',
        termDe: 'Erdbeben',
        termQu: "Pacha kuyuy",
        phoneticQu: "Pah-chah koo-yooy",
        category: 'hazard',
        definitionEs: 'Movimiento tectónico brusco. Agacharse, cubrirse bajo estructura resistente y sujetarse. No salir corriendo durante la sacudida.'
    },
    {
        id: 'collapse',
        termEs: 'Derrumbe / Estructura Colapsada',
        termEn: 'Structural Collapse / Entrapment',
        termPt: 'Desabamento / Colapso Estrutural',
        termFr: 'Effondrement de Structure',
        termDe: 'Gebäudeeinsturz / Verschüttung',
        termQu: "Wasi thuñisqa",
        phoneticQu: "Wah-see thoo-nyees-kah",
        category: 'hazard',
        definitionEs: 'Colapso de edificación. Si queda atrapado, tapar vías respiratorias y golpear metal en secuencias de 3 para ser localizado.'
    },
    {
        id: 'flood',
        termEs: 'Inundación / Riada',
        termEn: 'Flash Flood / Inundation',
        termPt: 'Inundação / Enchente',
        termFr: 'Inondation / Crue éclair',
        termDe: 'Überschwemmung / Sturzflut',
        termQu: "Lloqlla / Yaku hunt'ay",
        phoneticQu: "Lyok-lyah / Yah-koo hoon-tie",
        category: 'hazard',
        definitionEs: 'Crecida repentina de agua. Buscar terreno elevado de inmediato. NUNCA cruzar corrientes con vehículos o a pie.'
    },
    {
        id: 'wildfire',
        termEs: 'Incendio Forestal',
        termEn: 'Wildfire / Bushfire',
        termPt: 'Incêndio Florestal',
        termFr: 'Feu de Forêt / Incendie',
        termDe: 'Waldbrand',
        termQu: "Sach'a rawray",
        phoneticQu: "Sah-chah row-rye",
        category: 'hazard',
        definitionEs: 'Fuego forestal veloz. Huir perpendicular al viento o hacia la zona ya quemada. Nunca huir cerro arriba.'
    },
    {
        id: 'shelter',
        termEs: 'Refugio de Emergencia',
        termEn: 'Emergency Shelter',
        termPt: 'Abrigo de Emergência',
        termFr: 'Abri d\'Urgence',
        termDe: 'Notunterkunft / Schutzraum',
        termQu: "Pakakuna wasi",
        phoneticQu: "Pah-kah-koo-nah wah-see",
        category: 'shelter',
        definitionEs: 'Estructura segura equipada con agua, botiquín y aislamiento térmico para guarecer a personas.'
    },
    {
        id: 'potable_water',
        termEs: 'Agua Potable',
        termEn: 'Potable Drinking Water',
        termPt: 'Água Potável',
        termFr: 'Eau Potable',
        termDe: 'Trinkwasser',
        termQu: "Ch'uya yaku",
        phoneticQu: "Choo-yah yah-koo",
        category: 'shelter',
        definitionEs: 'Agua segura para consumo humano. Purificar con ebullición de 1-3 min o 2 gotas de cloro al 5% por litro tras 30 min de reposo.'
    },
    {
        id: 'beacon_sos',
        termEs: 'Baliza de Auxilio / SOS',
        termEn: 'Emergency Distress Beacon / SOS',
        termPt: 'Sinal de Socorro / Baliza SOS',
        termFr: 'Balise de Détresse / SOS',
        termDe: 'Notfunkbake / SOS-Signal',
        termQu: "Yanapay willakuq",
        phoneticQu: "Yah-nah-pye weel-lah-kook",
        category: 'communication',
        definitionEs: 'Señal continua de socorro emitida por radio mesh, linterna estroboscópica Camera2 o audio acústico SoundMesh.'
    },
    {
        id: 'morse_code',
        termEs: 'Código Morse SOS ( • • • — — — • • • )',
        termEn: 'Morse Code Distress Signal',
        termPt: 'Código Morse SOS',
        termFr: 'Code Morse SOS',
        termDe: 'Morsecode SOS-Signal',
        termQu: "Morse willakuy",
        phoneticQu: "Mor-seh weel-lah-kooy",
        category: 'communication',
        definitionEs: 'Secuencia estándar internacional de 3 pulsos cortos (0.2s), 3 largos (0.6s) y 3 cortos con 3s de pausa entre ciclos.'
    },
    {
        id: 'walkie_talkie',
        termEs: 'Walkie-Talkie Push-to-Talk P2P',
        termEn: 'P2P Push-to-Talk Voice Radio',
        termPt: 'Rádio PTT Push-to-Talk',
        termFr: 'Radio Vocale Push-to-Talk',
        termDe: 'Mesh-Funkgerät (PTT)',
        termQu: "Simiwan willanakuy",
        phoneticQu: "See-mee-wahn weel-lah-nah-kooy",
        category: 'communication',
        definitionEs: 'Transmisión de voz digital por ráfagas de audio de baja tasa (Opus 8kbps) a través de enlaces BLE y WiFi Direct.'
    },
    {
        id: 'cbrn_threat',
        termEs: 'Amenaza QBRN (Química / Biológica / Nuclear)',
        termEn: 'CBRN Threat / Hazardous Material',
        termPt: 'Ameaça QBRN (Química/Biológica/Nuclear)',
        termFr: 'Menace NRBC (Chimique/Biologique/Nucléaire)',
        termDe: 'CBRN-Bedrohung (Gefahrstoffe)',
        termQu: "Miyuchasqa wayra",
        phoneticQu: "Mee-yoo-chahs-kah why-rah",
        category: 'defense',
        definitionEs: 'Nube tóxica o radiación. Evacuar perpendicular al viento a terreno alto, sellar habitación y descontaminar ropa.'
    },
    {
        id: 'snakebite',
        termEs: 'Mordedura de Serpiente Venenosa',
        termEn: 'Venomous Snakebite',
        termPt: 'Picada de Cobra Venenosa',
        termFr: 'Morsure de Serpent Venimeux',
        termDe: 'Giftschlangenbiss',
        termQu: "Katari kaniynin",
        phoneticQu: "Kah-tah-ree kah-neey-neen",
        category: 'medical',
        definitionEs: 'Envenenamiento ofídico. Reposo absoluto, extremidad a la altura del corazón e inmovilización con vendaje compresivo elástico.'
    },
    {
        id: 'rf_evasion',
        termEs: 'Control de Emisiones RF (EMCON)',
        termEn: 'RF Emission Control (EMCON)',
        termPt: 'Controle de Emissões RF',
        termFr: 'Contrôle des Émissions RF',
        termDe: 'Funkstille / EMCON-Sicherheit',
        termQu: "Pakasqa radio willakuy",
        phoneticQu: "Pah-kahs-kah rah-dee-oh weel-lah-kooy",
        category: 'defense',
        definitionEs: 'Minimización de potencia de transmisión y ráfagas cortas para evadir detección espectral y radiogoniometría (RDF).'
    },
    {
        id: 'dead_man_switch',
        termEs: 'Interruptor del Hombre Muerto (DMS)',
        termEn: 'Dead Man\'s Switch / Anti-Forensic Purge',
        termPt: 'Interruptor do Homem Morto',
        termFr: 'Dispositif de l\'Homme Mort',
        termDe: 'Totmannschalter / Notfall-Löschung',
        termQu: "Wañuy t'ikrana",
        phoneticQu: "Wah-nyooy teek-rah-nah",
        category: 'defense',
        definitionEs: 'Temporizador de seguridad que ante la falta de Check-in o ingreso de PIN de pánico purga la base de datos Sled y llaves de Keystore.'
    },
    {
        id: 'first_aid',
        termEs: 'Primeros Auxilios Tácticos (TCCC)',
        termEn: 'Tactical Combat Casualty Care (TCCC)',
        termPt: 'Primeiros Socorros Táticos',
        termFr: 'Secours Tactiques d\'Urgence',
        termDe: 'Taktische Erstversorgung (TCCC)',
        termQu: "Ñawpaq yanapay",
        phoneticQu: "Nyow-pahk yah-nah-pye",
        category: 'medical',
        definitionEs: 'Secuencia MARCH: Hemorragia masiva, Vía aérea, Respiración, Circulación e Hipotermia/Trauma craneal.'
    },
    {
        id: 'p2p_mesh',
        termEs: 'Red Malla P2P Descentralizada',
        termEn: 'Decentralized P2P Mesh Network',
        termPt: 'Rede Mesh P2P Descentralizada',
        termFr: 'Réseau Maillé Décentralisé P2P',
        termDe: 'Dezentrales P2P-Mesh-Netzwerk',
        termQu: "Tinkisqa llika",
        phoneticQu: "Teen-kees-kah lyee-kah",
        category: 'communication',
        definitionEs: 'Arquitectura de comunicaciones sin servidores centrales que retransmite paquetes salto a salto vía BLE, WiFi Direct y LoRa.'
    }
];

export class EmergencyGlossaryEngine {
    /** Retorna todos los términos indexados */
    public static getAllTerms(): GlossaryEntry[] {
        return [...EMERGENCY_GLOSSARY];
    }

    /** Retorna términos filtrados por categoría */
    public static getTermsByCategory(category: GlossaryEntry['category']): GlossaryEntry[] {
        return EMERGENCY_GLOSSARY.filter(e => e.category === category);
    }

    /** Obtiene término por ID exacto */
    public static getTermById(id: string): GlossaryEntry | undefined {
        return EMERGENCY_GLOSSARY.find(e => e.id === id);
    }

    /**
     * Traduce un término o consulta usando correspondencia determinista off-grid
     */
    public static translate(text: string, targetLang: GlossaryLanguage = 'es'): {
        entry?: GlossaryEntry;
        targetTerm: string;
        definitionEs: string;
        category: string;
        translatedText: string;
        matchType: 'exact' | 'keyword' | 'fallback';
    } {
        const query = text.trim().toLowerCase();
        const lang = targetLang.toLowerCase() as GlossaryLanguage;

        if (!query) {
            return {
                targetTerm: text,
                definitionEs: 'Término vacío',
                category: 'general',
                translatedText: text,
                matchType: 'fallback'
            };
        }

        // Búsqueda exhaustiva por id y por términos en los 6 idiomas
        for (const entry of EMERGENCY_GLOSSARY) {
            const matchesExact =
                entry.id === query ||
                entry.termEs.toLowerCase() === query ||
                entry.termEn.toLowerCase() === query ||
                entry.termPt.toLowerCase() === query ||
                entry.termFr.toLowerCase() === query ||
                entry.termDe.toLowerCase() === query ||
                entry.termQu.toLowerCase() === query;

            const matchesSubstring =
                entry.termEs.toLowerCase().includes(query) ||
                entry.termEn.toLowerCase().includes(query) ||
                entry.termPt.toLowerCase().includes(query) ||
                entry.termFr.toLowerCase().includes(query) ||
                entry.termDe.toLowerCase().includes(query) ||
                entry.termQu.toLowerCase().includes(query) ||
                query.includes(entry.termEs.toLowerCase()) ||
                query.includes(entry.termEn.toLowerCase());

            if (matchesExact || matchesSubstring) {
                let targetTerm = entry.termEs;
                if (lang === 'en') targetTerm = entry.termEn;
                else if (lang === 'pt') targetTerm = entry.termPt;
                else if (lang === 'fr') targetTerm = entry.termFr;
                else if (lang === 'de') targetTerm = entry.termDe;
                else if (lang === 'qu') targetTerm = entry.termQu;

                const phoneticText = entry.phoneticQu && lang === 'qu' ? `\n• Pronunciación: ${entry.phoneticQu}` : '';

                return {
                    entry,
                    targetTerm,
                    definitionEs: entry.definitionEs,
                    category: entry.category,
                    translatedText: `📖 [TRADUCTOR TÁCTICO OFF-GRID — ${entry.category.toUpperCase()}]\n\n• Término (${lang.toUpperCase()}): ${targetTerm}${phoneticText}\n• Definición Táctica: ${entry.definitionEs}\n• Referencias: ES (${entry.termEs}) | EN (${entry.termEn}) | QUE (${entry.termQu})`,
                    matchType: matchesExact ? 'exact' : 'keyword'
                };
            }
        }

        // Fallback determinista para texto libre fuera del glosario
        return {
            targetTerm: text,
            definitionEs: 'Texto fuera del glosario estándar de emergencia. Conservado exactamente para evitar alteración o alucinaciones.',
            category: 'general',
            translatedText: `🌐 [TRADUCCIÓN TÁCTICA OFF-GRID (${lang.toUpperCase()})]\n\n"${text}"\n\n(Nota: Término no indexado en el glosario de supervivencia. Preservado con fidelidad literal.)`,
            matchType: 'fallback'
        };
    }
}
