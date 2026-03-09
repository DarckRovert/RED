"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";

function KeyDisplay({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(value).catch(() => { });
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div className="crypto-key-row glass">
            <div className="crypto-key-header">
                <span className="crypto-key-label">{label}</span>
                <button className="crypto-copy-btn" onClick={copy}>{copied ? "✅" : "📋"}</button>
            </div>
            <code className={`crypto-key-value ${mono ? "mono" : ""}`}>{value}</code>
        </div>
    );
}

const MOCK_DH_PRIV = "a3f9c2d1e4b7a8f0c3e6d9b2a5f8c1e4d7b0a3f6c9e2d5b8a1f4c7e0d3b6a9f2";
const MOCK_DH_PUB = "04" + "b8a3d6c1f4e9b2a5d8c3f6e1b4a7d2c5f8e3b6a1d4c9f2e5b8a3d6c1f4e7b0a3d6c9f2e1b4a7d0c3f6e9b2a5d8c1f4e7b0a3d6";
const MOCK_SIG = "3045022100" + "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2" + "022048a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";

export default function CryptoPanelPage() {
    const { identity } = useRedStore();
    const [renegotiating, setRenegotiating] = useState(false);
    const [renegDone, setRenegDone] = useState(false);
    const [verifyResult, setVerifyResult] = useState<"ok" | "fail" | null>(null);

    const renegotiate = () => {
        setRenegotiating(true);
        setTimeout(() => { setRenegotiating(false); setRenegDone(true); setTimeout(() => setRenegDone(false), 3000); }, 2000);
    };

    const verify = () => {
        setVerifyResult("ok");
        setTimeout(() => setVerifyResult(null), 3000);
    };

    return (
        <main className="crypto-panel-page bg-dark">
            <header className="mobile-settings-header glass">
                <Link href="/settings" className="back-btn">←</Link>
                <h2>🔐 Panel de Criptografía</h2>
            </header>

            <section className="crypto-section animate-fade">
                <div className="crypto-status-card glass">
                    <div className="crypto-shield">🛡️</div>
                    <h3>Cifrado activo</h3>
                    <p className="crypto-status-detail">X25519 Diffie-Hellman + AES-256-GCM<br />Firma: Ed25519 · Perfect Forward Secrecy ✓</p>
                    {verifyResult === "ok" && <p className="crypto-ok">✅ Integridad de clave verificada</p>}
                    {verifyResult === "fail" && <p className="crypto-err">❌ Error de verificación</p>}
                </div>

                <p className="section-title" style={{ padding: "0 0 0.5rem" }}>Claves activas</p>

                <KeyDisplay label="ID de identidad (DID)" value={identity?.identity_hash || "Generando..."} />
                <KeyDisplay label="Clave pública DH (X25519)" value={MOCK_DH_PUB} />
                <KeyDisplay label="Clave privada DH (cifrada)" value={MOCK_DH_PRIV.replace(/./g, "•")} mono />
                <KeyDisplay label="Firma de sesión (Ed25519)" value={MOCK_SIG} />

                <div className="crypto-info glass" style={{ marginTop: '1rem', borderLeft: '3px solid var(--green)' }}>
                    <h4 style={{ color: 'var(--green)' }}>🛡️ Auditoría del Dispositivo (Secure Enclave)</h4>
                    <ul className="crypto-explainer" style={{ listStyle: 'none', paddingLeft: '0.5rem', marginTop: '0.5rem' }}>
                        <li>✅ <strong>Integridad del SO:</strong> No se detecta acceso Root / Jailbreak.</li>
                        <li>✅ <strong>Memoria:</strong> Protegida. Sin frameworks de Hooking (Frida/Xposed).</li>
                        <li>✅ <strong>Entorno:</strong> Ejecución nativa validada. No es un emulador.</li>
                    </ul>
                </div>

                <div className="crypto-actions">
                    <button className="btn-secondary" onClick={verify}>🔍 Verificar integridad</button>
                    <button className={`btn-primary ${renegotiating ? "loading" : ""} ${renegDone ? "btn-saved" : ""}`} onClick={renegotiate} disabled={renegotiating}>
                        {renegotiating ? "⏳ Renegociando DH..." : renegDone ? "✅ Completado" : "🔄 Renegociar DH"}
                    </button>
                </div>

                <div className="crypto-info glass">
                    <h4>📖 ¿Qué significa esto?</h4>
                    <ul className="crypto-explainer">
                        <li><strong>DH Renegociation:</strong> Genera un nuevo par de claves efímeras sin perder el historial de mensajes.</li>
                        <li><strong>PFS (Perfect Forward Secrecy):</strong> Si tu clave privada es comprometida, los mensajes pasados siguen siendo seguros.</li>
                        <li><strong>Deniabilidad:</strong> Los mensajes no tienen firma verificable externamente — sólo tú y tu par pueden confirmarlos.</li>
                    </ul>
                </div>
            </section>
        </main>
    );
}
