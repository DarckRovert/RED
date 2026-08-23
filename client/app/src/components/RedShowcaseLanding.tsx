'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRedStore } from '../store/useRedStore';
import { RED_VERSION, RED_BUILD_CODE, RED_APK_NAME } from '../lib/version';
import { useTranslation } from '../lib/i18n/i18nEngine';
import { LandingHeader } from './showcase/LandingHeader';
import { LandingHero } from './showcase/LandingHero';
import { LandingBentoAndMatrix } from './showcase/LandingBentoAndMatrix';
import { LandingMeshSimulator } from './showcase/LandingMeshSimulator';
import { LandingModuleCatalog } from './showcase/LandingModuleCatalog';
import { LandingInteractiveLabs } from './showcase/LandingInteractiveLabs';
import { LandingUseCasesAndArchitecture } from './showcase/LandingUseCasesAndArchitecture';
import { LandingFooterAndModals } from './showcase/LandingFooterAndModals';

interface RedShowcaseLandingProps {
    onEnterVault?: () => void;
    onEnterApp?: () => void;
}

export default function RedShowcaseLanding({ onEnterVault, onEnterApp }: RedShowcaseLandingProps) {
    const { t } = useTranslation();
    const { navigate, setProfile } = useRedStore();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [scrollPercent, setScrollPercent] = useState(0);
    const [activeSection, setActiveSection] = useState<string>("hero");
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [copiedText, setCopiedText] = useState<string | null>(null);

    const [heroAlias, setHeroAlias] = useState("Vanguard_Leader");
    const [heroDidHash, setHeroDidHash] = useState("did:red:7F3A91BC2E844D0F81E73A6B4C20E76B91A23D8E5F7C1B4A90D2E6F83C1A7B5D");
    const [heroMnemonicSeed, setHeroMnemonicSeed] = useState("shield quantum radar mesh beacon sovereign pulse acoustic cipher horizon rescue citadel");

    const [fps, setFps] = useState(60);
    const [telemetryNodes, setTelemetryNodes] = useState(14);
    const [cryptoEpoch, setCryptoEpoch] = useState(RED_BUILD_CODE);

    const isGhPages = typeof window !== "undefined" && window.location.pathname.includes("/RED");
    const basePath = isGhPages ? "/RED" : "";
    const heroBannerUrl = `${basePath}/assets/red_investor_hero_banner.png`;

    const handleEnter = onEnterVault || onEnterApp || (() => {
        navigate('chat');
    });

    const handleHeroAliasChange = (newAlias: string) => {
        setHeroAlias(newAlias);
        let hash = 0;
        for (let i = 0; i < newAlias.length; i++) {
            hash = (hash << 5) - hash + newAlias.charCodeAt(i);
            hash |= 0;
        }
        const hex = Math.abs(hash).toString(16).padStart(8, "0").toUpperCase();
        setHeroDidHash(`did:red:${hex}91BC2E844D0F81E73A6B4C20E76B91A23D8E5F7C1B4A90D2E6F83C1A7B5D`);
    };

    const handleLaunchWithHeroAlias = async () => {
        if (heroAlias.trim()) {
            try {
                await setProfile(heroAlias.trim());
            } catch {}
        }
        handleEnter();
    };

    const handleCopy = (text: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedText(text);
            setTimeout(() => setCopiedText(null), 2000);
        }
    };

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        setIsMobileMenuOpen(false);
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth" });
        }
    };

    // Background Particle Matrix Animation
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animFrameId: number;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener("resize", handleResize);

        const numParticles = 40;
        const particles = Array.from({ length: numParticles }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            radius: Math.random() * 1.8 + 0.6,
        }));

        const render = () => {
            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 120) {
                        ctx.strokeStyle = `rgba(232, 33, 58, ${0.15 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.6;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }

                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                ctx.fillStyle = "rgba(232, 33, 58, 0.4)";
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }

            animFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener("resize", handleResize);
            cancelAnimationFrame(animFrameId);
        };
    }, []);

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-void, #05050A)", color: "var(--text-primary, #E0E0E6)", fontFamily: "Inter, sans-serif", position: "relative", overflowX: "hidden" }}>
            <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1 }}>
                <LandingHeader
                    activeSection={activeSection}
                    scrollToSection={scrollToSection}
                    isMobileMenuOpen={isMobileMenuOpen}
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                    telemetryNodes={telemetryNodes}
                    cryptoEpoch={cryptoEpoch}
                    fps={fps}
                    onEnterApp={handleEnter}
                />

                <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px" }}>
                    <LandingHero
                        heroAlias={heroAlias}
                        heroDidHash={heroDidHash}
                        heroMnemonicSeed={heroMnemonicSeed}
                        heroBannerUrl={heroBannerUrl}
                        handleHeroAliasChange={handleHeroAliasChange}
                        handleLaunchWithHeroAlias={handleLaunchWithHeroAlias}
                        handleCopy={handleCopy}
                        copiedText={copiedText}
                        scrollToSection={scrollToSection}
                        handleEnter={handleEnter}
                    />

                    <LandingBentoAndMatrix />

                    <LandingMeshSimulator />

                    <LandingModuleCatalog onEnterApp={handleEnter} />

                    <LandingInteractiveLabs />

                    <LandingUseCasesAndArchitecture
                        handleCopy={handleCopy}
                        copiedText={copiedText}
                    />

                    <LandingFooterAndModals
                        handleCopy={handleCopy}
                        copiedText={copiedText}
                        onEnterApp={handleEnter}
                    />
                </main>
            </div>
        </div>
    );
}
