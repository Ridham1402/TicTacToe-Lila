
// src/types.ts
var OpCode = {
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
  OPPONENT_DISCONNECTED: 6
};

// src/leaderboard.ts
var LEADERBOARD_ID = "tictactoe_global";
function createLeaderboard(ctx, logger, nk) {
  try {
    nk.leaderboardCreate(
      LEADERBOARD_ID,
      false,
      // not authoritative (any server code can write)
      "desc",
      // sort order
      "incr",
      // operator — scores are incremented, not replaced
      "0 0 1 1 *"
      // reset: never (cron that never fires in practice; use "" for no reset)
    );
    logger.info("Leaderboard '%s' created/verified.", LEADERBOARD_ID);
  } catch (e) {
    logger.debug("Leaderboard create skipped (may already exist): %s", String(e));
  }
}
function rpcGetLeaderboard(ctx, logger, nk, payload) {
  logger.debug("rpcGetLeaderboard called by userId=%s", ctx.userId);
  let records = [];
  try {
    const result = nk.leaderboardRecordsList(
      LEADERBOARD_ID,
      [],
      // ownerIds (empty = don't filter by owner)
      50,
      // limit
      "",
      // cursor
      0
      // expiry (0 = current period)
    );
    records = result.records || [];
  } catch (e) {
    logger.error("Failed to list leaderboard records: %s", String(e));
    return JSON.stringify({ error: "Failed to fetch leaderboard" });
  }
  const entries = records.map((r, idx) => {
    var _a, _b, _c, _d;
    let wins = 0;
    let losses = 0;
    let streak = 0;
    if (r.metadata) {
      try {
        const meta = JSON.parse(r.metadata);
        wins = (_a = meta.wins) != null ? _a : 0;
        losses = (_b = meta.losses) != null ? _b : 0;
        streak = (_c = meta.streak) != null ? _c : 0;
      } catch (_) {
      }
    }
    return {
      rank: (_d = r.rank) != null ? _d : idx + 1,
      userId: r.ownerId,
      username: r.username || "Anonymous",
      wins,
      losses,
      streak,
      score: r.score
    };
  });
  return JSON.stringify(entries);
}
function recordResult(nk, logger, winnerId, loserId, winnerName, loserName, isDraw2) {
  if (isDraw2) {
    [winnerId, loserId].forEach((uid, idx) => {
      if (!uid)
        return;
      const name = idx === 0 ? winnerName : loserName;
      try {
        const existing = fetchPlayerMeta(nk, uid);
        const meta = JSON.stringify({
          wins: existing.wins,
          losses: existing.losses,
          streak: 0
          // draw resets streak
        });
        nk.leaderboardRecordWrite(LEADERBOARD_ID, uid, name, 0, 0, meta);
      } catch (e) {
        logger.error("recordResult (draw) failed for %s: %s", uid, String(e));
      }
    });
    return;
  }
  if (winnerId) {
    try {
      const existing = fetchPlayerMeta(nk, winnerId);
      const newStreak = existing.streak + 1;
      const meta = JSON.stringify({
        wins: existing.wins + 1,
        losses: existing.losses,
        streak: newStreak
      });
      nk.leaderboardRecordWrite(LEADERBOARD_ID, winnerId, winnerName, 3, 0, meta);
      logger.info("Leaderboard: win recorded for %s (streak=%d)", winnerName, newStreak);
    } catch (e) {
      logger.error("recordResult (winner) failed for %s: %s", winnerId, String(e));
    }
  }
  if (loserId) {
    try {
      const existing = fetchPlayerMeta(nk, loserId);
      const meta = JSON.stringify({
        wins: existing.wins,
        losses: existing.losses + 1,
        streak: 0
      });
      nk.leaderboardRecordWrite(LEADERBOARD_ID, loserId, loserName, 0, 0, meta);
      logger.info("Leaderboard: loss recorded for %s", loserName);
    } catch (e) {
      logger.error("recordResult (loser) failed for %s: %s", loserId, String(e));
    }
  }
}
function fetchPlayerMeta(nk, userId) {
  var _a, _b, _c;
  const defaults = { wins: 0, losses: 0, streak: 0 };
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
        wins: (_a = meta.wins) != null ? _a : 0,
        losses: (_b = meta.losses) != null ? _b : 0,
        streak: (_c = meta.streak) != null ? _c : 0
      };
    }
  } catch (_) {
  }
  return defaults;
}

// src/tictactoe_match.ts
var TICK_RATE = 10;
var TIMER_SECONDS_DEFAULT = 30;
var RECONNECT_GRACE_TICKS = 150;
var MAX_PLAYERS = 2;
var WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // cols
  [0, 4, 8],
  [2, 4, 6]
  // diagonals
];
function checkWinner(board) {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}
function isDraw(board) {
  return board.every((cell) => cell !== null);
}
function buildGameStatePayload(state) {
  const players = {};
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
    moveCount: state.moveCount
  };
}
function buildGameOverPayload(state, reason) {
  const players = {};
  for (const [uid, info] of Object.entries(state.players)) {
    players[uid] = { symbol: info.symbol, username: info.username };
  }
  return {
    winner: state.winner,
    board: state.board,
    players,
    reason
  };
}
function resolveWinnerLoser(state) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
  const playerIds = Object.keys(state.players);
  if (state.winner === "draw" || state.winner === null || state.moveCount === 9) {
    return {
      winnerId: (_a = playerIds[0]) != null ? _a : null,
      loserId: (_b = playerIds[1]) != null ? _b : null,
      winnerName: (_d = (_c = state.players[playerIds[0]]) == null ? void 0 : _c.username) != null ? _d : "",
      loserName: (_f = (_e = state.players[playerIds[1]]) == null ? void 0 : _e.username) != null ? _f : "",
      isDraw: true
    };
  }
  const winnerId = (_g = playerIds.find((uid) => {
    var _a2;
    return ((_a2 = state.players[uid]) == null ? void 0 : _a2.symbol) === state.winner;
  })) != null ? _g : null;
  const loserId = (_h = playerIds.find((uid) => uid !== winnerId)) != null ? _h : null;
  return {
    winnerId,
    loserId,
    winnerName: winnerId ? (_j = (_i = state.players[winnerId]) == null ? void 0 : _i.username) != null ? _j : "" : "",
    loserName: loserId ? (_l = (_k = state.players[loserId]) == null ? void 0 : _k.username) != null ? _l : "" : "",
    isDraw: false
  };
}
function getOpponentId(state, userId) {
  var _a;
  return (_a = Object.keys(state.players).find((uid) => uid !== userId)) != null ? _a : null;
}
function matchInit(ctx, logger, nk, params) {
  var _a;
  const mode = (_a = params["mode"]) != null ? _a : "classic";
  logger.info("matchInit: creating match mode=%s", mode);
  const state = {
    board: new Array(9).fill(null),
    currentTurn: "",
    // set when match starts
    players: {},
    mode,
    timerSeconds: TIMER_SECONDS_DEFAULT,
    status: "waiting",
    winner: null,
    moveCount: 0,
    reconnectGrace: {}
  };
  return {
    state,
    tickRate: TICK_RATE,
    label: JSON.stringify({ mode, status: "waiting" })
  };
}
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  logger.debug("matchJoinAttempt: userId=%s tick=%d", presence.userId, tick);
  if (state.status === "finished") {
    return { state, accept: false, rejectMessage: "Game already finished" };
  }
  const playerCount = Object.keys(state.players).length;
  if (state.players[presence.userId]) {
    logger.info("matchJoinAttempt: reconnection by %s", presence.userId);
    return { state, accept: true };
  }
  if (playerCount >= MAX_PLAYERS) {
    return { state, accept: false, rejectMessage: "Match is full" };
  }
  return { state, accept: true };
}
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  var _a;
  for (const presence of presences) {
    logger.info("matchJoin: %s (%s)", presence.username, presence.userId);
    if (state.players[presence.userId]) {
      state.players[presence.userId].presence = presence;
      state.reconnectGrace[presence.userId] = -1;
      logger.info("Player %s reconnected", presence.userId);
      const payload = buildGameStatePayload(state);
      dispatcher.broadcastMessage(
        OpCode.GAME_STATE,
        JSON.stringify(payload),
        [presence]
      );
      continue;
    }
    const playerCount = Object.keys(state.players).length;
    const symbol = playerCount === 0 ? "X" : "O";
    state.players[presence.userId] = {
      symbol,
      username: presence.username || `Player ${playerCount + 1}`,
      presence
    };
    state.reconnectGrace[presence.userId] = -1;
    logger.info(
      "Assigned symbol %s to %s",
      symbol,
      presence.username
    );
  }
  const playerIds = Object.keys(state.players);
  if (playerIds.length === MAX_PLAYERS && state.status === "waiting") {
    state.status = "playing";
    state.currentTurn = (_a = playerIds.find((uid) => state.players[uid].symbol === "X")) != null ? _a : playerIds[0];
    logger.info(
      "Match started! X=%s, O=%s, firstTurn=%s",
      playerIds.find((uid) => state.players[uid].symbol === "X"),
      playerIds.find((uid) => state.players[uid].symbol === "O"),
      state.currentTurn
    );
    dispatcher.matchLabelUpdate(
      JSON.stringify({ mode: state.mode, status: "playing" })
    );
    const payload = buildGameStatePayload(state);
    dispatcher.broadcastMessage(OpCode.GAME_STATE, JSON.stringify(payload), null);
  }
  return { state };
}
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (const presence of presences) {
    logger.info("matchLeave: %s disconnected", presence.userId);
    if (state.status !== "playing") {
      delete state.players[presence.userId];
      delete state.reconnectGrace[presence.userId];
      continue;
    }
    state.reconnectGrace[presence.userId] = RECONNECT_GRACE_TICKS;
    const disconnectedPayload = {
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
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
  if (state.status === "waiting" && Object.keys(state.players).length === 0 && tick > TICK_RATE * 30) {
    logger.info("matchLoop: terminating empty waiting match");
    return null;
  }
  if (state.status === "finished") {
    return null;
  }
  if (state.status === "playing") {
    for (const [uid, graceTicks] of Object.entries(state.reconnectGrace)) {
      if (graceTicks < 0)
        continue;
      const newGrace = graceTicks - 1;
      state.reconnectGrace[uid] = newGrace;
      if (newGrace <= 0) {
        logger.info("Reconnect grace expired for %s \u2014 forfeit", uid);
        const opponentId = getOpponentId(state, uid);
        const disconnectedName = (_b = (_a = state.players[uid]) == null ? void 0 : _a.username) != null ? _b : "Unknown";
        const opponentName = opponentId ? (_d = (_c = state.players[opponentId]) == null ? void 0 : _c.username) != null ? _d : "Unknown" : "Unknown";
        state.winner = opponentId ? (_f = (_e = state.players[opponentId]) == null ? void 0 : _e.symbol) != null ? _f : null : null;
        state.status = "finished";
        recordResult(
          nk,
          logger,
          opponentId,
          // winner userId
          uid,
          // loser userId
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
  for (const msg of messages) {
    const senderId = msg.sender.userId;
    switch (msg.opCode) {
      case OpCode.PLAYER_READY: {
        if (state.status === "waiting") {
          try {
            const data = JSON.parse(
              msg.data
            );
            state.mode = (_g = data.mode) != null ? _g : state.mode;
            logger.debug("PLAYER_READY: mode set to %s by %s", state.mode, senderId);
          } catch (_) {
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
        let payload;
        try {
          payload = JSON.parse(
            msg.data
          );
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
        const playerInfo = state.players[senderId];
        state.board[cellIndex] = playerInfo.symbol;
        state.moveCount++;
        state.timerSeconds = TIMER_SECONDS_DEFAULT;
        logger.info(
          "MAKE_MOVE: %s played %s at cell %d (move #%d)",
          playerInfo.username,
          playerInfo.symbol,
          cellIndex,
          state.moveCount
        );
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
        const opponentId = getOpponentId(state, senderId);
        state.currentTurn = opponentId != null ? opponentId : senderId;
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
  if (state.status === "playing" && state.mode === "timed") {
    if (tick % TICK_RATE === 0 && tick > 0) {
      state.timerSeconds = Math.max(0, state.timerSeconds - 1);
      const timerPayload = {
        secondsRemaining: state.timerSeconds,
        currentTurn: state.currentTurn
      };
      dispatcher.broadcastMessage(
        OpCode.TIMER_TICK,
        JSON.stringify(timerPayload),
        null
      );
      if (state.timerSeconds <= 0) {
        const forfeitedId = state.currentTurn;
        const opponentId = getOpponentId(state, forfeitedId);
        const forfeitedName = (_i = (_h = state.players[forfeitedId]) == null ? void 0 : _h.username) != null ? _i : "Unknown";
        const opponentName = opponentId ? (_k = (_j = state.players[opponentId]) == null ? void 0 : _j.username) != null ? _k : "Unknown" : "Unknown";
        state.winner = opponentId ? (_m = (_l = state.players[opponentId]) == null ? void 0 : _l.symbol) != null ? _m : null : null;
        state.status = "finished";
        logger.info(
          "Timeout forfeit: %s timed out, winner=%s",
          forfeitedId,
          opponentId
        );
        recordResult(
          nk,
          logger,
          opponentId,
          // winner
          forfeitedId,
          // loser (timed out)
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
function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  logger.info("matchTerminate: match ending (graceSeconds=%d)", graceSeconds);
  return { state };
}
function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  logger.debug("matchSignal received: %s", data);
  return { state };
}

// src/matchmaker.ts
function matchmakerMatched(ctx, logger, nk, matches) {
  var _a, _b;
  logger.info(
    "matchmakerMatched: %d players matched",
    matches.length
  );
  const firstMatch = matches[0];
  const mode = (_b = (_a = firstMatch == null ? void 0 : firstMatch.properties) == null ? void 0 : _a["mode"]) != null ? _b : "classic";
  logger.info("matchmakerMatched: creating match with mode=%s", mode);
  const matchId = nk.matchCreate("tictactoe", { mode });
  logger.info("matchmakerMatched: created match %s", matchId);
  return matchId;
}

// src/main.ts
function InitModule(ctx, logger, nk, initializer) {
  logger.info("TicTacToe InitModule starting...");
  initializer.registerMatch("tictactoe", {
    matchInit: "matchInit",
    matchJoinAttempt: "matchJoinAttempt",
    matchJoin: "matchJoin",
    matchLeave: "matchLeave",
    matchLoop: "matchLoop",
    matchTerminate: "matchTerminate",
    matchSignal: "matchSignal"
  });
  logger.info("Registered match handler: tictactoe");
  initializer.registerMatchmakerMatched(matchmakerMatched);
  logger.info("Registered matchmakerMatched hook");
  initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
  logger.info("Registered RPC: get_leaderboard");
  createLeaderboard(ctx, logger, nk);
  logger.info("TicTacToe InitModule complete.");
}
globalThis["InitModule"] = InitModule;
