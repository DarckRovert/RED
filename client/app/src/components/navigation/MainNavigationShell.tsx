"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRedStore, ScreenView } from "../../store/useRedStore";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { RED_VERSION } from "../../lib/version";
import { callHistory, CallRecord } from "../../lib/audio/CallHistoryEngine";
import { GlobalSearchModal } from "../GlobalSearchModal";
import StoryCreator from "../stories/StoryCreator";

// Dynamic subviews
import Sidebar from "../Sidebar";
import StatusView from "../StatusView";
import { CallsHistoryView } from "../call/CallsHistoryView";
import { TacticalCommandCenter } from "../TacticalCommandCenter";
import { SettingsModal } from "../SettingsModal";
import { FamiliarSettingsView } from "../settings/FamiliarSettingsView";

export type NavTab = "chats" | "status" | "calls" | "tools" | "settings";

interface MainNavigationShellProps {
    isTablet: boolean;
}

export function MainNavigationShell({ isTablet }: MainNavigationShellProps) {
    const { t } = useTranslation();
    const { 
        conversations: rawConvs, identity, nodeOnline, navigate,
        peerStories, activeConversationId, preferences
    } = useRedStore();

    const [activeTab, setActiveTab] = useState<NavTab>("chats");
    const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
    const [storyCreatorOpen, setStoryCreatorOpen] = useState(false);
    const [topMenuOpen, setTopMenuOpen] = useState(false);
    const [callRecords, setCallRecords] = useState<CallRecord[]>(() => callHistory.getHistory());

    useEffect(() => {
        const unsub = callHistory.subscribe(setCallRecords);
        return unsub;
    }, []);

    // Listen for tab switch requests
    useEffect(() => {
        const handleSwitchTab = (e: any) => {
            if (e?.detail && ["chats", "status", "calls", "tools", "settings"].includes(e.detail)) {
                setActiveTab(e.detail);
            }
        };
        window.addEventListener("red:switch_tab", handleSwitchTab);
        return () => window.removeEventListener("red:switch_tab", handleSwitchTab);
    }, []);

    const conversations = Array.isArray(rawConvs) ? rawConvs : [];
    
    // Unread counts calculation
    const unreadMessagesCount = useMemo(() => {
        return conversations.reduce((acc, c: any) => acc + (c?.unread_count || 0), 0);
    }, [conversations]);

    const unreadStoriesCount = useMemo(() => {
        const storiesMap = peerStories || {};
        return Object.keys(storiesMap).length;
    }, [peerStories]);

    const missedCallsCount = useMemo(() => {
        return callRecords.filter(r => r.direction === "MISSED").length;
    }, [callRecords]);

    const peersCount = meshRouter.peers.size;

    const isFamiliar = (preferences?.uiMode ?? 'familiar') === 'familiar';

    return (
        <div style={{
            display: "flex",
            flexDirection: isTablet ? "row" : "column",
            width: "100%",
            height: "100%",
            background: isFamiliar ? "#0C1317" : "var(--bg-void, #020204)",
            position: "relative",
            overflow: "hidden"
        }}>
            {/* Global Modals */}
            {globalSearchOpen && (
                <GlobalSearchModal onClose={() => setGlobalSearchOpen(false)} />
            )}
            {storyCreatorOpen && (
                <StoryCreator onClose={() => setStoryCreatorOpen(false)} />
            )}

            {/* Desktop / Tablet Left Rail Navigation */}
            {isTablet && (
                <aside style={{
                    width: "72px",
                    height: "100%",
                    background: isFamiliar 
                        ? "#111B21" 
                        : "linear-gradient(180deg, #0A0D1E 0%, #050712 100%)",
                    borderRight: isFamiliar 
                        ? "1px solid rgba(255, 255, 255, 0.08)" 
                        : "1px solid rgba(0, 229, 255, 0.15)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "16px 0",
                    gap: "20px",
                    flexShrink: 0,
                    zIndex: 10
                }}>
                    <div 
                        onClick={() => setActiveTab("settings")}
                        style={{
                            width: "44px", height: "44px", borderRadius: "14px",
                            background: isFamiliar 
                                ? "linear-gradient(135deg, #00A884 0%, #008069 100%)" 
                                : "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.3rem", fontWeight: 900, color: "#FFFFFF",
                            boxShadow: isFamiliar 
                                ? "0 4px 14px rgba(0, 168, 132, 0.4)" 
                                : "0 0 16px rgba(255, 51, 85, 0.5)", 
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                        }}
                        title={`RED OS v${RED_VERSION} — Modo ${isFamiliar ? 'Familiar' : 'Táctico'}`}
                    >
                        R
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1, marginTop: "10px" }}>
                        {/* Chats Tab */}
                        <button
                            onClick={() => setActiveTab("chats")}
                            style={{
                                width: "46px", height: "46px", borderRadius: "12px",
                                background: activeTab === "chats" 
                                    ? (isFamiliar ? "rgba(0, 168, 132, 0.18)" : "rgba(0, 229, 255, 0.18)") 
                                    : "transparent",
                                border: activeTab === "chats" 
                                    ? (isFamiliar ? "1px solid rgba(0, 168, 132, 0.4)" : "1px solid rgba(0, 229, 255, 0.4)") 
                                    : "1px solid transparent",
                                color: activeTab === "chats" 
                                    ? (isFamiliar ? "#00A884" : "var(--accent-cyan, #00E5FF)") 
                                    : (isFamiliar ? "#8696A0" : "#888"),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.3rem", cursor: "pointer", position: "relative"
                            }}
                            title="Chats"
                        >
                            💬
                            {unreadMessagesCount > 0 && (
                                <span style={{
                                    position: "absolute", top: "2px", right: "2px",
                                    minWidth: "16px", height: "16px", borderRadius: "8px",
                                    background: "#25D366", color: "#000", fontSize: "0.62rem",
                                    fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
                                    padding: "0 4px"
                                }}>
                                    {unreadMessagesCount}
                                </span>
                            )}
                        </button>

                        {/* Status Tab */}
                        <button
                            onClick={() => setActiveTab("status")}
                            style={{
                                width: "46px", height: "46px", borderRadius: "12px",
                                background: activeTab === "status" 
                                    ? (isFamiliar ? "rgba(0, 168, 132, 0.18)" : "rgba(0, 230, 118, 0.18)") 
                                    : "transparent",
                                border: activeTab === "status" 
                                    ? (isFamiliar ? "1px solid rgba(0, 168, 132, 0.4)" : "1px solid rgba(0, 230, 118, 0.4)") 
                                    : "1px solid transparent",
                                color: activeTab === "status" 
                                    ? (isFamiliar ? "#00A884" : "var(--accent-emerald, #00E676)") 
                                    : (isFamiliar ? "#8696A0" : "#888"),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.3rem", cursor: "pointer", position: "relative"
                            }}
                            title="Novedades & Estados"
                        >
                            ⭕
                            {unreadStoriesCount > 0 && (
                                <span style={{
                                    position: "absolute", top: "4px", right: "4px",
                                    width: "8px", height: "8px", borderRadius: "50%",
                                    background: "#25D366"
                                }} />
                            )}
                        </button>

                        {/* Calls Tab */}
                        <button
                            onClick={() => setActiveTab("calls")}
                            style={{
                                width: "46px", height: "46px", borderRadius: "12px",
                                background: activeTab === "calls" 
                                    ? (isFamiliar ? "rgba(0, 168, 132, 0.18)" : "rgba(0, 229, 255, 0.18)") 
                                    : "transparent",
                                border: activeTab === "calls" 
                                    ? (isFamiliar ? "1px solid rgba(0, 168, 132, 0.4)" : "1px solid rgba(0, 229, 255, 0.4)") 
                                    : "1px solid transparent",
                                color: activeTab === "calls" 
                                    ? (isFamiliar ? "#00A884" : "var(--accent-cyan, #00E5FF)") 
                                    : (isFamiliar ? "#8696A0" : "#888"),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.3rem", cursor: "pointer", position: "relative"
                            }}
                            title="Llamadas WebRTC"
                        >
                            📞
                            {missedCallsCount > 0 && (
                                <span style={{
                                    position: "absolute", top: "2px", right: "2px",
                                    minWidth: "16px", height: "16px", borderRadius: "8px",
                                    background: "#FF3B30", color: "#FFF", fontSize: "0.62rem",
                                    fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
                                    padding: "0 4px"
                                }}>
                                    {missedCallsCount}
                                </span>
                            )}
                        </button>

                        {/* Tools Tab */}
                        <button
                            onClick={() => setActiveTab("tools")}
                            style={{
                                width: "46px", height: "46px", borderRadius: "12px",
                                background: activeTab === "tools" 
                                    ? "rgba(179, 136, 255, 0.18)" 
                                    : "transparent",
                                border: activeTab === "tools" ? "1px solid rgba(179, 136, 255, 0.4)" : "1px solid transparent",
                                color: activeTab === "tools" ? "#B388FF" : (isFamiliar ? "#8696A0" : "#888"),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.3rem", cursor: "pointer"
                            }}
                            title="Centro de Malla & Herramientas Tácticas"
                        >
                            ⚡
                        </button>
                    </div>

                    {/* Bottom Settings in Rail */}
                    <button
                        onClick={() => setActiveTab("settings")}
                        style={{
                            width: "46px", height: "46px", borderRadius: "12px",
                            background: activeTab === "settings" 
                                ? (isFamiliar ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.15)") 
                                : "transparent",
                            border: activeTab === "settings" ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid transparent",
                            color: activeTab === "settings" ? "#FFF" : (isFamiliar ? "#8696A0" : "#888"),
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.3rem", cursor: "pointer"
                        }}
                        title="Ajustes"
                    >
                        ⚙️
                    </button>
                </aside>
            )}

            {/* Dynamic Content Area based on Selected Tab */}
            <div style={{ flex: 1, display: "flex", height: "100%", width: "100%", overflow: "hidden", position: "relative" }}>
                {activeTab === "chats" && <Sidebar />}
                {activeTab === "status" && <StatusView />}
                {activeTab === "calls" && <CallsHistoryView />}
                {activeTab === "tools" && <TacticalCommandCenter />}
                {activeTab === "settings" && (
                    isFamiliar 
                        ? <FamiliarSettingsView onClose={() => setActiveTab("chats")} />
                        : <SettingsModal onClose={() => setActiveTab("chats")} />
                )}
            </div>

            {/* Mobile Bottom Navigation Bar (WhatsApp Style) */}
            {!isTablet && (
                <nav style={{
                    height: "calc(60px + env(safe-area-inset-bottom, 0px))",
                    paddingBottom: "env(safe-area-inset-bottom, 0px)",
                    background: isFamiliar 
                        ? "#121B22" 
                        : "linear-gradient(180deg, rgba(14, 18, 36, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                    borderTop: isFamiliar 
                        ? "1px solid rgba(255, 255, 255, 0.08)" 
                        : "1px solid rgba(0, 229, 255, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-around",
                    zIndex: 20,
                    flexShrink: 0,
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)"
                }}>
                    {/* 1. Chats */}
                    <button
                        onClick={() => setActiveTab("chats")}
                        style={{
                            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", 
                            color: activeTab === "chats" 
                                ? (isFamiliar ? "#00A884" : "var(--accent-cyan, #00E5FF)") 
                                : (isFamiliar ? "#8696A0" : "var(--text-muted, #888)"),
                            cursor: "pointer", gap: "2px", position: "relative", height: "100%",
                            transition: "all 0.15s ease"
                        }}
                    >
                        <div style={{
                            position: "relative", fontSize: "1.35rem",
                            padding: isFamiliar && activeTab === "chats" ? "2px 14px" : "2px",
                            borderRadius: "16px",
                            backgroundColor: isFamiliar && activeTab === "chats" ? "rgba(0, 168, 132, 0.16)" : "transparent"
                        }}>
                            💬
                            {unreadMessagesCount > 0 && (
                                <span style={{
                                    position: "absolute", top: "-2px", right: "-4px",
                                    minWidth: "16px", height: "16px", borderRadius: "8px",
                                    background: "#25D366", color: "#000", fontSize: "0.58rem",
                                    fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
                                    padding: "0 4px",
                                    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.4)"
                                }}>
                                    {unreadMessagesCount}
                                </span>
                            )}
                        </div>
                        <span style={{ 
                            fontSize: "0.72rem", 
                            fontWeight: activeTab === "chats" ? 700 : 500,
                            letterSpacing: "0.1px"
                        }}>
                            Chats
                        </span>
                    </button>

                    {/* 2. Novedades / Estados */}
                    <button
                        onClick={() => setActiveTab("status")}
                        style={{
                            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", 
                            color: activeTab === "status" 
                                ? (isFamiliar ? "#00A884" : "var(--accent-emerald, #00E676)") 
                                : (isFamiliar ? "#8696A0" : "var(--text-muted, #888)"),
                            cursor: "pointer", gap: "2px", position: "relative", height: "100%",
                            transition: "all 0.15s ease"
                        }}
                    >
                        <div style={{
                            position: "relative", fontSize: "1.35rem",
                            padding: isFamiliar && activeTab === "status" ? "2px 14px" : "2px",
                            borderRadius: "16px",
                            backgroundColor: isFamiliar && activeTab === "status" ? "rgba(0, 168, 132, 0.16)" : "transparent"
                        }}>
                            ⭕
                            {unreadStoriesCount > 0 && (
                                <span style={{
                                    position: "absolute", top: "0px", right: "-2px",
                                    width: "8px", height: "8px", borderRadius: "50%",
                                    background: "#25D366"
                                }} />
                            )}
                        </div>
                        <span style={{ 
                            fontSize: "0.72rem", 
                            fontWeight: activeTab === "status" ? 700 : 500,
                            letterSpacing: "0.1px"
                        }}>
                            Novedades
                        </span>
                    </button>

                    {/* 3. Llamadas */}
                    <button
                        onClick={() => setActiveTab("calls")}
                        style={{
                            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", 
                            color: activeTab === "calls" 
                                ? (isFamiliar ? "#00A884" : "var(--accent-cyan, #00E5FF)") 
                                : (isFamiliar ? "#8696A0" : "var(--text-muted, #888)"),
                            cursor: "pointer", gap: "2px", position: "relative", height: "100%",
                            transition: "all 0.15s ease"
                        }}
                    >
                        <div style={{
                            position: "relative", fontSize: "1.35rem",
                            padding: isFamiliar && activeTab === "calls" ? "2px 14px" : "2px",
                            borderRadius: "16px",
                            backgroundColor: isFamiliar && activeTab === "calls" ? "rgba(0, 168, 132, 0.16)" : "transparent"
                        }}>
                            📞
                            {missedCallsCount > 0 && (
                                <span style={{
                                    position: "absolute", top: "-2px", right: "-4px",
                                    minWidth: "16px", height: "16px", borderRadius: "8px",
                                    background: "#FF3B30", color: "#FFF", fontSize: "0.58rem",
                                    fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
                                    padding: "0 4px",
                                    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.4)"
                                }}>
                                    {missedCallsCount}
                                </span>
                            )}
                        </div>
                        <span style={{ 
                            fontSize: "0.72rem", 
                            fontWeight: activeTab === "calls" ? 700 : 500,
                            letterSpacing: "0.1px"
                        }}>
                            Llamadas
                        </span>
                    </button>

                    {/* 4. Herramientas Tácticas C4ISR */}
                    <button
                        onClick={() => setActiveTab("tools")}
                        style={{
                            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", 
                            color: activeTab === "tools" 
                                ? "#B388FF" 
                                : (isFamiliar ? "#8696A0" : "var(--text-muted, #888)"),
                            cursor: "pointer", gap: "2px", position: "relative", height: "100%",
                            transition: "all 0.15s ease"
                        }}
                    >
                        <div style={{
                            fontSize: "1.35rem",
                            padding: isFamiliar && activeTab === "tools" ? "2px 14px" : "2px",
                            borderRadius: "16px",
                            backgroundColor: isFamiliar && activeTab === "tools" ? "rgba(179, 136, 255, 0.16)" : "transparent"
                        }}>
                            ⚡
                        </div>
                        <span style={{ 
                            fontSize: "0.72rem", 
                            fontWeight: activeTab === "tools" ? 700 : 500,
                            letterSpacing: "0.1px"
                        }}>
                            Herramientas
                        </span>
                    </button>

                    {/* 5. Ajustes */}
                    <button
                        onClick={() => setActiveTab("settings")}
                        style={{
                            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", 
                            color: activeTab === "settings" 
                                ? "#FFFFFF" 
                                : (isFamiliar ? "#8696A0" : "var(--text-muted, #888)"),
                            cursor: "pointer", gap: "2px", position: "relative", height: "100%",
                            transition: "all 0.15s ease"
                        }}
                    >
                        <div style={{
                            fontSize: "1.35rem",
                            padding: isFamiliar && activeTab === "settings" ? "2px 14px" : "2px",
                            borderRadius: "16px",
                            backgroundColor: isFamiliar && activeTab === "settings" ? "rgba(255, 255, 255, 0.12)" : "transparent"
                        }}>
                            ⚙️
                        </div>
                        <span style={{ 
                            fontSize: "0.72rem", 
                            fontWeight: activeTab === "settings" ? 700 : 500,
                            letterSpacing: "0.1px"
                        }}>
                            Ajustes
                        </span>
                    </button>
                </nav>
            )}
        </div>
    );
}
