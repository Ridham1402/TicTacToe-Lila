/**
 * types.ts — Shared type definitions for the Nakama TicTacToe module.
 *
 * IMPORTANT: Nakama's JS runtime uses global nkruntime types — do NOT import
 * anything from npm at runtime. This file is types-only and tree-shaken out.
 */

// ---------------------------------------------------------------------------
// Op Codes (client ↔ server message types)
// ---------------------------------------------------------------------------

export const OpCode = {
    /** Server → Clients: full authoritative game state */
    GAME_STATE: 1,
    /** Client → Server: player makes a move */
    MAKE_MOVE: 2,
    /** Server → Clients: game has ended, includes winner info */
    GAME_OVER: 3,
    /** Client → Server: player signals they are ready */
    PLAYER_READY: 4,
    /** Server → Clients: remaining seconds for current turn */
    TIMER_TICK: 5,
    /** Server → Clients: an opponent disconnected */
    OPPONENT_DISCONNECTED: 6,
} as const;

export type OpCodeValue = (typeof OpCode)[keyof typeof OpCode];

// ---------------------------------------------------------------------------
// Game entities
// ---------------------------------------------------------------------------

export type CellValue = "X" | "O" | null;
export type GameMode = "classic" | "timed";
export type GameStatus = "waiting" | "playing" | "finished";

export interface PlayerInfo {
    symbol: "X" | "O";
    username: string;
    presence: nkruntime.Presence;
}

/**
 * Full server-side game state.
 * Stored as the match state object between ticks.
 */
export interface GameState {
    /** 9-element board, index 0–8 (row-major) */
    board: CellValue[];
    /** userId whose turn it currently is */
    currentTurn: string;
    /** Map from userId → PlayerInfo */
    players: { [userId: string]: PlayerInfo };
    mode: GameMode;
    /** Remaining seconds for current turn (timed mode only) */
    timerSeconds: number;
    status: GameStatus;
    /** userId, "draw", or null */
    winner: string | null;
    moveCount: number;
    /**
     * Reconnect grace tracking.
     * Maps userId → remaining grace ticks (150 ticks = 15 seconds at tick rate 10).
     * A value of -1 means the player is connected.
     */
    reconnectGrace: { [userId: string]: number };
}

// ---------------------------------------------------------------------------
// Message payloads (serialised as JSON over the wire)
// ---------------------------------------------------------------------------

export interface MakeMovePayload {
    cellIndex: number; // 0–8
}

export interface PlayerReadyPayload {
    mode: GameMode;
}

export interface GameStatePayload {
    board: CellValue[];
    currentTurn: string;
    players: {
        [userId: string]: {
            symbol: "X" | "O";
            username: string;
        };
    };
    mode: GameMode;
    timerSeconds: number;
    status: GameStatus;
    winner: string | null;
    moveCount: number;
}

export interface GameOverPayload {
    winner: string | null; // userId, "draw", or null
    board: CellValue[];
    players: {
        [userId: string]: {
            symbol: "X" | "O";
            username: string;
        };
    };
    reason: "normal" | "timeout" | "disconnect";
}

export interface TimerTickPayload {
    secondsRemaining: number;
    currentTurn: string;
}

export interface OpponentDisconnectedPayload {
    disconnectedUserId: string;
    gracePeriodSeconds: number;
}

// ---------------------------------------------------------------------------
// Leaderboard record shape returned from get_leaderboard RPC
// ---------------------------------------------------------------------------

export interface LeaderboardRecord {
    rank: number;
    userId: string;
    username: string;
    wins: number;
    losses: number;
    streak: number;
    score: number;
}
