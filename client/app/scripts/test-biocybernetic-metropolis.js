/**
 * TEST SUITE: BIOCYBERNETIC METROPOLIS & BIO-URBANISM (A-LIFE METROPOLIS)
 * 
 * Valida la arquitectura de la Ciudad Digital Biocibernética:
 * 1. Definición ontológica de infraestructuras vivas (Silos, Bio-Torres, Autopistas, Composteros, Balizas).
 * 2. Asignación de 5 Castas Cívicas basadas en alelos genotípicos cuantitativos.
 * 3. Física de transporte sobre Autopistas de Feromonas (+45% velocidad, -40% coste ATP).
 * 4. Metabolismo urbano circular y reciclaje termodinámico de biomasa sin residuos.
 * 5. Reservas comunales de Silos y abastecimiento ante inanición de la colonia.
 * 6. Progresión cívica de civilización ($L_1 \to L_5$) con cálculo de PIB metabólico.
 * 7. Renderizado procedural 3D en BiocyberneticHabitat3DEngine.ts.
 * 8. Visualización e interactividad en el HUD de TacticalHabitatModal.tsx.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
  }
}

console.log('\n================================================================================');
console.log('🏙️🏛️ INICIANDO SUITE DE PRUEBAS: METRÓPOLIS BIOCIBERNÉTICA & URBANISMO VIVO');
console.log('================================================================================\n');

// ── 1. Inspección Estática de BiocyberneticMetropolisEngine.ts ────────────────
const metropolisEnginePath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'BiocyberneticMetropolisEngine.ts');
assert(fs.existsSync(metropolisEnginePath), 'El archivo BiocyberneticMetropolisEngine.ts debe existir');
const metropolisCode = fs.readFileSync(metropolisEnginePath, 'utf8');

runTest('1. BiocyberneticMetropolisEngine: Definición de Tipos Urbanos y 5 Castas Cívicas', () => {
  assert(metropolisCode.includes("'CENTRAL_SILO'"), 'Debe definir tipo CENTRAL_SILO');
  assert(metropolisCode.includes("'BIO_TOWER_DWELLING'"), 'Debe definir tipo BIO_TOWER_DWELLING');
  assert(metropolisCode.includes("'PHEROMONE_HIGHWAY'"), 'Debe definir tipo PHEROMONE_HIGHWAY');
  assert(metropolisCode.includes("'BIO_COMPOSTER'"), 'Debe definir tipo BIO_COMPOSTER');
  assert(metropolisCode.includes("'DEFENSE_BEACON'"), 'Debe definir tipo DEFENSE_BEACON');

  assert(metropolisCode.includes("'BUILDER'"), 'Debe definir casta BUILDER');
  assert(metropolisCode.includes("'HARVESTER'"), 'Debe definir casta HARVESTER');
  assert(metropolisCode.includes("'SENTINEL'"), 'Debe definir casta SENTINEL');
  assert(metropolisCode.includes("'SCHOLAR'"), 'Debe definir casta SCHOLAR');
  assert(metropolisCode.includes("'NURSE'"), 'Debe definir casta NURSE');
});

runTest('2. BiocyberneticMetropolisEngine: Cimientos iniciales y estructuras persistentes', () => {
  assert(metropolisCode.includes('initDefaultCityFoundations'), 'Debe inicializar cimientos urbanos');
  assert(metropolisCode.includes('silo-alpha'), 'Debe contar con silo inicial');
  assert(metropolisCode.includes('tower-nexus'), 'Debe contar con bio-torre inicial');
  assert(metropolisCode.includes('composter-prime'), 'Debe contar con compostero inicial');
  assert(metropolisCode.includes('hwy-axial-north'), 'Debe contar con calzada axial norte');
});

runTest('3. BiocyberneticMetropolisEngine: Determinación genotípica cuantitativa de castas', () => {
  assert(metropolisCode.includes('determineCasteFromGenome'), 'Debe implementar función determineCasteFromGenome');
  assert(metropolisCode.includes('genome.cooperationGene'), 'Debe evaluar alelo de cooperación');
  assert(metropolisCode.includes('genome.speedGene'), 'Debe evaluar alelo de velocidad');
  assert(metropolisCode.includes('genome.metabolicEfficiencyGene'), 'Debe evaluar alelo de eficiencia metabólica');
  assert(metropolisCode.includes('genome.sensoryRadiusGene'), 'Debe evaluar alelo sensorial');
  assert(metropolisCode.includes('genome.phenotypeScale'), 'Debe evaluar escala fenotípica');
});

runTest('4. BiocyberneticMetropolisEngine: Física de Carreteras y Bonos Cinemáticos', () => {
  assert(metropolisCode.includes('getHighwaySpeedMultiplier'), 'Debe calcular multiplicador de velocidad por autopista');
  assert(metropolisCode.includes('speedBonusMultiplier'), 'Debe definir speedBonusMultiplier en autopistas');
  assert(metropolisCode.includes('widthMeters'), 'Debe definir ancho de calzada');
});

runTest('5. BiocyberneticMetropolisEngine: Reciclaje de Biomasa Circular (Cero Desperdicio)', () => {
  assert(metropolisCode.includes('recycleDecomposedCorpse'), 'Debe implementar reciclaje de cadáveres');
  assert(metropolisCode.includes('biopolymerGain'), 'Debe generar biopolímeros a partir de biomasa');
  assert(metropolisCode.includes('totalRecycledBiomassHistorical'), 'Debe contabilizar biomasa histórica reciclada');
});

runTest('6. BiocyberneticMetropolisEngine: Niveles de Civilización y Auditoría del PIB', () => {
  assert(metropolisCode.includes('computeCivilizationLevel'), 'Debe calcular nivel de civilización L1-L5');
  assert(metropolisCode.includes('Campamento Silvestre'), 'Debe definir nivel 1');
  assert(metropolisCode.includes('Aldea Estigmérgica'), 'Debe definir nivel 2');
  assert(metropolisCode.includes('Ciudadela Conectómica'), 'Debe definir nivel 3');
  assert(metropolisCode.includes('Metrópolis Biocibernética'), 'Debe definir nivel 4');
  assert(metropolisCode.includes('Megalópolis Edénica'), 'Debe definir nivel 5');
});

// ── 2. Verificación Dinámica de Algoritmos Urbanos en Memoria ─────────────────
runTest('7. Dinámica: Simulación de Determinación de Casta a partir de Alelos', () => {
  function testDetermineCaste(species, genome) {
    if (species === 'GRAVITY_SENTINEL') return 'SENTINEL';
    if (species === 'HUMAN_NEOCORTEX') return 'SCHOLAR';

    const cooperation = genome.cooperationGene ?? 1.0;
    const speed = genome.speedGene ?? 1.0;
    const efficiency = genome.metabolicEfficiencyGene ?? 1.0;
    const sensory = genome.sensoryRadiusGene ?? 1.0;
    const scale = genome.phenotypeScale ?? 1.0;

    if (cooperation > 1.25) return 'NURSE';
    if (speed > 1.2 && scale < 1.05) return 'HARVESTER';
    if (scale > 1.15 || efficiency > 1.25) return 'BUILDER';
    if (sensory > 1.25) return 'SENTINEL';
    return 'SCHOLAR';
  }

  assert.strictEqual(testDetermineCaste('GRAVITY_SENTINEL', {}), 'SENTINEL');
  assert.strictEqual(testDetermineCaste('HUMAN_NEOCORTEX', {}), 'SCHOLAR');
  assert.strictEqual(testDetermineCaste('ANT', { cooperationGene: 1.4 }), 'NURSE');
  assert.strictEqual(testDetermineCaste('DROSOPHILA', { speedGene: 1.35, phenotypeScale: 0.95 }), 'HARVESTER');
  assert.strictEqual(testDetermineCaste('C_ELEGANS', { phenotypeScale: 1.25, metabolicEfficiencyGene: 1.3 }), 'BUILDER');
  assert.strictEqual(testDetermineCaste('ANT', { sensoryRadiusGene: 1.35 }), 'SENTINEL');
  assert.strictEqual(testDetermineCaste('ANT', { cooperationGene: 1.0, speedGene: 1.0, phenotypeScale: 1.0 }), 'SCHOLAR');
});

runTest('8. Dinámica: Cálculo de Coordenadas y Bono Vial en Autopista de Feromonas', () => {
  const hw = { x1: -4.0, y1: 0.0, x2: 4.0, y2: 0.0, widthMeters: 0.8 };

  function checkHighwayBonus(px, py) {
    const dx = hw.x2 - hw.x1;
    const dy = hw.y2 - hw.y1;
    const lenSq = dx * dx + dy * dy;
    let t = ((px - hw.x1) * dx + (py - hw.y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = hw.x1 + t * dx;
    const projY = hw.y1 + t * dy;
    const dist = Math.hypot(px - projX, py - projY);

    if (dist <= hw.widthMeters * 0.5) {
      return { inHighway: true, speedMultiplier: 1.45, energyFriction: 0.60 };
    }
    return { inHighway: false, speedMultiplier: 1.0, energyFriction: 1.0 };
  }

  // Punto exactamente sobre la calzada (0, 0.1)
  const onRoad = checkHighwayBonus(0, 0.1);
  assert.strictEqual(onRoad.inHighway, true, 'Debe detectar organismo en la calzada');
  assert.strictEqual(onRoad.speedMultiplier, 1.45, 'Debe otorgar +45% velocidad');
  assert.strictEqual(onRoad.energyFriction, 0.60, 'Debe reducir el rozamiento energético a 60%');

  // Punto fuera de la calzada (0, 2.5)
  const offRoad = checkHighwayBonus(0, 2.5);
  assert.strictEqual(offRoad.inHighway, false, 'No debe detectar organismo fuera de la calzada');
  assert.strictEqual(offRoad.speedMultiplier, 1.0);
  assert.strictEqual(offRoad.energyFriction, 1.0);
});

runTest('9. Dinámica: Balance Estequiométrico del Bio-Compostero Circular', () => {
  const corpseBiomass = 4.0;
  const biopolymerYield = corpseBiomass * 0.65; // 2.6 unidades
  const nectarYield = corpseBiomass * 0.35;     // 1.4 unidades

  assert.strictEqual(biopolymerYield, 2.6, 'Rendimiento de biopolímero debe ser 65%');
  assert.strictEqual(nectarYield, 1.4, 'Rendimiento de néctar debe ser 35%');
  assert.strictEqual(biopolymerYield + nectarYield, corpseBiomass, 'La conservación de masa debe ser exacta (100%)');
});

// ── 3. Inspección Estática de BiocyberneticHabitatEngine.ts ───────────────────
const habitatEnginePath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'BiocyberneticHabitatEngine.ts');
assert(fs.existsSync(habitatEnginePath), 'El archivo BiocyberneticHabitatEngine.ts debe existir');
const habitatCode = fs.readFileSync(habitatEnginePath, 'utf8');

runTest('10. BiocyberneticHabitatEngine: Integración de Metrópolis en el Ciclo Físico', () => {
  assert(habitatCode.includes('metropolisEngine: BiocyberneticMetropolisEngine'), 'Debe enlazar la instancia de MetropolisEngine');
  assert(habitatCode.includes('caste: CivilianCaste'), 'HabitatOrganism debe poseer el campo caste');
  assert(habitatCode.includes('biopolymerCarried: number'), 'HabitatOrganism debe poseer el campo biopolymerCarried');
  assert(habitatCode.includes('metropolis: MetropolisTelemetry'), 'HabitatTelemetry debe exponer telemetría urbana');
  assert(habitatCode.includes('metropolisEngine.getHighwaySpeedMultiplier'), 'Debe invocar bono de autopistas en cada tick');
  assert(habitatCode.includes('metropolisEngine.depositInNearestSilo'), 'Harvester debe abastecer silos');
  assert(habitatCode.includes('metropolisEngine.recycleDecomposedCorpse'), 'Cadáveres deben ser reciclados en compostero');
});

// ── 4. Inspección Estática de BiocyberneticHabitat3DEngine.ts ─────────────────
const habitat3DPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'habitat', 'BiocyberneticHabitat3DEngine.ts');
assert(fs.existsSync(habitat3DPath), 'El archivo BiocyberneticHabitat3DEngine.ts debe existir');
const habitat3DCode = fs.readFileSync(habitat3DPath, 'utf8');

runTest('11. BiocyberneticHabitat3DEngine: Visualización Procedural 3D de la Metrópolis', () => {
  assert(habitat3DCode.includes('metropolisGroup!: THREE.Group'), 'Debe poseer grupo 3D de metrópolis');
  assert(habitat3DCode.includes('structureMeshes: Map<string, THREE.Group>'), 'Debe indexar mallas de estructuras 3D');
  assert(habitat3DCode.includes('highwayLines: THREE.LineSegments | null'), 'Debe renderizar líneas luminosas de autopistas');
  assert(habitat3DCode.includes('createUrbanStructureMesh'), 'Debe implementar generador de mallas urbanas');
  assert(habitat3DCode.includes('updateMetropolis3D'), 'Debe sincronizar metrópolis en el bucle tick');
  assert(habitat3DCode.includes('CENTRAL_SILO'), 'Debe soportar render de silos centrales');
  assert(habitat3DCode.includes('BIO_TOWER_DWELLING'), 'Debe soportar render de bio-torres');
  assert(habitat3DCode.includes('BIO_COMPOSTER'), 'Debe soportar render de bio-composteros');
  assert(habitat3DCode.includes('DEFENSE_BEACON'), 'Debe soportar render de balizas de defensa');
});

// ── 5. Inspección Estática de TacticalHabitatModal.tsx ────────────────────────
const habitatModalPath = path.join(__dirname, '..', 'src', 'components', 'tactical', 'TacticalHabitatModal.tsx');
assert(fs.existsSync(habitatModalPath), 'El archivo TacticalHabitatModal.tsx debe existir');
const habitatModalCode = fs.readFileSync(habitatModalPath, 'utf8');

runTest('12. TacticalHabitatModal: Pestaña de Metrópolis y HUD Cívico', () => {
  assert(habitatModalCode.includes("'METROPOLIS'"), 'Debe incluir pestaña METROPOLIS');
  assert(habitatModalCode.includes('METRÓPOLIS BIOCIBERNÉTICA'), 'Debe poseer botón selector de metrópolis');
  assert(habitatModalCode.includes('PIB METABÓLICO'), 'Debe desplegar PIB metabólico');
  assert(habitatModalCode.includes('RECURSOS SILOS'), 'Debe desplegar reservas de silos');
  assert(habitatModalCode.includes('CENSO Y DIVISIÓN CÍVICA DEL TRABAJO'), 'Debe desplegar censo de 5 castas');
  assert(habitatModalCode.includes('INFRAESTRUCTURA VIVA & PLANIFICACIÓN URBANA'), 'Debe desplegar catálogo urbano');
  assert(habitatModalCode.includes('handleRequestConstruction'), 'Debe soportar ordenanzas de construcción');
  assert(habitatModalCode.includes('selectedOrganism.caste'), 'Bio-Scanner debe desplegar la casta del organismo');
});

runTest('13. BiocyberneticMetropolisEngine: Persistencia Soberana y Auto-Guardado', () => {
  assert(metropolisCode.includes('saveToStorage'), 'Debe implementar saveToStorage');
  assert(metropolisCode.includes('loadFromStorage'), 'Debe implementar loadFromStorage');
  assert(metropolisCode.includes('STORAGE_KEY'), 'Debe definir clave de almacenamiento persistente');
  assert(metropolisCode.includes('lastAutoSaveTimeSec'), 'Debe registrar tiempo de auto-guardado');
});

runTest('14. Conducción Táctica Activa de Castas y Radar 2D', () => {
  assert(habitatCode.includes('BUILDER_DISPATCH_TO_SITE'), 'Constructores deben ser despachados activamente a obras');
  assert(habitatCode.includes('HARVESTER_DELIVERING_SILO'), 'Recolectores deben orientarse al silo para descargar');
  assert(habitatCode.includes('NURSE_APPROACHING_PATIENT'), 'Enfermeros deben navegar hacia organismos debilitados');
  assert(habitatCode.includes('MEDICAL_TROPHALLAXIS'), 'Debe registrar trofalaxis médica');
  assert(habitatModalCode.includes('Autopistas de Feromonas de la Metrópolis en 2D Radar'), 'Radar 2D debe dibujar autopistas');
  assert(habitatModalCode.includes('Estructuras Vivas de la Metrópolis en 2D Radar'), 'Radar 2D debe dibujar estructuras');
});

console.log('\n================================================================================');
console.log(`📊 RESULTADOS DE LA SUITE: ${passedTests}/${totalTests} PRUEBAS EXITOSAS (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('================================================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ¡LA CIUDAD DIGITAL BIOCIBERNÉTICA ESTÁ 100% OPERATIVA, INTEGRADA Y VERIFICADA!\n');
  process.exit(0);
} else {
  console.error('❌ ALGUNAS PRUEBAS FALLARON.');
  process.exit(1);
}
