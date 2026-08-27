'use client';

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { AppearanceTab } from "./settings/AppearanceTab";
import { CallsTab } from "./settings/CallsTab";
import { AudioTab } from "./settings/AudioTab";
import { StorageTab } from "./settings/StorageTab";
import { PrivacyTab } from "./settings/PrivacyTab";
import { MeshTab } from "./settings/MeshTab";
import { IdentityTab } from "./settings/IdentityTab";
import { BackupTab } from "./settings/BackupTab";
import { UpdatesTab } from "./settings/UpdatesTab";

type SettingsTab = "appearance" | "calls" | "audio" | "storage" | "privacy" | "mesh" | "identity" | "backup" | "updates";

interface SettingsModalProps {
    onClose?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const { goBack } = useRedStore();
    const { t } = useTranslation();
    const handleClose = onClose || goBack;

    const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

    const tabs: { id: SettingsTab; label: string; icon: string }[] = [
        { id: "appearance", label: t('settings.tab_appearance'), icon: "🎨" },
        { id: "calls", label: t('settings.tab_calls'), icon: "📞" },
        { id: "audio", label: t('settings.tab_audio'), icon: "🔊" },
        { id: "storage", label: t('settings.tab_storage'), icon: "💾" },
        { id: "privacy", label: t('settings.tab_privacy'), icon: "🛡️" },
        { id: "mesh", label: t('settings.tab_mesh'), icon: "📡" },
        { id: "identity", label: t('settings.tab_identity'), icon: "🆔" },
        { id: "backup", label: t('settings.tab_backup'), icon: "🔐" },
        { id: "updates", label: t('settings.tab_updates'), icon: "🔄" },
    ];

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(5, 5, 10, 0.85)", backdropFilter: "blur(16px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px", animation: "fadeIn 0.2s ease"
        }}>
            <div style={{
                width: "100%", maxWidth: "840px", maxHeight: "90vh",
                background: "var(--bg-card, #0F111E)",
                border: "1px solid var(--glass-border, rgba(255, 255, 255, 0.1))",
                borderRadius: "20px", display: "flex", flexDirection: "column",
                overflow: "hidden", boxShadow: "0 24px 64px rgba(0, 0, 0, 0.8)"
            }}>
                {/* Header */}
                <div style={{
                    padding: "18px 24px", display: "flex", alignItems: "center",
                    justifyContent: "space-between", borderBottom: "1px solid var(--glass-border)",
                    background: "rgba(255, 255, 255, 0.02)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.3rem" }}>⚙️</span>
                        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#FFF" }}>
                            {t('settings.master_title')}
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="btn-icon"
                        style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255, 255, 255, 0.06)" }}
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs Bar */}
                <div style={{
                    display: "flex", gap: "6px", padding: "12px 20px",
                    overflowX: "auto", borderBottom: "1px solid var(--glass-border)",
                    background: "rgba(0, 0, 0, 0.2)", flexShrink: 0
                }}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`btn-tactical-pill ${activeTab === tab.id ? "active" : ""}`}
                            style={{
                                padding: "8px 14px", borderRadius: "12px",
                                border: activeTab === tab.id ? "1.5px solid var(--primary, #E8213A)" : "1px solid rgba(255,255,255,0.06)",
                                background: activeTab === tab.id ? "var(--primary-subtle, rgba(232, 33, 58, 0.18))" : "rgba(255, 255, 255, 0.04)",
                                color: activeTab === tab.id ? "#FFF" : "var(--text-secondary)",
                                fontSize: "0.82rem", fontWeight: activeTab === tab.id ? 800 : 500,
                                boxShadow: activeTab === tab.id ? "0 0 12px var(--primary-glow)" : "none",
                                cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                                whiteSpace: "nowrap", transition: "all 0.15s"
                            }}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Tab Content Body */}
                <div style={{
                    flex: 1, overflowY: "auto", padding: "24px",
                    display: "flex", flexDirection: "column"
                }}>
                    {activeTab === "appearance" && <AppearanceTab />}
                    {activeTab === "calls" && <CallsTab />}
                    {activeTab === "audio" && <AudioTab />}
                    {activeTab === "storage" && <StorageTab />}
                    {activeTab === "privacy" && <PrivacyTab />}
                    {activeTab === "mesh" && <MeshTab />}
                    {activeTab === "identity" && <IdentityTab />}
                    {activeTab === "backup" && <BackupTab />}
                    {activeTab === "updates" && <UpdatesTab />}
                </div>
            </div>
        </div>
    );
};
