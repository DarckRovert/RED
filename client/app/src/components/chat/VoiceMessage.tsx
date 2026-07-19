import React, { useState, useRef } from "react";
import { MessageItem } from "../../lib/api";

interface VoiceWaveProps {
    playing: boolean;
    color: string;
}

function VoiceWave({ playing, color }: VoiceWaveProps) {
    const heights = [4, 8, 14, 10, 18, 12, 20, 14, 10, 8, 16, 12, 6, 14, 10, 8, 16, 12, 18, 10, 8, 14, 6, 10, 14];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: 24 }}>
            {heights.map((h, i) => (
                <div key={i} className={playing ? 'voice-bar' : ''} style={{
                    width: 3, height: h, borderRadius: 2, background: color,
                    opacity: playing ? 0.9 : 0.4,
                    animationDelay: playing ? `${(i * 40) % 800}ms` : '0ms',
                    transition: 'opacity 0.3s ease',
                }} />
            ))}
        </div>
    );
}

interface VoiceMessageProps {
    msg: MessageItem;
    isMine: boolean;
}

export function VoiceMessage({ msg, isMine }: VoiceMessageProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [, setProgress] = useState(0);

    const audioSrc = msg.media_data
        ? (msg.media_data.startsWith('data:') || msg.media_data.startsWith('http')
            ? msg.media_data
            : `data:audio/ogg;base64,${msg.media_data}`)
        : undefined;

    const toggle = () => {
        const a = audioRef.current;
        if (!a) return;
        if (playing) {
            a.pause();
            setPlaying(false);
        } else {
            a.play().catch(() => {});
            setPlaying(true);
        }
    };

    const color = isMine ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 200 }}>
            <button onClick={toggle} style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: isMine ? 'rgba(255,255,255,0.15)' : 'rgba(232,33,58,0.15)',
                border: `1px solid ${isMine ? 'rgba(255,255,255,0.2)' : 'rgba(232,33,58,0.3)'}`,
                color: isMine ? 'white' : 'var(--primary-bright)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
            }}>
                {playing
                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                }
            </button>
            <div style={{ flex: 1 }}>
                <VoiceWave playing={playing} color={color} />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    {msg.duration_ms ? `${Math.round(msg.duration_ms / 1000)}s` : 'Nota de voz'}
                </div>
            </div>
            {audioSrc && (
                <audio ref={audioRef} src={audioSrc}
                    onEnded={() => setPlaying(false)}
                    onTimeUpdate={() => {
                        const a = audioRef.current;
                        if (a && a.duration) setProgress(a.currentTime / a.duration * 100);
                    }}
                    style={{ display: 'none' }}
                />
            )}
        </div>
    );
}
