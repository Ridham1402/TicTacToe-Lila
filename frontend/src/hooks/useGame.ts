/**
 * useGame.ts — Match lifecycle and game state management hook.
 *
 * Responsibilities:
 *  - Join matchmaking queue (nk ticket) with mode ("classic" | "timed")
 *  - Listen for matchmakerMatched notification → auto-join the match
 *  - Listen for match data messages (GAME_STATE, GAME_OVER, TIMER_TICK, OPPONENT_DISCONNECTED)
 *  - Send MAKE_MOVE messages to the server
 *  - Expose all derived game state to the UI
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Session, Socket } from "@heroiclabs/nakama-js";
// No imports from lib/nakamaClient needed here

// Op codes must match nakama/src/types.ts
const OpCode = {
    GAME_STATE: 1,
    MAKE_MOVE: 2,
    GAME_OVER: 3,
    PLAYER_READY: 4,
    TIMER_TICK: 5,
    OPPONENT_DISCONNECTED: 6,
} as const;

export type CellValue = "X" | "O" | null;
export type GameMode = "classic" | "timed";
export type GameStatus = "idle" | "matchmaking" | "playing" | "finished";

export interface PlayerInfo {
    symbol: "X" | "O";
    username: string;
}

export interface GameState {
    board: CellValue[];
    currentTurn: string;
    players: { [userId: string]: PlayerInfo };
    mode: GameMode;
    timerSeconds: number;
    status: "waiting" | "playing" | "finished";
    winner: string | null;
    moveCount: number;
}

export interface GameOverInfo {
    winner: string | null;
    board: CellValue[];
    players: { [userId: string]: PlayerInfo };
    reason: "normal" | "timeout" | "disconnect";
}

export interface UseGameReturn {
    gameStatus: GameStatus;
    gameState: GameState | null;
    gameOver: GameOverInfo | null;
    matchId: string | null;
    mySymbol: "X" | "O" | null;
    isMyTurn: boolean;
    timerSeconds: number;
    opponentDisconnected: boolean;
    joinMatchmaking: (mode: GameMode) => Promise<void>;
    cancelMatchmaking: () => Promise<void>;
    makeMove: (cellIndex: number) => void;
    resetGame: () => void;
}

export function useGame(
    session: Session | null,
    socket: Socket | null
): UseGameReturn {
    const [gameStatus, setGameStatus] = useState<GameStatus>("idle");
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);
    const [matchId, setMatchId] = useState<string | null>(null);
    const [timerSeconds, setTimerSeconds] = useState(30);
    const [opponentDisconnected, setOpponentDisconnected] = useState(false);

    const ticketRef = useRef<string | null>(null);

    // derived
    const userId = session?.user_id ?? null;
    const mySymbol: "X" | "O" | null =
        userId && gameState?.players[userId]
            ? gameState.players[userId].symbol
            : null;
    const isMyTurn =
        !!gameState && gameState.status === "playing" && gameState.currentTurn === userId;

    // -------------------------------------------------------------------------
    // Socket event listeners
    // -------------------------------------------------------------------------
    // At top of useGame, create a stable handler ref
    const handleMatchData = useRef<(data: any) => void>();

    // Keep it updated with latest state via another ref
    const latestState = useRef({ gameState, matchId, session });
    useEffect(() => {
        latestState.current = { gameState, matchId, session };
    }, [gameState, matchId, session]);

    // Set handler once on socket mount, never re-register
    useEffect(() => {
        if (!socket) return;

        socket.onmatchmakermatched = async (matched) => {
            console.log("[useGame] matchmakerMatched →", matched.match_id);
            const mid = matched.match_id;
            if (!mid) return;
            try {
                await socket.joinMatch(mid);
                setMatchId(mid);
                setGameStatus("playing");
                ticketRef.current = null;
            } catch (err) {
                console.error("[useGame] Failed to join match:", err);
                setGameStatus("idle");
            }
        };

        socket.onmatchdata = (data) => {
            const opCode = Number(data.op_code);
            const raw = data.data;
            const jsonStr = typeof raw === "string"
                ? raw
                : new TextDecoder().decode(raw);

            console.log("[onmatchdata] opCode:", opCode, "payload:", jsonStr);

            switch (opCode) {
                case 1: { // GAME_STATE
                    try {
                        const state = JSON.parse(jsonStr) as GameState;
                        console.log("[onmatchdata] GAME_STATE received:", state);
                        setGameState(state);
                        setTimerSeconds(state.timerSeconds);
                        setOpponentDisconnected(false);
                    } catch (e) {
                        console.error("[useGame] Failed to parse GAME_STATE:", e, jsonStr);
                    }
                    break;
                }
                case 3: { // GAME_OVER
                    try {
                        const info = JSON.parse(jsonStr) as GameOverInfo;
                        setGameOver(info);
                        setGameStatus("finished");
                    } catch (e) {
                        console.error("[useGame] Failed to parse GAME_OVER:", e);
                    }
                    break;
                }
                case 5: { // TIMER_TICK
                    try {
                        const tick = JSON.parse(jsonStr);
                        setTimerSeconds(tick.secondsRemaining);
                    } catch (_) { }
                    break;
                }
                case 6: { // OPPONENT_DISCONNECTED
                    console.warn("[useGame] Opponent disconnected");
                    setOpponentDisconnected(true);
                    break;
                }
                default:
                    console.warn("[onmatchdata] Unhandled opCode:", opCode);
            }
        };

        return () => {
            socket.onmatchmakermatched = null as any;
            socket.onmatchdata = null as any;
        };
    }, [socket]); // socket only — no other deps, handlers read state via refs

    // -------------------------------------------------------------------------
    // joinMatchmaking
    // -------------------------------------------------------------------------
    const joinMatchmaking = useCallback(
        async (mode: GameMode) => {
            if (!socket || !session) {
                console.error("[useGame] Cannot matchmake — not connected");
                return;
            }

            setGameStatus("matchmaking");
            setGameState(null);
            setGameOver(null);
            setOpponentDisconnected(false);

            try {
                const ticket = await socket.addMatchmaker(
                    "*", // query — match any player
                    2,   // min players
                    2,   // max players
                    { mode } // string properties sent to matchmakerMatched
                );
                ticketRef.current = ticket.ticket;
                console.log("[useGame] Matchmaking ticket:", ticket.ticket);
            } catch (err) {
                console.error("[useGame] Matchmaking error:", err);
                setGameStatus("idle");
            }
        },
        [socket, session]
    );

    // -------------------------------------------------------------------------
    // cancelMatchmaking
    // -------------------------------------------------------------------------
    const cancelMatchmaking = useCallback(async () => {
        if (!socket || !ticketRef.current) return;
        try {
            await socket.removeMatchmaker(ticketRef.current);
            ticketRef.current = null;
            setGameStatus("idle");
        } catch (err) {
            console.error("[useGame] Cancel matchmaking error:", err);
        }
    }, [socket]);

    // -------------------------------------------------------------------------
    // makeMove
    // -------------------------------------------------------------------------
    const makeMoveRef = useRef<{
        socket: Socket | null;
        matchId: string | null;
        gameState: GameState | null;
        userId: string | null;
    }>({ socket: null, matchId: null, gameState: null, userId: null });

    // Keep ref always up to date
    useEffect(() => {
        makeMoveRef.current = { socket, matchId, gameState, userId };
    }, [socket, matchId, gameState, userId]);

    const makeMove = useCallback((cellIndex: number) => {
        const { socket, matchId, gameState, userId } = makeMoveRef.current;

        if (!socket || !matchId || !gameState || !userId) {
            console.warn("[useGame] makeMove blocked: missing socket/matchId/gameState");
            return;
        }

        const isMyTurnNow = gameState.status === "playing" && gameState.currentTurn === userId;
        if (!isMyTurnNow) {
            console.warn("[useGame] makeMove blocked: not my turn", {
                currentTurn: gameState.currentTurn,
                userId
            });
            return;
        }

        const payload = JSON.stringify({ cellIndex });
        console.log("[useGame] Sending MAKE_MOVE cellIndex=", cellIndex);
        socket
            .sendMatchState(matchId, OpCode.MAKE_MOVE, payload)
            .catch((err) => console.error("[useGame] makeMove error:", err));
    }, []); // empty deps — reads from ref, always fresh

    // -------------------------------------------------------------------------
    // resetGame
    // -------------------------------------------------------------------------
    const resetGame = useCallback(async () => {
        if (socket && matchId) {
            try {
                await socket.leaveMatch(matchId);
            } catch (_) {
                // ignore
            }
        }
        setMatchId(null);
        setGameState(null);
        setGameOver(null);
        setGameStatus("idle");
        setTimerSeconds(30);
        setOpponentDisconnected(false);
        ticketRef.current = null;
    }, [socket, matchId]);

    // -------------------------------------------------------------------------
    // Cleanup on unmount
    // -------------------------------------------------------------------------
    useEffect(() => {
        return () => {
            if (socket && matchId) {
                socket.leaveMatch(matchId).catch(() => null);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        gameStatus,
        gameState,
        gameOver,
        matchId,
        mySymbol,
        isMyTurn,
        timerSeconds,
        opponentDisconnected,
        joinMatchmaking,
        cancelMatchmaking,
        makeMove,
        resetGame,
    };
}
