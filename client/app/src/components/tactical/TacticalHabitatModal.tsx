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
  BiocyberneticHabitatEngine,
  HabitatTelemetry,
  HabitatToolType,
  OrganismSpecies,
  HabitatOrganism,
  BiocyberneticHabitat3DEngine,
  HabitatCameraMode,
  OrganismMood,
  SugarRaceState,
  computeFitnessScore,
  UrbanStructureType,
  CivilianCaste,
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
  const [activeMainTab, setActiveMainTab] = useState<'VIEWPORT' | 'EVOLUTION' | 'METROPOLIS'>('VIEWPORT');
  const [timeScale, setTimeScale] = useState<number>(biocyberneticHabitat.getTimeScale());
  const [chronoExpanded, setChronoExpanded] = useState<boolean>(true);
  const previousTimeScaleRef = useRef<number>(1.0);

  const handleSetTimeScale = (scale: number) => {
    TacticalAudioEngine.playTap();
    const clamped = Math.max(0, Math.min(10.0, Math.round(scale * 100) / 100));
    biocyberneticHabitat.setTimeScale(clamped);
    setTimeScale(clamped);
    if (clamped > 0) {
      previousTimeScaleRef.current = clamped;
    }
    if (clamped === 0) triggerAlert('⏸️ Simulación pausada');
    else if (clamped === 1) triggerAlert('▶️ Tiempo Real 1X');
    else if (clamped < 1) triggerAlert(`🐢 Cámara lenta activa: ${clamped}X`);
    else triggerAlert(`⚡ Acelerador Temporal activo: ${clamped}X`);
  };

  const togglePlayPause = () => {
    TacticalAudioEngine.playTap();
    if (timeScale > 0) {
      previousTimeScaleRef.current = timeScale;
      biocyberneticHabitat.setTimeScale(0);
      setTimeScale(0);
      triggerAlert('⏸️ Simulación pausada');
    } else {
      const resumeSpeed = previousTimeScaleRef.current || 1.0;
      biocyberneticHabitat.setTimeScale(resumeSpeed);
      setTimeScale(resumeSpeed);
      triggerAlert(`▶️ Simulación reanudada (${resumeSpeed}X)`);
    }
  };

  const handleForceMitosis = (orgId: string) => {
    TacticalAudioEngine.playTap();
    const baby = biocyberneticHabitat.forceAssistMitosis(orgId);
    if (baby) {
      setSelectedOrganismId(baby.id);
      triggerAlert(`🧬 ¡Mitosis asistida exitosa! Nació espécimen G${baby.generation} (${baby.id.slice(-6)})`);
    } else {
      triggerAlert('⚠️ El organismo no tiene suficiente vigor para dividirse.');
    }
  };

  const handleTriggerSporeBloom = () => {
    TacticalAudioEngine.playTap();
    biocyberneticHabitat.triggerEnvironmentalSporeBloom();
    triggerAlert('🌾 ¡Brote masivo de esporas de glucosa sembrado en el biodomo!');
  };

  const handleTriggerMutagenicRay = () => {
    TacticalAudioEngine.playTap();
    biocyberneticHabitat.triggerMutagenicCosmicRay();
    triggerAlert('⚡ ¡Pulso cósmico mutagénico inyectado! Tasa de mutación a 250% por 10s.');
  };

  const handleRequestConstruction = (type: UrbanStructureType) => {
    TacticalAudioEngine.playTap();
    const angle = Math.random() * Math.PI * 2;
    const dist = 3.2 + Math.random() * 3.8;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    const success = biocyberneticHabitat.requestUrbanConstruction(type, x, y);
    if (success) {
      triggerAlert(`🏗️ Proyecto de obra iniciado: ${type} en (${x.toFixed(1)}, ${y.toFixed(1)})`);
    } else {
      triggerAlert('⚠️ Biopolímeros insuficientes en la metrópolis para iniciar esta obra.');
    }
  };

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

    return () => {
      unsubTel();
      biocyberneticHabitat.stop();
      connectomeBioBridge.stopConnectome();
      if (engine3DRef.current) {
        engine3DRef.current.dispose();
        engine3DRef.current = null;
      }
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  // Sincronizar alternancia de modo de render 3D / 2D y bucle activo
  useEffect(() => {
    let anim2DId: number | null = null;
    const engine3D = engine3DRef.current;

    if (viewMode === '3D') {
      if (engine3D) {
        if (viewport3DRef.current) {
          engine3D.attach(viewport3DRef.current);
        }
        engine3D.start();
      }
    } else {
      // Modo 2D Radar: pausar GPU 3D para ahorrar batería y arrancar Canvas 2D
      if (engine3D) {
        engine3D.pause();
      }

      const loop2D = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            drawHabitatScene(ctx, canvas.width, canvas.height);
          }
        }
        anim2DId = requestAnimationFrame(loop2D);
      };

      anim2DId = requestAnimationFrame(loop2D);
    }

    return () => {
      if (anim2DId !== null) {
        cancelAnimationFrame(anim2DId);
      }
    };
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
    const arenaRadius = BiocyberneticHabitatEngine.ARENA_RADIUS_METERS;
    const scale = (canvas.width * 0.45) / arenaRadius;

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
        const gridCenter = BiocyberneticHabitatEngine.ARENA_RADIUS_METERS;
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
    const arenaRadius = BiocyberneticHabitatEngine.ARENA_RADIUS_METERS;
    const scale = radiusPx / arenaRadius; // Píxeles por metro

    // 0. Fondo táctico oscuro
    ctx.fillStyle = '#020610';
    ctx.fillRect(0, 0, width, height);

    // 1. Rejilla y Arena Circular
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let r = 4; r <= arenaRadius; r += 4) {
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
      const px = centerX + (src.x - arenaRadius) * scale;
      const py = centerY + (src.y - arenaRadius) * scale;

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
      const px1 = centerX + (b.x1 - arenaRadius) * scale;
      const py1 = centerY + (b.y1 - arenaRadius) * scale;
      const px2 = centerX + (b.x2 - arenaRadius) * scale;
      const py2 = centerY + (b.y2 - arenaRadius) * scale;

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

    // 5.8 Autopistas de Feromonas de la Metrópolis en 2D Radar
    if (telemetry.metropolis) {
      // 5.81 Distritos Urbanos Soberanos (Zonas funcionales)
      if (telemetry.metropolis.districts) {
        for (const dist of telemetry.metropolis.districts) {
          const dx = centerX + dist.centerX * scale;
          const dy = centerY + dist.centerY * scale;
          const dRad = dist.radiusMeters * scale;

          ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(dx, dy, dRad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = '8px monospace';
          ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
          ctx.textAlign = 'center';
          ctx.fillText(dist.name.toUpperCase(), dx, dy - dRad + 8);
        }
      }

      // 5.82 Corredores Aéreos 3D (Rutas de Vuelo de Drosophila)
      if (telemetry.metropolis.skywayCorridors) {
        for (const sw of telemetry.metropolis.skywayCorridors) {
          const sx1 = centerX + sw.fromX * scale;
          const sy1 = centerY + sw.fromY * scale;
          const sx2 = centerX + sw.toX * scale;
          const sy2 = centerY + sw.toY * scale;

          ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 5]);
          ctx.beginPath();
          ctx.moveTo(sx1, sy1);
          ctx.lineTo(sx2, sy2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.arc(sx1, sy1, 2.5, 0, Math.PI * 2);
          ctx.arc(sx2, sy2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5.83 Autopistas Terrestres de Feromonas
      for (const hw of telemetry.metropolis.highways) {
        const hx1 = centerX + hw.x1 * scale;
        const hy1 = centerY + hw.y1 * scale;
        const hx2 = centerX + hw.x2 * scale;
        const hy2 = centerY + hw.y2 * scale;

        ctx.strokeStyle = 'rgba(255, 183, 3, 0.4)';
        ctx.lineWidth = Math.max(3, hw.widthMeters * scale);
        ctx.beginPath();
        ctx.moveTo(hx1, hy1);
        ctx.lineTo(hx2, hy2);
        ctx.stroke();

        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx1, hy1);
        ctx.lineTo(hx2, hy2);
        ctx.stroke();
      }

      // 5.9 Estructuras Vivas de la Metrópolis en 2D Radar
      for (const s of telemetry.metropolis.structures) {
        const sx = centerX + s.x * scale;
        const sy = centerY + s.y * scale;
        const srPx = Math.max(8, s.radiusMeters * scale);

        const col =
          s.type === 'CENTRAL_SILO'
            ? '#f59e0b'
            : s.type === 'BIO_TOWER_DWELLING'
            ? '#a855f7'
            : s.type === 'BIO_COMPOSTER'
            ? '#10b981'
            : s.type === 'COMMERCIAL_AGORA'
            ? '#f43f5e'
            : s.type === 'RESEARCH_CONNECTOME'
            ? '#06b6d4'
            : s.type === 'BIO_FACTORY'
            ? '#6366f1'
            : '#38bdf8';

        ctx.fillStyle = 'rgba(10, 18, 30, 0.85)';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, srPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = '9px monospace';
        ctx.fillStyle = col;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const icon =
          s.type === 'CENTRAL_SILO'
            ? '🏛️'
            : s.type === 'BIO_TOWER_DWELLING'
            ? '🗼'
            : s.type === 'BIO_COMPOSTER'
            ? '♻️'
            : s.type === 'COMMERCIAL_AGORA'
            ? '🛒'
            : s.type === 'RESEARCH_CONNECTOME'
            ? '🔬'
            : s.type === 'BIO_FACTORY'
            ? '🏭'
            : '📡';
        ctx.fillText(icon, sx, sy);
      }

      // 5.95 Farolas Cívicas de la Metrópolis en 2D Radar
      if (telemetry.metropolis.streetLamps) {
        for (const lamp of telemetry.metropolis.streetLamps) {
          const lx = centerX + lamp.x * scale;
          const ly = centerY + lamp.y * scale;
          ctx.fillStyle = lamp.isLit ? '#fbbf24' : '#64748b';
          ctx.beginPath();
          ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
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

      {/* ── Sub-Barra Táctica: Selector de Vista (Biodomo vs Evolución) & Warp Temporal ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 16px',
          background: 'rgba(5, 10, 22, 0.98)',
          borderBottom: '1px solid rgba(0, 240, 255, 0.25)',
          flexShrink: 0,
        }}
      >
        {/* Selector de Pestaña Principal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => {
              TacticalAudioEngine.playTap();
              setActiveMainTab('VIEWPORT');
            }}
            style={{
              background: activeMainTab === 'VIEWPORT' ? 'rgba(0, 240, 255, 0.2)' : 'rgba(15, 23, 42, 0.7)',
              border: `1px solid ${activeMainTab === 'VIEWPORT' ? '#00f0ff' : 'rgba(148, 163, 184, 0.3)'}`,
              color: activeMainTab === 'VIEWPORT' ? '#00f0ff' : '#94a3b8',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span>🌐</span>
            <span>BIODOMO IN-SILICO</span>
          </button>
          <button
            onClick={() => {
              TacticalAudioEngine.playTap();
              setActiveMainTab('EVOLUTION');
            }}
            style={{
              background: activeMainTab === 'EVOLUTION' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(15, 23, 42, 0.7)',
              border: `1px solid ${activeMainTab === 'EVOLUTION' ? '#c084fc' : 'rgba(148, 163, 184, 0.3)'}`,
              color: activeMainTab === 'EVOLUTION' ? '#c084fc' : '#94a3b8',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span>🧬</span>
            <span>EVOLUCIÓN & FILOGENIA</span>
            {telemetry.maxGeneration && telemetry.maxGeneration > 1 && (
              <span
                style={{
                  fontSize: '9px',
                  background: '#a855f7',
                  color: '#ffffff',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  fontWeight: 900,
                }}
              >
                G{telemetry.maxGeneration}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              TacticalAudioEngine.playTap();
              setActiveMainTab('METROPOLIS');
            }}
            style={{
              background: activeMainTab === 'METROPOLIS' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(15, 23, 42, 0.7)',
              border: `1px solid ${activeMainTab === 'METROPOLIS' ? '#f59e0b' : 'rgba(148, 163, 184, 0.3)'}`,
              color: activeMainTab === 'METROPOLIS' ? '#f59e0b' : '#94a3b8',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span>🏙️</span>
            <span>METRÓPOLIS BIOCIBERNÉTICA</span>
            {telemetry.metropolis && (
              <span
                style={{
                  fontSize: '9px',
                  background: '#f59e0b',
                  color: '#000000',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  fontWeight: 900,
                }}
              >
                L{telemetry.metropolis.civilizationLevel}
              </span>
            )}
          </button>
        </div>

        {/* Acelerador Temporal & Intervención Génica */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
            WARP:
          </span>
          {[
            { label: '⏸️', value: 0, title: 'Pausa' },
            { label: '1X', value: 1, title: 'Tiempo Real' },
            { label: '2X', value: 2, title: 'Doble Velocidad' },
            { label: '5X', value: 5, title: 'Warp Evolutivo 5X' },
            { label: '10X', value: 10, title: 'Hiper-Evolución 10X' },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => handleSetTimeScale(item.value)}
              title={item.title}
              style={{
                background: timeScale === item.value ? 'rgba(0, 255, 136, 0.25)' : 'rgba(15, 23, 42, 0.65)',
                border: `1px solid ${timeScale === item.value ? '#00ff88' : 'rgba(148, 163, 184, 0.25)'}`,
                color: timeScale === item.value ? '#00ff88' : '#94a3b8',
                borderRadius: '5px',
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}

          {/* Botones de Brote y Rayo Cósmico */}
          <button
            onClick={handleTriggerSporeBloom}
            title="Sembrar 12 esporas de glucosa ricas en ATP"
            style={{
              background: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid #eab308',
              color: '#eab308',
              borderRadius: '5px',
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>🌾</span>
            <span>ESPORAS</span>
          </button>

          <button
            onClick={handleTriggerMutagenicRay}
            title="Inyectar pulso cósmico de radiación (mutaciones x2.5 durante 10s)"
            style={{
              background: 'rgba(236, 72, 153, 0.15)',
              border: '1px solid #ec4899',
              color: '#ec4899',
              borderRadius: '5px',
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>⚡</span>
            <span>PULSO CÓSMICO</span>
          </button>
        </div>
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
        {/* ── Vista de Evolución & Filogenia de Población A-Life ────────────── */}
        {activeMainTab === 'EVOLUTION' && (
          <div
            style={{
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxWidth: '960px',
              margin: '0 auto',
              width: '100%',
              minHeight: 0,
            }}
          >
            {/* Header del Dashboard de Evolución */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                padding: '12px 16px',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '8px',
              }}
            >
              <div>
                <div style={{ color: '#c084fc', fontWeight: 900, fontSize: '13px', letterSpacing: '0.8px' }}>
                  🧬 MONITOR DE EVOLUCIÓN DARWINIANA & POBLACIÓN A-LIFE
                </div>
                <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>
                  Herencia alélica estocástica (Box-Muller), deriva génica, clanes filogenéticos y selección natural en tiempo real.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleTriggerSporeBloom}
                  style={{
                    background: 'rgba(234, 179, 8, 0.2)',
                    border: '1px solid #eab308',
                    color: '#facc15',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  🌾 BROTE DE ESPORAS
                </button>
                <button
                  onClick={handleTriggerMutagenicRay}
                  style={{
                    background: 'rgba(236, 72, 153, 0.2)',
                    border: '1px solid #ec4899',
                    color: '#f472b6',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ⚡ PULSO CÓSMICO
                </button>
              </div>
            </div>

            {/* Tarjetas de Métricas Poblacionales */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '10px',
              }}
            >
              <div style={{ background: 'rgba(6, 12, 24, 0.9)', border: '1px solid rgba(0, 240, 255, 0.3)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800 }}>GENERACIÓN MÁXIMA</div>
                <div style={{ fontSize: '20px', color: '#00f0ff', fontWeight: 900, marginTop: '4px' }}>
                  G{telemetry.maxGeneration || 1}
                </div>
                <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '2px' }}>Profundidad del árbol filogenético</div>
              </div>

              <div style={{ background: 'rgba(6, 12, 24, 0.9)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800 }}>LINAJES ACTIVOS</div>
                <div style={{ fontSize: '20px', color: '#c084fc', fontWeight: 900, marginTop: '4px' }}>
                  {telemetry.populationGenetics?.activeLineagesCount || 0}
                </div>
                <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '2px' }}>Clanes coexistentes en el biodomo</div>
              </div>

              <div style={{ background: 'rgba(6, 12, 24, 0.9)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800 }}>NACIMIENTOS (MITOSIS)</div>
                <div style={{ fontSize: '20px', color: '#34d399', fontWeight: 900, marginTop: '4px' }}>
                  {telemetry.populationGenetics?.totalBirths || 0}
                </div>
                <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '2px' }}>Eventos de replicación celular</div>
              </div>

              <div style={{ background: 'rgba(6, 12, 24, 0.9)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800 }}>SENESCENCIA / EXTINCIÓN</div>
                <div style={{ fontSize: '20px', color: '#f43f5e', fontWeight: 900, marginTop: '4px' }}>
                  {telemetry.populationGenetics?.totalDeaths || 0}
                </div>
                <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '2px' }}>Ciclo biológico completado</div>
              </div>

              <div style={{ background: 'rgba(6, 12, 24, 0.9)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800 }}>CLAN DOMINANTE</div>
                <div style={{ fontSize: '13px', color: '#fbbf24', fontWeight: 900, marginTop: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {telemetry.populationGenetics?.topLineageId || 'Sin clan'}
                </div>
                <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '2px' }}>Mayor adaptabilidad al hábitat</div>
              </div>
            </div>

            {/* Medias Alélicas del Acervo Génico */}
            {telemetry.populationGenetics && (
              <div
                style={{
                  background: 'rgba(6, 12, 24, 0.95)',
                  border: '1px solid rgba(0, 240, 255, 0.25)',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#00f0ff', fontWeight: 800 }}>
                  🧬 PROMEDIO DE RASGOS ALÉLICOS (ACERVO GÉNICO DE LA POBLACIÓN)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', marginBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>Velocidad Media</span>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>{telemetry.populationGenetics.meanSpeedGene.toFixed(2)}x</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (telemetry.populationGenetics.meanSpeedGene / 2) * 100)}%`, height: '100%', background: '#38bdf8' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', marginBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>Eficiencia Metabólica</span>
                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>{telemetry.populationGenetics.meanMetabolicEfficiency.toFixed(2)}x</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (telemetry.populationGenetics.meanMetabolicEfficiency / 2) * 100)}%`, height: '100%', background: '#f59e0b' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', marginBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>Rango Sensorial</span>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>{telemetry.populationGenetics.meanSensoryRadius.toFixed(2)}x</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (telemetry.populationGenetics.meanSensoryRadius / 2) * 100)}%`, height: '100%', background: '#10b981' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', marginBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>Longevidad Media</span>
                      <span style={{ color: '#c084fc', fontWeight: 700 }}>{Math.round(telemetry.populationGenetics.meanLongevitySec)}s</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (telemetry.populationGenetics.meanLongevitySec / 500) * 100)}%`, height: '100%', background: '#c084fc' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', marginBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>Cooperación / Trofalaxis</span>
                      <span style={{ color: '#f43f5e', fontWeight: 700 }}>{(telemetry.populationGenetics.meanCooperationGene * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, telemetry.populationGenetics.meanCooperationGene * 100)}%`, height: '100%', background: '#f43f5e' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Crónica Evolutiva en Tiempo Real (Live Event Feed) */}
            <div
              style={{
                background: 'rgba(6, 12, 24, 0.95)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '8px',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', color: '#c084fc', fontWeight: 800 }}>
                  📜 CRÓNICA EVOLUTIVA & FILOGENÉTICA EN TIEMPO REAL
                </div>
                <div style={{ fontSize: '9px', color: '#64748b' }}>
                  {telemetry.evolutionChronicle?.length || 0} eventos registrados
                </div>
              </div>

              <div
                style={{
                  maxHeight: '280px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  paddingRight: '6px',
                }}
              >
                {(!telemetry.evolutionChronicle || telemetry.evolutionChronicle.length === 0) ? (
                  <div style={{ color: '#64748b', fontSize: '11px', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>
                    Esperando los primeros eventos de mitosis y mutación genética... (Aumenta el Warp temporal a 5X o 10X para acelerar generaciones)
                  </div>
                ) : (
                  telemetry.evolutionChronicle.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        borderLeft: `3px solid ${
                          entry.type === 'MITOSIS' || entry.type === 'BIRTH'
                            ? '#00ff88'
                            : entry.type === 'MUTATION_BREAKTHROUGH'
                            ? '#a855f7'
                            : entry.type === 'TROPHALLAXIS'
                            ? '#38bdf8'
                            : entry.type === 'SENESCENCE'
                            ? '#f59e0b'
                            : '#ef4444'
                        }`,
                        borderRadius: '4px',
                        fontSize: '9.5px',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontSize: '12px', flexShrink: 0 }}>
                          {(entry.type === 'MITOSIS' || entry.type === 'BIRTH') && '🧬'}
                          {entry.type === 'MUTATION_BREAKTHROUGH' && '⚡'}
                          {entry.type === 'TROPHALLAXIS' && '🤝'}
                          {entry.type === 'SENESCENCE' && '⏳'}
                          {entry.type === 'STARVATION' && '💀'}
                          {entry.type === 'EXTINCTION' && '⚠️'}
                        </span>
                        <span style={{ color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.headline}
                        </span>
                        {entry.lineageId && (
                          <span
                            style={{
                              fontSize: '8px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(168, 85, 247, 0.15)',
                              color: '#c084fc',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {entry.lineageId}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '8px',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            background: 'rgba(0, 240, 255, 0.12)',
                            color: '#00f0ff',
                            fontWeight: 800,
                          }}
                        >
                          G{entry.generation}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '8px' }}>
                          {new Date(entry.timestampSec * 1000).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Vista de Metrópolis Biocibernética (Urbanismo & Metabolismo Circular) ── */}
        {activeMainTab === 'METROPOLIS' && telemetry.metropolis && (
          <div
            style={{
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxWidth: '960px',
              margin: '0 auto',
              width: '100%',
              minHeight: 0,
            }}
          >
            {/* Header: Nivel de Civilización */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '12px 16px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '8px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🏙️</span>
                  <div>
                    <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: '14px', letterSpacing: '0.5px' }}>
                      NIVEL {telemetry.metropolis.civilizationLevel}: {
                        telemetry.metropolis.civilizationLevel === 1 ? 'CAMPAMENTO SILVESTRE' :
                        telemetry.metropolis.civilizationLevel === 2 ? 'ALDEA SIMBIÓTICA' :
                        telemetry.metropolis.civilizationLevel === 3 ? 'CIUDADELA ESTIGMÉRGICA' :
                        telemetry.metropolis.civilizationLevel === 4 ? 'METRÓPOLIS CIRCULAR' :
                        'MEGALÓPOLIS EDÉNICA SOBERANA'
                      }
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                      Urbanismo estigmérgico, división cívica del trabajo y metabolismo circular de biomasa
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span
                  style={{
                    background: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid #f59e0b',
                    color: '#fbbf24',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '6px',
                  }}
                >
                  PIB METABÓLICO: {telemetry.metropolis.metabolicGdpTotal} ATP
                </span>
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid #10b981',
                    color: '#34d399',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '6px',
                  }}
                >
                  RECURSOS SILOS: {telemetry.metropolis.totalStoredGlucose} G / {telemetry.metropolis.totalStoredAtp} ATP
                </span>
              </div>
            </div>

            {/* 4 Métricas Macro-Económicas & Circulares */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800 }}>💰 PIB METABÓLICO</div>
                <div style={{ fontSize: '16px', color: '#fbbf24', fontWeight: 900, marginTop: '4px' }}>
                  {telemetry.metropolis.metabolicGdpTotal} <span style={{ fontSize: '11px' }}>ATP</span>
                </div>
                <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Valor agregado bioquímico acumulado</div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800 }}>🏗️ RESERVA DE BIOPOLÍMEROS</div>
                <div style={{ fontSize: '16px', color: '#34d399', fontWeight: 900, marginTop: '4px' }}>
                  {telemetry.metropolis.totalBiopolymerStockpile} <span style={{ fontSize: '11px' }}>u</span>
                </div>
                <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Material para erección de estructuras</div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800 }}>♻️ BIOMASA RECICLADA</div>
                <div style={{ fontSize: '16px', color: '#22d3ee', fontWeight: 900, marginTop: '4px' }}>
                  {telemetry.metropolis.totalRecycledBiomass} <span style={{ fontSize: '11px' }}>kg</span>
                </div>
                <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Cero residuo: cadáveres a nutrientes</div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800 }}>🛣️ AUTOPISTAS DE FEROMONAS</div>
                <div style={{ fontSize: '16px', color: '#c084fc', fontWeight: 900, marginTop: '4px' }}>
                  {telemetry.metropolis.highways.length} <span style={{ fontSize: '11px' }}>tramos</span>
                </div>
                <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>+45% velocidad, -40% coste ATP</div>
              </div>
            </div>

            {/* División Cívica del Trabajo: 5 Castas Especializadas */}
            <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(0, 240, 255, 0.2)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#00f0ff', letterSpacing: '0.5px' }}>
                  👥 CENSO Y DIVISIÓN CÍVICA DEL TRABAJO (5 CASTAS)
                </span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Asignación genotípica cuantitativa</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                {[
                  {
                    caste: 'BUILDER' as CivilianCaste,
                    icon: '👷',
                    name: 'CONSTRUCTOR',
                    desc: 'Erige y repara silos y torres con biopolímeros',
                    count: telemetry.metropolis.casteBreakdown.BUILDER,
                    color: '#f59e0b',
                  },
                  {
                    caste: 'HARVESTER' as CivilianCaste,
                    icon: '🌾',
                    name: 'RECOLECTOR',
                    desc: 'Forrajea glucosa externa y abastece los silos',
                    count: telemetry.metropolis.casteBreakdown.HARVESTER,
                    color: '#10b981',
                  },
                  {
                    caste: 'SENTINEL' as CivilianCaste,
                    icon: '🛡️',
                    name: 'CENTINELA',
                    desc: 'Patrulla perímetros y emite alarmas tácticas',
                    count: telemetry.metropolis.casteBreakdown.SENTINEL,
                    color: '#38bdf8',
                  },
                  {
                    caste: 'SCHOLAR' as CivilianCaste,
                    icon: '📜',
                    name: 'ERUDITO',
                    desc: 'Sincroniza tensores cognitivos en el Conectoma',
                    count: telemetry.metropolis.casteBreakdown.SCHOLAR,
                    color: '#c084fc',
                  },
                  {
                    caste: 'NURSE' as CivilianCaste,
                    icon: '🩹',
                    name: 'ENFERMERO',
                    desc: 'Trofalaxis médica activa a especímenes débiles',
                    count: telemetry.metropolis.casteBreakdown.NURSE,
                    color: '#ec4899',
                  },
                ].map((item) => (
                  <div
                    key={item.caste}
                    style={{
                      background: 'rgba(2, 6, 16, 0.7)',
                      border: `1px solid ${item.color}40`,
                      borderRadius: '6px',
                      padding: '8px 10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: item.color }}>
                        {item.icon} {item.name}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 900,
                          color: '#ffffff',
                          background: `${item.color}30`,
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {item.count}
                      </span>
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px', lineHeight: 1.25 }}>
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Catálogo de Infraestructura Urbana & Ordenanzas de Construcción */}
            <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.5px' }}>
                    🏛️ INFRAESTRUCTURA VIVA & PLANIFICACIÓN URBANA
                  </span>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    {telemetry.metropolis.structures.length} estructuras registradas en el catastro biológico
                  </div>
                </div>

                {/* Botones de Ordenanzas de Construcción Manual */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleRequestConstruction('CENTRAL_SILO')}
                    style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      border: '1px solid #f59e0b',
                      color: '#fbbf24',
                      borderRadius: '5px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    + SILO (50p)
                  </button>
                  <button
                    onClick={() => handleRequestConstruction('BIO_TOWER_DWELLING')}
                    style={{
                      background: 'rgba(168, 85, 247, 0.2)',
                      border: '1px solid #a855f7',
                      color: '#c084fc',
                      borderRadius: '5px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    + TORRE (60p)
                  </button>
                  <button
                    onClick={() => handleRequestConstruction('BIO_COMPOSTER')}
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid #10b981',
                      color: '#34d399',
                      borderRadius: '5px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    + COMPOSTERO (45p)
                  </button>
                  <button
                    onClick={() => handleRequestConstruction('DEFENSE_BEACON')}
                    style={{
                      background: 'rgba(56, 189, 248, 0.2)',
                      border: '1px solid #38bdf8',
                      color: '#38bdf8',
                      borderRadius: '5px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    + BALIZA (35p)
                  </button>
                </div>
              </div>

              {/* Lista de Estructuras */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>
                {telemetry.metropolis.structures.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: 'rgba(2, 6, 16, 0.75)',
                      border: `1px solid ${
                        s.type === 'CENTRAL_SILO' ? '#f59e0b40' :
                        s.type === 'BIO_TOWER_DWELLING' ? '#a855f740' :
                        s.type === 'BIO_COMPOSTER' ? '#10b98140' : '#38bdf840'
                      }`,
                      borderRadius: '6px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '11px', color: '#f1f5f9' }}>
                        {s.type === 'CENTRAL_SILO' && '🏛️'}
                        {s.type === 'BIO_TOWER_DWELLING' && '🗼'}
                        {s.type === 'BIO_COMPOSTER' && '♻️'}
                        {s.type === 'DEFENSE_BEACON' && '📡'}
                        {' '}{s.name}
                      </span>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 800,
                          color: s.constructionProgress >= 1 ? '#00ff88' : '#fbbf24',
                          background: s.constructionProgress >= 1 ? 'rgba(0,255,136,0.15)' : 'rgba(251,191,36,0.15)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}
                      >
                        {s.constructionProgress >= 1 ? 'COMPLETO' : `${Math.round(s.constructionProgress * 100)}% OBRA`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#94a3b8' }}>
                      <span>Pos: ({s.x.toFixed(1)}, {s.y.toFixed(1)})m</span>
                      <span>Salud: {Math.round(s.integrityPercent)}%</span>
                      {s.capacity > 0 && (
                        <span>Reservas: {Math.round(s.storedGlucose + s.storedAtp)}/{s.capacity}</span>
                      )}
                    </div>

                    {/* Barra de Progreso de Construcción / Integridad */}
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                      <div
                        style={{
                          width: `${Math.round(s.constructionProgress * 100)}%`,
                          height: '100%',
                          background: s.constructionProgress >= 1 ? '#00f0ff' : '#f59e0b',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Contenedor del Viewport 3D/2D e Instrumental (preserva el WebGL context) ── */}
        <div style={{ display: activeMainTab === 'VIEWPORT' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
              {(['ORBITAL', 'FOLLOW_AGENT', 'FLY_COCKPIT_FPV', 'TOP_DOWN_GOD'] as HabitatCameraMode[]).map((mode) => (
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
                  {mode === 'FLY_COCKPIT_FPV' && '🪰 CABINA FPV'}
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

                {selectedOrganism.caste && (
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      color: '#fbbf24',
                      fontWeight: 800,
                      fontSize: '9.5px',
                    }}
                  >
                    CASTA: {selectedOrganism.caste === 'BUILDER' && '👷 CONSTRUCTOR'}
                    {selectedOrganism.caste === 'HARVESTER' && '🌾 RECOLECTOR'}
                    {selectedOrganism.caste === 'SENTINEL' && '🛡️ CENTINELA'}
                    {selectedOrganism.caste === 'SCHOLAR' && '📜 ERUDITO'}
                    {selectedOrganism.caste === 'NURSE' && '🩹 ENFERMERO'}
                  </span>
                )}

                {selectedOrganism.civicJob && (
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#38bdf8',
                      fontWeight: 800,
                      fontSize: '9.5px',
                    }}
                  >
                    OFICIO: {selectedOrganism.civicJob === 'AERIAL_COURIER' && '✈️ MENSAJERO AÉREO'}
                    {selectedOrganism.civicJob === 'NECTAR_FORAGER' && '🍯 COSECHADOR NÉCTAR'}
                    {selectedOrganism.civicJob === 'RESEARCH_SCHOLAR' && '🔬 ERUDITO CONECTOMA'}
                    {selectedOrganism.civicJob === 'BUILDER_ARCHITECT' && '👷 ARQUITECTO URBANO'}
                    {selectedOrganism.civicJob === 'CIVIC_CITIZEN' && '🏙️ CIUDADANO'}
                  </span>
                )}

                {selectedOrganism.dailySchedulePhase && (
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: selectedOrganism.dailySchedulePhase === 'SLEEP_AT_HOME' ? 'rgba(192, 132, 252, 0.15)' : 'rgba(0, 240, 255, 0.15)',
                      border: `1px solid ${selectedOrganism.dailySchedulePhase === 'SLEEP_AT_HOME' ? '#c084fc' : '#00f0ff'}`,
                      color: selectedOrganism.dailySchedulePhase === 'SLEEP_AT_HOME' ? '#c084fc' : '#00f0ff',
                      fontWeight: 800,
                      fontSize: '9.5px',
                    }}
                  >
                    RUTINA: {selectedOrganism.dailySchedulePhase === 'SLEEP_AT_HOME' && '💤 SUEÑO EN CELDA'}
                    {selectedOrganism.dailySchedulePhase === 'COMMUTE_TO_BREAKFAST' && '🍓 RUTA A DESAYUNO'}
                    {selectedOrganism.dailySchedulePhase === 'WORK_DUTY' && '⚡ TURNO LABORAL'}
                    {selectedOrganism.dailySchedulePhase === 'LEISURE_SOCIAL' && '☕ OCIO EN EL ÁGORA'}
                  </span>
                )}

                {selectedOrganism.species === 'DROSOPHILA' && (
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(0, 229, 255, 0.12)',
                      border: '1px solid rgba(0, 229, 255, 0.35)',
                      color: '#00e5ff',
                      fontWeight: 700,
                      fontSize: '9.5px',
                    }}
                  >
                    ALTITUD: {(selectedOrganism.altitudeMeters || 0).toFixed(2)}m {(selectedOrganism.altitudeMeters || 0) > 0.3 ? '🪰 EN VUELO' : '🐾 ATERRIZADO'}
                  </span>
                )}

                {selectedOrganism.biopolymerCarried !== undefined && selectedOrganism.biopolymerCarried > 0 && (
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#34d399',
                      fontWeight: 800,
                      fontSize: '9.5px',
                    }}
                  >
                    🏗️ POLÍMERO: {selectedOrganism.biopolymerCarried.toFixed(1)} u
                  </span>
                )}

                {selectedOrganism.homeCellId && (
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(168, 85, 247, 0.15)',
                      border: '1px solid rgba(168, 85, 247, 0.4)',
                      color: '#c084fc',
                      fontWeight: 800,
                      fontSize: '9.5px',
                    }}
                  >
                    🏠 CELDA: {selectedOrganism.homeCellId}
                  </span>
                )}

                {selectedOrganism.microAtpWallet !== undefined && (
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(234, 179, 8, 0.15)',
                      border: '1px solid rgba(234, 179, 8, 0.4)',
                      color: '#facc15',
                      fontWeight: 800,
                      fontSize: '9.5px',
                    }}
                  >
                    ⚡ WALLET: {selectedOrganism.microAtpWallet.toFixed(1)} µATP
                  </span>
                )}

                <span style={{ color: '#64748b', marginLeft: 'auto', fontSize: '9px' }}>
                  {selectedOrganism.behaviorState}
                </span>
              </div>

              {/* BDI Cognitive Mind State (Creencias, Deseos, Intenciones L9) */}
              {selectedOrganism.bdiIntention && (
                <div
                  style={{
                    background: 'rgba(2, 132, 199, 0.12)',
                    border: '1px solid rgba(14, 165, 233, 0.35)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '9.5px',
                    color: '#e0f2fe',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8', fontWeight: 800 }}>
                    <span>🧠 COGNICIÓN BDI (4 NIVELES)</span>
                    <span style={{ color: '#94a3b8' }}>{selectedOrganism.bdiDesire}</span>
                  </div>
                  <div style={{ color: '#f8fafc', fontWeight: 600 }}>
                    🎯 INTENCIÓN: {selectedOrganism.bdiIntention}
                  </div>
                  {selectedOrganism.bdiBeliefSummary && (
                    <div style={{ color: '#94a3b8', fontSize: '8.5px', fontStyle: 'italic' }}>
                      👁️ CREENCIAS: {selectedOrganism.bdiBeliefSummary}
                    </div>
                  )}
                </div>
              )}

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

              {/* Telemetría Genética & Linaje Darwiniano */}
              {selectedOrganism.genome && (
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    fontSize: '9px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#c084fc', fontWeight: 800 }}>
                      🧬 {selectedOrganism.genome.lineageId} &middot; G{selectedOrganism.generation}
                    </span>
                    <span style={{ color: '#00ff88', fontWeight: 700 }}>
                      Aptitud: {computeFitnessScore(selectedOrganism.genome, selectedOrganism.ageSec, selectedOrganism.atpCollectedTotal, selectedOrganism.offspringCount).toFixed(0)} pts
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '8.5px' }}>
                    <span>Edad: {Math.round(selectedOrganism.ageSec)}s / {Math.round(selectedOrganism.genome.longevityGene)}s</span>
                    <span>Descendencia: {selectedOrganism.offspringCount} vástagos</span>
                  </div>

                  {/* Barras de Alelos Genómicos */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '2px' }}>
                    <div>
                      <div style={{ fontSize: '8px', color: '#38bdf8' }}>VELOCIDAD</div>
                      <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (selectedOrganism.genome.speedGene / 2) * 100)}%`, height: '100%', background: '#38bdf8' }} />
                      </div>
                      <div style={{ fontSize: '7.5px', color: '#94a3b8' }}>{selectedOrganism.genome.speedGene.toFixed(2)}x</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '8px', color: '#f59e0b' }}>METABOLISMO</div>
                      <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (selectedOrganism.genome.metabolicEfficiencyGene / 2) * 100)}%`, height: '100%', background: '#f59e0b' }} />
                      </div>
                      <div style={{ fontSize: '7.5px', color: '#94a3b8' }}>{selectedOrganism.genome.metabolicEfficiencyGene.toFixed(2)}x</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '8px', color: '#10b981' }}>SENSORIAL</div>
                      <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (selectedOrganism.genome.sensoryRadiusGene / 2) * 100)}%`, height: '100%', background: '#10b981' }} />
                      </div>
                      <div style={{ fontSize: '7.5px', color: '#94a3b8' }}>{selectedOrganism.genome.sensoryRadiusGene.toFixed(2)}x</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Botones de Acción Afectiva, Social, Genética y Mecánica */}
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
                  onClick={() => handleForceMitosis(selectedOrganism.id)}
                  style={{
                    background: 'rgba(168, 85, 247, 0.2)',
                    border: '1px solid #a855f7',
                    color: '#c084fc',
                    borderRadius: '4px',
                    padding: '4px',
                    fontSize: '9px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  🧬 MITOSIS
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

          {/* ── Chrono-Engine HUD: Controlador Táctico de Dilatación Temporal Soberano ── */}
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              zIndex: 28,
              background: 'rgba(6, 12, 24, 0.92)',
              border: '1px solid rgba(0, 240, 255, 0.35)',
              boxShadow: '0 4px 25px rgba(0, 0, 0, 0.75), 0 0 15px rgba(0, 240, 255, 0.15)',
              borderRadius: '10px',
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              backdropFilter: 'blur(10px)',
              minWidth: chronoExpanded ? '250px' : 'auto',
              maxWidth: '320px',
              userSelect: 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Encabezado con estado dinámico y botón colapsar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div
                onClick={() => setChronoExpanded((prev) => !prev)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                title="Expandir / Minimizar Chrono-Engine"
              >
                <span style={{ fontSize: '11px' }}>⏱️</span>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#00f0ff', letterSpacing: '0.5px' }}>
                  CHRONO-WARP
                </span>
                <span style={{ fontSize: '8px', color: '#64748b' }}>{chronoExpanded ? '▼' : '▲'}</span>
              </div>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background:
                    timeScale === 0
                      ? 'rgba(245, 158, 11, 0.2)'
                      : timeScale < 0.95
                      ? 'rgba(45, 212, 191, 0.2)'
                      : timeScale <= 1.05
                      ? 'rgba(0, 255, 136, 0.2)'
                      : timeScale <= 3.5
                      ? 'rgba(0, 240, 255, 0.2)'
                      : 'rgba(232, 121, 249, 0.25)',
                  color:
                    timeScale === 0
                      ? '#fbbf24'
                      : timeScale < 0.95
                      ? '#2dd4bf'
                      : timeScale <= 1.05
                      ? '#00ff88'
                      : timeScale <= 3.5
                      ? '#00f0ff'
                      : '#f472b6',
                  border: `1px solid ${
                    timeScale === 0
                      ? '#f59e0b'
                      : timeScale < 0.95
                      ? '#2dd4bf'
                      : timeScale <= 1.05
                      ? '#00ff88'
                      : timeScale <= 3.5
                      ? '#00f0ff'
                      : '#e879f9'
                  }`,
                }}
              >
                {timeScale === 0
                  ? '⏸️ PAUSADO'
                  : timeScale < 0.95
                  ? `🐢 LENTO (${timeScale.toFixed(2)}x)`
                  : timeScale <= 1.05
                  ? '⏱️ 1.0x REAL'
                  : timeScale <= 3.5
                  ? `⏩ RÁPIDO (${timeScale.toFixed(1)}x)`
                  : `⚡ WARP (${timeScale.toFixed(1)}x)`}
              </span>
            </div>

            {chronoExpanded && (
              <>
                {/* Fila Slider + Botón Play/Pause */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={togglePlayPause}
                    title={timeScale === 0 ? 'Reanudar Simulación' : 'Pausar Simulación'}
                    style={{
                      background: timeScale === 0 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(0, 240, 255, 0.18)',
                      border: `1px solid ${timeScale === 0 ? '#f59e0b' : '#00f0ff'}`,
                      color: timeScale === 0 ? '#fbbf24' : '#00f0ff',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '32px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {timeScale === 0 ? '▶️' : '⏸️'}
                  </button>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <input
                      type="range"
                      min="0.1"
                      max="10.0"
                      step="0.1"
                      value={timeScale === 0 ? (previousTimeScaleRef.current || 1.0) : timeScale}
                      onChange={(e) => handleSetTimeScale(parseFloat(e.target.value))}
                      style={{
                        width: '100%',
                        height: '5px',
                        borderRadius: '3px',
                        background: 'rgba(25, 40, 65, 0.8)',
                        accentColor: '#00f0ff',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', color: '#64748b' }}>
                      <span>0.1x</span>
                      <span>1.0x</span>
                      <span>5.0x</span>
                      <span>10.0x</span>
                    </div>
                  </div>
                </div>

                {/* Botones Presets Rápidos */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
                  {[0.25, 0.5, 1.0, 2.0, 5.0, 10.0].map((preset) => {
                    const isActive = timeScale === preset;
                    return (
                      <button
                        key={preset}
                        onClick={() => handleSetTimeScale(preset)}
                        style={{
                          background: isActive ? 'rgba(0, 255, 136, 0.25)' : 'rgba(15, 23, 42, 0.75)',
                          border: `1px solid ${isActive ? '#00ff88' : 'rgba(148, 163, 184, 0.2)'}`,
                          color: isActive ? '#00ff88' : '#94a3b8',
                          borderRadius: '4px',
                          padding: '3px 0',
                          fontSize: '8px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {preset}x
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
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
