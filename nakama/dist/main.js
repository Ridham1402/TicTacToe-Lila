var OpCode = { GAME_STATE: 1, MAKE_MOVE: 2, GAME_OVER: 3, PLAYER_READY: 4, TIMER_TICK: 5, OPPONENT_DISCONNECTED: 6 };
var LEADERBOARD_ID = "tictactoe_global";
var TICK_RATE = 10;
var TIMER_SECONDS_DEFAULT = 30;
var RECONNECT_GRACE_TICKS = 150;
var MAX_PLAYERS = 2;
var WINNING_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

var decodeData = function (data) {
  if (typeof data === "string") return data;
  try {
    var bytes = new Uint8Array(data);
    var result = "";
    for (var i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i]);
    }
    return result;
  } catch (_) { }
  return String(data);
};

var checkWinner = function (board) {
  for (var i = 0; i < WINNING_LINES.length; i++) { var l = WINNING_LINES[i]; if (board[l[0]] && board[l[0]] === board[l[1]] && board[l[0]] === board[l[2]]) return board[l[0]]; }
  return null;
};
var isDraw = function (board) { return board.every(function (c) { return c !== null; }); };
var getOpponent = function (state, uid) { return Object.keys(state.players).find(function (id) { return id !== uid; }) || null; };
var buildState = function (state) {
  var p = {}; Object.keys(state.players).forEach(function (uid) { p[uid] = { symbol: state.players[uid].symbol, username: state.players[uid].username }; });
  return { board: state.board, currentTurn: state.currentTurn, players: p, mode: state.mode, timerSeconds: state.timerSeconds, status: state.status, winner: state.winner, moveCount: state.moveCount };
};
var buildGameOver = function (state, reason) {
  var p = {}; Object.keys(state.players).forEach(function (uid) { p[uid] = { symbol: state.players[uid].symbol, username: state.players[uid].username }; });
  return { winner: state.winner, board: state.board, players: p, reason: reason };
};
var fetchMeta = function (nk, uid) {
  try {
    var r = nk.leaderboardRecordsList(LEADERBOARD_ID, [uid], 1, "", 0);
    var rec = (r.records || [])[0];
    if (rec && rec.metadata) {
      var m = typeof rec.metadata === "string" ? JSON.parse(rec.metadata) : rec.metadata;
      return { wins: m.wins || 0, losses: m.losses || 0, streak: m.streak || 0 };
    }
  } catch (_) { }
  return { wins: 0, losses: 0, streak: 0 };
};

var recordResult = function (nk, logger, winnerId, loserId, winnerName, loserName, isDraw) {
  if (isDraw) {
    [winnerId, loserId].forEach(function (uid, idx) {
      if (!uid) return;
      var name = idx === 0 ? winnerName : loserName;
      try {
        var m = fetchMeta(nk, uid);
        nk.leaderboardRecordWrite(LEADERBOARD_ID, uid, name, 0, 0, {
          wins: m.wins, losses: m.losses + 1, streak: 0
        });
        logger.info("draw recorded for %s wins=%d losses=%d", name, m.wins, m.losses + 1);
      } catch (e) { logger.error("draw failed: %s", String(e)); }
    });
    return;
  }
  if (winnerId) {
    try {
      var mw = fetchMeta(nk, winnerId);
      nk.leaderboardRecordWrite(LEADERBOARD_ID, winnerId, winnerName, 3, 0, {
        wins: mw.wins + 1, losses: mw.losses, streak: mw.streak + 1
      });
      logger.info("win recorded for %s wins=%d losses=%d streak=%d", winnerName, mw.wins + 1, mw.losses, mw.streak + 1);
    } catch (e) { logger.error("win failed: %s", String(e)); }
  }
  if (loserId) {
    try {
      var ml = fetchMeta(nk, loserId);
      nk.leaderboardRecordWrite(LEADERBOARD_ID, loserId, loserName, 1, 0, {
        wins: ml.wins, losses: ml.losses + 1, streak: 0
      });
      logger.info("loss recorded for %s wins=%d losses=%d", loserName, ml.wins, ml.losses + 1);
    } catch (e) { logger.error("loss failed: %s", String(e)); }
  }
};

var matchInit = function (ctx, logger, nk, params) {
  var mode = params["mode"] || "classic";
  logger.info("matchInit: mode=%s", mode);
  return { state: { board: [null, null, null, null, null, null, null, null, null], currentTurn: "", players: {}, mode: mode, timerSeconds: TIMER_SECONDS_DEFAULT, status: "waiting", winner: null, moveCount: 0, reconnectGrace: {} }, tickRate: TICK_RATE, label: JSON.stringify({ mode: mode, status: "waiting" }) };
};
var matchJoinAttempt = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  if (state.status === "finished") return { state: state, accept: false, rejectMessage: "Game already finished" };
  if (state.players[presence.userId]) return { state: state, accept: true };
  if (Object.keys(state.players).length >= MAX_PLAYERS) return { state: state, accept: false, rejectMessage: "Match is full" };
  return { state: state, accept: true };
};
var matchJoin = function (ctx, logger, nk, dispatcher, tick, state, presences) {
  presences.forEach(function (p) {
    logger.info("matchJoin: %s", p.username);
    if (state.players[p.userId]) { state.players[p.userId].presence = p; state.reconnectGrace[p.userId] = -1; dispatcher.broadcastMessage(OpCode.GAME_STATE, JSON.stringify(buildState(state)), [p]); return; }
    var n = Object.keys(state.players).length;
    state.players[p.userId] = { symbol: n === 0 ? "X" : "O", username: p.username || ("Player" + (n + 1)), presence: p };
    state.reconnectGrace[p.userId] = -1;
    logger.info("Assigned %s to %s", state.players[p.userId].symbol, p.username);
  });
  var ids = Object.keys(state.players);
  if (ids.length === MAX_PLAYERS && state.status === "waiting") {
    state.status = "playing";
    state.currentTurn = ids.find(function (uid) { return state.players[uid].symbol === "X"; }) || ids[0];
    dispatcher.matchLabelUpdate(JSON.stringify({ mode: state.mode, status: "playing" }));
    dispatcher.broadcastMessage(OpCode.GAME_STATE, JSON.stringify(buildState(state)), null);
    logger.info("Match started! firstTurn=%s", state.currentTurn);
  }
  return { state: state };
};
var matchLeave = function (ctx, logger, nk, dispatcher, tick, state, presences) {
  presences.forEach(function (p) {
    logger.info("matchLeave: %s", p.userId);
    if (state.status !== "playing") { delete state.players[p.userId]; delete state.reconnectGrace[p.userId]; return; }
    state.reconnectGrace[p.userId] = RECONNECT_GRACE_TICKS;
    dispatcher.broadcastMessage(OpCode.OPPONENT_DISCONNECTED, JSON.stringify({ disconnectedUserId: p.userId, gracePeriodSeconds: RECONNECT_GRACE_TICKS / TICK_RATE }), null);
  });
  return { state: state };
};
var matchLoop = function (ctx, logger, nk, dispatcher, tick, state, messages) {
  if (state.status === "waiting" && Object.keys(state.players).length === 0 && tick > TICK_RATE * 30) return null;
  if (state.status === "finished") return null;
  if (state.status === "playing") {
    var guids = Object.keys(state.reconnectGrace);
    for (var i = 0; i < guids.length; i++) {
      var uid = guids[i]; var g = state.reconnectGrace[uid];
      if (g < 0) continue;
      state.reconnectGrace[uid] = g - 1;
      if (g - 1 <= 0) {
        var opp = getOpponent(state, uid);
        state.winner = opp && state.players[opp] ? state.players[opp].symbol : null;
        state.status = "finished";
        recordResult(nk, logger, opp, uid, opp && state.players[opp] ? state.players[opp].username : "Unknown", state.players[uid] ? state.players[uid].username : "Unknown", false);
        dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify(buildGameOver(state, "disconnect")), null);
        logger.info("GAME_OVER disconnect: winner=%s", opp);
        return { state: state };
      }
    }
  }
  for (var m = 0; m < messages.length; m++) {
    var msg = messages[m]; var sender = msg.sender.userId;
    if (msg.opCode === OpCode.MAKE_MOVE) {
      if (state.status !== "playing" || sender !== state.currentTurn) continue;
      // var payload; try { payload = JSON.parse(decodeData(msg.data)); } catch (_) { logger.warn("MAKE_MOVE malformed"); continue; }
      var payload;
      try {
        var rawData = msg.data;
        logger.info("MAKE_MOVE raw type=%s value=%s", typeof rawData, String(rawData));
        payload = JSON.parse(decodeData(rawData));
      } catch (e) {
        logger.warn("MAKE_MOVE malformed: %s", String(e));
        continue;
      }

      var ci = payload.cellIndex;
      if (typeof ci !== "number" || ci < 0 || ci > 8 || state.board[ci] !== null) { logger.warn("MAKE_MOVE invalid cell %d", ci); continue; }
      state.board[ci] = state.players[sender].symbol; state.moveCount++; state.timerSeconds = TIMER_SECONDS_DEFAULT;
      logger.info("MAKE_MOVE: %s at cell %d", state.players[sender].symbol, ci);
      var win = checkWinner(state.board);
      if (win) {
        state.winner = win; state.status = "finished";
        var wid = Object.keys(state.players).find(function (u) { return state.players[u].symbol === win; });
        var lid = Object.keys(state.players).find(function (u) { return u !== wid; });
        logger.info("WIN DETECTED: symbol=%s winnerId=%s loserId=%s winnerName=%s loserName=%s",
          win, wid, lid,
          wid && state.players[wid] ? state.players[wid].username : "NONE",
          lid && state.players[lid] ? state.players[lid].username : "NONE"
        );
        recordResult(nk, logger, wid, lid,
          wid && state.players[wid] ? state.players[wid].username : "",
          lid && state.players[lid] ? state.players[lid].username : "",
          false
        );
        logger.info("recordResult called for win");
        dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify(buildGameOver(state, "normal")), null);
        logger.info("GAME_OVER win: %s", win); continue;
      }
      if (isDraw(state.board)) {
        state.winner = "draw"; state.status = "finished";
        var pids = Object.keys(state.players);
        recordResult(nk, logger, pids[0], pids[1], state.players[pids[0]] ? state.players[pids[0]].username : "", state.players[pids[1]] ? state.players[pids[1]].username : "", true);
        dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify(buildGameOver(state, "normal")), null);
        logger.info("GAME_OVER draw"); continue;
      }
      state.currentTurn = getOpponent(state, sender) || sender;
      dispatcher.broadcastMessage(OpCode.GAME_STATE, JSON.stringify(buildState(state)), null);
    }
  }
  if (state.status === "playing" && state.mode === "timed" && tick % TICK_RATE === 0 && tick > 0) {
    state.timerSeconds = Math.max(0, state.timerSeconds - 1);
    dispatcher.broadcastMessage(OpCode.TIMER_TICK, JSON.stringify({ secondsRemaining: state.timerSeconds, currentTurn: state.currentTurn }), null);
    if (state.timerSeconds <= 0) {
      var fid = state.currentTurn; var opp = getOpponent(state, fid);
      state.winner = opp && state.players[opp] ? state.players[opp].symbol : null; state.status = "finished";
      recordResult(nk, logger, opp, fid, opp && state.players[opp] ? state.players[opp].username : "", state.players[fid] ? state.players[fid].username : "", false);
      dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify(buildGameOver(state, "timeout")), null);
      logger.info("GAME_OVER timeout");
    }
  }
  return { state: state };
};
var matchTerminate = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) { logger.info("matchTerminate"); return { state: state }; };
var matchSignal = function (ctx, logger, nk, dispatcher, tick, state, data) { return { state: state }; };

var matchmakerMatched = function (ctx, logger, nk, matches) {
  var mode = (matches[0] && matches[0].properties && matches[0].properties["mode"]) || "classic";
  logger.info("matchmakerMatched: mode=%s", mode);
  var mid = nk.matchCreate("tictactoe", { mode: mode });
  logger.info("matchmakerMatched: created %s", mid);
  return mid;
};

var rpcGetLeaderboard = function (ctx, logger, nk, payload) {
  try {
    var result = nk.leaderboardRecordsList(LEADERBOARD_ID, [], 50, "", 0);
    var entries = (result.records || []).map(function (r, idx) {
      var wins = 0, losses = 0, streak = 0;
      // if (r.metadata) { try { var m = JSON.parse(r.metadata); wins = m.wins || 0; losses = m.losses || 0; streak = m.streak || 0; } catch (_) { } }
      if (r.metadata) {
        try {
          var m = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
          wins = m.wins || 0;
          losses = m.losses || 0;
          streak = m.streak || 0;
        } catch (_) { }
      }
      return { rank: r.rank || idx + 1, userId: r.ownerId, username: r.username || "Anonymous", wins: wins, losses: losses, streak: streak, score: r.score };
    });
    return JSON.stringify(entries);
  } catch (e) { return JSON.stringify({ error: String(e) }); }
};

var InitModule = function (ctx, logger, nk, initializer) {
  logger.info("TicTacToe InitModule starting...");
  initializer.registerMatch("tictactoe", {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLeave: matchLeave,
    matchLoop: matchLoop,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal
  });
  logger.info("Registered match handler: tictactoe");
  initializer.registerMatchmakerMatched(matchmakerMatched);
  logger.info("Registered matchmakerMatched hook");
  initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
  logger.info("Registered RPC: get_leaderboard");
  try { nk.leaderboardCreate(LEADERBOARD_ID, false, "desc", "incr", "0 0 1 1 *"); logger.info("Leaderboard created/verified."); } catch (e) { logger.debug("Leaderboard exists: %s", String(e)); }
  logger.info("TicTacToe InitModule complete.");
};
