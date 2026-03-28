/**
 * HomeScreen.tsx — Landing screen after nickname is set.
 *
 * Shows:
 *  - Username chip with connection status indicator
 *  - Two large CTA buttons: "Quick Match" (classic mode) / "Timed Match" (30s timer)
 *  - Leaderboard button
 */

import React from "react";
import { motion } from "framer-motion";
import { GameMode } from "../hooks/useGame";

interface Props {
    username: string;
    isConnected: boolean;
    onStartMatch: (mode: GameMode) => void;
    onShowLeaderboard: () => void;
}

export const HomeScreen: React.FC<Props> = ({
    username,
    isConnected,
    onStartMatch,
    onShowLeaderboard,
}) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-12 text-center"
            >
                {/* Game title */}
                <div className="mb-6">
                    <h1 className="text-5xl sm:text-6xl font-black tracking-tight gradient-text-cyan-purple">
                        TicTacToe
                    </h1>
                    <p className="text-slate-500 text-sm font-medium tracking-widest uppercase mt-2">
                        Real-time PvP Arena
                    </p>
                </div>

                {/* Username chip */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dark-elevated border border-dark-border">
                    {/* Connection dot */}
                    <span
                        className={`w-2 h-2 rounded-full ${isConnected ? "bg-neon-green animate-pulse" : "bg-slate-600"
                            }`}
                    />
                    <span className="text-sm font-semibold text-slate-300">{username}</span>
                    {!isConnected && (
                        <span className="text-xs text-slate-500">(connecting…)</span>
                    )}
                </div>
            </motion.div>

            {/* Main action buttons */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="w-full max-w-sm space-y-4"
            >
                {/* Quick Match */}
                <button
                    id="quick-match-btn"
                    onClick={() => onStartMatch("classic")}
                    disabled={!isConnected}
                    className="w-full group relative overflow-hidden px-8 py-5 rounded-2xl
            bg-gradient-to-r from-neon-cyan/10 to-transparent
            border border-neon-cyan/30
            hover:border-neon-cyan hover:from-neon-cyan/20 hover:shadow-glow-cyan
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none
            transition-all duration-300 active:scale-98 text-left"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-lg font-bold text-neon-cyan">Quick Match</div>
                            <div className="text-xs text-slate-400 mt-0.5">Classic mode — no time pressure</div>
                        </div>
                        <span className="text-2xl text-neon-cyan/60 group-hover:translate-x-1 transition-transform">
                            →
                        </span>
                    </div>
                    {/* Hover shimmer */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full
            bg-gradient-to-r from-transparent via-neon-cyan/5 to-transparent
            transition-transform duration-700 pointer-events-none" />
                </button>

                {/* Timed Match */}
                <button
                    id="timed-match-btn"
                    onClick={() => onStartMatch("timed")}
                    disabled={!isConnected}
                    className="w-full group relative overflow-hidden px-8 py-5 rounded-2xl
            bg-gradient-to-r from-neon-purple/10 to-transparent
            border border-neon-purple/30
            hover:border-neon-purple hover:from-neon-purple/20 hover:shadow-glow-purple
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none
            transition-all duration-300 active:scale-98 text-left"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-lg font-bold text-neon-purple">Timed Match</div>
                            <div className="text-xs text-slate-400 mt-0.5">30 seconds per move — auto-forfeit</div>
                        </div>
                        <span className="text-2xl text-neon-purple/60 group-hover:translate-x-1 transition-transform">
                            ⏱
                        </span>
                    </div>
                    {/* Hover shimmer */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full
            bg-gradient-to-r from-transparent via-neon-purple/5 to-transparent
            transition-transform duration-700 pointer-events-none" />
                </button>

                {/* Leaderboard */}
                <button
                    id="leaderboard-btn"
                    onClick={onShowLeaderboard}
                    className="w-full px-8 py-4 rounded-2xl
            border border-dark-border text-slate-400
            hover:border-slate-500 hover:text-slate-200 hover:bg-dark-elevated
            transition-all duration-200 active:scale-98 text-left
            flex items-center justify-between"
                >
                    <span className="font-medium text-sm">🏆 Global Leaderboard</span>
                    <span className="text-slate-600">→</span>
                </button>
            </motion.div>

            {/* Footer */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-12 text-xs text-slate-700 text-center"
            >
                Powered by Nakama · Server-authoritative · Real-time WebSocket
            </motion.p>
        </div>
    );
};
