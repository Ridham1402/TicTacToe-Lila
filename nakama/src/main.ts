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

let InitModule: nkruntime.InitModule = function(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    initializer: nkruntime.Initializer
) {
    logger.info("TicTacToe InitModule starting...");
    initializer.registerMatch("tictactoe", {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal,
    });

    logger.info("Registered match handler: tictactoe");
    initializer.registerMatchmakerMatched(matchmakerMatched);
    logger.info("Registered matchmakerMatched hook");
    initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
    logger.info("Registered RPC: get_leaderboard");
    createLeaderboard(ctx, logger, nk);
    logger.info("TicTacToe InitModule complete.");
};

// Reference InitModule to avoid it getting removed on build
!InitModule && InitModule.bind(null);