/**
 * App.tsx — Top-level state machine router.
 *
 * Screen flow:
 *   "nickname" → "home" → "matchmaking" → "game" → back to "home" or "leaderboard"
 *
 * Manages auth lifecycle: when username changes, triggers useNakama to
 * authenticate and connect the Nakama socket.
 */

import React, { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useNakama } from "./hooks/useNakama";
import { useGame, GameMode } from "./hooks/useGame";

import { NicknameModal } from "./components/NicknameModal";
import { HomeScreen } from "./components/HomeScreen";
import { Matchmaking } from "./components/Matchmaking";
import { GameRoom } from "./components/GameRoom";
import { Leaderboard } from "./components/Leaderboard";

import { getStoredUsername } from "./lib/nakamaClient";

type Screen = "nickname" | "home" | "matchmaking" | "game" | "leaderboard";

// Used to re-trigger useNakama on username change
let _usernameVersion = 0;

const App: React.FC = () => {
    const [screen, setScreen] = useState<Screen>(() =>
        getStoredUsername() ? "home" : "nickname"
    );
    const [selectedMode, setSelectedMode] = useState<GameMode>("classic");
    const [, forceUpdate] = useState(0);

    // Auth + socket hook
    const { session, socket, isConnected, userId } = useNakama();

    // Game state hook
    const {
        gameStatus,
        gameState,
        gameOver,
        isMyTurn,
        timerSeconds,
        opponentDisconnected,
        joinMatchmaking,
        cancelMatchmaking,
        makeMove,
        resetGame,
    } = useGame(session, socket);

    // ── Sync hook-driven gameStatus to screen ──────────────────────────────
    useEffect(() => {
        if (gameStatus === "matchmaking" && screen !== "matchmaking") {
            setScreen("matchmaking");
        } else if (gameStatus === "playing" && screen !== "game") {
            setScreen("game");
        } else if (gameStatus === "idle" && (screen === "matchmaking" || screen === "game")) {
            setScreen("home");
        }
    }, [gameStatus, screen]);

    // ── Handlers ──────────────────────────────────────────────────────────

    const handleNicknameComplete = useCallback((_username: string) => {
        _usernameVersion++;
        forceUpdate((n) => n + 1);
        setScreen("home");
    }, []);

    const handleStartMatch = useCallback(
        async (mode: GameMode) => {
            setSelectedMode(mode);
            await joinMatchmaking(mode);
            // screen transition handled by useEffect above
        },
        [joinMatchmaking]
    );

    const handleCancelMatchmaking = useCallback(async () => {
        await cancelMatchmaking();
        setScreen("home");
    }, [cancelMatchmaking]);

    const handlePlayAgain = useCallback(async () => {
        await resetGame();
        setScreen("home");
    }, [resetGame]);

    const handleShowLeaderboard = useCallback(async () => {
        if (screen === "game") await resetGame();
        setScreen("leaderboard");
    }, [resetGame, screen]);

    const handleLeaderboardBack = useCallback(() => {
        setScreen("home");
    }, []);

    // ── Render ────────────────────────────────────────────────────────────

    const pageVariants = {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -16 },
    };

    return (
        <div className="flex flex-col min-h-dvh">
            <AnimatePresence mode="wait">

                {/* ── Nickname Modal ─────────────────────────────────── */}
                {screen === "nickname" && (
                    <NicknameModal
                        key="nickname"
                        onComplete={handleNicknameComplete}
                    />
                )}

                {/* ── Home Screen ────────────────────────────────────── */}
                {screen === "home" && (
                    <motion.div
                        key="home"
                        className="flex flex-col flex-1"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                    >
                        <HomeScreen
                            username={getStoredUsername() ?? "Player"}
                            isConnected={isConnected}
                            onStartMatch={handleStartMatch}
                            onShowLeaderboard={handleShowLeaderboard}
                        />
                    </motion.div>
                )}

                {/* ── Matchmaking Screen ─────────────────────────────── */}
                {screen === "matchmaking" && (
                    <motion.div
                        key="matchmaking"
                        className="flex flex-col flex-1"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                    >
                        <Matchmaking
                            mode={selectedMode}
                            onCancel={handleCancelMatchmaking}
                        />
                    </motion.div>
                )}

                {/* ── Game Room ──────────────────────────────────────── */}
                {screen === "game" && gameState && userId && (
                    <motion.div
                        key="game"
                        className="flex flex-col flex-1"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                    >
                        <GameRoom
                            userId={userId}
                            gameState={gameState}
                            gameOver={gameOver}
                            isMyTurn={isMyTurn}
                            timerSeconds={timerSeconds}
                            opponentDisconnected={opponentDisconnected}
                            onMakeMove={makeMove}
                            onPlayAgain={handlePlayAgain}
                            onLeaderboard={handleShowLeaderboard}
                        />
                    </motion.div>
                )}

                {/* ── Leaderboard ────────────────────────────────────── */}
                {screen === "leaderboard" && session && (
                    <motion.div
                        key="leaderboard"
                        className="flex flex-col flex-1"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                    >
                        <Leaderboard session={session} onBack={handleLeaderboardBack} />
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
};

export default App;
