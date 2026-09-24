"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ringAttractor, RingAttractorTelemetry } from "../lib/neuro/RingAttractorEngine";
import { fanShapedBody, FanShapedBodyTelemetry } from "../lib/neuro/FanShapedBodyEngine";
import { synapticMeshRouter, SynapticMeshTelemetry, RfPeerBearing } from "../lib/neuro/SynapticMeshRouterEngine";
import { giantFiberReflex, GiantFiberTelemetry } from "../lib/neuro/GiantFiberReflexEngine";
import { dtnMushroomBody, MushroomBodyTelemetry } from "../lib/neuro/DtnMushroomBodyEngine";
import { johnstonOrgan, JohnstonOrganTelemetry } from "../lib/neuro/JohnstonOrganEngine";
import { metabolicGovernor, MetabolicGovernorTelemetry } from "../lib/neuro/MetabolicNeuromorphicGovernor";
import { opticLobe, OpticLobeTelemetry } from "../lib/neuro/OpticLobeEngine";
import { tacticalMotorActuator, TacticalMotorActuatorTelemetry } from "../lib/neuro/TacticalMotorActuatorEngine";
import { centralPatternGenerator, CpgLocomotionTelemetry, LegIdentifier } from "../lib/neuro/CentralPatternGeneratorEngine";
import { swarmCriticality, SwarmCriticalityTelemetry, CriticalityPhaseState } from "../lib/neuro/SwarmCriticalityEngine";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacIcon } from "./ui/TacIcon";
import { toast } from "./Toast";
import { TacticalLocationEngine } from "../lib/sensors/TacticalLocationEngine";
import { PheromoneBroadcastModal } from "./tactical/PheromoneBroadcastModal";
import { EyesFreeHapticModal } from "./tactical/EyesFreeHapticModal";
import { humanBrainOrchestrator, HumanBrainTelemetrySnapshot } from "../lib/neuro/human/HumanBrainOrchestrator";
import { CognitiveNavigationModal } from "./tactical/CognitiveNavigationModal";
import { TcccMedicalTriageModal } from "./tactical/TcccMedicalTriageModal";
import { EpistemicRadarModal } from "./tactical/EpistemicRadarModal";
import { OfcBarterMarketModal } from "./tactical/OfcBarterMarketModal";
import { HippocampalMemoryModal } from "./tactical/HippocampalMemoryModal";
import dynamic from "next/dynamic";
const TacticalVivariumModal = dynamic(() => import("./tactical/TacticalVivariumModal").then(m => ({ default: m.TacticalVivariumModal })), { ssr: false });
const TacticalHabitatModal = dynamic(() => import("./tactical/TacticalHabitatModal").then(m => ({ default: m.TacticalHabitatModal })), { ssr: false });
import { predictiveCortex } from "../lib/neuro/human/PredictiveCortexEngine";
import { globalWorkspaceConsciousnessBus, ConsciousnessSnapshot } from "../lib/neuro/GlobalWorkspaceConsciousnessBus";
import { meshRouter } from "../lib/mesh/meshRouter";
import { bioCompassDualFusion, BioCompassDualTelemetry } from "../lib/neuro/BioCompassDualFusionEngine";
import { biocyberneticHabitat, HabitatTelemetry } from "../lib/neuro/habitat/BiocyberneticHabitatEngine";
import { connectomeBioBridge } from "../lib/neuro/ConnectomeBioBridge";

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface ConnectomeNode {
  id: string;
  name: string;
  system: "CX" | "MB" | "GFS" | "SENSORY" | "FB";
  pos: Point3D;
  color: string;
  size: number;
  activity: number; // [0, 1]
}

interface ConnectomeEdge {
  from: string;
  to: string;
  weight: number;
  system: "CX" | "MB" | "GFS" | "SENSORY" | "FB";
  pulseProgress?: number;
}

export interface MaleCnsConnectomeHUDProps {
  onClose?: () => void;
}

export function MaleCnsConnectomeHUD({ onClose }: MaleCnsConnectomeHUDProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Estados de telemetría de los 7 subsistemas bio-neuromórficos
  const [cxTelemetry, setCxTelemetry] = useState<RingAttractorTelemetry>(() => ringAttractor.getTelemetry());
  const [fbTelemetry, setFbTelemetry] = useState<FanShapedBodyTelemetry>(() => fanShapedBody.getTelemetry());
  const [synapticTelemetry, setSynapticTelemetry] = useState<SynapticMeshTelemetry>(() => synapticMeshRouter.getTelemetry());
  const [gfsTelemetry, setGfsTelemetry] = useState<GiantFiberTelemetry>(() => giantFiberReflex.getTelemetry());
  const [mbTelemetry, setMbTelemetry] = useState<MushroomBodyTelemetry>(() => dtnMushroomBody.getTelemetry());
  const [joTelemetry, setJoTelemetry] = useState<JohnstonOrganTelemetry>(() => johnstonOrgan.getTelemetry());
  const [metTelemetry, setMetTelemetry] = useState<MetabolicGovernorTelemetry>(() => metabolicGovernor.getTelemetry());
  const [opticTelemetry, setOpticTelemetry] = useState<OpticLobeTelemetry>(() => opticLobe.getTelemetry());
  const [motorTelemetry, setMotorTelemetry] = useState<TacticalMotorActuatorTelemetry>(() => tacticalMotorActuator.getTelemetry());
  const [criticalityTelemetry, setCriticalityTelemetry] = useState<SwarmCriticalityTelemetry>(() => swarmCriticality.getTelemetry());
  const [dualTelemetry, setDualTelemetry] = useState<BioCompassDualTelemetry>(() => bioCompassDualFusion.getTelemetry());
  const [rfBearings, setRfBearings] = useState<RfPeerBearing[]>(() => synapticMeshRouter.getAllActiveBearings());
  const [cpgTelemetry, setCpgTelemetry] = useState<CpgLocomotionTelemetry>(() => centralPatternGenerator.getTelemetry());
  const [habitatTelemetry, setHabitatTelemetry] = useState<HabitatTelemetry>(() => biocyberneticHabitat.getTelemetry());
  const [isBridgeActive, setIsBridgeActive] = useState<boolean>(() => connectomeBioBridge.isConnectomeActive());

  // Filtros de visualización y control de cámara 3D
  const [filterSystem, setFilterSystem] = useState<"ALL" | "CX" | "MB" | "GFS" | "FB">("ALL");
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const autoRotateRef = useRef<boolean>(true);
  const rotXRef = useRef<number>(0.3);
  const rotYRef = useRef<number>(0.0);
  const zoomRef = useRef<number>(1.0);
  const [stimulationActive, setStimulationActive] = useState<boolean>(false);
  const [showAttributionModal, setShowAttributionModal] = useState<boolean>(false);
  const [optogeneticFeedback, setOptogeneticFeedback] = useState<string | null>(null);

  // Estados y refs del Centinela Óptico (Cámara real 16x16) y Gobernador Forzado
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [ommatidiaPixels, setOmmatidiaPixels] = useState<number[]>(() => new Array(256).fill(0.1));
  const [isForcedTorpor, setIsForcedTorpor] = useState<boolean>(() => metabolicGovernor.isForcedTorpor());
  const [isPheromoneModalOpen, setIsPheromoneModalOpen] = useState<boolean>(false);
  const [isHapticModalOpen, setIsHapticModalOpen] = useState<boolean>(false);

  // Modo de Arquitectura Neurobiológica: MaleCNS Drosophila vs Neocorteza Humana vs Espacio Global
  const [architectureMode, setArchitectureMode] = useState<"SUBCORTICAL_MALE_CNS" | "HUMAN_NEOCORTEX" | "CONSCIOUS_SWARM_BUS">("SUBCORTICAL_MALE_CNS");
  const [humanSnapshot, setHumanSnapshot] = useState<HumanBrainTelemetrySnapshot>(() => humanBrainOrchestrator.getSnapshot());
  const [consciousnessTelemetry, setConsciousnessTelemetry] = useState<ConsciousnessSnapshot>(() => globalWorkspaceConsciousnessBus.getSnapshot());
  const [isDraggingUI, setIsDraggingUI] = useState<boolean>(false);
  const [isCognitiveNavOpen, setIsCognitiveNavOpen] = useState<boolean>(false);
  const [isTcccModalOpen, setIsTcccModalOpen] = useState<boolean>(false);
  const [isEpistemicRadarOpen, setIsEpistemicRadarOpen] = useState<boolean>(false);
  const [isOfcBarterOpen, setIsOfcBarterOpen] = useState<boolean>(false);
  const [isHippocampalMemoryOpen, setIsHippocampalMemoryOpen] = useState<boolean>(false);
  const [isVivariumOpen, setIsVivariumOpen] = useState<boolean>(false);
  const [isHabitatOpen, setIsHabitatOpen] = useState<boolean>(false);


  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraFrameRef = useRef<number | null>(null);
  const lastCaptureTimeRef = useRef<number>(0);
  const canvas16Ref = useRef<HTMLCanvasElement | null>(null);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("API de cámara no disponible en este dispositivo");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
      opticLobe.start();
      TacticalAudioEngine.playTap();
      toast.success("👁️ Centinela Óptico activado: 256 omatidios en línea");
    } catch (e: any) {
      toast.error("Error al acceder a la cámara: " + (e.message || e));
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (cameraFrameRef.current) {
      cancelAnimationFrame(cameraFrameRef.current);
      cameraFrameRef.current = null;
    }
    setIsCameraActive(false);
    opticLobe.stop();
    TacticalAudioEngine.playTap();
  };

  // Bucle de ingestión de cuadros de la cámara a 16x16 Float32
  useEffect(() => {
    if (!isCameraActive) return;

    let animId: number;
    const processLoop = () => {
      const now = Date.now();
      if (now - lastCaptureTimeRef.current >= 50) {
        lastCaptureTimeRef.current = now;
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          if (!canvas16Ref.current) {
            canvas16Ref.current = document.createElement("canvas");
            canvas16Ref.current.width = 16;
            canvas16Ref.current.height = 16;
          }
          const ctx = canvas16Ref.current.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, 16, 16);
            const imgData = ctx.getImageData(0, 0, 16, 16);
            const pixels = new Float32Array(256);
            const numArr: number[] = new Array(256);
            for (let i = 0; i < 256; i++) {
              const r = imgData.data[i * 4];
              const g = imgData.data[i * 4 + 1];
              const b = imgData.data[i * 4 + 2];
              const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
              pixels[i] = lum;
              numArr[i] = lum;
            }
            const telem = opticLobe.ingestVisualFrame(pixels, now);
            setOmmatidiaPixels(numArr);

            if (telem.loomingThreat.isThreatDetected) {
              TacticalAudioEngine.playAlarm();
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([150, 50, 150]);
              }
            }
          }
        }
      }
      animId = requestAnimationFrame(processLoop);
      cameraFrameRef.current = animId;
    };

    animId = requestAnimationFrame(processLoop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isCameraActive]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Registro de botón Atrás LIFO (Cierre modal interno prioritario)
  useEffect(() => {
    if (!showAttributionModal) return;
    const unregister = BackHandlerRegistry.register(() => {
      TacticalAudioEngine.playTap();
      setShowAttributionModal(false);
      return true;
    });
    return unregister;
  }, [showAttributionModal]);

  // Registro de botón Atrás LIFO (Cierre del HUD principal)
  useEffect(() => {
    const unregister = BackHandlerRegistry.register(() => {
      TacticalAudioEngine.playTap();
      if (onClose) {
        onClose();
        return true;
      }
      return false;
    });
    return unregister;
  }, [onClose]);

  // Referencias de alta velocidad para desacoplar telemetría de React (0 lag interno)
  const cxTelemRef = useRef<RingAttractorTelemetry>(cxTelemetry);
  const fbTelemRef = useRef<FanShapedBodyTelemetry>(fbTelemetry);
  const synTelemRef = useRef<SynapticMeshTelemetry>(synapticTelemetry);
  const gfsTelemRef = useRef<GiantFiberTelemetry>(gfsTelemetry);
  const mbTelemRef = useRef<MushroomBodyTelemetry>(mbTelemetry);
  const joTelemRef = useRef<JohnstonOrganTelemetry>(joTelemetry);
  const metTelemRef = useRef<MetabolicGovernorTelemetry>(metTelemetry);
  const opticTelemRef = useRef<OpticLobeTelemetry>(opticTelemetry);
  const motorTelemRef = useRef<TacticalMotorActuatorTelemetry>(motorTelemetry);
  const critTelemRef = useRef<SwarmCriticalityTelemetry>(criticalityTelemetry);
  const dualTelemRef = useRef<BioCompassDualTelemetry>(dualTelemetry);
  const rfBearingsRef = useRef<RfPeerBearing[]>(rfBearings);
  const humanRef = useRef<HumanBrainTelemetrySnapshot>(humanSnapshot);
  const consciousnessRef = useRef<ConsciousnessSnapshot>(consciousnessTelemetry);
  const cpgTelemRef = useRef<CpgLocomotionTelemetry>(cpgTelemetry);
  const habitatTelemRef = useRef<HabitatTelemetry>(habitatTelemetry);

  // Suscripción desacoplada a los 11 subsistemas neurobiológicos y hábitat físico
  useEffect(() => {
    globalWorkspaceConsciousnessBus.start();
    connectomeBioBridge.startConnectome();

    const unsubCx = ringAttractor.subscribe((t) => { cxTelemRef.current = t; });
    const unsubFb = fanShapedBody.subscribe((t) => { fbTelemRef.current = t; });
    const unsubSyn = synapticMeshRouter.subscribe((st) => {
      synTelemRef.current = st;
      rfBearingsRef.current = synapticMeshRouter.getAllActiveBearings();
    });
    const unsubGfs = giantFiberReflex.subscribe((t) => { gfsTelemRef.current = t; });
    const unsubMb = dtnMushroomBody.subscribe((t) => { mbTelemRef.current = t; });
    const unsubJo = johnstonOrgan.subscribe((t) => { joTelemRef.current = t; });
    const unsubMet = metabolicGovernor.subscribe((t) => { metTelemRef.current = t; });
    const unsubOptic = opticLobe.subscribe((t) => { opticTelemRef.current = t; });
    const unsubMotor = tacticalMotorActuator.subscribe((t) => { motorTelemRef.current = t; });
    const unsubCrit = swarmCriticality.subscribe((t) => { critTelemRef.current = t; });
    const unsubDual = bioCompassDualFusion.subscribe((t) => { dualTelemRef.current = t; });
    const unsubConsciousness = globalWorkspaceConsciousnessBus.subscribe((t) => { consciousnessRef.current = t; });
    const unsubHuman = humanBrainOrchestrator.subscribe((t) => { humanRef.current = t; });
    const unsubCpg = centralPatternGenerator.subscribe((t) => { cpgTelemRef.current = t; });
    const unsubHab = biocyberneticHabitat.subscribeTelemetry((t) => { habitatTelemRef.current = t; });

    // Compuerta de actualización de interfaz a 4 Hz (250ms): agrupa todos los cambios en 1 único re-render
    const syncTimer = setInterval(() => {
      // Evitar re-renders y presión sobre el recolector de basura si la aplicación está en segundo plano
      if (typeof document !== "undefined" && document.hidden) return;

      setCxTelemetry(cxTelemRef.current);
      setFbTelemetry(fbTelemRef.current);
      setSynapticTelemetry(synTelemRef.current);
      setRfBearings(rfBearingsRef.current);
      setGfsTelemetry(gfsTelemRef.current);
      setMbTelemetry(mbTelemRef.current);
      setJoTelemetry(joTelemRef.current);
      setMetTelemetry(metTelemRef.current);
      setOpticTelemetry(opticTelemRef.current);
      setMotorTelemetry(motorTelemRef.current);
      setCriticalityTelemetry(critTelemRef.current);
      setDualTelemetry(dualTelemRef.current);
      setConsciousnessTelemetry(consciousnessRef.current);
      setHumanSnapshot(humanRef.current);
      setCpgTelemetry(cpgTelemRef.current);
      setHabitatTelemetry(habitatTelemRef.current);
      setIsBridgeActive(connectomeBioBridge.isConnectomeActive());
    }, 250);

    return () => {
      clearInterval(syncTimer);
      unsubCx();
      unsubFb();
      unsubSyn();
      unsubGfs();
      unsubMb();
      unsubJo();
      unsubMet();
      unsubOptic();
      unsubMotor();
      unsubCrit();
      unsubDual();
      unsubConsciousness();
      unsubHuman();
      unsubCpg();
      unsubHab();
    };
  }, []);

  // Construcción anatómica de la red MaleCNS v1.0 (Drosophila melanogaster)
  const { nodes, edges } = useMemo(() => {
    const nList: ConnectomeNode[] = [];
    const eList: ConnectomeEdge[] = [];

    // 1. Central Complex (CX) — Anillo Atractor E-PG (16 cuñas) y Protocerebral Bridge (PB)
    const cxRadius = 90;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const rawWedge = cxTelemetry.wedges?.[i];
      const act = (typeof rawWedge === 'number' && Number.isFinite(rawWedge)) ? rawWedge : 0.2;
      const x = Math.cos(angle) * cxRadius;
      const z = Math.sin(angle) * cxRadius;
      const y = 30; // Posición dorsal media

      // Detección de marcación RF correlacionada con esta cuña E-PG
      const wedgeAngleDeg = (i * 22.5 + 11.25);
      const matchedBearing = rfBearings.find(b => {
        const diff = Math.abs(((b.bearingDeg - wedgeAngleDeg + 180) % 360) - 180);
        return diff <= 15 && b.confidence >= 0.25;
      });

      const isRfStimulated = Boolean(matchedBearing);
      const nodeColor = isRfStimulated
        ? "#E040FB"
        : (act > 0.6 ? "#00E5FF" : "rgba(0, 229, 255, 0.4)");

      nList.push({
        id: `CX_EPG_${i}`,
        name: isRfStimulated 
          ? `E-PG Wedge ${i + 1} [📡 RF AoA: ${matchedBearing?.peerId.slice(0, 6)}]`
          : `E-PG Wedge ${i + 1} [#${10100 + i}]`,
        system: "CX",
        pos: { x, y, z },
        color: nodeColor,
        size: isRfStimulated ? 4 + (matchedBearing?.confidence || 0.5) * 5 : 3 + act * 4,
        activity: isRfStimulated ? Math.max(act, matchedBearing?.confidence || 0.6) : act,
      });

      // Conexiones sinápticas recurrentes circulares en anillo
      const nextIdx = (i + 1) % 16;
      eList.push({
        from: `CX_EPG_${i}`,
        to: `CX_EPG_${nextIdx}`,
        weight: isRfStimulated ? 1.0 : 0.8,
        system: "CX",
      });
    }

    // Protocerebral Bridge (PB) — Arco horizontal superior
    for (let i = 0; i < 8; i++) {
      const x = -80 + i * 22;
      const y = 80;
      const z = -40;
      nList.push({
        id: `CX_PB_${i}`,
        name: `PB Glomerulus ${i + 1} [#${10200 + i}]`,
        system: "CX",
        pos: { x, y, z },
        color: "#76FF03",
        size: 3.5,
        activity: 0.5,
      });

      // Conectar PB con E-PG correspondientes
      eList.push({
        from: `CX_PB_${i}`,
        to: `CX_EPG_${i * 2}`,
        weight: 0.6,
        system: "CX",
      });
    }

    // Fan-Shaped Body (FB) — 16 Columnas azimutales y 9 estratos laminares (Navegación 3D)
    for (let c = 0; c < 16; c++) {
      const colAng = (c / 16) * Math.PI * 2;
      const colRadius = 60;
      const fx = Math.cos(colAng) * colRadius;
      const fz = Math.sin(colAng) * colRadius;
      const fy = 50; // Estrato dorsal sobre EB

      const rawFbAct = fbTelemetry.columnLayerMatrix?.[c * 9 + 4];
      const act = (typeof rawFbAct === 'number' && Number.isFinite(rawFbAct)) ? rawFbAct : 0.25;

      nList.push({
        id: `FB_COL_${c}`,
        name: `FB Column ${c + 1} (Layer 5 Path Int)`,
        system: "FB",
        pos: { x: fx, y: fy, z: fz },
        color: "#FFD600",
        size: 3.5,
        activity: act,
      });

      eList.push({
        from: `CX_EPG_${c}`,
        to: `FB_COL_${c}`,
        weight: 0.75,
        system: "FB",
      });
    }

    // Johnston's Organ (JO) — Antenas mecanosensoriales acústicas y de choque
    [-1, 1].forEach((side) => {
      const sPrefix = side === 1 ? "R" : "L";
      const antPos: Point3D = { x: side * 45, y: 150, z: -5 };
      nList.push({
        id: `SENSORY_JO_${sPrefix}`,
        name: `Johnston Organ ${sPrefix} (Mechanosensory/Acoustic)`,
        system: "SENSORY",
        pos: antPos,
        color: joTelemetry.shockEventsCount > 0 ? "#FF3355" : "#00E5FF",
        size: 4.5,
        activity: joTelemetry.acousticEnergyLevel,
      });

      eList.push({
        from: `SENSORY_JO_${sPrefix}`,
        to: `GFS_SOMA_${sPrefix}`,
        weight: 0.9,
        system: "GFS",
      });
    });

    // 2. Mushroom Body (MB) — Calyx, Pedúnculo y Lóbulos Alfa/Beta/Gamma (Memoria DTN)
    // Cáliz dorsal bilateral
    [-1, 1].forEach((side, sIdx) => {
      const sPrefix = side === 1 ? "R" : "L";
      const calyxCenter: Point3D = { x: side * 110, y: 70, z: -70 };

      // Clúster de Células de Kenyon
      for (let k = 0; k < 6; k++) {
        const offsetAng = (k / 6) * Math.PI * 2;
        const kx = calyxCenter.x + Math.cos(offsetAng) * 25;
        const ky = calyxCenter.y + Math.sin(offsetAng) * 15;
        const kz = calyxCenter.z;

        nList.push({
          id: `MB_KC_${sPrefix}_${k}`,
          name: `Kenyon Cell ${sPrefix}-${k} [#${20000 + (sIdx * 100) + k}]`,
          system: "MB",
          pos: { x: kx, y: ky, z: kz },
          color: "#B388FF",
          size: 3,
          activity: 0.4 + (k % 2) * 0.4,
        });
      }

      // Lóbulos alfa/beta anteriores (97 MBONs, 332 DANs)
      const lobeTip: Point3D = { x: side * 60, y: -20, z: 80 };
      nList.push({
        id: `MB_LOBE_${sPrefix}`,
        name: `MB Alpha/Beta Lobe ${sPrefix} (97 MBON, 332 DAN)`,
        system: "MB",
        pos: lobeTip,
        color: "#E040FB",
        size: 5,
        activity: mbTelemetry.ltpPinnedRecords > 0 ? 0.9 : 0.4,
      });

      // Clúster DAN PAM (Recompensa / LTP)
      nList.push({
        id: `MB_DAN_PAM_${sPrefix}`,
        name: `DAN PAM Cluster [#10300] ${sPrefix} (Reward LTP)`,
        system: "MB",
        pos: { x: side * 85, y: 30, z: 20 },
        color: "#FFD600",
        size: 4,
        activity: 0.7,
      });

      // Clúster DAN PPL1 (Amenaza / SOS)
      nList.push({
        id: `MB_DAN_PPL1_${sPrefix}`,
        name: `DAN PPL1 Cluster [#10350] ${sPrefix} (Aversive SOS)`,
        system: "MB",
        pos: { x: side * 95, y: 15, z: 35 },
        color: "#FF1744",
        size: 4,
        activity: mbTelemetry.ltpPinnedRecords > 0 ? 1.0 : 0.3,
      });

      // Conexión peduncular y dopaminérgica
      eList.push({
        from: `MB_KC_${sPrefix}_0`,
        to: `MB_LOBE_${sPrefix}`,
        weight: 0.9,
        system: "MB",
      });
      eList.push({
        from: `MB_DAN_PAM_${sPrefix}`,
        to: `MB_LOBE_${sPrefix}`,
        weight: 0.85,
        system: "MB",
      });
      eList.push({
        from: `MB_DAN_PPL1_${sPrefix}`,
        to: `MB_LOBE_${sPrefix}`,
        weight: 0.95,
        system: "MB",
      });
    });

    // 3. Giant Fiber System (GFS) — Circuito de Escape fly-swing (LC4/LPLC2 -> DNp01 -> TTMn)
    [-1, 1].forEach((side) => {
      const sPrefix = side === 1 ? "R" : "L";
      const lc4Pos: Point3D = { x: side * 65, y: 120, z: -10 };
      const lplc2Pos: Point3D = { x: side * 75, y: 105, z: -15 };
      const somaPos: Point3D = { x: side * 35, y: 100, z: 10 };
      const thoracicPos: Point3D = { x: side * 15, y: -130, z: -20 };

      // LC4 Detector de Aproximación Rápida
      nList.push({
        id: `GFS_LC4_${sPrefix}`,
        name: `LC4 Looming [#10042] ${sPrefix}`,
        system: "GFS",
        pos: lc4Pos,
        color: "#00E5FF",
        size: 4,
        activity: gfsTelemetry.isReflexActive ? 1.0 : 0.4,
      });

      // LPLC2 Detector de Borde Expansivo
      nList.push({
        id: `GFS_LPLC2_${sPrefix}`,
        name: `LPLC2 Edge [#10043] ${sPrefix}`,
        system: "GFS",
        pos: lplc2Pos,
        color: "#76FF03",
        size: 4,
        activity: gfsTelemetry.isReflexActive ? 1.0 : 0.3,
      });

      // DNp01 Interneurona Gigante de Escape
      nList.push({
        id: `GFS_SOMA_${sPrefix}`,
        name: `DNp01 Giant Fiber [#10001] ${sPrefix}`,
        system: "GFS",
        pos: somaPos,
        color: gfsTelemetry.emconLockActive ? "#FF3355" : "#00E676",
        size: 6,
        activity: gfsTelemetry.isReflexActive ? 1.0 : 0.3,
      });

      // TTMn Motoneurona de Salto Torácico
      nList.push({
        id: `GFS_MOTOR_${sPrefix}`,
        name: `TTMn Jump Motor [#10099] ${sPrefix}`,
        system: "GFS",
        pos: thoracicPos,
        color: gfsTelemetry.emconLockActive ? "#FF3355" : "#FF9100",
        size: 5,
        activity: gfsTelemetry.isReflexActive ? 1.0 : 0.2,
      });

      // Sinapsis de escape monosinápticas
      eList.push({
        from: `GFS_LC4_${sPrefix}`,
        to: `GFS_SOMA_${sPrefix}`,
        weight: 1.0,
        system: "GFS",
      });
      eList.push({
        from: `GFS_LPLC2_${sPrefix}`,
        to: `GFS_SOMA_${sPrefix}`,
        weight: 0.9,
        system: "GFS",
      });
      eList.push({
        from: `GFS_SOMA_${sPrefix}`,
        to: `GFS_MOTOR_${sPrefix}`,
        weight: 1.0,
        system: "GFS",
      });
    });

    return { nodes: nList, edges: eList };
  }, [cxTelemetry, gfsTelemetry, mbTelemetry]);

  // Referencias mutables para desacoplar el bucle de renderizado 3D de las re-renderizaciones de React
  const nodesRef = useRef<ConnectomeNode[]>(nodes);
  const edgesRef = useRef<ConnectomeEdge[]>(edges);
  const filterSystemRef = useRef<"ALL" | "CX" | "MB" | "GFS" | "FB">(filterSystem);
  const gfsTelemetryRef = useRef<GiantFiberTelemetry>(gfsTelemetry);
  const architectureModeRef = useRef<"SUBCORTICAL_MALE_CNS" | "HUMAN_NEOCORTEX" | "CONSCIOUS_SWARM_BUS">(architectureMode);

  // Mapa de búsqueda O(1) de nodos para eliminar búsquedas lineales repetidas por arista
  const nodeMap = useMemo(() => {
    const map = new Map<string, ConnectomeNode>();
    for (const n of nodes) {
      map.set(n.id, n);
    }
    return map;
  }, [nodes]);
  const nodeMapRef = useRef<Map<string, ConnectomeNode>>(nodeMap);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    nodeMapRef.current = nodeMap;
  }, [nodeMap]);

  useEffect(() => {
    filterSystemRef.current = filterSystem;
  }, [filterSystem]);

  useEffect(() => {
    gfsTelemetryRef.current = gfsTelemetry;
  }, [gfsTelemetry]);

  useEffect(() => {
    architectureModeRef.current = architectureMode;
  }, [architectureMode]);

  // Bucle de Renderizado 3D en Canvas (Optimizado con caché de dimensiones y gobernador térmico)
  useEffect(() => {
    let animationId: number;
    let pulseT = 0;
    let lastRenderTime = 0;
    let isMounted = true;

    // Caché de dimensiones para erradicar el Layout Reflow Thrashing de getBoundingClientRect() en cada fotograma
    const updateCanvasResolution = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const rawDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const dpr = Math.min(rawDpr, 1.5);
      const targetW = Math.max(300, Math.floor((rect.width || 500) * dpr));
      const targetH = Math.max(200, Math.floor((rect.height || 320) * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    updateCanvasResolution();
    window.addEventListener("resize", updateCanvasResolution, { passive: true });

    const isTouchDevice = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    const minFrameDeltaMs = isTouchDevice ? 30 : 16; // 33 FPS en móviles (Helio G37 / PowerVR) vs 60 FPS en PC

    const render = (currentTime: number = 0) => {
      if (!isMounted) return;

      // Suspender renderizado inmediato si la pantalla está bloqueada o la app en background
      if (typeof document !== "undefined" && document.hidden) {
        animationId = requestAnimationFrame(render);
        return;
      }

      // Suspender renderizado si la pestaña activa no es el Conectoma Subcortical 3D
      if (architectureModeRef.current !== "SUBCORTICAL_MALE_CNS") {
        animationId = requestAnimationFrame(render);
        return;
      }

      // Gobernador térmico: limitar tasa de refresco en GPUs móviles para erradicar thermal throttling
      const elapsed = currentTime - lastRenderTime;
      if (elapsed < minFrameDeltaMs) {
        animationId = requestAnimationFrame(render);
        return;
      }
      lastRenderTime = currentTime;

      const canvas = canvasRef.current;
      if (!canvas) {
        animationId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animationId = requestAnimationFrame(render);
        return;
      }

      const currentEdges = edgesRef.current;
      const currentNodes = nodesRef.current;
      const filterSystem = filterSystemRef.current;
      const currentGfs = gfsTelemetryRef.current;

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const rawDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const dpr = Math.min(rawDpr, 1.5);

      ctx.clearRect(0, 0, width, height);

      // Fondo cibernético con cuadrícula de profundidad
      ctx.fillStyle = "#040711";
      ctx.fillRect(0, 0, width, height);

      // Si autoRotate está activo, rotar azimutalmente usando ref (0 re-renders de React)
      if (autoRotateRef.current) {
        const currentRotY = Number.isFinite(rotYRef.current) ? rotYRef.current : 0;
        rotYRef.current = (currentRotY + 0.006) % (Math.PI * 2);
      }

      pulseT = (pulseT + 0.04) % (Math.PI * 2);

      try {
        // Proyección 3D con Near-Clipping Plane y validación numérica estricta
        const project = (p: Point3D): { x: number; y: number; zDepth: number; visible: boolean } => {
          const rotY = Number.isFinite(rotYRef.current) ? rotYRef.current : 0;
          const rotX = Number.isFinite(rotXRef.current) ? rotXRef.current : 0.3;
          const zoom = Number.isFinite(zoomRef.current) && zoomRef.current > 0 ? zoomRef.current : 1.0;

          // Rotación Y
          const cosY = Math.cos(rotY);
          const sinY = Math.sin(rotY);
          const px = Number.isFinite(p.x) ? p.x : 0;
          const py = Number.isFinite(p.y) ? p.y : 0;
          const pz = Number.isFinite(p.z) ? p.z : 0;

          const x1 = px * cosY - pz * sinY;
          const z1 = px * sinY + pz * cosY;

          // Rotación X
          const cosX = Math.cos(rotX);
          const sinX = Math.sin(rotX);
          const y2 = py * cosX - z1 * sinX;
          const z2 = py * sinX + z1 * cosX;

          // Perspectiva con Near-Clipping Plane (evitar división por 0 o valores detrás de cámara)
          const fov = 380;
          const denom = fov + z2;
          if (denom <= 20) {
            return { x: cx, y: cy, zDepth: z2, visible: false };
          }

          const scale = (fov / denom) * zoom * dpr;
          if (!Number.isFinite(scale) || scale <= 0) {
            return { x: cx, y: cy, zDepth: z2, visible: false };
          }

          const projX = cx + x1 * scale;
          const projY = cy - y2 * scale;

          if (!Number.isFinite(projX) || !Number.isFinite(projY)) {
            return { x: cx, y: cy, zDepth: z2, visible: false };
          }

          return {
            x: projX,
            y: projY,
            zDepth: z2,
            visible: true,
          };
        };

        // 1. Dibujar Aristas Sinápticas (Axones con búsqueda O(1))
        const nodeMap = nodeMapRef.current;
        currentEdges.forEach((edge) => {
          if (filterSystem !== "ALL" && edge.system !== filterSystem) return;

          const srcNode = nodeMap.get(edge.from);
          const dstNode = nodeMap.get(edge.to);
          if (!srcNode || !dstNode) return;

          const p1 = project(srcNode.pos);
          const p2 = project(dstNode.pos);

          if (!p1.visible || !p2.visible) return;

          let strokeColor = "rgba(0, 229, 255, 0.2)";
          if (edge.system === "FB") strokeColor = "rgba(255, 214, 0, 0.3)";
          if (edge.system === "MB") strokeColor = "rgba(179, 136, 255, 0.25)";
          if (edge.system === "GFS") strokeColor = currentGfs.emconLockActive ? "rgba(255, 51, 85, 0.6)" : "rgba(255, 145, 0, 0.35)";

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = Math.max(0.5, (edge.weight || 0.5) * 1.5 * dpr);
          ctx.stroke();

          // Pulso de potencial de acción dinámico a lo largo del axón
          const pulseOffset = (pulseT + (edge.from.length + edge.to.length) * 0.3) % 1;
          const px = p1.x + (p2.x - p1.x) * pulseOffset;
          const py = p1.y + (p2.y - p1.y) * pulseOffset;

          if (Number.isFinite(px) && Number.isFinite(py)) {
            ctx.beginPath();
            ctx.arc(px, py, Math.max(1, 2 * dpr), 0, Math.PI * 2);
            ctx.fillStyle = edge.system === "GFS" ? "#FF3355" : edge.system === "FB" ? "#FFD600" : "#00E5FF";
            ctx.fill();
          }
        });

        // 2. Dibujar Nodos Neuronales (Somas y Glomérulos) con proyección en una sola pasada
        const sortedNodes: { node: ConnectomeNode; proj: ReturnType<typeof project> }[] = [];
        for (let i = 0; i < currentNodes.length; i++) {
          const n = currentNodes[i];
          if (filterSystem !== "ALL" && n.system !== filterSystem) continue;
          const p = project(n.pos);
          if (p.visible) {
            sortedNodes.push({ node: n, proj: p });
          }
        }
        sortedNodes.sort((a, b) => b.proj.zDepth - a.proj.zDepth);

        for (let i = 0; i < sortedNodes.length; i++) {
          const { node, proj } = sortedNodes[i];
          if (!Number.isFinite(proj.x) || !Number.isFinite(proj.y)) continue;

          const rawActivity = Number.isFinite(node.activity) ? Math.max(0, Math.min(1, node.activity)) : 0.3;
          const rawSize = Number.isFinite(node.size) && node.size > 0 ? node.size : 3;
          const glowRadius = Math.max(1, rawSize * (1 + rawActivity * 0.8) * dpr);

          if (!Number.isFinite(glowRadius) || glowRadius <= 0) continue;

          // Resplandor externo ultrarrápido con halo alfa (elimina el costoso createRadialGradient en móvil)
          let glowColor = "rgba(0, 229, 255, 0.25)";
          if (node.color) {
            if (node.color.startsWith("#")) {
              glowColor = node.color.length === 7 ? `${node.color}33` : node.color;
            } else if (node.color.startsWith("rgba")) {
              glowColor = node.color.replace(/[\d.]+\)$/, "0.25)");
            } else if (node.color.startsWith("rgb(")) {
              glowColor = node.color.replace("rgb(", "rgba(").replace(")", ", 0.25)");
            }
          }
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, glowRadius * 1.6, 0, Math.PI * 2);
          ctx.fillStyle = glowColor;
          ctx.fill();

          // Núcleo del soma
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, Math.max(1, rawSize * dpr), 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
        }
      } catch (renderErr) {
        console.warn('[ConnectomeHUD] Error durante renderizado de frame:', renderErr);
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      window.removeEventListener("resize", updateCanvasResolution);
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Controlador de arrastre táctil y pinch-to-zoom para navegación 3D
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    isDragging.current = true;
    setIsDraggingUI(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    autoRotateRef.current = false;
    setAutoRotate(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;

    const lastX = Number.isFinite(lastMousePos.current.x) ? lastMousePos.current.x : e.clientX;
    const lastY = Number.isFinite(lastMousePos.current.y) ? lastMousePos.current.y : e.clientY;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

    const currentRotY = Number.isFinite(rotYRef.current) ? rotYRef.current : 0;
    const currentRotX = Number.isFinite(rotXRef.current) ? rotXRef.current : 0.3;

    rotYRef.current = (currentRotY + dx * 0.008) % (Math.PI * 2);
    rotXRef.current = Math.max(-1.2, Math.min(1.2, currentRotX + dy * 0.008));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    setIsDraggingUI(false);
  };

  // Control táctil unificado (Rotación 1 dedo + Pinch-to-Zoom 2 dedos)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!e.touches) return;
    autoRotateRef.current = false;
    setAutoRotate(false);

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
        isDragging.current = true;
        setIsDraggingUI(true);
        lastMousePos.current = { x: touch.clientX, y: touch.clientY };
        lastPinchDist.current = null;
      }
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      setIsDraggingUI(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (Number.isFinite(t1.clientX) && Number.isFinite(t2.clientX)) {
        lastPinchDist.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!e.touches) return;

    // Gestor de Pinch-to-Zoom con 2 dedos
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (Number.isFinite(t1.clientX) && Number.isFinite(t2.clientX)) {
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (lastPinchDist.current !== null && lastPinchDist.current > 0 && currentDist > 0) {
          const pinchFactor = currentDist / lastPinchDist.current;
          const currentZoom = Number.isFinite(zoomRef.current) ? zoomRef.current : 1.0;
          zoomRef.current = Math.max(0.4, Math.min(2.5, currentZoom * pinchFactor));
        }
        lastPinchDist.current = currentDist;
      }
      return;
    }

    // Gestor de Rotación con 1 dedo
    if (!isDragging.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    if (!touch || !Number.isFinite(touch.clientX) || !Number.isFinite(touch.clientY)) return;

    const lastX = Number.isFinite(lastMousePos.current.x) ? lastMousePos.current.x : touch.clientX;
    const lastY = Number.isFinite(lastMousePos.current.y) ? lastMousePos.current.y : touch.clientY;
    const dx = touch.clientX - lastX;
    const dy = touch.clientY - lastY;
    lastMousePos.current = { x: touch.clientX, y: touch.clientY };

    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

    const currentRotY = Number.isFinite(rotYRef.current) ? rotYRef.current : 0;
    const currentRotX = Number.isFinite(rotXRef.current) ? rotXRef.current : 0.3;

    rotYRef.current = (currentRotY + dx * 0.008) % (Math.PI * 2);
    rotXRef.current = Math.max(-1.2, Math.min(1.2, currentRotX + dy * 0.008));
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    setIsDraggingUI(false);
    lastPinchDist.current = null;
  };

  // Estimulación Sináptica Manual
  const triggerSynapticPulse = () => {
    TacticalAudioEngine.playRogerBeep();
    setStimulationActive(true);
    // Disparar prueba de reflejo o pulso hebbiano
    ringAttractor.injectAngularVelocity(45);
    setTimeout(() => {
      ringAttractor.injectAngularVelocity(0);
      setStimulationActive(false);
    }, 800);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxHeight: "92vh",
        background: "linear-gradient(180deg, #070B19 0%, #03050C 100%)",
        border: "1.5px solid rgba(0, 229, 255, 0.4)",
        borderRadius: "18px",
        boxShadow: "0 10px 40px rgba(0, 229, 255, 0.25), 0 0 80px rgba(0, 0, 0, 0.9)",
        overflow: "hidden",
        color: "#FFFFFF",
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      {/* Header Táctico */}
      <div
        style={{
          padding: "12px 18px",
          background: "linear-gradient(90deg, rgba(0, 229, 255, 0.15) 0%, rgba(10, 18, 40, 0.9) 100%)",
          borderBottom: "1px solid rgba(0, 229, 255, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(0, 229, 255, 0.2)",
              border: "1px solid #00E5FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(0, 229, 255, 0.4)",
            }}
          >
            <TacIcon name="cpu" size={20} color="#00E5FF" />
          </div>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 900, letterSpacing: "1px", color: "#FFFFFF" }}>
              CONECTOMA 3D MALECNS v1.0
            </div>
            <div style={{ fontSize: "0.68rem", color: "#00E5FF", fontWeight: 800 }}>
              Drosophila Bio-Neuromorphic Architecture
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={triggerSynapticPulse}
            disabled={stimulationActive}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              background: stimulationActive ? "rgba(255, 51, 85, 0.3)" : "rgba(0, 229, 255, 0.18)",
              border: `1px solid ${stimulationActive ? "#FF3355" : "#00E5FF"}`,
              color: stimulationActive ? "#FF3355" : "#00E5FF",
              fontSize: "0.72rem",
              fontWeight: 900,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <TacIcon name="zap" size={14} color="currentColor" />
            <span>{stimulationActive ? "ESTIMULANDO..." : "ESTIMULAR"}</span>
          </button>

          <button
            onClick={() => {
              TacticalAudioEngine.playTap();
              setShowAttributionModal(true);
            }}
            title="Atribución Científica y Licencias Conectómicas"
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              background: "rgba(0, 229, 255, 0.15)",
              border: "1px solid rgba(0, 229, 255, 0.4)",
              color: "#00E5FF",
              fontSize: "0.65rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            📜 CRÉDITOS & PROCEDENCIA
          </button>

          {onClose && (
            <button
              onClick={() => {
                TacticalAudioEngine.playTap();
                onClose();
              }}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "8px",
                width: "28px",
                height: "28px",
                color: "#94A3B8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TacIcon name="x" size={16} color="currentColor" />
            </button>
          )}
        </div>
      </div>

      {/* Selector de Sustrato Neurobiológico: Tronco Encefálico (MaleCNS) vs Neocorteza Humana (7 Núcleos) */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(0, 229, 255, 0.2)",
          background: "rgba(4, 7, 17, 0.95)",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          whiteSpace: "nowrap",
        }}
      >
        <button
          onClick={() => {
            TacticalAudioEngine.playTap();
            setArchitectureMode("SUBCORTICAL_MALE_CNS");
          }}
          style={{
            flex: 1,
            minWidth: "max-content",
            flexShrink: 0,
            padding: "10px 14px",
            background: architectureMode === "SUBCORTICAL_MALE_CNS" ? "rgba(0, 229, 255, 0.15)" : "transparent",
            border: "none",
            borderBottom: architectureMode === "SUBCORTICAL_MALE_CNS" ? "2px solid #00E5FF" : "none",
            color: architectureMode === "SUBCORTICAL_MALE_CNS" ? "#00E5FF" : "#64748B",
            fontSize: "0.74rem",
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <span>🦟</span>
          <span>TRONCO ENCEFÁLICO (MaleCNS v1.0)</span>
        </button>

        <button
          onClick={() => {
            TacticalAudioEngine.playTap();
            setArchitectureMode("HUMAN_NEOCORTEX");
          }}
          style={{
            flex: 1,
            minWidth: "max-content",
            flexShrink: 0,
            padding: "10px 14px",
            background: architectureMode === "HUMAN_NEOCORTEX" ? "rgba(16, 185, 129, 0.15)" : "transparent",
            border: "none",
            borderBottom: architectureMode === "HUMAN_NEOCORTEX" ? "2px solid #10B981" : "none",
            color: architectureMode === "HUMAN_NEOCORTEX" ? "#10B981" : "#64748B",
            fontSize: "0.74rem",
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <span>🧠</span>
          <span>NEOCORTEZA HUMANA</span>
        </button>

        <button
          onClick={() => {
            TacticalAudioEngine.playTap();
            setArchitectureMode("CONSCIOUS_SWARM_BUS");
          }}
          style={{
            flex: 1,
            minWidth: "max-content",
            flexShrink: 0,
            padding: "10px 14px",
            background: architectureMode === "CONSCIOUS_SWARM_BUS" ? "rgba(245, 158, 11, 0.15)" : "transparent",
            border: "none",
            borderBottom: architectureMode === "CONSCIOUS_SWARM_BUS" ? "2px solid #F59E0B" : "none",
            color: architectureMode === "CONSCIOUS_SWARM_BUS" ? "#F59E0B" : "#64748B",
            fontSize: "0.74rem",
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <span>🌐</span>
          <span>ESPACIO GLOBAL GNWT</span>
        </button>
      </div>

      {architectureMode === "SUBCORTICAL_MALE_CNS" ? (
        <div
          className="scroll-container"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            display: "flex",
            flexDirection: "column",
            background: "#040711"
          }}
        >
          {/* Visor 3D Interactivo */}
          <div
        style={{
          position: "relative",
          width: "100%",
          height: "320px",
          background: "#040711",
          cursor: isDraggingUI ? "grabbing" : "grab",
          touchAction: "none",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          width={500}
          height={320}
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {/* Controles Flotantes de Cámara con Scroll Horizontal Touch */}
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            left: "12px",
            display: "flex",
            gap: "6px",
            zIndex: 5,
            maxWidth: "calc(100% - 24px)",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            whiteSpace: "nowrap",
            paddingBottom: "2px",
          }}
        >
          <button
            onClick={() => {
              const next = !autoRotate;
              autoRotateRef.current = next;
              setAutoRotate(next);
            }}
            style={{
              flexShrink: 0,
              padding: "4px 8px",
              borderRadius: "6px",
              background: autoRotate ? "rgba(0, 229, 255, 0.25)" : "rgba(0, 0, 0, 0.6)",
              border: "1px solid rgba(0, 229, 255, 0.3)",
              color: autoRotate ? "#00E5FF" : "#94A3B8",
              fontSize: "0.65rem",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {autoRotate ? "⏹ PAUSAR GIRO" : "▶ GIRAR 3D"}
          </button>

          <button
            onClick={() => {
              zoomRef.current = Math.min(1.8, zoomRef.current + 0.15);
            }}
            style={{
              flexShrink: 0,
              padding: "4px 8px",
              borderRadius: "6px",
              background: "rgba(0, 0, 0, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#FFFFFF",
              fontSize: "0.65rem",
              cursor: "pointer",
            }}
          >
            + ZOOM
          </button>

          <button
            onClick={() => {
              zoomRef.current = Math.max(0.5, zoomRef.current - 0.15);
            }}
            style={{
              flexShrink: 0,
              padding: "4px 8px",
              borderRadius: "6px",
              background: "rgba(0, 0, 0, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#FFFFFF",
              fontSize: "0.65rem",
              cursor: "pointer",
            }}
          >
            - ZOOM
          </button>

          <button
            onClick={() => {
              TacticalAudioEngine.playTap();
              setIsVivariumOpen(true);
            }}
            style={{
              flexShrink: 0,
              padding: "4px 8px",
              borderRadius: "6px",
              background: "rgba(0, 240, 255, 0.22)",
              border: "1px solid #00F0FF",
              color: "#00F0FF",
              fontSize: "0.65rem",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            🌌 VIVARIUM 3D
          </button>

          <button
            onClick={() => {
              TacticalAudioEngine.playTap();
              setIsHabitatOpen(true);
            }}
            style={{
              flexShrink: 0,
              padding: "4px 8px",
              borderRadius: "6px",
              background: "rgba(0, 255, 136, 0.22)",
              border: "1px solid #00FF88",
              color: "#00FF88",
              fontSize: "0.65rem",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            🌿 HÁBITAT VIVO
          </button>
        </div>

        {/* Selector de Subsistema Filtrado */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            zIndex: 5,
          }}
        >
          {(["ALL", "CX", "FB", "MB", "GFS"] as const).map((sys) => (
            <button
              key={sys}
              onClick={() => {
                TacticalAudioEngine.playTap();
                setFilterSystem(sys);
              }}
              style={{
                padding: "3px 8px",
                borderRadius: "6px",
                background: filterSystem === sys ? "rgba(0, 229, 255, 0.3)" : "rgba(0, 0, 0, 0.6)",
                border: filterSystem === sys ? "1px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.1)",
                color: filterSystem === sys ? "#00E5FF" : "#94A3B8",
                fontSize: "0.62rem",
                fontWeight: 900,
                cursor: "pointer",
                textAlign: "right",
              }}
            >
              {sys === "ALL" && "🌐 COMPLETO"}
              {sys === "CX" && "🧭 CENTRAL COMPLEX"}
              {sys === "FB" && "📐 FAN-SHAPED BODY"}
              {sys === "MB" && "🍄 MUSHROOM BODY"}
              {sys === "GFS" && "⚡ GIANT FIBER"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Métricas Bio-Neuromórficas en Vivo */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "8px",
          padding: "12px",
          background: "rgba(0, 0, 0, 0.4)",
          overflowY: "auto",
        }}
      >
        {/* Card 1: Central Complex */}
        <div
          style={{
            padding: "10px",
            borderRadius: "10px",
            background: "rgba(0, 229, 255, 0.05)",
            border: "1px solid rgba(0, 229, 255, 0.2)",
          }}
        >
          <div style={{ fontSize: "0.65rem", color: "#00E5FF", fontWeight: 900, marginBottom: "4px" }}>
            🧭 CENTRAL COMPLEX (CX / E-PG)
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: 800 }}>
            <span style={{ color: "#94A3B8" }}>Rumbo Atractor:</span>
            <span style={{ color: "#00E5FF" }}>{cxTelemetry.headingDeg}° ({cxTelemetry.cardinal})</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Confianza Burbuja:</span>
            <span style={{ color: "#00E676" }}>{(cxTelemetry.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Card 2: Fan-Shaped Body (FB 3D Vector Path Integration) */}
        <div
          style={{
            padding: "10px",
            borderRadius: "10px",
            background: "rgba(255, 214, 0, 0.05)",
            border: "1px solid rgba(255, 214, 0, 0.2)",
          }}
        >
          <div style={{ fontSize: "0.65rem", color: "#FFD600", fontWeight: 900, marginBottom: "4px" }}>
            📐 FAN-SHAPED BODY (FB 3D VECTORS)
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 800 }}>
            <span style={{ color: "#94A3B8" }}>Home Vector:</span>
            <span style={{ color: "#FFD600" }}>{fbTelemetry.homeVector.distanceMeters}m @ {fbTelemetry.homeVector.bearingDeg}° ({fbTelemetry.homeVector.cardinal})</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Desplazamiento Z:</span>
            <span style={{ color: "#00E5FF" }}>{fbTelemetry.homeVector.deltaAltitudeMeters > 0 ? `+${fbTelemetry.homeVector.deltaAltitudeMeters}` : fbTelemetry.homeVector.deltaAltitudeMeters}m (Baro)</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Odometría P-FN:</span>
            <span style={{ color: "#00E676" }}>{fbTelemetry.totalDistanceTraveledMeters}m total</span>
          </div>
        </div>

        {/* Card 3: Johnston's Organ (Mechanosensory & Acoustic Shield) */}
        <div
          style={{
            padding: "10px",
            borderRadius: "10px",
            background: "rgba(0, 229, 255, 0.05)",
            border: `1px solid ${joTelemetry.shockEventsCount > 0 ? "#FF3355" : "rgba(0, 229, 255, 0.2)"}`,
          }}
        >
          <div style={{ fontSize: "0.65rem", color: joTelemetry.shockEventsCount > 0 ? "#FF3355" : "#00E5FF", fontWeight: 900, marginBottom: "4px" }}>
            👂 ÓRGANO DE JOHNSTON (MECANOSENSOR)
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 800 }}>
            <span style={{ color: "#94A3B8" }}>Energía Acústica:</span>
            <span style={{ color: joTelemetry.acousticEnergyLevel > 0.5 ? "#FFB300" : "#00E676" }}>{(joTelemetry.acousticEnergyLevel * 100).toFixed(0)}%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Frecuencia Resonancia:</span>
            <span style={{ color: "#00E5FF" }}>{joTelemetry.vibrationFrequencyHz} Hz</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Choques Detectados:</span>
            <span style={{ color: joTelemetry.shockEventsCount > 0 ? "#FF3355" : "#64748B" }}>{joTelemetry.shockEventsCount} eventos</span>
          </div>
        </div>

        {/* Card 4: Metabolic Neuromorphic Governor (IPC / NPF) */}
        <div
          style={{
            padding: "10px",
            borderRadius: "10px",
            background: (metTelemetry.regime === 'TORPOR' || isForcedTorpor) ? "rgba(255, 51, 85, 0.12)" : "rgba(118, 255, 3, 0.05)",
            border: `1px solid ${(metTelemetry.regime === 'TORPOR' || isForcedTorpor) ? '#FF3355' : 'rgba(118, 255, 3, 0.25)'}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "0.65rem", color: (metTelemetry.regime === 'TORPOR' || isForcedTorpor) ? '#FF3355' : '#76FF03', fontWeight: 900 }}>
              🔋 METABOLISMO (IPC / NPF)
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{
                fontSize: "0.58rem",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 900,
                background: (metTelemetry.regime === 'TORPOR' || isForcedTorpor) ? '#FF3355' : metTelemetry.regime === 'CONSERVATIVE' ? '#FFB300' : '#00E676',
                color: '#000000',
              }}>
                {isForcedTorpor ? 'TORPOR FORZADO' : metTelemetry.regime}
              </span>
              <button
                onClick={() => {
                  const next = !isForcedTorpor;
                  metabolicGovernor.setForcedTorpor(next);
                  setIsForcedTorpor(next);
                  if (next) {
                    TacticalAudioEngine.playAlarm();
                    toast.warning("Torpor forzado activado: Radio LoRa 5 min, IA pausada");
                  } else {
                    TacticalAudioEngine.playTap();
                    toast.success("Torpor desactivado: CNS restaurado");
                  }
                }}
                style={{
                  fontSize: "0.58rem",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: 900,
                  background: isForcedTorpor ? "#FF3355" : "rgba(255, 255, 255, 0.1)",
                  border: `1px solid ${isForcedTorpor ? "#FFF" : "rgba(255, 255, 255, 0.25)"}`,
                  color: "#FFF",
                  cursor: "pointer"
                }}
              >
                {isForcedTorpor ? "DESPERTAR" : "FORZAR"}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 800 }}>
            <span style={{ color: "#94A3B8" }}>Batería:</span>
            <span style={{ color: metTelemetry.batteryPct < 20 ? '#FF3355' : '#00E676' }}>
              {metTelemetry.batteryPct}% ({metTelemetry.isCharging ? '⚡ Cargando' : `~${metTelemetry.estimatedStandbyHours}h est`})
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Reloj Sináptico:</span>
            <span style={{ color: "#00E5FF" }}>{metTelemetry.neuralClockIntervalMs} ms ({Math.round(1000 / metTelemetry.neuralClockIntervalMs)} Hz)</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>IPC / NPF:</span>
            <span style={{ color: "#B388FF" }}>{(metTelemetry.ipcLevel * 100).toFixed(0)}% / {(metTelemetry.npfLevel * 100).toFixed(0)}%</span>
          </div>
          {isForcedTorpor && (
            <div style={{ fontSize: "0.60rem", color: "#FF6680", marginTop: "4px", fontStyle: "italic" }}>
              ⚠️ Reposo táctico extremo: longevidad multiplicada x3.5, radio TDMA LoRa en ráfagas de 5 min.
            </div>
          )}
        </div>

        {/* Card 5: Mushroom Body & Swarm Pheromones */}
        <div
          style={{
            padding: "10px",
            borderRadius: "10px",
            background: "rgba(179, 136, 255, 0.05)",
            border: "1px solid rgba(179, 136, 255, 0.2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "0.65rem", color: "#B388FF", fontWeight: 900 }}>
              🍄 MUSHROOM BODY & CONDUCTA
            </span>
            <span style={{
              fontSize: "0.58rem",
              padding: "1px 5px",
              borderRadius: "4px",
              fontWeight: 800,
              background: mbTelemetry.behavioralDrive === 'APPROACH' ? 'rgba(0, 230, 118, 0.2)' : mbTelemetry.behavioralDrive === 'AVOID' ? 'rgba(255, 51, 85, 0.2)' : 'rgba(148, 163, 184, 0.2)',
              color: mbTelemetry.behavioralDrive === 'APPROACH' ? '#00E676' : mbTelemetry.behavioralDrive === 'AVOID' ? '#FF3355' : '#94A3B8',
              border: `1px solid ${mbTelemetry.behavioralDrive === 'APPROACH' ? '#00E676' : mbTelemetry.behavioralDrive === 'AVOID' ? '#FF3355' : 'rgba(148, 163, 184, 0.3)'}`,
            }}>
              {mbTelemetry.behavioralDrive}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 800 }}>
            <span style={{ color: "#94A3B8" }}>KCs Activas:</span>
            <span style={{ color: "#B388FF" }}>{mbTelemetry.activeKenyonCellsLastStimulus} / 2500 (5%)</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Feromonas Enjambre:</span>
            <span style={{ color: "#FFD600" }}>{mbTelemetry.activePheromonesCount} activas</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>LTP Pinned:</span>
            <span style={{ color: "#00E676" }}>{mbTelemetry.ltpPinnedRecords} Paquetes SOS</span>
          </div>
          <button
            onClick={() => setIsPheromoneModalOpen(true)}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "5px 8px",
              borderRadius: "6px",
              background: "rgba(179, 136, 255, 0.15)",
              border: "1px solid rgba(179, 136, 255, 0.4)",
              color: "#B388FF",
              fontWeight: 800,
              fontSize: "0.66rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
          >
            <span>🍄</span>
            <span>EMITIR FEROMONA SWARM</span>
          </button>
        </div>

        {/* Card 6: Giant Fiber System & fly-swing */}
        <div
          style={{
            padding: "10px",
            borderRadius: "10px",
            background: gfsTelemetry.emconLockActive ? "rgba(255, 51, 85, 0.1)" : "rgba(255, 145, 0, 0.05)",
            border: `1px solid ${gfsTelemetry.emconLockActive ? "#FF3355" : "rgba(255, 145, 0, 0.2)"}`,
          }}
        >
          <div style={{ fontSize: "0.65rem", color: gfsTelemetry.emconLockActive ? "#FF3355" : "#FF9100", fontWeight: 900, marginBottom: "4px" }}>
            ⚡ GIANT FIBER REFLEX (fly-swing)
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 800 }}>
            <span style={{ color: "#94A3B8" }}>Circuito:</span>
            <span style={{ color: "#FF9100" }}>LC4+LPLC2 → DNp01</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Body IDs:</span>
            <span style={{ color: "#00E5FF" }}>DNp01 [#10001] | LC4 [#10042]</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Latencia Refleja:</span>
            <span style={{ color: gfsTelemetry.emconLockActive ? "#FF3355" : "#00E676" }}>&lt; 15 ms (Conexinas)</span>
          </div>
        </div>

        {/* Card 5: Optic Lobes T4/T5 & Looming LC4 */}
        <div
          style={{
            padding: "10px",
            borderRadius: "10px",
            background: opticTelemetry.loomingThreat.isThreatDetected ? "rgba(255, 51, 85, 0.15)" : "rgba(0, 229, 255, 0.05)",
            border: `1px solid ${opticTelemetry.loomingThreat.isThreatDetected ? '#FF3355' : 'rgba(0, 229, 255, 0.25)'}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.65rem", color: opticTelemetry.loomingThreat.isThreatDetected ? '#FF3355' : '#00E5FF', fontWeight: 900 }}>
              👁️ LÓBULOS ÓPTICOS (T4/T5 &amp; LC4)
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{
                fontSize: "0.58rem",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 900,
                background: opticTelemetry.loomingThreat.isThreatDetected ? '#FF3355' : '#00E5FF',
                color: '#000000',
              }}>
                {opticTelemetry.loomingThreat.isThreatDetected ? '🚨 LOOMING' : 'DESPEJADO'}
              </span>
              <button
                onClick={isCameraActive ? stopCamera : startCamera}
                style={{
                  fontSize: "0.58rem",
                  padding: "2px 7px",
                  borderRadius: "4px",
                  fontWeight: 900,
                  background: isCameraActive ? "#FF3355" : "#00E5FF",
                  border: "none",
                  color: "#000",
                  cursor: "pointer"
                }}
              >
                {isCameraActive ? "APAGAR" : "CÁMARA"}
              </button>
            </div>
          </div>

          {/* Omatidios Compound Eye 16x16 Visual Matrix */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "6px" }}>
            <div style={{
              width: "64px", height: "64px",
              display: "grid", gridTemplateColumns: "repeat(16, 1fr)",
              background: "#000", border: "1px solid rgba(0, 229, 255, 0.4)",
              borderRadius: "4px", overflow: "hidden", flexShrink: 0
            }}>
              {ommatidiaPixels.map((val, idx) => {
                const brightness = Math.round(val * 255);
                return (
                  <div
                    key={idx}
                    style={{
                      width: "100%", height: "100%",
                      backgroundColor: opticTelemetry.loomingThreat.isThreatDetected
                        ? `rgb(${brightness}, 0, 0)`
                        : `rgb(0, ${brightness}, ${brightness})`
                    }}
                  />
                );
              })}
            </div>
            <div style={{ flex: 1, fontSize: "0.64rem", display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94A3B8" }}>Estado:</span>
                <span style={{ color: isCameraActive ? "#00E676" : "#64748B", fontWeight: 800 }}>
                  {isCameraActive ? `ACTIVO (${opticTelemetry.fpsProcessed} FPS)` : "STANDBY"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94A3B8" }}>Flujo HS/VS:</span>
                <span style={{ color: "#00E5FF" }}>
                  {opticTelemetry.hsHorizontalMotion.toFixed(2)} / {opticTelemetry.vsVerticalMotion.toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94A3B8" }}>Vías ON/OFF:</span>
                <span style={{ color: "#76FF03" }}>
                  T4: {opticTelemetry.t4OnMotionMagnitude.toFixed(2)} | T5: {opticTelemetry.t5OffMotionMagnitude.toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94A3B8" }}>Odometría:</span>
                <span style={{ color: "#FFD600" }}>{opticTelemetry.visualOdometryDistanceMeters.toFixed(1)} m</span>
              </div>
            </div>
          </div>

          {/* Hidden video element for camera stream ingestion */}
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ display: "none" }}
          />

          {opticTelemetry.loomingThreat.isThreatDetected && (
            <div style={{
              background: "rgba(255, 51, 85, 0.25)",
              border: "1px solid #FF3355",
              borderRadius: "4px",
              padding: "4px 8px",
              marginTop: "4px",
              fontSize: "0.62rem",
              color: "#FFF",
              fontWeight: 800,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span>🚨 AMENAZA DE COLISIÓN (LC4/LPLC2)</span>
              <span>TTC: {opticTelemetry.loomingThreat.estimatedTtcMs.toFixed(0)} ms</span>
            </div>
          )}
        </div>

        {/* Card 6: Tactical Motor Actuators DNa01/02 & Haptics */}
        <div
          style={{
            padding: "10px",
            borderRadius: "10px",
            background: "rgba(255, 179, 0, 0.05)",
            border: "1px solid rgba(255, 179, 0, 0.25)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "0.65rem", color: "#FFB300", fontWeight: 900 }}>
              📳 ACTUADOR MOTOR (DNa01/02)
            </span>
            <span style={{
              fontSize: "0.58rem",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: 900,
              background: motorTelemetry.currentHapticMode === 'EMERGENCY' ? '#FF3355' : motorTelemetry.currentHapticMode === 'ALIGNED' ? '#00E676' : '#FFB300',
              color: '#000000',
            }}>
              {motorTelemetry.currentHapticMode}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 800 }}>
            <span style={{ color: "#94A3B8" }}>Error Timoneo:</span>
            <span style={{ color: Math.abs(motorTelemetry.steeringErrorDeg) <= 15 ? '#00E676' : '#FFB300' }}>
              {motorTelemetry.steeringErrorDeg > 0 ? `+${motorTelemetry.steeringErrorDeg}° ESTRIBOR` : `${motorTelemetry.steeringErrorDeg}° BABOR`}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Excitación DNa:</span>
            <span style={{ color: "#FFB300" }}>DNa01: {motorTelemetry.dna01IpsilateralExcitation} | DNa02: {motorTelemetry.dna02ContralateralExcitation}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Pulsos Hápticos:</span>
            <span style={{ color: "#00E5FF" }}>{motorTelemetry.totalPulsesDispatched} despachados</span>
          </div>
          <button
            onClick={() => setIsHapticModalOpen(true)}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "5px 8px",
              borderRadius: "6px",
              background: "rgba(255, 179, 0, 0.15)",
              border: "1px solid rgba(255, 179, 0, 0.4)",
              color: "#FFB300",
              fontWeight: 800,
              fontSize: "0.66rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
          >
            <span>📳</span>
            <span>ABRIR GUÍA HÁPTICA EYES-FREE</span>
          </button>
        </div>

        {/* Card: Lazo Sensoriomotor Biocibernético Drosophila Connectome ↔ Hábitat Físico */}
        <div
          style={{
            gridColumn: "1 / -1",
            padding: "12px",
            borderRadius: "10px",
            background: isBridgeActive ? "rgba(0, 255, 136, 0.06)" : "rgba(255, 179, 0, 0.05)",
            border: `1px solid ${isBridgeActive ? "rgba(0, 255, 136, 0.35)" : "rgba(255, 179, 0, 0.25)"}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "0.72rem", color: isBridgeActive ? "#00FF88" : "#FFB300", fontWeight: 900 }}>
                🧬 LAZO BIOCIBERNÉTICO (CEREBRO MALECNS ↔ HÁBITAT FÍSICO)
              </span>
              <span style={{
                fontSize: "0.55rem",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 900,
                background: isBridgeActive ? "rgba(0, 255, 136, 0.2)" : "rgba(255, 179, 0, 0.2)",
                color: isBridgeActive ? "#00FF88" : "#FFB300",
                border: `1px solid ${isBridgeActive ? "#00FF88" : "#FFB300"}`,
              }}>
                {isBridgeActive ? "LAZO CERRADO (60 Hz)" : "DISOCIADO"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  if (isBridgeActive) {
                    connectomeBioBridge.stopConnectome();
                    setIsBridgeActive(false);
                    toast.warning("Lazo cerrado pausado: mosca en piloto autónomo");
                  } else {
                    connectomeBioBridge.startConnectome();
                    setIsBridgeActive(true);
                    toast.success("Lazo cerrado activado: MaleCNS comanda cinemática");
                  }
                }}
                style={{
                  fontSize: "0.58rem",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontWeight: 900,
                  background: isBridgeActive ? "rgba(255, 51, 85, 0.2)" : "rgba(0, 255, 136, 0.2)",
                  border: `1px solid ${isBridgeActive ? "#FF3355" : "#00FF88"}`,
                  color: isBridgeActive ? "#FF3355" : "#00FF88",
                  cursor: "pointer",
                }}
              >
                {isBridgeActive ? "⏸ DESACOPLAR" : "▶ ACOPLAR LAZO"}
              </button>

              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  setIsHabitatOpen(true);
                }}
                style={{
                  fontSize: "0.58rem",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontWeight: 900,
                  background: "rgba(0, 240, 255, 0.2)",
                  border: "1px solid #00F0FF",
                  color: "#00F0FF",
                  cursor: "pointer",
                }}
              >
                🌿 ARENA HÁBITAT ↗
              </button>
            </div>
          </div>

          {/* Grid de telemetría comparativa e indicadores bio-sensoriales */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
            {/* Panel Izquierdo: Vías Aferentes (Mundo Físico → Sentidos) */}
            <div style={{
              background: "rgba(0, 0, 0, 0.4)",
              borderRadius: "6px",
              padding: "8px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}>
              <div style={{ fontSize: "0.62rem", color: "#00E5FF", fontWeight: 900, marginBottom: "4px" }}>
                📥 VÍAS AFERENTES (HÁBITAT → SENTIDOS)
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem" }}>
                <span style={{ color: "#94A3B8" }}>Quimio-nutrición (JO-CE):</span>
                <span style={{ color: "#00E676" }}>{(habitatTelemetry.leaderGlucose * 100).toFixed(0)}% glucosa</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
                <span style={{ color: "#94A3B8" }}>Energía Acústica / Viento:</span>
                <span style={{ color: joTelemetry.acousticEnergyLevel > 0.4 ? "#FFB300" : "#00E5FF" }}>
                  {(joTelemetry.acousticEnergyLevel * 100).toFixed(0)}% ({joTelemetry.vibrationFrequencyHz} Hz)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
                <span style={{ color: "#94A3B8" }}>Detector Looming (LC4/LPLC2):</span>
                <span style={{ color: opticTelemetry.loomingThreat.isThreatDetected ? "#FF3355" : "#64748B", fontWeight: 800 }}>
                  {opticTelemetry.loomingThreat.isThreatDetected ? "🚨 AMENAZA EN PROXIMIDAD" : "Ópticamente despejado"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
                <span style={{ color: "#94A3B8" }}>Combustible Celular (ATP):</span>
                <span style={{ color: habitatTelemetry.leaderAtp > 0.6 ? "#00FF88" : "#FF3355", fontWeight: 800 }}>
                  {(habitatTelemetry.leaderAtp * 100).toFixed(0)}% ATP líder
                </span>
              </div>
            </div>

            {/* Panel Derecho: Vías Eferentes (Cerebro → Cinemática Física) */}
            <div style={{
              background: "rgba(0, 0, 0, 0.4)",
              borderRadius: "6px",
              padding: "8px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}>
              <div style={{ fontSize: "0.62rem", color: "#FFD600", fontWeight: 900, marginBottom: "4px" }}>
                📤 VÍAS EFERENTES (CEREBRO → CINEMÁTICA)
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem" }}>
                <span style={{ color: "#94A3B8" }}>Rumbo E-PG vs Físico:</span>
                <span style={{ color: "#FFD600", fontWeight: 800 }}>
                  {cxTelemetry.headingDeg}° E-PG ➔ {(() => {
                    const l = biocyberneticHabitat.getLeader();
                    return l ? `${Math.round(((l.headingRad * 180) / Math.PI + 360) % 360)}°` : `${cxTelemetry.headingDeg}°`;
                  })()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
                <span style={{ color: "#94A3B8" }}>Marcha CPG &amp; Velocidad:</span>
                <span style={{ color: "#00E5FF" }}>
                  {cpgTelemetry.gaitMode} ({cpgTelemetry.meanFrequencyHz.toFixed(1)} Hz)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
                <span style={{ color: "#94A3B8" }}>Arco Reflejo Giant Fiber:</span>
                <span style={{ color: gfsTelemetry.isReflexActive ? "#FF3355" : "#00E676", fontWeight: 800 }}>
                  {gfsTelemetry.isReflexActive ? "⚡ ESCAPE EVASIVO ACTIVO" : "Latente (<15ms)"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
                <span style={{ color: "#94A3B8" }}>Estado Motor Activo:</span>
                <span style={{ color: "#B388FF", fontWeight: 800 }}>
                  {habitatTelemetry.leaderState}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Radiogoniometría Bio-Inercial AoA (Direction-Finding) */}
        <div
          style={{
            gridColumn: "1 / -1",
            padding: "10px",
            borderRadius: "10px",
            background: "rgba(224, 64, 251, 0.06)",
            border: "1px solid rgba(224, 64, 251, 0.25)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "0.65rem", color: "#E040FB", fontWeight: 900 }}>
              📡 RADIOGONIOMETRÍA BIO-INERCIAL AoA (16 SECTORES)
            </span>
            <span style={{ fontSize: "0.62rem", color: "#94A3B8" }}>
              {rfBearings.length} marcación(es) activa(s)
            </span>
          </div>

          {rfBearings.length === 0 ? (
            <div style={{ fontSize: "0.68rem", color: "#64748B", fontStyle: "italic", padding: "4px 0" }}>
              Rotar el dispositivo en 360° para muestrear la modulación RF (LQS/RSSI) de los pares en radio.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
              {rfBearings.slice(0, 3).map((b) => (
                <div
                  key={b.peerId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    background: "rgba(0, 0, 0, 0.4)",
                    fontSize: "0.68rem",
                  }}
                >
                  <span style={{ color: "#FFFFFF", fontFamily: "monospace" }}>
                    Nodo {b.peerId.slice(0, 8)}...
                  </span>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span style={{ color: "#E040FB", fontWeight: 800 }}>
                      🧭 {b.bearingDeg}°
                    </span>
                    <span style={{ color: "#00E676" }}>
                      Conf: {(b.confidence * 100).toFixed(0)}%
                    </span>
                    <span style={{ color: "#94A3B8", fontSize: "0.62rem" }}>
                      LQS {b.lqs}% ({b.samplesCount} pkts)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Barra de Control Optogenético & Dinámica LIF */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: "rgba(0, 15, 30, 0.9)",
          borderTop: "1px solid rgba(0, 229, 255, 0.2)",
          fontSize: "0.7rem",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ color: "#94A3B8" }}>Potencial LIF:</span>
          <span style={{ color: synapticTelemetry.lifMembranePotentialMv >= -55 ? "#FFD600" : "#00E5FF", fontWeight: 900 }}>
            {synapticTelemetry.lifMembranePotentialMv} mV
          </span>
          <span style={{ fontSize: "0.62rem", color: "#64748B" }}>
            ({synapticTelemetry.lifAccumulatedCount} paquetes cola)
          </span>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => {
              TacticalAudioEngine.playTap();
              synapticMeshRouter.optogeneticStimulate("repeater_probe", 3, 10);
              setOptogeneticFeedback("⚡ Pulsos ChR2 10Hz inyectados");
              setTimeout(() => setOptogeneticFeedback(null), 3000);
            }}
            style={{
              padding: "3px 8px",
              borderRadius: "6px",
              background: "rgba(0, 230, 118, 0.2)",
              border: "1px solid #00E676",
              color: "#00E676",
              fontSize: "0.62rem",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ⚡ ESTIMULAR (ChR2 10Hz)
          </button>

          <button
            onClick={() => {
              TacticalAudioEngine.playWarning();
              if (synapticTelemetry.optogeneticallySilencedPeers.length > 0) {
                synapticMeshRouter.optogeneticRestore(synapticTelemetry.optogeneticallySilencedPeers[0]);
                setOptogeneticFeedback("🔄 Cuarentena optogenética levantada");
              } else {
                synapticMeshRouter.optogeneticSilence("anomalous_rf_peer", "OPERATOR_COMMAND");
                setOptogeneticFeedback("🔇 Silenciamiento NpHR aplicado");
              }
              setTimeout(() => setOptogeneticFeedback(null), 3000);
            }}
            style={{
              padding: "3px 8px",
              borderRadius: "6px",
              background: synapticTelemetry.optogeneticallySilencedPeers.length > 0 ? "rgba(255, 179, 0, 0.2)" : "rgba(255, 51, 85, 0.2)",
              border: `1px solid ${synapticTelemetry.optogeneticallySilencedPeers.length > 0 ? "#FFB300" : "#FF3355"}`,
              color: synapticTelemetry.optogeneticallySilencedPeers.length > 0 ? "#FFB300" : "#FF3355",
              fontSize: "0.62rem",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {synapticTelemetry.optogeneticallySilencedPeers.length > 0
              ? `🔄 RESTAURAR (${synapticTelemetry.optogeneticallySilencedPeers.length})`
              : "🔇 SILENCIAR NpHR"}
          </button>
        </div>

        {optogeneticFeedback && (
          <div style={{ width: "100%", textAlign: "center", fontSize: "0.65rem", color: "#FFD600", fontWeight: 700 }}>
            {optogeneticFeedback}
          </div>
        )}
      </div>

      {/* Modal de Atribución Obligatoria y Procedencia Científica */}
      {showAttributionModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
          onClick={() => setShowAttributionModal(false)}
        >
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              background: "#0A0F1D",
              border: "1px solid rgba(0, 229, 255, 0.4)",
              borderRadius: "14px",
              padding: "20px",
              color: "#E2E8F0",
              boxShadow: "0 10px 40px rgba(0, 229, 255, 0.2)",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                📜 ATRIBUCIÓN CIENTÍFICA & PROCEDENCIA CONECTÓMICA
              </div>
              <button
                onClick={() => setShowAttributionModal(false)}
                style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: "0.75rem", lineHeight: 1.5, color: "#CBD5E1", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <strong style={{ color: "#00E5FF" }}>1. MaleCNS v1.0 & Template:</strong>
                <div>Basado en los datasets y modelos de anatomía de <em>Drosophila melanogaster</em> desarrollados por <strong>Milos Cobanov</strong> (<a href="https://github.com/cobanov/fly-connectome-template" target="_blank" rel="noreferrer" style={{ color: "#38BDF8" }}>cobanov/fly-connectome-template</a>) y Janelia Research Campus (Cell, Septiembre 2026). Licencia source-available con atribución obligatoria en UI y repositorio.</div>
              </div>

              <div>
                <strong style={{ color: "#76FF03" }}>2. Estadísticas de Red FlyWire:</strong>
                <div>Métricas de topología (reciprocidad $r$, small-world $\sigma$, y motivos triádicos) derivadas de las investigaciones del <strong>Mala Murthy Lab (Princeton University)</strong> (<a href="https://github.com/murthylab/flywire-network-analysis" target="_blank" rel="noreferrer" style={{ color: "#38BDF8" }}>murthylab/flywire-network-analysis</a> / Nature 2024).</div>
              </div>

              <div>
                <strong style={{ color: "#FFD600" }}>3. Awesome Fly & The Fly's Table:</strong>
                <div>Arquitectura sináptica de células de Kenyon (2,500 KC), neuronas dopaminérgicas (332 DAN PAM/PPL1), proyección (682 PN) y circuito de escape monosináptico <code>fly-swing</code> (LC4 #10042, LPLC2 #10043 → DNp01 #10001) compilados por <strong>Milos Cobanov</strong> (<a href="https://github.com/cobanov/awesome-fly" target="_blank" rel="noreferrer" style={{ color: "#38BDF8" }}>cobanov/awesome-fly</a>).</div>
              </div>

              <div>
                <strong style={{ color: "#E040FB" }}>4. Emulación SNN & Optogenética:</strong>
                <div>Dinámicas Leaky Integrate-and-Fire (LIF) y protocolos de silenciamiento/activación optogenética inspirados en la plataforma de emulación neuromórfica de <strong>Eon Systems PBC</strong> (<a href="https://github.com/eonsystemspbc/fly-brain" target="_blank" rel="noreferrer" style={{ color: "#38BDF8" }}>eonsystemspbc/fly-brain</a>).</div>
              </div>

              <div style={{ marginTop: "8px", padding: "8px", background: "rgba(0, 229, 255, 0.05)", borderRadius: "8px", border: "1px solid rgba(0, 229, 255, 0.2)", fontSize: "0.68rem", color: "#94A3B8" }}>
                🛡️ RED Sovereign Mesh OS integra estos modelos exclusivamente para resiliencia matemática, compresión de tráfico por eventos y supervivencia de comunicaciones tácticas off-grid.
              </div>
            </div>

            <div style={{ marginTop: "16px", textAlign: "right" }}>
              <button
                onClick={() => setShowAttributionModal(false)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "8px",
                  background: "#00E5FF",
                  color: "#000000",
                  fontWeight: 900,
                  fontSize: "0.75rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      ) : architectureMode === "HUMAN_NEOCORTEX" ? (
        /* VISTA DE NEOCORTEZA HUMANA (7 NÚCLEOS COGNITIVOS) */
        <div
          className="scroll-container"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            background: "#050811"
          }}
        >
          {/* Banner de Estado Cortical Unificado */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              background: humanSnapshot.alertLevel === "RED_CRITICAL" ? "rgba(239, 68, 68, 0.2)" : humanSnapshot.alertLevel === "AMBER_ATTENTION" ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.15)",
              border: `1px solid ${humanSnapshot.alertLevel === "RED_CRITICAL" ? "#EF4444" : humanSnapshot.alertLevel === "AMBER_ATTENTION" ? "#F59E0B" : "#10B981"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "monospace",
            }}
          >
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#FFFFFF" }}>
                {humanSnapshot.synthesisSummary}
              </div>
              <div style={{ fontSize: "0.65rem", color: "#94A3B8", marginTop: "2px" }}>
                ARQUITECTURA BIO-CIBERNÉTICA INTEGRADA • CERO SIMULACIONES • SENSORES DIRECTOS
              </div>
            </div>
            <span
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "0.68rem",
                fontWeight: 900,
                background: humanSnapshot.alertLevel === "RED_CRITICAL" ? "#EF4444" : humanSnapshot.alertLevel === "AMBER_ATTENTION" ? "#F59E0B" : "#10B981",
                color: "#000000",
              }}
            >
              {humanSnapshot.alertLevel}
            </span>
          </div>

          {/* Grilla Táctica de los 7 Núcleos Neocorticales */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px", fontFamily: "monospace" }}>
            
            {/* 1. Corteza Entorrinal */}
            <div style={{ background: "#090D16", border: "1px solid #1E293B", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#38BDF8" }}>🗺️ CORTEZA ENTORRINAL (MEC)</span>
                <span style={{ fontSize: "0.65rem", color: "#94A3B8" }}>λ = [0.5, 2, 8, 32]m</span>
              </div>
              <div style={{ fontSize: "0.70rem", color: "#E2E8F0" }}>
                Offset Local: [{humanSnapshot.entorhinal.currentCoordsLocal.xMeters.toFixed(1)}, {humanSnapshot.entorhinal.currentCoordsLocal.yMeters.toFixed(1)}, {humanSnapshot.entorhinal.currentCoordsLocal.zMeters.toFixed(1)}]m
              </div>
              <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>
                Actividad de Rejilla: {Math.round(humanSnapshot.entorhinal.compositeGridActivity * 100)}% • Hitos: {humanSnapshot.entorhinal.breadcrumbsCount}
              </div>
              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  setIsCognitiveNavOpen(true);
                }}
                style={{ padding: "6px", background: "#0284C7", border: "none", borderRadius: "4px", color: "#FFF", fontSize: "0.70rem", fontWeight: 700, cursor: "pointer" }}
              >
                ABRIR NAVEGACIÓN ENTORRINAL
              </button>
            </div>

            {/* 2. Hipocampo CA3/DG */}
            <div style={{ background: "#090D16", border: "1px solid #1E293B", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#A855F7" }}>🧬 HIPOCAMPO (CA3/DG)</span>
                <span style={{ fontSize: "0.65rem", color: "#10B981" }}>PATTERN COMPLETION</span>
              </div>
              <div style={{ fontSize: "0.70rem", color: "#E2E8F0" }}>
                Tramas LoRa Reconstruidas: <span style={{ color: "#A855F7", fontWeight: 800 }}>{humanSnapshot.hippocampal.patternCompletionsCount}</span>
              </div>
              <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>
                Confianza de Recuerdo: {Math.round(humanSnapshot.hippocampal.meanRecallConfidence * 100)}% • Engramas CA3: {humanSnapshot.hippocampal.totalStoredEngrams}
              </div>
              <div style={{ fontSize: "0.65rem", color: "#64748B" }}>
                Reconstrucción instantánea de paquetes dañados sin retransmisión RF.
              </div>
              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  setIsHippocampalMemoryOpen(true);
                }}
                style={{ padding: "6px", background: "#7C3AED", border: "none", borderRadius: "4px", color: "#FFF", fontSize: "0.70rem", fontWeight: 700, cursor: "pointer" }}
              >
                ABRIR INSPECTOR EPISÓDICO CA3
              </button>
            </div>

            {/* 3. Corteza Predictiva */}
            <div style={{ background: "#090D16", border: "1px solid #1E293B", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#10B981" }}>⚡ CORTEZA PREDICTIVA (FRISTON)</span>
                <span style={{ fontSize: "0.65rem", color: humanSnapshot.predictive.isZeroBandwidthModeActive ? "#10B981" : "#EF4444" }}>
                  {humanSnapshot.predictive.isZeroBandwidthModeActive ? "SILENCIO RF ACTIVO" : "NORMAL"}
                </span>
              </div>
              <div style={{ fontSize: "0.70rem", color: "#E2E8F0" }}>
                Reducción de Tráfico RF: <span style={{ color: "#10B981", fontWeight: 800 }}>{Math.round(humanSnapshot.predictive.overallBandwidthReductionPct)}%</span>
              </div>
              <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>
                Energía Libre (Sorpresa): {humanSnapshot.predictive.currentFreeEnergy.toFixed(3)} • Pares Seguidos: {humanSnapshot.predictive.trackedPeersCount}
              </div>
              <div style={{ fontSize: "0.65rem", color: "#64748B" }}>
                Emisión de radio suprimida (0 bytes) mientras el movimiento sea predecible.
              </div>
              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  const nextState = !humanSnapshot.predictive.isZeroBandwidthModeActive;
                  predictiveCortex.setZeroBandwidthMode(nextState);
                  toast.info(nextState ? "⚡ Modo Silencio RF Activo (Transmisión 0-Bytes)" : "⚡ Modo RF Continuo Restaurado");
                }}
                style={{
                  padding: "6px",
                  background: humanSnapshot.predictive.isZeroBandwidthModeActive ? "#065F46" : "#1E293B",
                  border: "1px solid #10B981",
                  borderRadius: "4px",
                  color: "#10B981",
                  fontSize: "0.70rem",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                {humanSnapshot.predictive.isZeroBandwidthModeActive ? "DESACTIVAR SILENCIO RF" : "ACTIVAR SILENCIO RF (0-BYTES)"}
              </button>
            </div>

            {/* 4. Teoría de la Mente */}
            <div style={{ background: "#090D16", border: "1px solid #1E293B", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#F59E0B" }}>🛡️ TEORÍA DE LA MENTE (mPFC/TPJ)</span>
                <span style={{ fontSize: "0.65rem", color: humanSnapshot.theoryOfMind.activeAmbushAlertsCount > 0 ? "#EF4444" : "#10B981" }}>
                  {humanSnapshot.theoryOfMind.activeAmbushAlertsCount > 0 ? "¡EMBOSCADA!" : "RED SEGURA"}
                </span>
              </div>
              <div style={{ fontSize: "0.70rem", color: "#E2E8F0" }}>
                Confianza Media de Malla: {Math.round(humanSnapshot.theoryOfMind.meanNetworkTrustScore * 100)}% ({humanSnapshot.theoryOfMind.totalPeersAudited} pares)
              </div>
              <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>
                Anomalías RF (Path Loss) & Cinemáticas: {humanSnapshot.theoryOfMind.suspiciousNodesCount}
              </div>
              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  setIsEpistemicRadarOpen(true);
                }}
                style={{ padding: "6px", background: "#D97706", border: "none", borderRadius: "4px", color: "#FFF", fontSize: "0.70rem", fontWeight: 700, cursor: "pointer" }}
              >
                ABRIR RADAR EPISTÉMICO
              </button>
            </div>

            {/* 5. Memoria de Trabajo DLPFC */}
            <div style={{ background: "#090D16", border: "1px solid #1E293B", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#EC4899" }}>📋 MEMORIA EJECUTIVA (DLPFC 7±2)</span>
                <span style={{ fontSize: "0.65rem", color: "#EC4899" }}>PROGRESO: {humanSnapshot.workingMemory.overallProgressPct}%</span>
              </div>
              <div style={{ fontSize: "0.70rem", color: "#E2E8F0", fontWeight: 700 }}>
                Directiva Activa: {humanSnapshot.workingMemory.activeTask?.title || "Misión Cumplida"}
              </div>
              <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>
                Pila Ejecutiva: {humanSnapshot.workingMemory.completedTasksCount} / {humanSnapshot.workingMemory.totalTasks} tareas cumplidas
              </div>
              <div style={{ fontSize: "0.65rem", color: "#64748B" }}>
                Transición automática por sensores de proximidad inercial y canales de radio.
              </div>
            </div>

            {/* 6. Ínsula Anterior & TCCC */}
            <div style={{ background: "#090D16", border: "1px solid #1E293B", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#EF4444" }}>🩸 ÍNSULA ANTERIOR & TCCC</span>
                <span style={{ fontSize: "0.65rem", color: humanSnapshot.insular.isBoxBreathingActive ? "#06B6D4" : "#94A3B8" }}>
                  {humanSnapshot.insular.isBoxBreathingActive ? "BOX BREATHING" : "STANDBY"}
                </span>
              </div>
              <div style={{ fontSize: "0.70rem", color: "#E2E8F0" }}>
                Bajas MARCH: {humanSnapshot.insular.activeCasualtiesCount} • Torniquetes Activos: {humanSnapshot.insular.activeTourniquetsCount}
              </div>
              <div style={{ fontSize: "0.65rem", color: humanSnapshot.insular.criticalTourniquetWarning ? "#EF4444" : "#94A3B8", fontWeight: humanSnapshot.insular.criticalTourniquetWarning ? 800 : 400 }}>
                {humanSnapshot.insular.criticalTourniquetWarning ? "⚠️ ¡ALERTA DE ISQUEMIA PROLONGADA (>90m)!" : "Cronómetros de isquemia nominales"}
              </div>
              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  setIsTcccModalOpen(true);
                }}
                style={{ padding: "6px", background: "#DC2626", border: "none", borderRadius: "4px", color: "#FFF", fontSize: "0.70rem", fontWeight: 700, cursor: "pointer" }}
              >
                ABRIR PROTOCOLO TCCC MARCH
              </button>
            </div>

            {/* 7. Corteza Orbitofrontal */}
            <div style={{ background: "#090D16", border: "1px solid #1E293B", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#14B8A6" }}>⚖️ CORTEZA ORBITOFRONTAL (OFC)</span>
                <span style={{ fontSize: "0.65rem", color: "#14B8A6" }}>ECONOMÍA DE ASIEDO</span>
              </div>
              <div style={{ fontSize: "0.70rem", color: "#E2E8F0" }}>
                Autarquía Estimada: <span style={{ color: "#14B8A6", fontWeight: 800 }}>{humanSnapshot.orbitofrontal.autarkyDaysRemaining} días</span>
              </div>
              <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>
                Contratos Barter Activos: {humanSnapshot.orbitofrontal.activeContractsCount} • Paridades de Trueque Justo
              </div>
              <div style={{ fontSize: "0.65rem", color: "#64748B" }}>
                Valoración no-fiduciaria de agua, raciones, munición, antibióticos y baterías.
              </div>
              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  setIsOfcBarterOpen(true);
                }}
                style={{ padding: "6px", background: "#0D9488", border: "none", borderRadius: "4px", color: "#FFF", fontSize: "0.70rem", fontWeight: 700, cursor: "pointer" }}
              >
                ABRIR MERCADO DE TRUEQUE OFC
              </button>
            </div>

          </div>
        </div>
      ) : (
        /* VISTA DE ESPACIO DE TRABAJO GLOBAL & ENJAMBRE BIO-CIBERNÉTICO (GNWT) */
        <div
          className="scroll-container"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            background: "#050811",
            fontFamily: "monospace"
          }}
        >
          {/* Banner de Ignición Atencional GNWT */}
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "8px",
              background: consciousnessTelemetry.isIgnited ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.15)",
              border: `1px solid ${consciousnessTelemetry.isIgnited ? "#EF4444" : "#10B981"}`,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 900, color: consciousnessTelemetry.isIgnited ? "#FCA5A5" : "#6EE7B7" }}>
                {consciousnessTelemetry.isIgnited ? "🔥 ESPACIO DE TRABAJO GLOBAL EN IGNICIÓN ATENCIONAL" : "🟢 ESPACIO DE TRABAJO GLOBAL EN VIGILIA NOMINAL"}
              </div>
              <div style={{ fontSize: "0.72rem", background: consciousnessTelemetry.isIgnited ? "rgba(239, 68, 68, 0.4)" : "rgba(16, 185, 129, 0.3)", padding: "2px 8px", borderRadius: "4px", color: "#FFF" }}>
                FOCO: {consciousnessTelemetry.consciousFocus}
              </div>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#FFFFFF", fontWeight: 700 }}>
              {consciousnessTelemetry.synthesisDirective}
            </div>
            {/* Barra de Intensidad de Ignición vs Umbral */}
            <div style={{ marginTop: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#94A3B8", marginBottom: "3px" }}>
                <span>Intensidad de Activación: {(consciousnessTelemetry.ignitionIntensity * 100).toFixed(0)}%</span>
                <span>Umbral de Ignición (θ_inhib): {(consciousnessTelemetry.inhibitoryThreshold * 100).toFixed(0)}%</span>
              </div>
              <div style={{ position: "relative", width: "100%", height: "8px", background: "#1E293B", borderRadius: "4px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(100, consciousnessTelemetry.ignitionIntensity * 100)}%`,
                    height: "100%",
                    background: consciousnessTelemetry.isIgnited ? "linear-gradient(90deg, #F59E0B, #EF4444)" : "#10B981",
                    transition: "width 0.2s ease",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `${consciousnessTelemetry.inhibitoryThreshold * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: "2px",
                    background: "#F59E0B",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Tablero de Métricas Bio-Cibernéticas Holísticas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
            <div style={{ padding: "10px", background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.65rem", color: "#F59E0B", fontWeight: 800 }}>INTEGRACIÓN Φ (IIT TONONI)</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#FFFFFF", marginTop: "4px" }}>
                {(consciousnessTelemetry.phiApprox * 10).toFixed(1)} <span style={{ fontSize: "0.70rem", color: "#94A3B8" }}>/ 10</span>
              </div>
              <div style={{ fontSize: "0.60rem", color: "#64748B", marginTop: "2px" }}>Sinergia cruzada MaleCNS + 7 Núcleos Neocorticales</div>
            </div>

            <div style={{ padding: "10px", background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.65rem", color: "#00E5FF", fontWeight: 800 }}>ENERGÍA LIBRE (FRISTON F)</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#FFFFFF", marginTop: "4px" }}>
                {consciousnessTelemetry.variationalFreeEnergy.toFixed(3)}
              </div>
              <div style={{ fontSize: "0.60rem", color: "#64748B", marginTop: "2px" }}>Divergencia sensorial / Minimización activa</div>
            </div>

            <div style={{ padding: "10px", background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.65rem", color: "#10B981", fontWeight: 800 }}>COHERENCIA KURAMOTO (R)</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#FFFFFF", marginTop: "4px" }}>
                {(consciousnessTelemetry.kuramotoOrderR * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: "0.60rem", color: "#64748B", marginTop: "2px" }}>Consenso de fase de colmena en malla LoRa</div>
            </div>

            <div style={{ padding: "10px", background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(168, 85, 247, 0.3)", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.65rem", color: "#A855F7", fontWeight: 800 }}>ÍNDICE CI (ROJAS ALIAGA)</div>
                <div style={{ fontSize: "0.55rem", color: "#C084FC", background: "rgba(168, 85, 247, 0.15)", padding: "1px 5px", borderRadius: "3px" }}>
                  4D Multi-Teoría
                </div>
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#FFFFFF", marginTop: "4px" }}>
                {((consciousnessTelemetry.ciScore ?? 0.5) * 10).toFixed(1)} <span style={{ fontSize: "0.70rem", color: "#94A3B8" }}>/ 10</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", marginTop: "6px", fontSize: "0.58rem" }}>
                <div style={{ background: "rgba(255,255,255,0.04)", padding: "2px 3px", borderRadius: "3px", textAlign: "center" }} title="Tononi Integrated Information Phi (IIT)">
                  <span style={{ color: "#38BDF8", fontWeight: 700 }}>Φ:</span> {((consciousnessTelemetry.phiIit ?? 0.42)).toFixed(2)}
                </div>
                <div style={{ background: "rgba(255,255,255,0.04)", padding: "2px 3px", borderRadius: "3px", textAlign: "center" }} title="Global Workspace Broadcast Coverage (Baars/Dehaene)">
                  <span style={{ color: "#34D399", fontWeight: 700 }}>GW:</span> {((consciousnessTelemetry.gwBroadcast ?? 0.60)).toFixed(2)}
                </div>
                <div style={{ background: "rgba(255,255,255,0.04)", padding: "2px 3px", borderRadius: "3px", textAlign: "center" }} title="Metzinger Sensorimotor Self-Model Accuracy">
                  <span style={{ color: "#FBBF24", fontWeight: 700 }}>Self:</span> {((consciousnessTelemetry.selfModelAccuracy ?? 0.85)).toFixed(2)}
                </div>
                <div style={{ background: "rgba(255,255,255,0.04)", padding: "2px 3px", borderRadius: "3px", textAlign: "center" }} title="Perturbational Complexity Index PCI (Massimini/Koch)">
                  <span style={{ color: "#F472B6", fontWeight: 700 }}>PCI:</span> {((consciousnessTelemetry.perturbationComplexity ?? 0.25)).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Módulo Neuromórfico AER: Micro-Espigas y Economía de Airtime RF */}
          <div style={{ padding: "12px", background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(52, 211, 153, 0.25)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#34D399", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>⚡ PROTOCOLO NEUROMÓRFICO AER (MICRO-ESPIGAS LPI/LPD)</span>
                <span style={{ fontSize: "0.55rem", background: "rgba(52, 211, 153, 0.15)", color: "#34D399", padding: "1px 6px", borderRadius: "4px" }}>
                  ~90% Airtime Ahorrado
                </span>
              </div>
              <button
                onClick={async () => {
                  TacticalAudioEngine.playTap();
                  await meshRouter.broadcastAerSpike(0x01 /* CX_COMPASS_HEADING */, 0, cxTelemetry.headingDeg);
                  toast.success(`Micro-espiga AER emitida: 14 bytes (Rumbo ${cxTelemetry.headingDeg}°)`);
                }}
                style={{
                  padding: "4px 10px",
                  background: "rgba(52, 211, 153, 0.15)",
                  border: "1px solid #34D399",
                  borderRadius: "4px",
                  color: "#34D399",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                DISPARAR ESPIGA AER (14B)
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", fontSize: "0.70rem" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "6px 8px", borderRadius: "6px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.60rem" }}>Espigas Emitidas / Recibidas</div>
                <div style={{ color: "#F8FAFC", fontWeight: 800, fontSize: "0.85rem", marginTop: "2px" }}>
                  {synapticTelemetry.aerSpikesEmittedCount ?? 0} <span style={{ color: "#64748B" }}>/</span> {synapticTelemetry.aerSpikesReceivedCount ?? 0}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "6px 8px", borderRadius: "6px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.60rem" }}>Espectro RF Ahorrado</div>
                <div style={{ color: "#34D399", fontWeight: 800, fontSize: "0.85rem", marginTop: "2px" }}>
                  {((synapticTelemetry.airtimeSavedBytesTotal ?? 0) / 1024).toFixed(2)} KB
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "6px 8px", borderRadius: "6px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.60rem" }}>Último Evento AER</div>
                <div style={{ color: "#38BDF8", fontWeight: 800, fontSize: "0.75rem", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {synapticTelemetry.lastAerSpike ? `Dom 0x0${synapticTelemetry.lastAerSpike.domain} · Val ${synapticTelemetry.lastAerSpike.value}` : "En Reposo (Quiescent)"}
                </div>
              </div>
            </div>
          </div>

          {/* Módulo CPG: Generador de Patrones Centrales y Marcha Trípode Hexápoda */}
          <div style={{ padding: "12px", background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#10B981", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🦗 CPG LOCOMOCIÓN HEXÁPODA (NEURO-MECH-FLY v2)</span>
                <span style={{ fontSize: "0.55rem", background: "rgba(16, 185, 129, 0.15)", color: "#10B981", padding: "1px 6px", borderRadius: "4px" }}>
                  {motorTelemetry.cpg?.gaitMode ?? "TRIPOD"} · {motorTelemetry.cpg?.meanFrequencyHz ?? 2.0} Hz
                </span>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  onClick={() => {
                    TacticalAudioEngine.playTap();
                    centralPatternGenerator.setObstacleContact('LF', true);
                    toast.warning("⚠️ Obstáculo inyectado en pata LF: Reflejo elevador activado (+60% fémur)");
                    setTimeout(() => centralPatternGenerator.setObstacleContact('LF', false), 900);
                  }}
                  style={{
                    padding: "4px 8px",
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid #F59E0B",
                    borderRadius: "4px",
                    color: "#F59E0B",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                  title="Simula colisión en vuelo para probar el reflejo elevador de sensilias campaniformes"
                >
                  OBSTÁCULO LF
                </button>
                <button
                  onClick={() => {
                    TacticalAudioEngine.playTap();
                    const frame = centralPatternGenerator.exportActuatorFrameBinary();
                    let hex = "";
                    for (let i = 0; i < frame.length; i++) {
                      hex += frame[i].toString(16).padStart(2, "0").toUpperCase() + " ";
                    }
                    toast.success(`Trama ESP32-S3 (12B): ${hex.trim()}`);
                  }}
                  style={{
                    padding: "4px 8px",
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid #10B981",
                    borderRadius: "4px",
                    color: "#10B981",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                  title="Genera trama binaria compacta con CRC8 para relés robóticos ESP32-S3"
                >
                  TRAMA ESP32 (12B)
                </button>
              </div>
            </div>

            {/* Métricas clave de marcha */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", fontSize: "0.68rem" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Coherencia Trípode (R)</div>
                <div style={{ color: (motorTelemetry.cpg?.tripodCoherenceIndex ?? 1.0) >= 0.85 ? "#10B981" : "#F59E0B", fontWeight: 800, fontSize: "0.80rem" }}>
                  {(((motorTelemetry.cpg?.tripodCoherenceIndex ?? 1.0)) * 100).toFixed(1)}%
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Velocidad / Sesgo</div>
                <div style={{ color: "#38BDF8", fontWeight: 800, fontSize: "0.80rem" }}>
                  {((motorTelemetry.cpg?.forwardSpeedNormalized ?? 0.5) * 100).toFixed(0)}% · {motorTelemetry.cpg?.steeringBias === 0 ? "CENTRO" : (motorTelemetry.cpg?.steeringBias ?? 0) < 0 ? "BABOR" : "ESTRIBOR"}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Ciclos de Zancada</div>
                <div style={{ color: "#F8FAFC", fontWeight: 800, fontSize: "0.80rem" }}>
                  {motorTelemetry.cpg?.totalGaitCycles ?? 0}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Reflejos Elevador/Búsqueda</div>
                <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: "0.80rem" }}>
                  {motorTelemetry.cpg?.elevatorReflexTriggerCount ?? 0} / {motorTelemetry.cpg?.searchingReflexTriggerCount ?? 0}
                </div>
              </div>
            </div>

            {/* Esquema Anatómico Hexápodo Top-Down de las 6 Patas */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 50px 1fr", gap: "6px", alignItems: "center", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px" }}>
              {/* Lado Izquierdo: LF, LM, LH */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {(['LF', 'LM', 'LH'] as const).map((legId) => {
                  const leg = motorTelemetry.cpg?.legs?.[legId];
                  const isStance = leg?.subPhase === 'STANCE';
                  const isElevator = leg?.elevatorReflexActive;
                  return (
                    <div
                      key={legId}
                      style={{
                        padding: "4px 6px",
                        background: isElevator ? "rgba(245, 158, 11, 0.2)" : isStance ? "rgba(16, 185, 129, 0.12)" : "rgba(0, 229, 255, 0.12)",
                        border: `1px solid ${isElevator ? '#F59E0B' : isStance ? 'rgba(16, 185, 129, 0.4)' : 'rgba(0, 229, 255, 0.4)'}`,
                        borderRadius: "4px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.62rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ fontWeight: 800, color: leg?.tripod === 'TRIPOD_A' ? '#A7F3D0' : '#BAE6FD' }}>{legId}</span>
                        <span style={{ fontSize: "0.52rem", color: "#64748B" }}>[{leg?.tripod === 'TRIPOD_A' ? 'Trípode A' : 'Trípode B'}]</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: isStance ? "#10B981" : "#00E5FF", fontWeight: 700 }}>
                          {isElevator ? "ELEVADOR" : isStance ? "APOYO" : "VUELO"}
                        </span>
                        <span style={{ color: "#94A3B8", fontFamily: "monospace" }}>
                          {((leg?.normalizedPhase ?? 0) * 360).toFixed(0)}°
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chasis Central Hexápodo */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", borderLeft: "1px dashed rgba(255,255,255,0.1)", borderRight: "1px dashed rgba(255,255,255,0.1)" }}>
                <div style={{ fontSize: "0.50rem", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px" }}>TORAX</div>
                <div style={{ fontSize: "0.9rem", color: "#10B981", margin: "2px 0" }}>▲</div>
                <div style={{ fontSize: "0.50rem", color: "#64748B" }}>VNC</div>
              </div>

              {/* Lado Derecho: RF, RM, RH */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {(['RF', 'RM', 'RH'] as const).map((legId) => {
                  const leg = motorTelemetry.cpg?.legs?.[legId];
                  const isStance = leg?.subPhase === 'STANCE';
                  const isElevator = leg?.elevatorReflexActive;
                  return (
                    <div
                      key={legId}
                      style={{
                        padding: "4px 6px",
                        background: isElevator ? "rgba(245, 158, 11, 0.2)" : isStance ? "rgba(16, 185, 129, 0.12)" : "rgba(0, 229, 255, 0.12)",
                        border: `1px solid ${isElevator ? '#F59E0B' : isStance ? 'rgba(16, 185, 129, 0.4)' : 'rgba(0, 229, 255, 0.4)'}`,
                        borderRadius: "4px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.62rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ fontWeight: 800, color: leg?.tripod === 'TRIPOD_A' ? '#A7F3D0' : '#BAE6FD' }}>{legId}</span>
                        <span style={{ fontSize: "0.52rem", color: "#64748B" }}>[{leg?.tripod === 'TRIPOD_A' ? 'Trípode A' : 'Trípode B'}]</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: isStance ? "#10B981" : "#00E5FF", fontWeight: 700 }}>
                          {isElevator ? "ELEVADOR" : isStance ? "APOYO" : "VUELO"}
                        </span>
                        <span style={{ color: "#94A3B8", fontFamily: "monospace" }}>
                          {((leg?.normalizedPhase ?? 0) * 360).toFixed(0)}°
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selectores de Régimen de Locomoción */}
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "0.60rem", color: "#94A3B8", marginRight: "4px" }}>RÉGIMEN:</span>
              {[
                { label: "PARADA", speed: 0.0 },
                { label: "PASO (1.5 Hz)", speed: 0.25 },
                { label: "MARCHA (2.5 Hz)", speed: 0.5 },
                { label: "TROTE (4.0 Hz)", speed: 1.0 },
              ].map((m) => (
                <button
                  key={m.label}
                  onClick={() => {
                    TacticalAudioEngine.playTap();
                    tacticalMotorActuator.setLocomotionSpeed(m.speed);
                  }}
                  style={{
                    padding: "3px 7px",
                    background: (motorTelemetry.cpg?.forwardSpeedNormalized ?? 0.5) === m.speed ? "rgba(16, 185, 129, 0.25)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${(motorTelemetry.cpg?.forwardSpeedNormalized ?? 0.5) === m.speed ? "#10B981" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: "3px",
                    color: (motorTelemetry.cpg?.forwardSpeedNormalized ?? 0.5) === m.speed ? "#10B981" : "#94A3B8",
                    fontSize: "0.60rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {m.label}
                </button>
              ))}
              <button
                onClick={() => {
                  TacticalAudioEngine.playAlarm();
                  tacticalMotorActuator.triggerEmergencyBurst();
                  toast.warning("🚨 Reflejo de Fibras Gigantes (GFS): Sprint de escape a 8.0 Hz activado");
                }}
                style={{
                  padding: "3px 7px",
                  background: "rgba(239, 68, 68, 0.2)",
                  border: "1px solid #EF4444",
                  borderRadius: "3px",
                  color: "#EF4444",
                  fontSize: "0.60rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  marginLeft: "auto",
                }}
              >
                ESCAPE GFS (8 Hz)
              </button>
            </div>
          </div>

          {/* Criticalidad Auto-Organizada (SOC sigma ~ 1.0 & neurolib) */}
          <div style={{ padding: "12px", background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.9rem" }}>🌐</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#10B981", letterSpacing: "0.5px" }}>
                  CRITICALIDAD AUTO-ORGANIZADA (SOC σ ≈ 1.0 & NEUROLIB)
                </span>
              </div>
              {/* Badge de Fase */}
              <div
                style={{
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  background:
                    criticalityTelemetry.criticalityState === 'CRITICAL'
                      ? "rgba(16, 185, 129, 0.2)"
                      : criticalityTelemetry.criticalityState === 'SUPER_CRITICAL'
                      ? "rgba(239, 68, 68, 0.2)"
                      : "rgba(56, 189, 248, 0.2)",
                  color:
                    criticalityTelemetry.criticalityState === 'CRITICAL'
                      ? "#10B981"
                      : criticalityTelemetry.criticalityState === 'SUPER_CRITICAL'
                      ? "#EF4444"
                      : "#38BDF8",
                  border: `1px solid ${
                    criticalityTelemetry.criticalityState === 'CRITICAL'
                      ? "#10B981"
                      : criticalityTelemetry.criticalityState === 'SUPER_CRITICAL'
                      ? "#EF4444"
                      : "#38BDF8"
                  }`,
                }}
              >
                {criticalityTelemetry.criticalityState === 'CRITICAL'
                  ? "CRÍTICO ÓPTIMO (σ ≈ 1.00)"
                  : criticalityTelemetry.criticalityState === 'SUPER_CRITICAL'
                  ? "SUPER-CRÍTICO (σ > 1.10) [TORMENTA]"
                  : "SUB-CRÍTICO (σ < 0.90) [HIPO-ACTIVIDAD]"}
              </div>
            </div>

            {/* Subtítulo dinámico explicativo */}
            <div style={{ fontSize: "0.62rem", color: "#94A3B8", lineHeight: 1.3 }}>
              {criticalityTelemetry.criticalityState === 'CRITICAL' && (
                <span style={{ color: "#A7F3D0" }}>
                  ✓ Estado de máxima capacidad de transmisión de Shannon. Avalanchas neuronales libres de escala P(S) ~ S^(-α).
                </span>
              )}
              {criticalityTelemetry.criticalityState === 'SUPER_CRITICAL' && (
                <span style={{ color: "#FCA5A5" }}>
                  ⚠ Ráfagas explosivas y riesgo de tormenta de difusión. Plasticidad homeostática deprimiendo P_relay automáticamente.
                </span>
              )}
              {criticalityTelemetry.criticalityState === 'SUB_CRITICAL' && (
                <span style={{ color: "#BAE6FD" }}>
                  ℹ Decaimiento exponencial de información. Auto-elevando P_relay hacia el atractor crítico.
                </span>
              )}
            </div>

            {/* Barra Visual de Branching Ratio sigma [0.0 .. 2.0] */}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.58rem", color: "#64748B" }}>
                <span>Sub-Crítico (0.0)</span>
                <span style={{ color: "#10B981", fontWeight: 700 }}>Crítico Óptimo (1.0)</span>
                <span>Super-Crítico (2.0+)</span>
              </div>
              <div style={{ height: "6px", width: "100%", background: "rgba(255,255,255,0.06)", borderRadius: "3px", position: "relative", overflow: "hidden" }}>
                {/* Zona Crítica [0.90 - 1.10] normalizada a [45% - 55%] */}
                <div style={{ position: "absolute", left: "45%", width: "10%", height: "100%", background: "rgba(16, 185, 129, 0.35)" }} />
                {/* Indicador de posición de sigma */}
                <div
                  style={{
                    position: "absolute",
                    left: `${Math.min(100, Math.max(0, (criticalityTelemetry.branchingRatio / 2.0) * 100))}%`,
                    width: "4px",
                    height: "100%",
                    background:
                      criticalityTelemetry.criticalityState === 'CRITICAL'
                        ? "#10B981"
                        : criticalityTelemetry.criticalityState === 'SUPER_CRITICAL'
                        ? "#EF4444"
                        : "#38BDF8",
                    boxShadow: "0 0 6px currentColor",
                    transform: "translateX(-50%)",
                    transition: "left 0.25s ease-out",
                  }}
                />
              </div>
            </div>

            {/* Métricas Numéricas de Teoría de Redes Complejas */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Branching (σ)</div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "0.80rem",
                    color:
                      criticalityTelemetry.criticalityState === 'CRITICAL'
                        ? "#10B981"
                        : criticalityTelemetry.criticalityState === 'SUPER_CRITICAL'
                        ? "#EF4444"
                        : "#38BDF8",
                  }}
                >
                  {criticalityTelemetry.branchingRatio.toFixed(2)}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Exp. Alfa (α)</div>
                <div style={{ color: "#00E5FF", fontWeight: 800, fontSize: "0.80rem" }}>
                  {criticalityTelemetry.estimatedAlpha.toFixed(2)}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>P_relay (Turrigiano)</div>
                <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: "0.80rem" }}>
                  {Math.round(criticalityTelemetry.relayProbability * 100)}%
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>K-Umbral Tormenta</div>
                <div style={{ color: "#EC4899", fontWeight: 800, fontSize: "0.80rem" }}>
                  K = {criticalityTelemetry.adaptiveKCounterThreshold}
                </div>
              </div>
            </div>

            {/* Estadísticas de Avalanchas y Tráfico en Ventana */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <div style={{ background: "rgba(0,0,0,0.25)", padding: "5px 7px", borderRadius: "5px", fontSize: "0.60rem" }}>
                <span style={{ color: "#64748B" }}>Tráfico Ventana 10s: </span>
                <span style={{ color: "#E2E8F0", fontWeight: 700 }}>
                  In: {criticalityTelemetry.packetsInWindow} / Out: {criticalityTelemetry.packetsOutWindow}
                </span>
              </div>
              <div style={{ background: "rgba(0,0,0,0.25)", padding: "5px 7px", borderRadius: "5px", fontSize: "0.60rem" }}>
                <span style={{ color: "#64748B" }}>Avalanchas (S, T): </span>
                <span style={{ color: "#E2E8F0", fontWeight: 700 }}>
                  {criticalityTelemetry.totalAvalanchesCount} tot ({criticalityTelemetry.lastAvalancheSize} pkts / {criticalityTelemetry.lastAvalancheDurationMs}ms)
                </span>
              </div>
            </div>

            {/* Controles Tácticos de Perturbación & Reseteo */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  swarmCriticality.recordPacketReceived(45);
                  toast.warning("⚡ Ráfaga super-crítica inyectada (+45 paquetes): observe autorregulación homeostática P_relay");
                }}
                style={{
                  padding: "4px 8px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "4px",
                  color: "#EF4444",
                  fontSize: "0.60rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                PERTURBAR SUPER-CRÍTICO (+45)
              </button>

              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  swarmCriticality.recordPacketRelayed(0);
                  toast.info("❄ Decaimiento sub-crítico registrado");
                }}
                style={{
                  padding: "4px 8px",
                  background: "rgba(56, 189, 248, 0.15)",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  borderRadius: "4px",
                  color: "#38BDF8",
                  fontSize: "0.60rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                PERTURBAR SUB-CRÍTICO
              </button>

              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  swarmCriticality.reset();
                  toast.success("🌿 Atractor crítico restablecido (σ = 1.0, P_relay = 100%)");
                }}
                style={{
                  padding: "4px 8px",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  borderRadius: "4px",
                  color: "#10B981",
                  fontSize: "0.60rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginLeft: "auto",
                }}
              >
                RESET HOMEOSTÁTICO
              </button>
            </div>
          </div>

          {/* Sincronizador de Fase Kuramoto (Colmena P2P) */}
          <div style={{ padding: "12px", background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(0, 229, 255, 0.25)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#00E5FF" }}>
                🧭 ACOPLAMIENTO DE OSCILADORES DE KURAMOTO (TDMA & ATRACTOR)
              </div>
              <button
                onClick={async () => {
                  TacticalAudioEngine.playRogerBeep();
                  await meshRouter.broadcastKuramotoPhase();
                  toast.success("Pulso Kuramoto emitido en slot 8 LoRa (1 byte de fase)");
                }}
                style={{
                  padding: "4px 10px",
                  background: "rgba(0, 229, 255, 0.15)",
                  border: "1px solid #00E5FF",
                  borderRadius: "4px",
                  color: "#00E5FF",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                EMITIR PULSO KURAMOTO
              </button>
            </div>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "0.70rem", color: "#CBD5E1" }}>
              <div>Rumbo Local E-PG: <span style={{ color: "#00E5FF", fontWeight: 800 }}>{cxTelemetry.headingDeg}° ({cxTelemetry.cardinal})</span></div>
              <div>Rumbo Colectivo Enjambre: <span style={{ color: "#10B981", fontWeight: 800 }}>{cxTelemetry.swarmPhaseDeg ?? cxTelemetry.headingDeg}°</span></div>
              <div>Pares en Memoria: <span style={{ color: "#F59E0B", fontWeight: 800 }}>{ringAttractor.getRemoteKuramotoPhasesCount()} nodos</span></div>
            </div>
            <div style={{ fontSize: "0.62rem", color: "#64748B" }}>
              Ecuación diferencial: dθ_i/dt = ω_i + (K/N) ∑ sin(θ_j - θ_i). Mantiene ventanas TDMA y rumbos de escuadra alineados sin servidores de tiempo centralizados.
            </div>
          </div>

          {/* Manto Estigmérgico de Feromonas de Enjambre */}
          <div style={{ padding: "12px", background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(245, 158, 11, 0.25)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#F59E0B" }}>
                🍄 MANTO ESTIGMÉRGICO DE FEROMONAS (DTN MUSHROOM BODY)
              </div>
              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  setIsPheromoneModalOpen(true);
                }}
                style={{
                  padding: "4px 10px",
                  background: "rgba(245, 158, 11, 0.15)",
                  border: "1px solid #F59E0B",
                  borderRadius: "4px",
                  color: "#F59E0B",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                DEPOSITAR FEROMONA
              </button>
            </div>
            {dtnMushroomBody.getActivePheromones().length === 0 ? (
              <div style={{ fontSize: "0.70rem", color: "#64748B", fontStyle: "italic" }}>
                Cero feromonas activas en el cuadrante sensorial. El espectro local se encuentra limpio.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {dtnMushroomBody.getActivePheromones().map((ph) => (
                  <div key={ph.id} style={{ padding: "6px 10px", background: "rgba(0, 0, 0, 0.4)", borderRadius: "4px", borderLeft: `3px solid ${ph.type === 'ALARM' ? '#EF4444' : ph.type === 'TRAIL' ? '#10B981' : '#F59E0B'}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 800, color: ph.type === 'ALARM' ? '#EF4444' : ph.type === 'TRAIL' ? '#10B981' : '#F59E0B', marginRight: "8px" }}>[{ph.type}]</span>
                      <span style={{ fontSize: "0.68rem", color: "#CBD5E1" }}>{ph.notes || 'Rastro estigmérgico en cuadrante'}</span>
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>
                      Intensidad: {(ph.intensity * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* STDP Tridimensional con Modulación Dopaminérgica & Evasión de Jamming EW */}
          <div style={{ padding: "12px", background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(236, 72, 153, 0.25)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.9rem" }}>🍄</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#F472B6", letterSpacing: "0.5px" }}>
                  CUERPO FUNGIFORME: STDP 3-FACTORES & EVASIÓN DE JAMMING
                </span>
              </div>
              <div
                style={{
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  background: mbTelemetry.jammingEvasionActive ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
                  color: mbTelemetry.jammingEvasionActive ? "#EF4444" : "#10B981",
                  border: `1px solid ${mbTelemetry.jammingEvasionActive ? '#EF4444' : '#10B981'}`,
                }}
              >
                {mbTelemetry.jammingEvasionActive
                  ? `🚨 EVASIÓN EW ACTIVA (SALTO -> ${mbTelemetry.recommendedChannel?.toUpperCase() || 'CH_1'})`
                  : "🟢 CANALES RF ÓPTIMOS (LTP)"}
              </div>
            </div>

            <div style={{ fontSize: "0.62rem", color: "#94A3B8", lineHeight: 1.3 }}>
              Regla de 3 factores (Pre KC × Post MBON × DA): ΔW = η · e_ij · (DA_PAM - DA_PPL1).
              Depresión LTD ante jamming o interferencia; consolidación LTP ante confirmaciones ACK.
            </div>

            {/* Medidores de Modulación Dopaminérgica (PAM vs PPL1) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Dopamina PAM (LTP)</div>
                <div style={{ color: "#10B981", fontWeight: 800, fontSize: "0.80rem" }}>
                  {(mbTelemetry.pamRewardScore ?? 0.5).toFixed(2)}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Dopamina PPL1 (LTD)</div>
                <div style={{ color: "#EF4444", fontWeight: 800, fontSize: "0.80rem" }}>
                  {(mbTelemetry.ppl1AversionScore ?? 0.0).toFixed(2)}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Huellas Activas (e_ij)</div>
                <div style={{ color: "#00E5FF", fontWeight: 800, fontSize: "0.80rem" }}>
                  {mbTelemetry.activeTracesCount ?? 0}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Conducta MBON</div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "0.80rem",
                    color: mbTelemetry.behavioralDrive === 'APPROACH' ? '#10B981' : mbTelemetry.behavioralDrive === 'AVOID' ? '#EF4444' : '#94A3B8',
                  }}
                >
                  {mbTelemetry.behavioralDrive}
                </div>
              </div>
            </div>

            {/* Heatmap de Pesos Sinápticos por Canal LoRa (CH_0 .. CH_7) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ fontSize: "0.60rem", color: "#64748B", fontWeight: 700 }}>
                CONDUCTANCIA SINÁPTICA POR CANAL RF (STDP WEIGHTS):
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "4px" }}>
                {Array.from({ length: 8 }).map((_, chIdx) => {
                  const chKey = `lora_ch_${chIdx}`;
                  const weight = mbTelemetry.channelWeights?.[chKey] ?? 0.50;
                  const isJammed = weight < 0.30;
                  const isOptimal = mbTelemetry.recommendedChannel === chKey;
                  return (
                    <div
                      key={chKey}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "2px",
                        padding: "4px 2px",
                        background: isJammed ? "rgba(239, 68, 68, 0.15)" : isOptimal ? "rgba(16, 185, 129, 0.15)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isJammed ? '#EF4444' : isOptimal ? '#10B981' : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: "4px",
                      }}
                    >
                      <span style={{ fontSize: "0.52rem", color: isOptimal ? "#10B981" : isJammed ? "#EF4444" : "#94A3B8", fontWeight: 800 }}>
                        CH{chIdx}
                      </span>
                      {/* Barra de altura proporcional al peso [0.05 .. 1.0] */}
                      <div style={{ width: "10px", height: "30px", background: "rgba(0,0,0,0.3)", borderRadius: "2px", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                        <div
                          style={{
                            width: "100%",
                            height: `${Math.round(weight * 100)}%`,
                            background: isJammed ? "#EF4444" : weight >= 0.70 ? "#10B981" : "#F59E0B",
                            transition: "height 0.3s ease-out",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "0.50rem", fontFamily: "monospace", color: "#E2E8F0" }}>
                        {weight.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Controles Tácticos STDP */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={() => {
                  TacticalAudioEngine.playAlarm();
                  dtnMushroomBody.applyDopaminergicNeuromodulation('PPL1', 0.85, 'lora_ch_0');
                  toast.warning("⚡ Ráfaga PPL1 inyectada: Deprimiendo CH_0 por interferencia EW (Jamming)");
                }}
                style={{
                  padding: "4px 8px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "4px",
                  color: "#EF4444",
                  fontSize: "0.60rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                SIMULAR JAMMING EN CH_0 (PPL1)
              </button>

              <button
                onClick={() => {
                  TacticalAudioEngine.playRogerBeep();
                  dtnMushroomBody.applyDopaminergicNeuromodulation('PAM', 0.50, 'lora_ch_1');
                  toast.success("🌿 Ráfaga PAM inyectada: Consolidando CH_1 (LTP)");
                }}
                style={{
                  padding: "4px 8px",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  borderRadius: "4px",
                  color: "#10B981",
                  fontSize: "0.60rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                RECOMPENSA ACK EN CH_1 (PAM)
              </button>

              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  dtnMushroomBody.resetStdpWeights();
                  toast.info("Reiniciados pesos STDP de canales a 0.50 nominal");
                }}
                style={{
                  padding: "4px 8px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "4px",
                  color: "#94A3B8",
                  fontSize: "0.60rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginLeft: "auto",
                }}
              >
                RESET STDP
              </button>
            </div>
          </div>

          {/* Módulo Compás Bio-Cibernético Dual (Fan-Shaped Body + Células de Rejilla Hexagonales + Anclaje Hipocampal) */}
          <div style={{ padding: "12px", background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.9rem" }}>🧭</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#00E5FF", letterSpacing: "0.5px" }}>
                  COMPÁS BIO-CIBERNÉTICO DUAL (CX FAN-SHAPED BODY + MEC GRID CELLS)
                </span>
              </div>
              <div
                style={{
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  background:
                    dualTelemetry.phaseCoherenceState === 'HARMONIC_CONSENSUS'
                      ? "rgba(16, 185, 129, 0.2)"
                      : dualTelemetry.phaseCoherenceState === 'NOMINAL'
                      ? "rgba(0, 229, 255, 0.2)"
                      : "rgba(245, 158, 11, 0.2)",
                  color:
                    dualTelemetry.phaseCoherenceState === 'HARMONIC_CONSENSUS'
                      ? "#10B981"
                      : dualTelemetry.phaseCoherenceState === 'NOMINAL'
                      ? "#00E5FF"
                      : "#F59E0B",
                  border: `1px solid ${
                    dualTelemetry.phaseCoherenceState === 'HARMONIC_CONSENSUS'
                      ? "#10B981"
                      : dualTelemetry.phaseCoherenceState === 'NOMINAL'
                      ? "#00E5FF"
                      : "#F59E0B"
                  }`,
                }}
              >
                {dualTelemetry.phaseCoherenceState === 'HARMONIC_CONSENSUS'
                  ? `🟢 CONSENSO ARMÓNICO (${(dualTelemetry.phaseCoherence * 100).toFixed(0)}%)`
                  : dualTelemetry.phaseCoherenceState === 'NOMINAL'
                  ? `🔵 NOMINAL (${(dualTelemetry.phaseCoherence * 100).toFixed(0)}%)`
                  : `⚠️ DERIVA INERCIAL (${(dualTelemetry.phaseCoherence * 100).toFixed(0)}%)`}
              </div>
            </div>

            <div style={{ fontSize: "0.62rem", color: "#94A3B8", lineHeight: 1.3 }}>
              Fusión Bio-Cibernética: Cinemática 16x9 del insecto (Stone et al., Nature 2017) + Teselación rómbico-hexagonal 4-escalas (Moser & Moser, Nobel 2014) + Anclaje episódico hipocampal CA3 a 0.0m de deriva.
            </div>

            {/* Cuadrícula de Métricas Principales */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", fontSize: "0.68rem" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Rumbo Fused (E-PG)</div>
                <div style={{ color: "#00E5FF", fontWeight: 800, fontSize: "0.80rem" }}>
                  {dualTelemetry.headingDeg}° ({dualTelemetry.cardinal})
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Home Vector (FB)</div>
                <div style={{ color: "#10B981", fontWeight: 800, fontSize: "0.80rem" }}>
                  {dualTelemetry.homeVector.distanceMeters}m · {dualTelemetry.homeVector.cardinal}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Deriva Inercial Est.</div>
                <div style={{ color: dualTelemetry.estimatedDriftMeters > 5 ? "#F59E0B" : "#A7F3D0", fontWeight: 800, fontSize: "0.80rem" }}>
                  {dualTelemetry.estimatedDriftMeters}m <span style={{ fontSize: "0.55rem", color: "#64748B" }}>({dualTelemetry.hippocampalResetsCount} resets)</span>
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 7px", borderRadius: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "0.58rem" }}>Timoneo CPG Hexápodo</div>
                <div style={{ color: dualTelemetry.isAutonomousNavigationActive ? "#F472B6" : "#64748B", fontWeight: 800, fontSize: "0.80rem" }}>
                  {dualTelemetry.autonomousCpgSteering} ({dualTelemetry.fusedSteeringErrorDeg > 0 ? `+${dualTelemetry.fusedSteeringErrorDeg}` : dualTelemetry.fusedSteeringErrorDeg}°)
                </div>
              </div>
            </div>

            {/* Visualizador de las 4 Escalas de Células de Rejilla (MEC) */}
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.62rem" }}>
                <span style={{ color: "#E2E8F0", fontWeight: 700 }}>ACTIVACIÓN DE CÉLULAS DE REJILLA HEXAGONALES (MEC):</span>
                <span style={{ color: "#00E5FF", fontFamily: "monospace" }}>Actividad Compuesta: {(dualTelemetry.gridCellActivity.compositeActivity * 100).toFixed(0)}%</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                {dualTelemetry.gridCellActivity.modules.map((m) => (
                  <div key={m.moduleIndex} style={{ background: "rgba(255,255,255,0.02)", padding: "4px 6px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.55rem", color: "#94A3B8" }}>
                      <span>M{m.moduleIndex + 1} (λ={m.scaleWavelengthMeters}m)</span>
                      <span style={{ color: "#10B981", fontWeight: 700 }}>{(m.firingIntensity * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ height: "4px", width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: "2px", marginTop: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round(m.firingIntensity * 100)}%`, height: "100%", background: "#00E5FF", transition: "width 0.25s ease-out" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Controles de Simulación & Anclaje Táctico */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  bioCompassDualFusion.integrateMotion(5.0, dualTelemetry.headingDeg);
                  toast.success(`Paso inercial integrado: +5.0m en rumbo ${dualTelemetry.headingDeg}°`);
                }}
                style={{
                  padding: "4px 8px",
                  background: "rgba(0, 229, 255, 0.15)",
                  border: "1px solid rgba(0, 229, 255, 0.4)",
                  borderRadius: "4px",
                  color: "#00E5FF",
                  fontSize: "0.60rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                PASO PDR (5m)
              </button>

              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  bioCompassDualFusion.setGuidanceGoal(0, 25);
                  toast.info("Objetivo fijado: 25 metros al Norte (X=0m, Y=25m)");
                }}
                style={{
                  padding: "4px 8px",
                  background: "rgba(245, 158, 11, 0.15)",
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  borderRadius: "4px",
                  color: "#F59E0B",
                  fontSize: "0.60rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                FIJAR GOAL (25m N)
              </button>

              <button
                onClick={() => {
                  TacticalAudioEngine.playAlarm();
                  fanShapedBody.reconcileCoordinates(dualTelemetry.currentPosition.xMeters + 8.0, dualTelemetry.currentPosition.yMeters);
                  toast.warning("⚠️ Deriva inercial forzada (+8m de desfase cartesiano): observe alerta de coherencia");
                }}
                style={{
                  padding: "4px 8px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "4px",
                  color: "#EF4444",
                  fontSize: "0.60rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                SIMULAR DERIVA (+8m)
              </button>

              <button
                onClick={() => {
                  TacticalAudioEngine.playRogerBeep();
                  bioCompassDualFusion.correctSpatialDrift(0, 0, 0, 'BALIZA ANCLAJE TÁCTICA');
                  toast.success("🌿 Anclaje Hipocampal CA3 ejecutado: Deriva inercial reseteada a 0.0m");
                }}
                style={{
                  padding: "4px 8px",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  borderRadius: "4px",
                  color: "#10B981",
                  fontSize: "0.60rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ANCLAJE HIPOCAMPAL (RESET)
              </button>

              <button
                onClick={() => {
                  TacticalAudioEngine.playTap();
                  const next = !dualTelemetry.isAutonomousNavigationActive;
                  bioCompassDualFusion.setAutonomousNavigation(next);
                  toast.info(`Navegación autónoma CPG ${next ? 'ACTIVADA' : 'DESACTIVADA'}`);
                }}
                style={{
                  padding: "4px 8px",
                  background: dualTelemetry.isAutonomousNavigationActive ? "rgba(244, 114, 182, 0.25)" : "rgba(255, 255, 255, 0.05)",
                  border: `1px solid ${dualTelemetry.isAutonomousNavigationActive ? '#F472B6' : 'rgba(255, 255, 255, 0.15)'}`,
                  borderRadius: "4px",
                  color: dualTelemetry.isAutonomousNavigationActive ? "#F472B6" : "#94A3B8",
                  fontSize: "0.60rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginLeft: "auto",
                }}
              >
                {dualTelemetry.isAutonomousNavigationActive ? '⏹ DETENER CPG' : '▶ AUTO-GUIADO CPG'}
              </button>
            </div>
          </div>


          {/* Competencia Atencional y Desglose de Candidatos GNWT */}
          <div style={{ padding: "12px", background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(100, 116, 139, 0.3)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#E2E8F0" }}>
              ⚔️ COMPETENCIA NO-LINEAL DE CANDIDATOS ATENCIONALES (INHIBICIÓN LATERAL)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {consciousnessTelemetry.activeCandidates.map((c, idx) => (
                <div
                  key={`${c.source}_${idx}`}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: idx === 0 ? "rgba(0, 229, 255, 0.10)" : "rgba(15, 23, 42, 0.4)",
                    border: idx === 0 ? "1px solid rgba(0, 229, 255, 0.35)" : "1px solid rgba(51, 65, 85, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {idx === 0 && <span style={{ fontSize: "0.60rem", background: "#00E5FF", color: "#000", fontWeight: 900, padding: "1px 4px", borderRadius: "3px" }}>GANADOR</span>}
                      <span style={{ fontSize: "0.72rem", fontWeight: 800, color: idx === 0 ? "#00E5FF" : "#94A3B8" }}>{c.source}</span>
                      <span style={{ fontSize: "0.65rem", color: "#64748B" }}>({c.focus})</span>
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "#CBD5E1" }}>{c.rationale}</div>
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 900, color: c.activation >= 0.60 ? "#EF4444" : "#10B981" }}>
                    {(c.activation * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Difusión de Feromonas Swarm */}
      <PheromoneBroadcastModal
        isOpen={isPheromoneModalOpen}
        onClose={() => setIsPheromoneModalOpen(false)}
        currentLocation={(() => {
          const lastLoc = TacticalLocationEngine.getLastKnownLocation();
          return {
            lat: lastLoc?.lat || 0,
            lon: lastLoc?.lon || 0,
            alt: lastLoc?.alt || 0,
          };
        })()}
      />

      {/* Modal de Navegación Háptica Eyes-Free */}
      <EyesFreeHapticModal
        isOpen={isHapticModalOpen}
        onClose={() => setIsHapticModalOpen(false)}
      />

      {/* Modales de Neocorteza Humana */}
      <CognitiveNavigationModal
        isOpen={isCognitiveNavOpen}
        onClose={() => setIsCognitiveNavOpen(false)}
      />
      <TcccMedicalTriageModal
        isOpen={isTcccModalOpen}
        onClose={() => setIsTcccModalOpen(false)}
      />
      <EpistemicRadarModal
        isOpen={isEpistemicRadarOpen}
        onClose={() => setIsEpistemicRadarOpen(false)}
      />
      <OfcBarterMarketModal
        isOpen={isOfcBarterOpen}
        onClose={() => setIsOfcBarterOpen(false)}
      />
      <HippocampalMemoryModal
        isOpen={isHippocampalMemoryOpen}
        onClose={() => setIsHippocampalMemoryOpen(false)}
      />
      {isVivariumOpen && (
        <TacticalVivariumModal onClose={() => setIsVivariumOpen(false)} />
      )}
      {isHabitatOpen && (
        <TacticalHabitatModal onClose={() => setIsHabitatOpen(false)} />
      )}
    </div>
  );
}
