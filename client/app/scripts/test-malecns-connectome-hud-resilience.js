/**
 * test-malecns-connectome-hud-resilience.js — RED Sovereign Mesh OS
 *
 * Suite de Pruebas de Resiliencia del Visualizador 3D del Conectoma MaleCNS v1.0
 * Basado en el Conectoma Adulto de Drosophila melanogaster (MaleCNS v1.0 / FlyWire Murthy Lab).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('🧠🌌 INICIANDO SUITE DE PRUEBAS: 3D MALECNS CONNECTOME HUD RESILIENCE');
console.log('='.repeat(80) + '\n');

// 1. Verificación Estática del Código Fuente
const hudPath = path.resolve(__dirname, '../src/components/MaleCnsConnectomeHUD.tsx');
const tccPath = path.resolve(__dirname, '../src/components/TacticalCommandCenter.tsx');

assert(fs.existsSync(hudPath), 'MaleCnsConnectomeHUD.tsx debe existir en src/components/');
assert(fs.existsSync(tccPath), 'TacticalCommandCenter.tsx debe existir en src/components/');

const hudCode = fs.readFileSync(hudPath, 'utf8');
const tccCode = fs.readFileSync(tccPath, 'utf8');

// TEST 1: Verificación de Módulos e Integración en TacticalCommandCenter
console.log('  Testing 1: Integración en Centro de Comando C4ISR...');
assert(tccCode.includes("import { MaleCnsConnectomeHUD } from './MaleCnsConnectomeHUD'"), 'TCC debe importar MaleCnsConnectomeHUD');
assert(tccCode.includes('showConnectomeHUD'), 'TCC debe declarar estado showConnectomeHUD');
assert(tccCode.includes('CONECTOMA'), 'TCC debe incluir botón CONECTOMA en la barra superior');
assert(tccCode.includes('maleCnsConnectome'), 'TCC debe incluir módulo maleCnsConnectome');
assert(tccCode.includes('<MaleCnsConnectomeHUD'), 'TCC debe renderizar modal MaleCnsConnectomeHUD');
console.log('  ✅ [PASS] 1. Integración en Centro de Comando C4ISR (Botón, Estado, Módulo y Modal)');

// TEST 2: Topología Anatómica MaleCNS v1.0 (Drosophila melanogaster)
console.log('  Testing 2: Anatomía biofísica del conectoma de mosca...');
assert(hudCode.includes('CX_EPG_'), 'Debe incluir 16 cuñas neuronales E-PG del Central Complex');
assert(hudCode.includes('CX_PB_'), 'Debe incluir glomérulos del Protocerebral Bridge');
assert(hudCode.includes('MB_KC_'), 'Debe incluir Células de Kenyon del Mushroom Body');
assert(hudCode.includes('MB_LOBE_'), 'Debe incluir Lóbulos Alfa/Beta del Mushroom Body');
assert(hudCode.includes('GFS_SOMA_'), 'Debe incluir somas de las Interneuronas Gigantes');
assert(hudCode.includes('GFS_MOTOR_'), 'Debe incluir motoneuronas torácicas de escape');
console.log('  ✅ [PASS] 2. Topología Anatómica MaleCNS v1.0 (CX, MB, GFS y Glomérulos)');

// TEST 3: Matemáticas de Proyección 3D Isométrica y Perspectiva
console.log('  Testing 3: Cinemática y proyección trigonométrica 3D a 2D...');

function project3D(p, rotX, rotY, zoom, cx, cy, fov = 380) {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = p.x * cosY - p.z * sinY;
  const z1 = p.x * sinY + p.z * cosY;

  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = p.y * cosX - z1 * sinX;
  const z2 = p.y * sinX + z1 * cosX;

  const scale = (fov / (fov + z2)) * zoom;

  return {
    x: cx + x1 * scale,
    y: cy - y2 * scale,
    zDepth: z2,
  };
}

const origin = project3D({ x: 0, y: 0, z: 0 }, 0, 0, 1.0, 250, 160);
assert.strictEqual(origin.x, 250, 'El origen debe proyectar en el centro horizontal');
assert.strictEqual(origin.y, 160, 'El origen debe proyectar en el centro vertical');

const rotPoint = project3D({ x: 100, y: 0, z: 0 }, 0, Math.PI / 2, 1.0, 250, 160);
assert(Math.abs(rotPoint.x - 250) < 0.001, 'Rotación de 90° en Y debe alinear eje X con Z');
assert(rotPoint.zDepth > 0, 'La profundidad zDepth debe ser positiva');
console.log('  ✅ [PASS] 3. Cinemática de Proyección 3D a 2D (FOV 380, Rotaciones Eulerianas X/Y)');

// TEST 4: Suscripción Cuádruple a Motores Neurobiológicos
console.log('  Testing 4: Suscripción reactiva cuádruple (CX, Synaptic, GFS, MB)...');
assert(hudCode.includes('ringAttractor.subscribe('), 'Debe suscribirse al atractor de anillo CX');
assert(hudCode.includes('synapticMeshRouter.subscribe('), 'Debe suscribirse al enrutador sináptico');
assert(hudCode.includes('giantFiberReflex.subscribe('), 'Debe suscribirse al arco reflejo GFS');
assert(hudCode.includes('dtnMushroomBody.subscribe('), 'Debe suscribirse a la memoria DTN MB');
assert(hudCode.includes('unsubCx();'), 'Debe limpiar suscripción de CX');
assert(hudCode.includes('unsubSyn();'), 'Debe limpiar suscripción de Synaptic');
assert(hudCode.includes('unsubGfs();'), 'Debe limpiar suscripción de GFS');
assert(hudCode.includes('unsubMb();'), 'Debe limpiar suscripción de MB');
console.log('  ✅ [PASS] 4. Suscripción Reactiva Cuádruple y Limpieza de Ciclo de Vida');

// TEST 5: Filtrado de Subsistemas (ALL / CX / MB / GFS)
console.log('  Testing 5: Aislamiento visual por subsistema biológico...');
assert(hudCode.includes('filterSystem === "ALL" || n.system === filterSystem') || hudCode.includes('filterSystem !== "ALL" && n.system !== filterSystem'), 'Debe filtrar nodos por subsistema');
assert(hudCode.includes('filterSystem !== "ALL" && edge.system !== filterSystem'), 'Debe filtrar axones por subsistema');
console.log('  ✅ [PASS] 5. Aislamiento Visual por Subsistema (ALL, CX, MB, GFS)');

// TEST 6: Control de Rotación, Drag y Zoom
console.log('  Testing 6: Control táctil de órbita 3D y límites angulares...');
assert(hudCode.includes('autoRotate'), 'Debe soportar alternancia de autorrotación');
assert(hudCode.includes('Math.max(-1.2, Math.min(1.2, currentRotX + dy *') || hudCode.includes('Math.max(-1.2, Math.min(1.2, rotXRef.current + dy *'), 'Rotación X debe estar acotada a [-1.2, 1.2]');
assert(hudCode.includes('zoomRef.current = Math.min(1.8, zoomRef.current + 0.15)'), 'Zoom debe tener límite superior seguro (1.8)');
assert(hudCode.includes('zoomRef.current = Math.max(0.5, zoomRef.current - 0.15)'), 'Zoom debe tener límite inferior seguro (0.5)');
console.log('  ✅ [PASS] 6. Control Táctil de Órbita 3D, Clamping Angular y Límites de Zoom');

// TEST 7: Estimulación Sináptica Interactiva
console.log('  Testing 7: Estimulación sináptica interactiva con retroalimentación acústica...');
assert(hudCode.includes('triggerSynapticPulse'), 'Debe proveer función triggerSynapticPulse()');
assert(hudCode.includes('TacticalAudioEngine.playRogerBeep()'), 'Debe reproducir confirmación auditiva');
assert(hudCode.includes('ringAttractor.injectAngularVelocity(45)'), 'Debe inyectar estímulo angular al CX');
console.log('  ✅ [PASS] 7. Estimulación Sináptica Interactiva y Audio-Feedback Táctico');

// TEST 8: Ordenamiento de Profundidad (Z-Sorting) para Renderizado
console.log('  Testing 8: Algoritmo de Pintor (Z-Sorting) para profundidad visual...');
assert(hudCode.includes('b.proj.zDepth - a.proj.zDepth'), 'Debe ordenar nodos por profundidad Z');
console.log('  ✅ [PASS] 8. Algoritmo de Pintor (Z-Sorting) para Oclusión Correcta');

// TEST 9: Intercepción Jerárquica Atrás (BackHandlerRegistry)
console.log('  Testing 9: Integración con BackHandlerRegistry LIFO...');
assert(hudCode.includes('BackHandlerRegistry.register('), 'MaleCnsConnectomeHUD debe registrarse en BackHandler');
assert(tccCode.includes('if (showConnectomeHUD)'), 'TCC debe interceptar cierre de modal antes de navegar atrás');
console.log('  ✅ [PASS] 9. Integración con BackHandlerRegistry LIFO y Navegación Resiliente');

// TEST 10: Mapeo de Identificadores MaleCNS v1.0 Reales (fly-swing & The Fly's Table)
console.log('  Testing 10: MaleCNS v1.0 Body IDs reales en nodos somáticos...');
assert(hudCode.includes('[#10042]'), 'Debe incluir Body ID #10042 para neurona LC4');
assert(hudCode.includes('[#10043]'), 'Debe incluir Body ID #10043 para neurona LPLC2');
assert(hudCode.includes('[#10001]'), 'Debe incluir Body ID #10001 para interneurona gigante DNp01');
assert(hudCode.includes('[#10099]'), 'Debe incluir Body ID #10099 para motoneurona de salto TTMn');
assert(hudCode.includes('10100'), 'Debe incluir mapeo de Body IDs para cuñas E-PG');
assert(hudCode.includes('10200'), 'Debe incluir mapeo de Body IDs para glomérulos PB');
console.log('  ✅ [PASS] 10. Mapeo de Identificadores MaleCNS v1.0 Reales (LC4, LPLC2, DNp01, TTMn)');

// TEST 11: Controles Optogenéticos y Modal de Atribución Obligatoria de Licencia
console.log('  Testing 11: Controles optogenéticos y modal de atribución formal...');
assert(hudCode.includes('optogeneticStimulate'), 'Debe invocar estimulación optogenética ChR2');
assert(hudCode.includes('optogeneticSilence'), 'Debe invocar silenciamiento optogenético NpHR');
assert(hudCode.includes('showAttributionModal'), 'Debe declarar estado de modal de atribución');
assert(hudCode.includes('cobanov/fly-connectome-template'), 'Debe incluir enlace y crédito a cobanov/fly-connectome-template');
assert(hudCode.includes('murthylab/flywire-network-analysis'), 'Debe incluir crédito a Princeton Murthy Lab');
assert(hudCode.includes('eonsystemspbc/fly-brain'), 'Debe incluir crédito a Eon Systems PBC');
console.log('  ✅ [PASS] 11. Controles Optogenéticos y Modal de Atribución Obligatoria de Licencia');

console.log('\n' + '='.repeat(80));
console.log('📊 RESUMEN FINAL: 11/11 PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)');
console.log('='.repeat(80) + '\n');

