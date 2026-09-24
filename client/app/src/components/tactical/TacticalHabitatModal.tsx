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
  BiocyberneticHabitat3DEngine,
  HabitatCameraMode,
  OrganismMood,
  SugarRaceState,
} from '../../lib/neuro/habitat';
import { BackHandlerRegistry } from '../../lib/navigation/BackHandlerRegistry';
import { TacticalAudioEngine } from '../../lib/audio/TacticalAudioEngine';
import { connectomeBioBridge } from '../../lib/neuro/ConnectomeBioBridge';

export interface TacticalHabitatModalProps {
  onClose: () => void;
}

export const TacticalHabitatModal: React.FC<TacticalHabitatModalProps> = ({ onClose }) => {
  const [telemetry, setTelemetry] = useState<HabitatTelemetry>(biocyberneticHabitat.getTelemetry());
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');
  const [cameraMode, setCameraMode] = useState<HabitatCameraMode>('ORBITAL');
  const [selectedTool, setSelectedTool] = useState<HabitatToolType>('GLUCOSE_PIPETTE');
  const [toolIntensity, setToolIntensity] = useState<number>(1.0);
  const [bannerAlert, setBannerAlert] = useState<string | null>(null);
  const [selectedOrganismId, setSelectedOrganismId] = useState<string | null>(null);
  const [showChessHUD, setShowChessHUD] = useState<boolean>(false);

  const viewport3DRef = useRef<HTMLDivElement | null>(null);
  const engine3DRef = useRef<BiocyberneticHabitat3DEngine | null>(null);
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
    // 1. Inicializar Canvas Offscreen de 64x64 para campo escalar de Fick 2D
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

    // 3. Inicializar Motor Gráfico 3D Inmersivo
    const engine3D = new BiocyberneticHabitat3DEngine();
    engine3DRef.current = engine3D;

    if (viewport3DRef.current && viewMode === '3D') {
      engine3D.attach(viewport3DRef.current);
    }
    engine3D.setOnSelectOrganism((id) => {
      setSelectedOrganismId(id);
      const org = biocyberneticHabitat.getOrganism(id);
      if (org) {
        triggerAlert(`🎯 BIO-SCANNER 3D: Fijado en ${org.species} (${org.id.slice(-6)})`);
      }
    });
    engine3D.setOnAlert((msg) => {
      triggerAlert(msg);
    });

    if (viewMode === '3D') {
      engine3D.start();
    }

    // 4. Suscribir telemetría reactiva
    const unsubTel = biocyberneticHabitat.subscribeTelemetry((t) => {
      setTelemetry(t);
    });

    // 5. Bucle de renderizado Canvas en tiempo real (para modo 2D)
    let animId: number;
    const render2D = () => {
      if (viewMode === '2D') {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            drawHabitatScene(ctx, canvas.width, canvas.height);
          }
        }
      }
      animId = requestAnimationFrame(render2D);
    };
    animId = requestAnimationFrame(render2D);

    return () => {
      cancelAnimationFrame(animId);
      unsubTel();
      biocyberneticHabitat.stop();
      if (engine3DRef.current) {
        engine3DRef.current.dispose();
        engine3DRef.current = null;
      }
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  // Sincronizar alternancia de modo de render 3D / 2D
  useEffect(() => {
    const engine3D = engine3DRef.current;
    if (!engine3D) return;

    if (viewMode === '3D') {
      if (viewport3DRef.current) {
        engine3D.attach(viewport3DRef.current);
      }
      engine3D.start();
    } else {
      engine3D.pause();
    }
  }, [viewMode]);

  // Sincronizar organismo seleccionado con el motor 3D
  useEffect(() => {
    engine3DRef.current?.setSelectedOrganism(selectedOrganismId);
  }, [selectedOrganismId]);

  const handleSelectCameraMode = (mode: HabitatCameraMode) => {
    TacticalAudioEngine.playTap();
    setCameraMode(mode);
    engine3DRef.current?.setCameraMode(mode);
  };

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

  // ── Actividades Lúdicas, Mini-Juegos y Coexistencia Multicerebral ─────────────
  const handleStartSugarRace = () => {
    TacticalAudioEngine.playTap();
    biocyberneticHabitat.startSugarRace();
    triggerAlert('🏆 ¡GRAN TORNEO DE GLUCOSA INICIADO! Todas las inteligencias van por el Mega-Cristal.');
  };

  const handleCancelSugarRace = () => {
    TacticalAudioEngine.playTap();
    biocyberneticHabitat.cancelSugarRace();
    triggerAlert('🏁 Torneo de Glucosa concluido.');
  };

  const handleTriggerNectarShower = () => {
    TacticalAudioEngine.playTap();
    biocyberneticHabitat.triggerNectarShower();
    triggerAlert('🍯 ¡LLUVIA DE NÉCTAR! 10 gotas dulces sembradas en la arena.');
  };

  const handleTriggerAcrobaticWind = () => {
    TacticalAudioEngine.playTap();
    biocyberneticHabitat.triggerAcrobaticWind();
    triggerAlert('💨 RÁFAGA ACROBÁTICA: ¡Giros 360° y evasiones en curso!');
  };

  const handleToggleChessMatch = () => {
    TacticalAudioEngine.playTap();
    biocyberneticHabitat.toggleChessMatch();
    setShowChessHUD(true);
    triggerAlert('♟️ MESA DE AJEDREZ TÁCTICO: Simulación cognitiva autónoma activa');
  };

  const handleResetChessMatch = () => {
    TacticalAudioEngine.playTap();
    biocyberneticHabitat.startChessMatch();
    triggerAlert('🔄 Nueva partida de ajedrez inicializada');
  };

  const handleSwitchChessCompetitors = () => {
    TacticalAudioEngine.playTap();
    const chess = biocyberneticHabitat.getChessEngine();
    if (chess.whiteSpecies === 'HUMAN_NEOCORTEX') {
      biocyberneticHabitat.startChessMatch('DROSOPHILA', 'ANT', 'Fly-124k', 'Obrera-42');
      triggerAlert('🔀 Duelo Biológico: Drosophila vs Formicidae');
    } else if (chess.whiteSpecies === 'DROSOPHILA') {
      biocyberneticHabitat.startChessMatch('GRAVITY_SENTINEL', 'C_ELEGANS', 'Sentinel Aegis-1', 'Nematodo-302');
      triggerAlert('🔀 Duelo Cyber-Helminth: Gravity Sentinel vs C. elegans');
    } else {
      biocyberneticHabitat.startChessMatch('HUMAN_NEOCORTEX', 'GRAVITY_SENTINEL', 'Neocórtex Alpha', 'Sentinel Aegis-1');
      triggerAlert('🔀 Duelo Cumbre: Neocórtex Humano vs Gravity Sentinel');
    }
  };

  const handlePetOrganism = (id: string) => {
    const msg = biocyberneticHabitat.petOrganism(id);
    triggerAlert(msg);
  };

  const handleFeedTreat = (id: string) => {
    const msg = biocyberneticHabitat.feedOrganismTreat(id);
    triggerAlert(msg);
  };

  const handleTalkToOrganism = (id: string) => {
    TacticalAudioEngine.playTap();
    const thought = biocyberneticHabitat.talkToOrganism(id);
    triggerAlert(`🗣️ Pensamiento: ${thought}`);
  };

  const handleTriggerAurora = () => {
    biocyberneticHabitat.triggerAuroraBorealis();
    triggerAlert('🌌 AURORA BOREAL: Resonancia armónica Solfeggio 432/528 Hz activada en el cielo');
  };

  const handleTriggerNectarDew = () => {
    biocyberneticHabitat.triggerNectarDew();
    triggerAlert('💧 ROCÍO CELESTIAL: 10 micro-gotas de néctar y serotonina dispersadas');
  };

  const handleTriggerSerotoninBreeze = () => {
    biocyberneticHabitat.triggerSerotoninBreeze();
    triggerAlert('🍃 BRISA DE SEROTONINA: Estado de sosiego y paz inducido en el hábitat');
  };

  const handleTriggerMeditation = () => {
    biocyberneticHabitat.triggerMeditationRepose();
    triggerAlert('🧘 HORA DE MEDITACIÓN: Consolidación de memoria episódica en sueño REM');
  };

  const handleFocusSpecies = (species: OrganismSpecies) => {
    TacticalAudioEngine.playTap();
    const all = biocyberneticHabitat.getAllOrganisms().filter((o) => o.species === species && !o.isDecomposing);
    if (all.length > 0) {
      setSelectedOrganismId(all[0].id);
      triggerAlert(`🎯 ENFOQUE: ${biocyberneticHabitat.getSpeciesDisplayName(species)} seleccionado.`);
    } else {
      handleSpawnOrganism(species);
    }
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
      biocyberneticHabitat.triggerPlayfulLaser(worldX, worldY);
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
      biocyberneticHabitat.triggerPlayfulLaser(worldX, worldY);
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
        const serotonin = biocyberneticHabitat.diffusionGrid.getBuffer('SEROTONIN');

        for (let i = 0; i < 4096; i++) {
          const g = glucose[i];
          const t = trail[i];
          const a = alarm[i];
          const s = serotonin ? serotonin[i] || 0 : 0;

          const pIdx = i * 4;
          // Glucosa (Verde esmeralda), Trail (Ámbar dorado), Alarma (Carmesí), Serotonina (Violeta/Cian celestial)
          data[pIdx] = Math.min(255, Math.floor(a * 180 + t * 240 + s * 140));
          data[pIdx + 1] = Math.min(255, Math.floor(g * 240 + t * 180 + s * 80));
          data[pIdx + 2] = Math.min(255, Math.floor(a * 220 + g * 110 + s * 250));
          data[pIdx + 3] = Math.min(220, Math.floor((g * 1.5 + t * 2.2 + a * 2.5 + s * 2.0) * 110));
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

    // 6.2 Mesa de Ajedrez Táctico Central en 2D
    const chessTableX = centerX + 0.0 * scale;
    const chessTableY = centerY + 1.2 * scale;
    const tableRadiusPx = 0.7 * scale;

    ctx.save();
    ctx.translate(chessTableX, chessTableY);

    // Pedestal circular
    ctx.fillStyle = 'rgba(8, 20, 36, 0.85)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, tableRadiusPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tablero 8x8 en miniatura
    const tbSize = tableRadiusPx * 1.2;
    const tbCell = tbSize / 8;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(30, 58, 95, 0.8)' : 'rgba(7, 17, 30, 0.8)';
        ctx.fillRect(-tbSize / 2 + c * tbCell, -tbSize / 2 + r * tbCell, tbCell, tbCell);
      }
    }

    // Icono y texto
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♟️', 0, 0);

    ctx.font = '800 8px monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('MESA AJEDREZ', 0, tableRadiusPx + 10);
    ctx.restore();

    // 6.3 Mega-Cristal de Glucosa del Gran Torneo en 2D
    const sugarRace = biocyberneticHabitat.getSugarRaceState();
    if (sugarRace && sugarRace.isActive) {
      const gX = centerX + sugarRace.targetX * scale;
      const gY = centerY + sugarRace.targetY * scale;

      ctx.save();
      ctx.translate(gX, gY);

      // Halo pulsante dorado
      const pulseR = 22 + Math.sin(Date.now() * 0.007) * 5;
      const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, pulseR);
      grad.addColorStop(0, 'rgba(255, 215, 0, 0.9)');
      grad.addColorStop(0.5, 'rgba(255, 170, 0, 0.35)');
      grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
      ctx.fill();

      // Diamante Octaédrico dorado
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(11, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-11, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Etiqueta del Torneo
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.fillText(`🏆 MEGA-CRISTAL [${Math.ceil(sugarRace.timeRemainingSec)}s]`, 0, -16);
      ctx.restore();
    }

    // 6.4 Paraíso Biocibernético en 2D: Árbol de la Vida, Manantiales & Micelio
    const edenParadise = biocyberneticHabitat.getEdenParadiseEngine();

    // Red Micelial 2D
    ctx.save();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 5]);
    for (const hypha of edenParadise.myceliumHyphae) {
      const fromNode = edenParadise.myceliumNodes.find(n => n.id === hypha.fromId);
      const toNode = edenParadise.myceliumNodes.find(n => n.id === hypha.toId);
      if (fromNode && toNode) {
        ctx.beginPath();
        ctx.moveTo(centerX + fromNode.x * scale, centerY + fromNode.y * scale);
        ctx.lineTo(centerX + toNode.x * scale, centerY + toNode.y * scale);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 3 Manantiales de Néctar Cristalino 2D
    for (const spring of edenParadise.nectarSprings) {
      const spX = centerX + spring.x * scale;
      const spY = centerY + spring.y * scale;
      const spR = spring.radiusMeters * scale;

      ctx.save();
      ctx.translate(spX, spY);

      // Halo concéntrico de agua bioluminiscente
      const spGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, spR);
      spGrad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
      spGrad.addColorStop(0.7, 'rgba(168, 85, 247, 0.25)');
      spGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = spGrad;
      ctx.beginPath();
      ctx.arc(0, 0, spR, 0, Math.PI * 2);
      ctx.fill();

      // Borde del manantial
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, spR * 0.7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '8px monospace';
      ctx.fillStyle = '#a855f7';
      ctx.textAlign = 'center';
      ctx.fillText(spring.name.split(' ')[0], 0, spR * 0.7 + 10);
      ctx.restore();
    }

    // Árbol de la Vida Cuántico 2D (Centro)
    const treeRadiusPx = edenParadise.treeOfLife.radiusMeters * scale;
    ctx.save();
    ctx.translate(centerX, centerY);

    const treeGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, treeRadiusPx);
    treeGrad.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
    treeGrad.addColorStop(0.6, 'rgba(0, 240, 255, 0.15)');
    treeGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = treeGrad;
    ctx.beginPath();
    ctx.arc(0, 0, treeRadiusPx, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌳', 0, -2);

    ctx.font = '800 8.5px monospace';
    ctx.fillStyle = '#10b981';
    ctx.fillText('ÁRBOL DE LA VIDA', 0, treeRadiusPx + 11);
    ctx.restore();

    // 6.3 Puntero Láser Juguetón en 2D
    const laserChase = biocyberneticHabitat.getLaserChaseTarget();
    if (laserChase) {
      const lX = centerX + laserChase.x * scale;
      const lY = centerY + laserChase.y * scale;

      ctx.save();
      ctx.translate(lX, lY);

      // Anillo concéntrico pulsante cian
      const ringR = 12 + Math.sin(Date.now() * 0.012) * 4;
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#00ffcc';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#00ffcc';
      ctx.textAlign = 'center';
      ctx.fillText('🎯 LÁSER', 0, ringR + 10);
      ctx.restore();
    }

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

        // Alas translúcidas: anatómicas plegadas sobre el abdomen en marcha/reposo, desplegadas en vuelo/escape
        const isFlightSpeed = org.speedMps >= 1.0;
        ctx.fillStyle = 'rgba(180, 240, 255, 0.55)';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
        ctx.lineWidth = 1;

        if (isFlightSpeed) {
          // Despliegue lateral con aleteo de alta frecuencia
          const wingOsc = Math.sin(org.wingFlapPhase) * 0.35;
          // Ala izq abierta lateralmente
          ctx.beginPath();
          ctx.ellipse(-2, -9, 11, 4.5, -0.45 + wingOsc, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          // Ala der abierta lateralmente
          ctx.beginPath();
          ctx.ellipse(-2, 9, 11, 4.5, 0.45 - wingOsc, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        } else {
          // Posición anatómica dorsal: plegadas planas sobre el abdomen (eje posterior -X)
          const wingBuzz = Math.sin(org.wingFlapPhase) * 0.05;
          // Ala izq (dorso-medial)
          ctx.beginPath();
          ctx.ellipse(-6, -2.5, 10, 4.0, -0.06 + wingBuzz, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          // Ala der (solapada en línea media)
          ctx.beginPath();
          ctx.ellipse(-6, 2.5, 10, 4.0, 0.06 - wingBuzz, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        }

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

      } else if (org.species === 'GRAVITY_SENTINEL') {
        // ── Morfología Dron Centinela Cuántico Gravity AI ──
        // 4 Brazos de propulsión
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.0;
        const armLen = 11;
        ctx.beginPath();
        ctx.moveTo(-armLen, -armLen); ctx.lineTo(armLen, armLen);
        ctx.moveTo(-armLen, armLen);  ctx.lineTo(armLen, -armLen);
        ctx.stroke();

        // Góndolas de propulsores iónicos con pulso cian
        const rotorR = 4.0;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.2;
        [[-armLen, -armLen], [armLen, armLen], [-armLen, armLen], [armLen, -armLen]].forEach(([rx, ry]) => {
          ctx.beginPath();
          ctx.arc(rx, ry, rotorR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Chasis central aerodinámico blindado
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Ojo óptico sensorial cuántico central
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(2.5, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Cono de escaneo hacia adelante
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.beginPath();
        ctx.moveTo(3, 0);
        ctx.lineTo(24, -10);
        ctx.lineTo(24, 10);
        ctx.closePath();
        ctx.fill();

      } else if (org.species === 'HUMAN_NEOCORTEX') {
        // ── Morfología Avatar Neocortical Cognitivo ──
        // Anillo hexagonal entorrinal base
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const hx = Math.cos(a) * 12;
          const hy = Math.sin(a) * 12;
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();

        // Torso biomecánico esmeralda
        ctx.fillStyle = '#064e3b';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(0, 0, 8.5, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Cabeza y visor cibernético
        ctx.fillStyle = '#042f2e';
        ctx.beginPath();
        ctx.arc(6.5, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Cerebro neocortical pulsante
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(6.5, 0, 3.0, 0, Math.PI * 2);
        ctx.fill();

        // Vector de atención epistémica
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(19, 0);
        ctx.stroke();
      }

      ctx.restore();

      // 7.1 Bocadillo de Pensamiento Táctico en 2D
      if (org.currentThought && (org.id === selectedOrganismId || org.mood === 'COMPETITIVE' || org.mood === 'PLAYFUL')) {
        ctx.save();
        ctx.translate(px, py - 22);

        const moodEmoji =
          org.mood === 'COMPETITIVE'
            ? '🏆'
            : org.mood === 'PLAYFUL'
            ? '⚡'
            : org.mood === 'HUNGRY'
            ? '🍓'
            : org.mood === 'ZEN'
            ? '🧘'
            : '🔍';

        const bubbleText = `${moodEmoji} ${org.currentThought}`;
        ctx.font = '9.5px monospace';
        const textWidth = ctx.measureText(bubbleText).width;
        const bW = Math.max(60, textWidth + 12);
        const bH = 16;

        ctx.fillStyle = 'rgba(6, 14, 28, 0.92)';
        ctx.strokeStyle =
          org.species === 'GRAVITY_SENTINEL'
            ? '#38bdf8'
            : org.species === 'HUMAN_NEOCORTEX'
            ? '#34d399'
            : org.species === 'DROSOPHILA'
            ? '#00e5ff'
            : org.species === 'C_ELEGANS'
            ? '#2dd4bf'
            : '#fbbf24';
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-bW / 2, -bH, bW, bH, 4);
        } else {
          ctx.rect(-bW / 2, -bH, bW, bH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bubbleText, 0, -bH / 2);
        ctx.restore();
      }

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
            POBLACIÓN: {telemetry.organismCount} (🪰 {telemetry.speciesBreakdown.drosophila} | 🧠 {telemetry.speciesBreakdown.humanNeocortex || 0} | 🛸 {telemetry.speciesBreakdown.gravitySentinel || 0} | 🪱 {telemetry.speciesBreakdown.cElegans} | 🐜 {telemetry.speciesBreakdown.ant})
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

      {/* ── Coexistencia Multicerebral: 5 Inteligencias Vivas en Simbiosis ────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          background: 'rgba(4, 9, 20, 0.95)',
          borderBottom: '1px solid rgba(0, 240, 255, 0.15)',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8', flexShrink: 0 }}>
          ⚡ 5 INTELIGENCIAS:
        </span>
        {[
          { species: 'DROSOPHILA' as OrganismSpecies, icon: '🪰', label: 'MaleCNS v1.0', count: telemetry.speciesBreakdown.drosophila, color: '#00f0ff' },
          { species: 'HUMAN_NEOCORTEX' as OrganismSpecies, icon: '🧠', label: 'Neocortex Humano', count: telemetry.speciesBreakdown.humanNeocortex || 0, color: '#34d399' },
          { species: 'GRAVITY_SENTINEL' as OrganismSpecies, icon: '🛸', label: 'Gravity Sentinel IA', count: telemetry.speciesBreakdown.gravitySentinel || 0, color: '#38bdf8' },
          { species: 'C_ELEGANS' as OrganismSpecies, icon: '🪱', label: 'C. elegans (302N)', count: telemetry.speciesBreakdown.cElegans, color: '#2dd4bf' },
          { species: 'ANT' as OrganismSpecies, icon: '🐜', label: 'Formicidae Colonia', count: telemetry.speciesBreakdown.ant, color: '#fbbf24' },
        ].map((item) => (
          <button
            key={item.species}
            onClick={() => handleFocusSpecies(item.species)}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: selectedOrganism?.species === item.species ? `${item.color}25` : 'rgba(15, 23, 42, 0.65)',
              border: `1px solid ${selectedOrganism?.species === item.species ? item.color : 'rgba(148, 163, 184, 0.2)'}`,
              color: selectedOrganism?.species === item.species ? item.color : '#cbd5e1',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 700,
              transition: 'all 0.15s ease',
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            <span
              style={{
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.08)',
                color: item.color,
                fontWeight: 800,
              }}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Banner Dorado del Gran Torneo de Glucosa (Live HUD) ──────────────── */}
      {telemetry.sugarRace && telemetry.sugarRace.isActive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.15), rgba(245, 158, 11, 0.25))',
            borderBottom: '1px solid #ffd700',
            boxShadow: '0 0 20px rgba(255, 215, 0, 0.2)',
            flexShrink: 0,
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '18px' }}>🏆</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#ffd700', fontWeight: 800, fontSize: '11px', letterSpacing: '0.8px' }}>
                GRAN TORNEO DE GLUCOSA &middot; TIEMPO: {Math.ceil(telemetry.sugarRace.timeRemainingSec)}s
              </div>
              <div style={{ color: '#fef3c7', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {telemetry.sugarRace.announcement}
              </div>
            </div>
          </div>
          <button
            onClick={handleCancelSugarRace}
            style={{
              flexShrink: 0,
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              color: '#ef4444',
              borderRadius: '5px',
              padding: '4px 10px',
              fontSize: '10px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            🏁 CANCELAR TORNEO
          </button>
        </div>
      )}

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
            minHeight: '380px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '8px 12px',
            touchAction: 'none',
          }}
        >
          {/* Controles Flotantes Superiores: Modo 3D / 2D y Modos de Cámara */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '20px',
              zIndex: 25,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(6, 12, 24, 0.88)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              borderRadius: '8px',
              padding: '4px 6px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <button
              onClick={() => {
                TacticalAudioEngine.playTap();
                setViewMode((prev) => (prev === '3D' ? '2D' : '3D'));
              }}
              style={{
                background: viewMode === '3D' ? 'rgba(0, 240, 255, 0.25)' : 'rgba(25, 40, 65, 0.6)',
                border: `1px solid ${viewMode === '3D' ? '#00f0ff' : 'rgba(139, 155, 180, 0.4)'}`,
                color: viewMode === '3D' ? '#00f0ff' : '#8b9bb4',
                borderRadius: '5px',
                padding: '5px 10px',
                fontSize: '10px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{viewMode === '3D' ? '🌐' : '🗺️'}</span>
              <span>{viewMode === '3D' ? '3D INMERSIVO' : '2D RADAR'}</span>
            </button>
          </div>

          {viewMode === '3D' && (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '20px',
                zIndex: 25,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(6, 12, 24, 0.88)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: '8px',
                padding: '4px 6px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {(['ORBITAL', 'FOLLOW_AGENT', 'TOP_DOWN_GOD'] as HabitatCameraMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleSelectCameraMode(mode)}
                  style={{
                    background: cameraMode === mode ? 'rgba(0, 255, 136, 0.22)' : 'rgba(25, 40, 65, 0.6)',
                    border: `1px solid ${cameraMode === mode ? '#00ff88' : 'rgba(139, 155, 180, 0.3)'}`,
                    color: cameraMode === mode ? '#00ff88' : '#8b9bb4',
                    borderRadius: '5px',
                    padding: '5px 8px',
                    fontSize: '9px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {mode === 'ORBITAL' && '🪐 ORBITAL'}
                  {mode === 'FOLLOW_AGENT' && '👁️ SEGUIR'}
                  {mode === 'TOP_DOWN_GOD' && '📐 CENITAL'}
                </button>
              ))}
            </div>
          )}

          {bannerAlert && (
            <div
              style={{
                position: 'absolute',
                top: '56px',
                zIndex: 26,
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

          {viewMode === '3D' ? (
            <div
              ref={viewport3DRef}
              style={{
                width: '100%',
                maxWidth: '100%',
                height: '100%',
                minHeight: '440px',
                maxHeight: 'min(78vh, 850px)',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid rgba(0, 240, 255, 0.35)',
                boxShadow: '0 0 35px rgba(0, 0, 0, 0.9), inset 0 0 25px rgba(0, 240, 255, 0.06)',
                position: 'relative',
                touchAction: 'none',
                cursor: selectedTool === 'GLUCOSE_PIPETTE' ? 'crosshair' : 'grab',
              }}
            />
          ) : (
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
                maxHeight: 'min(74vh, 760px)',
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
          )}

          {/* ── Bio-Scanner HUD Card Flotante (Inspección Individual Multicerebro) ─────────── */}
          {selectedOrganism && (
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                background: 'rgba(6, 12, 24, 0.95)',
                border: `1px solid ${
                  selectedOrganism.species === 'GRAVITY_SENTINEL'
                    ? '#38bdf8'
                    : selectedOrganism.species === 'HUMAN_NEOCORTEX'
                    ? '#34d399'
                    : selectedOrganism.species === 'DROSOPHILA'
                    ? '#00f0ff'
                    : selectedOrganism.species === 'C_ELEGANS'
                    ? '#2dd4bf'
                    : '#fbbf24'
                }`,
                boxShadow: '0 0 25px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 240, 255, 0.2)',
                borderRadius: '10px',
                padding: '12px 14px',
                width: '320px',
                maxWidth: 'calc(100% - 40px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 30,
                backdropFilter: 'blur(10px)',
              }}
            >
              {/* Encabezado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#00f0ff', fontWeight: 800, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>
                    {selectedOrganism.species === 'DROSOPHILA' && '🪰'}
                    {selectedOrganism.species === 'HUMAN_NEOCORTEX' && '🧠'}
                    {selectedOrganism.species === 'GRAVITY_SENTINEL' && '🛸'}
                    {selectedOrganism.species === 'C_ELEGANS' && '🪱'}
                    {selectedOrganism.species === 'ANT' && '🐜'}
                  </span>
                  <span>
                    {selectedOrganism.species === 'DROSOPHILA' && 'DROSOPHILA (MaleCNS v1.0)'}
                    {selectedOrganism.species === 'HUMAN_NEOCORTEX' && 'NEOCORTEX HUMANO'}
                    {selectedOrganism.species === 'GRAVITY_SENTINEL' && 'GRAVITY SENTINEL IA'}
                    {selectedOrganism.species === 'C_ELEGANS' && 'C. ELEGANS (302N)'}
                    {selectedOrganism.species === 'ANT' && 'FORMICIDAE OBRERA'}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '9px' }}>[G{selectedOrganism.generation}]</span>
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

              {/* Mood & Personalidad */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9.5px' }}>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(0, 240, 255, 0.12)',
                    border: '1px solid rgba(0, 240, 255, 0.3)',
                    color: '#00f0ff',
                    fontWeight: 700,
                  }}
                >
                  ÁNIMO:{' '}
                  {selectedOrganism.mood === 'COMPETITIVE' && '🏆 COMPETITIVO'}
                  {selectedOrganism.mood === 'PLAYFUL' && '⚡ JUGUETÓN'}
                  {selectedOrganism.mood === 'HUNGRY' && '🍓 HAMBRIENTO'}
                  {selectedOrganism.mood === 'ZEN' && '🧘 ZEN'}
                  {selectedOrganism.mood === 'CURIOUS' && '🔍 CURIOSO'}
                  {selectedOrganism.mood === 'ENERGETIC' && '🔥 ENÉRGICO'}
                  {selectedOrganism.mood === 'VIGILANT' && '⚠️ VIGILANTE'}
                  {selectedOrganism.mood === 'SERENITY' && '🌿 SERENIDAD EDÉNICA'}
                  {selectedOrganism.mood === 'TRANSCENDENCE' && '🌌 TRANSCENDENCIA'}
                  {selectedOrganism.mood === 'DREAMING' && '💤 SUEÑO REM REPARADOR'}
                </span>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(168, 85, 247, 0.12)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: '#c084fc',
                    fontWeight: 700,
                  }}
                >
                  {selectedOrganism.personality}
                </span>
                <span style={{ color: '#64748b', marginLeft: 'auto', fontSize: '9px' }}>
                  {selectedOrganism.behaviorState}
                </span>
              </div>

              {/* Bocadillo de Pensamiento en Vivo */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  fontSize: '10px',
                  lineHeight: '1.35',
                  color: '#f1f5f9',
                }}
              >
                <div style={{ fontSize: '8.5px', color: '#38bdf8', fontWeight: 800, marginBottom: '2px' }}>
                  💭 PENSAMIENTO EN TIEMPO REAL:
                </div>
                <div style={{ fontStyle: 'italic' }}>
                  "{selectedOrganism.currentThought || 'Sintetizando gradiente epigenético y tensores sinápticos...'}"
                </div>
              </div>

              {/* Barras de Energía y Metabolismo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: '#8b9bb4', marginBottom: '2px' }}>
                    <span>ATP CELULAR</span>
                    <span>{Math.round(selectedOrganism.metabolism.getTelemetry().atpLevel * 100)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.round(selectedOrganism.metabolism.getTelemetry().atpLevel * 100)}%`,
                        height: '100%',
                        background: '#00ff88',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: '#8b9bb4', marginBottom: '2px' }}>
                    <span>GLUCOSA</span>
                    <span>{Math.round(selectedOrganism.metabolism.getTelemetry().glucoseLevel * 100)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.round(selectedOrganism.metabolism.getTelemetry().glucoseLevel * 100)}%`,
                        height: '100%',
                        background: '#ffd700',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Botones de Acción Afectiva, Social y Mecánica */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '2px' }}>
                <button
                  onClick={() => handleFeedTreat(selectedOrganism.id)}
                  style={{
                    background: 'rgba(255, 215, 0, 0.15)',
                    border: '1px solid #ffd700',
                    color: '#ffd700',
                    borderRadius: '4px',
                    padding: '4px',
                    fontSize: '9px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🍰 NÉCTAR
                </button>
                <button
                  onClick={() => handlePetOrganism(selectedOrganism.id)}
                  style={{
                    background: 'rgba(244, 63, 94, 0.15)',
                    border: '1px solid #f43f5e',
                    color: '#f43f5e',
                    borderRadius: '4px',
                    padding: '4px',
                    fontSize: '9px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  💖 ACARICIAR
                </button>
                <button
                  onClick={() => handleTalkToOrganism(selectedOrganism.id)}
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid #38bdf8',
                    color: '#38bdf8',
                    borderRadius: '4px',
                    padding: '4px',
                    fontSize: '9px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🗣️ CONVERSAR
                </button>
                <button
                  onClick={() => {
                    selectedOrganism.plasticity.injectDopamine(2.0);
                    TacticalAudioEngine.playOptoLaser();
                    triggerAlert(`⚡ ChR2: Refuerzo dopaminérgico inyectado a ${selectedOrganism.id.slice(-6)}`);
                  }}
                  style={{
                    background: 'rgba(0, 240, 255, 0.15)',
                    border: '1px solid #00f0ff',
                    color: '#00f0ff',
                    borderRadius: '4px',
                    padding: '4px',
                    fontSize: '9px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ⚡ ChR2
                </button>
                <button
                  onClick={() => {
                    biocyberneticHabitat.triggerAirPuff(selectedOrganism.x, selectedOrganism.y, 1.2);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid #ffffff',
                    color: '#ffffff',
                    borderRadius: '4px',
                    padding: '4px',
                    fontSize: '9px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  💨 AIR PUFF
                </button>
                <button
                  onClick={() => handleSelectCameraMode('FOLLOW_AGENT')}
                  style={{
                    background: 'rgba(52, 211, 153, 0.15)',
                    border: '1px solid #34d399',
                    color: '#34d399',
                    borderRadius: '4px',
                    padding: '4px',
                    fontSize: '9px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🎥 SEGUIR 3D
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

          {/* Fila 2: Ludoteca & Mini-Juegos Interactivos */}
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
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#ffd700', marginRight: '4px', flexShrink: 0 }}>
              🎮 LUDOTECA:
            </span>

            <button
              onClick={telemetry.sugarRace?.isActive ? handleCancelSugarRace : handleStartSugarRace}
              style={{
                flexShrink: 0,
                background: telemetry.sugarRace?.isActive ? 'rgba(255, 215, 0, 0.35)' : 'rgba(245, 158, 11, 0.18)',
                border: `1px solid ${telemetry.sugarRace?.isActive ? '#ffd700' : 'rgba(245, 158, 11, 0.5)'}`,
                color: '#ffd700',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: telemetry.sugarRace?.isActive ? '0 0 12px rgba(255, 215, 0, 0.4)' : 'none',
              }}
            >
              {telemetry.sugarRace?.isActive ? '🏁 DETENER TORNEO GLUCOSA' : '🏆 GRAN TORNEO DE GLUCOSA'}
            </button>

            <button
              onClick={() => handleSelectTool('OPTOGENETIC_LASER')}
              style={{
                flexShrink: 0,
                background: selectedTool === 'OPTOGENETIC_LASER' ? 'rgba(0, 255, 204, 0.3)' : 'rgba(0, 255, 204, 0.12)',
                border: `1px solid ${selectedTool === 'OPTOGENETIC_LASER' ? '#00ffcc' : 'rgba(0, 255, 204, 0.4)'}`,
                color: '#00ffcc',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🎯 PUNTERO LÁSER (Chase)
            </button>

            <button
              onClick={handleTriggerNectarShower}
              style={{
                flexShrink: 0,
                background: 'rgba(251, 191, 36, 0.18)',
                border: '1px solid #fbbf24',
                color: '#fbbf24',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🍯 LLUVIA DE NÉCTAR (+10 Dulces)
            </button>

            <button
              onClick={handleTriggerAcrobaticWind}
              style={{
                flexShrink: 0,
                background: 'rgba(56, 189, 248, 0.18)',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              💨 RÁFAGA ACROBÁTICA (360°)
            </button>

            <button
              onClick={handleToggleChessMatch}
              style={{
                flexShrink: 0,
                background: telemetry.chessMatch?.isActive ? 'rgba(0, 240, 255, 0.3)' : 'rgba(0, 240, 255, 0.15)',
                border: `1px solid ${telemetry.chessMatch?.isActive ? '#00f0ff' : 'rgba(0, 240, 255, 0.4)'}`,
                color: '#00f0ff',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: telemetry.chessMatch?.isActive ? '0 0 12px rgba(0, 240, 255, 0.4)' : 'none',
              }}
            >
              ♟️ AJEDREZ TÁCTICO IN-SILICO {telemetry.chessMatch?.isActive ? (telemetry.chessMatch.isPaused ? '(PAUSADO)' : '(EN CURSO)') : ''}
            </button>
          </div>

          {/* Fila 3: Paraíso Edénico, Clima Celestial & Sabiduría L9 */}
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
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', marginRight: '4px', flexShrink: 0 }}>
              🌿 PARAÍSO EDÉNICO:
            </span>

            <button
              onClick={handleTriggerAurora}
              style={{
                flexShrink: 0,
                background: 'rgba(0, 240, 255, 0.2)',
                border: '1px solid #00f0ff',
                color: '#00f0ff',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🌌 AURORA BOREAL (432/528Hz)
            </button>

            <button
              onClick={handleTriggerNectarDew}
              style={{
                flexShrink: 0,
                background: 'rgba(52, 211, 153, 0.2)',
                border: '1px solid #34d399',
                color: '#34d399',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              💧 ROCÍO CELESTIAL
            </button>

            <button
              onClick={handleTriggerSerotoninBreeze}
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
              🍃 BRISA SEROTONINA
            </button>

            <button
              onClick={handleTriggerMeditation}
              style={{
                flexShrink: 0,
                background: 'rgba(236, 72, 153, 0.2)',
                border: '1px solid #ec4899',
                color: '#ec4899',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🧘 MEDITACIÓN & SUEÑO REM
            </button>

            <div
              style={{
                flexShrink: 0,
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '10px',
                color: '#6ee7b7',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{telemetry.edenParadise?.circadian?.isDaytime ? '☀️ DÍA SOLAR' : '🌙 NOCHE BOREAL'}</span>
              <span>•</span>
              <span>SABIDURÍA: Lv.{telemetry.lifelongLearning?.overallWisdomIndex ?? 10}</span>
              {telemetry.lifelongLearning?.isDreamReplayActive && (
                <span style={{ color: '#c084fc', animation: 'pulse 1.5s infinite' }}>💤 REPLAY ACTIVO</span>
              )}
            </div>
          </div>

          {/* Fila 3: Actuación Robótica, Migración P2P & Generación */}
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
              onClick={() => handleSpawnOrganism('HUMAN_NEOCORTEX')}
              style={{
                flexShrink: 0,
                background: 'rgba(52, 211, 153, 0.15)',
                border: '1px solid #34d399',
                color: '#34d399',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ➕ 🧠 NEOCORTEX HUMANO
            </button>

            <button
              onClick={() => handleSpawnOrganism('GRAVITY_SENTINEL')}
              style={{
                flexShrink: 0,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ➕ 🛸 GRAVITY SENTINEL
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

        {/* Modal / Card Flotante de Ajedrez Táctico In-Silico */}
        {showChessHUD && (
          <div
            style={{
              position: 'absolute',
              top: '60px',
              right: '20px',
              width: '320px',
              background: 'rgba(8, 15, 29, 0.95)',
              border: '1px solid #00f0ff',
              borderRadius: '10px',
              padding: '14px',
              boxShadow: '0 0 24px rgba(0, 240, 255, 0.3)',
              zIndex: 30,
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#00f0ff', letterSpacing: '0.5px' }}>
                ♟️ MESA DE AJEDREZ IN-SILICO
              </span>
              <button
                onClick={() => setShowChessHUD(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: '0 4px',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: '#fff', fontWeight: 700 }}>
                ♔ {telemetry.chessMatch?.whiteName || 'Blancas'}
                <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'monospace' }}>{telemetry.chessMatch?.whiteSpecies}</div>
              </div>
              <span style={{ color: '#ff3355', fontWeight: 900, fontSize: '11px' }}>VS</span>
              <div style={{ fontSize: '10px', color: '#ffd700', fontWeight: 700, textAlign: 'right' }}>
                ♚ {telemetry.chessMatch?.blackName || 'Negras'}
                <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'monospace' }}>{telemetry.chessMatch?.blackSpecies}</div>
              </div>
            </div>

            {/* Mini Tablero 8x8 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ border: '2px solid #00f0ff', borderRadius: '4px', overflow: 'hidden' }}>
                {biocyberneticHabitat.getChessEngine().board.map((row, r) => (
                  <div key={r} style={{ display: 'flex' }}>
                    {row.map((piece, c) => {
                      const isWhitePiece = piece && piece === piece.toUpperCase();
                      const UNICODE_PIECES: Record<string, string> = {
                        'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
                        'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
                      };
                      return (
                        <div
                          key={c}
                          style={{
                            width: 26,
                            height: 26,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            background: (r + c) % 2 === 0 ? '#1e293b' : '#0f172a',
                            color: isWhitePiece ? '#ffffff' : '#ffd700',
                            userSelect: 'none',
                          }}
                        >
                          {piece ? (UNICODE_PIECES[piece] || piece) : ''}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '10px', fontFamily: 'monospace' }}>
              <span style={{ color: telemetry.chessMatch?.currentTurn === 'w' ? '#00ff88' : '#ffd700', fontWeight: 800 }}>
                TURNO: {telemetry.chessMatch?.currentTurn === 'w' ? 'BLANCAS' : 'NEGRAS'}
              </span>
              <span style={{ color: '#94a3b8' }}>
                JUGADAS: {telemetry.chessMatch?.moveCount || 0}
              </span>
            </div>

            {/* Botones de Control */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              <button
                onClick={handleToggleChessMatch}
                style={{
                  flex: 1,
                  background: 'rgba(0, 240, 255, 0.2)',
                  border: '1px solid #00f0ff',
                  color: '#00f0ff',
                  borderRadius: '5px',
                  padding: '6px',
                  fontSize: '10px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {telemetry.chessMatch?.isPaused ? '▶️ REANUDAR' : '⏸️ PAUSAR'}
              </button>
              <button
                onClick={handleResetChessMatch}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  borderRadius: '5px',
                  padding: '6px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🔄 REINICIAR
              </button>
              <button
                onClick={handleSwitchChessCompetitors}
                style={{
                  flex: 1,
                  background: 'rgba(176, 38, 255, 0.2)',
                  border: '1px solid #b026ff',
                  color: '#b026ff',
                  borderRadius: '5px',
                  padding: '6px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🔀 DUELO
              </button>
            </div>

            {/* Pensamiento de la IA en tiempo real */}
            {biocyberneticHabitat.getChessEngine().lastThought && (
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '6px', borderLeft: '3px solid #ffd700' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#ffd700', marginBottom: '2px' }}>
                  💭 {biocyberneticHabitat.getChessEngine().lastThought?.name}:
                </div>
                <div style={{ fontSize: '10px', color: '#c8d6e5', fontStyle: 'italic', lineHeight: 1.3 }}>
                  "{biocyberneticHabitat.getChessEngine().lastThought?.thought}"
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
