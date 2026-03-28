/**
 * matchmaker.ts — Nakama matchmaker matched hook.
 *
 * When Nakama pairs two players via the matchmaker, this hook is triggered.
 * It creates an authoritative match and returns the match ID so both clients
 * can join the same room.
 *
 * The mode ("classic" | "timed") is encoded as a matchmaker query property
 * from the client-side matchmaking ticket.
 */

export function matchmakerMatched(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    matches: nkruntime.MatchmakerMatch[]
): string | void {
    logger.info(
        "matchmakerMatched: %d players matched",
        matches.length
    );

    // Determine game mode from the first match's properties
    // Client sends { mode: "classic" | "timed" } as matchmaker string properties
    const firstMatch = matches[0];
    const mode =
        (firstMatch?.properties?.["mode"] as string) ?? "classic";

    logger.info("matchmakerMatched: creating match with mode=%s", mode);

    // Create an authoritative match with mode encoded in params
    const matchId = nk.matchCreate("tictactoe", { mode });

    logger.info("matchmakerMatched: created match %s", matchId);

    // Return the match ID — Nakama sends this to both matched clients
    return matchId;
}
