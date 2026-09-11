import { Metadata } from 'next';
import { PitchDeck } from '../../components/pitch/PitchDeck';

export const metadata: Metadata = {
    title: "RED — Presentación Oficial & Pitch Deck (v99.0.0)",
    description: "Presentación ejecutiva e interactiva de RED Sovereign Mesh OS: sistema operativo táctico de malla 100% off-grid.",
};

export default function PitchPage() {
    return <PitchDeck />;
}
