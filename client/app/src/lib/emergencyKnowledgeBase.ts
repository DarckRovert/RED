/**
 * RED EmergencyKnowledgeBase.ts — 100% Offline Tactical Emergency Knowledge Base v31.0.0
 * 
 * Verified military and civilian tactical emergency protocols (Triage START, Hemorrhages,
 * CPR, Burns, Fractures, Water Purification, Hypothermia, CBRN, Collapses, RF Evasion,
 * Snakebites, Morse Signalling, Dead Man Switch).
 * 
 * Provides dense cosine similarity and hybrid token-frequency ranking for RAG
 * (Retrieval-Augmented Generation) without internet dependencies.
 */

export interface KnowledgeFragment {
    id: string;
    title: string;
    category: 'medico' | 'sismo' | 'incendio' | 'evacuacion' | 'supervivencia' | 'tactico' | 'cbrn' | 'comunicacion' | 'general';
    priorityLevel: 'CRITICO' | 'ALTO' | 'MEDIO';
    triageColor?: 'ROJO' | 'AMARILLO' | 'VERDE' | 'NEGRO';
    keywords: string[];
    summary: string;
    content: string;
    actionSteps: string[];
    vitalWarnings: string[];
}

export const EMERGENCY_KNOWLEDGE_BASE: KnowledgeFragment[] = [
    {
        id: 'triage_start_01',
        title: 'Protocolo de Triage START en Incidentes con Múltiples Víctimas',
        category: 'medico',
        priorityLevel: 'CRITICO',
        triageColor: 'ROJO',
        keywords: ['triage', 'start', 'victimas', 'masivo', 'clasificacion', 'rojo', 'amarillo', 'verde', 'negro', 'respiracion', 'pulso'],
        summary: 'Clasificación rápida de víctimas en <60 segundos mediante el algoritmo START (Simple Triage and Rapid Treatment).',
        content: `PROTOCOLO DE CLASIFICACIÓN TÁCTICA START:
1. EVACUACIÓN INICIAL (VERDES / LEVES):
   • Anunciar por megáfono o voz en alto: "Todos los que puedan caminar, diríjanse al punto seguro".
   • Clasificar automáticamente a quienes caminan como VERDE (Prioridad 3).

2. RESPIRACIÓN (VÍA AÉREA):
   • ¿Respira espontáneamente?
     - NO: Abrir vía aérea (maniobra frente-mentón). Si sigue sin respirar = NEGRO (Fallecido). Si empieza a respirar = ROJO (Inmediato).
     - SÍ: Contar frecuencia respiratoria:
       * Más de 30 respiraciones/min = ROJO (Inmediato).
       * Menos de 30 respiraciones/min = Pasar a evaluación circulatoria.

3. PERFUSIÓN / CIRCULACIÓN:
   • Evaluar llenado capilar en lecho ungueal o pulso radial:
     - Llenado capilar > 2 segundos o pulso radial ausente = ROJO (Inmediato). Controlar hemorragias masivas ya.
     - Llenado capilar < 2 segundos y pulso radial presente = Pasar a evaluación neurológica.

4. ESTADO NEUROLÓGICO (CONCIENCIA):
   • Orden sencilla: "Abra los ojos y apriete mi mano":
     - No responde o no obedece órdenes simples = ROJO (Inmediato).
     - Obedece órdenes simples = AMARILLO (Diferido / Urgente).`,
        actionSteps: [
            'Separar a los que caminan hacia zona verde segura.',
            'Evaluar respiración: si >30 rpm o requiere apertura de vía aérea -> Cinta Roja.',
            'Evaluar pulso radial y llenado capilar: si >2 seg -> Control de sangrado y Cinta Roja.',
            'Evaluar órdenes verbales simples: si no obedece -> Cinta Roja; si obedece -> Cinta Amarilla.',
            'Transmitir reporte METHANE o censo de víctimas por red mesh RED.'
        ],
        vitalWarnings: [
            'No gastar más de 60 segundos por víctima.',
            'La única intervención permitida durante el triage es apertura de vía aérea y torniquete compresivo.',
            'Las víctimas clasificadas como NEGRO no deben recibir RCP en incidentes con recursos limitados.'
        ]
    },
    {
        id: 'hemorrhage_arterial_01',
        title: 'Control de Hemorragia Arterial Exanguinante y Torniquete Táctico',
        category: 'medico',
        priorityLevel: 'CRITICO',
        triageColor: 'ROJO',
        keywords: ['hemorragia', 'sangre', 'torniquete', 'arterial', 'corte', 'sangrado', 'arteria', 'herida', 'presion', 'shock'],
        summary: 'Protocolo MARCH / TCCC para detención inmediata de hemorragias exanguinantes en extremidades y zonas de unión.',
        content: `CONTROL DE HEMORRAGIA MASIVA:
1. IDENTIFICACIÓN DE SANGRADO EXANGUINANTE:
   • Sangre roja brillante que brota a pulsos o empapa la ropa rápidamente.
   • Requiere acción en menos de 90 segundos para evitar colapso hipovolémico.

2. APLICACIÓN DE TORNIQUETE TÁCTICO (CAT / SOFTT / IMPROVISADO):
   • En situaciones de bajo fuego o emergencia: Colocar 5-7 cm por encima de la herida, directamente sobre la piel (NUNCA sobre la articulación/codo/rodilla).
   • Si la ubicación exacta del sangrado no es visible: Colocar "High and Tight" (lo más arriba y apretado posible en la raíz de la extremidad).
   • Girar el molinete/varilla con fuerza hasta que el sangrado arterial cese completamente y desaparezca el pulso distal.
   • Asegurar la varilla en el clip de retención.
   • Anotar la hora exacta de colocación con marcador en la frente de la víctima (ej: "T-14:35") o en la cinta del torniquete.

3. EMPAQUETAMIENTO DE HERIDAS EN ZONAS DE UNIÓN (AXILAS, INGLES, CUELLO):
   • Donde no se puede aplicar torniquete: Introducir gasa hemostática (o tela limpia) presionando directamente contra el vaso roto dentro de la cavidad de la herida.
   • Mantener presión manual directa ininterrumpida por mínimo 3 minutos (con gasa hemostática) o 10 minutos (con gasa estándar).
   • Aplicar vendaje compresivo elástico encima.`,
        actionSteps: [
            'Aplicar presión directa firme e inmediata con ambas manos.',
            'Colocar torniquete 5-7 cm proximal a la lesión hasta detener el flujo y pulso distal.',
            'Asegurar el molinete y registrar la hora exacta de aplicación.',
            'Para zonas de pliegues (ingle/axila), empaquetar la herida con gasa y mantener presión por 10 min.',
            'Abrigar a la víctima con manta térmica para prevenir la tríada letal del shock (hipotermia).'
        ],
        vitalWarnings: [
            'NUNCA aflojar periódicamente un torniquete colocado; retirar solo por personal quirúrgico.',
            'NUNCA colocar torniquetes sobre articulaciones óseas (rodillas o codos).',
            'La hipotermia destruye la cascada de coagulación: mantener a la víctima caliente siempre.'
        ]
    },
    {
        id: 'cpr_adult_01',
        title: 'Reanimación Cardiopulmonar (RCP) y Manejo de DEA en Adultos',
        category: 'medico',
        priorityLevel: 'CRITICO',
        triageColor: 'ROJO',
        keywords: ['rcp', 'cpr', 'paro', 'cardiaco', 'inconsciente', 'respiracion', 'corazon', 'compresiones', 'dea', 'desfibrilador'],
        summary: 'Soporte Vital Básico (SVB) con ciclo 30:2 de alta calidad y uso de desfibrilador externo.',
        content: `PROTOCOLO DE REANIMACIÓN CARDIOPULMONAR:
1. EVALUACIÓN DE SEGURIDAD Y RESPUESTA:
   • Verificar que la escena sea segura (sin cables expuestos, fuego ni gases).
   • Sacudir hombros con firmeza y preguntar: "¿Se encuentra bien?".
   • Si no responde y no respira normalmente (o solo jadea/boquea): Iniciar cadena de socorro en canal RED SOS.

2. COMPRESIONES TORÁCICAS DE ALTA CALIDAD:
   • Colocar el talón de una mano en el centro del tórax (mitad inferior del esternón) y la otra mano entrelazada encima.
   • Brazos rectos, hombros directamente sobre las manos.
   • Comprimir a una profundidad de 5 a 6 cm.
   • Frecuencia: 100 a 120 compresiones por minuto (ritmo de "Stayin' Alive").
   • Permitir la reexpansión torácica completa después de cada compresión sin despegar las manos.
   • Minimizar interrupciones a menos de 5 segundos.

3. CICLO 30:2 Y VENTILACIONES:
   • 30 compresiones seguidas de 2 insuflaciones de rescate de 1 segundo de duración con elevación visible del pecho.
   • Si no se dispone de barrera o entrenamiento: Realizar RCP continuo solo con las manos (Hands-Only CPR).

4. DESFIBRILADOR (DEA):
   • Encender el DEA y seguir las instrucciones de voz.
   • Colocar los parches en tórax descubierto seco (subclavicular derecho y lateral izquierdo).
   • Asegurar que nadie toque a la víctima durante el análisis y la descarga.`,
        actionSteps: [
            'Confirmar inconsciencia y ausencia de respiración normal en menos de 10 segundos.',
            'Transmitir baliza RED SOS con geolocalización de paro cardiorrespiratorio.',
            'Iniciar compresiones fuertes y rápidas (100-120/min, 5-6 cm profundidad).',
            'Alternar rescatistas cada 2 minutos para evitar la fatiga muscular.',
            'Conectar DEA tan pronto esté disponible.'
        ],
        vitalWarnings: [
            'No interrumpir compresiones para tomar pulsos dudosos.',
            'Asegurar superficie firme debajo de la espalda de la víctima.',
            'No tocar a la víctima durante la descarga del desfibrilador.'
        ]
    },
    {
        id: 'burns_thermal_chemical_01',
        title: 'Manejo de Quemaduras Térmicas, Químicas y Eléctricas',
        category: 'medico',
        priorityLevel: 'ALTO',
        triageColor: 'AMARILLO',
        keywords: ['quemadura', 'fuego', 'quimico', 'acido', 'calor', 'piel', 'ampolla', 'quemado', 'primeros auxilios', 'electrico'],
        summary: 'Enfriamiento inmediato, clasificación de profundidad (1°, 2°, 3° grado) y protección de barrera.',
        content: `PROTOCOLO DE ATENCIÓN DE QUEMADURAS:
1. QUEMADURAS TÉRMICAS (FUEGO, LÍQUIDOS CALIENTES, VAPOR):
   • Enfriar inmediatamente con agua corriente limpia a temperatura ambiente (15-20°C) durante 15 a 20 minutos continuos.
   • NUNCA usar agua helada ni hielo directo (causa vasoconstricción y profundiza la necrosis).
   • Retirar suavemente anillos, relojes y ropa no adherida antes de que comience el edema.
   • NO despegar ropa fundida o adherida a la piel.
   • NO reventar ampollas (flictenas) ya que actúan como apósito biológico estéril.
   • Cubrir con gasa estéril humedecida en solución salina o apósito plástico film transparente sin presionar.

2. QUEMADURAS QUÍMICAS (ÁCIDOS O BASES):
   • Si es químico seco en polvo: Cepillar en seco el polvo antes de aplicar agua.
   • Irrigar con abundante agua corriente a baja presión durante mínimo 20 a 30 minutos ininterrumpidos.
   • Retirar toda la ropa contaminada mientras se enjuaga.

3. QUEMADURAS ELÉCTRICAS:
   • Cortar la fuente de corriente antes de tocar a la víctima.
   • Evaluar orificio de entrada y de salida. Monitorear ritmo cardíaco por riesgo de fibrilación ventricular.`,
        actionSteps: [
            'Extinguir llamas rodando a la víctima o sofocando con manta ignífuga.',
            'Irrigar con agua limpia templada por 15-20 min continuos.',
            'Retirar joyas y prendas apretadas antes de la inflamación.',
            'Cubrir con apósito estéril no adherente o plástico film limpio.',
            'Hidratar oralmente con sales si está consciente y no hay sospecha de cirugía inmediata.'
        ],
        vitalWarnings: [
            'PROHIBIDO aplicar pasta dental, aceites, mantequilla, café o pomadas caseras.',
            'Nunca aplicar hielo directamente sobre la quemadura.',
            'Las quemaduras en cara, cuello, manos, genitales o >10% del cuerpo son de traslado crítico inmediato.'
        ]
    },
    {
        id: 'trauma_fractures_spine_01',
        title: 'Inmovilización de Fracturas, Luxaciones y Trauma Raquimedular',
        category: 'medico',
        priorityLevel: 'ALTO',
        triageColor: 'AMARILLO',
        keywords: ['fractura', 'hueso', 'inmovilizar', 'ferula', 'columna', 'cuello', 'trauma', 'luxacion', 'articulacion', 'yeso'],
        summary: 'Estabilización esquelética improvisada y control del eje cabeza-cuello-tronco.',
        content: `PROTOCOLO DE INMOVILIZACIÓN DE TRAUMA:
1. SOSPECHA DE TRAUMA DE COLUMNA / CERVICAL:
   • Mecanismos de riesgo: Caídas de altura, colisión vehicular, golpes directos en la cabeza o derrumbes.
   • Regla de oro: Mantener alineación neutra manual de la cabeza y cuello. NO rotar ni flexionar.
   • Traslado en bloque con mínimo 3 rescatistas coordinados.

2. FRACTURAS CERRADAS EN EXTREMIDADES:
   • Inmovilizar en la posición encontrada. NO intentar recolocar ni traccionar el hueso a menos que haya pérdida total de pulso distal en zonas aisladas.
   • La férula debe abarcar la articulación por encima y por debajo de la fractura.
   • Materiales improvisados: Tablas de madera, ramas rígidas, cartón corrugado grueso, revistas enrolladas.
   • Acolchar los espacios entre la férula y el miembro con tela suave. Sujetar con vendas sin cortar la circulación.

3. FRACTURAS EXPUESTAS (HUESO VISIBLE):
   • NO empujar el hueso hacia adentro de la herida.
   • Cubrir el hueso y la herida con apósito estéril húmedo.
   • Controlar sangrado periférico con compresión antes de ferulizar.`,
        actionSteps: [
            'Mantener inmovilización cervical manual si hay trauma de alta energía.',
            'Comprobar pulso distal, sensibilidad y motricidad antes y después de colocar la férula.',
            'Confeccionar férula rígida acolchada que cubra las dos articulaciones adyacentes.',
            'Elevar la extremidad inmovilizada si no causa dolor severo para reducir el edema.',
            'Aplicar frío local indirecto protegido con tela durante 15 minutos.'
        ],
        vitalWarnings: [
            'No intentar realinear fracturas cerca de articulaciones.',
            'No apretar vendajes al punto de eliminar el pulso o generar entumecimiento distal.',
            'Si hay pérdida de pulso o extremidad fría/azulada, aflojar el vendaje de inmediato.'
        ]
    },
    {
        id: 'water_purification_survival_01',
        title: 'Potabilización de Agua y Filtración Táctica de Supervivencia',
        category: 'supervivencia',
        priorityLevel: 'CRITICO',
        keywords: ['agua', 'potabilizar', 'purificar', 'filtro', 'cloro', 'hervir', 'sedimentos', 'carbon', 'desinfeccion', 'hidratacion'],
        summary: 'Métodos físicos y químicos para convertir agua contaminada en apta para consumo humano en crisis.',
        content: `PROTOCOLO DE PURIFICACIÓN DE AGUA EN EMERGENCIA:
1. PRE-FILTRACIÓN DE SEDIMENTOS Y TURBIDEZ:
   • El agua turbia reduce la efectividad de la desinfección química y solar.
   • Dejar reposar el agua en un contenedor durante 1-2 horas para que decanten los sólidos.
   • Filtrar a través de tela limpia doblada en 4 capas, filtro de café o camisa de algodón.
   • Filtro de supervivencia por capas (de arriba a abajo en una botella invertida):
     1. Algodón / tela en el cuello de la botella.
     2. Carbón vegetal triturado (absorbe toxinas y olores).
     3. Arena fina limpia.
     4. Arena gruesa.
     5. Grava / piedras pequeñas.

2. DESINFECCIÓN TÉRMICA (HERVIDO):
   • Método más seguro contra bacterias, virus y parásitos protozoarios (Giardia/Cryptosporidium).
   • Hervir a borbotones continuos durante 1 minuto a nivel del mar; 3 minutos a altitudes >2.000 metros.
   • Dejar enfriar tapado y airear vertiéndolo entre dos recipientes limpios para recuperar oxígeno.

3. DESINFECCIÓN QUÍMICA (CLORO / LEJÍA DOMÉSTICA AL 5% SIN AROMATIZANTES):
   • Agua clara: 2 a 3 gotas de cloro por litro de agua (o 1 gota por cada medio litro).
   • Agua fría o ligeramente turbia: 4 a 5 gotas por litro.
   • Mezclar y dejar reposar 30 minutos tapado. Debe oler ligeramente a cloro; si no huele, repetir dosis y esperar 15 min más.

4. DESINFECCIÓN SOLAR (MÉTODO SODIS):
   • Llenar botellas PET transparentes de hasta 2 litros y exponerlas horizontalmente a luz solar directa durante 6 horas (días soleados) o 48 horas (días nublados).`,
        actionSteps: [
            'Filtrar sedimentos gruesos con tela o filtro multicapa de arena y carbón.',
            'Hervir a ebullición vigorosa por 1 a 3 minutos.',
            'Si no hay fuego: dosificar 2 gotas de cloro puro al 5% por litro y esperar 30 minutos.',
            'Almacenar en recipientes cerrados desinfectados lejos del suelo.'
        ],
        vitalWarnings: [
            'El hervido y el cloro NO eliminan químicos industriales, metales pesados ni sal marina.',
            'NUNCA consumir agua de mar sin destilación previa (acelera la deshidratación y falla renal).',
            'NUNCA usar lejía con perfumes, detergentes o jabón añadido.'
        ]
    },
    {
        id: 'hypothermia_heatstroke_01',
        title: 'Manejo de Hipotermia Severa y Golpe de Calor (Shock Térmico)',
        category: 'medico',
        priorityLevel: 'CRITICO',
        triageColor: 'ROJO',
        keywords: ['hipotermia', 'frio', 'golpe de calor', 'calor', 'temperatura', 'manta termica', 'shock', 'deshidratacion', 'insolacion'],
        summary: 'Reanimación térmica gradual y enfriamiento de emergencia ante descompensación termorreguladora.',
        content: `PROTOCOLO DE EMERGENCIAS TÉRMICAS:
1. HIPOTERMIA (TEMPERATURA CORPORAL < 35°C):
   • Signos: Temblores incontrolables (etapa 1), pérdida de temblores con confusión y letargo (etapa 2/3 crítica).
   • Acción inmediata: Retirar ropa húmeda y reemplazar por ropa seca.
   • Aislar del suelo frío usando mochilas, ramas o colchonetas.
   • Envolver en manta térmica aluminizada (lado dorado hacia afuera, plateado hacia el cuerpo para reflejar el 90% del calor radiante).
   • Recalentamiento pasivo y activo central: Aplicar botellas con agua tibia envueltas en tela en las axilas, ingles y cuello (NUNCA en extremidades para evitar el shock por "afterdrop" de sangre fría al corazón).
   • Si está consciente: Administrar bebidas tibias azucaradas (NUNCA alcohol ni cafeína).

2. GOLPE DE CALOR / HIPERTERMIA (> 40°C):
   • Signos: Piel caliente y seca (o sudoración profusa), confusión, mareo, pulso rápido, pérdida de conciencia.
   • Emergencia con riesgo de daño cerebral en minutos.
   • Trasladar de inmediato a la sombra y aflojar ropa.
   • Enfriamiento activo rápido: Rociar con agua templada/fresca y abanicar vigorosamente.
   • Colocar compresas frías en cuello, axilas e ingles.
   • NO sumergir en hielo si está inconsciente para no inducir temblores ni convulsiones.`,
        actionSteps: [
            'Hipotermia: Retirar prendas húmedas, aislar del suelo y colocar manta aluminizada.',
            'Calentar el núcleo del cuerpo (axilas, ingle, cuello); no frotar las extremidades.',
            'Golpe de calor: Mover a la sombra, enfriar con compresas húmedas y ventilación rápida.',
            'Monitorear signos vitales continuamente por canal RED.'
        ],
        vitalWarnings: [
            'En hipotermia severa, NO calentar extremidades primero (evita colapso cardíaco).',
            'NUNCA dar bebidas alcohólicas a una víctima con hipotermia (el alcohol causa vasodilatación y pérdida acelerada de calor).',
            'En golpe de calor, no usar antipiréticos (paracetamol/ibuprofeno) porque no es fiebre bacteriana.'
        ]
    },
    {
        id: 'hazmat_cbrn_01',
        title: 'Protocolo de Autoprotección y Repliegue ante Amenaza QBRN / HazMat',
        category: 'cbrn',
        priorityLevel: 'CRITICO',
        triageColor: 'ROJO',
        keywords: ['qbrn', 'cbrn', 'quimico', 'gas', 'biologico', 'radiologico', 'nuclear', 'hazmat', 'toxico', 'descontaminacion', 'mascara'],
        summary: 'Medidas de supervivencia inmediata ante fuga química industrial, agentes biológicos o radiación.',
        content: `PROTOCOLO DE AUTOPROTECCIÓN QBRN (CBRN):
1. REGLA DE SUPERVIVENCIA: DISTANCIA, VIENTO Y TIEMPO:
   • Moverse de inmediato en dirección PERPENDICULAR (cruzada) al viento y hacia terreno ELEVADO (los gases densos se acumulan en hondonadas, sótanos y alcantarillas).
   • Mantener distancia visual mínima cubriendo la fuente con el pulgar extendido a la distancia del brazo.

2. PROTECCIÓN RESPIRATORIA IMPROVISADA:
   • Cubrir nariz y boca con tela de microfibra o algodón doblada en múltiples capas humedecida ligeramente con agua o solución de bicarbonato.
   • Sellar ojos con gafas protectoras herméticas o de natación.

3. REFUGIO EN INTERIORES (SHELTER-IN-PLACE):
   • Ingresar al piso más alto disponible (lejos del suelo para químicos densos) o habitación interior sin ventanas.
   • Apagar sistemas de aire acondicionado, calefacción y ventilación forzada.
   • Sellar ranuras de puertas y ventanas con cinta adhesiva resistente o toallas húmedas.

4. DESCONTAMINACIÓN PERSONAL RÁPIDA:
   • Retirar la ropa exterior cortándola con tijeras (evitar pasarla por la cabeza para no contaminar ojos/vías respiratorias). Desechar en bolsa doble.
   • Lavar la piel con agua tibia abundante y jabón suave sin frotar con fuerza para no abrir microlesiones en la epidermis.
   • Irrigar ojos con agua limpia desde el lagrimal hacia el exterior durante 15 minutos.`,
        actionSteps: [
            'Evacuar en ángulo de 90° respecto a la dirección del viento hacia terreno alto.',
            'Colocar protección respiratoria de varias capas y gafas selladas.',
            'Refugiarse en habitación sellada con cinta adhesiva y ventilación apagada.',
            'Descontaminar piel con lavado de agua y jabón sin frotar; cortar ropa.',
            'Difundir coordenadas de la nube tóxica por canal de alerta RED Mesh.'
        ],
        vitalWarnings: [
            'NO refugiarse en sótanos ante fugas de cloro, propano o gases químicos pesados.',
            'NO retirar ropa tirando de ella por encima de la cara.',
            'NO usar lejía ni productos químicos agresivos directamente sobre la piel.'
        ]
    },
    {
        id: 'earthquake_structural_collapse_01',
        title: 'Protocolo en Terremotos, Derrumbes y Estructuras Colapsadas',
        category: 'sismo',
        priorityLevel: 'CRITICO',
        keywords: ['sismo', 'terremoto', 'derrumbe', 'colapso', 'escombros', 'atrapado', 'triangulo de vida', 'edificio', 'evacuacion'],
        summary: 'Técnicas de protección durante la sacudida y tácticas de supervivencia y localización acústica bajo escombros.',
        content: `PROTOCOLO ANTE SISMOS Y COLAPSO ESTRUCTURAL:
1. DURANTE EL MOVIMIENTO (REGLA INTERNACIONAL):
   • AGACHARSE, CUBRIRSE y SUJETARSE bajo un escritorio o mesa de madera maciza.
   • Si no hay muebles: Agacharse en una esquina interior o junto a una pared maestra de carga protegiendo cabeza y cuello con ambos brazos.
   • Alejarse de ventanas de vidrio, espejos, estantes altos y cables de alta tensión.
   • NUNCA intentar salir corriendo durante la sacudida (la caída de cornisas, vidrios y mampostería exterior causa el 70% de las muertes).
   • NUNCA usar ascensores.

2. POST-SISMO Y EVACUACIÓN:
   • Cerrar llaves maestras de gas y electricidad para prevenir incendios secundarios.
   • Evacuar ordenadamente por escaleras calzando calzado resistente.
   • Dirigirse a zonas abiertas despejadas de cables y fachadas inestables.

3. SI QUEDA ATRAPADO BAJO ESCOMBROS:
   • Proteger vías respiratorias cubriendo boca y nariz con tela para evitar asfixia por polvo de concreto.
   • Mantener la calma y racionar el oxígeno: respirar lento y pausado.
   • NO encender fósforos ni encendedores por posible acumulación de gas. Usar linterna de bajo consumo o baliza RED SOS.
   • SEÑALIZACIÓN ACÚSTICA TÁCTICA: Golpear rítmicamente tubos metálicos o estructuras sólidas (3 golpes repetidos a intervalos) en lugar de gritar continuamente para preservar energía y cuerdas vocales.`,
        actionSteps: [
            'Agacharse, cubrirse bajo estructura firme y sujetarse durante el sismo.',
            'Evacuar por escaleras tras el sismo cerrando suministros de gas y energía.',
            'Si queda atrapado: Tapar boca/nariz contra el polvo y evitar movimientos bruscos.',
            'Emitir señales acústicas golpeando metal o tuberías en secuencias de 3.',
            'Activar baliza acústica SoundMesh en la app RED para geolocalización por audio.'
        ],
        vitalWarnings: [
            'No encender llamas abiertas bajo escombros (riesgo de explosión de gas).',
            'No usar elevadores bajo ninguna circunstancia.',
            'Cuidado con las réplicas: una estructura dañada puede colapsar con movimientos menores.'
        ]
    },
    {
        id: 'wildfire_evacuation_01',
        title: 'Escape y Supervivencia en Incendios Forestales e Incendios Urbanos',
        category: 'incendio',
        priorityLevel: 'CRITICO',
        triageColor: 'ROJO',
        keywords: ['incendio', 'fuego', 'forestal', 'humo', 'evacuar', 'quemadura', 'asfixia', 'viento', 'cortafuegos'],
        summary: 'Tácticas de repliegue contra viento, zonas de seguridad quemadas y prevención de asfixia por monóxido de carbono.',
        content: `PROTOCOLO DE ESCAPE ANTE INCENDIOS FORESTALES:
1. DIRECCIÓN Y DINÁMICA DEL FUEGO:
   • El fuego sube pendientes con extrema rapidez (el calor precalienta la vegetación superior). NUNCA intentar subir cerro arriba para escapar de un incendio que viene desde la base.
   • Moverse lateralmente cruzando la dirección del viento o hacia zonas ya completamente quemadas (área negra / "black zone" donde ya no queda combustible vegetal).

2. REFUGIO DE ÚLTIMO RECURSO EN CAMPO ABIERTO:
   • Buscar lechos de ríos secos, claros rocosos o carreteras pavimentadas amplias.
   • Despejar la vegetación alrededor de su posición.
   • Tenderse boca abajo en el suelo (el aire más frío y oxigenado permanece a 10-15 cm del piso).
   • Cubrirse con manta ignífuga aluminizada o tierra húmeda dejando espacio respirable.

3. EVACUACIÓN EN VEHÍCULOS:
   • Encender luces de cruce e intermitentes de emergencia. Cerrar ventanas y activar recirculación de aire interior.
   • Conducir despacio; si el humo bloquea la visión, detenerse lejos de vegetación densa, apagar el motor y permanecer agachado en el suelo del vehículo.`,
        actionSteps: [
            'Monitorear dirección del viento y avanzar en sentido perpendicular o hacia zona negra.',
            'Descender hacia valles o zonas bajas; nunca huir cuesta arriba por cañones.',
            'Cubrir vías respiratorias con paño húmedo; tenderse a ras del suelo ante humo espeso.',
            'Retirar material combustible alrededor del perímetro de refugio.',
            'Transmitir ruta de escape por la red mesh para orientar a otros nodos.'
        ],
        vitalWarnings: [
            'El humo y los gases tóxicos matan antes que las llamas: gatear a ras del suelo.',
            'Los cañones y quebradas actúan como chimeneas térmicas mortales.',
            'La ropa sintética (poliéster/nylon) se funde con la piel: usar algodón, lana o mezclilla pesada.'
        ]
    },
    {
        id: 'flood_swiftwater_01',
        title: 'Rescate e Hidrodinámica de Supervivencia en Inundaciones y Riadas',
        category: 'evacuacion',
        priorityLevel: 'ALTO',
        keywords: ['inundacion', 'agua', 'riada', 'desborde', 'rio', 'corriente', 'rescate', 'flotar', 'ahogamiento', 'evacuar'],
        summary: 'Medidas de seguridad ante crecidas repentinas, posición defensiva en corrientes y escape vehicular.',
        content: `PROTOCOLO DE SEGURIDAD EN INUNDACIONES:
1. FUERZA DEL AGUA Y PROFUNDIDAD ENGAÑOSA:
   • Solo 15 cm de agua en movimiento rápido pueden derribar a un adulto.
   • Solo 30 cm de corriente pueden arrastrar un vehículo compacto; 60 cm arrastran camionetas SUV.
   • NUNCA intentar vadear ni cruzar corrientes a pie ni en vehículo ("Turn around, don't drown").

2. POSICIÓN DEFENSIVA EN CORRIENTES DE AGUA RÁPIDA:
   • Si cae a una corriente: Adoptar posición decúbito supino (espalda al agua) con los pies apuntando hacia abajo en dirección de la corriente.
   • Mantener pies elevados cerca de la superficie para evitar "atrapamiento de pie" entre rocas del fondo.
   • Usar los brazos como remos para orientarse en ángulo de 45° respecto a la orilla.

3. ESCAPE DE VEHÍCULO SUMERGIDO:
   • Ventana de oportunidad: Menos de 60 segundos antes de que el agua alcance el nivel de las ventanas.
   • Secuencia rápida: Desabrochar cinturón de seguridad -> Bajar o romper ventana lateral -> Salir de inmediato.
   • Romper esquinas de ventanas laterales usando un punzón de tungsteno o el reposacabezas del asiento (el parabrisas delantero es laminado y no se romperá).`,
        actionSteps: [
            'Evacuar hacia pisos superiores o terreno elevado antes de que la corriente suba.',
            'Desconectar el interruptor eléctrico general antes de que el agua alcance tomas de corriente.',
            'En el agua: Flotar de espaldas con pies hacia adelante y orientarse en 45° a la orilla.',
            'En vehículos sumergidos: Romper ventanas laterales inmediatamente y escapar.'
        ],
        vitalWarnings: [
            'No caminar en aguas de inundación que puedan ocultar alcantarillas abiertas o cables con electricidad.',
            'El agua de inundación contiene bacterias fecales e hidrocarburos: no tragar ni lavar heridas.',
            'Nunca intentar nadar contra la corriente principal; nadar diagonalmente hacia la orilla.'
        ]
    },
    {
        id: 'rf_detection_evasion_01',
        title: 'Técnicas de Evasión RF, Control de Emisiones (EMCON) y Seguridad Mesh',
        category: 'tactico',
        priorityLevel: 'ALTO',
        keywords: ['rf', 'emcon', 'senales', 'rastreo', 'triangulacion', 'antena', 'ble', 'mesh', 'lora', 'radiofrecuencia', 'seguridad'],
        summary: 'Disciplina electromagnética táctica para operar nodos de radio sin ser detectado por triangulación espectral.',
        content: `PROTOCOLO DE CONTROL DE EMISIONES ELECTROMAGNÉTICAS (EMCON):
1. PRINCIPIO DE MÍNIMA POTENCIA Y RÁFAGA CORTA (BURST TRANSMISSION):
   • Las transmisiones continuas permiten a receptores SDR e interceptores RDF triangular la ubicación del nodo en segundos.
   • Transmitir paquetes en ráfagas breves (< 200 ms) usando frecuencias pseudoaleatorias o intervalos variables.
   • Configurar la potencia de transmisión de BLE / WiFi Direct / LoRa al nivel mínimo necesario para alcanzar el siguiente nodo de la malla.

2. BLINDAJE PASIVO Y ANTENAS DIRECCIONALES:
   • Usar bolsas Faraday o jaulas metálicas cuando no se transmitan mensajes.
   • Construir reflectores cantoneros o antenas direccionales improvisadas (Yagi / Cantenna) para enfocar el lóbulo de radiación únicamente hacia el nodo receptor, reduciendo la fuga de señal a 360°.

3. MODO ESCUCHA PASIVA (SNIFFER DEFENSIVO):
   • Mantener el nodo en modo receptor pasivo hasta que existan paquetes para retransmitir por DTN Store-and-Forward.`,
        actionSteps: [
            'Ajustar la potencia de transmisión RF al umbral mínimo en los ajustes de RED.',
            'Agrupar mensajes y enviarlos en una sola ráfaga cifrada compacta.',
            'Utilizar apantallamiento direccional con láminas metálicas para bloquear lóbulos secundarios.',
            'Cambiar periódicamente la ubicación física tras transmisiones críticas.'
        ],
        vitalWarnings: [
            'Cualquier transmisión por aire es interceptable físicamente; el cifrado Noise E2E protege el contenido, pero el EMCON protege la ubicación.',
            'Evitar transmitir desde el mismo punto geográfico por periodos prolongados.',
            'Apagar Bluetooth y WiFi en el sistema operativo del teléfono si se transita por zonas de cerco hostil.'
        ]
    },
    {
        id: 'snakebite_envenomation_01',
        title: 'Protocolo de Manejo de Mordeduras de Serpientes Venenosas',
        category: 'medico',
        priorityLevel: 'CRITICO',
        triageColor: 'ROJO',
        keywords: ['serpiente', 'mordedura', 'veneno', 'vibora', 'envenenamiento', 'antiofidico', 'primeros auxilios', 'herida'],
        summary: 'Inmovilización por vendaje compresivo, reposo absoluto y mitos peligrosos a evitar en envenenamiento ofídico.',
        content: `PROTOCOLO DE ATENCIÓN ANTE MORDEDURA DE SERPIENTE:
1. ACCIONES VITALES INMEDIATAS:
   • Alejarse de la serpiente (las serpientes pueden volver a morder). NO intentar capturarla ni matarla.
   • Tomar una fotografía segura o memorizar características (color, forma de cabeza, patrones) para identificar el suero antiofídico específico.
   • Mantener a la víctima en REPOSO ABSOLUTO. El pánico y el movimiento aceleran la absorción del veneno por el sistema linfático.
   • Mantener la extremidad afectada a la altura del corazón o ligeramente por debajo (NUNCA por encima).
   • Retirar inmediatamente anillos, pulseras, zapatos y ropa apretada antes de que inicie el edema masivo.

2. INMOVILIZACIÓN POR VENDAJE COMPRESIVO (MÉTODO AUSTRALIANO PARA NEUROTOXINAS):
   • Aplicar vendaje elástico continuo desde los dedos hacia la raíz de la extremidad con una presión similar a la de un vendaje de esguince (debe permitir deslizar un dedo por debajo).
   • Inmovilizar con una férula rígida para impedir que la articulación se mueva.

3. MONITOREO CLÍNICO:
   • Marcar con bolígrafo el borde de la hinchazón cada 15 minutos anotando la hora para registrar la progresión del veneno.`,
        actionSteps: [
            'Tranquilizar a la víctima y colocarla en reposo absoluto horizontal.',
            'Retirar joyas y prendas compresivas en la extremidad.',
            'Lavar suavemente la herida con agua y jabón; no frotar.',
            'Inmovilizar la extremidad completa con férula para evitar bombeo muscular.',
            'Marcar el límite del edema cada 15 minutos y transmitir ficha clínica por RED.'
        ],
        vitalWarnings: [
            'PROHIBIDO hacer cortes o incisiones sobre la mordedura.',
            'PROHIBIDO intentar succionar el veneno con la boca o dispositivos de vacío.',
            'PROHIBIDO aplicar torniquetes arteriales para mordeduras de víboras citotóxicas (causa necrosis masiva y amputación).',
            'PROHIBIDO aplicar hielo o descargas eléctricas.'
        ]
    },
    {
        id: 'sos_optical_acoustic_signaling_01',
        title: 'Protocolos de Señalización de Socorro Óptica, Morse y Acústica',
        category: 'comunicacion',
        priorityLevel: 'ALTO',
        keywords: ['sos', 'morse', 'senales', 'socorro', 'baliza', 'linterna', 'espejo', 'rescate', 'luz', 'silbato', 'antorcha'],
        summary: 'Patrones estandarizados internacionales de auxilio óptico (Flash LED Morse SOS), acústico y visual.',
        content: `CÓDIGOS INTERNACIONALES DE SEÑALIZACIÓN DE RESCATE:
1. CÓDIGO MORSE SOS LUMINOSO Y ACÚSTICO ( • • • — — — • • • ):
   • 3 Pulsos Cortos (DITS): 0.2 segundos de luz/sonido cada uno.
   • Pausa entre letras: 0.6 segundos.
   • 3 Pulsos Largos (DAHS): 0.6 segundos de luz/sonido cada uno.
   • Pausa entre letras: 0.6 segundos.
   • 3 Pulsos Cortos (DITS): 0.2 segundos cada uno.
   • Pausa entre ciclos SOS completos: 2.0 a 3.0 segundos antes de repetir.

2. SEÑALES ACÚSTICAS DE MONTAÑA Y SILBATO DE EMERGENCIA:
   • SEÑAL DE SOCORRO: 6 pitidos fuertes espaciados uniformemente en 1 minuto, seguido de 1 minuto de silencio absoluto para escuchar respuestas. Repetir.
   • SEÑAL DE RESPUESTA DE RESCATISTAS: 3 pitidos por minuto seguidos de 1 minuto de pausa.

3. ESPEJO DE SEÑALES / HELIÓGRAFO:
   • Visible a más de 30 km en días despejados.
   • Apuntar con dos dedos en "V" hacia la aeronave o rescatistas y hacer coincidir el destello en el centro.

4. SEÑALES EN TIERRA PARA AERONAVES (SÍMBOLOS TIERRA-AIRE):
   • " V " : Requiere asistencia / auxilio.
   • " X " : Requiere asistencia médica urgente.
   • " Y " : Sí / Afirmativo.
   • " N " : No / Negativo.
   • " -> " : Dirección de desplazamiento.`,
        actionSteps: [
            'Activar la baliza Flash LED Camera2 Morse SOS en el módulo de supervivencia de RED.',
            'Alternar con secuencias de silbato de 6 pitidos por minuto.',
            'En campo abierto: trazar letras gigantes V o X usando rocas o telas contrastantes.',
            'Mantener el ciclo activo durante sobrevuelos o aproximación de equipos SAR.'
        ],
        vitalWarnings: [
            'No apuntar lásers directos a cabinas de helicópteros o aeronaves de rescate.',
            'Asegurar pausas de silencio para poder escuchar gritos o señales de rescatistas.',
            'Proteger la batería del teléfono apagando la pantalla mientras el flash morse corre en background.'
        ]
    },
    {
        id: 'dead_man_switch_ops_01',
        title: 'Operación Táctica del Interruptor del Hombre Muerto (DMS) y Purga Anti-Forense',
        category: 'tactico',
        priorityLevel: 'CRITICO',
        keywords: ['dms', 'hombre muerto', 'purga', 'autodestruccion', 'seguridad', 'panico', 'keystore', 'borrado', 'criptografia'],
        summary: 'Gestión del temporizador de hombre muerto y protocolo de borrado de llaves en captura inminente.',
        content: `PROTOCOLO DEL INTERRUPTOR DEL HOMBRE MUERTO (DEAD MAN'S SWITCH):
1. PRINCIPIO OPERATIVO:
   • Mecanismo de seguridad que comprueba la presencia activa del operador mediante un "Check-in" periódico cifrado (ej: cada 12, 24 o 48 horas).
   • Si el operador no ingresa su PIN maestro antes del vencimiento del temporizador, el sistema deduce incapacidad, detención o secuestro.

2. ACCIONES AUTOMATIZADAS AL EXPIRAR EL TEMPORIZADOR:
   • Opción A (Difusión Póstuma Cifrada): Transmite automáticamente un paquete de emergencia con ubicación previa y mensajes preparados a contactos verificados de confianza.
   • Opción B (Purga Criptográfica Zero-Trace): Sobrescribe la base de datos Sled local con entropía criptográfica (ceros y ruido aleatorio) y borra las llaves de Android KeyStore.

3. PIN DE PÁNICO VS PIN SEÑUELO:
   • PIN DE PÁNICO: Ingresar este código en la pantalla de bloqueo ejecuta inmediatamente la autodestrucción silenciosa sin emitir alertas visibles en pantalla.
   • PIN SEÑUELO: Inicia una sesión limpia y simulada con chats ficticios para inspecciones forzadas.`,
        actionSteps: [
            'Configurar el intervalo de Check-in en el panel de Seguridad Zero-Trust de RED.',
            'Establecer contactos de confianza en la libreta soberana para difusión de contingencia.',
            'Memorizar el PIN de pánico para borrado de emergencia en caso de confiscación del dispositivo.',
            'Verificar periódicamente el estado del temporizador en la barra de estado.'
        ],
        vitalWarnings: [
            'La purga criptográfica es IRREVERSIBLE: no existe mecanismo de recuperación sin respaldo externo.',
            'No compartir el PIN de pánico ni el PIN señuelo por canales inseguros.'
        ]
    }
];

/**
 * Calculo de Similitud de Coseno entre dos vectores de igual dimension
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
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

/**
 * Normaliza y tokeniza una cadena en palabras clave relevantes eliminando stopwords comunes en español
 */
export function tokenizeQuery(text: string): string[] {
    const stopwords = new Set([
        'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para',
        'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o',
        'este', 'sí', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'también',
        'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos',
        'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'esto', 'cómo',
        'hacer', 'hago', 'tratar', 'debo', 'puedo', 'cuál', 'qué', 'pasos', 'guía', 'ayuda'
    ]);

    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/i)
        .filter(w => w.length > 2 && !stopwords.has(w));
}

/**
 * Búsqueda léxica y semántica híbrida de fragmentos de conocimiento táctico
 */
export function searchKnowledgeBaseLexical(query: string): { fragment: KnowledgeFragment; score: number }[] {
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) return [];

    const results: { fragment: KnowledgeFragment; score: number }[] = [];

    for (const frag of EMERGENCY_KNOWLEDGE_BASE) {
        let score = 0;
        const fragTokens = new Set([
            ...frag.keywords,
            ...tokenizeQuery(frag.title),
            ...tokenizeQuery(frag.summary),
        ]);

        for (const token of tokens) {
            if (fragTokens.has(token)) {
                score += 3.0; // Coincidencia exacta de token clave
            } else {
                for (const fk of fragTokens) {
                    if (fk.includes(token) || token.includes(fk)) {
                        score += 1.2;
                        break;
                    }
                }
            }
        }

        // Búsqueda en contenido completo
        const lowerContent = frag.content.toLowerCase();
        for (const token of tokens) {
            if (lowerContent.includes(token)) {
                score += 0.8;
            }
        }

        if (score > 0) {
            results.push({ fragment: frag, score });
        }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
}
