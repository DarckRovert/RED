import React from "react";
import { useRedStore } from "../../store/useRedStore";
import {
    SettingsManager,
} from "../../lib/settingsManager";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

export const IdentityTab: React.FC = () => {
    const { identity, navigate } = useRedStore();
    const { t } = useTranslation();

    return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                {t.settings?.tab_identity || "Identidad Criptográfica & Credenciales Soberanas"}
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {t.settings?.key_export_desc || "Par de claves asimétricas de curva elíptica Curve25519 / Dilithium y DID Soberano."}
                            </p>
                        </div>

                        <div className="card-tactical" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>DID IDENTIFIER</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>
                                    did:red:{identity?.identity_hash || "local"}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>ALIAS DE OPERADOR</div>
                                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fff" }}>
                                    {identity?.nickname || "Operador RED"}
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                <button
                                    onClick={() => {
                                        if (identity?.identity_hash) {
                                            navigator.clipboard.writeText(`did:red:${identity.identity_hash}`);
                                            SettingsManager.triggerHaptic("light");
                                            toast.success("📋 DID copiado al portapapeles");
                                        }
                                    }}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "8px 12px", fontSize: "0.75rem" }}
                                >
                                    Copiar DID Completo
                                </button>
                                <button
                                    onClick={() => navigate("idVault")}
                                    className="btn-tactical-pill active"
                                    style={{ padding: "8px 14px", fontSize: "0.75rem" }}
                                >
                                    Ver Bóveda de Claves ➔
                                </button>
                            </div>
                        </div>
                    </div>

    );
};
