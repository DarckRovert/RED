"use client";

import React, { useState } from 'react';
import { PaymentIntentRequest, PaymentReceipt, PaymentRail } from '../../lib/miniapp/RedSDKTypes';
import { redPaymentGateway } from '../../lib/miniapp/RedPaymentGatewayEngine';
import { Web3BridgeEngine } from '../../lib/network/Web3BridgeEngine';
import { MonetizationEngine } from '../../lib/network/MonetizationEngine';

interface UniversalCheckoutModalProps {
    intent: PaymentIntentRequest;
    buyerDid: string;
    onClose: () => void;
    onSuccess: (receipt: PaymentReceipt) => void;
}

export const UniversalCheckoutModal: React.FC<UniversalCheckoutModalProps> = ({
    intent,
    buyerDid,
    onClose,
    onSuccess,
}) => {
    const supportedRails = intent.supportedRails && intent.supportedRails.length > 0
        ? intent.supportedRails
        : (['paypal', 'web3_usdt', 'offgrid_voucher', 'lightning'] as PaymentRail[]);

    const [selectedRail, setSelectedRail] = useState<PaymentRail>(supportedRails[0]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const userCredits = MonetizationEngine.getProStatus().credits;
    const web3State = Web3BridgeEngine.getInstance().getState();

    const handleConfirmPayment = async () => {
        setIsProcessing(true);
        setErrorMsg(null);

        try {
            let receipt: PaymentReceipt;

            switch (selectedRail) {
                case 'paypal':
                    receipt = await redPaymentGateway.executePayPalPayment(intent, buyerDid);
                    break;
                case 'web3_usdt':
                    receipt = await redPaymentGateway.executeWeb3Payment(intent, buyerDid);
                    break;
                case 'lightning':
                    receipt = await redPaymentGateway.executeLightningPayment(intent, buyerDid);
                    break;
                case 'offgrid_voucher':
                    receipt = await redPaymentGateway.executeOffgridVoucherPayment(intent, buyerDid);
                    break;
                default:
                    throw new Error("Riel de pago no soportado.");
            }

            setIsProcessing(false);
            onSuccess(receipt);
        } catch (err: any) {
            setIsProcessing(false);
            setErrorMsg(err.message || "Error al procesar el pago.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">💳</span>
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pasarela de Pago Multi-Rail</h3>
                            <p className="text-xs text-slate-400">RED Sovereign Checkout</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition"
                    >
                        ✕
                    </button>
                </div>

                {/* Intent Summary */}
                <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex justify-between items-center">
                    <div>
                        <h4 className="text-sm font-semibold text-slate-200">{intent.title}</h4>
                        <p className="text-xs text-slate-400">{intent.description || 'Comercio en Malla RED'}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">Vendedor: {intent.merchant.name}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-extrabold text-emerald-400">
                            ${intent.amount.toFixed(2)}
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">{intent.currency}</span>
                    </div>
                </div>

                {/* Rail Selector */}
                <div className="p-4 space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Selecciona tu método de pago:</label>
                    <div className="grid grid-cols-2 gap-2">
                        {supportedRails.includes('paypal') && (
                            <button
                                type="button"
                                onClick={() => setSelectedRail('paypal')}
                                className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition ${
                                    selectedRail === 'paypal' 
                                        ? 'border-blue-500 bg-blue-950/40 text-white' 
                                        : 'border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-400'
                                }`}
                            >
                                <span className="text-lg">💳 PayPal / Tarjeta</span>
                                <span className="text-[11px] font-medium text-slate-300">USD / Fiat Directo</span>
                            </button>
                        )}

                        {supportedRails.includes('web3_usdt') && (
                            <button
                                type="button"
                                onClick={() => setSelectedRail('web3_usdt')}
                                className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition ${
                                    selectedRail === 'web3_usdt' 
                                        ? 'border-purple-500 bg-purple-950/40 text-white' 
                                        : 'border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-400'
                                }`}
                            >
                                <span className="text-lg">🪙 Web3 USDT/POL</span>
                                <span className="text-[11px] font-medium text-slate-300">Polygon / Base</span>
                            </button>
                        )}

                        {supportedRails.includes('lightning') && (
                            <button
                                type="button"
                                onClick={() => setSelectedRail('lightning')}
                                className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition ${
                                    selectedRail === 'lightning' 
                                        ? 'border-amber-500 bg-amber-950/40 text-white' 
                                        : 'border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-400'
                                }`}
                            >
                                <span className="text-lg">⚡ Lightning</span>
                                <span className="text-[11px] font-medium text-slate-300">Bitcoin Sats</span>
                            </button>
                        )}

                        {supportedRails.includes('offgrid_voucher') && (
                            <button
                                type="button"
                                onClick={() => setSelectedRail('offgrid_voucher')}
                                className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition ${
                                    selectedRail === 'offgrid_voucher' 
                                        ? 'border-emerald-500 bg-emerald-950/40 text-white' 
                                        : 'border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-400'
                                }`}
                            >
                                <span className="text-lg">🤝 Vale Off-Grid</span>
                                <span className="text-[11px] font-medium text-slate-300">100% Sin Internet</span>
                            </button>
                        )}
                    </div>

                    {/* Rail Details Box */}
                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs space-y-1">
                        {selectedRail === 'paypal' && (
                            <div>
                                <p className="text-slate-300 font-semibold">Pago con PayPal / Tarjeta de Débito o Crédito</p>
                                <p className="text-slate-400 text-[11px]">
                                    Destino: <span className="font-mono text-blue-400">@{intent.merchant.paypalUsername || 'redmesh'}</span>
                                </p>
                                <p className="text-slate-500 text-[10px] mt-1">Se abrirá una pestaña segura para procesar el pago directamente con el comercio.</p>
                            </div>
                        )}

                        {selectedRail === 'web3_usdt' && (
                            <div>
                                <p className="text-slate-300 font-semibold">Transferencia Cripto Web3 (USDT / POL)</p>
                                <p className="text-slate-400 text-[11px] truncate">
                                    Billetera: <span className="font-mono text-purple-400">{intent.merchant.evmAddress || '0x71C836eB3f4D4e05bE7728373b9846b41295b364'}</span>
                                </p>
                                <p className="text-slate-400 text-[11px]">
                                    Estado Billetera: {web3State.isConnected ? '🟢 Conectado (' + web3State.account?.slice(0, 8) + '...)' : '⚪ Modo Directo'}
                                </p>
                            </div>
                        )}

                        {selectedRail === 'lightning' && (
                            <div>
                                <p className="text-slate-300 font-semibold">Factura Bitcoin Lightning Network</p>
                                <p className="text-slate-400 text-[11px]">
                                    Monto: <span className="text-amber-400 font-bold">~{Math.round(intent.amount * 1500)} SAT</span>
                                </p>
                                <p className="text-slate-500 text-[10px]">Liquidación instantánea vía WebLN o código QR de factura.</p>
                            </div>
                        )}

                        {selectedRail === 'offgrid_voucher' && (
                            <div>
                                <p className="text-slate-300 font-semibold">Crédito Mutuo / Vale Criptográfico Off-Grid</p>
                                <p className="text-slate-400 text-[11px]">
                                    Tu Saldo Local: <span className="text-emerald-400 font-bold">{userCredits} Créditos</span>
                                </p>
                                <p className="text-slate-500 text-[10px]">Pagaré digital firmado con Ed25519 transmitido por radio/Bluetooth sin conexión.</p>
                            </div>
                        )}
                    </div>

                    {errorMsg && (
                        <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-300 text-xs">
                            ⚠️ {errorMsg}
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-slate-300 text-xs font-bold transition"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmPayment}
                        disabled={isProcessing}
                        className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <span className="animate-spin text-sm">🔄</span>
                                <span>Procesando...</span>
                            </>
                        ) : (
                            <>
                                <span>Confirmar Pago</span>
                                <span>➔</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
