"use client";

import React, { useState } from "react";

interface CalculatorScreenProps {
    onUnlock?: (pin: string) => Promise<void> | void;
}

/**
 * Anti-forensic disguise: RED masquerades as a standard iOS/Android clean calculator.
 * Typing the secret PIN + "=" unlocks the vault instead of evaluating math.
 */
export function CalculatorScreen({ onUnlock }: CalculatorScreenProps) {
    const handleUnlock = onUnlock || (async () => {});
    const [display, setDisplay] = useState("0");
    const [equation, setEquation] = useState("");
    const [awaitingUnlock, setAwaitingUnlock] = useState(false);

    const handleKey = async (key: string) => {
        if (awaitingUnlock) return;

        if (key === "C") {
            setDisplay("0");
            setEquation("");
            return;
        }

        if (key === "=") {
            const typed = display;
            setAwaitingUnlock(true);
            
            await handleUnlock(typed);

            setAwaitingUnlock(false);
            try {
                const expr = (equation + display).replace(/[^0-9+\-*/.]/g, "");
                const result = new Function(`"use strict"; return (${expr})`)();
                setEquation("");
                setDisplay(String(result));
            } catch {
                setDisplay("Error");
                setEquation("");
            }
            return;
        }

        if (["+", "-", "*", "/"].includes(key)) {
            setEquation(display + key);
            setDisplay("0");
            return;
        }

        if (display === "0" || display === "Error") {
            setDisplay(key);
        } else {
            setDisplay(display + key);
        }
    };

    const keys = [
        "C", "+/-", "%", "/",
        "7", "8", "9", "*",
        "4", "5", "6", "-",
        "1", "2", "3", "+",
        "0", ".", "="
    ];

    return (
        <div style={{
            position: "fixed", inset: 0,
            background: "#000000", color: "#ffffff",
            display: "flex", flexDirection: "column",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            zIndex: 99999
        }}>
            {/* Display */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "24px 20px" }}>
                <div style={{ textAlign: "right", fontSize: "1.2rem", color: "#888888", minHeight: "28px" }}>
                    {equation}
                </div>
                <div style={{ textAlign: "right", fontSize: "4.2rem", fontWeight: 300, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {awaitingUnlock ? "..." : display}
                </div>
            </div>

            {/* Keypad Circular Táctico */}
            <div style={{ padding: "0 16px 36px 16px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
                {keys.map(k => {
                    const isOrange = ["/", "*", "-", "+", "="].includes(k);
                    const isGray = ["C", "+/-", "%"].includes(k);
                    const isZero = k === "0";

                    return (
                        <button
                            key={k}
                            onClick={() => handleKey(k)}
                            disabled={awaitingUnlock}
                            style={{
                                gridColumn: isZero ? "span 2" : "span 1",
                                height: "72px",
                                borderRadius: isZero ? "36px" : "50%",
                                fontSize: "1.7rem", fontWeight: 400,
                                border: "none",
                                background: isOrange ? "#FF9F0A" : isGray ? "#A5A5A5" : "#333333",
                                color: isGray ? "#000000" : "#ffffff",
                                cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: isZero ? "flex-start" : "center",
                                paddingLeft: isZero ? "28px" : "0"
                            }}
                        >
                            {k}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}