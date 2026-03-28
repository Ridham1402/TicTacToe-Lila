/**
 * GameRoom.tsx — Main game screen composing all in-game UI elements.
 *
 * Layout:
 *  ┌──────────────────────────────────┐
 *  │  Player X name    Player O name  │  ← top bar
 *  │  [Timer if timed mode]           │  ← center-top
 *  │  Turn indicator text             │
 *  │  3×3 Board                       │  ← center
 *  │  [Opponent disconnected banner]  │  ← conditional
 *  └──────────────────────────────────┘
 *  + Game Over overlay (framer-motion AnimatePresence)
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Board } from "./Board";
import { Timer } from "./Timer";
import {
    GameState,
    GameOverInfo,
    CellValue,
} from "../hooks/useGame";

interface Props {
    userId: string;
    gameState: GameState;
    gameOver: GameOverInfo | null;
    isMyTurn: boolean;
    timerSeconds: number;
    opponentDisconnected: boolean;
    onMakeMove: (cellIndex: number) => void;
    onPlayAgain: () => void;
    onLeaderboard: () => void;
}

function resolveWinnerName(
    gameOver: GameOverInfo,
    userId: string
): { headline: string; subline: string; isWin: boolean; isDraw: boolean } {
    if (gameOver.winner === "draw" || gameOver.winner === null) {
        return { headline: "It's a Draw!", subline: "No points this round.", isWin: false, isDraw: true };
    }

    // winner is "X" or "O"
    const winnerEntry = Object.entries(gameOver.players).find(
        ([, info]) => info.symbol === gameOver.winner
    );
    const isMeWinner = winnerEntry?.[0] === userId;
    const winnerName = winnerEntry?.[1]?.username ?? "Unknown";

    if (isMeWinner) {
        const reasonSuffix =
            gameOver.reason === "timeout"
                ? " (opponent timed out)"
                : gameOver.reason === "disconnect"
                    ? " (opponent forfeited)"
                    : "";
        return {
            headline: "You Win! 🎉",
            subline: `+3 points earned${reasonSuffix}`,
            isWin: true,
            isDraw: false,
        };
    }

    const reasonSuffix =
        gameOver.reason === "timeout"
            ? " (you timed out)"
            : gameOver.reason === "disconnect"
                ? " (you forfeited)"
                : "";
    return {
        headline: `${winnerName} Wins`,
        subline: `Better luck next time${reasonSuffix}`,
        isWin: false,
        isDraw: false,
    };
}

export const GameRoom: React.FC<Props> = ({
    userId,
    gameState,
    gameOver,
    isMyTurn,
    timerSeconds,
    opponentDisconnected,
    onMakeMove,
    onPlayAgain,
    onLeaderboard,
}) => {
    const playerIds = Object.keys(gameState.players);
    const myId = userId;
    const opponentId = playerIds.find((id) => id !== myId) ?? null;
    const me = myId ? gameState.players[myId] : null;
    const opponent = opponentId ? gameState.players[opponentId] : null;

    const boardDisabled = !isMyTurn || !!gameOver || opponentDisconnected;

    // Build winning cells for highlight
    const WINNING_LINES = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6],
    ];
    const winningCells: number[] = [];
    if (gameState.winner && gameState.winner !== "draw") {
        for (const [a, b, c] of WINNING_LINES) {
            const board: CellValue[] = gameState.board;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                winningCells.push(a, b, c);
                break;
            }
        }
    }

    const gameOverResult = gameOver ? resolveWinnerName(gameOver, userId) : null;

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">

            {/* ── Player top bar ────────────────────────────────────── */}
            <div className="w-full max-w-sm flex items-center justify-between mb-6">
                {/* My info */}
                <div className="flex flex-col items-start gap-0.5">
                    <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">You</span>
                    <div className="flex items-center gap-2">
                        <span
                            className={`text-lg font-black ${me?.symbol === "X" ? "text-neon-cyan text-glow-cyan" : "text-neon-purple text-glow-purple"
                                }`}
                        >
                            {me?.symbol ?? "?"}
                        </span>
                        <span className="text-sm font-semibold text-white truncate max-w-[90px]">
                            {me?.username ?? "…"}
                        </span>
                    </div>
                </div>

                {/* VS divider */}
                <div className="flex flex-col items-center">
                    <span className="text-xs text-slate-600 font-medium">VS</span>
                    {gameState.mode === "timed" && (
                        <Timer
                            secondsRemaining={timerSeconds}
                            totalSeconds={30}
                            isMyTurn={isMyTurn}
                        />
                    )}
                </div>

                {/* Opponent info */}
                <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
                        {opponentDisconnected ? "Reconnecting…" : "Opponent"}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate max-w-[90px]">
                            {opponent?.username ?? "Waiting…"}
                        </span>
                        <span
                            className={`text-lg font-black ${opponent?.symbol === "X" ? "text-neon-cyan text-glow-cyan" : "text-neon-purple text-glow-purple"
                                }`}
                        >
                            {opponent?.symbol ?? "?"}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Turn indicator (classic mode) ─────────────────────── */}
            {gameState.mode === "classic" && !gameOver && (
                <motion.p
                    key={isMyTurn ? "myturn" : "theirturn"}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-sm font-semibold mb-4 tracking-wide ${isMyTurn ? "text-neon-cyan text-glow-cyan" : "text-slate-500"
                        }`}
                >
                    {isMyTurn ? "Your turn" : `${opponent?.username ?? "Opponent"}'s turn…`}
                </motion.p>
            )}

            {/* ── Opponent disconnected banner ──────────────────────── */}
            <AnimatePresence>
                {opponentDisconnected && !gameOver && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mb-4 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm font-medium"
                    >
                        ⚠ Opponent disconnected — waiting 15s for reconnection…
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Board ────────────────────────────────────────────── */}
            <Board
                board={gameState.board}
                onCellClick={onMakeMove}
                disabled={boardDisabled}
                winningCells={winningCells.length ? winningCells : undefined}
            />

            {/* ── Game Over Overlay ─────────────────────────────────── */}
            <AnimatePresence>
                {gameOver && gameOverResult && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-dark-base/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.85, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 350, damping: 28 }}
                            className="glass-card p-8 text-center max-w-sm w-full shadow-2xl"
                        >
                            {/* Result emoji */}
                            <div className="text-5xl mb-4">
                                {gameOverResult.isDraw ? "🤝" : gameOverResult.isWin ? "🏆" : "💀"}
                            </div>

                            <h2
                                className={`text-3xl font-black mb-2 ${gameOverResult.isDraw
                                    ? "text-slate-300"
                                    : gameOverResult.isWin
                                        ? "text-neon-cyan text-glow-cyan"
                                        : "text-neon-purple text-glow-purple"
                                    }`}
                            >
                                {gameOverResult.headline}
                            </h2>

                            <p className="text-sm text-slate-400 mb-8">{gameOverResult.subline}</p>

                            <div className="space-y-3">
                                <button
                                    id="play-again-btn"
                                    onClick={onPlayAgain}
                                    className="w-full btn-neon-cyan py-3"
                                >
                                    Play Again
                                </button>
                                <button
                                    id="view-leaderboard-btn"
                                    onClick={onLeaderboard}
                                    className="w-full btn-ghost py-3"
                                >
                                    View Leaderboard
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
