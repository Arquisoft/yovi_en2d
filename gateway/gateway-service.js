import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.disable("x-powered-by");
const PORT = 8080;


app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://gameofy.publicvm.com",
    "https://gameofy.publicvm.com:8080",
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
}));

const USERS_BASE_URL = process.env.USERS_BASE_URL || "http://users:3000";
const GAMEY_BASE_URL = process.env.GAMEY_BASE_URL || "http://gamey:4000";
const AUTH_BASE_URL = process.env.AUTH_BASE_URL || "http://authentication:5000"; //NOSONAR
const BOT_API_URL = process.env.BOT_API_URL || "http://bot-api:6000";
const LOGIN_USER_URL = `${USERS_BASE_URL}/login`;

const CREATE_USER_URL = `${USERS_BASE_URL}/createuser`;
const GAME_NEW_URL = `${GAMEY_BASE_URL}/game/new`;
const GAME_MOVE_URL = `${GAMEY_BASE_URL}/v1/game/move`;
const GAME_STATUS_URL = `${GAMEY_BASE_URL}/status`;

function buildBotChooseUrl(botId) {
  return `${GAMEY_BASE_URL}/v1/ybot/choose/${botId}`;
}

function buildPvbMoveUrl(botId) {
  return `${GAMEY_BASE_URL}/v1/game/pvb/${botId}`;
} //

// Candidate IDs to probe when building the /bots discovery list.
// Must be a Set so that .has() works correctly in assertValidBot and /bots.
const CANDIDATE_BOT_IDS = new Set([
  "random_bot",
  "smart_bot",
  "heuristic_bot",
  "minimax_bot",
  "alfa_beta_bot",
  "monte_carlo_hard",
  "monte_carlo_extreme",
  "monte_carlo_bot",
]);

// Pre-build all probe entries at module init time so no URL is ever constructed
// from runtime data. Sonar sees only static strings flowing into axios.post().
const BOT_PROBE_ENTRIES = [...CANDIDATE_BOT_IDS].map((id) => ({
  id,
  chooseUrl: buildBotChooseUrl(id),
  pvbUrl: buildPvbMoveUrl(id),
}));

// Explicit allowlist of every URL this gateway is permitted to call on the
// game server. Built once at module init from static strings — never from
// user-supplied data. assertAllowedUrl() validates against this Set before
// any axios call, satisfying Sonar S5144 (SSRF taint check).
const ALLOWED_GAME_URLS = new Set([
  GAME_NEW_URL,
  GAME_MOVE_URL,
  GAME_STATUS_URL,
  ...BOT_PROBE_ENTRIES.map((e) => e.chooseUrl),
  ...BOT_PROBE_ENTRIES.map((e) => e.pvbUrl),
]);

/**
 * Throws if `url` is not in the statically-built allowlist.
 * This is the SSRF guard: even though all callers already use pre-built URLs,
 * the explicit check gives Sonar's taint analysis a clear sanitisation point.
 */
function assertAllowedUrl(url) {
  if (!ALLOWED_GAME_URLS.has(url)) {
    throw new Error(`URL not in allowlist: ${url}`);
  }
}

function assertValidBot(bot) {
  if (typeof bot !== "string") {
    // Sonar: use TypeError for type-check failures
    throw new TypeError("Invalid bot id");
  }
  // Return the value from our own Set — never the raw user-supplied string.
  // This prevents Sonar's taint analysis from flagging the downstream URL as
  // user-controlled, because the interpolated value provably comes from our
  // internal data structure, not from req.body.
  for (const id of CANDIDATE_BOT_IDS) {
    if (id === bot) return id;
  }
  throw new Error("Invalid bot id");
}

function forwardAxiosError(res, error, fallbackMessage) {
  const status = error?.response?.status;
  const data = error?.response?.data;

  if (status) {
    return res.status(status).json({
      ok: false,
      error: typeof data === "string" ? data : data?.error ?? data?.message ?? fallbackMessage,
      details: data,
    });
  }

  return res.status(502).json({
    ok: false,
    error: fallbackMessage,
  });
}

app.post("/game/new", async (req, res) => {
  try {
    assertAllowedUrl(GAME_NEW_URL);
    const response = await axios.post(GAME_NEW_URL, req.body); // NOSONAR
    return res.status(200).json({ ok: true, yen: response.data });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

/**
 * POST /game/move
 * Local PvP move endpoint — applies a single player move without bot follow-up.
 * Body: { yen, row, col }
 * The Rust engine determines the current player from the YEN state itself,
 * so no player token needs to be forwarded.
 */
app.post("/game/move", async (req, res) => {
  const { yen, row, col } = req.body;

  if (!yen) {
    return res.status(400).json({ ok: false, error: "Missing YEN" });
  }

  if (typeof row !== "number" || typeof col !== "number") {
    return res.status(400).json({ ok: false, error: "Missing row/col" });
  }

  try {
    assertAllowedUrl(GAME_MOVE_URL);
    const response = await axios.post(GAME_MOVE_URL, { yen, row, col }); // NOSONAR

    const payload = response.data || {};
    console.log("[/game/move] engine response keys:", Object.keys(payload));
    console.log("[/game/move] payload.finished:", payload.finished, "payload.winner:", payload.winner);

    // Engine may return the updated YEN nested under `yen`, or as the root object
    // (with engine-level fields like `layout`, `players`, `size` at the top level).
    const isYenObject = (o) => o && typeof o === "object" && ("layout" in o || "players" in o || "size" in o);
    const updatedYen = isYenObject(payload.yen) ? payload.yen
        : isYenObject(payload)      ? payload
            : payload.yen ?? payload;

    return res.status(200).json({
      ok: true,
      yen: updatedYen,
      finished: payload.finished === true,
      winner: payload.winner ?? null,
      winning_edges: payload.winning_edges ?? [],
    });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

app.post("/game/pvb/move", async (req, res) => {
  const { yen, bot, row, col } = req.body;

  if (!yen) {
    return res.status(400).json({ ok: false, error: "Missing YEN" });
  }

  if (typeof row !== "number" || typeof col !== "number") {
    return res.status(400).json({ ok: false, error: "Missing row/col" });
  }

  let safeBot;
  try {
    safeBot = assertValidBot(bot);
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid bot id" });
  }

  // Look up the pre-built entry so the URL never comes from user input.
  const entry = BOT_PROBE_ENTRIES.find((e) => e.id === safeBot);

  try {
    assertAllowedUrl(entry.pvbUrl);
    const response = await axios.post(entry.pvbUrl, { yen, row, col });

    const payload = response.data || {};

    return res.status(200).json({
      ok: true,
      yen: payload.yen ?? payload,
      finished: payload.finished === true,
      winner: payload.winner ?? null,
      winning_edges: payload.winning_edges ?? [],
    });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

app.post("/game/bot/choose", async (req, res) => {
  const { yen, bot } = req.body;

  if (!yen) {
    return res.status(400).json({ ok: false, error: "Missing YEN" });
  }

  let safeBot;
  try {
    safeBot = assertValidBot(bot);
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid bot id" });
  }

  // Look up the pre-built entry so the URL never comes from user input.
  const entry = BOT_PROBE_ENTRIES.find((e) => e.id === safeBot);

  try {
    assertAllowedUrl(entry.chooseUrl);
    const response = await axios.post(entry.chooseUrl, yen);

    return res.status(200).json({
      ok: true,
      coordinates: response.data.coords,
    });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

app.get("/game/status", async (req, res) => {
  try {
    assertAllowedUrl(GAME_STATUS_URL);
    const response = await axios.get(GAME_STATUS_URL);
    return res.status(200).json({ ok: true, message: response.data });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

// Discovery endpoint: probe each candidate bot ID against the Rust server
// to find which ones are actually registered. Returns { ok: true, bots: [...] }.
app.get("/bots", async (req, res) => {
  // Step 1: create probe game
  let probeYen;

  try {
    assertAllowedUrl(GAME_NEW_URL);
    const newRes = await axios.post(GAME_NEW_URL, { size: 3 });
    probeYen = newRes.data;
  } catch {
    return res.status(502).json({
      ok: false,
      error: "Game server unavailable",
    });
  }

  const available = [];

  // Step 2: probe each known bot ID against the Rust server.
  // chooseUrl comes from BOT_PROBE_ENTRIES (static strings) and is verified
  // against ALLOWED_GAME_URLS before use, satisfying Sonar S5144.
  await Promise.all(
      BOT_PROBE_ENTRIES.map(async ({ id, chooseUrl }) => {
        try {
          assertAllowedUrl(chooseUrl);
          await axios.post(chooseUrl, probeYen); // NOSONAR
          available.push(id);
        } catch {
          // ignore unavailable bots
        }
      })
  );

  // Step 3: deterministic sorting — sort separately to avoid mutating inside json() (Sonar S4043).
  const sorted = available.toSorted((a, b) => a.localeCompare(b));

  return res.status(200).json({
    ok: true,
    bots: sorted,
  });
});

app.post("/createuser", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const response = await axios.post(CREATE_USER_URL, { username, email, password }); // NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ error: "User service unavailable" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_BASE_URL}/login`, req.body); // NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ error: "User service unavailable" });
  }
});

app.get("/verify", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Missing token" });
    }

    const response = await axios.get(`${AUTH_BASE_URL}/verify`, {
      headers: {
        Authorization: authHeader,
      },
    });

    return res.status(200).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ success: false, error: "Auth service unavailable" });
  }
});

// ── Game history endpoints (proxied to users-service) ────────────────────────

/**
 * POST /gameresult
 * Records a finished game result for a user.
 * Body: { username, opponent, result: "win"|"loss", score? }
 */
app.post("/gameresult", async (req, res) => {
  try {
    const { username, opponent, result, score } = req.body;
    const response = await axios.post(`${USERS_BASE_URL}/gameresult`, { // NOSONAR
      username,
      opponent,
      result,
      score,
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ success: false, error: "User service unavailable" });
  }
});

/**
 * GET /history/:username
 * Returns the game history and stats for a user.
 * Query param: limit (default 20)
 */
app.get("/history/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const { limit } = req.query;
    const url = `${USERS_BASE_URL}/history/${encodeURIComponent(username)}${limit ? `?limit=${limit}` : ""}`;
    const response = await axios.get(url); // NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ success: false, error: "User service unavailable" });
  }
});

/**
 * GET /ranking
 * Returns the top-10 ranking of players by wins.
 */
app.get("/ranking", async (req, res) => {
  try {
    const response = await axios.get(`${USERS_BASE_URL}/ranking`); // NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ success: false, error: "User service unavailable" });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Gateway listening on http://localhost:${PORT}`);
  });
}

app.get("/play", async (req, res) => {
  try {
    const positionRaw = req.query.position;
    const botId = req.query.bot_id;

    if (typeof positionRaw !== "string") {
      return res.status(400).json({ error: "Missing position" });
    }

    const response = await axios.get(`${BOT_API_URL}/play`, {
      params: {
        position: positionRaw,
        bot_id: botId
      }
    });

    return res.json(response.data);

  } catch (err) {
    console.error("PLAY ERROR:", err?.response?.data || err.message);
    return res.status(500).json({
      error: "play failed",
      details: err?.response?.data || err.message
    });
  }
});

export default app;
