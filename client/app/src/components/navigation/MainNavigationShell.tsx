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

export type NavTab = "chats" | "status" | "calls" | "tools" | "settings";

interface MainNavigationShellProps {
    isTablet: boolean;
}

export function MainNavigationShell({ isTablet }: MainNavigationShellProps) {
    const { t } = useTranslation();
    const { 
        conversations: rawConvs, identity, nodeOnline, navigate,
        peerStories, activeConversationId
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

    return (
        <div style={{
            display: "flex",
            flexDirection: isTablet ? "row" : "column",
            width: "100%",
            height: "100%",
            background: "var(--bg-void, #020204)",
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
                    background: "linear-gradient(180deg, #0A0D1E 0%, #050712 100%)",
                    borderRight: "1px solid rgba(0, 229, 255, 0.15)",
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
                            width: "42px", height: "42px", borderRadius: "12px",
                            background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.3rem", fontWeight: 900, color: "#FFFFFF",
                            boxShadow: "0 0 16px rgba(255, 51, 85, 0.5)", cursor: "pointer"
                        }}
                        title={`RED OS v${RED_VERSION}`}
                    >
                        R
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1, marginTop: "10px" }}>
                        {/* Chats Tab */}
                        <button
                            onClick={() => setActiveTab("chats")}
                            style={{
                                width: "46px", height: "46px", borderRadius: "12px",
                                background: activeTab === "chats" ? "rgba(0, 229, 255, 0.18)" : "transparent",
                                border: activeTab === "chats" ? "1px solid rgba(0, 229, 255, 0.4)" : "1px solid transparent",
                                color: activeTab === "chats" ? "var(--accent-cyan, #00E5FF)" : "#888",
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
                                    background: "#00E676", color: "#000", fontSize: "0.62rem",
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
                                background: activeTab === "status" ? "rgba(0, 230, 118, 0.18)" : "transparent",
                                border: activeTab === "status" ? "1px solid rgba(0, 230, 118, 0.4)" : "1px solid transparent",
                                color: activeTab === "status" ? "var(--accent-emerald, #00E676)" : "#888",
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
                                    background: "#00E676"
                                }} />
                            )}
                        </button>

                        {/* Calls Tab */}
                        <button
                            onClick={() => setActiveTab("calls")}
                            style={{
                                width: "46px", height: "46px", borderRadius: "12px",
                                background: activeTab === "calls" ? "rgba(0, 229, 255, 0.18)" : "transparent",
                                border: activeTab === "calls" ? "1px solid rgba(0, 229, 255, 0.4)" : "1px solid transparent",
                                color: activeTab === "calls" ? "var(--accent-cyan, #00E5FF)" : "#888",
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
                                    background: "#FF3355", color: "#FFF", fontSize: "0.62rem",
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
                                background: activeTab === "tools" ? "rgba(179, 136, 255, 0.18)" : "transparent",
                                border: activeTab === "tools" ? "1px solid rgba(179, 136, 255, 0.4)" : "1px solid transparent",
                                color: activeTab === "tools" ? "#B388FF" : "#888",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.3rem", cursor: "pointer"
                            }}
                            title="Herramientas Tácticas & C4ISR"
                        >
                            ⚡
                        </button>
                    </div>

                    {/* Bottom Settings in Rail */}
                    <button
                        onClick={() => setActiveTab("settings")}
                        style={{
                            width: "46px", height: "46px", borderRadius: "12px",
                            background: activeTab === "settings" ? "rgba(255, 255, 255, 0.15)" : "transparent",
                            border: activeTab === "settings" ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid transparent",
                            color: activeTab === "settings" ? "#FFF" : "#888",
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
                {activeTab === "settings" && <SettingsModal onClose={() => setActiveTab("chats")} />}
            </div>

            {/* Mobile Bottom Navigation Bar (WhatsApp Style) */}
            {!isTablet && (
                <nav style={{
                    height: "calc(58px + env(safe-area-inset-bottom, 0px))",
                    paddingBottom: "env(safe-area-inset-bottom, 0px)",
                    background: "linear-gradient(180deg, rgba(14, 18, 36, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                    borderTop: "1px solid rgba(0, 229, 255, 0.15)",
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
                            background: "none", border: "none", color: activeTab === "chats" ? "var(--accent-cyan, #00E5FF)" : "var(--text-muted, #888)",
                            cursor: "pointer", gap: "3px", position: "relative", height: "100%"
                        }}
                    >
                        <div style={{ position: "relative", fontSize: "1.35rem" }}>
                            💬
                            {unreadMessagesCount > 0 && (
                                <span style={{
                                    position: "absolute", top: "-3px", right: "-6px",
                                    minWidth: "15px", height: "15px", borderRadius: "8px",
                                    background: "#00E676", color: "#000", fontSize: "0.58rem",
                                    fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
                                    padding: "0 3px"
                                }}>
                                    {unreadMessagesCount}
                                </span>
                            )}
                        </div>
                        <span style={{ fontSize: "0.68rem", fontWeight: activeTab === "chats" ? 900 : 600 }}>
                            Chats
                        </span>
                    </button>

                    {/* 2. Novedades / Estados */}
                    <button
                        onClick={() => setActiveTab("status")}
                        style={{
                            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", color: activeTab === "status" ? "var(--accent-emerald, #00E676)" : "var(--text-muted, #888)",
                            cursor: "pointer", gap: "3px", position: "relative", height: "100%"
                        }}
                    >
                        <div style={{ position: "relative", fontSize: "1.35rem" }}>
                            ⭕
                            {unreadStoriesCount > 0 && (
                                <span style={{
                                    position: "absolute", top: "0px", right: "-2px",
                                    width: "7px", height: "7px", borderRadius: "50%",
                                    background: "#00E676"
                                }} />
                            )}
                        </div>
                        <span style={{ fontSize: "0.68rem", fontWeight: activeTab === "status" ? 900 : 600 }}>
                            Novedades
                        </span>
                    </button>

                    {/* 3. Llamadas */}
                    <button
                        onClick={() => setActiveTab("calls")}
                        style={{
                            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", color: activeTab === "calls" ? "var(--accent-cyan, #00E5FF)" : "var(--text-muted, #888)",
                            cursor: "pointer", gap: "3px", position: "relative", height: "100%"
                        }}
                    >
                        <div style={{ position: "relative", fontSize: "1.35rem" }}>
                            📞
                            {missedCallsCount > 0 && (
                                <span style={{
                                    position: "absolute", top: "-3px", right: "-6px",
                                    minWidth: "15px", height: "15px", borderRadius: "8px",
                                    background: "#FF3355", color: "#FFF", fontSize: "0.58rem",
                                    fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
                                    padding: "0 3px"
                                }}>
                                    {missedCallsCount}
                                </span>
                            )}
                        </div>
                        <span style={{ fontSize: "0.68rem", fontWeight: activeTab === "calls" ? 900 : 600 }}>
                            Llamadas
                        </span>
                    </button>

                    {/* 4. Herramientas Tácticas C4ISR */}
                    <button
                        onClick={() => setActiveTab("tools")}
                        style={{
                            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", color: activeTab === "tools" ? "#B388FF" : "var(--text-muted, #888)",
                            cursor: "pointer", gap: "3px", position: "relative", height: "100%"
                        }}
                    >
                        <div style={{ fontSize: "1.35rem" }}>
                            ⚡
                        </div>
                        <span style={{ fontSize: "0.68rem", fontWeight: activeTab === "tools" ? 900 : 600 }}>
                            Herramientas
                        </span>
                    </button>

                    {/* 5. Ajustes */}
                    <button
                        onClick={() => setActiveTab("settings")}
                        style={{
                            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", color: activeTab === "settings" ? "#FFFFFF" : "var(--text-muted, #888)",
                            cursor: "pointer", gap: "3px", position: "relative", height: "100%"
                        }}
                    >
                        <div style={{ fontSize: "1.35rem" }}>
                            ⚙️
                        </div>
                        <span style={{ fontSize: "0.68rem", fontWeight: activeTab === "settings" ? 900 : 600 }}>
                            Ajustes
                        </span>
                    </button>
                </nav>
            )}
        </div>
    );
}
