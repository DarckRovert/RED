/**
 * TacticalHabitatModal.tsx — RED Sovereign Mesh OS
 * 
 * Modal Táctico de Alto Nivel para el Hábitat Digital Biocibernético In-Silico.
 * Implementado bajo el estándar de excelencia L9 con Vanilla CSS táctico estricto (HUD Cyberpunk):
 * - Renderizado en tiempo real a 60 Hz del campo escalar continuo de Fick (Glucosa, Rastro de Hormigas, Alarma).
 * - Divergencia morfológica y biofísica de 3 especies:
 *   * Drosophila: Omatidios, alas batientes, marcha trípode 18-DOF y reflejos LC4.
 *   * C. elegans: Columna de 10 nodos con ondulación sinusoidal continua y klinokinesis.
 *   * Ant: Morfología segmentada, mandíbulas, forrajeo y estigmergia con rastro de feromona.
 * - Instrumental enriquecido: Pipeta continua (Drag & Paint), Sonda Air-Puff (Mecánica),
 *   Barreras Acústicas reflectoras Neumann, Foco Térmico, Láser Optogenético y Sombras Looming.
 * - Bio-Scanner HUD interactivo: Selección de cualquier organismo con retícula y telemetría en vivo.
 * - Sonificación biofísica reactiva mediante Web Audio API en TacticalAudioEngine.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  biocyberneticHabitat,
  HabitatTelemetry,
  HabitatToolType,
  OrganismSpecies,
  HabitatOrganism,
} from '../../lib/neuro/habitat';
import { hexapodActuatorBridge } from '../../lib/neuro/vivarium/HexapodActuatorBridgeEngine';
import { BackHandlerRegistry } from '../../lib/navigation/BackHandlerRegistry';
import { TacticalAudioEngine } from '../../lib/audio/TacticalAudioEngine';
import { connectomeBioBridge } from '../../lib/neuro/ConnectomeBioBridge';

export interface TacticalHabitatModalProps {
  onClose: () => void;
}

export const TacticalHabitatModal: React.FC<TacticalHabitatModalProps> = ({ onClose }) => {
  const [telemetry, setTelemetry] = useState<HabitatTelemetry>(biocyberneticHabitat.getTelemetry());
  const [selectedTool, setSelectedTool] = useState<HabitatToolType>('GLUCOSE_PIPETTE');
  const [toolIntensity, setToolIntensity] = useState<number>(1.0);
  const [bannerAlert, setBannerAlert] = useState<string | null>(null);
  const [selectedOrganismId, setSelectedOrganismId] = useState<string | null>(null);
  const [isFollowCamActive, setIsFollowCamActive] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPointerDownRef = useRef<boolean>(false);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastPaintedPosRef = useRef<{ x: number; y: number } | null>(null);

  // Registro del botón físico de Atrás en Android (LIFO) para navegación fluida
  useEffect(() => {
    const unregister = BackHandlerRegistry.register(() => {
      TacticalAudioEngine.playTap();
      onClose();
      return true;
    });
    return unregister;
  }, [onClose]);

  const triggerAlert = (msg: string) => {
    setBannerAlert(msg);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setBannerAlert(null);
    }, 2500);
  };

  useEffect(() => {
    // 1. Inicializar Canvas Offscreen de 64x64 para campo escalar de Fick
    if (!offscreenCanvasRef.current && typeof document !== 'undefined') {
      const oc = document.createElement('canvas');
      oc.width = 64;
      oc.height = 64;
      offscreenCanvasRef.current = oc;
    }

    // 2. Iniciar simulación biofísica y acople con conectoma MaleCNS
    biocyberneticHabitat.start();
    biocyberneticHabitat.setTool(selectedTool, toolIntensity);
    connectomeBioBridge.startConnectome();

    // 3. Suscribir telemetría reactiva
    const unsubTel = biocyberneticHabitat.subscribeTelemetry((t) => {
      setTelemetry(t);
    });

    // 4. Bucle de renderizado Canvas en tiempo real
    let animId: number;
    const render = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawHabitatScene(ctx, canvas.width, canvas.height);
        }
      }
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      unsubTel();
      biocyberneticHabitat.stop();
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const handleSelectTool = (tool: HabitatToolType) => {
    TacticalAudioEngine.playTap();
    setSelectedTool(tool);
    biocyberneticHabitat.setTool(tool, toolIntensity);
    if (tool === 'AIR_PUFF_POKE') triggerAlert('💨 SONDA MECÁNICA: Pulsa para emitir ráfagas de aire');
    else if (tool === 'OPTOGENETIC_LASER') triggerAlert('⚡ LÁSER ChR2: Desplaza el haz para despolarización óptica');
    else if (tool === 'ACOUSTIC_BARRIER') triggerAlert('🚧 BARRERA ACÚSTICA: Traza líneas reflectoras');
  };

  const handleToggleActuators = () => {
    TacticalAudioEngine.playTap();
    const nextState = !telemetry.isActuatorStreaming;
    biocyberneticHabitat.setActuatorStreaming(nextState);
    if (nextState) {
      triggerAlert('🦾 PUENTE ROBÓTICO TX ACTIVADO: Despachando cinemática 18-DOF a hardware real');
    } else {
      triggerAlert('🦾 PUENTE ROBÓTICO OFF: Salida serie desactivada');
    }
  };

  const handleSpawnOrganism = (species: OrganismSpecies) => {
    TacticalAudioEngine.playTap();
    const org = biocyberneticHabitat.spawnOrganism(
      species,
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 6,
      Math.random() * Math.PI * 2
    );
    setSelectedOrganismId(org.id);
    triggerAlert(`➕ Organismo ${species} introducido en el hábitat`);
  };

  const handleManualEmigrate = async () => {
    TacticalAudioEngine.playTap();
    const leader = biocyberneticHabitat.getLeader();
    if (!leader) return;
    const success = await biocyberneticHabitat.meshBridge.broadcastEmigration(
      leader.species,
      leader.metabolism.getTelemetry().atpLevel,
      leader.headingRad,
      leader.speedMps,
      leader.generation,
      leader.plasticity.quantizeForMeshExport()
    );
    if (success) {
      triggerAlert('🚀 MIGRACIÓN P2P DESPACHADA: Organismo transmitido a la malla LoRa/BLE');
    } else {
      triggerAlert('📡 Paquete encolado en DTN Store & Forward');
    }
  };

  const handleClearBarriers = () => {
    biocyberneticHabitat.clearAcousticBarriers();
    triggerAlert('🧹 Barreras acústicas eliminadas');
  };

  // ── Gestión Táctil & Puntero (Drag & Paint, Air-Puff & Bio-Scanner) ───────────
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { worldX: 0, worldY: 0, clickX: 0, clickY: 0 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { worldX: 0, worldY: 0, clickX: 0, clickY: 0 };

    // Proyección normalizada [0.0 - 1.0] a la resolución de renderizado nativa del Canvas (720x560)
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;
    const canvasPixelX = normX * canvas.width;
    const canvasPixelY = normY * canvas.height;

    const centerX = canvas.width * 0.5;
    const centerY = canvas.height * 0.5;
    const scale = (canvas.width * 0.45) / 10.0;

    const worldX = (canvasPixelX - centerX) / scale;
    const worldY = (canvasPixelY - centerY) / scale;
    return { worldX, worldY, clickX: canvasPixelX, clickY: canvasPixelY };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    isPointerDownRef.current = true;
    const { worldX, worldY } = getCanvasCoords(e);
    pointerStartPosRef.current = { x: worldX, y: worldY };
    lastPaintedPosRef.current = { x: worldX, y: worldY };

    // Verificar si el usuario pulsó sobre un organismo para el Bio-Scanner
    const organisms = biocyberneticHabitat.getAllOrganisms();
    let hitOrganism: HabitatOrganism | null = null;
    for (const org of organisms) {
      if (Math.hypot(org.x - worldX, org.y - worldY) < 0.9) {
        hitOrganism = org;
        break;
      }
    }

    if (hitOrganism) {
      setSelectedOrganismId(hitOrganism.id);
      TacticalAudioEngine.playTap();
      triggerAlert(`🎯 BIO-SCANNER: Fijado en ${hitOrganism.species} (${hitOrganism.id.slice(-6)})`);
      return;
    }

    // Si no pulsó un organismo, aplicar herramienta táctica
    if (selectedTool === 'AIR_PUFF_POKE') {
      biocyberneticHabitat.triggerAirPuff(worldX, worldY, toolIntensity);
    } else if (selectedTool === 'OPTOGENETIC_LASER') {
      biocyberneticHabitat.applyOptogeneticLaser(worldX, worldY, 1.2 * toolIntensity);
    } else {
      biocyberneticHabitat.applyToolAt(worldX, worldY);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    const { worldX, worldY } = getCanvasCoords(e);

    if (selectedTool === 'GLUCOSE_PIPETTE') {
      // Arrastre continuo Drag & Paint: pintar gotas cada 0.6 m de desplazamiento
      if (lastPaintedPosRef.current) {
        const dist = Math.hypot(worldX - lastPaintedPosRef.current.x, worldY - lastPaintedPosRef.current.y);
        if (dist > 0.6) {
          biocyberneticHabitat.applyToolAt(worldX, worldY);
          lastPaintedPosRef.current = { x: worldX, y: worldY };
        }
      }
    } else if (selectedTool === 'OPTOGENETIC_LASER') {
      biocyberneticHabitat.applyOptogeneticLaser(worldX, worldY, 1.2 * toolIntensity);
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    isPointerDownRef.current = false;
    const { worldX, worldY } = getCanvasCoords(e);

    // Si la herramienta es Barrera Acústica, conectar inicio con fin del trazo
    if (selectedTool === 'ACOUSTIC_BARRIER' && pointerStartPosRef.current) {
      const startWorldX = pointerStartPosRef.current.x;
      const startWorldY = pointerStartPosRef.current.y;

      if (Math.hypot(worldX - startWorldX, worldY - startWorldY) > 0.4) {
        const gridCenter = 10.0;
        biocyberneticHabitat.diffusionGrid.addBarrier({
          id: `barrier-${Date.now()}`,
          x1: startWorldX + gridCenter,
          y1: startWorldY + gridCenter,
          x2: worldX + gridCenter,
          y2: worldY + gridCenter,
        });
        TacticalAudioEngine.playTap();
        triggerAlert('🚧 Barrera acústica reflectora trazada');
      }
    }

    pointerStartPosRef.current = null;
    lastPaintedPosRef.current = null;
  };

  // ── Renderizado Principal del Hábitat ─────────────────────────────────────────
  const drawHabitatScene = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const radiusPx = width * 0.45;
    const scale = radiusPx / 10.0; // Píxeles por metro

    // 0. Fondo táctico oscuro
    ctx.fillStyle = '#020610';
    ctx.fillRect(0, 0, width, height);

    // 1. Rejilla y Arena Circular
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let r = 2; r <= 10; r += 2) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Renderizado del Campo Escalar Continuo de Fick (Vapores en tiempo real)
    const offscreen = offscreenCanvasRef.current;
    if (offscreen) {
      const oCtx = offscreen.getContext('2d');
      if (oCtx) {
        const imgData = oCtx.createImageData(64, 64);
        const data = imgData.data;

        const glucose = biocyberneticHabitat.diffusionGrid.getBuffer('GLUCOSE');
        const trail = biocyberneticHabitat.diffusionGrid.getBuffer('PHEROMONE_TRAIL');
        const alarm = biocyberneticHabitat.diffusionGrid.getBuffer('ALARM_PHEROMONE');

        for (let i = 0; i < 4096; i++) {
          const g = glucose[i];
          const t = trail[i];
          const a = alarm[i];

          const pIdx = i * 4;
          // Glucosa (Verde esmeralda), Trail (Ámbar dorado), Alarma (Violeta/Carmesí)
          data[pIdx] = Math.min(255, Math.floor(a * 180 + t * 240));
          data[pIdx + 1] = Math.min(255, Math.floor(g * 240 + t * 180));
          data[pIdx + 2] = Math.min(255, Math.floor(a * 220 + g * 110));
          data[pIdx + 3] = Math.min(210, Math.floor((g * 1.5 + t * 2.2 + a * 2.5) * 110));
        }

        oCtx.putImageData(imgData, 0, 0);

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radiusPx - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offscreen, centerX - radiusPx, centerY - radiusPx, radiusPx * 2, radiusPx * 2);
        ctx.restore();
      }
    }

    // 3. Fuentes Químicas Discretas
    const sources = biocyberneticHabitat.diffusionGrid.getAllSources();
    for (const src of sources) {
      const px = centerX + (src.x - 10.0) * scale;
      const py = centerY + (src.y - 10.0) * scale;

      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Barreras Acústicas Reflectoras
    const barriers = biocyberneticHabitat.diffusionGrid.getBarriers();
    for (const b of barriers) {
      const px1 = centerX + (b.x1 - 10.0) * scale;
      const py1 = centerY + (b.y1 - 10.0) * scale;
      const px2 = centerX + (b.x2 - 10.0) * scale;
      const py2 = centerY + (b.y2 - 10.0) * scale;

      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 5. Ondas de Choque Mecánicas (Air Puff Waves)
    const waves = biocyberneticHabitat.getAirPuffWaves();
    for (const w of waves) {
      const px = centerX + w.x * scale;
      const py = centerY + w.y * scale;
      const rPx = w.radiusMeters * scale;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, rPx, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 6. Borde Perimétrico de la Arena
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 6.1 Nido Central de la Colonia Formicidae (Anthill)
    const nestRadiusPx = 0.85 * scale;
    ctx.save();
    ctx.translate(centerX, centerY);

    // Halo biofísico de feromonas del nido
    const nestGrad = ctx.createRadialGradient(0, 0, nestRadiusPx * 0.15, 0, 0, nestRadiusPx * 1.35);
    nestGrad.addColorStop(0, 'rgba(255, 159, 67, 0.22)');
    nestGrad.addColorStop(0.55, 'rgba(238, 82, 83, 0.10)');
    nestGrad.addColorStop(1, 'rgba(255, 159, 67, 0)');
    ctx.fillStyle = nestGrad;
    ctx.beginPath();
    ctx.arc(0, 0, nestRadiusPx * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // Perímetro del montículo táctico
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.strokeStyle = 'rgba(255, 159, 67, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, nestRadiusPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // Apertura subterránea del nido (túnel central)
    ctx.fillStyle = '#060c18';
    ctx.strokeStyle = '#ff9f43';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, nestRadiusPx * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Etiqueta táctica del nido
    ctx.font = '800 8.5px monospace';
    ctx.fillStyle = '#ff9f43';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐜 NIDO', 0, nestRadiusPx + 11);
    ctx.restore();

    // 7. Organismos Vivos con Morfología Específica
    const organisms = biocyberneticHabitat.getAllOrganisms();
    for (const org of organisms) {
      const px = centerX + org.x * scale;
      const py = centerY + org.y * scale;

      ctx.save();
      ctx.translate(px, py);

      // Si está en descomposición cadavérica
      if (org.isDecomposing) {
        ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      ctx.rotate(org.headingRad);

      if (org.species === 'DROSOPHILA') {
        // ── Morfología Drosophila: Omatidios, Alas Oscilantes & Patas ──
        // Antenas con aristas plumosas
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(7, -3); ctx.lineTo(19, -10);
        ctx.moveTo(7, 3);  ctx.lineTo(19, 10);
        ctx.stroke();

        // Ojos compuestos rojos (Omatidios)
        ctx.fillStyle = '#ff0055';
        ctx.beginPath(); ctx.arc(6, -5, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(6, 5, 3.5, 0, Math.PI * 2); ctx.fill();

        // Cuerpo / Tórax
        ctx.fillStyle = org.isLeader ? '#00f0ff' : '#0abde3';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Alas translúcidas oscilantes
        const wingOsc = Math.sin(org.wingFlapPhase) * 0.4;
        ctx.fillStyle = 'rgba(180, 240, 255, 0.55)';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
        ctx.lineWidth = 1;
        // Ala izq
        ctx.beginPath();
        ctx.ellipse(-2, -12, 11, 4.5, -0.3 + wingOsc, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Ala der
        ctx.beginPath();
        ctx.ellipse(-2, 12, 11, 4.5, 0.3 - wingOsc, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Patas articuladas
        ctx.strokeStyle = '#8395a7';
        ctx.lineWidth = 1.4;
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath();
          ctx.moveTo(-4, side * 5); ctx.lineTo(-8, side * 14);
          ctx.moveTo(2, side * 5);  ctx.lineTo(4, side * 15);
          ctx.stroke();
        }

      } else if (org.species === 'C_ELEGANS') {
        // ── Morfología C. elegans: Columna Sinusoidal Flexible de 10 Nodos ──
        ctx.restore(); // Deshacer rotación local para dibujar spline absoluto
        ctx.save();

        if (org.wormJoints && org.wormJoints.length > 0) {
          ctx.beginPath();
          const headX = centerX + org.wormJoints[0].x * scale;
          const headY = centerY + org.wormJoints[0].y * scale;
          ctx.moveTo(headX, headY);

          for (let j = 1; j < org.wormJoints.length; j++) {
            const jx = centerX + org.wormJoints[j].x * scale;
            const jy = centerY + org.wormJoints[j].y * scale;
            ctx.lineTo(jx, jy);
          }

          ctx.strokeStyle = 'rgba(84, 160, 255, 0.85)';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();

          // Núcleo interno
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Cabeza con sensilas anfidiales
          ctx.fillStyle = '#00ff88';
          ctx.beginPath();
          ctx.arc(headX, headY, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.save();
        ctx.translate(px, py);

      } else if (org.species === 'ANT') {
        // ── Morfología Hormiga: 3 Secciones, Mandíbulas & Gaster Estigmérgico ──
        // Mandíbulas
        ctx.strokeStyle = '#f1f2f6';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(6, -2); ctx.lineTo(12, -1);
        ctx.moveTo(6, 2);  ctx.lineTo(12, 1);
        ctx.stroke();

        // Cabeza
        ctx.fillStyle = '#ff9f43';
        ctx.beginPath();
        ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Mesosoma (Tórax)
        ctx.fillStyle = '#ee5253';
        ctx.beginPath();
        ctx.ellipse(-3, 0, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Gaster (Abdomen)
        ctx.fillStyle = org.isCarryingFood ? '#00ff88' : '#c0392b';
        ctx.beginPath();
        ctx.ellipse(-12, 0, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 6 Patas
        ctx.strokeStyle = '#dcdde1';
        ctx.lineWidth = 1.3;
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath();
          ctx.moveTo(-5, side * 3); ctx.lineTo(-10, side * 12);
          ctx.moveTo(-2, side * 3); ctx.lineTo(0, side * 13);
          ctx.moveTo(2, side * 3);  ctx.lineTo(8, side * 11);
          ctx.stroke();
        }
      }

      ctx.restore();

      // 8. Retícula Táctica del Bio-Scanner si está seleccionado
      if (org.id === selectedOrganismId) {
        ctx.save();
        ctx.translate(px, py);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.8;
        const bSize = 22;
        // Brackets esquineros tácticos [ ]
        ctx.beginPath();
        ctx.moveTo(-bSize, -bSize + 8); ctx.lineTo(-bSize, -bSize); ctx.lineTo(-bSize + 8, -bSize);
        ctx.moveTo(bSize - 8, -bSize);  ctx.lineTo(bSize, -bSize);  ctx.lineTo(bSize, -bSize + 8);
        ctx.moveTo(bSize, bSize - 8);   ctx.lineTo(bSize, bSize);   ctx.lineTo(bSize - 8, bSize);
        ctx.moveTo(-bSize + 8, bSize);  ctx.lineTo(-bSize, bSize);  ctx.lineTo(-bSize, bSize - 8);
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.font = '9px monospace';
        ctx.fillText(`TARGET: ${org.species} [G${org.generation}]`, -bSize, -bSize - 6);
        ctx.restore();
      }
    }
  };

  const selectedOrganism = selectedOrganismId ? biocyberneticHabitat.getOrganism(selectedOrganismId) : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        background: 'rgba(2, 6, 16, 0.98)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'JetBrains Mono, monospace',
        color: '#e2e8f0',
        overflow: 'hidden',
      }}
    >
      {/* ── 1. Barra Superior HUD con Scroll Horizontal de Telemetría ─────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'rgba(6, 12, 24, 0.96)',
          borderBottom: '1px solid rgba(0, 240, 255, 0.3)',
          boxShadow: '0 2px 15px rgba(0, 240, 255, 0.1)',
          flexShrink: 0,
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{ fontSize: '22px' }}>🌿</span>
          <div>
            <div style={{ color: '#00f0ff', fontWeight: 800, fontSize: '13px', letterSpacing: '1px' }}>
              HÁBITAT DIGITAL BIOCIBERNÉTICO
            </div>
            <div style={{ color: '#8b9bb4', fontSize: '10px' }}>
              Sustrato Continuo Fick &middot; Ecosistema Multi-Cerebro A-Life
            </div>
          </div>
        </div>

        {/* Telemetría Fisiológica con Scroll Horizontal Touch */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 1,
            minWidth: 0,
            padding: '2px 4px',
          }}
        >
          <div
            style={{
              padding: '4px 9px',
              borderRadius: '6px',
              background: connectomeBioBridge.isConnectomeActive() ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 179, 0, 0.2)',
              border: `1px solid ${connectomeBioBridge.isConnectomeActive() ? '#00ff88' : '#ffb300'}`,
              color: connectomeBioBridge.isConnectomeActive() ? '#00ff88' : '#ffb300',
              fontSize: '11px',
              fontWeight: 800,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>🧠</span>
            <span>MALECNS: {connectomeBioBridge.isConnectomeActive() ? 'LAZO CERRADO' : 'AUTÓNOMO'}</span>
          </div>

          <div
            style={{
              padding: '4px 9px',
              borderRadius: '6px',
              background: telemetry.leaderAtp > 0.6 ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 179, 0, 0.15)',
              border: `1px solid ${telemetry.leaderAtp > 0.6 ? '#00ff88' : '#ffb300'}`,
              color: telemetry.leaderAtp > 0.6 ? '#00ff88' : '#ffb300',
              fontSize: '11px',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            ATP: {Math.round(telemetry.leaderAtp * 100)}% ({telemetry.leaderState})
          </div>

          <div
            style={{
              padding: '4px 9px',
              borderRadius: '6px',
              background: 'rgba(0, 240, 255, 0.15)',
              border: '1px solid #00f0ff',
              color: '#00f0ff',
              fontSize: '11px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            GLUCOSA: {Math.round(telemetry.leaderGlucose * 100)}%
          </div>

          <div
            style={{
              padding: '4px 9px',
              borderRadius: '6px',
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid #a855f7',
              color: '#a855f7',
              fontSize: '11px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            POBLACIÓN: {telemetry.organismCount} (🪰 {telemetry.speciesBreakdown.drosophila} | 🪱 {telemetry.speciesBreakdown.cElegans} | 🐜 {telemetry.speciesBreakdown.ant})
          </div>
        </div>

        {/* Botón de Cierre Pinned */}
        <button
          onClick={() => {
            TacticalAudioEngine.playTap();
            onClose();
          }}
          style={{
            flexShrink: 0,
            background: 'rgba(255, 51, 85, 0.15)',
            border: '1px solid #ff3355',
            color: '#ff3355',
            borderRadius: '6px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ✕ CERRAR
        </button>
      </div>

      {/* ── Contenedor Scrollable Principal (Canvas Viewport + Instrumental) ──────── */}
      <div
        className="scroll-container"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          display: 'flex',
          flexDirection: 'column',
          background: '#020610',
          position: 'relative',
        }}
      >
        {/* ── 2. Área Central del Viewport de Simulación ──────────────────────── */}
        <div
          style={{
            flex: 1,
            minHeight: '320px',
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '12px',
            touchAction: 'manipulation',
          }}
        >
          {bannerAlert && (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                zIndex: 20,
                background: 'rgba(6, 12, 24, 0.95)',
                border: '1px solid #00f0ff',
                boxShadow: '0 0 15px rgba(0, 240, 255, 0.3)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#00f0ff',
                letterSpacing: '0.5px',
              }}
            >
              {bannerAlert}
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={720}
            height={560}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            style={{
              maxWidth: '100%',
              maxHeight: 'min(62vh, 560px)',
              width: 'auto',
              height: 'auto',
              aspectRatio: '720/560',
              cursor: 'crosshair',
              boxShadow: '0 0 30px rgba(0, 0, 0, 0.8)',
              borderRadius: '8px',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              touchAction: 'none',
            }}
          />

          {/* ── Bio-Scanner HUD Card Flotante (Inspección Individual) ─────────── */}
          {selectedOrganism && (
            <div
              style={{
                position: 'absolute',
                bottom: '24px',
                left: '24px',
                background: 'rgba(6, 12, 24, 0.94)',
                border: '1px solid #00f0ff',
                boxShadow: '0 0 20px rgba(0, 240, 255, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px',
                width: '280px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 30,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#00f0ff', fontWeight: 800, fontSize: '11px' }}>
                  {selectedOrganism.species === 'DROSOPHILA' && '🪰 DROSOPHILA'}
                  {selectedOrganism.species === 'C_ELEGANS' && '🪱 C. ELEGANS'}
                  {selectedOrganism.species === 'ANT' && '🐜 ANT FORMIDAE'}
                  {' '}[GEN {selectedOrganism.generation}]
                </span>
                <button
                  onClick={() => setSelectedOrganismId(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#8b9bb4',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ fontSize: '10px', color: '#c8d6e5' }}>
                ESTADO: <span style={{ color: '#00ff88', fontWeight: 700 }}>{selectedOrganism.behaviorState}</span>
              </div>

              {/* Barra ATP */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#8b9bb4', marginBottom: '2px' }}>
                  <span>ATP CELULAR</span>
                  <span>{Math.round(selectedOrganism.metabolism.getTelemetry().atpLevel * 100)}%</span>
                </div>
                <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.round(selectedOrganism.metabolism.getTelemetry().atpLevel * 100)}%`,
                      height: '100%',
                      background: '#00ff88',
                    }}
                  />
                </div>
              </div>

              {/* Botones de Acción Directa sobre el Organismo */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button
                  onClick={() => {
                    selectedOrganism.plasticity.injectDopamine(1.0);
                    TacticalAudioEngine.playOptoLaser();
                    triggerAlert(`⚡ ChR2: Refuerzo dopaminérgico inyectado a ${selectedOrganism.id.slice(-6)}`);
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(0, 240, 255, 0.2)',
                    border: '1px solid #00f0ff',
                    color: '#00f0ff',
                    borderRadius: '4px',
                    padding: '4px',
                    fontSize: '9px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ⚡ ESTÍMULO ChR2
                </button>
                <button
                  onClick={() => {
                    biocyberneticHabitat.triggerAirPuff(selectedOrganism.x, selectedOrganism.y, 1.2);
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 179, 0, 0.2)',
                    border: '1px solid #ffb300',
                    color: '#ffb300',
                    borderRadius: '4px',
                    padding: '4px',
                    fontSize: '9px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  💨 AIR PUFF
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Panel Inferior de Instrumental & Malla con Scroll Touch ──────── */}
        <div
          style={{
            background: 'rgba(6, 12, 24, 0.96)',
            borderTop: '1px solid rgba(0, 240, 255, 0.25)',
            padding: '12px 16px 20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          {/* Fila 1: Instrumental de Experimentación */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              whiteSpace: 'nowrap',
              paddingBottom: '2px',
            }}
          >
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#8b9bb4', marginRight: '4px', flexShrink: 0 }}>
              🛠️ INSTRUMENTAL:
            </span>

            <button
              onClick={() => handleSelectTool('GLUCOSE_PIPETTE')}
              style={{
                flexShrink: 0,
                background: selectedTool === 'GLUCOSE_PIPETTE' ? 'rgba(0, 255, 136, 0.25)' : 'rgba(25, 40, 65, 0.5)',
                border: `1px solid ${selectedTool === 'GLUCOSE_PIPETTE' ? '#00ff88' : 'rgba(139, 155, 180, 0.3)'}`,
                color: selectedTool === 'GLUCOSE_PIPETTE' ? '#00ff88' : '#c8d6e5',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              💧 PIPETA GLUCOSA (Drag & Paint)
            </button>

            <button
              onClick={() => handleSelectTool('AIR_PUFF_POKE')}
              style={{
                flexShrink: 0,
                background: selectedTool === 'AIR_PUFF_POKE' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(25, 40, 65, 0.5)',
                border: `1px solid ${selectedTool === 'AIR_PUFF_POKE' ? '#ffffff' : 'rgba(139, 155, 180, 0.3)'}`,
                color: selectedTool === 'AIR_PUFF_POKE' ? '#ffffff' : '#c8d6e5',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              💨 SONDA AIR-PUFF
            </button>

            <button
              onClick={() => handleSelectTool('OPTOGENETIC_LASER')}
              style={{
                flexShrink: 0,
                background: selectedTool === 'OPTOGENETIC_LASER' ? 'rgba(0, 240, 255, 0.25)' : 'rgba(25, 40, 65, 0.5)',
                border: `1px solid ${selectedTool === 'OPTOGENETIC_LASER' ? '#00f0ff' : 'rgba(139, 155, 180, 0.3)'}`,
                color: selectedTool === 'OPTOGENETIC_LASER' ? '#00f0ff' : '#c8d6e5',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ⚡ LÁSER ChR2 (470nm)
            </button>

            <button
              onClick={() => handleSelectTool('ACOUSTIC_BARRIER')}
              style={{
                flexShrink: 0,
                background: selectedTool === 'ACOUSTIC_BARRIER' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(25, 40, 65, 0.5)',
                border: `1px solid ${selectedTool === 'ACOUSTIC_BARRIER' ? '#a855f7' : 'rgba(139, 155, 180, 0.3)'}`,
                color: selectedTool === 'ACOUSTIC_BARRIER' ? '#a855f7' : '#c8d6e5',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🚧 BARRERA ACÚSTICA
            </button>

            <button
              onClick={handleClearBarriers}
              style={{
                flexShrink: 0,
                background: 'rgba(255, 51, 85, 0.15)',
                border: '1px solid #ff3355',
                color: '#ff3355',
                borderRadius: '6px',
                padding: '7px 10px',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🧹 LIMPIAR BARRERAS
            </button>

            <button
              onClick={() => handleSelectTool('HEAT_INFRARED')}
              style={{
                flexShrink: 0,
                background: selectedTool === 'HEAT_INFRARED' ? 'rgba(255, 179, 0, 0.25)' : 'rgba(25, 40, 65, 0.5)',
                border: `1px solid ${selectedTool === 'HEAT_INFRARED' ? '#ffb300' : 'rgba(139, 155, 180, 0.3)'}`,
                color: selectedTool === 'HEAT_INFRARED' ? '#ffb300' : '#c8d6e5',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔥 FOCO TÉRMICO
            </button>

            <button
              onClick={() => handleSelectTool('LOOMING_SHADOW')}
              style={{
                flexShrink: 0,
                background: selectedTool === 'LOOMING_SHADOW' ? 'rgba(255, 51, 85, 0.25)' : 'rgba(25, 40, 65, 0.5)',
                border: `1px solid ${selectedTool === 'LOOMING_SHADOW' ? '#ff3355' : 'rgba(139, 155, 180, 0.3)'}`,
                color: selectedTool === 'LOOMING_SHADOW' ? '#ff3355' : '#c8d6e5',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🌑 SOMBRA LOOMING
            </button>
          </div>

          {/* Fila 2: Actuación Robótica, Migración P2P & Generación */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              whiteSpace: 'nowrap',
              paddingBottom: '2px',
            }}
          >
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#8b9bb4', marginRight: '4px', flexShrink: 0 }}>
              🌐 ENLACES:
            </span>

            <button
              onClick={handleToggleActuators}
              style={{
                flexShrink: 0,
                background: telemetry.isActuatorStreaming ? 'rgba(0, 255, 136, 0.2)' : 'rgba(139, 155, 180, 0.1)',
                border: `1px solid ${telemetry.isActuatorStreaming ? '#00ff88' : 'rgba(139, 155, 180, 0.4)'}`,
                color: telemetry.isActuatorStreaming ? '#00ff88' : '#8b9bb4',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🦾 {telemetry.isActuatorStreaming ? 'PUENTE ROBÓTICO TX [ACTIVO]' : 'PUENTE ROBÓTICO [OFF]'}
            </button>

            <button
              onClick={handleManualEmigrate}
              style={{
                flexShrink: 0,
                background: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid #a855f7',
                color: '#a855f7',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🚀 EMIGRAR EN MALLA P2P
            </button>

            <button
              onClick={() => handleSpawnOrganism('DROSOPHILA')}
              style={{
                flexShrink: 0,
                background: 'rgba(0, 240, 255, 0.15)',
                border: '1px solid #00f0ff',
                color: '#00f0ff',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ➕ 🪰 DROSOPHILA
            </button>

            <button
              onClick={() => handleSpawnOrganism('C_ELEGANS')}
              style={{
                flexShrink: 0,
                background: 'rgba(255, 179, 0, 0.15)',
                border: '1px solid #ffb300',
                color: '#ffb300',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ➕ 🪱 C. ELEGANS
            </button>

            <button
              onClick={() => handleSpawnOrganism('ANT')}
              style={{
                flexShrink: 0,
                background: 'rgba(0, 230, 118, 0.15)',
                border: '1px solid #00e676',
                color: '#00e676',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ➕ 🐜 ANT COLONY
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
