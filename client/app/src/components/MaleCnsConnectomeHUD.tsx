"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ringAttractor, RingAttractorTelemetry } from "../lib/neuro/RingAttractorEngine";
import { synapticMeshRouter, SynapticMeshTelemetry } from "../lib/neuro/SynapticMeshRouterEngine";
import { giantFiberReflex, GiantFiberTelemetry } from "../lib/neuro/GiantFiberReflexEngine";
import { dtnMushroomBody, MushroomBodyTelemetry } from "../lib/neuro/DtnMushroomBodyEngine";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacIcon } from "./ui/TacIcon";

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface ConnectomeNode {
  id: string;
  name: string;
  system: "CX" | "MB" | "GFS" | "SENSORY";
  pos: Point3D;
  color: string;
  size: number;
  activity: number; // [0, 1]
}

interface ConnectomeEdge {
  from: string;
  to: string;
  weight: number;
  system: "CX" | "MB" | "GFS" | "SENSORY";
  pulseProgress?: number;
}

export interface MaleCnsConnectomeHUDProps {
  onClose?: () => void;
}

export function MaleCnsConnectomeHUD({ onClose }: MaleCnsConnectomeHUDProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Estados de telemetría de los 4 motores bio-neuromórficos
  const [cxTelemetry, setCxTelemetry] = useState<RingAttractorTelemetry>(() => ringAttractor.getTelemetry());
  const [synapticTelemetry, setSynapticTelemetry] = useState<SynapticMeshTelemetry>(() => synapticMeshRouter.getTelemetry());
  const [gfsTelemetry, setGfsTelemetry] = useState<GiantFiberTelemetry>(() => giantFiberReflex.getTelemetry());
  const [mbTelemetry, setMbTelemetry] = useState<MushroomBodyTelemetry>(() => dtnMushroomBody.getTelemetry());

  // Filtros de visualización y control de cámara 3D
  const [filterSystem, setFilterSystem] = useState<"ALL" | "CX" | "MB" | "GFS">("ALL");
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const autoRotateRef = useRef<boolean>(true);
  const rotXRef = useRef<number>(0.3);
  const rotYRef = useRef<number>(0.0);
  const zoomRef = useRef<number>(1.0);
  const [stimulationActive, setStimulationActive] = useState<boolean>(false);
  const [showAttributionModal, setShowAttributionModal] = useState<boolean>(false);
  const [optogeneticFeedback, setOptogeneticFeedback] = useState<string | null>(null);

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

  // Suscripción a los 4 subsistemas neurobiológicos
  useEffect(() => {
    const unsubCx = ringAttractor.subscribe(setCxTelemetry);
    const unsubSyn = synapticMeshRouter.subscribe(setSynapticTelemetry);
    const unsubGfs = giantFiberReflex.subscribe(setGfsTelemetry);
    const unsubMb = dtnMushroomBody.subscribe(setMbTelemetry);

    return () => {
      unsubCx();
      unsubSyn();
      unsubGfs();
      unsubMb();
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

      nList.push({
        id: `CX_EPG_${i}`,
        name: `E-PG Wedge ${i + 1} [#${10100 + i}]`,
        system: "CX",
        pos: { x, y, z },
        color: act > 0.6 ? "#00E5FF" : "rgba(0, 229, 255, 0.4)",
        size: 3 + act * 4,
        activity: act,
      });

      // Conexiones sinápticas recurrentes circulares en anillo
      const nextIdx = (i + 1) % 16;
      eList.push({
        from: `CX_EPG_${i}`,
        to: `CX_EPG_${nextIdx}`,
        weight: 0.8,
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
        rotYRef.current = (rotYRef.current + 0.006) % (Math.PI * 2);
      }

      pulseT = (pulseT + 0.04) % (Math.PI * 2);

      // Proyección 3D isométrica a 2D escalada por DPR
      const project = (p: Point3D): { x: number; y: number; zDepth: number } => {
        // Rotación Y
        const cosY = Math.cos(rotYRef.current);
        const sinY = Math.sin(rotYRef.current);
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;

        // Rotación X
        const cosX = Math.cos(rotXRef.current);
        const sinX = Math.sin(rotXRef.current);
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        // Perspectiva
        const fov = 380;
        const scale = (fov / (fov + z2)) * zoomRef.current * dpr;

        return {
          x: cx + x1 * scale,
          y: cy - y2 * scale, // Invertir Y para coordenadas de pantalla
          zDepth: z2,
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

        let strokeColor = "rgba(0, 229, 255, 0.2)";
        if (edge.system === "MB") strokeColor = "rgba(179, 136, 255, 0.25)";
        if (edge.system === "GFS") strokeColor = gfsTelemetry.emconLockActive ? "rgba(255, 51, 85, 0.6)" : "rgba(255, 145, 0, 0.35)";

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = edge.weight * 1.5 * dpr;
        ctx.stroke();

        // Pulso de potencial de acción viajando
        const pulseRatio = (Math.sin(pulseT + (p1.x % 5)) + 1) / 2;
        const px = p1.x + (p2.x - p1.x) * pulseRatio;
        const py = p1.y + (p2.y - p1.y) * pulseRatio;

        ctx.beginPath();
        ctx.arc(px, py, 2 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = edge.system === "GFS" ? "#FF3355" : "#00E5FF";
        ctx.fill();
      });

      // 2. Dibujar Nodos Neuronales (Somas y Glomérulos)
      // Ordenar por profundidad Z para renderizado correcto
      const sortedNodes = [...nodes]
        .filter((n) => filterSystem === "ALL" || n.system === filterSystem)
        .map((n) => ({ node: n, proj: project(n.pos) }))
        .sort((a, b) => b.proj.zDepth - a.proj.zDepth);

      sortedNodes.forEach(({ node, proj }) => {
        const glowRadius = node.size * (1 + node.activity * 0.8) * dpr;

        // Resplandor externo
        const grad = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, glowRadius * 2);
        grad.addColorStop(0, node.color);
        grad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.beginPath();
        ctx.arc(proj.x, proj.y, glowRadius * 2, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Núcleo del soma
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, node.size * dpr, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [nodes, edges, filterSystem, gfsTelemetry]);

  // Controlador de arrastre táctil para rotar modelo en 3D
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    autoRotateRef.current = false;
    setAutoRotate(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    rotYRef.current = (rotYRef.current + dx * 0.008) % (Math.PI * 2);
    rotXRef.current = Math.max(-1.2, Math.min(1.2, rotXRef.current + dy * 0.008));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Control táctil para dispositivos móviles / pantallas táctiles
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      autoRotateRef.current = false;
      setAutoRotate(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const dx = touch.clientX - lastMousePos.current.x;
    const dy = touch.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: touch.clientX, y: touch.clientY };

    rotYRef.current = (rotYRef.current + dx * 0.008) % (Math.PI * 2);
    rotXRef.current = Math.max(-1.2, Math.min(1.2, rotXRef.current + dy * 0.008));
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
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
          {(["ALL", "CX", "MB", "GFS"] as const).map((sys) => (
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
            🧭 CENTRAL COMPLEX (CX)
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

        {/* Card 2: Synaptic Mesh Router & Murthy Lab Statistics */}
        <div
          style={{
            padding: "10px",
            borderRadius: "10px",
            background: "rgba(0, 230, 118, 0.05)",
            border: "1px solid rgba(0, 230, 118, 0.2)",
          }}
        >
          <div style={{ fontSize: "0.65rem", color: "#00E676", fontWeight: 900, marginBottom: "4px" }}>
            📡 SINAPSIS HEBBIANA & MURTHY LAB
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 800 }}>
            <span style={{ color: "#94A3B8" }}>Reciprocidad r:</span>
            <span style={{ color: "#00E676" }}>{(synapticTelemetry.edgeReciprocity * 100).toFixed(0)}%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Small-World σ:</span>
            <span style={{ color: "#00E5FF" }}>{synapticTelemetry.smallWorldSigma.toFixed(2)} (FlyWire)</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Motivos Triádicos:</span>
            <span style={{ color: "#FFB300" }}>FFL: {synapticTelemetry.fflMotifsCount} | FBL: {synapticTelemetry.fblMotifsCount}</span>
          </div>
        </div>

        {/* Card 3: Giant Fiber System & fly-swing */}
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

        {/* Card 4: Mushroom Body & The Fly's Table */}
        <div
          style={{
            padding: "10px",
            borderRadius: "10px",
            background: "rgba(179, 136, 255, 0.05)",
            border: "1px solid rgba(179, 136, 255, 0.2)",
          }}
        >
          <div style={{ fontSize: "0.65rem", color: "#B388FF", fontWeight: 900, marginBottom: "4px" }}>
            🍄 MUSHROOM BODY (The Fly's Table)
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 800 }}>
            <span style={{ color: "#94A3B8" }}>KCs Activas:</span>
            <span style={{ color: "#B388FF" }}>{mbTelemetry.activeKenyonCellsLastStimulus} / 2500 (5%)</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>Conectoma:</span>
            <span style={{ color: "#FFD600" }}>682 PN | 97 MBON | 332 DAN</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginTop: "2px" }}>
            <span style={{ color: "#94A3B8" }}>LTP Pinned:</span>
            <span style={{ color: "#00E676" }}>{mbTelemetry.ltpPinnedRecords} Paquetes SOS</span>
          </div>
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
  );
}
