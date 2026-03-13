"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OfflineIndicator() {
    const router = useRouter();
    const [isOffline, setIsOffline] = useState(false);
    const [wasOffline, setWasOffline] = useState(false);
    const [showReconnected, setShowReconnected] = useState(false);

    useEffect(() => {
        const go = () => setIsOffline(false);
        const off = () => { setIsOffline(true); setWasOffline(true); };

        window.addEventListener("online", go);
        window.addEventListener("offline", off);
        setIsOffline(!navigator.onLine);

        return () => {
            window.removeEventListener("online", go);
            window.removeEventListener("offline", off);
        };
    }, []);

    useEffect(() => {
        if (wasOffline && !isOffline) {
            setShowReconnected(true);
            setTimeout(() => setShowReconnected(false), 3000);
        }
    }, [isOffline, wasOffline]);

    if (!isOffline && !showReconnected) return null;

    if (isOffline) {
        return (
            <div
                className="offline-bar animate-fade offline"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}
            >
                <span>📡 Sin conexión a internet</span>
                <button
                    onClick={() => router.push('/offline')}
                    id="offline-indicator-btn"
                    style={{
                        background: "rgba(232,0,28,0.85)",
                        color: "#fff",
                        padding: "4px 12px",
                        borderRadius: "100px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        border: "none",
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "background 0.2s",
                    }}
                >
                    Usar BLE / WiFi →
                </button>
            </div>
        );
    }

    return (
        <div className="offline-bar animate-fade reconnected">
            ✅ Conexión restablecida
        </div>
    );
}

