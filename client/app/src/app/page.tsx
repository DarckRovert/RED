"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";

/* ── Carga dinámica con ssr:false — previene crash de hidratación SSR ── */
const Sidebar               = dynamic(() => import("../components/Sidebar"),               { ssr: false, loading: () => <AppLoader /> });
const ChatWindow            = dynamic(() => import("../components/ChatWindow"),            { ssr: false, loading: () => <AppLoader /> });
const SecurityPanel         = dynamic(() => import("../components/SecurityPanel"),         { ssr: false, loading: () => <AppLoader /> });
const RadarWindow           = dynamic(() => import("../components/RadarWindow"),           { ssr: false, loading: () => <AppLoader /> });
const StatusHeader          = dynamic(() => import("../components/StatusHeader"),          { ssr: false, loading: () => <div style={{ height: 44 }} /> });
const CallScreen            = dynamic(() => import("../components/CallScreen"),            { ssr: false, loading: () => <AppLoader /> });
const BroadcastPanel        = dynamic(() => import("../components/BroadcastPanel"),        { ssr: false, loading: () => <AppLoader /> });
const CryptoPanel           = dynamic(() => import("../components/CryptoPanel"),           { ssr: false, loading: () => <AppLoader /> });
const GroupsPanel           = dynamic(() => import("../components/GroupsPanel"),           { ssr: false, loading: () => <AppLoader /> });
const StatusView            = dynamic(() => import("../components/StatusView"),            { ssr: false, loading: () => <AppLoader /> });
const BlockchainExplorer    = dynamic(() => import("../components/BlockchainExplorer"),    { ssr: false, loading: () => <AppLoader /> });
const AuthWall              = dynamic(() => import("../components/AuthWall"),              { ssr: false, loading: () => <FullScreenTacticalLoader /> });
const NodeMap               = dynamic(() => import("../components/NodeMap"),               { ssr: false, loading: () => <AppLoader /> });
const NetworkPanel          = dynamic(() => import("../components/NetworkPanel"),          { ssr: false, loading: () => <AppLoader /> });
const OnboardingProfile     = dynamic(() => import("../components/OnboardingProfile"),     { ssr: false, loading: () => <AppLoader /> });
const DMSSettings           = dynamic(() => import("../components/DMSSettings"),           { ssr: false, loading: () => <AppLoader /> });
const AmberAdminPanel       = dynamic(() => import("../components/AmberAdminPanel"),       { ssr: false, loading: () => <AppLoader /> });
const GuardianStatusPanel   = dynamic(() => import("../components/GuardianStatusPanel"),   { ssr: false, loading: () => <AppLoader /> });
const P2PCompassModal       = dynamic(() => import("../components/P2PCompassModal").then(m => ({ default: m.P2PCompassModal })),       { ssr: false, loading: () => <AppLoader /> });
const PublicChannelsPanel   = dynamic(() => import("../components/PublicChannelsPanel").then(m => ({ default: m.PublicChannelsPanel })),   { ssr: false, loading: () => <AppLoader /> });
const SocialFeedPanel       = dynamic(() => import("../components/SocialFeedPanel").then(m => ({ default: m.SocialFeedPanel })),       { ssr: false, loading: () => <AppLoader /> });
const P2PWalkieTalkieModal  = dynamic(() => import("../components/P2PWalkieTalkieModal").then(m => ({ default: m.P2PWalkieTalkieModal })),  { ssr: false, loading: () => <AppLoader /> });
const WeatherAlertPanel     = dynamic(() => import("../components/WeatherAlertPanel").then(m => ({ default: m.WeatherAlertPanel })),     { ssr: false, loading: () => <AppLoader /> });
const IdentityVaultModal    = dynamic(() => import("../components/IdentityVaultModal").then(m => ({ default: m.IdentityVaultModal })),    { ssr: false, loading: () => <AppLoader /> });
const ProximityWaveModal    = dynamic(() => import("../components/ProximityWaveModal").then(m => ({ default: m.ProximityWaveModal })),    { ssr: false, loading: () => <AppLoader /> });
const LiveCanvasModal       = dynamic(() => import("../components/LiveCanvasModal").then(m => ({ default: m.LiveCanvasModal })),       { ssr: false, loading: () => <AppLoader /> });
const EcoMeshPanel          = dynamic(() => import("../components/EcoMeshPanel").then(m => ({ default: m.EcoMeshPanel })),          { ssr: false, loading: () => <AppLoader /> });
const ProximitySettingsModal = dynamic(() => import("../components/ProximitySettingsModal").then(m => ({ default: m.ProximitySettingsModal })), { ssr: false, loading: () => <AppLoader /> });
const AICopilotModal        = dynamic(() => import("../components/AICopilotModal").then(m => ({ default: m.AICopilotModal })),        { ssr: false, loading: () => <AppLoader /> });
const NearbyDevicesPanel    = dynamic(() => import("../components/NearbyDevicesPanel"),    { ssr: false, loading: () => <AppLoader /> });
const LiveStreamBroadcaster = dynamic(() => import("../components/LiveStreamBroadcaster").then(m => ({ default: m.LiveStreamBroadcaster })), { ssr: false, loading: () => <AppLoader /> });
const LiveStreamViewer      = dynamic(() => import("../components/LiveStreamViewer").then(m => ({ default: m.LiveStreamViewer })),      { ssr: false, loading: () => <AppLoader /> });
const OffGridCompassModal   = dynamic(() => import("../components/OffGridCompassModal").then(m => ({ default: m.OffGridCompassModal })), { ssr: false, loading: () => <AppLoader /> });
const VitalScanModal       = dynamic(() => import("../components/VitalScanModal").then(m => ({ default: m.VitalScanModal })),       { ssr: false, loading: () => <AppLoader /> });
const SurvivalBeaconModal  = dynamic(() => import("../components/SurvivalBeaconModal").then(m => ({ default: m.SurvivalBeaconModal })),  { ssr: false, loading: () => <AppLoader /> });
const RfSpectrumModal      = dynamic(() => import("../components/RfSpectrumModal").then(m => ({ default: m.RfSpectrumModal })),      { ssr: false, loading: () => <AppLoader /> });
const StegoVaultModal      = dynamic(() => import("../components/StegoVaultModal").then(m => ({ default: m.StegoVaultModal })),      { ssr: false, loading: () => <AppLoader /> });
const ShakePairModal       = dynamic(() => import("../components/ShakePairModal").then(m => ({ default: m.ShakePairModal })),       { ssr: false, loading: () => <AppLoader /> });
const RedP2PPayModal       = dynamic(() => import("../components/RedP2PPayModal").then(m => ({ default: m.RedP2PPayModal })),       { ssr: false, loading: () => <AppLoader /> });
const BlackoutSimulatorModal = dynamic(() => import("../components/BlackoutSimulatorModal").then(m => ({ default: m.BlackoutSimulatorModal })), { ssr: false, loading: () => <AppLoader /> });
const SystemHealthModal    = dynamic(() => import("../components/SystemHealthModal").then(m => ({ default: m.SystemHealthModal })),    { ssr: false, loading: () => <AppLoader /> });
const NodeLogsModal        = dynamic(() => import("../components/NodeLogsModal").then(m => ({ default: m.NodeLogsModal })),        { ssr: false, loading: () => <AppLoader /> });
const CalculatorScreen     = dynamic(() => import("../components/CalculatorScreen").then(m => ({ default: m.CalculatorScreen })),     { ssr: false, loading: () => <AppLoader /> });
const SecurityReportModal  = dynamic(() => import("../components/SecurityReportModal").then(m => ({ default: m.SecurityReportModal })),  { ssr: false, loading: () => <AppLoader /> });
const BackupRestoreModal   = dynamic(() => import("../components/BackupRestoreModal").then(m => ({ default: m.BackupRestoreModal })),   { ssr: false, loading: () => <AppLoader /> });
const WebCompanionLinkModal = dynamic(() => import("../components/WebCompanionLinkModal").then(m => ({ default: m.WebCompanionLinkModal })), { ssr: false, loading: () => <AppLoader /> });
const SettingsModal        = dynamic(() => import("../components/SettingsModal").then(m => ({ default: m.SettingsModal })),        { ssr: false, loading: () => <AppLoader /> });
const UpdateModal          = dynamic(() => import("../components/UpdateModal").then(m => ({ default: m.UpdateModal })),          { ssr: false, loading: () => <AppLoader /> });
const CommercialHubModal   = dynamic(() => import("../components/CommercialHubModal").then(m => ({ default: m.CommercialHubModal })),   { ssr: false, loading: () => <AppLoader /> });
const GlobalShieldPanel    = dynamic(() => import("../components/GlobalShieldPanel"),    { ssr: false, loading: () => <AppLoader /> });
const Web3VaultModal       = dynamic(() => import("../components/Web3VaultModal"),       { ssr: false, loading: () => <AppLoader /> });
const RedHyperBrowserModal = dynamic(() => import("../components/miniapp/RedHyperBrowserModal").then(m => ({ default: m.RedHyperBrowserModal })), { ssr: false, loading: () => <AppLoader /> });
const SovereignAppStoreModal = dynamic(() => import("../components/miniapp/SovereignAppStoreModal").then(m => ({ default: m.SovereignAppStoreModal })), { ssr: false, loading: () => <AppLoader /> });
const MiniAppContainerModal = dynamic(() => import("../components/miniapp/MiniAppContainerModal").then(m => ({ default: m.MiniAppContainerModal })), { ssr: false, loading: () => <AppLoader /> });
const TacticalCommandCenter = dynamic(() => import("../components/TacticalCommandCenter").then(m => ({ default: m.TacticalCommandCenter })), { ssr: false, loading: () => <AppLoader /> });
const RedShowcaseLanding    = dynamic(() => import("../components/RedShowcaseLanding"),    { ssr: false, loading: () => <FullScreenTacticalLoader /> });
const ToastProvider         = dynamic(() => import("../components/Toast").then(m => ({ default: m.ToastProvider })),         { ssr: false });
const IncomingCallBanner    = dynamic(() => import("../components/IncomingCallBanner").then(m => ({ default: m.IncomingCallBanner })), { ssr: false, loading: () => null });
const FloatingCallPIP       = dynamic(() => import("../components/FloatingCallPIP").then(m => ({ default: m.FloatingCallPIP })),       { ssr: false, loading: () => null });
const BiometricShieldOverlay = dynamic(() => import("../components/BiometricShieldOverlay").then(m => ({ default: m.BiometricShieldOverlay })), { ssr: false, loading: () => null });
const IncomingContactRequestModal = dynamic(() => import("../components/IncomingContactRequestModal").then(m => ({ default: m.IncomingContactRequestModal })), { ssr: false, loading: () => null });

function AppLoader() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "100%", height: "100%", background: "var(--bg-void)",
      color: "var(--text-muted)", fontSize: "14px", gap: "10px",
      fontFamily: "JetBrains Mono, monospace"
    }}>
      <span style={{ animation: "pulse 1s infinite" }}>⚙</span>
      CARGANDO BÓVEDA TÁCTICA…
    </div>
  );
}

function FullScreenTacticalLoader() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      width: "100%", height: "100dvh", background: "#020204", color: "#fff", gap: "16px",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "20px",
        background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.8rem", fontWeight: 900, color: "white",
        boxShadow: "0 0 32px rgba(255,51,85,0.5)",
        animation: "pulse 1.2s ease-in-out infinite",
      }}>R</div>
      <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--accent-cyan)", letterSpacing: "2px", fontFamily: "JetBrains Mono, monospace" }}>
        INICIALIZANDO BÓVEDA RED MESH…
      </div>
    </div>
  );
}

interface EBState { hasError: boolean; error: Error | null; }
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[RED ErrorBoundary]", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          width: "100%", height: "100dvh", background: "var(--bg-void)", color: "#fff",
          padding: "24px", textAlign: "center", gap: "16px",
        }}>
          <div style={{ fontSize: "48px" }}>🛡️</div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-crimson)" }}>Recuperación de Fallo Táctico</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "300px", fontFamily: "JetBrains Mono, monospace" }}>
            {this.state.error?.message || "Error de renderizado capturado"}
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="btn-tactical-primary"
            style={{ padding: "10px 24px" }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function TacticalTabletWorkspace({ onOpenTool }: { onOpenTool: (screen: any) => void }) {
  const { identity } = useRedStore();
  const { t } = useTranslation();
  return (
    <div style={{
      flex: 1, height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "40px 32px",
      textAlign: "center", gap: "24px", overflowY: "auto"
    }}>
      <div style={{
        width: 84, height: 84, borderRadius: "24px",
        background: "linear-gradient(135deg, rgba(232,33,58,0.2) 0%, rgba(0,229,255,0.15) 100%)",
        border: "1px solid var(--glass-border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "2.8rem", boxShadow: "0 12px 40px rgba(0,0,0,0.5)"
      }}>
        🛡️
      </div>

      <div style={{ maxWidth: "480px" }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "0.2px" }}>
          {t('tablet.title')}
        </h2>
        <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", marginTop: "8px", lineHeight: 1.5 }}>
          {t('tablet.subtitle')}
        </p>
      </div>

      {/* Grid de Accesos Rápidos Tácticos para Tablet */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "14px", width: "100%", maxWidth: "600px", marginTop: "8px"
      }}>
        <div
          onClick={() => onOpenTool("nodemap")}
          className="card-tactical-interactive"
          style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}
        >
          <span style={{ fontSize: "1.8rem" }}>🗺️</span>
          <span style={{ fontSize: "0.86rem", fontWeight: 800 }}>{t('tablet.map_title')}</span>
          <span style={{ fontSize: "0.70rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>{t('tablet.map_sub')}</span>
        </div>

        <div
          onClick={() => onOpenTool("radar")}
          className="card-tactical-interactive"
          style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}
        >
          <span style={{ fontSize: "1.8rem" }}>📡</span>
          <span style={{ fontSize: "0.86rem", fontWeight: 800 }}>{t('tablet.radar_title')}</span>
          <span style={{ fontSize: "0.70rem", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>{t('tablet.radar_sub')}</span>
        </div>

        <div
          onClick={() => onOpenTool("canvas")}
          className="card-tactical-interactive"
          style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}
        >
          <span style={{ fontSize: "1.8rem" }}>🎨</span>
          <span style={{ fontSize: "0.86rem", fontWeight: 800 }}>{t('tablet.canvas_title')}</span>
          <span style={{ fontSize: "0.70rem", color: "var(--accent-purple)", fontFamily: "JetBrains Mono, monospace" }}>{t('tablet.canvas_sub')}</span>
        </div>

        <div
          onClick={() => onOpenTool("channels")}
          className="card-tactical-interactive"
          style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}
        >
          <span style={{ fontSize: "1.8rem" }}>📻</span>
          <span style={{ fontSize: "0.86rem", fontWeight: 800 }}>{t('tablet.channels_title')}</span>
          <span style={{ fontSize: "0.70rem", color: "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace" }}>{t('tablet.channels_sub')}</span>
        </div>

        <div
          onClick={() => onOpenTool("settings")}
          className="card-tactical-interactive"
          style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}
        >
          <span style={{ fontSize: "1.8rem" }}>⚙️</span>
          <span style={{ fontSize: "0.86rem", fontWeight: 800 }}>{t('tablet.settings_title')}</span>
          <span style={{ fontSize: "0.70rem", color: "var(--primary-bright)", fontFamily: "JetBrains Mono, monospace" }}>{t('tablet.settings_sub')}</span>
        </div>

        <div
          onClick={() => onOpenTool("commercialHub")}
          className="card-tactical-interactive"
          style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, rgba(232,33,58,0.12) 0%, rgba(255,51,85,0.06) 100%)", border: "1px solid rgba(255,60,95,0.3)" }}
        >
          <span style={{ fontSize: "1.8rem" }}>⚡</span>
          <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "#FF8599" }}>{t('tablet.hub_title')}</span>
          <span style={{ fontSize: "0.70rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>{t('tablet.hub_sub')}</span>
        </div>

        <div
          onClick={() => onOpenTool("appStore")}
          className="card-tactical-interactive"
          style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, rgba(0,230,118,0.12) 0%, rgba(0,229,255,0.06) 100%)", border: "1px solid rgba(0,230,118,0.3)" }}
        >
          <span style={{ fontSize: "1.8rem" }}>🛒</span>
          <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "var(--accent-emerald)" }}>App Store P2P</span>
          <span style={{ fontSize: "0.70rem", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>MINI-APPS</span>
        </div>

        <div
          onClick={() => onOpenTool("hyperBrowser")}
          className="card-tactical-interactive"
          style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, rgba(0,229,255,0.12) 0%, rgba(138,43,226,0.06) 100%)", border: "1px solid rgba(0,229,255,0.3)" }}
        >
          <span style={{ fontSize: "1.8rem" }}>🌐</span>
          <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "var(--accent-cyan)" }}>Hyper-Browser</span>
          <span style={{ fontSize: "0.70rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>MESH HTTP</span>
        </div>

        <div
          onClick={() => onOpenTool("updater")}
          className="card-tactical-interactive"
          style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}
        >
          <span style={{ fontSize: "1.8rem" }}>🚀</span>
          <span style={{ fontSize: "0.86rem", fontWeight: 800 }}>{t('modules.updater')}</span>
          <span style={{ fontSize: "0.70rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>OTA</span>
        </div>
      </div>

      <div style={{
        padding: "8px 16px", borderRadius: "10px",
        background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.25)",
        color: "var(--accent-emerald)", fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace",
        fontWeight: 700
      }}>
        ● NODO SOBERANO OPERACIONAL · {identity?.short_id || "OFFLINE"}
      </div>
    </div>
  );
}

export default function AppRouter() {
  const { currentScreen, activeConversationId, identity, activeLiveStreamId, liveStreams, goBack, navigate, activeMiniAppBundle, launchMiniApp } = useRedStore();
  const [mounted, setMounted] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [needsProfile, setNeedsProfile] = useState<boolean | null>(null);
  const [showLanding, setShowLanding] = useState<boolean>(true);

  useEffect(() => {
    setMounted(true);

    const checkViewport = () => {
      if (typeof window !== "undefined") {
        setIsTablet(window.innerWidth >= 768);
      }
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);

    const checkLanding = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          setShowLanding(false);
          return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("app") === "true" || (typeof window !== "undefined" && localStorage.getItem("red_landing_dismissed") === "true")) {
          setShowLanding(false);
          return;
        }

        // En la web por primera vez, se muestra el Portal / Landing Page oficial
        setShowLanding(true);
      } catch {
        setShowLanding(true);
      }
    };

    const handleOpenLanding = () => setShowLanding(true);
    window.addEventListener("red:open_landing", handleOpenLanding);

    const runIntegrityAudit = async () => {
      try {
        const { StateIntegrityEngine } = await import("../lib/StateIntegrityEngine");
        const audit = await StateIntegrityEngine.verifyAndHealStorage();
        if (!audit.isHealthy && audit.quarantinedKeys.length > 0) {
          console.warn("[StateIntegrity] Storage self-healed corrupted keys:", audit.quarantinedKeys);
        }
      } catch {}
    };

    const setupBackButton = async () => {
      try {
        const { App: CapApp } = await import("@capacitor/app");
        const backHandler = await CapApp.addListener("backButton", () => {
          const state = useRedStore.getState();
          if (state.currentScreen !== "sidebar") {
            state.goBack();
          } else {
            CapApp.minimizeApp();
          }
        });
        return () => backHandler.remove();
      } catch {
        return () => {};
      }
    };

    const checkProfile = async () => {
      try {
        if (typeof window !== "undefined" && localStorage.getItem("profile_created") === "true") {
          setNeedsProfile(false);
          return;
        }
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
          const getPromise = SecureStoragePlugin.get({ key: "profile_created" }).catch(() => null);
          const timeoutPromise = new Promise<null>(r => setTimeout(() => r(null), 350));
          const res = await Promise.race([getPromise, timeoutPromise]);
          if (res && res.value === "true") {
            setNeedsProfile(false);
            return;
          }
        }
        const hasNick = typeof window !== "undefined" && (localStorage.getItem("user_nickname") || localStorage.getItem("red_displayName"));
        setNeedsProfile(!hasNick);
      } catch {
        setNeedsProfile(false);
      }
    };

    const setupNotificationClickListeners = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { LocalNotifications } = await import("@capacitor/local-notifications");
          LocalNotifications.addListener("localNotificationActionPerformed", (notificationAction) => {
            try {
              const extra = notificationAction.notification?.extra;
              const targetPeer = extra?.peer || extra?.conversation_id || extra?.sender;
              if (targetPeer) {
                const store = useRedStore.getState();
                if (store.isAuthenticated) {
                  store.navigate("chat", targetPeer);
                } else {
                  useRedStore.setState({ pendingChatNavigation: targetPeer });
                }
              }
            } catch (e) {
              console.warn("[RED] Early notification action listener error:", e);
            }
          });
        }
      } catch {}
    };

    const handleNativeOpenConv = (event: any) => {
      try {
        const targetPeer = event?.detail;
        if (targetPeer) {
          const store = useRedStore.getState();
          if (store.isAuthenticated) {
            store.navigate("chat", targetPeer);
          } else {
            useRedStore.setState({ pendingChatNavigation: targetPeer } as any);
          }
        }
      } catch (err) {
        console.warn("[RED] Error handling native open conversation event:", err);
      }
    };
    window.addEventListener("red:open_conversation", handleNativeOpenConv);

    setupBackButton();
    setupNotificationClickListeners();
    runIntegrityAudit();
    checkLanding();
    checkProfile();

    return () => {
      window.removeEventListener("resize", checkViewport);
      window.removeEventListener("red:open_conversation", handleNativeOpenConv);
      window.removeEventListener("red:open_landing", handleOpenLanding);
    };
  }, []);

  if (!mounted) return <FullScreenTacticalLoader />;

  if (showLanding) {
    return (
      <ErrorBoundary>
        <RedShowcaseLanding onEnterVault={() => {
          if (typeof window !== "undefined") {
            localStorage.setItem("red_landing_dismissed", "true");
          }
          setShowLanding(false);
        }} />
      </ErrorBoundary>
    );
  }

  if (needsProfile === null) return <FullScreenTacticalLoader />;

  if (needsProfile) {
    return (
      <ErrorBoundary>
        <OnboardingProfile onComplete={() => setNeedsProfile(false)} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider />
      <AuthWall>
        <IncomingCallBanner />
        <FloatingCallPIP />
        <BiometricShieldOverlay />
        <IncomingContactRequestModal />
        {activeLiveStreamId && (
          <LiveStreamViewer
            streamId={activeLiveStreamId}
            onClose={() => useRedStore.getState().closeLiveStream()}
          />
        )}
        <main className="app-main">
          {isTablet ? <StatusHeader /> : (currentScreen === "sidebar" && <StatusHeader />)}
          
          {isTablet ? (
            /* ── Master-Detail Tablet Layout (>= 768px) ── */
            <div className="tablet-split-layout">
              <div className="tablet-sidebar-pane">
                <Sidebar />
              </div>
              <div className="tablet-workspace-pane">
                {currentScreen === "commandCenter" && <TacticalCommandCenter />}
                {currentScreen === "chat" && <ChatWindow />}
                {currentScreen === "sidebar" && <TacticalTabletWorkspace onOpenTool={(s) => navigate(s)} />}
                {currentScreen === "explorer" && <BlockchainExplorer />}
                {currentScreen === "socialFeed" && <SocialFeedPanel />}
                {(currentScreen === "channels" || currentScreen === "publicChannels") && <PublicChannelsPanel />}
                {(currentScreen === "groups" || currentScreen === "squads") && <GroupsPanel />}
                {(currentScreen === "nearby" || currentScreen === "contacts") && <NearbyDevicesPanel />}
                {currentScreen === "security" && <SecurityPanel />}
                {currentScreen === "status" && <StatusView />}
                {currentScreen === "network" && <NetworkPanel />}
                {currentScreen === "crypto" && <CryptoPanel />}
                {currentScreen === "broadcast" && <BroadcastPanel />}
                {currentScreen === "ecoMesh" && <EcoMeshPanel />}
                {currentScreen === "dms" && <DMSSettings />}
                {(currentScreen === "amber" || currentScreen === "amberAdmin") && <AmberAdminPanel onClose={goBack} />}
                {currentScreen === "guardian" && <GuardianStatusPanel onClose={goBack} />}
                {(currentScreen === "weather" || currentScreen === "weatherAlert") && <WeatherAlertPanel />}
                {currentScreen === "p2pCompass" && <P2PCompassModal />}
                {currentScreen === "walkie" && <P2PWalkieTalkieModal />}
                {(currentScreen === "idVault" || currentScreen === "identityVault") && <IdentityVaultModal />}
                {(currentScreen === "proximity" || currentScreen === "proximityWave") && <ProximityWaveModal />}
                {(currentScreen === "canvas" || currentScreen === "liveCanvas") && <LiveCanvasModal />}
                {(currentScreen === "proximitySettings" || currentScreen === "proximity_settings") && <ProximitySettingsModal />}
                {(currentScreen === "aiCopilot" || currentScreen === "copilot") && <AICopilotModal />}
                {currentScreen === "liveStream" && <LiveStreamBroadcaster onClose={goBack} />}
                {(currentScreen === "offGridCompass" || currentScreen === "compass") && <OffGridCompassModal />}
                {currentScreen === "vitalScan" && <VitalScanModal />}
                {(currentScreen === "survivalBeacon" || currentScreen === "sos") && <SurvivalBeaconModal />}
                {currentScreen === "rfSpectrum" && <RfSpectrumModal />}
                {currentScreen === "stegoVault" && <StegoVaultModal />}
                {currentScreen === "shakePair" && <ShakePairModal />}
                {(currentScreen === "p2pPay" || currentScreen === "redP2PPay") && <RedP2PPayModal />}
                {currentScreen === "blackout" && <BlackoutSimulatorModal onClose={goBack} />}
                {(currentScreen === "health" || currentScreen === "systemHealth") && <SystemHealthModal onClose={goBack} />}
                {(currentScreen === "nodeLogs" || currentScreen === "logs") && <NodeLogsModal onClose={goBack} />}
                {currentScreen === "secReport" && <SecurityReportModal onClose={goBack} />}
                {currentScreen === "backup" && <BackupRestoreModal onClose={goBack} />}
                {(currentScreen === "webCompanionLink" || currentScreen === "companionLink") && <WebCompanionLinkModal onClose={goBack} />}
                {currentScreen === "settings" && <SettingsModal onClose={goBack} />}
                {currentScreen === "updater" && <UpdateModal onClose={goBack} />}
                {currentScreen === "globalShield" && <GlobalShieldPanel />}
                {currentScreen === "web3Vault" && <Web3VaultModal />}
                {currentScreen === "commercialHub" || currentScreen === "hub" ? <CommercialHubModal isOpen={true} onClose={goBack} /> : null}
                {currentScreen === "nodemap" && <NodeMap />}
                {currentScreen === "radar" && <RadarWindow />}
                {currentScreen === "call" && <CallScreen />}
                {currentScreen === "hyperBrowser" && (
                  <RedHyperBrowserModal
                    userDid={identity?.identity_hash || 'did:red:guest'}
                    onClose={goBack}
                    onLaunchMiniApp={(bundle) => launchMiniApp(bundle)}
                  />
                )}
                {currentScreen === "appStore" && (
                  <SovereignAppStoreModal
                    userDid={identity?.identity_hash || 'did:red:guest'}
                    onClose={goBack}
                    onLaunchApp={(bundle) => launchMiniApp(bundle)}
                  />
                )}
                {currentScreen === "miniApp" && activeMiniAppBundle && (
                  <MiniAppContainerModal
                    bundle={activeMiniAppBundle}
                    userDid={identity?.identity_hash || 'did:red:guest'}
                    nickname={identity?.nickname || 'Operador'}
                    publicKey={identity?.identity_hash || 'pk_00'}
                    onClose={goBack}
                  />
                )}
                {currentScreen === "calculator" && <CalculatorScreen onUnlock={() => goBack()} />}
                {currentScreen === "landing" && <RedShowcaseLanding onEnterApp={() => navigate("sidebar")} onEnterVault={() => navigate("sidebar")} />}
              </div>
            </div>
          ) : (
            /* ── Single-Column Mobile Layout (< 768px) ── */
            <>
              {currentScreen === "sidebar" && <Sidebar />}
              {currentScreen === "commandCenter" && <TacticalCommandCenter />}
              {currentScreen === "chat" && <ChatWindow />}
              {currentScreen === "security" && <SecurityPanel />}
              {currentScreen === "radar" && <RadarWindow />}
              {currentScreen === "call" && <CallScreen />}
              {currentScreen === "broadcast" && <BroadcastPanel />}
              {currentScreen === "crypto" && <CryptoPanel />}
              {(currentScreen === "groups" || currentScreen === "squads") && <GroupsPanel />}
              {currentScreen === "status" && <StatusView />}
              {currentScreen === "explorer" && <BlockchainExplorer />}
              {currentScreen === "nodemap" && <NodeMap />}
              {currentScreen === "network" && <NetworkPanel />}
              {currentScreen === "dms" && <DMSSettings />}
              {(currentScreen === "amber" || currentScreen === "amberAdmin") && <AmberAdminPanel onClose={goBack} />}
              {currentScreen === "guardian" && <GuardianStatusPanel onClose={goBack} />}
              {currentScreen === "p2pCompass" && <P2PCompassModal />}
              {(currentScreen === "channels" || currentScreen === "publicChannels") && <PublicChannelsPanel />}
              {currentScreen === "socialFeed" && <SocialFeedPanel />}
              {currentScreen === "walkie" && <P2PWalkieTalkieModal />}
              {(currentScreen === "weather" || currentScreen === "weatherAlert") && <WeatherAlertPanel />}
              {(currentScreen === "idVault" || currentScreen === "identityVault") && <IdentityVaultModal />}
              {(currentScreen === "proximity" || currentScreen === "proximityWave") && <ProximityWaveModal />}
              {(currentScreen === "canvas" || currentScreen === "liveCanvas") && <LiveCanvasModal />}
              {currentScreen === "ecoMesh" && <EcoMeshPanel />}
              {(currentScreen === "proximitySettings" || currentScreen === "proximity_settings") && <ProximitySettingsModal />}
              {(currentScreen === "aiCopilot" || currentScreen === "copilot") && <AICopilotModal />}
              {(currentScreen === "nearby" || currentScreen === "contacts") && <NearbyDevicesPanel />}
              {currentScreen === "liveStream" && <LiveStreamBroadcaster onClose={goBack} />}
              {(currentScreen === "offGridCompass" || currentScreen === "compass") && <OffGridCompassModal />}
              {currentScreen === "vitalScan" && <VitalScanModal />}
              {(currentScreen === "survivalBeacon" || currentScreen === "sos") && <SurvivalBeaconModal />}
              {currentScreen === "rfSpectrum" && <RfSpectrumModal />}
              {currentScreen === "stegoVault" && <StegoVaultModal />}
              {currentScreen === "shakePair" && <ShakePairModal />}
              {(currentScreen === "p2pPay" || currentScreen === "redP2PPay") && <RedP2PPayModal />}
              {currentScreen === "blackout" && <BlackoutSimulatorModal onClose={goBack} />}
              {(currentScreen === "health" || currentScreen === "systemHealth") && <SystemHealthModal onClose={goBack} />}
              {(currentScreen === "nodeLogs" || currentScreen === "logs") && <NodeLogsModal onClose={goBack} />}
              {currentScreen === "calculator" && <CalculatorScreen onUnlock={() => goBack()} />}
              {currentScreen === "secReport" && <SecurityReportModal onClose={goBack} />}
              {currentScreen === "backup" && <BackupRestoreModal onClose={goBack} />}
              {(currentScreen === "webCompanionLink" || currentScreen === "companionLink") && <WebCompanionLinkModal onClose={goBack} />}
              {currentScreen === "settings" && <SettingsModal onClose={goBack} />}
              {currentScreen === "updater" && <UpdateModal onClose={goBack} />}
              {currentScreen === "globalShield" && <GlobalShieldPanel />}
              {currentScreen === "web3Vault" && <Web3VaultModal />}
              {(currentScreen === "commercialHub" || currentScreen === "hub") && <CommercialHubModal isOpen={true} onClose={goBack} />}
              {currentScreen === "hyperBrowser" && (
                <RedHyperBrowserModal
                  userDid={identity?.identity_hash || 'did:red:guest'}
                  onClose={goBack}
                  onLaunchMiniApp={(bundle) => launchMiniApp(bundle)}
                />
              )}
              {currentScreen === "appStore" && (
                <SovereignAppStoreModal
                  userDid={identity?.identity_hash || 'did:red:guest'}
                  onClose={goBack}
                  onLaunchApp={(bundle) => launchMiniApp(bundle)}
                />
              )}
              {currentScreen === "miniApp" && activeMiniAppBundle && (
                <MiniAppContainerModal
                  bundle={activeMiniAppBundle}
                  userDid={identity?.identity_hash || 'did:red:guest'}
                  nickname={identity?.nickname || 'Operador'}
                  publicKey={identity?.identity_hash || 'pk_00'}
                  onClose={goBack}
                />
              )}
              {currentScreen === "landing" && <RedShowcaseLanding onEnterApp={() => navigate("sidebar")} onEnterVault={() => navigate("sidebar")} />}
            </>
          )}
        </main>
      </AuthWall>
    </ErrorBoundary>
  );
}