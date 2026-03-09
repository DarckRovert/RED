"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; info: ErrorInfo | null; }

export default class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null, info: null };

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        this.setState({ info });
        // Persist crash log to localStorage for later retrieval
        try {
            localStorage.setItem("red_last_crash", `${error.message}\n${info.componentStack}`);
        } catch { }
        console.error("[RED ErrorBoundary]", error, info);
    }

    render() {
        if (this.state.hasError) {
            const { error, info } = this.state;
            return (
                <div style={{
                    position: "fixed", inset: 0, background: "#0a0a0a",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", padding: "2rem", zIndex: 9999, color: "#fff",
                    fontFamily: "monospace", gap: "1rem", overflowY: "auto"
                }}>
                    <div style={{ fontSize: "3rem" }}>💥</div>
                    <h2 style={{ color: "#ff1744", textAlign: "center", margin: 0 }}>Error de aplicación</h2>
                    <p style={{ color: "#ccc", textAlign: "center", fontSize: "0.9rem" }}>
                        Ha ocurrido un error inesperado. Por favor reinicia la app.
                    </p>
                    <pre style={{
                        background: "rgba(255,23,68,0.1)", border: "1px solid rgba(255,23,68,0.3)",
                        borderRadius: 8, padding: "1rem", fontSize: "0.7rem", color: "#ff8a80",
                        maxWidth: "100%", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word"
                    }}>
                        {error?.message}{"\n\n"}{error?.stack?.substring(0, 800)}
                    </pre>
                    {info && (
                        <pre style={{
                            background: "rgba(255,255,255,0.05)", borderRadius: 8,
                            padding: "0.75rem", fontSize: "0.65rem", color: "#aaa",
                            maxWidth: "100%", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word"
                        }}>
                            {info.componentStack?.substring(0, 600)}
                        </pre>
                    )}
                    <button
                        onClick={() => this.setState({ hasError: false, error: null, info: null })}
                        style={{
                            padding: "0.75rem 2rem", background: "#ff1744", color: "#fff",
                            border: "none", borderRadius: 8, cursor: "pointer", fontSize: "1rem", fontWeight: 700
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
