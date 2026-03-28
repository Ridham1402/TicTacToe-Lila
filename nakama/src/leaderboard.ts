/**
 * leaderboard.ts — Leaderboard creation, RPC handler, and result recording.
 *
 * Uses Nakama's built-in leaderboard API backed by PostgreSQL.
 * Leaderboard scoring:
 *   - Win  → +3 pts, increments win subscore
 *   - Loss → +0 pts (score unchanged), increments loss subscore
 *   - Wins streak tracked via metadata
 */

import { OpCode } from "./types";

export const LEADERBOARD_ID = "tictactoe_global";

// ---------------------------------------------------------------------------
// Leaderboard initialisation (called once from InitModule)
// ---------------------------------------------------------------------------

/**
 * createLeaderboard — creates the global leaderboard if it doesn't exist yet.
 * Descending sort (highest score first), no reset schedule (all-time).
 */
export function createLeaderboard(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama
): void {
    try {
        nk.leaderboardCreate(
            LEADERBOARD_ID,
            false,      // not authoritative (any server code can write)
            "desc",     // sort order
            "incr",     // operator — scores are incremented, not replaced
            "0 0 1 1 *" // reset: never (cron that never fires in practice; use "" for no reset)
        );
        logger.info("Leaderboard '%s' created/verified.", LEADERBOARD_ID);
    } catch (e) {
        // Leaderboard may already exist — that's fine
        logger.debug("Leaderboard create skipped (may already exist): %s", String(e));
    }
}

// ---------------------------------------------------------------------------
// RPC: get_leaderboard
// ---------------------------------------------------------------------------

/**
 * getLeaderboard RPC — callable from the frontend via client.rpc().
 * Returns top-50 entries with wins, losses, streak, score.
 *
 * Payload: {} (no input needed)
 * Response: JSON array of LeaderboardRecord
 */
export function rpcGetLeaderboard(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string {
    logger.debug("rpcGetLeaderboard called by userId=%s", ctx.userId);

    let records: nkruntime.LeaderboardRecord[] = [];
    try {
        const result = nk.leaderboardRecordsList(
            LEADERBOARD_ID,
            [],       // ownerIds (empty = don't filter by owner)
            50,       // limit
            "",       // cursor
            0         // expiry (0 = current period)
        );
        records = result.records || [];
    } catch (e) {
        logger.error("Failed to list leaderboard records: %s", String(e));
        return JSON.stringify({ error: "Failed to fetch leaderboard" });
    }

    // Parse metadata fields (wins, losses, streak) stored as JSON metadata
    const entries = records.map((r, idx) => {
        let wins = 0;
        let losses = 0;
        let streak = 0;
        if (r.metadata) {
            try {
                const meta = JSON.parse(r.metadata);
                wins = meta.wins ?? 0;
                losses = meta.losses ?? 0;
                streak = meta.streak ?? 0;
            } catch (_) {
                // ignore malformed metadata
            }
        }
        return {
            rank: r.rank ?? idx + 1,
            userId: r.ownerId,
            username: r.username || "Anonymous",
            wins,
            losses,
            streak,
            score: r.score,
        };
    });

    return JSON.stringify(entries);
}

// ---------------------------------------------------------------------------
// recordResult — called from matchLoop after every game-over event
// ---------------------------------------------------------------------------

/**
 * recordResult — writes updated scores to the leaderboard for both players.
 *
 * @param nk         Nakama runtime handle
 * @param logger     Logger
 * @param winnerId   userId of the winner, or null for a draw
 * @param loserId    userId of the loser, or null for a draw
 * @param winnerName Display name of the winner
 * @param loserName  Display name of the loser
 * @param isDraw     True if the game ended in a draw
 */
export function recordResult(
    nk: nkruntime.Nakama,
    logger: nkruntime.Logger,
    winnerId: string | null,
    loserId: string | null,
    winnerName: string,
    loserName: string,
    isDraw: boolean
): void {
    if (isDraw) {
        // Draws: no score change, but record participation in metadata
        [winnerId, loserId].forEach((uid, idx) => {
            if (!uid) return;
            const name = idx === 0 ? winnerName : loserName;
            try {
                // Fetch existing metadata to preserve wins/losses/streak
                const existing = fetchPlayerMeta(nk, uid);
                const meta = JSON.stringify({
                    wins: existing.wins,
                    losses: existing.losses,
                    streak: 0, // draw resets streak
                });
                nk.leaderboardRecordWrite(LEADERBOARD_ID, uid, name, 0, 0, meta);
            } catch (e) {
                logger.error("recordResult (draw) failed for %s: %s", uid, String(e));
            }
        });
        return;
    }

    // Winner: +3 score points, increment wins, extend streak
    if (winnerId) {
        try {
            const existing = fetchPlayerMeta(nk, winnerId);
            const newStreak = existing.streak + 1;
            const meta = JSON.stringify({
                wins: existing.wins + 1,
                losses: existing.losses,
                streak: newStreak,
            });
            nk.leaderboardRecordWrite(LEADERBOARD_ID, winnerId, winnerName, 3, 0, meta);
            logger.info("Leaderboard: win recorded for %s (streak=%d)", winnerName, newStreak);
        } catch (e) {
            logger.error("recordResult (winner) failed for %s: %s", winnerId, String(e));
        }
    }

    // Loser: no score points, increment losses, reset streak
    if (loserId) {
        try {
            const existing = fetchPlayerMeta(nk, loserId);
            const meta = JSON.stringify({
                wins: existing.wins,
                losses: existing.losses + 1,
                streak: 0,
            });
            nk.leaderboardRecordWrite(LEADERBOARD_ID, loserId, loserName, 0, 0, meta);
            logger.info("Leaderboard: loss recorded for %s", loserName);
        } catch (e) {
            logger.error("recordResult (loser) failed for %s: %s", loserId, String(e));
        }
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface PlayerMeta {
    wins: number;
    losses: number;
    streak: number;
}

function fetchPlayerMeta(nk: nkruntime.Nakama, userId: string): PlayerMeta {
    const defaults: PlayerMeta = { wins: 0, losses: 0, streak: 0 };
    try {
        const result = nk.leaderboardRecordsList(
            LEADERBOARD_ID,
            [userId],
            1,
            "",
            0
        );
        const record = (result.records || [])[0];
        if (record && record.metadata) {
            const meta = JSON.parse(record.metadata);
            return {
                wins: meta.wins ?? 0,
                losses: meta.losses ?? 0,
                streak: meta.streak ?? 0,
            };
        }
    } catch (_) {
        // no existing record — use defaults
    }
    return defaults;
}
