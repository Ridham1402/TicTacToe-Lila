import {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal,
} from "./tictactoe_match";
import { matchmakerMatched } from "./matchmaker";
import { rpcGetLeaderboard, createLeaderboard } from "./leaderboard";


function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    logger.info("TicTacToe InitModule starting...");
    void matchInit;
    void matchJoinAttempt;
    void matchJoin;
    void matchLeave;
    void matchLoop;
    void matchTerminate;
    void matchSignal;
    initializer.registerMatch("tictactoe", {
        matchInit: "matchInit",
        matchJoinAttempt: "matchJoinAttempt",
        matchJoin: "matchJoin",
        matchLeave: "matchLeave",
        matchLoop: "matchLoop",
        matchTerminate: "matchTerminate",
        matchSignal: "matchSignal",
    });
    logger.info("Registered match handler: tictactoe");
    initializer.registerMatchmakerMatched(matchmakerMatched);
    logger.info("Registered matchmakerMatched hook");
    initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
    logger.info("Registered RPC: get_leaderboard");
    createLeaderboard(ctx, logger, nk);
    logger.info("TicTacToe InitModule complete.");
}

(globalThis as any)["InitModule"] = InitModule;