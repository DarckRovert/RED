"use client";

import React, { useEffect, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import SecurityPanel from "../components/SecurityPanel";
import RadarWindow from "../components/RadarWindow";
import StatusHeader from "../components/StatusHeader";
import CallScreen from "../components/CallScreen";
import BroadcastPanel from "../components/BroadcastPanel";
import CryptoPanel from "../components/CryptoPanel";
import GroupsPanel from "../components/GroupsPanel";
import StatusView from "../components/StatusView";
import BlockchainExplorer from "../components/BlockchainExplorer";
import AuthWall from "../components/AuthWall";
import NodeMap from "../components/NodeMap";
import NetworkPanel from "../components/NetworkPanel";
import OnboardingProfile from "../components/OnboardingProfile";
import { ToastProvider } from "../components/Toast";
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

/**
 * RED v5.0 Master SPA Router.
 * Replaces Next.js <Link> and useRouter to guarantee 100% stable offline mobile transitions.
 */
export default function AppRouter() {
  const { currentScreen, nodeOnline } = useRedStore();
  const [mounted, setMounted] = useState(false);
  const [needsProfile, setNeedsProfile] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
    
    // Check if profile was already created in Keystore
    const checkProfile = async () => {
      try {
        const { value } = await SecureStoragePlugin.get({ key: "profile_created" });
        setNeedsProfile(!value);
      } catch {
        // If key doesn't exist, we need to show the profile screen
        setNeedsProfile(true);
      }
    };
    checkProfile();
  }, []);

  // SSR Hydration Fix: Never render anything server-side except a blank matching canvas
  // until both the client has mounted AND the async Keystore check is done.
  if (!mounted || needsProfile === null) return <div style={{ background: 'var(--bg-deep)', height: '100dvh' }} />;

  const renderScreen = () => {
    switch (currentScreen) {
      case 'sidebar': return <Sidebar />;
      case 'chat': return <ChatWindow />;
      case 'call': return <CallScreen />;
      case 'settings': return <SecurityPanel />;
      case 'radar': 
      case 'contacts': 
        return <RadarWindow />;
      case 'status':
        return <StatusView />;
      case 'crypto':
        return <CryptoPanel />;
      case 'broadcast':
        return <BroadcastPanel />;
      case 'nodemap':
        return <NodeMap />;
      case 'network':
        return <NetworkPanel />;
      case 'groupAdmin':
        return <GroupsPanel />;
      case 'explorer':
        return <BlockchainExplorer />;
      default:
        return <Sidebar />;
    }
  };

  return (
    <ToastProvider>
      <AuthWall>
        {needsProfile ? (
          <OnboardingProfile onDone={() => setNeedsProfile(false)} />
        ) : (
          <main style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {!nodeOnline && (
              <div style={{ background: 'var(--danger)', color: 'white', textAlign: 'center', padding: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                 ⚠ Trabajando Sin Conexión al Nodo Local
              </div>
            )}
            <StatusHeader />
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {renderScreen()}
            </div>
          </main>
        )}
      </AuthWall>
    </ToastProvider>
  );
}
