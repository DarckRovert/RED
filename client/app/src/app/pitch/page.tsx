import { Metadata } from 'next';
import { PitchDeck } from '../../components/pitch/PitchDeck';
import { RED_VERSION } from '../../lib/version';

export const metadata: Metadata = {
    title: `RED — Presentación Oficial & Pitch Deck (v${RED_VERSION})`,
    description: "Presentación ejecutiva e interactiva de RED Sovereign Mesh OS: sistema operativo táctico de malla 100% off-grid y arquitectura bio-cibernética.",
};

export default function PitchPage() {
    return <PitchDeck />;
}
