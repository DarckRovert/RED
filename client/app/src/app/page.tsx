"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRedStore } from "../store/useRedStore";

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
const AuthWall              = dynamic(() => import("../components/AuthWall"),              { ssr: false, loading: () => <FullScreenLoader /> });
const NodeMap               = dynamic(() => import("../components/NodeMap"),               { ssr: false, loading: () => <AppLoader /> });
const NetworkPanel          = dynamic(() => import("../components/NetworkPanel"),          { ssr: false, loading: () => <AppLoader /> });
const OnboardingProfile     = dynamic(() => import("../components/OnboardingProfile"),     { ssr: false, loading: () => <AppLoader /> });
const DMSSettings           = dynamic(() => import("../components/DMSSettings"),           { ssr: false, loading: () => <AppLoader /> });
const AmberAdminPanel       = dynamic(() => import("../components/AmberAdminPanel"),       { ssr: false, loading: () => <AppLoader /> });
const GuardianStatusPanel   = dynamic(() => import("../components/GuardianStatusPanel"),   { ssr: false, loading: () => <AppLoader /> });
const P2PCompassModal       = dynamic(() => import("../components/P2PCompassModal").then(m => ({ default: m.P2PCompassModal })),       { ssr: false, loading: () => <AppLoader /> });
const PublicChannelsPanel   = dynamic(() => import("../components/PublicChannelsPanel").then(m => ({ default: m.PublicChannelsPanel })),   { ssr: false, loading: () => <AppLoader /> });
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
const ToastProvider         = dynamic(() => import("../components/Toast").then(m => ({ default: m.ToastProvider })),         { ssr: false });
// FIX 1.4: SOSEmergencyBanner must be a persistent overlay — mounted ONCE while authenticated,
// regardless of which screen is active. It auto-activates via its own currentScreen subscription.
const SOSEmergencyBanner    = dynamic(() => import("../components/SOSEmergencyBanner").then(m => ({ default: m.SOSEmergencyBanner })), { ssr: false, loading: () => null });

/* ── Spinners de carga ── */
function AppLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%', height: '100%', background: 'var(--bg-deep)',
      color: 'var(--text-muted)', fontSize: '14px', gap: '10px',
    }}>
      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙</span>
      Cargando…
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%', height: '100dvh', background: 'var(--bg-deep)',
    }} />
  );
}

/* ── Error Boundary: atrapa cualquier crash de componente ── */
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
    console.error('[RED ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100dvh', background: '#0a0a0f', color: '#fff',
          padding: '24px', textAlign: 'center', gap: '16px',
        }}>
          <div style={{ fontSize: '48px' }}>🛡️</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#E8213A' }}>Error de Componente</div>
          <div style={{ fontSize: '13px', color: '#888', maxWidth: '300px' }}>
            {this.state.error?.message || 'Error desconocido'}
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              background: '#E8213A', color: '#fff', border: 'none', borderRadius: '12px',
              padding: '12px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * RED v18.3 Zenith Master SPA Router.
 * Lazy-loads all components with ssr:false to prevent hydration crashes.
 */
export default function AppRouter() {
  const { currentScreen, nodeOnline, identity, navigate, goBack, activeLiveStreamId } = useRedStore();
  const [mounted, setMounted] = useState(false);
  const [needsProfile, setNeedsProfile] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);

    // Hardware Back Button — importado dinámicamente para evitar crash SSR
    const setupBackButton = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const backHandler = await CapApp.addListener('backButton', () => {
          const state = useRedStore.getState();
          if (state.currentScreen !== 'sidebar') {
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

    // Check if profile was already created in Keystore or localStorage
    const checkProfile = async () => {
      try {
        if (typeof window !== 'undefined' && localStorage.getItem("profile_created") === "true") {
          setNeedsProfile(false);
          return;
        }
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
          const res = await SecureStoragePlugin.get({ key: "profile_created" }).catch(() => null);
          if (res && res.value === "true") {
            setNeedsProfile(false);
            return;
          }
        }
        // ROOT-CAUSE FIX: For new users, profile_created is not set yet, so needsProfile MUST be true!
        setNeedsProfile(true);
      } catch {
        setNeedsProfile(true);
      }
    };

    let cleanupFn: (() => void) | null = null;
    setupBackButton().then(cleanup => { cleanupFn = cleanup; });
    checkProfile();

    return () => { cleanupFn?.(); };
  }, []);

  // SSR Hydration Fix: No renderizar nada del lado del servidor
  if (!mounted || needsProfile === null) return <div style={{ background: 'var(--bg-deep)', height: '100dvh' }} />;

  const renderScreen = () => {
    switch (currentScreen) {
      case 'sidebar':         return <Sidebar />;
      case 'chat':            return <ChatWindow />;
      case 'call':            return <CallScreen />;
      case 'settings':        return <SecurityPanel />;
      case 'radar':
      case 'contacts':        return <RadarWindow />;
      case 'status':          return <StatusView />;
      case 'crypto':          return <CryptoPanel />;
      case 'broadcast':       return <BroadcastPanel />;
      case 'nodemap':         return <NodeMap />;
      case 'network':         return <NetworkPanel />;
      case 'groupAdmin':      return <GroupsPanel />;
      case 'dms':             return <DMSSettings />;
      case 'explorer':        return <BlockchainExplorer />;
      case 'amber':           return <AmberAdminPanel onClose={() => navigate('sidebar')} localNodeId={identity?.identity_hash || 'node-local'} />;
      case 'guardian':        return <GuardianStatusPanel onClose={() => navigate('sidebar')} />;
      case 'compass':         return <P2PCompassModal />;
      case 'channels':        return <PublicChannelsPanel />;
      case 'walkie':          return <P2PWalkieTalkieModal />;
      case 'weather':         return <WeatherAlertPanel />;
      case 'idVault':         return <IdentityVaultModal />;
      case 'proximity':       return <ProximityWaveModal />;
      case 'canvas':          return <LiveCanvasModal />;
      case 'ecoMesh':         return <EcoMeshPanel />;
      case 'proximitySettings': return <ProximitySettingsModal />;
      case 'aiCopilot':       return <AICopilotModal />;
      case 'nearby':          return <NearbyDevicesPanel />;
      case 'liveStream':      return activeLiveStreamId
                                ? <LiveStreamViewer streamId={activeLiveStreamId} onClose={() => navigate('sidebar')} />
                                : <LiveStreamBroadcaster onClose={() => navigate('sidebar')} />;
      case 'sos':             return <Sidebar />;
      default:                return <Sidebar />;
    }
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthWall>
          {needsProfile ? (
            <OnboardingProfile onDone={() => setNeedsProfile(false)} />
          ) : (
            <main style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* FIX 1.4: SOS overlay — always mounted while authenticated so banners are always visible */}
              <SOSEmergencyBanner />
              {!nodeOnline && (
                <div style={{ background: 'var(--danger)', color: 'white', textAlign: 'center', padding: '6px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                   <span style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>⚙</span>
                   Generando identidad PoW — espera unos segundos…
                </div>
              )}
              <StatusHeader />
              <ErrorBoundary>
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  {renderScreen()}
                </div>
              </ErrorBoundary>
            </main>
          )}
        </AuthWall>
      </ToastProvider>
    </ErrorBoundary>
  );
}

