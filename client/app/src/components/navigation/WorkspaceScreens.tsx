"use client";

/**
 * WorkspaceScreens.tsx — RED v104.0.0
 *
 * Router de pantallas compartido entre mobile y tablet.
 * Elimina la duplicación de 62 condicionales `currentScreen` que existían
 * en page.tsx (una vez para mobile, otra para tablet = 124 ramas en total).
 *
 * Uso:
 *   <WorkspaceScreens isTablet={true|false} onOpenTool={(s) => navigate(s)} />
 *
 * - isTablet=true  → el screen "sidebar" renderiza TacticalTabletWorkspace
 * - isTablet=false → el screen "sidebar" devuelve null (MainNavigationShell lo
 *                    maneja el padre en page.tsx)
 */

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRedStore, ScreenView } from "../../store/useRedStore";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { TacIcon } from "../ui/TacIcon";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { satelliteMeshGateway } from "../../lib/mesh/SatelliteMeshGatewayEngine";

// ── Loader local ──────────────────────────────────────────────────────────────
function AppLoader() {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "100%", height: "100%", background: "var(--bg-void)",
        color: "var(--text-muted)", fontSize: "14px", gap: "10px",
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      <span style={{ animation: "pulse 1s infinite" }}>⚙</span>
      CARGANDO BÓVEDA TÁCTICA…
    </div>
  );
}

// ── Dynamic Screen Imports (62 módulos) ───────────────────────────────────────
const ChatWindow             = dynamic(() => import("../ChatWindow"),            { ssr: false, loading: () => <AppLoader /> });
const SecurityPanel          = dynamic(() => import("../SecurityPanel"),         { ssr: false, loading: () => <AppLoader /> });
const RadarWindow            = dynamic(() => import("../RadarWindow"),           { ssr: false, loading: () => <AppLoader /> });
const CallScreen             = dynamic(() => import("../CallScreen"),            { ssr: false, loading: () => <AppLoader /> });
const BroadcastPanel         = dynamic(() => import("../BroadcastPanel"),        { ssr: false, loading: () => <AppLoader /> });
const CryptoPanel            = dynamic(() => import("../CryptoPanel"),           { ssr: false, loading: () => <AppLoader /> });
const GroupsPanel            = dynamic(() => import("../GroupsPanel"),           { ssr: false, loading: () => <AppLoader /> });
const StatusView             = dynamic(() => import("../StatusView"),            { ssr: false, loading: () => <AppLoader /> });
const BlockchainExplorer     = dynamic(() => import("../BlockchainExplorer"),    { ssr: false, loading: () => <AppLoader /> });
const NodeMap                = dynamic(() => import("../NodeMap"),               { ssr: false, loading: () => <AppLoader /> });
const NetworkPanel           = dynamic(() => import("../NetworkPanel"),          { ssr: false, loading: () => <AppLoader /> });
const DMSSettings            = dynamic(() => import("../DMSSettings"),           { ssr: false, loading: () => <AppLoader /> });
const AmberAdminPanel        = dynamic(() => import("../AmberAdminPanel"),       { ssr: false, loading: () => <AppLoader /> });
const GuardianStatusPanel    = dynamic(() => import("../GuardianStatusPanel"),   { ssr: false, loading: () => <AppLoader /> });
const NearbyDevicesPanel     = dynamic(() => import("../NearbyDevicesPanel"),    { ssr: false, loading: () => <AppLoader /> });
const GlobalShieldPanel      = dynamic(() => import("../GlobalShieldPanel"),     { ssr: false, loading: () => <AppLoader /> });
const Web3VaultModal         = dynamic(() => import("../Web3VaultModal"),        { ssr: false, loading: () => <AppLoader /> });
const RedShowcaseLanding     = dynamic(() => import("../RedShowcaseLanding"),    { ssr: false, loading: () => <AppLoader /> });

const P2PCompassModal        = dynamic(() => import("../P2PCompassModal").then(m => ({ default: m.P2PCompassModal })),              { ssr: false, loading: () => <AppLoader /> });
const PublicChannelsPanel    = dynamic(() => import("../PublicChannelsPanel").then(m => ({ default: m.PublicChannelsPanel })),      { ssr: false, loading: () => <AppLoader /> });
const SocialFeedPanel        = dynamic(() => import("../SocialFeedPanel").then(m => ({ default: m.SocialFeedPanel })),             { ssr: false, loading: () => <AppLoader /> });
const P2PWalkieTalkieModal   = dynamic(() => import("../P2PWalkieTalkieModal").then(m => ({ default: m.P2PWalkieTalkieModal })),   { ssr: false, loading: () => <AppLoader /> });
const WeatherAlertPanel      = dynamic(() => import("../WeatherAlertPanel").then(m => ({ default: m.WeatherAlertPanel })),         { ssr: false, loading: () => <AppLoader /> });
const IdentityVaultModal     = dynamic(() => import("../IdentityVaultModal").then(m => ({ default: m.IdentityVaultModal })),       { ssr: false, loading: () => <AppLoader /> });
const ProximityWaveModal     = dynamic(() => import("../ProximityWaveModal").then(m => ({ default: m.ProximityWaveModal })),       { ssr: false, loading: () => <AppLoader /> });
const LiveCanvasModal        = dynamic(() => import("../LiveCanvasModal").then(m => ({ default: m.LiveCanvasModal })),             { ssr: false, loading: () => <AppLoader /> });
const EcoMeshPanel           = dynamic(() => import("../EcoMeshPanel").then(m => ({ default: m.EcoMeshPanel })),                  { ssr: false, loading: () => <AppLoader /> });
const ProximitySettingsModal = dynamic(() => import("../ProximitySettingsModal").then(m => ({ default: m.ProximitySettingsModal })), { ssr: false, loading: () => <AppLoader /> });
const AICopilotModal         = dynamic(() => import("../AICopilotModal").then(m => ({ default: m.AICopilotModal })),              { ssr: false, loading: () => <AppLoader /> });
const LiveStreamBroadcaster  = dynamic(() => import("../LiveStreamBroadcaster").then(m => ({ default: m.LiveStreamBroadcaster })), { ssr: false, loading: () => <AppLoader /> });
const OffGridCompassModal    = dynamic(() => import("../OffGridCompassModal").then(m => ({ default: m.OffGridCompassModal })),     { ssr: false, loading: () => <AppLoader /> });
const VitalScanModal         = dynamic(() => import("../VitalScanModal").then(m => ({ default: m.VitalScanModal })),              { ssr: false, loading: () => <AppLoader /> });
const SurvivalBeaconModal    = dynamic(() => import("../SurvivalBeaconModal").then(m => ({ default: m.SurvivalBeaconModal })),    { ssr: false, loading: () => <AppLoader /> });
const TacticalVisionScanModal = dynamic(() => import("../TacticalVisionScanModal").then(m => ({ default: m.TacticalVisionScanModal })), { ssr: false, loading: () => <AppLoader /> });
const ShamirRecoveryModal    = dynamic(() => import("../ShamirRecoveryModal").then(m => ({ default: m.ShamirRecoveryModal })),    { ssr: false, loading: () => <AppLoader /> });
const CbrnSatelliteModal     = dynamic(() => import("../CbrnSatelliteModal").then(m => ({ default: m.CbrnSatelliteModal })),      { ssr: false, loading: () => <AppLoader /> });
const ZkBarterSubsurfaceModal = dynamic(() => import("../ZkBarterSubsurfaceModal").then(m => ({ default: m.ZkBarterSubsurfaceModal })), { ssr: false, loading: () => <AppLoader /> });
const TcccBallisticsModal    = dynamic(() => import("../TcccBallisticsModal").then(m => ({ default: m.TcccBallisticsModal })),    { ssr: false, loading: () => <AppLoader /> });
const C4isrEmpDrillModal     = dynamic(() => import("../C4isrEmpDrillModal").then(m => ({ default: m.C4isrEmpDrillModal })),     { ssr: false, loading: () => <AppLoader /> });
const AirGapStegoModal       = dynamic(() => import("../AirGapStegoModal").then(m => ({ default: m.AirGapStegoModal })),         { ssr: false, loading: () => <AppLoader /> });
const CelestialPdrModal      = dynamic(() => import("../CelestialPdrModal").then(m => ({ default: m.CelestialPdrModal })),       { ssr: false, loading: () => <AppLoader /> });
const AcousticWarfareModal   = dynamic(() => import("../AcousticWarfareModal").then(m => ({ default: m.AcousticWarfareModal })), { ssr: false, loading: () => <AppLoader /> });
const VitalResourcesModal    = dynamic(() => import("../VitalResourcesModal").then(m => ({ default: m.VitalResourcesModal })),   { ssr: false, loading: () => <AppLoader /> });
const SonarSeismicModal      = dynamic(() => import("../SonarSeismicModal").then(m => ({ default: m.SonarSeismicModal })),       { ssr: false, loading: () => <AppLoader /> });
const TacticalFoxhuntModal   = dynamic(() => import("../TacticalFoxhuntModal").then(m => ({ default: m.TacticalFoxhuntModal })), { ssr: false, loading: () => <AppLoader /> });
const AtmosphericSafetyModal = dynamic(() => import("../AtmosphericSafetyModal").then(m => ({ default: m.AtmosphericSafetyModal })), { ssr: false, loading: () => <AppLoader /> });
const RfSpectrumModal        = dynamic(() => import("../RfSpectrumModal").then(m => ({ default: m.RfSpectrumModal })),           { ssr: false, loading: () => <AppLoader /> });
const StegoVaultModal        = dynamic(() => import("../StegoVaultModal").then(m => ({ default: m.StegoVaultModal })),           { ssr: false, loading: () => <AppLoader /> });
const ShakePairModal         = dynamic(() => import("../ShakePairModal").then(m => ({ default: m.ShakePairModal })),             { ssr: false, loading: () => <AppLoader /> });
const RedP2PPayModal         = dynamic(() => import("../RedP2PPayModal").then(m => ({ default: m.RedP2PPayModal })),             { ssr: false, loading: () => <AppLoader /> });
const BlackoutSimulatorModal = dynamic(() => import("../BlackoutSimulatorModal").then(m => ({ default: m.BlackoutSimulatorModal })), { ssr: false, loading: () => <AppLoader /> });
const SystemHealthModal      = dynamic(() => import("../SystemHealthModal").then(m => ({ default: m.SystemHealthModal })),       { ssr: false, loading: () => <AppLoader /> });
const NodeLogsModal          = dynamic(() => import("../NodeLogsModal").then(m => ({ default: m.NodeLogsModal })),               { ssr: false, loading: () => <AppLoader /> });
const CalculatorScreen       = dynamic(() => import("../CalculatorScreen").then(m => ({ default: m.CalculatorScreen })),         { ssr: false, loading: () => <AppLoader /> });
const SecurityReportModal    = dynamic(() => import("../SecurityReportModal").then(m => ({ default: m.SecurityReportModal })),   { ssr: false, loading: () => <AppLoader /> });
const BackupRestoreModal     = dynamic(() => import("../BackupRestoreModal").then(m => ({ default: m.BackupRestoreModal })),     { ssr: false, loading: () => <AppLoader /> });
const WebCompanionLinkModal  = dynamic(() => import("../WebCompanionLinkModal").then(m => ({ default: m.WebCompanionLinkModal })), { ssr: false, loading: () => <AppLoader /> });
const LinkedDevicesView      = dynamic(() => import("../settings/LinkedDevicesView").then(m => ({ default: m.LinkedDevicesView })), { ssr: false, loading: () => <AppLoader /> });
const SettingsModal          = dynamic(() => import("../SettingsModal").then(m => ({ default: m.SettingsModal })),               { ssr: false, loading: () => <AppLoader /> });
const UpdateModal            = dynamic(() => import("../UpdateModal").then(m => ({ default: m.UpdateModal })),                   { ssr: false, loading: () => <AppLoader /> });
const CommercialHubModal     = dynamic(() => import("../CommercialHubModal").then(m => ({ default: m.CommercialHubModal })),     { ssr: false, loading: () => <AppLoader /> });
const SwarmHealthHUD         = dynamic(() => import("../SwarmHealthHUD").then(m => ({ default: m.SwarmHealthHUD })),             { ssr: false, loading: () => <AppLoader /> });
const ExtremeSurvivalHudModal = dynamic(() => import("../ExtremeSurvivalHudModal").then(m => ({ default: m.ExtremeSurvivalHudModal })), { ssr: false, loading: () => <AppLoader /> });
const LoraTransceiverModal   = dynamic(() => import("../LoraTransceiverModal").then(m => ({ default: m.LoraTransceiverModal })), { ssr: false, loading: () => <AppLoader /> });
const TacticalCommandCenter  = dynamic(() => import("../TacticalCommandCenter").then(m => ({ default: m.TacticalCommandCenter })), { ssr: false, loading: () => <AppLoader /> });
const RedHyperBrowserModal   = dynamic(() => import("../miniapp/RedHyperBrowserModal").then(m => ({ default: m.RedHyperBrowserModal })), { ssr: false, loading: () => <AppLoader /> });
const SovereignAppStoreModal = dynamic(() => import("../miniapp/SovereignAppStoreModal").then(m => ({ default: m.SovereignAppStoreModal })), { ssr: false, loading: () => <AppLoader /> });
const MiniAppContainerModal  = dynamic(() => import("../miniapp/MiniAppContainerModal").then(m => ({ default: m.MiniAppContainerModal })), { ssr: false, loading: () => <AppLoader /> });
const TacticalGhostGpsModal  = dynamic(() => import("../modals/TacticalGhostGpsModal").then(m => ({ default: m.TacticalGhostGpsModal })), { ssr: false, loading: () => <AppLoader /> });
const RedCyberTunnelModal    = dynamic(() => import("../modals/RedCyberTunnelModal").then(m => ({ default: m.RedCyberTunnelModal })), { ssr: false, loading: () => <AppLoader /> });
const SovereignShieldDashboard = dynamic(() => import("../SovereignShieldDashboard"), { ssr: false, loading: () => <AppLoader /> });
const MaleCnsConnectomeHUD    = dynamic(() => import("../MaleCnsConnectomeHUD").then(m => ({ default: m.MaleCnsConnectomeHUD })), { ssr: false, loading: () => <AppLoader /> });
const TacticalVivariumModal   = dynamic(() => import("../tactical/TacticalVivariumModal").then(m => ({ default: m.TacticalVivariumModal })), { ssr: false, loading: () => <AppLoader /> });


// ── TacticalTabletWorkspace ───────────────────────────────────────────────────
// Placeholder del pane derecho en tablet cuando currentScreen === "sidebar".
// Movido desde page.tsx para mantener cohesión con WorkspaceScreens.
interface TacticalTabletWorkspaceProps { onOpenTool: (screen: ScreenView) => void; }

const TABLET_QUICK_TOOLS = [
  { screen: "nodemap",      iconName: "map" as const,      colorKey: "var(--accent-cyan)",    bg: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.25)" },
  { screen: "radar",        iconName: "radio" as const,    colorKey: "var(--accent-emerald)", bg: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0, 230, 118, 0.25)" },
  { screen: "channels",     iconName: "radio" as const,    colorKey: "var(--accent-amber)",   bg: "rgba(255, 179, 0, 0.08)",  border: "1px solid rgba(255, 179, 0, 0.25)" },
  { screen: "canvas",       iconName: "palette" as const,  colorKey: "var(--accent-purple)",  bg: "rgba(179, 136, 255, 0.08)", border: "1px solid rgba(179, 136, 255, 0.25)" },
  { screen: "appStore",     iconName: "box" as const,      colorKey: "var(--accent-emerald)", bg: "linear-gradient(135deg, rgba(0,230,118,0.12) 0%, rgba(0,229,255,0.06) 100%)", border: "1px solid rgba(0,230,118,0.3)" },
  { screen: "hyperBrowser", iconName: "globe" as const,    colorKey: "var(--accent-cyan)",    bg: "linear-gradient(135deg, rgba(0,229,255,0.12) 0%, rgba(138,43,226,0.06) 100%)", border: "1px solid rgba(0,229,255,0.3)" },
  { screen: "updater",      iconName: "zap" as const,      colorKey: "var(--accent-cyan)",    bg: "linear-gradient(135deg, rgba(0,229,255,0.16) 0%, rgba(0,150,255,0.08) 100%)", border: "1px solid rgba(0,229,255,0.4)" },
  { screen: "settings",     iconName: "settings" as const, colorKey: "var(--primary-bright)", bg: "rgba(255, 51, 85, 0.08)",  border: "1px solid rgba(255, 51, 85, 0.25)" },
] as const;

function TacticalTabletWorkspace({ onOpenTool }: TacticalTabletWorkspaceProps) {
  const { identity } = useRedStore();
  const { t } = useTranslation();
  const [peerCount, setPeerCount] = useState(() => meshRouter.peers.size);
  const [satAos, setSatAos] = useState(() => satelliteMeshGateway.getTelemetry().isUplinkAvailable);

  useEffect(() => {
    setPeerCount(meshRouter.peers.size);
    const unsubPeers = meshRouter.onPeersChange(p => setPeerCount(p.size));
    const unsubSat = satelliteMeshGateway.subscribe(tel => setSatAos(tel.isUplinkAvailable));
    return () => {
      unsubPeers();
      unsubSat();
    };
  }, []);

  return (
    <div
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        padding: "32px 32px",
        gap: "24px",
        overflowY: "auto",
        width: "100%",
        maxWidth: "1380px",
        margin: "0 auto",
      }}
    >
      {/* Top Panoramic Header & Identity */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        flexWrap: "wrap",
        gap: "16px",
        paddingBottom: "18px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: 52, height: 52, borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(232,33,58,0.25) 0%, rgba(0,229,255,0.18) 100%)",
              border: "1px solid rgba(0, 229, 255, 0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}
          >
            <TacIcon name="shield" size={28} color="#00E5FF" />
          </div>
          <div style={{ textAlign: "left" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.5px", margin: 0 }}>
              {t("tablet.title")}
            </h2>
            <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "3px", margin: 0 }}>
              {t("tablet.subtitle")}
            </p>
          </div>
        </div>

        {/* Live Sovereign Badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 16px",
          borderRadius: "20px",
          background: "rgba(0,230,118,0.06)",
          border: "1px solid rgba(0,230,118,0.25)",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00E676", boxShadow: "0 0 8px #00E676", display: "inline-block" }} />
          <span style={{ fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace", color: "var(--accent-emerald)", fontWeight: 700 }}>
            {t("tablet.sovereign_node")} · {identity?.short_id || "OFFLINE"} · ED25519 / SLED
          </span>
        </div>
      </div>

      {/* C4ISR Tactical Operations Banner (Panorámico) */}
      <div
        onClick={() => onOpenTool("commandCenter")}
        className="card-tactical-interactive"
        style={{
          width: "100%",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          background: "linear-gradient(135deg, rgba(0,229,255,0.14) 0%, rgba(179,136,255,0.08) 50%, rgba(10,25,45,0.6) 100%)",
          border: "1.5px solid rgba(0,229,255,0.45)",
          borderRadius: "16px",
          cursor: "pointer",
          boxShadow: "0 8px 30px rgba(0,229,255,0.12)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", textAlign: "left", flex: 1, minWidth: "260px" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "12px",
            background: "rgba(0, 229, 255, 0.15)",
            border: "1px solid rgba(0, 229, 255, 0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <TacIcon name="zap" size={26} color="#00E5FF" />
          </div>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.6px" }}>
              {t("tablet.c4isr_title")}
            </div>
            <div style={{ fontSize: "0.76rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 800, marginTop: "2px" }}>
              {t("tablet.c4isr_sub")}
            </div>
          </div>
        </div>

        {/* Live HUD Telemetry Chips inside C4ISR Hero */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{
            padding: "6px 12px", borderRadius: "8px",
            background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <TacIcon name="users" size={14} color="#00E5FF" />
            <span style={{ fontSize: "0.74rem", fontFamily: "JetBrains Mono, monospace", color: "#E0E6ED" }}>
              {t("tablet.p2p_mesh")}: <strong style={{ color: "#00E5FF" }}>{peerCount} {t("tablet.nodes")}</strong>
            </span>
          </div>

          <div style={{
            padding: "6px 12px", borderRadius: "8px",
            background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <TacIcon name="satellite" size={14} color={satAos ? "#00E676" : "#8696A0"} />
            <span style={{ fontSize: "0.74rem", fontFamily: "JetBrains Mono, monospace", color: satAos ? "#00E676" : "#8696A0" }}>
              {t("tablet.sat_leo")}: {satAos ? t("tablet.aos_active") : t("tablet.standby")}
            </span>
          </div>

          <div style={{
            padding: "6px 14px", borderRadius: "10px",
            background: "rgba(0, 229, 255, 0.2)",
            border: "1px solid rgba(0, 229, 255, 0.5)",
            color: "#00E5FF", fontWeight: 900, fontSize: "0.82rem",
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            <span>{t("tablet.enter")}</span>
            <TacIcon name="chevron-right" size={14} color="#00E5FF" />
          </div>
        </div>
      </div>

      {/* Quick-access grid (8 Tactical Tools) - Responsive Fluid Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "14px",
        width: "100%",
      }}>
        {TABLET_QUICK_TOOLS.map(tool => {
          const screenKey = tool.screen === "hyperBrowser" ? "browser" : tool.screen === "appStore" ? "appstore" : tool.screen === "nodemap" ? "map" : tool.screen;
          const titleKey = `tablet.${screenKey}_title` as any;
          const subKey   = `tablet.${screenKey}_sub` as any;
          return (
            <div
              key={tool.screen}
              onClick={() => onOpenTool(tool.screen)}
              className="card-tactical-interactive"
              style={{
                padding: "18px 14px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                borderRadius: "14px",
                background: (tool as any).bg,
                border: (tool as any).border,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: "12px",
                background: "rgba(0,0,0,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 4px 14px ${tool.colorKey}22`,
              }}>
                <TacIcon name={tool.iconName} size={22} color={tool.colorKey} />
              </div>
              <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "#FFFFFF" }}>
                {t(titleKey) || (tool.screen === "nodemap" ? "Mapa Táctico GPS" : tool.screen)}
              </span>
              <span style={{ fontSize: "0.66rem", color: tool.colorKey, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, letterSpacing: "0.4px" }}>
                {t(subKey) || (tool.screen === "nodemap" ? "OFFLINE OPENSTREETMAP" : "")}
              </span>
            </div>
          );
        })}
      </div>

      {/* Real-time Hardware & Telemetry Bar */}
      <div style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "12px",
        marginTop: "auto",
        paddingTop: "12px",
      }}>
        <div style={{
          padding: "10px 14px", borderRadius: "10px",
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: "10px", textAlign: "left",
        }}>
          <TacIcon name="lock" size={16} color="var(--accent-cyan)" />
          <div>
            <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>{t("tablet.pqc_cipher")}</div>
            <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#FFFFFF" }}>AES-256-GCM + Kyber</div>
          </div>
        </div>

        <div style={{
          padding: "10px 14px", borderRadius: "10px",
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: "10px", textAlign: "left",
        }}>
          <TacIcon name="radio" size={16} color="var(--accent-emerald)" />
          <div>
            <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>{t("tablet.radio_link")}</div>
            <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#FFFFFF" }}>TDMA LoRa + BLE MESH</div>
          </div>
        </div>

        <div style={{
          padding: "10px 14px", borderRadius: "10px",
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: "10px", textAlign: "left",
        }}>
          <TacIcon name="shield" size={16} color="var(--accent-amber)" />
          <div>
            <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>{t("tablet.vault_integrity")}</div>
            <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#FFFFFF" }}>{t("tablet.sled_airgap")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WorkspaceScreens ──────────────────────────────────────────────────────────
export interface WorkspaceScreensProps {
  /** true = tablet split layout; false = single-column mobile */
  isTablet: boolean;
  /** Callback para navegar a una pantalla desde atajos internos */
  onOpenTool: (screen: ScreenView) => void;
}

export function WorkspaceScreens({ isTablet, onOpenTool }: WorkspaceScreensProps) {
  const {
    currentScreen,
    goBack,
    navigate,
    identity,
    activeMiniAppBundle,
    launchMiniApp,
    preferences,
    isCallPipMinimized,
  } = useRedStore();

  // ── Calculator dual-PIN unlock (master / decoy / panic) ───────────────────
  const handleCalculatorUnlock = async (pin: string): Promise<boolean> => {
    try {
      const { verifySecurePin } = await import("../../lib/crypto/BiometricLockEngine");

      const isPanic = await verifySecurePin("panic_pin", pin);
      if (isPanic) {
        // Panic PIN (Coerción): Conmuta silenciosamente a la Bóveda Señuelo y purga en background
        useRedStore.getState().enableDecoyVault();
        const { duressWipe } = await import("../../lib/security/DuressWipeEngine");
        duressWipe.executeZeroizeWipe({ silent: true, preserveDecoySession: true }).catch(() => {});
        goBack();
        return true;
      }

      const isDecoy  = await verifySecurePin("decoy_pin",  pin);
      const isMaster = await verifySecurePin("master_pin", pin);
      if (isMaster || isDecoy) {
        goBack();
        return true;
      }
    } catch {
      // Silencioso: no revelar detalles de fallo en la UI del decoy
    }
    return false;
  };

  // ── Sidebar special-case ──────────────────────────────────────────────────
  // Tablet: mostrar workspace placeholder. Mobile: null (MainNavigationShell
  // en page.tsx se encarga de renderizar cuando currentScreen === "sidebar").
  if (currentScreen === "sidebar") {
    return isTablet ? <TacticalTabletWorkspace onOpenTool={onOpenTool} /> : null;
  }

  // ── Screen Router ─────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Comms ── */}
      {currentScreen === "chat"                                             && <ChatWindow />}
      {currentScreen === "broadcast"                                        && <BroadcastPanel />}
      {(currentScreen === "channels" || currentScreen === "publicChannels") && <PublicChannelsPanel />}
      {(currentScreen === "groups"   || currentScreen === "squads")         && <GroupsPanel />}
      {currentScreen === "socialFeed"                                       && <SocialFeedPanel />}
      {(currentScreen === "canvas"   || currentScreen === "liveCanvas")     && <LiveCanvasModal />}
      {currentScreen === "liveStream"                                       && <LiveStreamBroadcaster onClose={goBack} />}
      {currentScreen === "loraTransceiver"                                  && <LoraTransceiverModal onClose={goBack} />}

      {/* ── Radar & Navigation ── */}
      {currentScreen === "radar"                                               && <RadarWindow />}
      {currentScreen === "nodemap"                                             && <NodeMap />}
      {(currentScreen === "offGridCompass" || currentScreen === "compass")     && <OffGridCompassModal />}
      {currentScreen === "p2pCompass"                                          && <P2PCompassModal />}
      {currentScreen === "celestialPdr"                                        && <CelestialPdrModal />}
      {currentScreen === "sonarSeismic"                                        && <SonarSeismicModal />}
      {currentScreen === "tacticalFoxhunt"                                     && <TacticalFoxhuntModal />}
      {(currentScreen === "tacticalGhostGps" || currentScreen === "ghostGps")   && <TacticalGhostGpsModal />}
      {(currentScreen === "cyberTunnel" || currentScreen === "zeroRating")     && <RedCyberTunnelModal />}
      {currentScreen === "shakePair"                                           && <ShakePairModal />}
      {(currentScreen === "proximity" || currentScreen === "proximityWave")   && <ProximityWaveModal />}
      {(currentScreen === "nearby"    || currentScreen === "contacts")         && <NearbyDevicesPanel />}
      {(currentScreen === "proximitySettings" || currentScreen === "proximity_settings") && <ProximitySettingsModal />}

      {/* ── Voice & RF ── */}
      {currentScreen === "walkie"                                              && <P2PWalkieTalkieModal />}
      {currentScreen === "rfSpectrum"                                          && <RfSpectrumModal />}
      {currentScreen === "acousticWarfare"                                     && <AcousticWarfareModal />}
      {/* Call screen stays mounted while PiP is active to preserve WebRTC state */}
      {(currentScreen === "call" || isCallPipMinimized) && (
        <div style={{ display: currentScreen === "call" ? "block" : "none", width: "100%", height: "100%" }}>
          <CallScreen />
        </div>
      )}

      {/* ── AI ── */}
      {(currentScreen === "aiCopilot" || currentScreen === "copilot")         && <AICopilotModal />}
      {currentScreen === "tacticalVisionScan"                                  && <TacticalVisionScanModal />}
      {currentScreen === "c4isrEmpDrill"                                       && <C4isrEmpDrillModal />}
      {currentScreen === "guardian"                                            && <GuardianStatusPanel onClose={goBack} />}
      {currentScreen === "commandCenter"                                       && <TacticalCommandCenter />}

      {/* ── Vault & Crypto ── */}
      {(currentScreen === "idVault" || currentScreen === "identityVault")      && <IdentityVaultModal />}
      {(currentScreen === "p2pPay"  || currentScreen === "redP2PPay")          && <RedP2PPayModal />}
      {currentScreen === "zkBarterSubsurface"                                  && <ZkBarterSubsurfaceModal />}
      {currentScreen === "commercialHub" || currentScreen === "hub"            ? <CommercialHubModal isOpen={true} onClose={goBack} /> : null}
      {currentScreen === "crypto"                                              && <CryptoPanel />}
      {currentScreen === "web3Vault"                                           && <Web3VaultModal onClose={goBack} />}
      {currentScreen === "explorer"                                            && <BlockchainExplorer onClose={goBack} />}
      {currentScreen === "stegoVault"                                          && <StegoVaultModal />}
      {currentScreen === "airGapStego"                                         && <AirGapStegoModal />}
      {currentScreen === "shamirRecovery"                                      && <ShamirRecoveryModal />}
      {currentScreen === "backup"                                              && <BackupRestoreModal onClose={goBack} />}
      {(currentScreen === "webCompanionLink" || currentScreen === "companionLink") && (
        (preferences?.uiMode ?? "familiar") === "familiar" ? (
          <div style={{ position: "fixed", inset: 0, zIndex: 99999 }}>
            <LinkedDevicesView onClose={goBack} />
          </div>
        ) : (
          <WebCompanionLinkModal onClose={goBack} />
        )
      )}

      {/* ── Defense ── */}
      {(currentScreen === "sovereignShield" || currentScreen === "shield")     && <SovereignShieldDashboard onClose={goBack} />}
      {currentScreen === "globalShield"                                        && <GlobalShieldPanel />}
      {currentScreen === "cbrnSatellite"                                       && <CbrnSatelliteModal />}
      {currentScreen === "blackout"                                            && <BlackoutSimulatorModal onClose={goBack} />}
      {currentScreen === "dms"                                                 && <DMSSettings />}
      {currentScreen === "security"                                            && <SecurityPanel />}
      {currentScreen === "secReport"                                           && <SecurityReportModal onClose={goBack} />}
      {currentScreen === "calculator"                                          && <CalculatorScreen onUnlock={handleCalculatorUnlock} />}
      {currentScreen === "network"                                             && <NetworkPanel />}

      {/* ── Emergency ── */}
      {currentScreen === "vitalScan"                                           && <VitalScanModal />}
      {currentScreen === "tcccBallistics"                                      && <TcccBallisticsModal />}
      {(currentScreen === "survivalBeacon" || currentScreen === "sos")         && <SurvivalBeaconModal />}
      {(currentScreen === "amber" || currentScreen === "amberAdmin")           && <AmberAdminPanel onClose={goBack} />}
      {(currentScreen === "weather" || currentScreen === "weatherAlert")       && <WeatherAlertPanel />}
      {currentScreen === "atmosphericSafety"                                   && <AtmosphericSafetyModal />}
      {currentScreen === "vitalResources"                                      && <VitalResourcesModal />}
      {(currentScreen === "extremeSurvival" || currentScreen === "survivalHud") && <ExtremeSurvivalHudModal />}

      {/* ── System ── */}
      {currentScreen === "appStore" && (
        <SovereignAppStoreModal
          userDid={identity?.identity_hash || "did:red:guest"}
          onClose={goBack}
          onLaunchApp={(bundle) => launchMiniApp(bundle)}
        />
      )}
      {currentScreen === "hyperBrowser" && (
        <RedHyperBrowserModal
          userDid={identity?.identity_hash || "did:red:guest"}
          nickname={identity?.nickname || "Operador"}
          publicKey={identity?.identity_hash || "pk_00"}
          onClose={goBack}
          onLaunchMiniApp={(bundle) => launchMiniApp(bundle)}
        />
      )}
      {currentScreen === "miniApp" && activeMiniAppBundle && (
        <MiniAppContainerModal
          bundle={activeMiniAppBundle}
          userDid={identity?.identity_hash || "did:red:guest"}
          nickname={identity?.nickname || "Operador"}
          publicKey={identity?.identity_hash || "pk_00"}
          onClose={goBack}
        />
      )}
      {(currentScreen === "swarmHealthHUD" || currentScreen === "swarmHealth") && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100000,
            background: "rgba(2, 4, 10, 0.88)",
            backdropFilter: "blur(25px)", WebkitBackdropFilter: "blur(25px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
          }}
        >
          <SwarmHealthHUD onClose={goBack} />
        </div>
      )}
      {(currentScreen === "health" || currentScreen === "systemHealth")        && <SystemHealthModal onClose={goBack} />}
      {(currentScreen === "nodeLogs" || currentScreen === "logs")              && <NodeLogsModal onClose={goBack} />}
      {currentScreen === "settings"                                            && <SettingsModal onClose={goBack} />}
      {currentScreen === "updater"                                             && <UpdateModal onClose={goBack} />}
      {currentScreen === "ecoMesh"                                             && <EcoMeshPanel />}
      {currentScreen === "status"                                              && <StatusView />}

      {(currentScreen === "maleCnsConnectome" || currentScreen === "connectome") && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100000,
            background: "rgba(2, 4, 10, 0.90)",
            backdropFilter: "blur(25px)", WebkitBackdropFilter: "blur(25px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
          }}
        >
          <div style={{ width: "100%", maxWidth: "1180px", height: "92vh", display: "flex" }}>
            <MaleCnsConnectomeHUD onClose={goBack} />
          </div>
        </div>
      )}

      {currentScreen === "vivarium" && (
        <TacticalVivariumModal onClose={goBack} />
      )}

      {/* ── Landing (deep-link desde notificación) ── */}
      {currentScreen === "landing" && (
        <RedShowcaseLanding
          onEnterApp={(target) => navigate(target || "sidebar")}
          onEnterVault={(target) => navigate(target || "sidebar")}
        />
      )}
    </>
  );
}
