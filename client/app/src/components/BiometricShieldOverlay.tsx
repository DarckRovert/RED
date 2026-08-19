"use client";

import React, { useState, useEffect } from "react";
import { BiometricLockEngine } from "../lib/BiometricLockEngine";
import { toast } from "./Toast";

export const BiometricShieldOverlay: React.FC = () => {
    const [isLocked, setIsLocked] = useState(false);
    const [pinInput, setPinInput] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        BiometricLockEngine.init();
        const unsub = BiometricLockEngine.subscribe((locked) => {
            setIsLocked(locked);
            if (locked) {
                // Auto trigger biometric on lock
                BiometricLockEngine.authenticate().catch(() => {});
            }
        });
        return unsub;
    }, []);

    if (!isLocked) return null;

    const handleBiometricClick = async () => {
        setErrorMsg("");
        const success = await BiometricLockEngine.authenticate();
        if (!success) {
            setErrorMsg("Autenticación biométrica no completada. Ingrese PIN de seguridad.");
        }
    };

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");
        const ok = BiometricLockEngine.verifyPin(pinInput);
        if (ok) {
            setPinInput("");
            toast.success("Bóveda RED Desbloqueada");
        } else {
            setErrorMsg("PIN de seguridad incorrecto.");
            setPinInput("");
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 999999,
                background: "radial-gradient(circle at center, #101426 0%, #060810 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
                backdropFilter: "blur(30px)",
                animation: "fadeIn 0.2s ease-out",
            }}
        >
            <div
                className="card-tactical"
                style={{
                    maxWidth: "380px",
                    width: "100%",
                    padding: "32px 24px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: "20px",
                    border: "1px solid var(--primary-bright)",
                    boxShadow: "0 0 40px var(--primary-glow)",
                }}
            >
                <div
                    style={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--primary) 0%, #750010 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                        boxShadow: "0 0 24px var(--primary-glow)",
                    }}
                >
                    🔒
                </div>

                <div>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: "#fff", margin: "0 0 6px 0" }}>
                        BÓVEDA RED BLOQUEADA
                    </h2>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
                        Protección Criptográfica por Inactividad
                    </p>
                </div>

                {errorMsg && (
                    <div
                        style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            background: "rgba(255, 51, 85, 0.15)",
                            border: "1px solid var(--accent-crimson)",
                            color: "var(--accent-crimson)",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                        }}
                    >
                        {errorMsg}
                    </div>
                )}

                <button
                    onClick={handleBiometricClick}
                    className="btn-tactical-primary"
                    style={{
                        width: "100%",
                        padding: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        fontSize: "0.88rem",
                    }}
                >
                    <span>👆</span> Usar Biometría / Huella
                </button>

                <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "10px" }}>
                    <hr style={{ flex: 1, borderColor: "var(--glass-border)" }} />
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>O INGRESA PIN</span>
                    <hr style={{ flex: 1, borderColor: "var(--glass-border)" }} />
                </div>

                <form onSubmit={handlePinSubmit} style={{ width: "100%", display: "flex", gap: "8px" }}>
                    <input
                        type="password"
                        maxLength={8}
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        placeholder="PIN de Seguridad"
                        style={{
                            flex: 1,
                            padding: "10px 14px",
                            borderRadius: "8px",
                            background: "rgba(0,0,0,0.4)",
                            border: "1px solid var(--glass-border)",
                            color: "#fff",
                            textAlign: "center",
                            fontSize: "1rem",
                            letterSpacing: "4px",
                            outline: "none",
                        }}
                    />
                    <button
                        type="submit"
                        className="btn-tactical-pill active"
                        style={{ padding: "0 16px", fontSize: "0.82rem" }}
                    >
                        OK
                    </button>
                </form>
            </div>
        </div>
    );
};
