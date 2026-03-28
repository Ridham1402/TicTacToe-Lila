/**
 * Matchmaking.tsx — "Finding opponent…" animated waiting screen.
 *
 * Shows a pulsing ring animation while Nakama's matchmaker is finding
 * an opponent. Cancel button removes the matchmaker ticket.
 */

import React from "react";
import { motion } from "framer-motion";

interface Props {
    mode: "classic" | "timed";
    onCancel: () => void;
}

export const Matchmaking: React.FC<Props> = ({ mode, onCancel }) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center"
            >
                {/* Animated pulsing rings */}
                <div className="relative w-40 h-40 mx-auto mb-10">
                    {/* Outer ring — slowest pulse */}
                    <motion.div
                        animate={{ scale: [1, 1.35, 1], opacity: [0.3, 0, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-full border border-neon-cyan/30"
                    />
                    {/* Middle ring */}
                    <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                        className="absolute inset-4 rounded-full border border-neon-cyan/50"
                    />
                    {/* Inner ring — fastest */}
                    <motion.div
                        animate={{ scale: [1, 1.1, 1], opacity: [0.7, 0.3, 0.7] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
                        className="absolute inset-8 rounded-full border-2 border-neon-cyan"
                    />
                    {/* Center icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                            className="w-16 h-16 rounded-full bg-neon-cyan/10 border border-neon-cyan/40
                flex items-center justify-center"
                        >
                            <span className="text-2xl">✖</span>
                        </motion.div>
                    </div>
                </div>

                {/* Text */}
                <h2 className="text-2xl font-bold text-white mb-2">
                    Finding opponent
                    <motion.span
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                    >
                        …
                    </motion.span>
                </h2>
                <p className="text-sm text-slate-400 mb-2">
                    Mode:{" "}
                    <span
                        className={`font-semibold ${mode === "timed" ? "text-neon-purple" : "text-neon-cyan"
                            }`}
                    >
                        {mode === "timed" ? "⏱ Timed (30s/move)" : "Classic"}
                    </span>
                </p>
                <p className="text-xs text-slate-600 mb-10">
                    A second player must also queue for the same mode
                </p>

                {/* Cancel button */}
                <button
                    id="cancel-matchmaking-btn"
                    onClick={onCancel}
                    className="btn-ghost text-sm"
                >
                    Cancel
                </button>
            </motion.div>
        </div>
    );
};
