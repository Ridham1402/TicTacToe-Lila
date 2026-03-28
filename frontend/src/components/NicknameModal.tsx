/**
 * NicknameModal.tsx — Full-screen overlay for nickname entry on first visit.
 *
 * Shown when no username is found in localStorage.
 * On submit, saves the username and calls onComplete() to trigger auth.
 */

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { setStoredUsername } from "../lib/nakamaClient";

interface Props {
    onComplete: (username: string) => void;
}

export const NicknameModal: React.FC<Props> = ({ onComplete }) => {
    const [value, setValue] = useState("");
    const [error, setError] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = value.trim();

        if (trimmed.length < 2) {
            setError("Username must be at least 2 characters.");
            return;
        }
        if (trimmed.length > 20) {
            setError("Username must be 20 characters or less.");
            return;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
            setError("Only letters, numbers, underscores, and hyphens allowed.");
            return;
        }

        setStoredUsername(trimmed);
        onComplete(trimmed);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-base">
                {/* Ambient glow backdrop */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-neon-cyan/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-neon-purple/10 rounded-full blur-3xl" />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.34, 1.1, 0.64, 1] }}
                    className="relative z-10 w-full max-w-sm"
                >
                    {/* Card */}
                    <div className="glass-card p-8 shadow-2xl">
                        {/* Logo / icon */}
                        <div className="mb-6 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/30 mb-4">
                                <span className="text-3xl">✖</span>
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight gradient-text-cyan-purple">
                                TicTacToe PvP
                            </h1>
                            <p className="text-sm text-slate-400 mt-1">
                                Real-time multiplayer — enter the arena
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="nickname-input"
                                    className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2"
                                >
                                    Choose your callsign
                                </label>
                                <input
                                    id="nickname-input"
                                    ref={inputRef}
                                    type="text"
                                    value={value}
                                    onChange={(e) => {
                                        setValue(e.target.value);
                                        if (error) setError("");
                                    }}
                                    placeholder="e.g. XSlayer99"
                                    maxLength={20}
                                    autoComplete="off"
                                    spellCheck={false}
                                    className={`w-full px-4 py-3 rounded-xl bg-dark-base border text-white 
                    placeholder-slate-600 text-sm font-medium
                    focus:outline-none focus:ring-2 transition-all duration-200
                    ${error
                                            ? "border-red-500/60 focus:ring-red-500/30"
                                            : "border-dark-border focus:border-neon-cyan/60 focus:ring-neon-cyan/20"
                                        }`}
                                />
                                {error && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-2 text-xs text-red-400"
                                    >
                                        {error}
                                    </motion.p>
                                )}
                            </div>

                            <button
                                id="nickname-submit-btn"
                                type="submit"
                                disabled={value.trim().length < 2}
                                className="w-full py-3 px-6 rounded-xl font-bold text-sm uppercase tracking-widest
                  bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20
                  border border-neon-cyan/40
                  text-neon-cyan
                  hover:from-neon-cyan/30 hover:to-neon-purple/30 hover:border-neon-cyan
                  hover:shadow-glow-cyan
                  disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none
                  transition-all duration-200 active:scale-95"
                            >
                                Enter Arena →
                            </button>
                        </form>

                        <p className="mt-4 text-center text-xs text-slate-600">
                            Your stats are saved permanently to the global leaderboard
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
