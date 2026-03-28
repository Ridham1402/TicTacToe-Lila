/**
 * Timer.tsx — Circular SVG countdown timer for timed game mode.
 *
 * Features:
 *  - Circular progress ring that depletes as time runs down
 *  - Color transitions: green (>15s) → yellow (>7s) → red (≤7s)
 *  - Numeric seconds display in the center
 *  - Animated stroke-dashoffset for smooth countdown
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";

interface Props {
    secondsRemaining: number;
    totalSeconds?: number;
    isMyTurn: boolean;
}

const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getColor(seconds: number): string {
    if (seconds > 15) return "#22c55e"; // green
    if (seconds > 7) return "#eab308";  // yellow
    return "#ef4444";                    // red
}

function getGlowColor(seconds: number): string {
    if (seconds > 15) return "rgba(34, 197, 94, 0.5)";
    if (seconds > 7) return "rgba(234, 179, 8, 0.5)";
    return "rgba(239, 68, 68, 0.5)";
}

export const Timer: React.FC<Props> = ({
    secondsRemaining,
    totalSeconds = 30,
    isMyTurn,
}) => {
    const clampedSeconds = Math.max(0, Math.min(secondsRemaining, totalSeconds));
    const progress = clampedSeconds / totalSeconds;
    const dashOffset = CIRCUMFERENCE * (1 - progress);
    const color = useMemo(() => getColor(clampedSeconds), [clampedSeconds]);
    const glowColor = useMemo(() => getGlowColor(clampedSeconds), [clampedSeconds]);

    return (
        <div
            className="flex flex-col items-center gap-1"
            aria-label={`Timer: ${clampedSeconds} seconds remaining`}
        >
            <div className="relative w-24 h-24">
                <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    className="-rotate-90"
                    aria-hidden="true"
                >
                    {/* Background track */}
                    <circle
                        cx="48"
                        cy="48"
                        r={RADIUS}
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="6"
                    />
                    {/* Progress ring */}
                    <motion.circle
                        cx="48"
                        cy="48"
                        r={RADIUS}
                        fill="none"
                        stroke={color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        animate={{
                            strokeDashoffset: dashOffset,
                            stroke: color,
                            filter: `drop-shadow(0 0 6px ${glowColor})`,
                        }}
                        transition={{ duration: 0.9, ease: "linear" }}
                    />
                </svg>

                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                        animate={{ color }}
                        transition={{ duration: 0.5 }}
                        className="text-2xl font-black tabular-nums leading-none"
                        style={{ color }}
                    >
                        {clampedSeconds}
                    </motion.span>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider font-medium">
                        sec
                    </span>
                </div>
            </div>

            {/* Turn indicator beneath timer */}
            <p
                className="text-xs font-semibold tracking-wide"
                style={{ color: isMyTurn ? color : "rgba(148, 163, 184, 0.5)" }}
            >
                {isMyTurn ? "YOUR TURN" : "THEIR TURN"}
            </p>
        </div>
    );
};
