/**
 * RED EmergencyKnowledgeBase.ts — 100% Offline Tactical Emergency Knowledge Base
 * 
 * Contains verified emergency medical protocols (CPR, Hemorrhage, Fractures, Burns, Earthquakes, Fires)
 * and cosine similarity vector search for RAG (Retrieval-Augmented Generation).
 */

export interface KnowledgeFragment {
    id: string;
    title: string;
    category: 'medico' | 'sismo' | 'incendio' | 'evacuacion' | 'general';
    content: string;
    keywords: string[];
}

export const EMERGENCY_KNOWLEDGE_BASE: KnowledgeFragment[] = [
    {
        id: 'cpr_01',
        title: 'Reanimación Cardiopulmonar (RCP) en Adultos',
        category: 'medico',
        keywords: ['rcp', 'paro', 'cardiaco', 'respiracion', 'inconsciente', 'corazon', 'presion'],
        content: `PASOS DE RCP EN ADULTOS:
1. Verificar si la víctima responde y si respira con normalidad.
2. Si no responde ni respira, solicitar ayuda de inmediato por canal RED SOS.
3. Colocar a la víctima de espaldas sobre una superficie firme.
4. Iniciar 30 compresiones torácicas fuertes y rápidas en el centro del pecho (ritmo de 100-120 por minuto, profundidad 5-6 cm).
5. Dar 2 insuflaciones de rescate si se cuenta con entrenamiento.
6. Mantener el ciclo 30:2 ininterrumpidamente hasta la llegada de personal médico o desfibrilador.`
    },
    {
        id: 'hemorrhage_01',
        title: 'Control de Hemorragia Severa y Torniquete',
        category: 'medico',
        keywords: ['sangre', 'hemorragia', 'corte', 'sangrado', 'herida', 'torniquete', 'presion'],
        content: `CONTROL DE HEMORRAGIAS GRAVES:
1. Aplicar PRESIÓN DIRECTA sobre la herida con tela limpia o gasa sin soltar.
2. Mantener presión constante durante al menos 10 minutos continuos.
3. Si el sangrado persiste en una extremidad (brazo/pierna), aplicar TORNIQUETE a 5-7 cm por encima de la herida (nunca sobre articulaciones).
4. Ajustar el torniquete firmemente hasta detener por completo el sangrado arterial.
5. Anotar la hora exacta de colocación del torniquete.`
    },
    {
        id: 'fracture_01',
        title: 'Inmovilización de Fracturas y Traumatismos',
        category: 'medico',
        keywords: ['fractura', 'hueso', 'roto', 'brazo', 'pierna', 'inmovilizar', 'golpe'],
        content: `INMOVILIZACIÓN DE FRACTURAS:
1. NO intentar alinear ni acomodar el hueso roto.
2. Inmovilizar la extremidad lesionada en la posición en que se encuentre, abarcando la articulación superior e inferior.
3. Utilizar férulas improvisadas (tablas, cartón rígido, revistas enrolladas) sujetas con vendas o tiras de tela sin apretar en exceso.
4. Aplicar hielo envuelto en tela para reducir la inflamación.
5. Elevar la extremidad si no causa dolor severo.`
    },
    {
        id: 'earthquake_01',
        title: 'Protocolo de Seguridad ante Sismos y Derrumbes',
        category: 'sismo',
        keywords: ['sismo', 'terremoto', 'temblor', 'derrumbe', 'edificio', 'evacuar', 'triangulo'],
        content: `PROTOCOLO DE SISMO Y DERRUMBES:
1. DURANTE EL SISMO: Agacharse, Cubrirse la cabeza bajo un mueble resistente (mesa/escritorio) y Sujetarse hasta que cese el movimiento.
2. Alejarse de ventanas, espejos, objetos pesados o cables eléctricos.
3. DESPUÉS DEL SISMO: Evacuar ordenadamente por escaleras. NO usar ascensores.
4. Si queda atrapado: Mantener la calma, cubrir boca/nariz con tela, hacer ruidos periódicos golpeando tubos o estructuras.`
    },
    {
        id: 'fire_01',
        title: 'Evacuación y Primeros Auxilios en Incendios',
        category: 'incendio',
        keywords: ['fuego', 'incendio', 'humo', 'quemadura', 'evacuar', 'extintor', 'asfixia'],
        content: `PROTOCOLO DE INCENDIOS Y QUEMADURAS:
1. Desplazarse a gatas gateando pegado al suelo para evitar la inhalación de humo tóxico.
2. Proteger boca y nariz con un paño húmedo.
3. Antes de abrir una puerta, tocarla con el dorso de la mano; si está caliente, NO abrirla.
4. QUEMADURAS: Enfriar la zona con abundante agua limpia a temperatura ambiente durante 10-15 minutos. NO aplicar cremas, pasta de dientes ni hielo. Cubrir con gasa estéril.`
    }
];

/**
 * Calculo de Similitud de Coseno entre dos vectores de igual dimension
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
