/**
 * Leaderboard.tsx — Global leaderboard screen.
 *
 * Fetches top-50 records via useLeaderboard → get_leaderboard RPC.
 * Current user's row is highlighted in neon cyan.
 * Columns: Rank | Player | Wins | Losses | Streak | Score
 */

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { Session } from "@heroiclabs/nakama-js";
import { useLeaderboard } from "../hooks/useLeaderboard";

interface Props {
    session: Session;
    onBack: () => void;
}

const RANK_ICONS: { [k: number]: string } = {
    1: "🥇",
    2: "🥈",
    3: "🥉",
};

export const Leaderboard: React.FC<Props> = ({ session, onBack }) => {
    const { records, loading, error, refresh } = useLeaderboard(session);

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const myUserId = session.user_id;

    return (
        <div className="flex-1 flex flex-col p-4 sm:p-6 relative z-10">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 mb-6"
            >
                <button
                    id="leaderboard-back-btn"
                    onClick={onBack}
                    className="btn-ghost px-3 py-2 text-xs"
                >
                    ← Back
                </button>
                <div>
                    <h2 className="text-2xl font-black gradient-text-cyan-purple">
                        🏆 Leaderboard
                    </h2>
                    <p className="text-xs text-slate-500">Global all-time rankings</p>
                </div>
            </motion.div>

            {/* Content */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex-1 overflow-hidden"
            >
                {loading && (
                    <div className="space-y-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-14 rounded-xl shimmer"
                                style={{ animationDelay: `${i * 0.05}s` }}
                            />
                        ))}
                    </div>
                )}

                {error && !loading && (
                    <div className="text-center py-16">
                        <p className="text-red-400 text-sm mb-4">{error}</p>
                        <button onClick={refresh} className="btn-ghost text-sm">
                            Retry
                        </button>
                    </div>
                )}

                {!loading && !error && records.length === 0 && (
                    <div className="text-center py-16 text-slate-500">
                        <p className="text-4xl mb-3">📋</p>
                        <p className="text-sm">No records yet. Play a game to appear here!</p>
                    </div>
                )}

                {!loading && records.length > 0 && (
                    <div className="rounded-2xl overflow-hidden border border-dark-border/60">
                        {/* Table header */}
                        <div className="grid grid-cols-[48px_1fr_52px_52px_52px_60px] gap-0
              px-4 py-3 bg-dark-elevated border-b border-dark-border/40">
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">#</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Player</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold text-right">W</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold text-right">L</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold text-right">🔥</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold text-right">Score</span>
                        </div>

                        {/* Rows */}
                        <div className="overflow-y-auto max-h-[60vh]">
                            {records.map((record, idx) => {
                                const isMe = record.userId === myUserId;
                                const rankIcon = RANK_ICONS[record.rank];

                                return (
                                    <motion.div
                                        key={record.userId}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className={`
                      grid grid-cols-[48px_1fr_52px_52px_52px_60px] gap-0
                      px-4 py-3 border-b border-dark-border/30 last:border-0
                      transition-colors
                      ${isMe
                                                ? "bg-neon-cyan/5 border-l-2 border-l-neon-cyan"
                                                : "hover:bg-dark-elevated/60"
                                            }
                    `}
                                    >
                                        {/* Rank */}
                                        <div className="flex items-center">
                                            {rankIcon ? (
                                                <span className="text-lg">{rankIcon}</span>
                                            ) : (
                                                <span className="text-sm text-slate-500 font-semibold">
                                                    {record.rank}
                                                </span>
                                            )}
                                        </div>

                                        {/* Username */}
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className={`text-sm font-semibold truncate ${isMe ? "text-neon-cyan" : "text-white"
                                                    }`}
                                            >
                                                {record.username}
                                            </span>
                                            {isMe && (
                                                <span className="text-[10px] text-neon-cyan/60 bg-neon-cyan/10
                          border border-neon-cyan/20 rounded px-1 py-0.5 font-medium shrink-0">
                                                    You
                                                </span>
                                            )}
                                        </div>

                                        {/* Wins */}
                                        <div className="flex items-center justify-end">
                                            <span className="text-sm font-semibold text-neon-green">
                                                {record.wins}
                                            </span>
                                        </div>

                                        {/* Losses */}
                                        <div className="flex items-center justify-end">
                                            <span className="text-sm font-semibold text-red-400">
                                                {record.losses}
                                            </span>
                                        </div>

                                        {/* Streak */}
                                        <div className="flex items-center justify-end">
                                            <span
                                                className={`text-sm font-semibold ${record.streak >= 3
                                                        ? "text-neon-yellow"
                                                        : "text-slate-400"
                                                    }`}
                                            >
                                                {record.streak}
                                            </span>
                                        </div>

                                        {/* Score */}
                                        <div className="flex items-center justify-end">
                                            <span
                                                className={`text-sm font-bold ${isMe ? "text-neon-cyan" : "text-slate-300"
                                                    }`}
                                            >
                                                {record.score}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Refresh */}
            {!loading && (
                <div className="mt-4 text-center">
                    <button
                        id="leaderboard-refresh-btn"
                        onClick={refresh}
                        className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                    >
                        ↻ Refresh
                    </button>
                </div>
            )}
        </div>
    );
};
