/**
 * HallOfFameData.ts — RED Sovereign Mesh OS
 * 
 * Registro canónico del Salón de la Fama, Créditos de Autoría y Atribución
 * de Licencias de Código Abierto (Open Source Attribution).
 * 
 * Rinde homenaje al creador principal y a todos los investigadores, desarrolladores
 * independientes y proyectos upstream cuyos protocolos, primitivas criptográficas,
 * arquitecturas de radiofrecuencia y motores bio-neuromórficos hacen posible RED OS.
 */

export type CreditCategory = 
    | "CORE" 
    | "CRYPTO" 
    | "RF_MESH" 
    | "NEURO" 
    | "MEDICINE" 
    | "GIS_WEB" 
    | "COMMUNITY";

export interface HallOfFameEntry {
    id: string;
    name: string;
    handleOrEntity?: string;
    role: string;
    category: CreditCategory;
    contribution: string;
    honorQuote: string;
    url?: string;
    license?: string;
    licenseType?: "MIT" | "AGPL-3.0" | "GPL-3.0" | "Apache-2.0" | "BSD" | "Public Domain" | "Standard";
    badgeText?: string;
}

export const HALL_OF_FAME_CATEGORIES: { id: CreditCategory | "ALL"; label: string; icon: string }[] = [
    { id: "ALL", label: "Todos", icon: "🌐" },
    { id: "CORE", label: "Autoría & Núcleo", icon: "🏛️" },
    { id: "CRYPTO", label: "Criptografía & PQC", icon: "🔐" },
    { id: "RF_MESH", label: "Radio & Malla LoRa", icon: "📻" },
    { id: "NEURO", label: "Biocibernética & Conectoma", icon: "🧠" },
    { id: "MEDICINE", label: "Triage Táctico MARCH", icon: "🚑" },
    { id: "GIS_WEB", label: "Cartografía & Runtime", icon: "🗺️" },
    { id: "COMMUNITY", label: "Comunidad & Operadores", icon: "🛡️" },
];

export const HALL_OF_FAME_ENTRIES: HallOfFameEntry[] = [
    // ─── 1. AUTORÍA Y NÚCLEO ARQUITECTÓNICO ───────────────────────────────────
    {
        id: "darckrovert",
        name: "Rodrigo Alejandro Vega Rojas",
        handleOrEntity: "DarckRovert",
        role: "Creador, Diseñador y Arquitecto Principal de Software",
        category: "CORE",
        contribution: "Diseño conceptual integral de RED Sovereign Mesh OS, orquestador neuromórfico del conectoma biológico, gobernador de enlaces cognitivos, protocolo de coacción Zeroize y arquitectura soberana Local-First.",
        honorQuote: "«La verdadera soberanía digital nace cuando las comunicaciones no dependen de satélites extranjeros, torres corporativas ni tendidos eléctricos vulnerables.»",
        url: "https://github.com/DarckRovert",
        license: "AGPL-3.0",
        licenseType: "AGPL-3.0",
        badgeText: "CREADOR / LÍDER",
    },
    {
        id: "red-mesh-team",
        name: "RED Sovereign Mesh Research & Core Team",
        handleOrEntity: "RED Project Core",
        role: "Equipo de Investigación & Ingeniería de Sistemas Críticos",
        category: "CORE",
        contribution: "Desarrollo del nodo de alta concurrencia en Rust (red-node), suite de resiliencia estocástica de malla, puente serie para hardware LoRa y motores de interfaz táctica PWA/Android.",
        honorQuote: "«Construido para el colapso, verificado para la supervivencia humana.»",
        url: "https://github.com/DarckRovert/RED",
        license: "AGPL-3.0",
        licenseType: "AGPL-3.0",
        badgeText: "CORE TEAM",
    },

    // ─── 2. CRIPTOGRAFÍA & MATEMÁTICAS PURAS ─────────────────────────────────
    {
        id: "paul-miller",
        name: "Paul Miller",
        handleOrEntity: "@paulmillr / noble-cryptography",
        role: "Autor de @noble/hashes, @noble/curves y @noble/ciphers",
        category: "CRYPTO",
        contribution: "Implementación en TypeScript puro de algoritmos criptográficos auditados de alto rendimiento sin dependencias externas: SHA-256, Ed25519, ChaCha20-Poly1305 y AES-GCM.",
        honorQuote: "«Criptografía moderna en JS con cero dependencias, auditabilidad extrema y defensas contra ataques de temporización.»",
        url: "https://github.com/paulmillr",
        license: "Licencia MIT",
        licenseType: "MIT",
        badgeText: "CRIPTO CORE",
    },
    {
        id: "crystals-kyber-team",
        name: "Equipo CRYSTALS-Kyber / NIST ML-KEM",
        handleOrEntity: "Peter Schwabe, Roberto Avanzi, Joppe Bos, Léo Ducas, Eike Kiltz, et al.",
        role: "Pioneros en Criptografía Post-Cuántica (PQC)",
        category: "CRYPTO",
        contribution: "Diseño matemático del algoritmo de encapsulación de claves basado en retículos en módulos (Module-LWE), estandarizado por el NIST como FIPS 203 (ML-KEM-768), base del blindaje post-cuántico de RED.",
        honorQuote: "«Inmunidad matemática para que las comunicaciones de hoy resistan los supercomputadores cuánticos del mañana.»",
        url: "https://pq-crystals.org/kyber/",
        license: "Dominio Público / CC0",
        licenseType: "Public Domain",
        badgeText: "NIST FIPS 203",
    },
    {
        id: "daniel-j-bernstein",
        name: "Daniel J. Bernstein (djb)",
        handleOrEntity: "Profesor & Criptógrafo",
        role: "Diseñador de Curve25519, Ed25519, ChaCha20 y Poly1305",
        category: "CRYPTO",
        contribution: "Creación de las primitivas criptográficas más seguras, rápidas e inmunes a ataques de canal lateral de la era digital, utilizadas en cada paquete transmitido en la malla RED.",
        honorQuote: "«Seguridad criptográfica sin compromisos de velocidad ni complejidad innecesaria.»",
        url: "https://cr.yp.to/",
        license: "Dominio Público",
        licenseType: "Public Domain",
        badgeText: "CRIPTO PIONERO",
    },
    {
        id: "adi-shamir",
        name: "Adi Shamir",
        handleOrEntity: "Instituto Weizmann de Ciencias",
        role: "Inventor de Shamir's Secret Sharing (SSS)",
        category: "CRYPTO",
        contribution: "Esquema matemático de interpolación polinomial en campos finitos GF(2^8) (umbral 3-de-5), utilizado en RED para fragmentar y recuperar semillas mnemónicas y bóvedas maestras sin puntos únicos de fallo.",
        honorQuote: "«Cómo compartir un secreto: dividir la verdad en fragmentos donde ninguno revela nada hasta alcanzar el umbral de consenso.»",
        url: "https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing",
        license: "Publicación Científica (1979)",
        licenseType: "Standard",
        badgeText: "SSS UMBLAR",
    },

    // ─── 3. RADIOFRECUENCIA & MALLA AD-HOC (LORA / DTN) ───────────────────────
    {
        id: "meshtastic-project",
        name: "Proyecto Meshtastic & Kevin Hester",
        handleOrEntity: "Geeksville / Meshtastic Community",
        role: "Pioneros en Comunicaciones de Malla LoRa Off-Grid",
        category: "RF_MESH",
        contribution: "Inspiración en topologías de repetidores descentralizados LoRa para radioaficionados, estructuras Protobuf y modelos de integración de módems SX1262 para enlace civil comunitario.",
        honorQuote: "«Comunicaciones abiertas, libres y descentralizadas para cualquier ser humano que necesite conectar fuera de la red.»",
        url: "https://meshtastic.org/",
        license: "GPL-3.0",
        licenseType: "GPL-3.0",
        badgeText: "LORA OPEN-SOURCE",
    },
    {
        id: "paul-gardner-stephen",
        name: "Dr. Paul Gardner-Stephen",
        handleOrEntity: "The Serval Project",
        role: "Investigador en Telecomunicaciones Humanitarias",
        category: "RF_MESH",
        contribution: "Investigación fundacional en redes móviles ad-hoc sin infraestructura (BatPhone, Serval Mesh y protocolo Rhizome DTN para almacenamiento y reenvío oportunista en zonas de desastre).",
        honorQuote: "«Las comunicaciones no deben ser un privilegio dependiente de operadores celulares, sino un derecho humano fundamental en emergencias.»",
        url: "http://www.servalproject.org/",
        license: "GPL-3.0",
        licenseType: "GPL-3.0",
        badgeText: "DTN HUMANITARIO",
    },
    {
        id: "leslie-lamport",
        name: "Leslie Lamport",
        handleOrEntity: "Premio Turing / Informático Teórico",
        role: "Creador de los Relojes Lógicos Distribuidos",
        category: "RF_MESH",
        contribution: "Definición matemática de la relación de orden causal («Happened-Before») y relojes de Lamport, implementados en RED para ordenar eventos asíncronos en la malla sin dependencia de GPS ni NTP.",
        honorQuote: "«El tiempo en un sistema distribuido no es absoluto, es una secuencia coordinada de causas y efectos.»",
        url: "https://lamport.azurewebsites.net/",
        license: "Publicación Científica (1978)",
        licenseType: "Standard",
        badgeText: "CAUSAL CLOCKS",
    },
    {
        id: "yoshiki-kuramoto",
        name: "Yoshiki Kuramoto",
        handleOrEntity: "Físico Teórico / Universidad de Kioto",
        role: "Modelo de Kuramoto para Sincronización de Osciladores",
        category: "RF_MESH",
        contribution: "Ecuaciones diferenciales de sincronización de fase en redes complejas, aplicadas en RED para el acoplamiento emergente del latido cardíaco de la malla (Mesh Kuramoto Heartbeat).",
        honorQuote: "«El orden colectivo surge espontáneamente de osciladores locales que ajustan sus ritmos mutuamente.»",
        url: "https://en.wikipedia.org/wiki/Kuramoto_model",
        license: "Física Teórica",
        licenseType: "Standard",
        badgeText: "SINCRONIZACIÓN",
    },

    // ─── 4. BIOCIBERNÉTICA, NEUROCOMPUTACIÓN & CONECTOMA ───────────────────────
    {
        id: "openworm-project",
        name: "Proyecto OpenWorm",
        handleOrEntity: "OpenWorm Foundation",
        role: "Mapeo Abierto del Conectoma Biológico",
        category: "NEURO",
        contribution: "Base de datos digital del conectoma celular de Caenorhabditis elegans (302 neuronas, sinapsis químicas y uniones gap), adaptado en el motor ConnectomeBioBridge de RED para toma de decisiones tácticas neuromórficas.",
        honorQuote: "«Construir el primer organismo digital completo mediante la simulación sináptica rigurosa de la biología real.»",
        url: "https://openworm.org/",
        license: "Licencia MIT",
        licenseType: "MIT",
        badgeText: "CONECTOMA C. ELEGANS",
    },
    {
        id: "janelia-flyem",
        name: "Janelia Research Campus (Proyecto FlyEM)",
        handleOrEntity: "Howard Hughes Medical Institute (HHMI)",
        role: "Mapeo del Hemibrain de Drosophila Melanogaster",
        category: "NEURO",
        contribution: "Reconstrucción tridimensional por microscopía electrónica del cuerpo central en abanico (Fan-Shaped Body), lóbulos ópticos y cuerpos pedunculados (Mushroom Bodies), emulados en los módulos de navegación estigmérgica de RED.",
        honorQuote: "«Revelar la arquitectura cableada del cerebro para comprender la computación de navegación espacial y memoria asociativa.»",
        url: "https://www.janelia.org/project-team/flyem",
        license: "Open Science (CC BY 4.0)",
        licenseType: "Standard",
        badgeText: "DROSOPHILA BRAIN",
    },
    {
        id: "santiago-ramon-y-cajal",
        name: "Santiago Ramón y Cajal",
        handleOrEntity: "Padre de la Neurociencia Moderna",
        role: "Descubridor de la Doctrina de la Neurona",
        category: "NEURO",
        contribution: "Inspiración biológica fundamental: cada nodo de la red es una neurona soberana discreta que procesa y transmite impulsos en base a umbrales de excitación y plasticidad sináptica.",
        honorQuote: "«Todo hombre puede ser, si se lo propone, escultor de su propio cerebro.»",
        url: "https://en.wikipedia.org/wiki/Santiago_Ram%C3%B3n_y_Cajal",
        license: "Patrimonio Científico de la Humanidad",
        licenseType: "Public Domain",
        badgeText: "DOCTRINA NEURONAL",
    },

    // ─── 5. MEDICINA TÁCTICA & TRIAGE MARCH ───────────────────────────────────
    {
        id: "cotccc-tccc",
        name: "Committee on Tactical Combat Casualty Care (CoTCCC)",
        handleOrEntity: "Joint Trauma System / Defense Health Agency",
        role: "Estandarización del Soporte Vital Avanzado en Combate",
        category: "MEDICINE",
        contribution: "Desarrollo del algoritmo sistemático de trauma MARCH / PAWS (Hemorragia Masiva, Vía Aérea, Respiración, Circulación, Hipotermia), base clínica del submódulo InsularTcccInteroceptionEngine de RED.",
        honorQuote: "«Medicina de supervivencia basada en evidencia para evitar las causas prevenibles de muerte en el campo de batalla.»",
        url: "https://deployedmedicine.com/",
        license: "Guías Clínicas Públicas (DoD)",
        licenseType: "Standard",
        badgeText: "TCCC / MARCH",
    },

    // ─── 6. CARTOGRAFÍA, RUNTIME & INFRAESTRUCTURA WEB ─────────────────────────
    {
        id: "openstreetmap",
        name: "OpenStreetMap Contributors",
        handleOrEntity: "OSMF / OpenStreetMap Foundation",
        role: "Cartografía Libre y Colaborativa Global",
        category: "GIS_WEB",
        contribution: "Datos geoespaciales abiertos y vectoriales que alimentan la cartografía táctica sin conexión a Internet (Air-Gap) dentro de RED.",
        honorQuote: "«Un mapa del mundo libre, editable y accesible para toda la humanidad sin muros de pago corporativos.»",
        url: "https://www.openstreetmap.org/",
        license: "ODbL 1.0",
        licenseType: "Standard",
        badgeText: "GEO ABIERTO",
    },
    {
        id: "leaflet-maplibre",
        name: "Leaflet (Vladimir Agafonkin) & MapLibre GL",
        handleOrEntity: "Open Source Geospatial Consortium",
        role: "Motores de Renderizado Cartográfico Ligero",
        category: "GIS_WEB",
        contribution: "Bibliotecas de renderizado cartográfico de ultra-bajo consumo de memoria y aceleración WebGL para renderizado de capas tácticas fuera de línea.",
        honorQuote: "«Mapas rápidos, ligeros y táctiles para cualquier dispositivo móvil.»",
        url: "https://leafletjs.com/",
        license: "Licencia BSD-2-Clause",
        licenseType: "BSD",
        badgeText: "MOTOR GIS",
    },
    {
        id: "tokio-axum-team",
        name: "Equipos Tokio & Axum (Ecosistema Rust)",
        handleOrEntity: "Tokio Project / Tokio Contributors",
        role: "Runtime Asíncrono de Alto Rendimiento en Rust",
        category: "GIS_WEB",
        contribution: "Base de la arquitectura del servidor de fondo red-node.exe: concurrencia sin bloqueo de hilos, gestión de memoria libre de recolector de basura y estabilidad de grado industrial.",
        honorQuote: "«Rendimiento nativo, seguridad de memoria estricta y concurrencia fiable para infraestructuras críticas.»",
        url: "https://tokio.rs/",
        license: "Licencia MIT",
        licenseType: "MIT",
        badgeText: "RUST ASYNC",
    },
    {
        id: "ionic-capacitor",
        name: "Equipo Ionic & Capacitor",
        handleOrEntity: "Capacitor Project",
        role: "Abstracción Nativa Multiplataforma",
        category: "GIS_WEB",
        contribution: "Puente nativo multiplataforma que permite a RED acceder a transceptores Bluetooth LE, Wi-Fi Direct, almacenamiento de claves criptográficas y sensores cinéticos en Android.",
        honorQuote: "«Llevar la web táctica directamente al hardware nativo de los dispositivos móviles.»",
        url: "https://capacitorjs.com/",
        license: "Licencia MIT",
        licenseType: "MIT",
        badgeText: "HARDWARE BRIDGE",
    },

    // ─── 7. COMUNIDAD, OPERADORES Y BRIGADAS DE RESCATE ───────────────────────
    {
        id: "mesh-operators",
        name: "Operadores de Radioafición & Voluntarios de Rescate",
        handleOrEntity: "Comunidad Mesh Soberana",
        role: "Despliegue y Mantenimiento de Nodos Repetidores Físicos",
        category: "COMMUNITY",
        contribution: "Todos los operadores independientes que instalan repetidores solares en colinas, techos y zonas aisladas, manteniendo viva la malla sin depender de infraestructura centralizada.",
        honorQuote: "«Cada repetidor activo es un faro de auxilio y soberanía en medio del apagón.»",
        url: "https://github.com/DarckRovert/RED",
        license: "Comunidad Libre",
        licenseType: "AGPL-3.0",
        badgeText: "HÉROES OFF-GRID",
    },
];
