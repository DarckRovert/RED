import React from 'react';

export const LandingSponsorSection: React.FC = () => {
    return (
        <section id="sponsors" style={{ padding: "80px 0 40px", position: "relative" }}>
            <div
                style={{
                    maxWidth: "1160px",
                    margin: "0 auto",
                    padding: "48px 32px",
                    borderRadius: "28px",
                    background: "linear-gradient(135deg, rgba(20, 10, 30, 0.85) 0%, rgba(10, 15, 28, 0.92) 100%)",
                    border: "1px solid rgba(255, 42, 81, 0.35)",
                    boxShadow: "0 20px 80px rgba(255, 42, 81, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                    backdropFilter: "blur(24px)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Background Glow */}
                <div
                    style={{
                        position: "absolute",
                        top: "-50%",
                        right: "-20%",
                        width: "500px",
                        height: "500px",
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(255, 42, 81, 0.15) 0%, transparent 70%)",
                        pointerEvents: "none",
                    }}
                />

                <div style={{ textAlign: "center", marginBottom: "36px", position: "relative", zIndex: 1 }}>
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 14px",
                            borderRadius: "20px",
                            background: "rgba(255, 42, 81, 0.15)",
                            border: "1px solid rgba(255, 42, 81, 0.4)",
                            color: "#FF2A51",
                            fontSize: "12px",
                            fontWeight: 800,
                            letterSpacing: "0.5px",
                            marginBottom: "16px",
                            textTransform: "uppercase",
                        }}
                    >
                        <span>💖</span> Apoya la Malla Soberana
                    </div>

                    <h2
                        style={{
                            fontSize: "clamp(26px, 4vw, 38px)",
                            fontWeight: 900,
                            color: "#FFF",
                            letterSpacing: "-0.5px",
                            marginBottom: "14px",
                            lineHeight: 1.2,
                        }}
                    >
                        Soberanía Tecnológica Impulsada por la Comunidad
                    </h2>

                    <p
                        style={{
                            fontSize: "clamp(14px, 1.8vw, 16px)",
                            color: "#94A3B8",
                            maxWidth: "760px",
                            margin: "0 auto",
                            lineHeight: 1.6,
                        }}
                    >
                        <strong style={{ color: "#FFF" }}>RED</strong> es 100% código abierto, libre de censura y sin rastreo. Tu patrocinio directo financia el desarrollo de transceptores LoRa de largo alcance, investigación criptográfica post-cuántica y la infraestructura P2P global.
                    </p>
                </div>

                {/* Sponsor Card Embed & Direct Actions */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "24px",
                        position: "relative",
                        zIndex: 1,
                    }}
                >
                    {/* GitHub Sponsors Card iframe wrapper */}
                    <div
                        style={{
                            width: "100%",
                            maxWidth: "600px",
                            display: "flex",
                            justifyContent: "center",
                            borderRadius: "18px",
                            overflow: "hidden",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            background: "#0d1117",
                            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
                            colorScheme: "dark",
                        }}
                    >
                        <iframe
                            src="https://github.com/sponsors/DarckRovert/card"
                            title="Sponsor DarckRovert"
                            height="120"
                            width="600"
                            style={{
                                border: 0,
                                maxWidth: "100%",
                                display: "block",
                                colorScheme: "dark",
                                background: "#0d1117",
                            }}
                        />
                    </div>

                    {/* Quick Button + Repo Actions */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexWrap: "wrap",
                            gap: "14px",
                            marginTop: "8px",
                        }}
                    >
                        <iframe
                            src="https://github.com/sponsors/DarckRovert/button"
                            title="Sponsor DarckRovert"
                            height="32"
                            width="114"
                            style={{
                                border: 0,
                                borderRadius: "6px",
                                verticalAlign: "middle",
                            }}
                        />

                        <a
                            href="https://github.com/DarckRovert/RED"
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "7px 16px",
                                borderRadius: "8px",
                                background: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.16)",
                                color: "#FFF",
                                fontSize: "12px",
                                fontWeight: 700,
                                textDecoration: "none",
                                transition: "background 0.2s",
                            }}
                        >
                            <span>⭐</span> Dar Estrella en GitHub
                        </a>

                        <a
                            href="https://github.com/DarckRovert"
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "7px 16px",
                                borderRadius: "8px",
                                background: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.16)",
                                color: "#CBD5E1",
                                fontSize: "12px",
                                fontWeight: 700,
                                textDecoration: "none",
                                transition: "background 0.2s",
                            }}
                        >
                            <span>🐙</span> Perfil de GitHub
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
};
