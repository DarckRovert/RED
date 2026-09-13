"use client";

/**
 * page.tsx — RED v104.0.0 App Shell
 *
 * Responsabilidades únicas de este archivo:
 *   1. Detección de plataforma (nativa Capacitor vs. web showcase)
 *   2. Flujo de onboarding / perfil de identidad
 *   3. Layout responsivo: single-column mobile | master-detail tablet (768px)
 *   4. Hardware back-button Android (Capacitor) + popstate web
 *   5. Overlays globales: ToastProvider, IncomingCallBanner, FloatingCallPIP,
 *      BiometricShieldOverlay, IncomingContactRequestModal, LiveStreamViewer
 *
 * El enrutamiento de las 62 pantallas modulares está delegado a WorkspaceScreens.
 * Añadir un nuevo módulo = editar SOLO WorkspaceScreens.tsx (un lugar, no dos).
 */

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRedStore, ScreenView } from "../store/useRedStore";
import { toast } from "../components/Toast";
import { WorkspaceScreens } from "../components/navigation/WorkspaceScreens";

// ── Loaders ───────────────────────────────────────────────────────────────────
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

function FullScreenTacticalLoader() {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        width: "100%", height: "100dvh", background: "#020204", color: "#fff", gap: "16px",
      }}
    >
      <div
        style={{
          width: 64, height: 64, borderRadius: "20px",
          background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.8rem", fontWeight: 900, color: "white",
          boxShadow: "0 0 32px rgba(255,51,85,0.5)",
          animation: "pulse 1.2s ease-in-out infinite",
        }}
      >
        R
      </div>
      <div
        style={{
          fontSize: "11px", fontWeight: 800,
          color: "var(--accent-cyan)", letterSpacing: "2px",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        INICIALIZANDO BÓVEDA RED MESH…
      </div>
    </div>
  );
}

// ── Shell-level Dynamic Imports ───────────────────────────────────────────────
// Solo componentes que pertenecen al shell (overlays, nav, auth).
// Los 62 módulos de pantalla viven en WorkspaceScreens.tsx.
const MainNavigationShell         = dynamic(() => import("../components/navigation/MainNavigationShell").then(m => ({ default: m.MainNavigationShell })), { ssr: false, loading: () => <AppLoader /> });
const StatusHeader                = dynamic(() => import("../components/StatusHeader"),               { ssr: false, loading: () => <div style={{ height: 44 }} /> });
const AuthWall                    = dynamic(() => import("../components/AuthWall"),                   { ssr: false, loading: () => <FullScreenTacticalLoader /> });
const OnboardingProfile           = dynamic(() => import("../components/OnboardingProfile"),          { ssr: false, loading: () => <AppLoader /> });
const RedShowcaseLanding          = dynamic(() => import("../components/RedShowcaseLanding"),         { ssr: false, loading: () => <FullScreenTacticalLoader /> });
const ToastProvider               = dynamic(() => import("../components/Toast").then(m => ({ default: m.ToastProvider })),                        { ssr: false });
const IncomingCallBanner          = dynamic(() => import("../components/IncomingCallBanner").then(m => ({ default: m.IncomingCallBanner })),       { ssr: false, loading: () => null });
const FloatingCallPIP             = dynamic(() => import("../components/FloatingCallPIP").then(m => ({ default: m.FloatingCallPIP })),             { ssr: false, loading: () => null });
const BiometricShieldOverlay      = dynamic(() => import("../components/BiometricShieldOverlay").then(m => ({ default: m.BiometricShieldOverlay })), { ssr: false, loading: () => null });
const IncomingContactRequestModal = dynamic(() => import("../components/IncomingContactRequestModal").then(m => ({ default: m.IncomingContactRequestModal })), { ssr: false, loading: () => null });
const LiveStreamViewer            = dynamic(() => import("../components/LiveStreamViewer").then(m => ({ default: m.LiveStreamViewer })),           { ssr: false, loading: () => null });
const TacticalQuickActionHUD      = dynamic(() => import("../components/navigation/TacticalQuickActionHUD").then(m => ({ default: m.TacticalQuickActionHUD })), { ssr: false, loading: () => null });

// ── ErrorBoundary ─────────────────────────────────────────────────────────────
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
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            width: "100%", height: "100dvh", background: "var(--bg-void)", color: "#fff",
            padding: "24px", textAlign: "center", gap: "16px",
          }}
        >
          <div style={{ fontSize: "48px" }}>🛡️</div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-crimson)" }}>
            Recuperación de Fallo Táctico
          </div>
          <div
            style={{
              fontSize: "12px", color: "var(--text-muted)",
              maxWidth: "300px", fontFamily: "JetBrains Mono, monospace",
            }}
          >
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

// ── AppRouter ─────────────────────────────────────────────────────────────────
export default function AppRouter() {
  const { currentScreen, activeLiveStreamId, navigate } = useRedStore();

  const [mounted,      setMounted]      = useState(false);
  const [isTablet,     setIsTablet]     = useState(false);
  const [needsProfile, setNeedsProfile] = useState<boolean | null>(null);
  const [showLanding,  setShowLanding]  = useState<boolean>(true);

  useEffect(() => {
    setMounted(true);

    // ── Viewport detection ──────────────────────────────────────────────────
    const checkViewport = () => setIsTablet(window.innerWidth >= 768);
    checkViewport();
    window.addEventListener("resize", checkViewport);

    // ── Landing detection ───────────────────────────────────────────────────
    const checkLanding = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) { setShowLanding(false); return; }
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("app") === "true") { setShowLanding(false); return; }
        setShowLanding(true);
      } catch {
        setShowLanding(true);
      }
    };
    const handleOpenLanding = () => setShowLanding(true);
    window.addEventListener("red:open_landing", handleOpenLanding);

    // ── Storage integrity self-heal ─────────────────────────────────────────
    const runIntegrityAudit = async () => {
      try {
        const { StateIntegrityEngine } = await import("../lib/StateIntegrityEngine");
        const audit = await StateIntegrityEngine.verifyAndHealStorage();
        if (!audit.isHealthy && audit.quarantinedKeys.length > 0) {
          console.warn("[StateIntegrity] Storage self-healed corrupted keys:", audit.quarantinedKeys);
        }
      } catch {}
    };

    // ── Android hardware back button ────────────────────────────────────────
    let lastBackPressTime = 0;
    let removeBackHandler: (() => void) | null = null;
    const setupBackButton = async () => {
      try {
        const { App: CapApp } = await import("@capacitor/app");
        const backHandler = await CapApp.addListener("backButton", () => {
          const handled = useRedStore.getState().goBack();
          if (!handled) {
            const now = Date.now();
            if (now - lastBackPressTime < 2000) {
              CapApp.minimizeApp();
            } else {
              lastBackPressTime = now;
              toast.info("Presiona atrás nuevamente para salir");
            }
          }
        });
        removeBackHandler = () => backHandler.remove();
      } catch {}
    };

    // ── Web popstate (browser back) ─────────────────────────────────────────
    const handlePopState = () => {
      try { useRedStore.getState().goBack({ fromPopState: true }); } catch {}
    };
    window.addEventListener("popstate", handlePopState);

    // ── Profile / identity check ────────────────────────────────────────────
    const checkProfile = async () => {
      try {
        if (localStorage.getItem("profile_created") === "true") { setNeedsProfile(false); return; }
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
          const res = await Promise.race([
            SecureStoragePlugin.get({ key: "profile_created" }).catch(() => null),
            new Promise<null>(r => setTimeout(() => r(null), 350)),
          ]);
          if (res && res.value === "true") { setNeedsProfile(false); return; }
        }
        const hasNick = localStorage.getItem("user_nickname") || localStorage.getItem("red_displayName");
        setNeedsProfile(!hasNick);
      } catch {
        setNeedsProfile(false);
      }
    };

    // ── Notification tap → open conversation ───────────────────────────────
    const setupNotificationListeners = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
          try {
            const extra = action.notification?.extra;
            const targetPeer = extra?.peer || extra?.conversation_id || extra?.sender;
            if (!targetPeer) return;
            const store = useRedStore.getState();
            if (store.isAuthenticated) {
              store.navigate("chat", targetPeer);
            } else {
              useRedStore.setState({ pendingChatNavigation: targetPeer });
            }
          } catch (e) {
            console.warn("[RED] Notification action listener error:", e);
          }
        });
      } catch {}
    };

    const handleNativeOpenConv = (event: any) => {
      try {
        const targetPeer = event?.detail;
        if (!targetPeer) return;
        const store = useRedStore.getState();
        if (store.isAuthenticated) {
          store.navigate("chat", targetPeer);
        } else {
          useRedStore.setState({ pendingChatNavigation: targetPeer } as any);
        }
      } catch (err) {
        console.warn("[RED] Native open conversation error:", err);
      }
    };
    window.addEventListener("red:open_conversation", handleNativeOpenConv);

    // ── Bootstrap ───────────────────────────────────────────────────────────
    setupBackButton();
    setupNotificationListeners();
    runIntegrityAudit();
    checkLanding();
    checkProfile();

    return () => {
      window.removeEventListener("resize",              checkViewport);
      window.removeEventListener("red:open_conversation", handleNativeOpenConv);
      window.removeEventListener("red:open_landing",    handleOpenLanding);
      window.removeEventListener("popstate",            handlePopState);
      if (removeBackHandler) removeBackHandler();
    };
  }, []);

  // ── Render guards ─────────────────────────────────────────────────────────
  if (!mounted)            return <FullScreenTacticalLoader />;
  if (needsProfile === null) return <FullScreenTacticalLoader />;

  if (showLanding) {
    return (
      <ErrorBoundary>
        <RedShowcaseLanding
          onEnterVault={(s) => { setShowLanding(false); if (s) navigate(s); }}
          onEnterApp={(s)   => { setShowLanding(false); if (s) navigate(s); }}
        />
      </ErrorBoundary>
    );
  }

  if (needsProfile) {
    return (
      <ErrorBoundary>
        <OnboardingProfile onComplete={() => setNeedsProfile(false)} />
      </ErrorBoundary>
    );
  }

  const handleOpenTool = (screen: ScreenView) => navigate(screen);

  // ── Main App Shell ────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <ToastProvider />
      <AuthWall>
        {/* Global overlays — siempre montados por encima de cualquier pantalla */}
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
        <TacticalQuickActionHUD isTablet={isTablet} />

        <main className="app-main">
          {/* StatusHeader: siempre en tablet, solo en sidebar en mobile */}
          {isTablet ? <StatusHeader /> : (currentScreen === "sidebar" && <StatusHeader />)}

          {isTablet ? (
            /* ── Master-Detail Tablet Layout (≥ 768px) ────────────────────── */
            <div className="tablet-split-layout">
              <div className="tablet-sidebar-pane">
                <MainNavigationShell isTablet={true} />
              </div>
              <div className="tablet-workspace-pane">
                <WorkspaceScreens isTablet={true} onOpenTool={handleOpenTool} />
              </div>
            </div>
          ) : (
            /* ── Single-Column Mobile Layout (< 768px) ─────────────────────── */
            <>
              {currentScreen === "sidebar" && <MainNavigationShell isTablet={false} />}
              <WorkspaceScreens isTablet={false} onOpenTool={handleOpenTool} />
            </>
          )}
        </main>
      </AuthWall>
    </ErrorBoundary>
  );
}