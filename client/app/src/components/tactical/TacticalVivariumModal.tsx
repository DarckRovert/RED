"use client";

import React, { useState, useEffect, useRef } from "react";
import { Vivarium3DEngine, VivariumCameraMode } from "../../lib/neuro/vivarium/Vivarium3DEngine";
import { Vivarium2DEngine } from "../../lib/neuro/vivarium/Vivarium2DEngine";
import { centralPatternGenerator, CpgLocomotionTelemetry } from "../../lib/neuro/CentralPatternGeneratorEngine";
import { humanBrainOrchestrator, HumanBrainTelemetrySnapshot } from "../../lib/neuro/human/HumanBrainOrchestrator";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacIcon } from "../ui/TacIcon";
import { toast } from "../Toast";
import { useTranslation } from "../../lib/i18n/i18nEngine";

export interface TacticalVivariumModalProps {
  onClose: () => void;
}

export const TacticalVivariumModal: React.FC<TacticalVivariumModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [renderMode, setRenderMode] = useState<"3D" | "2D">("3D");
  const [cameraMode, setCameraMode] = useState<VivariumCameraMode>("ORBITAL");
  const [isManualControl, setIsManualControl] = useState<boolean>(false);

  // Telemetrías Vivas
  const [cpgTelemetry, setCpgTelemetry] = useState<CpgLocomotionTelemetry>(() =>
    centralPatternGenerator.getTelemetry()
  );
  const [humanBrainSnapshot, setHumanBrainSnapshot] = useState<HumanBrainTelemetrySnapshot | null>(null);
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [isThreatActive, setIsThreatActive] = useState<boolean>(false);

  // Referencias a contenedores de render
  const viewport3DRef = useRef<HTMLDivElement | null>(null);
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);

  // Instancias de los motores
  const engine3DRef = useRef<Vivarium3DEngine | null>(null);
  const engine2DRef = useRef<Vivarium2DEngine | null>(null);

  // Registro del botón físico de Atrás en Android (LIFO)
  useEffect(() => {
    const unregister = BackHandlerRegistry.register(() => {
      TacticalAudioEngine.playTap();
      onClose();
      return true;
    });
    return unregister;
  }, [onClose]);

  // Inicialización de Motores de Simulación
  useEffect(() => {
    // 1. Inicializar motor 3D
    const engine3D = new Vivarium3DEngine();
    engine3DRef.current = engine3D;

    if (viewport3DRef.current) {
      engine3D.attach(viewport3DRef.current);
    }

    // 2. Inicializar motor 2D
    const engine2D = new Vivarium2DEngine();
    engine2DRef.current = engine2D;

    if (canvas2DRef.current) {
      engine2D.attach(canvas2DRef.current);
    }

    if (renderMode === "3D") {
      engine3D.start();
      engine2D.pause();
    } else {
      engine2D.start();
      engine3D.pause();
    }

    // 3. Suscripciones Reactivas a los Cerebros del Workspace
    const unsubCpg = centralPatternGenerator.subscribe((telem) => {
      setCpgTelemetry(telem);
    });

    const humanOrchestrator = humanBrainOrchestrator;
    humanOrchestrator.start();
    const unsubHuman = humanOrchestrator.subscribe((snapshot) => {
      setHumanBrainSnapshot(snapshot);
    });

    // 4. Polling ligero de telemetría de supertrama TDMA
    const slotTimer = setInterval(() => {
      if (engine3DRef.current) {
        setActiveSlot(engine3DRef.current.stimulus.activeTdmaSlot);
        setIsThreatActive(engine3DRef.current.stimulus.threatLoomingActive);
      }
    }, 150);

    // 5. Manejo de redimensionado de ventana
    const handleResize = () => {
      if (engine3DRef.current) engine3DRef.current.handleResize();
      if (engine2DRef.current) engine2DRef.current.handleResize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(slotTimer);
      unsubCpg();
      unsubHuman();
      if (engine3DRef.current) {
        engine3DRef.current.dispose();
        engine3DRef.current = null;
      }
      if (engine2DRef.current) {
        engine2DRef.current.dispose();
        engine2DRef.current = null;
      }
    };
  }, []);

  // Conmutación dinámica entre Viewport 3D y 2D
  useEffect(() => {
    if (renderMode === "3D") {
      if (engine2DRef.current) engine2DRef.current.pause();
      if (engine3DRef.current) {
        engine3DRef.current.start();
        engine3DRef.current.handleResize();
      }
    } else {
      if (engine3DRef.current) engine3DRef.current.pause();
      if (engine2DRef.current) {
        engine2DRef.current.start();
        engine2DRef.current.handleResize();
      }
    }
  }, [renderMode]);

  // Actualización de Modo de Cámara
  const handleCameraChange = (mode: VivariumCameraMode) => {
    TacticalAudioEngine.playTap();
    setCameraMode(mode);
    if (engine3DRef.current) {
      engine3DRef.current.cameraMode = mode;
    }
  };

  // Disparadores de Estímulos Tácticos
  const handleInjectThreat = () => {
    TacticalAudioEngine.playAlert();
    toast.error("AMENAZA DE COLISIÓN (LOOMING): Neuronas LC4 disparadas");
    if (engine3DRef.current) engine3DRef.current.injectThreatLooming();
    if (engine2DRef.current) engine2DRef.current.triggerThreat();
  };

  const handleInjectJamming = () => {
    TacticalAudioEngine.playWarning();
    toast.warning("INTERFERENCIA RF DETECTADA: Modo EMCON & Pulso Kuramoto");
    if (engine3DRef.current) engine3DRef.current.injectRfJamming();
  };

  const handleSpawnDtnPacket = () => {
    TacticalAudioEngine.playRogerBeep();
    toast.success("PAQUETE DTN DESPLEGADO: Guiado por Fan-Shaped Body");
    if (engine3DRef.current) engine3DRef.current.spawnDtnPacket();
    if (engine2DRef.current) engine2DRef.current.spawnPacket();
  };

  const handleTestGuardianFirewall = () => {
    TacticalAudioEngine.playAlert();
    toast.info("FIREWALL GUARDIAN: Inyección neutralizada en vuelo");
    if (engine3DRef.current) {
      engine3DRef.current.injectThreatLooming();
    }
  };

  const handleToggleControlMode = () => {
    TacticalAudioEngine.playTap();
    const next = !isManualControl;
    setIsManualControl(next);
    if (engine3DRef.current) engine3DRef.current.setManualControl(next);
    if (engine2DRef.current) engine2DRef.current.setManualControl(next);
    toast.info(next ? "CONTROL MANUAL ACTIVADO (D-Pad)" : "MODO AUTÓNOMO (Biocibernético)");
  };

  const handleManualSteer = (turnDeg: number, speed: number) => {
    TacticalAudioEngine.playTap();
    if (engine3DRef.current) engine3DRef.current.setManualSteering(speed, turnDeg);
    if (engine2DRef.current) engine2DRef.current.setManualSteering(speed, turnDeg);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "rgba(2, 4, 10, 0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        color: "#ffffff",
        fontFamily: "JetBrains Mono, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ── 1. Header Táctico & KPIs ────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "1px solid rgba(0, 240, 255, 0.2)",
          background: "linear-gradient(180deg, rgba(6, 12, 24, 0.95) 0%, rgba(2, 6, 14, 0.85) 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "rgba(0, 240, 255, 0.12)",
              border: "1px solid #00f0ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#00f0ff",
            }}
          >
            <TacIcon name="crosshair" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "1.5px", color: "#00f0ff" }}>
              {t("tactical_modules.vivarium_title") || "VIVARIUM BIOCIBERNÉTICO & GEMELO DIGITAL"}
            </div>
            <div style={{ fontSize: "11px", color: "#8b9bb4" }}>
              {t("tactical_modules.vivarium_sub") || "CO-SIMULACIÓN ENJAMBRE: DROSOPHILA CPG + NEOCÓRTEX HUMANO + GUARDIAN IA"}
            </div>
          </div>
        </div>

        {/* KPIs de Telemetría Viva */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              background: "rgba(0, 255, 136, 0.1)",
              border: "1px solid #00ff88",
              fontSize: "11px",
              fontWeight: 700,
              color: "#00ff88",
            }}
          >
            CPG: {cpgTelemetry.gaitMode} ({cpgTelemetry.meanFrequencyHz.toFixed(1)} Hz)
          </div>

          <div
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              background: isThreatActive ? "rgba(255, 51, 85, 0.2)" : "rgba(0, 240, 255, 0.1)",
              border: `1px solid ${isThreatActive ? "#ff3355" : "#00f0ff"}`,
              fontSize: "11px",
              fontWeight: 700,
              color: isThreatActive ? "#ff3355" : "#00f0ff",
            }}
          >
            ÓPTICO: {isThreatActive ? "⚠️ LOOMING COLISIÓN" : "✓ PERCEPCIÓN NORMAL"}
          </div>

          <div
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              background: "rgba(255, 179, 0, 0.1)",
              border: "1px solid #ffb300",
              fontSize: "11px",
              fontWeight: 700,
              color: "#ffb300",
            }}
          >
            TDMA: SLOT #{activeSlot}
          </div>

          {/* Botón de Cierre */}
          <button
            onClick={() => {
              TacticalAudioEngine.playTap();
              onClose();
            }}
            style={{
              background: "rgba(255, 51, 85, 0.15)",
              border: "1px solid rgba(255, 51, 85, 0.4)",
              color: "#ff3355",
              borderRadius: "6px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <TacIcon name="x" size={18} />
          </button>
        </div>
      </div>

      {/* ── 2. Área Central de Renderizado (Viewport 3D / 2D Persistente) ─── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div
          ref={viewport3DRef}
          style={{
            width: "100%",
            height: "100%",
            cursor: "grab",
            touchAction: "none",
            display: renderMode === "3D" ? "block" : "none",
          }}
        />
        <div
          style={{
            width: "100%",
            height: "100%",
            display: renderMode === "2D" ? "flex" : "none",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
          }}
        >
          <canvas
            ref={canvas2DRef}
            width={800}
            height={650}
            style={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%" }}
          />
        </div>

        {/* Retícula Táctica Overlay */}
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            background: "rgba(6, 12, 24, 0.8)",
            border: "1px solid rgba(0, 240, 255, 0.25)",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "11px",
            pointerEvents: "none",
          }}
        >
          <div style={{ color: "#00f0ff", fontWeight: 700, marginBottom: "4px" }}>
            SUSTRATO COGNITIVO INTEGRADO
          </div>
          <div style={{ color: "#a0aec0" }}>
            • Neocórtex: {humanBrainSnapshot?.alertLevel || "NORMAL"} (MEC Grid 4-Scale)
          </div>
          <div style={{ color: "#a0aec0" }}>
            • Subcorteza: MaleCNS 124k neuronas (VNC 6-Patas CPG)
          </div>
          <div style={{ color: "#a0aec0" }}>
            • Guardián: Cúpula activa de 64-bit Hamming
          </div>
          <div style={{ color: "#a0aec0" }}>
            • RF Malla: 4 Torres LoRa + Satélite LEO Geohash-4
          </div>
        </div>

        {/* Controles de Vista y Cámara flotantes */}
        <div
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* Switch 3D vs 2D */}
          <div
            style={{
              display: "flex",
              background: "rgba(6, 12, 24, 0.9)",
              border: "1px solid rgba(0, 240, 255, 0.3)",
              borderRadius: "6px",
              padding: "2px",
            }}
          >
            <button
              onClick={() => {
                TacticalAudioEngine.playTap();
                setRenderMode("3D");
              }}
              style={{
                background: renderMode === "3D" ? "#00f0ff" : "transparent",
                color: renderMode === "3D" ? "#02060e" : "#8b9bb4",
                border: "none",
                borderRadius: "4px",
                padding: "6px 12px",
                fontSize: "11px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              3D WEBGL
            </button>
            <button
              onClick={() => {
                TacticalAudioEngine.playTap();
                setRenderMode("2D");
              }}
              style={{
                background: renderMode === "2D" ? "#00ff88" : "transparent",
                color: renderMode === "2D" ? "#02060e" : "#8b9bb4",
                border: "none",
                borderRadius: "4px",
                padding: "6px 12px",
                fontSize: "11px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              2D RADAR
            </button>
          </div>

          {/* Controles de Zoom Táctico (+, -, Reset) */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              background: "rgba(6, 12, 24, 0.9)",
              border: "1px solid rgba(0, 240, 255, 0.25)",
              borderRadius: "6px",
              padding: "4px",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => {
                TacticalAudioEngine.playTap();
                if (renderMode === "3D" && engine3DRef.current) engine3DRef.current.zoomIn();
                if (renderMode === "2D" && engine2DRef.current) engine2DRef.current.zoomIn();
              }}
              title="Acercar Zoom"
              style={{
                background: "rgba(0, 240, 255, 0.15)",
                color: "#00f0ff",
                border: "1px solid rgba(0, 240, 255, 0.4)",
                borderRadius: "4px",
                width: "28px",
                height: "28px",
                fontSize: "14px",
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
            <button
              onClick={() => {
                TacticalAudioEngine.playTap();
                if (renderMode === "3D" && engine3DRef.current) engine3DRef.current.zoomOut();
                if (renderMode === "2D" && engine2DRef.current) engine2DRef.current.zoomOut();
              }}
              title="Alejar Zoom"
              style={{
                background: "rgba(0, 240, 255, 0.15)",
                color: "#00f0ff",
                border: "1px solid rgba(0, 240, 255, 0.4)",
                borderRadius: "4px",
                width: "28px",
                height: "28px",
                fontSize: "14px",
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              -
            </button>
            <button
              onClick={() => {
                TacticalAudioEngine.playTap();
                if (renderMode === "3D" && engine3DRef.current) engine3DRef.current.resetCamera();
                if (renderMode === "2D" && engine2DRef.current) engine2DRef.current.resetZoom();
              }}
              title="Resetear Cámara"
              style={{
                background: "rgba(0, 255, 136, 0.15)",
                color: "#00ff88",
                border: "1px solid rgba(0, 255, 136, 0.4)",
                borderRadius: "4px",
                width: "28px",
                height: "28px",
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ⊙
            </button>
          </div>

          {/* Selector de Cámara (solo en 3D) */}
          {renderMode === "3D" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                background: "rgba(6, 12, 24, 0.9)",
                border: "1px solid rgba(0, 240, 255, 0.2)",
                borderRadius: "6px",
                padding: "6px",
              }}
            >
              <div style={{ fontSize: "9px", color: "#8b9bb4", fontWeight: 700, paddingLeft: "4px" }}>
                CÁMARA TÁCTICA
              </div>
              <button
                onClick={() => handleCameraChange("ORBITAL")}
                style={{
                  background: cameraMode === "ORBITAL" ? "rgba(0, 240, 255, 0.2)" : "transparent",
                  color: cameraMode === "ORBITAL" ? "#00f0ff" : "#8b9bb4",
                  border: "1px solid",
                  borderColor: cameraMode === "ORBITAL" ? "#00f0ff" : "transparent",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  fontSize: "10px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                ORBITAL LIBRE
              </button>
              <button
                onClick={() => handleCameraChange("FOLLOW_FLY")}
                style={{
                  background: cameraMode === "FOLLOW_FLY" ? "rgba(0, 240, 255, 0.2)" : "transparent",
                  color: cameraMode === "FOLLOW_FLY" ? "#00f0ff" : "#8b9bb4",
                  border: "1px solid",
                  borderColor: cameraMode === "FOLLOW_FLY" ? "#00f0ff" : "transparent",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  fontSize: "10px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                SEGUIR MOSCA (3RA PERSONA)
              </button>
              <button
                onClick={() => handleCameraChange("TOP_DOWN_GOD")}
                style={{
                  background: cameraMode === "TOP_DOWN_GOD" ? "rgba(0, 240, 255, 0.2)" : "transparent",
                  color: cameraMode === "TOP_DOWN_GOD" ? "#00f0ff" : "#8b9bb4",
                  border: "1px solid",
                  borderColor: cameraMode === "TOP_DOWN_GOD" ? "#00f0ff" : "transparent",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  fontSize: "10px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                CENITAL (DIOS)
              </button>
            </div>
          )}
        </div>

        {/* D-Pad Manual si el control manual está activo */}
        {isManualControl && (
          <div
            style={{
              position: "absolute",
              bottom: "80px",
              right: "20px",
              display: "grid",
              gridTemplateColumns: "repeat(3, 44px)",
              gridTemplateRows: "repeat(3, 44px)",
              gap: "4px",
              background: "rgba(6, 12, 24, 0.85)",
              border: "1px solid #00f0ff",
              borderRadius: "10px",
              padding: "6px",
            }}
          >
            <div />
            <button
              onClick={() => handleManualSteer(0, 2.5)}
              style={{ background: "rgba(0, 240, 255, 0.2)", border: "1px solid #00f0ff", color: "#fff", borderRadius: "6px", cursor: "pointer" }}
            >
              ▲
            </button>
            <div />
            <button
              onClick={() => handleManualSteer(-30, 2.0)}
              style={{ background: "rgba(0, 240, 255, 0.2)", border: "1px solid #00f0ff", color: "#fff", borderRadius: "6px", cursor: "pointer" }}
            >
              ◀
            </button>
            <button
              onClick={() => handleManualSteer(0, 0)}
              style={{ background: "rgba(255, 51, 85, 0.2)", border: "1px solid #ff3355", color: "#fff", borderRadius: "6px", cursor: "pointer" }}
            >
              ■
            </button>
            <button
              onClick={() => handleManualSteer(30, 2.0)}
              style={{ background: "rgba(0, 240, 255, 0.2)", border: "1px solid #00f0ff", color: "#fff", borderRadius: "6px", cursor: "pointer" }}
            >
              ▶
            </button>
            <div />
            <button
              onClick={() => handleManualSteer(180, 1.8)}
              style={{ background: "rgba(0, 240, 255, 0.2)", border: "1px solid #00f0ff", color: "#fff", borderRadius: "6px", cursor: "pointer" }}
            >
              ▼
            </button>
            <div />
          </div>
        )}
      </div>

      {/* ── 3. Barra Inferior de Disparo de Estímulos Tácticos ──────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderTop: "1px solid rgba(0, 240, 255, 0.2)",
          background: "linear-gradient(0deg, rgba(6, 12, 24, 0.95) 0%, rgba(2, 6, 14, 0.85) 100%)",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={handleToggleControlMode}
            style={{
              background: isManualControl ? "rgba(255, 179, 0, 0.2)" : "rgba(0, 240, 255, 0.15)",
              border: `1px solid ${isManualControl ? "#ffb300" : "#00f0ff"}`,
              color: isManualControl ? "#ffb300" : "#00f0ff",
              borderRadius: "6px",
              padding: "8px 14px",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {isManualControl ? "🎮 MODO MANUAL ACTIVO" : "🤖 MODO AUTÓNOMO (Malla)"}
          </button>
        </div>

        {/* Botones de Estímulos */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={handleInjectThreat}
            style={{
              background: "rgba(255, 51, 85, 0.15)",
              border: "1px solid #ff3355",
              color: "#ff3355",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ⚡ INYECTAR AMENAZA (LOOMING)
          </button>

          <button
            onClick={handleInjectJamming}
            style={{
              background: "rgba(255, 179, 0, 0.15)",
              border: "1px solid #ffb300",
              color: "#ffb300",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📡 INTERFERENCIA RF JAMMING
          </button>

          <button
            onClick={handleSpawnDtnPacket}
            style={{
              background: "rgba(0, 255, 136, 0.15)",
              border: "1px solid #00ff88",
              color: "#00ff88",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📦 GENERAR PAQUETE DTN
          </button>

          <button
            onClick={handleTestGuardianFirewall}
            style={{
              background: "rgba(0, 240, 255, 0.15)",
              border: "1px solid #00f0ff",
              color: "#00f0ff",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🛡️ TEST FUEGO GUARDIAN IA
          </button>
        </div>
      </div>
    </div>
  );
};

export default TacticalVivariumModal;
