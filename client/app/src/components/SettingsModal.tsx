'use client';

import React, { useState, useEffect } from "react";
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
import { PaymentsTab } from "./settings/PaymentsTab";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";

import { TacIcon, TacIconName } from "./ui/TacIcon";

type SettingsTab = "appearance" | "payments" | "calls" | "audio" | "storage" | "privacy" | "mesh" | "identity" | "backup" | "updates";

interface SettingsModalProps {
    onClose?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const { goBack } = useRedStore();
    const { t } = useTranslation();
    const handleClose = onClose || goBack;

    const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

    // Registro LIFO de retroceso físico / Esc
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            handleClose();
            return true;
        });
        return unregister;
    }, [handleClose]);

    const tabs: { id: SettingsTab; label: string; iconName: TacIconName }[] = [
        { id: "appearance", label: t('settings.tab_appearance'), iconName: "palette" },
        { id: "payments", label: "Pasaporte de Pagos", iconName: "card" },
        { id: "calls", label: t('settings.tab_calls'), iconName: "calls" },
        { id: "audio", label: t('settings.tab_audio'), iconName: "volume" },
        { id: "storage", label: t('settings.tab_storage'), iconName: "database" },
        { id: "privacy", label: t('settings.tab_privacy'), iconName: "shield" },
        { id: "mesh", label: t('settings.tab_mesh'), iconName: "radio" },
        { id: "identity", label: t('settings.tab_identity'), iconName: "user" },
        { id: "backup", label: t('settings.tab_backup'), iconName: "lock" },
        { id: "updates", label: t('settings.tab_updates'), iconName: "refresh" },
    ];

    return (
        <div 
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    TacticalAudioEngine.playTap();
                    handleClose();
                }
            }}
            style={{
                position: "fixed", inset: 0, zIndex: 1000,
                background: "rgba(5, 5, 10, 0.85)", backdropFilter: "blur(16px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "16px", animation: "fadeIn 0.2s ease"
            }}
        >
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
                        <TacIcon name="settings" size={20} color="var(--primary, #E8213A)" />
                        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#FFF" }}>
                            {t('settings.master_title')}
                        </h2>
                    </div>
                    <button
                        onClick={() => { TacticalAudioEngine.playTap(); handleClose(); }}
                        className="btn-icon"
                        style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255, 255, 255, 0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                        <TacIcon name="x" size={16} color="#FFF" />
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
                            onClick={() => { TacticalAudioEngine.playTap(); setActiveTab(tab.id); }}
                            className={`btn-tactical-pill ${activeTab === tab.id ? "active" : ""}`}
                            style={{
                                padding: "8px 14px", borderRadius: "12px",
                                border: activeTab === tab.id ? "1.5px solid var(--primary, #E8213A)" : "1px solid rgba(255,255,255,0.06)",
                                background: activeTab === tab.id ? "var(--primary-subtle, rgba(232, 33, 58, 0.18))" : "rgba(255, 255, 255, 0.04)",
                                color: activeTab === tab.id ? "#FFF" : "var(--text-secondary)",
                                fontSize: "0.82rem", fontWeight: activeTab === tab.id ? 800 : 500,
                                boxShadow: activeTab === tab.id ? "0 0 12px var(--primary-glow)" : "none",
                                cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                                whiteSpace: "nowrap", transition: "all 0.15s"
                            }}
                        >
                            <TacIcon
                                name={tab.iconName}
                                size={14}
                                color={activeTab === tab.id ? "#FFF" : "var(--text-secondary)"}
                            />
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
                    {activeTab === "payments" && <PaymentsTab />}
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
