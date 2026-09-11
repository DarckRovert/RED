"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { useRedStore } from "../../store/useRedStore";
import { SovereignPaymentPassport } from "../../lib/miniapp/RedSDKTypes";
import { isValidEvmAddress } from "../../lib/miniapp/RedPaymentGatewayEngine";
import { Web3BridgeEngine } from "../../lib/network/Web3BridgeEngine";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { toast } from "../Toast";
import { TacIcon } from "../ui/TacIcon";

export const PaymentsTab: React.FC = () => {
    const { t } = useTranslation();
    const { paymentPassport, updatePaymentPassport } = useRedStore();

    const [evmAddress, setEvmAddress] = useState<string>(paymentPassport?.evmAddress || "");
    const [preferredChainId, setPreferredChainId] = useState<number>(paymentPassport?.preferredChainId || 137);
    const [fiatType, setFiatType] = useState<'yape' | 'plin' | 'paypal' | 'pix' | 'bizum' | 'custom'>(
        paymentPassport?.fiatType || 'yape'
    );
    const [fiatIdentifier, setFiatIdentifier] = useState<string>(paymentPassport?.fiatIdentifier || "");
    const [fiatBeneficiaryName, setFiatBeneficiaryName] = useState<string>(paymentPassport?.fiatBeneficiaryName || "");
    const [fiatQrDataUrl, setFiatQrDataUrl] = useState<string>(paymentPassport?.fiatQrDataUrl || "");
    const [lightningAddress, setLightningAddress] = useState<string>(paymentPassport?.lightningAddress || "");
    const [acceptsVouchers, setAcceptsVouchers] = useState<boolean>(
        paymentPassport?.acceptsVouchers !== undefined ? paymentPassport.acceptsVouchers : true
    );
    const [isPublicOnMesh, setIsPublicOnMesh] = useState<boolean>(
        paymentPassport?.isPublicOnMesh !== undefined ? paymentPassport.isPublicOnMesh : false
    );

    const [web3Account, setWeb3Account] = useState<string | null>(null);

    useEffect(() => {
        const web3 = Web3BridgeEngine.getInstance();
        setWeb3Account(web3.getState().account);
        const unsub = web3.subscribe(state => setWeb3Account(state.account));
        return () => unsub();
    }, []);

    const handlePasteConnectedWallet = () => {
        if (web3Account) {
            setEvmAddress(web3Account);
            TacticalAudioEngine.playMessageSent();
            toast.success("Dirección EVM vinculada desde tu billetera Web3");
        } else {
            toast.info("Conecta tu MetaMask primero en Bóveda Web3 para autocompletar.");
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("El archivo debe ser una imagen (PNG o JPG).");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error("La imagen no debe superar los 2 MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (dataUrl) {
                setFiatQrDataUrl(dataUrl);
                TacticalAudioEngine.playRogerBeep();
                toast.success("Código QR de cobro cargado exitosamente");
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();

        if (evmAddress.trim() && !isValidEvmAddress(evmAddress.trim())) {
            TacticalAudioEngine.playWarning();
            toast.error("La dirección EVM debe tener el formato 0x de 40 dígitos hexadecimales.");
            return;
        }

        const cleanEvm = evmAddress.trim();
        const updated: Partial<SovereignPaymentPassport> = {
            evmAddress: cleanEvm || undefined,
            preferredChainId,
            fiatType,
            fiatIdentifier: fiatIdentifier.trim() || undefined,
            fiatBeneficiaryName: fiatBeneficiaryName.trim() || undefined,
            fiatQrDataUrl: fiatQrDataUrl || undefined,
            lightningAddress: lightningAddress.trim() || undefined,
            acceptsVouchers,
            isPublicOnMesh,
            updatedAt: Date.now(),
        };

        updatePaymentPassport(updated);
        TacticalAudioEngine.playRogerBeep();
        toast.success("✅ Pasaporte de Pagos guardado y sincronizado");
    };

    return (
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <TacIcon name="card" size={18} color="var(--primary, #E8213A)" />
                    <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#FFF", margin: 0 }}>
                        {t('payments_tab.title')}
                    </h3>
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary, #8A92A6)", lineHeight: "1.4", margin: 0 }}>
                    {t('payments_tab.subtitle')}
                </p>
            </div>

            {/* SECCIÓN 1: DÓLARES DIGITALES ESTABLES (USDT / USDC) */}
            <div className="card-tactical" style={{
                padding: "16px",
                background: "rgba(0, 229, 255, 0.03)",
                border: "1px solid rgba(0, 229, 255, 0.2)",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <TacIcon name="gem" size={16} color="#00E5FF" />
                        <strong style={{ fontSize: "0.88rem", color: "#00E5FF" }}>
                            Cripto Estable (USDT en Polygon / USDC en Base)
                        </strong>
                    </div>
                    <span className="tabular-telemetry" style={{ fontSize: "0.7rem", color: "#8A92A6" }}>Gas &lt; $0.005 USD</span>
                </div>

                <div>
                    <label style={{ fontSize: "0.72rem", color: "var(--text-muted, #8A92A6)", display: "block", marginBottom: "4px" }}>
                        DIRECCIÓN EVM DE RECEPCIÓN (0x...)
                    </label>
                    <div style={{ display: "flex", gap: "6px" }}>
                        <input
                            type="text"
                            value={evmAddress}
                            onChange={(e) => setEvmAddress(e.target.value)}
                            placeholder="0x71C... (Polygon PoS o Base)"
                            className="tabular-telemetry"
                            style={{
                                flex: 1,
                                padding: "10px 12px",
                                borderRadius: "10px",
                                background: "rgba(0, 0, 0, 0.5)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                color: "#FFF",
                                fontSize: "0.82rem",
                                fontFamily: "JetBrains Mono, monospace"
                            }}
                        />
                        {web3Account && (
                            <button
                                type="button"
                                onClick={handlePasteConnectedWallet}
                                className="btn-tactical-secondary"
                                style={{
                                    padding: "8px 12px",
                                    fontSize: "0.74rem",
                                    borderRadius: "10px",
                                    whiteSpace: "nowrap",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px"
                                }}
                            >
                                <TacIcon name="wallet" size={13} color="#FFB300" />
                                <span>Mi Wallet</span>
                            </button>
                        )}
                    </div>
                </div>

                <div>
                    <label style={{ fontSize: "0.72rem", color: "var(--text-muted, #8A92A6)", display: "block", marginBottom: "4px" }}>
                        RED PREFERIDA DE LIQUIDACIÓN
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <button
                            type="button"
                            onClick={() => setPreferredChainId(137)}
                            style={{
                                padding: "8px",
                                borderRadius: "8px",
                                background: preferredChainId === 137 ? "rgba(0, 229, 255, 0.2)" : "rgba(0, 0, 0, 0.3)",
                                border: preferredChainId === 137 ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.08)",
                                color: preferredChainId === 137 ? "#00E5FF" : "#8A92A6",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                            }}
                        >
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#A855F7", display: "inline-block" }} />
                            <span>Polygon PoS (USDT)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setPreferredChainId(8453)}
                            style={{
                                padding: "8px",
                                borderRadius: "8px",
                                background: preferredChainId === 8453 ? "rgba(0, 82, 255, 0.25)" : "rgba(0, 0, 0, 0.3)",
                                border: preferredChainId === 8453 ? "1.5px solid #0052FF" : "1px solid rgba(255, 255, 255, 0.08)",
                                color: preferredChainId === 8453 ? "#00E5FF" : "#8A92A6",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                            }}
                        >
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0052FF", display: "inline-block" }} />
                            <span>Base Network (USDC)</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 2: BILLETERA FIAT LOCAL (YAPE / PLIN / PAYPAL / PIX / BIZUM) */}
            <div className="card-tactical" style={{
                padding: "16px",
                background: "rgba(0, 230, 118, 0.03)",
                border: "1px solid rgba(0, 230, 118, 0.2)",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <TacIcon name="card" size={16} color="#00E676" />
                    <strong style={{ fontSize: "0.88rem", color: "#00E676" }}>
                        Billetera Fiat Local & Transferencia Inmediata
                    </strong>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted, #8A92A6)", display: "block", marginBottom: "4px" }}>
                            PROVEEDOR FIAT
                        </label>
                        <select
                            value={fiatType}
                            onChange={(e: any) => setFiatType(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "10px",
                                background: "rgba(0, 0, 0, 0.5)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                color: "#FFF",
                                fontSize: "0.82rem"
                            }}
                        >
                            <option value="yape">Yape (Perú)</option>
                            <option value="plin">Plin (Perú)</option>
                            <option value="paypal">PayPal.me (Internacional)</option>
                            <option value="pix">Pix (Brasil)</option>
                            <option value="bizum">Bizum (España)</option>
                            <option value="custom">Cuenta Bancaria Personalizada</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted, #8A92A6)", display: "block", marginBottom: "4px" }}>
                            NÚMERO, EMAIL O ALIAS
                        </label>
                        <input
                            type="text"
                            value={fiatIdentifier}
                            onChange={(e) => setFiatIdentifier(e.target.value)}
                            placeholder={fiatType === 'paypal' ? 'usuario_paypal' : '987654321'}
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "10px",
                                background: "rgba(0, 0, 0, 0.5)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                color: "#FFF",
                                fontSize: "0.82rem"
                            }}
                        />
                    </div>
                </div>

                <div>
                    <label style={{ fontSize: "0.72rem", color: "var(--text-muted, #8A92A6)", display: "block", marginBottom: "4px" }}>
                        NOMBRE DEL BENEFICIARIO (Para confirmación bancaria)
                    </label>
                    <input
                        type="text"
                        value={fiatBeneficiaryName}
                        onChange={(e) => setFiatBeneficiaryName(e.target.value)}
                        placeholder="Ej. Rodrigo Vega R."
                        style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: "10px",
                            background: "rgba(0, 0, 0, 0.5)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: "#FFF",
                            fontSize: "0.82rem"
                        }}
                    />
                </div>

                {/* Subir QR de Cobro propio */}
                <div>
                    <label style={{ fontSize: "0.72rem", color: "var(--text-muted, #8A92A6)", display: "block", marginBottom: "4px" }}>
                        IMAGEN DE TU CÓDIGO QR DE COBRO (Yape / Plin / Pix)
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <label style={{
                            padding: "8px 14px",
                            borderRadius: "10px",
                            background: "rgba(255, 255, 255, 0.08)",
                            border: "1px dashed rgba(0, 230, 118, 0.4)",
                            color: "#00E676",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                        }}>
                            <TacIcon name="upload" size={14} color="#00E676" />
                            <span>Subir Imagen QR</span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                style={{ display: "none" }}
                            />
                        </label>
                        {fiatQrDataUrl && (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <img
                                    src={fiatQrDataUrl}
                                    alt="QR Preview"
                                    style={{ width: 36, height: 36, borderRadius: 6, objectFit: "contain", background: "#000" }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setFiatQrDataUrl("")}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "#E8213A",
                                        fontSize: "0.74rem",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px"
                                    }}
                                >
                                    <TacIcon name="trash" size={12} color="#E8213A" />
                                    <span>Eliminar</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SECCIÓN 3: BITCOIN LIGHTNING */}
            <div className="card-tactical" style={{
                padding: "16px",
                background: "rgba(255, 179, 0, 0.03)",
                border: "1px solid rgba(255, 179, 0, 0.2)",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <TacIcon name="zap" size={16} color="#FFB300" />
                    <strong style={{ fontSize: "0.88rem", color: "#FFB300" }}>
                        Bitcoin Lightning Network (Opcional)
                    </strong>
                </div>

                <div>
                    <label style={{ fontSize: "0.72rem", color: "var(--text-muted, #8A92A6)", display: "block", marginBottom: "4px" }}>
                        LIGHTNING ADDRESS (LNURL)
                    </label>
                    <input
                        type="text"
                        value={lightningAddress}
                        onChange={(e) => setLightningAddress(e.target.value)}
                        placeholder="usuario@getalby.com o usuario@walletofsatoshi.com"
                        className="tabular-telemetry"
                        style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: "10px",
                            background: "rgba(0, 0, 0, 0.5)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: "#FFF",
                            fontSize: "0.82rem",
                            fontFamily: "JetBrains Mono, monospace"
                        }}
                    />
                </div>
            </div>

            {/* SECCIÓN 4: OPCIONES OPERATIVAS Y SOBERANÍA */}
            <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                padding: "14px 16px",
                background: "rgba(0, 0, 0, 0.3)",
                borderRadius: "14px",
                border: "1px solid rgba(255, 255, 255, 0.06)"
            }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "0.82rem", color: "#FFF" }}>
                    <input
                        type="checkbox"
                        checked={acceptsVouchers}
                        onChange={(e) => setAcceptsVouchers(e.target.checked)}
                        style={{ accentColor: "#00E676", width: 18, height: 18 }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <TacIcon name="shield" size={15} color="#00E676" />
                        <span>Aceptar Vales Tácticos Off-Grid (Trueque militar en apagón sin internet)</span>
                    </div>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "0.82rem", color: "#FFF" }}>
                    <input
                        type="checkbox"
                        checked={isPublicOnMesh}
                        onChange={(e) => setIsPublicOnMesh(e.target.checked)}
                        style={{ accentColor: "#00E5FF", width: 18, height: 18 }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <TacIcon name="radio" size={15} color="#00E5FF" />
                        <span>Publicar mi Pasaporte en el directorio de nodo de la malla P2P</span>
                    </div>
                </label>
            </div>

            {/* BOTÓN GUARDAR */}
            <button
                type="submit"
                style={{
                    padding: "14px 20px",
                    borderRadius: "14px",
                    background: "var(--primary, #E8213A)",
                    border: "none",
                    color: "#FFF",
                    fontWeight: 900,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 18px rgba(232, 33, 58, 0.35)",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                }}
            >
                <TacIcon name="check" size={16} color="#FFF" />
                <span>Guardar Pasaporte de Pagos Soberano</span>
            </button>
        </form>
    );
};
