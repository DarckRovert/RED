import { Metadata } from 'next';
import { EconomyClientPage } from './EconomyClientPage';
import { RED_VERSION } from '../../lib/version';

export const metadata: Metadata = {
    title: `RED — Manifiesto de Economía Soberana & Calculadora de Paridad (v${RED_VERSION})`,
    description: "Manifiesto de la Economía Soberana de RED: Respaldo por utilidad comunitaria, Proof-of-Relay (PoR), inmunidad a hacks de puentes Web3 y calculadora interactiva de paridad de supervivencia.",
};

export default function EconomyPage() {
    return <EconomyClientPage />;
}
