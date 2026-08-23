"use client";

import React from "react";
import NearbyDevicesPanel from "../../components/NearbyDevicesPanel";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { useRouter } from "next/navigation";

export default function OfflinePage() {
    const { t } = useTranslation();
    const router = useRouter();

    return (
        <div style={{ 
            height: "100vh", width: "100vw", background: "var(--bg-void)", 
            display: "flex", flexDirection: "column", overflow: "hidden"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
                borderBottom: "1px solid var(--glass-border)",
                display: "flex", alignItems: "center", gap: "16px",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0
            }}>
                <button 
                    onClick={() => router.push("/")}
                    className="btn-icon"
                    title={t.common?.back || "Volver"}
                    style={{ width: 38, height: 38 }}
                >
                    ←
                </button>
                <div>
                    <h1 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                        {t.offline_page?.title || "Modo Offline P2P Store-and-Forward"}
                    </h1>
                    <p style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", margin: 0, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                        MALLA DESCENTRALIZADA SIN ACCESO A INTERNET
                    </p>
                </div>
            </header>

            {/* Contenido */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="card-tactical animate-enter" style={{
                    padding: "14px 16px", borderColor: "var(--accent-amber)",
                    display: "flex", gap: "12px", alignItems: "center",
                    background: "rgba(255,179,0,0.08)"
                }}>
                    <span style={{ fontSize: "1.5rem" }}>⚡</span>
                    <span style={{ fontSize: "0.82rem", color: "#fff", lineHeight: 1.4 }}>
                        {t.offline_page?.desc || "Sin conexión a Internet detectada. Los mensajes se enrutan mediante saltos celular por celular a través de Bluetooth LE y WiFi Direct."}
                    </span>
                </div>

                <NearbyDevicesPanel />
            </div>
        </div>
    );
}