"use client";



import { useCallback, useRef, useState } from "react";
import { CONFETTI_COLORS } from "./constants";


export function triggerConfetti() {
    if (typeof document === "undefined") return;

    for (let i = 0; i < 80; i++) {
        const confetti = document.createElement("div");
        confetti.style.cssText = `
            position: fixed;
            top: -10px;
            left: ${Math.random() * 100}vw;
            width: ${Math.random() * 8 + 4}px;
            height: ${Math.random() * 8 + 4}px;
            background: ${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
            border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
            z-index: 9999;
            pointer-events: none;
            animation: confettiFall ${Math.random() * 2 + 2}s ease-out forwards;
        `;
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 4000);
    }
}


export function useConfetti() {
    const [goldenMode, setGoldenMode] = useState(false);
    const clickTimestamps = useRef<number[]>([]);

    const handleLogoClick = useCallback(() => {
        const now = Date.now();
        clickTimestamps.current.push(now);
        clickTimestamps.current = clickTimestamps.current.filter((t) => now - t < 3000);

        if (clickTimestamps.current.length >= 7) {
            clickTimestamps.current = [];
            triggerConfetti();
            setGoldenMode(true);
            document.documentElement.style.setProperty("--primary", "#FFD700");
            document.documentElement.style.setProperty(
                "--gradient",
                "linear-gradient(135deg, #FFD700, #FFA500, #FF6B6B)",
            );
            setTimeout(() => {
                setGoldenMode(false);
                document.documentElement.style.removeProperty("--primary");
                document.documentElement.style.removeProperty("--gradient");
            }, 30_000);
        }
    }, []);

    return { goldenMode, handleLogoClick };
}
