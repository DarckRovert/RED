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
  const [rfBearings, setRfBearings] = useState<RfPeerBearing[]>(() => synapticMeshRouter.getAllActiveBearings());

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

  // Modo de Arquitectura Neurobiológica: MaleCNS Drosophila vs Neocorteza Humana
  const [architectureMode, setArchitectureMode] = useState<"SUBCORTICAL_MALE_CNS" | "HUMAN_NEOCORTEX">("SUBCORTICAL_MALE_CNS");
  const [humanSnapshot, setHumanSnapshot] = useState<HumanBrainTelemetrySnapshot>(() => humanBrainOrchestrator.getSnapshot());
  const [isCognitiveNavOpen, setIsCognitiveNavOpen] = useState<boolean>(false);
  const [isTcccModalOpen, setIsTcccModalOpen] = useState<boolean>(false);
  const [isEpistemicRadarOpen, setIsEpistemicRadarOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsub = humanBrainOrchestrator.subscribe(setHumanSnapshot);
    return unsub;
  }, []);

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

  // Suscripción a los 7 subsistemas neurobiológicos
  useEffect(() => {
    const unsubCx = ringAttractor.subscribe(setCxTelemetry);
    const unsubFb = fanShapedBody.subscribe(setFbTelemetry);
    const unsubSyn = synapticMeshRouter.subscribe((st) => {
      setSynapticTelemetry(st);
      setRfBearings(synapticMeshRouter.getAllActiveBearings());
    });
    const unsubGfs = giantFiberReflex.subscribe(setGfsTelemetry);
    const unsubMb = dtnMushroomBody.subscribe(setMbTelemetry);
    const unsubJo = johnstonOrgan.subscribe(setJoTelemetry);
    const unsubMet = metabolicGovernor.subscribe(setMetTelemetry);
    const unsubOptic = opticLobe.subscribe(setOpticTelemetry);
    const unsubMotor = tacticalMotorActuator.subscribe(setMotorTelemetry);

    return () => {
      unsubCx();
      unsubFb();
      unsubSyn();
      unsubGfs();
      unsubMb();
      unsubJo();
      unsubMet();
      unsubOptic();
      unsubMotor();
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
      const act = cxTelemetry.wedges[i] ?? 0.2;
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

      const act = fbTelemetry.columnLayerMatrix[c * 9 + 4] ?? 0.25;

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

  // Bucle de Renderizado 3D en Canvas (Desacoplado de re-renders de React para 60 FPS puros)
  useEffect(() => {
    let animationId: number;
    let pulseT = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Sincronizar buffer del canvas con la resolución física del display (Retina / 4K)
      const rect = canvas.getBoundingClientRect();
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const targetW = Math.max(300, Math.floor((rect.width || 500) * dpr));
      const targetH = Math.max(200, Math.floor((rect.height || 320) * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

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

        // 1. Dibujar Aristas Sinápticas (Axones)
        edges.forEach((edge) => {
          if (filterSystem !== "ALL" && edge.system !== filterSystem) return;

          const srcNode = nodes.find((n) => n.id === edge.from);
          const dstNode = nodes.find((n) => n.id === edge.to);
          if (!srcNode || !dstNode) return;

          const p1 = project(srcNode.pos);
          const p2 = project(dstNode.pos);

          if (!p1.visible || !p2.visible) return;

          let strokeColor = "rgba(0, 229, 255, 0.2)";
          if (edge.system === "FB") strokeColor = "rgba(255, 214, 0, 0.3)";
          if (edge.system === "MB") strokeColor = "rgba(179, 136, 255, 0.25)";
          if (edge.system === "GFS") strokeColor = gfsTelemetry.emconLockActive ? "rgba(255, 51, 85, 0.6)" : "rgba(255, 145, 0, 0.35)";

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = Math.max(0.5, (edge.weight || 1) * 1.5 * dpr);
          ctx.stroke();

          // Pulso de potencial de acción viajando
          const pulseRatio = Math.max(0, Math.min(1, (Math.sin(pulseT + (p1.x % 5)) + 1) / 2));
          const px = p1.x + (p2.x - p1.x) * pulseRatio;
          const py = p1.y + (p2.y - p1.y) * pulseRatio;

          if (Number.isFinite(px) && Number.isFinite(py)) {
            ctx.beginPath();
            ctx.arc(px, py, Math.max(1, 2 * dpr), 0, Math.PI * 2);
            ctx.fillStyle = edge.system === "GFS" ? "#FF3355" : edge.system === "FB" ? "#FFD600" : "#00E5FF";
            ctx.fill();
          }
        });

        // 2. Dibujar Nodos Neuronales (Somas y Glomérulos)
        const sortedNodes = [...nodes]
          .filter((n) => filterSystem === "ALL" || n.system === filterSystem)
          .map((n) => ({ node: n, proj: project(n.pos) }))
          .filter((item) => item.proj.visible)
          .sort((a, b) => b.proj.zDepth - a.proj.zDepth);

        sortedNodes.forEach(({ node, proj }) => {
          if (!Number.isFinite(proj.x) || !Number.isFinite(proj.y)) return;

          const rawActivity = Number.isFinite(node.activity) ? Math.max(0, Math.min(1, node.activity)) : 0.3;
          const rawSize = Number.isFinite(node.size) && node.size > 0 ? node.size : 3;
          const glowRadius = Math.max(1, rawSize * (1 + rawActivity * 0.8) * dpr);

          if (!Number.isFinite(glowRadius) || glowRadius <= 0) return;

          // Resplandor externo con salvaguarda contra valores no-finitos
          try {
            const grad = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, glowRadius * 2);
            grad.addColorStop(0, node.color || "#00E5FF");
            grad.addColorStop(1, "rgba(0,0,0,0)");

            ctx.beginPath();
            ctx.arc(proj.x, proj.y, glowRadius * 2, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
          } catch (e) {
            // Fallback en caso de incompatibilidad con contexto gráfico
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = node.color || "#00E5FF";
            ctx.fill();
          }

          // Núcleo del soma
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, Math.max(1, rawSize * dpr), 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
        });
      } catch (renderErr) {
        console.warn('[ConnectomeHUD] Error durante renderizado de frame:', renderErr);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [nodes, edges, filterSystem, gfsTelemetry]);

  // Controlador de arrastre táctil y pinch-to-zoom para navegación 3D
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    isDragging.current = true;
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
        lastMousePos.current = { x: touch.clientX, y: touch.clientY };
        lastPinchDist.current = null;
      }
    } else if (e.touches.length === 2) {
      isDragging.current = false;
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
        }}
      >
        <button
          onClick={() => {
            TacticalAudioEngine.playTap();
            setArchitectureMode("SUBCORTICAL_MALE_CNS");
          }}
          style={{
            flex: 1,
            padding: "10px",
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
            padding: "10px",
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
          <span>NEOCORTEZA HUMANA (7 NÚCLEOS COGNITIVOS)</span>
        </button>
      </div>

      {architectureMode === "SUBCORTICAL_MALE_CNS" ? (
        <>
          {/* Visor 3D Interactivo */}
          <div
        style={{
          position: "relative",
          width: "100%",
          height: "320px",
          background: "#040711",
          cursor: isDragging.current ? "grabbing" : "grab",
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

        {/* Controles Flotantes de Cámara */}
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            left: "12px",
            display: "flex",
            gap: "6px",
            zIndex: 5,
          }}
        >
          <button
            onClick={() => {
              const next = !autoRotate;
              autoRotateRef.current = next;
              setAutoRotate(next);
            }}
            style={{
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

        </>
      ) : (
        /* VISTA DE NEOCORTEZA HUMANA (7 NÚCLEOS COGNITIVOS) */
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px", background: "#050811" }}>
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
    </div>
  );
}
