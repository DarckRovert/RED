"use client";

import React, { useState } from "react";
import Logo from "./Logo";

export default function PanicScreen({ onVerified, onWipe }: { onVerified: () => void, onWipe: () => void }) {
    const [pinInput, setPinInput] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const handleKeyPress = (num: number) => {
        if (pinInput.length < 8) {
            setPinInput(prev => prev + num);
            setErrorMsg("");
        }
    };

    const handleDelete = () => {
        setPinInput(prev => prev.slice(0, -1));
    };

    const handleSubmit = () => {
        const panicPin = localStorage.getItem("red_panic_pin");

        if (panicPin && pinInput === panicPin) {
            // Wipe triggered!
            try {
                localStorage.clear();
                sessionStorage.clear();
                // In a real device we might want to also call Capacitor Filesystem to delete databases
            } catch (err) {
                console.error("Wipe failed", err);
            }
            onWipe();
            return;
        }

        // Since we don't have a real Auth PIN yet, any PIN that IS NOT the Panic PIN lets you in for now
        // (In a full prod app, we would verify a separate "Login PIN" here)
        if (pinInput.length >= 4) {
            onVerified();
        } else {
            setErrorMsg("PIN inválido");
            setPinInput("");
        }
    };

    return (
        <div className="splash-screen" style={{ background: "var(--bg)", display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div className="branding" style={{ textAlign: 'center', marginTop: '2rem' }}>
                <Logo size={80} />
                <h2 style={{ fontSize: '1.2rem', marginTop: '1rem', letterSpacing: '0.1em' }} className="font-mono">
                    SISTEMA BLOQUEADO
                </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "320px", zIndex: 10 }}>
                {/* PIN Display */}
                <div style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginBottom: "2rem",
                    height: "40px",
                    alignItems: "center"
                }}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: i < pinInput.length ? 'var(--primary)' : 'var(--surface-hover)',
                            boxShadow: i < pinInput.length ? '0 0 10px var(--primary-glow)' : 'none',
                            transition: 'all 0.2s ease'
                        }} />
                    ))}
                </div>

                {errorMsg && <p style={{ color: "var(--primary)", fontSize: "0.85rem", marginBottom: "1rem" }}>{errorMsg}</p>}

                {/* Numpad */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "1rem",
                    width: "100%",
                    maxWidth: "280px"
                }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handleKeyPress(num)}
                            style={{
                                aspectRatio: "1",
                                borderRadius: "50%",
                                background: "var(--surface)",
                                border: "1px solid var(--glass-border)",
                                fontSize: "1.5rem",
                                fontWeight: "300",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                transition: "all 0.1s ease"
                            }}
                            onMouseDown={e => e.currentTarget.style.background = "var(--surface-hover)"}
                            onMouseUp={e => e.currentTarget.style.background = "var(--surface)"}
                        >
                            {num}
                        </button>
                    ))}
                    <button
                        onClick={handleDelete}
                        style={{ background: "transparent", color: "white", fontSize: "1.2rem", border: "none", cursor: "pointer" }}
                    >
                        ⌫
                    </button>
                    <button
                        onClick={() => handleKeyPress(0)}
                        style={{
                            aspectRatio: "1",
                            borderRadius: "50%",
                            background: "var(--surface)",
                            border: "1px solid var(--glass-border)",
                            fontSize: "1.5rem",
                            fontWeight: "300",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer"
                        }}
                    >
                        0
                    </button>
                    <button
                        onClick={handleSubmit}
                        style={{
                            background: "var(--primary-subtle)",
                            color: "var(--primary)",
                            fontSize: "1.2rem",
                            border: "1px solid rgba(255,23,68,0.3)",
                            borderRadius: "50%",
                            cursor: "pointer"
                        }}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
