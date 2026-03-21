"use client";

import React, { useState } from "react";

interface CalculatorScreenProps {
    // Called with the PIN typed when user presses "="
    onUnlock: (pin: string) => Promise<void>;
}

/**
 * Anti-forensic disguise: RED masquerades as a standard calculator.
 * Typing the secret PIN + "=" unlocks the vault instead of evaluating math.
 * The secret PIN is validated externally (from Keystore) via onUnlock().
 */
export function CalculatorScreen({ onUnlock }: CalculatorScreenProps) {
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
            // Always try the unlock first — it validates against Keystore
            const typed = display;
            setAwaitingUnlock(true);
            
            // Try unlock (AuthWall checks the Keystore — won't open if wrong)
            await onUnlock(typed);

            // If we reach here, unlock failed — do regular math
            setAwaitingUnlock(false);
            try {
                // eslint-disable-next-line no-eval
                const result = eval(equation + display);
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
        "7", "8", "9", "/",
        "4", "5", "6", "*",
        "1", "2", "3", "-",
        "C", "0", "=", "+"
    ];

    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: '#ffffff', color: '#000000',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'sans-serif', zIndex: 9999
        }}>
            {/* Display */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '32px', borderBottom: '1px solid #e0e0e0' }}>
                <div style={{ textAlign: 'right', fontSize: '1.1rem', color: '#7f8c8d', minHeight: '24px' }}>
                    {equation}
                </div>
                <div style={{ textAlign: 'right', fontSize: '4.5rem', fontWeight: 300, color: '#2c3e50', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {awaitingUnlock ? "..." : display}
                </div>
            </div>

            {/* Keypad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#e0e0e0' }}>
                {keys.map(k => (
                    <button
                        key={k}
                        onClick={() => handleKey(k)}
                        disabled={awaitingUnlock}
                        style={{
                            padding: '32px', fontSize: '1.8rem', fontWeight: 400,
                            border: 'none', background: '#fafafa',
                            color: ['/', '*', '-', '+', '='].includes(k) ? '#e74c3c' : '#2c3e50',
                            cursor: 'pointer', transition: 'background 0.1s',
                            opacity: awaitingUnlock ? 0.5 : 1
                        }}
                        onMouseDown={e => (e.currentTarget.style.background = '#f0f0f0')}
                        onMouseUp={e => (e.currentTarget.style.background = '#fafafa')}
                        onTouchStart={e => (e.currentTarget.style.background = '#f0f0f0')}
                        onTouchEnd={e => (e.currentTarget.style.background = '#fafafa')}
                    >
                        {k}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default CalculatorScreen;
