"use client";

import React from "react";
import { SovereignEconomyGuideModal } from "../../components/tactical/SovereignEconomyGuideModal";

export function EconomyClientPage() {
    const handleClose = () => {
        if (typeof window !== "undefined") {
            window.location.href = "./";
        }
    };

    return (
        <main style={{ minHeight: "100vh", backgroundColor: "#04060A" }}>
            <SovereignEconomyGuideModal
                isOpen={true}
                onClose={handleClose}
                isStandalone={true}
            />
        </main>
    );
}
