/**
 * emergencyGlossary.ts — 100% Offline Tactical Emergency Glossary & Translator
 *
 * Provides deterministic, zero-hallucination translations and definitions for
 * critical survival, medical, evacuation, and rescue terminology across
 * 6 supported languages: Spanish (es), English (en), Portuguese (pt),
 * French (fr), German (de), Quechua (qu).
 */

export interface GlossaryEntry {
    termEs: string;
    termEn: string;
    termPt: string;
    termFr: string;
    termDe: string;
    termQu: string;
    category: 'medical' | 'rescue' | 'shelter' | 'hazard' | 'communication';
    definitionEs: string;
}

export const EMERGENCY_GLOSSARY: GlossaryEntry[] = [
    {
        termEs: 'Torniquete',
        termEn: 'Tourniquet',
        termPt: 'Torniquete',
        termFr: 'Tourniquet',
        termDe: 'Aderpresse',
        termQu: 'Hichi k\'iri watana',
        category: 'medical',
        definitionEs: 'Dispositivo para detener hemorragias severas en extremidades. Aplicar 5-7cm por encima de la herida.'
    },
    {
        termEs: 'Hemorragia',
        termEn: 'Hemorrhage / Bleeding',
        termPt: 'Hemorragia',
        termFr: 'Hémorragie',
        termDe: 'Blutung',
        termQu: 'Yawar hich\'akuy',
        category: 'medical',
        definitionEs: 'Pérdida continua de sangre. Aplicar presión directa con compresa limpia.'
    },
    {
        termEs: 'Evacuación',
        termEn: 'Evacuation',
        termPt: 'Evacuação',
        termFr: 'Évacuation',
        termDe: 'Evakuierung',
        termQu: 'Lluqsiy / Ayqiy',
        category: 'rescue',
        definitionEs: 'Desplazamiento ordenado de personas hacia una zona segura fuera de peligro.'
    },
    {
        termEs: 'Punto de Encuentro',
        termEn: 'Rendezvous Point / Assembly Point',
        termPt: 'Ponto de Encontro',
        termFr: 'Point de Ralliement',
        termDe: 'Sammelpunkt',
        termQu: 'Tinkuna pampa',
        category: 'shelter',
        definitionEs: 'Ubicación georreferenciada acordada previamente para reagrupar al equipo o comunidad.'
    },
    {
        termEs: 'Sismo / Terremoto',
        termEn: 'Earthquake',
        termPt: 'Terremoto',
        termFr: 'Séisme / Tremblement de terre',
        termDe: 'Erdbeben',
        termQu: 'Pacha kuyuy',
        category: 'hazard',
        definitionEs: 'Movimiento brusco de la tierra. Alejarse de ventanas y estructuras inestables.'
    },
    {
        termEs: 'Inundación',
        termEn: 'Flood',
        termPt: 'Inundação',
        termFr: 'Inondation',
        termDe: 'Überschwemmung',
        termQu: 'Lloqlla / Yaku hunt\'ay',
        category: 'hazard',
        definitionEs: 'Acumulación desmedida de agua en zonas secas. Buscar terreno elevado de inmediato.'
    },
    {
        termEs: 'Refugio de Emergencia',
        termEn: 'Emergency Shelter',
        termPt: 'Abrigo de Emergência',
        termFr: 'Abri d\'Urgence',
        termDe: 'Notunterkunft',
        termQu: 'Pakakuna wasi',
        category: 'shelter',
        definitionEs: 'Estructura segura equipada con insumos básicos para guarecer a la población.'
    },
    {
        termEs: 'Primeros Auxilios',
        termEn: 'First Aid',
        termPt: 'Primeiros Socorros',
        termFr: 'Premiers Secours',
        termDe: 'Erste Hilfe',
        termQu: 'Naypa yanapay',
        category: 'medical',
        definitionEs: 'Atención inmediata y temporal prestada a un herido antes de la llegada de médicos.'
    },
    {
        termEs: 'Agua Potable',
        termEn: 'Drinking Water / Potable Water',
        termPt: 'Água Potável',
        termFr: 'Eau Potable',
        termDe: 'Trinkwasser',
        termQu: "Ch'uya yaku",
        category: 'shelter',
        definitionEs: 'Agua apta para el consumo humano. Purificar con hervor de 3 min o 2 gotas de cloro por litro.'
    },
    {
        termEs: 'Baliza de Auxilio / SOS',
        termEn: 'Emergency Distress Beacon',
        termPt: 'Sinal de Socorro',
        termFr: 'Balise de Détresse',
        termDe: 'Notfunkbarke',
        termQu: 'Yanapay willakuq',
        category: 'communication',
        definitionEs: 'Señal continua de socorro emitida por radio mesh o señal visual para ubicación de rescate.'
    }
];

export class EmergencyGlossaryEngine {
    /**
     * Translates a term or phrase using deterministic off-grid dictionary matching
     */
    public static translate(text: string, targetLang: string = 'es'): { translatedText: string; matchType: 'exact' | 'keyword' | 'fallback' } {
        const query = text.trim().toLowerCase();
        const lang = targetLang.toLowerCase();

        if (!query) {
            return { translatedText: text, matchType: 'fallback' };
        }

        // Exact & Keyword Matching across all terms
        for (const entry of EMERGENCY_GLOSSARY) {
            const matchesQuery =
                entry.termEs.toLowerCase().includes(query) ||
                entry.termEn.toLowerCase().includes(query) ||
                entry.termPt.toLowerCase().includes(query) ||
                entry.termFr.toLowerCase().includes(query) ||
                entry.termDe.toLowerCase().includes(query) ||
                entry.termQu.toLowerCase().includes(query) ||
                query.includes(entry.termEs.toLowerCase()) ||
                query.includes(entry.termEn.toLowerCase());

            if (matchesQuery) {
                let targetTerm = entry.termEs;
                if (lang === 'en') targetTerm = entry.termEn;
                else if (lang === 'pt') targetTerm = entry.termPt;
                else if (lang === 'fr') targetTerm = entry.termFr;
                else if (lang === 'de') targetTerm = entry.termDe;
                else if (lang === 'qu') targetTerm = entry.termQu;

                return {
                    translatedText: `📖 [Traductor Táctico Off-Grid: ${entry.category.toUpperCase()}]\n\n• Término: ${targetTerm}\n• Definición: ${entry.definitionEs}\n• Referencias: ES (${entry.termEs}) | EN (${entry.termEn}) | QUE (${entry.termQu})`,
                    matchType: 'exact'
                };
            }
        }

        // Fallback for non-dictionary text: preserves text with clear off-grid indication
        return {
            translatedText: `🌐 [Traducción Táctica Off-Grid (${lang.toUpperCase()})]\n\n"${text}"\n\n(Nota: Texto fuera del glosario estándar de emergencia. Conservado exactamente para evitar alteración.)`,
            matchType: 'fallback'
        };
    }
}
