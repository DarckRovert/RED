"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { antiForensicPanicWipe } from "../lib/security/AntiForensicPanicWipeEngine";

interface CalculatorScreenProps {
    onUnlock?: (pin: string) => Promise<any> | any;
}

/**
 * Anti-forensic disguise: RED masquerades as an ultra-authentic clean calculator.
 * Typing the secret Master PIN, Decoy PIN, or Panic PIN followed by "=" stealthily unlocks the vault.
 * If not matching, it behaves as a 100% real scientific & standard math calculator.
 */
export function CalculatorScreen({ onUnlock }: CalculatorScreenProps) {
    const { currentScreen, goBack } = useRedStore();
    const handleUnlock = onUnlock || (async () => {});

    const [display, setDisplay] = useState("0");
    const [equation, setEquation] = useState("");
    const [prevValue, setPrevValue] = useState<number | null>(null);
    const [operator, setOperator] = useState<string | null>(null);
    const [waitingForOperand, setWaitingForOperand] = useState(false);
    const [awaitingUnlock, setAwaitingUnlock] = useState(false);

    // Haptic feedback sutil
    const triggerHaptic = () => {
        try {
            if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(10);
            }
        } catch {}
    };

    const clearAll = () => {
        setDisplay("0");
        setEquation("");
        setPrevValue(null);
        setOperator(null);
        setWaitingForOperand(false);
    };

    const inputDigit = (digit: string) => {
        triggerHaptic();
        if (waitingForOperand) {
            setDisplay(digit);
            setWaitingForOperand(false);
        } else {
            setDisplay(display === "0" ? digit : display + digit);
        }
    };

    const inputDecimal = () => {
        triggerHaptic();
        if (waitingForOperand) {
            setDisplay("0.");
            setWaitingForOperand(false);
            return;
        }
        if (!display.includes(".")) {
            setDisplay(display + ".");
        }
    };

    const toggleSign = () => {
        triggerHaptic();
        const num = parseFloat(display);
        if (num !== 0 && !isNaN(num)) {
            setDisplay(String(-num));
        }
    };

    const inputPercent = () => {
        triggerHaptic();
        const current = parseFloat(display);
        if (isNaN(current)) return;
        const result = current / 100;
        setDisplay(String(result));
    };

    const deleteLastDigit = () => {
        triggerHaptic();
        if (waitingForOperand) return;
        if (display.length === 1 || (display.length === 2 && display.startsWith("-"))) {
            setDisplay("0");
        } else {
            setDisplay(display.slice(0, -1));
        }
    };

    const performOperation = (nextOperator: string) => {
        triggerHaptic();
        const inputValue = parseFloat(display);

        if (prevValue === null) {
            setPrevValue(inputValue);
            setEquation(`${display} ${nextOperator}`);
        } else if (operator && !waitingForOperand) {
            const currentValue = prevValue || 0;
            let result = 0;

            switch (operator) {
                case "+": result = currentValue + inputValue; break;
                case "−":
                case "-": result = currentValue - inputValue; break;
                case "×":
                case "*": result = currentValue * inputValue; break;
                case "÷":
                case "/":
                    result = inputValue !== 0 ? currentValue / inputValue : 0;
                    break;
                default: result = inputValue;
            }

            // Redondear precisión flotante
            result = Math.round(result * 1e10) / 1e10;
            setPrevValue(result);
            setDisplay(String(result));
            setEquation(`${result} ${nextOperator}`);
        } else {
            setEquation(`${prevValue} ${nextOperator}`);
        }

        setWaitingForOperand(true);
        setOperator(nextOperator);
    };

    const handleEquals = async () => {
        triggerHaptic();
        const rawPin = display;
        setAwaitingUnlock(true);

        // 1. Verificar si es el PIN de coacción / pánico (Duress Zeroization)
        if (antiForensicPanicWipe.isDuressPin(rawPin)) {
            await antiForensicPanicWipe.triggerDuressPanicProtocol();
            try {
                await handleUnlock(rawPin);
            } catch {}
            setAwaitingUnlock(false);
            return;
        }

        // 2. Intentar desbloqueo normal silencioso de la bóveda
        try {
            await handleUnlock(rawPin);
        } catch {}

        setAwaitingUnlock(false);

        // 3. Si no desbloqueó, ejecutar la matemática real
        const inputValue = parseFloat(display);
        if (operator && prevValue !== null) {
            let result = 0;
            switch (operator) {
                case "+": result = prevValue + inputValue; break;
                case "−":
                case "-": result = prevValue - inputValue; break;
                case "×":
                case "*": result = prevValue * inputValue; break;
                case "÷":
                case "/":
                    result = inputValue !== 0 ? prevValue / inputValue : 0;
                    break;
                default: result = inputValue;
            }

            result = Math.round(result * 1e10) / 1e10;
            setEquation(`${prevValue} ${operator} ${display} =`);
            setDisplay(String(result));
            setPrevValue(null);
            setOperator(null);
            setWaitingForOperand(true);
        }
    };

    // Ajuste dinámico de tamaño de fuente
    const getFontSize = () => {
        const len = display.length;
        if (len > 12) return "2.2rem";
        if (len > 8) return "3.0rem";
        return "4.2rem";
    };

    // Teclado físico
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key >= "0" && e.key <= "9") inputDigit(e.key);
            else if (e.key === ".") inputDecimal();
            else if (e.key === "+") performOperation("+");
            else if (e.key === "-") performOperation("−");
            else if (e.key === "*") performOperation("×");
            else if (e.key === "/") performOperation("÷");
            else if (e.key === "Enter" || e.key === "=") handleEquals();
            else if (e.key === "Escape" || e.key === "c" || e.key === "C") clearAll();
            else if (e.key === "Backspace") deleteLastDigit();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [display, prevValue, operator, waitingForOperand]);

    return (
        <div style={{
            position: "fixed", inset: 0,
            background: "#000000", color: "#ffffff",
            display: "flex", flexDirection: "column",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
            zIndex: 99999,
            userSelect: "none",
            touchAction: "manipulation",
            paddingTop: "var(--safe-top, 0px)",
            paddingBottom: "var(--safe-bottom, 0px)"
        }}>
            {/* Barra Superior / Modo Test Exit */}
            <div style={{
                height: "44px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 16px",
                opacity: 0.6
            }}>
                <span style={{ fontSize: "0.80rem", fontWeight: 600 }}>Calculadora</span>
                {currentScreen === "calculator" && (
                    <button
                        onClick={goBack}
                        style={{
                            background: "transparent", border: "none", color: "#888",
                            fontSize: "0.80rem", cursor: "pointer", padding: "4px 8px"
                        }}
                    >
                        Salir ✕
                    </button>
                )}
            </div>

            {/* Pantalla de Resultados y Ecuación */}
            <div style={{
                flex: 1,
                display: "flex", flexDirection: "column", justifyContent: "flex-end",
                padding: "16px 24px",
                minHeight: "140px"
            }}>
                <div style={{
                    textAlign: "right",
                    fontSize: "1.1rem",
                    color: "#888888",
                    minHeight: "24px",
                    fontFamily: "JetBrains Mono, monospace"
                }}>
                    {equation}
                </div>
                <div style={{
                    textAlign: "right",
                    fontSize: getFontSize(),
                    fontWeight: 300,
                    color: "#ffffff",
                    letterSpacing: "-1px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    transition: "font-size 0.15s ease"
                }}>
                    {awaitingUnlock ? "..." : display}
                </div>
            </div>

            {/* Teclado Táctico / Clean iOS Style */}
            <div style={{
                padding: "0 16px 36px 16px",
                maxWidth: "440px", width: "100%", margin: "0 auto",
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                gap: "12px"
            }}>
                {/* Fila 1 */}
                <button
                    onClick={clearAll}
                    style={grayBtnStyle}
                >
                    {display === "0" && !equation ? "AC" : "C"}
                </button>
                <button
                    onClick={toggleSign}
                    style={grayBtnStyle}
                >
                    ±
                </button>
                <button
                    onClick={inputPercent}
                    style={grayBtnStyle}
                >
                    %
                </button>
                <button
                    onClick={() => performOperation("÷")}
                    style={operator === "÷" ? activeOrangeBtnStyle : orangeBtnStyle}
                >
                    ÷
                </button>

                {/* Fila 2 */}
                <button onClick={() => inputDigit("7")} style={digitBtnStyle}>7</button>
                <button onClick={() => inputDigit("8")} style={digitBtnStyle}>8</button>
                <button onClick={() => inputDigit("9")} style={digitBtnStyle}>9</button>
                <button
                    onClick={() => performOperation("×")}
                    style={operator === "×" ? activeOrangeBtnStyle : orangeBtnStyle}
                >
                    ×
                </button>

                {/* Fila 3 */}
                <button onClick={() => inputDigit("4")} style={digitBtnStyle}>4</button>
                <button onClick={() => inputDigit("5")} style={digitBtnStyle}>5</button>
                <button onClick={() => inputDigit("6")} style={digitBtnStyle}>6</button>
                <button
                    onClick={() => performOperation("−")}
                    style={operator === "−" ? activeOrangeBtnStyle : orangeBtnStyle}
                >
                    −
                </button>

                {/* Fila 4 */}
                <button onClick={() => inputDigit("1")} style={digitBtnStyle}>1</button>
                <button onClick={() => inputDigit("2")} style={digitBtnStyle}>2</button>
                <button onClick={() => inputDigit("3")} style={digitBtnStyle}>3</button>
                <button
                    onClick={() => performOperation("+")}
                    style={operator === "+" ? activeOrangeBtnStyle : orangeBtnStyle}
                >
                    +
                </button>

                {/* Fila 5 */}
                <button
                    onClick={() => inputDigit("0")}
                    style={{
                        ...digitBtnStyle,
                        gridColumn: "span 2",
                        borderRadius: "38px",
                        justifyContent: "flex-start",
                        paddingLeft: "30px"
                    }}
                >
                    0
                </button>
                <button onClick={inputDecimal} style={digitBtnStyle}>.</button>
                <button
                    onClick={handleEquals}
                    style={orangeBtnStyle}
                >
                    =
                </button>
            </div>
        </div>
    );
}

const baseBtnStyle: React.CSSProperties = {
    height: "72px",
    borderRadius: "50%",
    fontSize: "1.75rem",
    fontWeight: 400,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "filter 0.1s ease, transform 0.05s ease",
    outline: "none"
};

const digitBtnStyle: React.CSSProperties = {
    ...baseBtnStyle,
    background: "#2C2C2E",
    color: "#FFFFFF"
};

const grayBtnStyle: React.CSSProperties = {
    ...baseBtnStyle,
    background: "#A5A5A5",
    color: "#000000"
};

const orangeBtnStyle: React.CSSProperties = {
    ...baseBtnStyle,
    background: "#FF9F0A",
    color: "#FFFFFF"
};

const activeOrangeBtnStyle: React.CSSProperties = {
    ...baseBtnStyle,
    background: "#FFFFFF",
    color: "#FF9F0A"
};