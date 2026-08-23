import React, { useState } from "react";
import { useRedStore } from "../../store/useRedStore";
import {
    SettingsManager,
} from "../../lib/settingsManager";
import { SovereignBackupEngine } from "../../lib/SovereignBackupEngine";
import { TacticalAudioEngine } from "../../lib/TacticalAudioEngine";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

interface BackupTabProps {
    onClose?: () => void;
}

export const BackupTab: React.FC<BackupTabProps> = ({ onClose }) => {
    const { preferences, identity, conversations, contacts, navigate, goBack } = useRedStore();
    const { t } = useTranslation();
    const handleClose = onClose || goBack;
    const [, forceUpdate] = useState({});

    return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                {t.settings?.tab_backup || "Respaldo & Nube Automática (Google Drive)"}
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {t.backup_module?.subtitle || "Copias de seguridad automáticas en 1 toque, cifradas con AES-256-GCM y derivación de clave maestra."}
                            </p>
                        </div>

                        {/* Card Principal con Estado en Vivo */}
                        {(() => {
                            const status = SovereignBackupEngine.getAutoBackupStatus();
                            return (
                                <div className="card-tactical" style={{
                                    padding: "18px",
                                    background: "linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(14,16,28,0.95) 100%)",
                                    border: "1px solid rgba(56, 189, 248, 0.35)",
                                    display: "flex", flexDirection: "column", gap: "14px"
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <span style={{ fontSize: "1.6rem" }}>☁️</span>
                                            <div>
                                                <div style={{ fontSize: "1rem", fontWeight: 900, color: "#fff" }}>
                                                    {status.isProtected ? "Bóveda Protegida" : "Sin Respaldo Reciente"}
                                                </div>
                                                <div style={{ fontSize: "0.72rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    ÚLTIMA COPIA: {status.lastBackupFormatted}
                                                </div>
                                            </div>
                                        </div>

                                        <span className={`badge-tactical ${status.statusColor === "emerald" ? "badge-tactical-emerald" : (status.statusColor === "amber" ? "badge-tactical-amber" : "badge-tactical-crimson")}`} style={{ padding: "4px 10px", fontSize: "0.70rem" }}>
                                            {status.statusLabel}
                                        </span>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "rgba(0,0,0,0.35)", padding: "10px", borderRadius: "10px" }}>
                                        <div>
                                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>DESTINO AUTOMÁTICO</div>
                                            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff", marginTop: "2px" }}>Google Drive / Almacenamiento</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>CIFRADO SEGURO</div>
                                            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-emerald)", marginTop: "2px" }}>AES-256-GCM (Zero-Knowledge)</div>
                                        </div>
                                    </div>

                                    {/* Botón de 1-Toque Directo */}
                                    <button
                                        onClick={async () => {
                                            SettingsManager.triggerHaptic("medium");
                                            toast.info("Cifrando y enviando a Google Drive…");
                                            const res = await SovereignBackupEngine.createOneTouchBackup();
                                            if (res.success) {
                                                toast.success("✅ Respaldo guardado en Google Drive");
                                                TacticalAudioEngine.playMessageSent();
                                            } else {
                                                toast.error(res.error || "Error al respaldar");
                                            }
                                        }}
                                        className="btn-tactical-primary"
                                        style={{
                                            padding: "14px",
                                            fontSize: "0.88rem",
                                            fontWeight: 900,
                                            background: "linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)",
                                            boxShadow: "0 4px 16px rgba(30, 136, 229, 0.45)",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                                        }}
                                    >
                                        <span>⚡</span> Respaldar a Google Drive en 1 Toque
                                    </button>
                                </div>
                            );
                        })()}

                        {/* Switch de Auto-Sync */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>
                                    Sincronización Automática Inteligente
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Guarda copias en segundo plano cuando añades contactos o chats.
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={SovereignBackupEngine.getAutoBackupStatus().autoSyncEnabled}
                                onChange={(e) => {
                                    SettingsManager.triggerHaptic("light");
                                    SovereignBackupEngine.setAutoSyncEnabled(e.target.checked);
                                    toast.info(e.target.checked ? "Sincronización automática activada" : "Sincronización automática desactivada");
                                }}
                                style={{ width: 22, height: 22, accentColor: "var(--accent-cyan)", cursor: "pointer" }}
                            />
                        </div>

                        {/* Accesos Rápidos: Restaurar & Avanzado */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <button
                                onClick={() => {
                                    handleClose();
                                    navigate("backup");
                                }}
                                className="btn-tactical-secondary"
                                style={{ padding: "12px", fontSize: "0.78rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                            >
                                <span>📥</span> Restaurar Copia
                            </button>
                            <button
                                onClick={() => {
                                    handleClose();
                                    navigate("backup");
                                }}
                                className="btn-tactical-secondary"
                                style={{ padding: "12px", fontSize: "0.78rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: "var(--accent-indigo)" }}
                            >
                                <span>🌐</span> Web3 IPFS / Frase Semilla
                            </button>
                        </div>
                    </div>

    );
};
