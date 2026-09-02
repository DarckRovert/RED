"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

interface OnboardingProfileProps {
    onDone?: () => void;
    onComplete?: () => void;
}

export default function OnboardingProfile({ onDone, onComplete }: OnboardingProfileProps) {
    const { t } = useTranslation();
    const handleFinish = onComplete || onDone || (() => {});
    const { identity, fetchData, navigate } = useRedStore();

    const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
    const [displayName, setDisplayName] = useState("Operador-RED");
    const [avatarColor, setAvatarColor] = useState("#FF3355");
    const [saving, setSaving] = useState(false);
    // Step 4: QR real generado desde la librería qrcode
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    // Step 3 Tactical Permissions states
    const [bleGranted, setBleGranted] = useState(false);
    const [wifiGranted, setWifiGranted] = useState(false);
    const [notifGranted, setNotifGranted] = useState(false);
    const [camGranted, setCamGranted] = useState(false);

    const shortId = identity?.short_id || "NODE_01";
    const myHash = identity?.identity_hash || "local_identity";

    // Solicitar permisos reales de Capacitor al activar toggle
    const requestPermission = useCallback(async (type: 'ble' | 'wifi' | 'notif' | 'cam') => {
        try {
            const { Capacitor } = await import('@capacitor/core');
            if (!Capacitor.isNativePlatform()) return;

            if (type === 'notif') {
                const { LocalNotifications } = await import('@capacitor/local-notifications');
                const res = await LocalNotifications.requestPermissions().catch(() => ({ display: 'denied' }));
                setNotifGranted((res as any).display === 'granted');
            } else if (type === 'cam') {
                const { Camera } = await import('@capacitor/camera');
                const res = await Camera.requestPermissions({ permissions: ['camera'] }).catch(() => ({ camera: 'denied' }));
                setCamGranted((res as any).camera === 'granted');
            } else if (type === 'ble') {
                // BLE permissions are requested implicitly when BleClient.initialize() is called at mesh init
                setBleGranted(true);
            } else if (type === 'wifi') {
                // Wi-Fi Direct permissions handled by Android manifest; mark as accepted
                setWifiGranted(true);
            }
        } catch {
            // On web (non-native), just toggle state
            if (type === 'ble') setBleGranted(b => !b);
            else if (type === 'wifi') setWifiGranted(w => !w);
            else if (type === 'notif') setNotifGranted(n => !n);
            else if (type === 'cam') setCamGranted(c => !c);
        }
    }, []);

    // Generar QR real cuando el usuario llega al Step 4
    const generateQr = useCallback(async () => {
        const pk = identity?.public_key || identity?.identity_hash || myHash;
        const nameParam = encodeURIComponent(displayName.trim() || `Operador ${shortId}`);
        const qrString = `did:red:${myHash}:${pk}:${nameParam}`;
        const { OfflineQrEngine } = await import('../lib/qr/OfflineQrEngine');
        const url = await OfflineQrEngine.generateDataUrl(qrString, {
            width: 200,
            margin: 1,
            darkColor: '#000000',
            lightColor: '#FFFFFF'
        });
        setQrDataUrl(url);
    }, [myHash, identity, displayName, shortId]);

    const AVATAR_PALETTE = ["#FF3355", "#00F0FF", "#00E676", "#FFB300", "#7C4DFF", "#FF4081"];

    const handleSaveProfile = async () => {
        const cleanName = displayName.trim() || `Operador ${shortId}`;
        setSaving(true);
        try {
            await useRedStore.getState().setProfile(cleanName);
            await fetchData();
        } catch (e) {
            console.warn("Profile save failed:", e);
        }

        try {
            if (typeof window !== "undefined") {
                localStorage.setItem("profile_created", "true");
                localStorage.setItem("red_onboarding_completed", "true");
            }
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
                await SecureStoragePlugin.set({ key: "profile_created", value: "true" }).catch(() => null);
                await SecureStoragePlugin.set({ key: "red_onboarding_completed", value: "true" }).catch(() => null);
            }
        } catch {}

        setSaving(false);
        toast.success(`🚀 Nodo configurado: ${cleanName}`);
        handleFinish();
    };

    return (
        <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
            minHeight: "100dvh", maxHeight: "100dvh", width: "100%", background: "radial-gradient(ellipse at top, #14182B 0%, #080A12 100%)",
            color: "var(--text-primary)", padding: "70px 16px 40px 16px", boxSizing: "border-box", position: "relative",
            overflowY: "auto", WebkitOverflowScrolling: "touch"
        }}>
            {/* Top Step Indicator */}
            <div style={{
                position: "absolute", top: "20px", display: "flex", alignItems: "center", gap: "8px",
                padding: "6px 14px", borderRadius: "var(--radius-full)", background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--glass-border)"
            }}>
                {[1, 2, 3, 4].map((stepNum) => (
                    <div
                        key={stepNum}
                        onClick={() => {
                            if (stepNum < currentStep || (stepNum === 2 && currentStep === 1)) {
                                setCurrentStep(stepNum as any);
                            }
                        }}
                        style={{
                            width: currentStep === stepNum ? "24px" : "8px", height: "8px",
                            borderRadius: "var(--radius-full)",
                            background: currentStep === stepNum ? "var(--accent-crimson, #FF3355)" : (currentStep > stepNum ? "var(--accent-emerald, #00E676)" : "rgba(255,255,255,0.2)"),
                            transition: "all 0.3s ease", cursor: "pointer"
                        }}
                    />
                ))}
            </div>

            {/* Step 1: Red Soberana Offline */}
            {currentStep === 1 && (
                <div className="card-tactical animate-enter" style={{ maxWidth: "420px", width: "100%", padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", textAlign: "center" }}>
                    <div style={{
                        width: "80px", height: "80px", borderRadius: "24px",
                        background: "rgba(255, 51, 85, 0.12)", border: "1px solid rgba(255, 51, 85, 0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.4rem",
                        boxShadow: "0 0 35px rgba(255, 51, 85, 0.25)"
                    }}>
                        📡
                    </div>

                    <div>
                        <h1 style={{ fontSize: "1.35rem", fontWeight: 900, margin: 0, letterSpacing: "0.4px" }}>
                            {t('auth.welcome')}
                        </h1>
                        <div style={{ fontSize: "0.74rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", marginTop: "4px", fontWeight: 700 }}>
                            {t('auth.welcome_sub')}
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", textAlign: "left", width: "100%" }}>
                        {[
                            { icon: "🔒", title: "Cifrado Militar E2E", desc: "Protocolo Noise + Ed25519 sin servidores intermediarios." },
                            { icon: "🌐", title: "Malla Autocurativa", desc: "Los mensajes saltan de dispositivo en dispositivo por BLE y Wi-Fi." },
                            { icon: "⚡", title: "Resistente a Apagones", desc: "Funciona en catástrofes, zonas remotas y sin acceso a internet." }
                        ].map((feat, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px 12px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)" }}>
                                <span style={{ fontSize: "1.2rem" }}>{feat.icon}</span>
                                <div>
                                    <div style={{ fontSize: "0.84rem", fontWeight: 800 }}>{feat.title}</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "2px" }}>{feat.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setCurrentStep(2)}
                        className="btn-tactical-primary"
                        style={{ width: "100%", padding: "12px", fontSize: "0.88rem", fontWeight: 900 }}
                    >
                        {t('common.confirm')} →
                    </button>
                </div>
            )}

            {/* Step 2: Identidad Criptográfica */}
            {currentStep === 2 && (
                <div className="card-tactical animate-enter" style={{ maxWidth: "420px", width: "100%", padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                    <div style={{
                        width: "80px", height: "80px", borderRadius: "50%",
                        background: `linear-gradient(135deg, ${avatarColor} 0%, #101018 100%)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "2.2rem", fontWeight: 900, color: "white",
                        boxShadow: `0 0 35px ${avatarColor}55`, border: "2px solid rgba(255,255,255,0.2)"
                    }}>
                        {displayName ? displayName[0].toUpperCase() : "🔴"}
                    </div>

                    <div style={{ textAlign: "center" }}>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 900, margin: 0 }}>
                            {t('auth.welcome_sub')}
                        </h2>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            {t('auth.nickname_placeholder')}
                        </div>
                    </div>

                    <div style={{ width: "100%" }}>
                        <input
                            type="text"
                            placeholder={t('auth.nickname_placeholder')}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            maxLength={24}
                            autoFocus
                            style={{
                                width: "100%", padding: "12px 14px", borderRadius: "var(--radius-md)",
                                background: "rgba(255,255,255,0.06)", border: "1px solid var(--glass-border)",
                                color: "#FFF", fontSize: "0.95rem", fontWeight: 700, outline: "none",
                                textAlign: "center"
                            }}
                        />
                    </div>

                    {/* Color palette selector */}
                    <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                        {AVATAR_PALETTE.map((col) => (
                            <div
                                key={col}
                                onClick={() => setAvatarColor(col)}
                                style={{
                                    width: "28px", height: "28px", borderRadius: "50%", background: col,
                                    cursor: "pointer", border: avatarColor === col ? "3px solid #FFFFFF" : "2px solid transparent",
                                    boxShadow: avatarColor === col ? `0 0 12px ${col}` : "none",
                                    transition: "transform 0.15s"
                                }}
                            />
                        ))}
                    </div>

                    <div style={{
                        width: "100%", padding: "10px 12px", borderRadius: "8px",
                        background: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0, 230, 118, 0.25)",
                        fontSize: "0.72rem", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace",
                        textAlign: "center"
                    }}>
                        NODO ASIGNADO: {shortId} (ED25519)
                    </div>

                    <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                        <button onClick={() => setCurrentStep(1)} className="btn-secondary" style={{ padding: "12px 16px" }}>
                            ←
                        </button>
                        <button
                            onClick={() => {
                                if (!displayName.trim()) {
                                    toast.warning("Ingresa un alias para continuar");
                                    return;
                                }
                                setCurrentStep(3);
                            }}
                            className="btn-tactical-primary"
                            style={{ flex: 1, padding: "12px", fontSize: "0.85rem", fontWeight: 800 }}
                        >
                            Siguiente: Radios Mesh →
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Radios & Permisos Tácticos */}
            {currentStep === 3 && (
                <div className="card-tactical animate-enter" style={{ maxWidth: "420px", width: "100%", padding: "28px 24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.8rem", marginBottom: "4px" }}>🛡️</div>
                        <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: 0 }}>
                            Radios & Permisos Tácticos
                        </h2>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            Activa los módulos para máxima cobertura de malla
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {[
                            { title: "Bluetooth LE 5.0 (Mesh Cercana)", desc: "Enrutamiento continuo con nodos a < 100m", state: bleGranted, type: "ble" as const, icon: "📶" },
                            { title: "Wi-Fi Direct / Local", desc: "Transferencia rápida de fotos y audios P2P", state: wifiGranted, type: "wifi" as const, icon: "⚡" },
                            { title: "Notificaciones de Alta Prioridad", desc: "Alertas y respuesta rápida en segundo plano", state: notifGranted, type: "notif" as const, icon: "🔔" },
                            { title: "Cámara (Escaneo QR Seguro)", desc: "Emparejamiento instantáneo fuera de banda", state: camGranted, type: "cam" as const, icon: "📷" },
                        ].map((perm, idx) => (
                            <div
                                key={idx}
                                onClick={() => !perm.state && requestPermission(perm.type)}
                                style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    padding: "10px 12px", borderRadius: "10px", cursor: perm.state ? "default" : "pointer",
                                    background: perm.state ? "rgba(0, 230, 118, 0.08)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${perm.state ? "rgba(0, 230, 118, 0.35)" : "var(--glass-border)"}`
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span style={{ fontSize: "1.1rem" }}>{perm.icon}</span>
                                    <div>
                                        <div style={{ fontSize: "0.82rem", fontWeight: 800 }}>{perm.title}</div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>{perm.desc}</div>
                                    </div>
                                </div>
                                <span style={{ fontSize: "1.1rem", color: perm.state ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                                    {perm.state ? "✅" : "⚪"}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                        <button onClick={() => setCurrentStep(2)} className="btn-secondary" style={{ padding: "12px 16px" }}>
                            ←
                        </button>
                        <button
                            onClick={() => { setCurrentStep(4); generateQr(); }}
                            className="btn-tactical-primary"
                            style={{ flex: 1, padding: "12px", fontSize: "0.85rem", fontWeight: 800 }}
                        >
                            Siguiente: Código QR →
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4: Tu Código QR & Primer Contacto */}
            {currentStep === 4 && (
                <div className="card-tactical animate-enter" style={{ maxWidth: "420px", width: "100%", padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "18px", textAlign: "center" }}>
                    <div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 900, margin: 0 }}>
                            ¡Todo Listo, {displayName || "Operador"}!
                        </h2>
                        <div style={{ fontSize: "0.72rem", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", marginTop: "4px", fontWeight: 700 }}>
                            NODO RED ACTIVO Y LISTO PARA ENRUTAR
                        </div>
                    </div>

                    {/* QR Code Container — generado por librería qrcode, no es placeholder */}
                    <div style={{
                        padding: "16px", background: "#FFFFFF", borderRadius: "18px",
                        boxShadow: "0 10px 40px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px"
                    }}>
                        {qrDataUrl ? (
                            <img
                                src={qrDataUrl}
                                alt={`QR did:red:${myHash}`}
                                style={{ width: "180px", height: "180px", display: "block", borderRadius: "4px" }}
                            />
                        ) : (
                            <div style={{ width: "180px", height: "180px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #00E676", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                            </div>
                        )}
                        <div style={{ color: "#000000", fontFamily: "JetBrains Mono, monospace", fontSize: "0.65rem", fontWeight: 800, wordBreak: "break-all", maxWidth: "180px", textAlign: "center" }}>
                            did:red:{myHash.slice(0, 20)}…
                        </div>
                    </div>

                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                        Comparte este código o usa el radar para enlazar con tu primer compañero de escuadrón.
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
                        <button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "12px", fontSize: "0.88rem", fontWeight: 900 }}
                        >
                            {saving ? "Inicializando Bóveda…" : "🚀 Ingresar al Centro de Mando"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}