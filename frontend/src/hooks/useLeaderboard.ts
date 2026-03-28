/**
 * useLeaderboard.ts — Fetches the global leaderboard via Nakama RPC.
 *
 * Calls the `get_leaderboard` RPC registered in nakama/src/leaderboard.ts.
 * Returns top-50 entries with rank, username, wins, losses, streak, score.
 */

import { useState, useCallback } from "react";
import { Session } from "@heroiclabs/nakama-js";
import { client } from "../lib/nakamaClient";

export interface LeaderboardRecord {
    rank: number;
    userId: string;
    username: string;
    wins: number;
    losses: number;
    streak: number;
    score: number;
}

export interface UseLeaderboardReturn {
    records: LeaderboardRecord[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useLeaderboard(session: Session | null): UseLeaderboardReturn {
    const [records, setRecords] = useState<LeaderboardRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!session) {
            setError("Not authenticated");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await client.rpc(session, "get_leaderboard", {});
            // Nakama RPC response payload is a JSON string in response.payload
            const payload =
                typeof response.payload === "string"
                    ? JSON.parse(response.payload)
                    : response.payload;

            if (Array.isArray(payload)) {
                setRecords(payload as LeaderboardRecord[]);
            } else if (payload?.error) {
                setError(payload.error);
            } else {
                setRecords([]);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to load leaderboard";
            setError(msg);
            console.error("[useLeaderboard] RPC error:", err);
        } finally {
            setLoading(false);
        }
    }, [session]);

    return { records, loading, error, refresh };
}
