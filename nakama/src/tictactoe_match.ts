/**
 * tictactoe_match.ts — Nakama authoritative match handler for TicTacToe.
 *
 * Architecture notes:
 *  - All game logic is server-side; clients only send move intents.
 *  - matchLoop runs at tick rate 10 (every 100ms).
 *  - Timer decrements every 10 ticks (1 second real-time).
 *  - Reconnect grace: 150 ticks = 15 seconds at tick rate 10.
 *  - recordResult is explicitly called before every GAME_OVER broadcast.
 */

import {
    OpCode,
    GameState,
    CellValue,
    MakeMovePayload,
    PlayerReadyPayload,
    GameStatePayload,
    GameOverPayload,
    TimerTickPayload,
    OpponentDisconnectedPayload,
} from "./types";
import { recordResult } from "./leaderboard";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TICK_RATE = 10;
const TIMER_SECONDS_DEFAULT = 30;
const RECONNECT_GRACE_TICKS = 150; // 15 seconds @ tick rate 10
const MAX_PLAYERS = 2;
const WINNING_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // rows
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // cols
    [0, 4, 8],
    [2, 4, 6], // diagonals
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkWinner(board: CellValue[]): string | null {
    for (const [a, b, c] of WINNING_LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a] as string; // "X" or "O"
        }
    }
    return null;
}

function isDraw(board: CellValue[]): boolean {
    return board.every((cell) => cell !== null);
}

function buildGameStatePayload(state: GameState): GameStatePayload {
    // Strip presence objects before sending over the wire
    const players: GameStatePayload["players"] = {};
    for (const [uid, info] of Object.entries(state.players)) {
        players[uid] = { symbol: info.symbol, username: info.username };
    }
    return {
        board: state.board,
        currentTurn: state.currentTurn,
        players,
        mode: state.mode,
        timerSeconds: state.timerSeconds,
        status: state.status,
        winner: state.winner,
        moveCount: state.moveCount,
    };
}

function buildGameOverPayload(
    state: GameState,
    reason: GameOverPayload["reason"]
): GameOverPayload {
    const players: GameOverPayload["players"] = {};
    for (const [uid, info] of Object.entries(state.players)) {
        players[uid] = { symbol: info.symbol, username: info.username };
    }
    return {
        winner: state.winner,
        board: state.board,
        players,
        reason,
    };
}

/**
 * Resolve winner/loser userIds from a finished game state.
 * Returns { winnerId, loserId, winnerName, loserName, isDraw }
 */
function resolveWinnerLoser(state: GameState): {
    winnerId: string | null;
    loserId: string | null;
    winnerName: string;
    loserName: string;
    isDraw: boolean;
} {
    const playerIds = Object.keys(state.players);

    if (state.winner === "draw" || state.winner === null || state.moveCount === 9) {
        return {
            winnerId: playerIds[0] ?? null,
            loserId: playerIds[1] ?? null,
            winnerName: state.players[playerIds[0]]?.username ?? "",
            loserName: state.players[playerIds[1]]?.username ?? "",
            isDraw: true,
        };
    }

    // winner is a symbol "X" or "O"
    const winnerId =
        playerIds.find((uid) => state.players[uid]?.symbol === state.winner) ?? null;
    const loserId = playerIds.find((uid) => uid !== winnerId) ?? null;

    return {
        winnerId,
        loserId,
        winnerName: winnerId ? (state.players[winnerId]?.username ?? "") : "",
        loserName: loserId ? (state.players[loserId]?.username ?? "") : "",
        isDraw: false,
    };
}

/**
 * Find the userId of the opponent of a given userId.
 */
function getOpponentId(state: GameState, userId: string): string | null {
    return Object.keys(state.players).find((uid) => uid !== userId) ?? null;
}

// ---------------------------------------------------------------------------
// matchInit
// ---------------------------------------------------------------------------

export function matchInit(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    params: { [key: string]: string }
): { state: GameState; tickRate: number; label: string } {
    const mode = params["mode"] ?? "classic";
    logger.info("matchInit: creating match mode=%s", mode);

    const state: GameState = {
        board: new Array(9).fill(null),
        currentTurn: "", // set when match starts
        players: {},
        mode: mode as GameMode,
        timerSeconds: TIMER_SECONDS_DEFAULT,
        status: "waiting",
        winner: null,
        moveCount: 0,
        reconnectGrace: {},
    };

    return {
        state,
        tickRate: TICK_RATE,
        label: JSON.stringify({ mode, status: "waiting" }),
    };
}

// ---------------------------------------------------------------------------
// matchJoinAttempt
// ---------------------------------------------------------------------------

export function matchJoinAttempt(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: GameState,
    presence: nkruntime.Presence,
    metadata: { [key: string]: any }
): { state: GameState; accept: boolean; rejectMessage?: string | undefined } | null {
    logger.debug("matchJoinAttempt: userId=%s tick=%d", presence.userId, tick);

    if (state.status === "finished") {
        return { state, accept: false, rejectMessage: "Game already finished" };
    }

    const playerCount = Object.keys(state.players).length;

    // Handle reconnection
    if (state.players[presence.userId]) {
        logger.info("matchJoinAttempt: reconnection by %s", presence.userId);
        return { state, accept: true }; // Allow reconnections
    }

    if (playerCount >= MAX_PLAYERS) {
        return { state, accept: false, rejectMessage: "Match is full" };
    }

    return { state, accept: true };
}

// ---------------------------------------------------------------------------
// matchJoin
// ---------------------------------------------------------------------------

export function matchJoin(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: GameState,
    presences: nkruntime.Presence[]
): { state: GameState } | null {
    for (const presence of presences) {
        logger.info("matchJoin: %s (%s)", presence.username, presence.userId);

        // Handle Reconnection
        if (state.players[presence.userId]) {
            state.players[presence.userId].presence = presence;
            state.reconnectGrace[presence.userId] = -1; // clear grace
            logger.info("Player %s reconnected", presence.userId);

            // Send them the current state immediately
            const payload = buildGameStatePayload(state);
            dispatcher.broadcastMessage(
                OpCode.GAME_STATE,
                JSON.stringify(payload),
                [presence]
            );
            continue;
        }

        // New Player
        const playerCount = Object.keys(state.players).length;
        const symbol: "X" | "O" = playerCount === 0 ? "X" : "O";

        state.players[presence.userId] = {
            symbol,
            username: presence.username || `Player ${playerCount + 1}`,
            presence,
        };
        state.reconnectGrace[presence.userId] = -1; // init no-grace

        logger.info(
            "Assigned symbol %s to %s",
            symbol,
            presence.username
        );
    }

    // Start match if we have 2 players and are waiting
    const playerIds = Object.keys(state.players);
    if (playerIds.length === MAX_PLAYERS && state.status === "waiting") {
        state.status = "playing";

        // X always goes first
        state.currentTurn = playerIds.find(uid => state.players[uid].symbol === "X") ?? playerIds[0];

        logger.info(
            "Match started! X=%s, O=%s, firstTurn=%s",
            playerIds.find(uid => state.players[uid].symbol === "X"),
            playerIds.find(uid => state.players[uid].symbol === "O"),
            state.currentTurn
        );

        // Update match label for observability
        dispatcher.matchLabelUpdate(
            JSON.stringify({ mode: state.mode, status: "playing" })
        );

        // Broadcast initial state to ALL players
        const payload = buildGameStatePayload(state);
        dispatcher.broadcastMessage(OpCode.GAME_STATE, JSON.stringify(payload), null);
    }

    return { state };
}

// ---------------------------------------------------------------------------
// matchLeave
// ---------------------------------------------------------------------------

export function matchLeave(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: GameState,
    presences: nkruntime.Presence[]
): { state: GameState } | null {
    for (const presence of presences) {
        logger.info("matchLeave: %s disconnected", presence.userId);

        if (state.status !== "playing") {
            // Safe to completely remove if game hasn't started or is already done
            delete state.players[presence.userId];
            delete state.reconnectGrace[presence.userId];
            continue;
        }

        // Mark disconnected, start grace period
        state.reconnectGrace[presence.userId] = RECONNECT_GRACE_TICKS;

        // Notify opponent
        const disconnectedPayload: OpponentDisconnectedPayload = {
            disconnectedUserId: presence.userId,
            gracePeriodSeconds: RECONNECT_GRACE_TICKS / TICK_RATE
        };
        dispatcher.broadcastMessage(
            OpCode.OPPONENT_DISCONNECTED,
            JSON.stringify(disconnectedPayload),
            null
        );
    }

    return { state };
}

// ---------------------------------------------------------------------------
// matchLoop
// ---------------------------------------------------------------------------

export function matchLoop(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: GameState,
    messages: nkruntime.MatchMessage[]
): { state: GameState } | null {
    // Terminate empty inactive match to save resources
    if (state.status === "waiting" && Object.keys(state.players).length === 0 && tick > TICK_RATE * 30) {
        logger.info("matchLoop: terminating empty waiting match");
        return null; // returning null terminates the match
    }

    if (state.status === "finished") {
        return null;
    }

    // 1. Process Reconnection Graces
    if (state.status === "playing") {
        for (const [uid, graceTicks] of Object.entries(state.reconnectGrace)) {
            if (graceTicks < 0) continue; // active player

            const newGrace = graceTicks - 1;
            state.reconnectGrace[uid] = newGrace;

            if (newGrace <= 0) {
                // Grace expired -> Forfeit
                logger.info("Reconnect grace expired for %s — forfeit", uid);

                const opponentId = getOpponentId(state, uid);
                const disconnectedName = state.players[uid]?.username ?? "Unknown";
                const opponentName = opponentId ? (state.players[opponentId]?.username ?? "Unknown") : "Unknown";

                state.winner = opponentId ? (state.players[opponentId]?.symbol ?? null) : null;
                state.status = "finished";

                // Save result
                recordResult(
                    nk,
                    logger,
                    opponentId, // winner userId
                    uid,        // loser userId
                    opponentName,
                    disconnectedName,
                    false
                );

                const gameOverPayload = buildGameOverPayload(state, "disconnect");
                dispatcher.broadcastMessage(
                    OpCode.GAME_OVER,
                    JSON.stringify(gameOverPayload),
                    null
                );

                logger.info(
                    "GAME_OVER (disconnect forfeit): winner=%s loser=%s",
                    opponentId,
                    uid
                );
                return { state };
            }
        }
    }

    // 2. Process Incoming Messages
    for (const msg of messages) {
        const senderId = msg.sender.userId;

        switch (msg.opCode) {
            case OpCode.PLAYER_READY: {
                if (state.status === "waiting") {
                    try {
                        const data = JSON.parse(
                            nk.binaryToString(msg.data)
                        ) as PlayerReadyPayload;
                        state.mode = data.mode ?? state.mode;
                        logger.debug("PLAYER_READY: mode set to %s by %s", state.mode, senderId);
                    } catch (_) {
                        // ignore malformed
                    }
                }
                break;
            }

            case OpCode.MAKE_MOVE: {
                if (state.status !== "playing") {
                    logger.warn("MAKE_MOVE rejected: game not in playing state (status=%s)", state.status);
                    break;
                }

                if (senderId !== state.currentTurn) {
                    logger.warn(
                        "MAKE_MOVE rejected: not player's turn (sender=%s currentTurn=%s)",
                        senderId,
                        state.currentTurn
                    );
                    break;
                }

                let payload: MakeMovePayload;
                try {
                    payload = JSON.parse(
                        nk.binaryToString(msg.data)
                    ) as MakeMovePayload;
                } catch (_) {
                    logger.warn("MAKE_MOVE rejected: malformed payload from %s", senderId);
                    break;
                }

                const { cellIndex } = payload;
                if (typeof cellIndex !== "number" || cellIndex < 0 || cellIndex > 8 || state.board[cellIndex] !== null) {
                    logger.warn(
                        "MAKE_MOVE rejected: invalid cell %d (already occupied or out of range)",
                        cellIndex
                    );
                    break;
                }

                // Apply Move
                const playerInfo = state.players[senderId];
                state.board[cellIndex] = playerInfo.symbol;
                state.moveCount++;
                state.timerSeconds = TIMER_SECONDS_DEFAULT; // reset timer

                logger.info(
                    "MAKE_MOVE: %s played %s at cell %d (move #%d)",
                    playerInfo.username,
                    playerInfo.symbol,
                    cellIndex,
                    state.moveCount
                );

                // Check Win
                const winningSymbol = checkWinner(state.board);
                if (winningSymbol) {
                    state.winner = winningSymbol;
                    state.status = "finished";

                    const { winnerId, loserId, winnerName, loserName } = resolveWinnerLoser(state);
                    recordResult(nk, logger, winnerId, loserId, winnerName, loserName, false);

                    const gameOverPayload = buildGameOverPayload(state, "normal");
                    dispatcher.broadcastMessage(
                        OpCode.GAME_OVER,
                        JSON.stringify(gameOverPayload),
                        null
                    );
                    logger.info("GAME_OVER (win): winner symbol=%s", winningSymbol);
                    break;
                }

                // Check Draw
                if (isDraw(state.board)) {
                    state.winner = "draw";
                    state.status = "finished";

                    const { winnerId, loserId, winnerName, loserName } = resolveWinnerLoser(state);
                    recordResult(nk, logger, winnerId, loserId, winnerName, loserName, true);

                    const gameOverPayload = buildGameOverPayload(state, "normal");
                    dispatcher.broadcastMessage(
                        OpCode.GAME_OVER,
                        JSON.stringify(gameOverPayload),
                        null
                    );
                    logger.info("GAME_OVER (draw)");
                    break;
                }

                // Next Turn
                const opponentId = getOpponentId(state, senderId);
                state.currentTurn = opponentId ?? senderId;

                // Broadcast New State
                const gameStatePayload = buildGameStatePayload(state);
                dispatcher.broadcastMessage(
                    OpCode.GAME_STATE,
                    JSON.stringify(gameStatePayload),
                    null
                );

                break;
            }

            default:
                logger.warn("matchLoop: unknown opCode %d from %s", msg.opCode, senderId);
        }
    }

    // 3. Process Timer (if Timed Mode)
    if (state.status === "playing" && state.mode === "timed") {
        if (tick % TICK_RATE === 0 && tick > 0) { // Every 1 second
            state.timerSeconds = Math.max(0, state.timerSeconds - 1);

            const timerPayload: TimerTickPayload = {
                secondsRemaining: state.timerSeconds,
                currentTurn: state.currentTurn
            };
            dispatcher.broadcastMessage(
                OpCode.TIMER_TICK,
                JSON.stringify(timerPayload),
                null
            );

            // Timeout check
            if (state.timerSeconds <= 0) {
                const forfeitedId = state.currentTurn;
                const opponentId = getOpponentId(state, forfeitedId);
                const forfeitedName = state.players[forfeitedId]?.username ?? "Unknown";
                const opponentName = opponentId ? (state.players[opponentId]?.username ?? "Unknown") : "Unknown";

                state.winner = opponentId ? (state.players[opponentId]?.symbol ?? null) : null;
                state.status = "finished";

                logger.info(
                    "Timeout forfeit: %s timed out, winner=%s",
                    forfeitedId,
                    opponentId
                );

                // Save result
                recordResult(
                    nk,
                    logger,
                    opponentId, // winner
                    forfeitedId, // loser (timed out)
                    opponentName,
                    forfeitedName,
                    false
                );

                const gameOverPayload = buildGameOverPayload(state, "timeout");
                dispatcher.broadcastMessage(
                    OpCode.GAME_OVER,
                    JSON.stringify(gameOverPayload),
                    null
                );
            }
        }
    }

    return { state };
}

// ---------------------------------------------------------------------------
// matchTerminate
// ---------------------------------------------------------------------------

export function matchTerminate(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: GameState,
    graceSeconds: number
): { state: GameState } | null {
    logger.info("matchTerminate: match ending (graceSeconds=%d)", graceSeconds);
    return { state };
}

// ---------------------------------------------------------------------------
// matchSignal (required by interface but unused)
// ---------------------------------------------------------------------------

export function matchSignal(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: GameState,
    data: string
): { state: GameState; data?: string | undefined } | null {
    logger.debug("matchSignal received: %s", data);
    return { state };
}


