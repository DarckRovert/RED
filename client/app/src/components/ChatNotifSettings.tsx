"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";

const MUTE_OPTIONS = [
    { label: "8 horas", ms: 28800000 },
    { label: "1 semana", ms: 604800000 },
    { label: "Siempre", ms: -1 },
];

const NOTIF_TONES = ["Por defecto 🔔", "Silencio 🔇", "Clásico 🎵", "RED Alert ⚠️"];

interface ChatNotifSettingsProps {
    convId: string;
    convName: string;
    onClose: () => void;
}

export default function ChatNotifSettings({ convId, convName, onClose }: ChatNotifSettingsProps) {
    const [muteUntil, setMuteUntil] = useState<number | null>(null);
    const [tone, setTone] = useState(0);
    const [vibrate, setVibrate] = useState(true);
    const [showMedia, setShowMedia] = useState(true);
    const [saved, setSaved] = useState(false);
    const { loadNotifSettings } = useRedStore();

    React.useEffect(() => {
        if (typeof window !== "undefined") {
            const m = localStorage.getItem(`red_mute_${convId}`);
            if (m) setMuteUntil(parseInt(m));
            
            const conf = localStorage.getItem(`red_notif_${convId}`);
            if (conf) {
                try {
                    const parsed = JSON.parse(conf);
                    if (parsed.tone !== undefined) setTone(parsed.tone);
                    if (parsed.vibrate !== undefined) setVibrate(parsed.vibrate);
                    if (parsed.showMedia !== undefined) setShowMedia(parsed.showMedia);
                } catch {}
            }
        }
    }, [convId]);

    const muteChat = (ms: number) => {
        const until = ms === -1 ? -1 : Date.now() + ms;
        setMuteUntil(until);
        if (typeof window !== "undefined") {
            localStorage.setItem(`red_mute_${convId}`, String(until));
        }
    };

    const save = () => {
        if (typeof window !== "undefined") {
            localStorage.setItem(`red_notif_${convId}`, JSON.stringify({ tone, vibrate, showMedia, muteUntil }));
            // Remove mute item if null/0 rather than leaving a stale record
            if (muteUntil === null) {
                localStorage.removeItem(`red_mute_${convId}`);
            } else {
                localStorage.setItem(`red_mute_${convId}`, String(muteUntil));
            }
        }
        loadNotifSettings(); // update global store
        setSaved(true);
        setTimeout(() => { setSaved(false); onClose(); }, 1200);
    };

    const isMuted = muteUntil !== null && (muteUntil === -1 || muteUntil > Date.now());

    return (
        <div className="notif-settings-overlay animate-fade">
            <div className="notif-settings glass">
                <div className="notif-settings-header">
                    <h3>🔔 Notificaciones de <em>{convName}</em></h3>
                    <button onClick={onClose}>✕</button>
                </div>

                {/* Mute */}
                <div className="notif-section">
                    <p className="notif-label">Silenciar chat</p>
                    {isMuted ? (
                        <div className="notif-muted-status">
                            🔇 Silenciado {muteUntil === -1 ? "siempre" : "hasta " + new Date(muteUntil).toLocaleString()}
                            <button className="notif-unmute" onClick={() => setMuteUntil(null)}>Reactivar</button>
                        </div>
                    ) : (
                        <div className="notif-mute-options">
                            {MUTE_OPTIONS.map(o => (
                                <button key={o.ms} className="notif-mute-btn" onClick={() => muteChat(o.ms)}>{o.label}</button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tone */}
                <div className="notif-section">
                    <p className="notif-label">Tono de notificación</p>
                    <div className="notif-tone-list">
                        {NOTIF_TONES.map((t, i) => (
                            <button key={i} className={`notif-tone-btn ${i === tone ? "selected" : ""}`} onClick={() => setTone(i)}>{t}</button>
                        ))}
                    </div>
                </div>

                {/* Toggles */}
                <div className="notif-section">
                    <div className="notif-toggle-row">
                        <span>Vibración</span>
                        <button className={`theme-toggle ${vibrate ? "light" : ""}`} onClick={() => setVibrate(v => !v)}>
                            <div className="theme-toggle-thumb" />
                        </button>
                    </div>
                    <div className="notif-toggle-row">
                        <span>Vista previa de medios</span>
                        <button className={`theme-toggle ${showMedia ? "light" : ""}`} onClick={() => setShowMedia(m => !m)}>
                            <div className="theme-toggle-thumb" />
                        </button>
                    </div>
                </div>

                <button className={`btn-primary ${saved ? "btn-saved" : ""}`} onClick={save}>
                    {saved ? "✅ Guardado" : "Guardar"}
                </button>
            </div>
        </div>
    );
}
