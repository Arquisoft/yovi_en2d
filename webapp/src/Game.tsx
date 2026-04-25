import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.tsx";
import { useI18n } from "./i18n/I18nProvider";

type BotId = "random_bot" | "heuristic_bot" | "minimax_bot" | "alfa_beta_bot" | "monte_carlo_hard" | "monte_carlo_extreme";
type WinningEdge = [[number, number], [number, number]];

type GatewayResponse =
    | { ok: true; yen?: any; finished?: boolean; winner?: string | null; winning_edges?: WinningEdge[]; message?: string }
    | { ok: false; error: string; details?: any };

type LocationState = {
  username?: string;
  mode?: "bot" | "player";
  botId?: BotId;
  boardSize?: number;
};

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

function parseLayout(layout: string) {
  if (!layout) return [];
  return layout.split("/").map(row => [...row]);
}

async function readGatewayResponse(res: Response): Promise<GatewayResponse> {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { ok: false, error: text || `HTTP ${res.status}` }; }
}

function useWindowSize() {
  const [size, setSize] = React.useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  React.useEffect(() => {
    const fn = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return size;
}

function normalizeEdges(raw: any): WinningEdge[] {
  if (!Array.isArray(raw)) return [];
  return raw
      .filter((e: any) => Array.isArray(e) && e.length === 2 && Array.isArray(e[0]) && Array.isArray(e[1]))
      .map((e: any) => [[Number(e[0][0]), Number(e[0][1])], [Number(e[1][0]), Number(e[1][1])]]);
}

// ─── Local PvP overlay ───────────────────────────────────────────────────────

interface PvpResultOverlayProps {
  winner: "p1" | "p2" | "draw";
  onRestart: () => void;
  onHome: () => void;
  t: (key: string) => string;
}

const PvpResultOverlay: React.FC<PvpResultOverlayProps> = ({ winner, onRestart, onHome, t }) => {
  const isP1   = winner === "p1";
  const isDraw = winner === "draw";

  const emoji = isDraw ? "🤝" : isP1 ? "🏆" : "🏆";
  const color = isDraw ? "var(--muted)" : isP1 ? "#1e6bb8" : "#b83232";
  const title = isDraw
      ? (t("game.finished.draw") || "Draw!")
      : isP1
          ? (t("pvp.player1wins") || "Player 1 Wins!")
          : (t("pvp.player2wins") || "Player 2 Wins!");
  const sub = isDraw
      ? (t("game.finished.drawSub") || "It's a tie!")
      : (t("game.finished.winSub") || "Well played!");

  return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          background: "var(--surface)",
          borderRadius: 20,
          padding: "40px 48px",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          maxWidth: 360,
          width: "90%",
          animation: "pvpPop .35s cubic-bezier(.34,1.56,.64,1)",
        }}>
          <style>{`
            @keyframes pvpPop {
              from { transform: scale(.6) translateY(30px); opacity: 0; }
              to   { transform: scale(1) translateY(0);    opacity: 1; }
            }
          `}</style>

          {/* Colored banner strip */}
          <div style={{
            height: 6, borderRadius: 3, background: color,
            marginBottom: 24, marginLeft: -48, marginRight: -48,
          }} />

          <div style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</div>

          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 36, color, margin: "0 0 8px",
            letterSpacing: 1,
          }}>
            {title}
          </h2>

          <p style={{ color: "var(--muted)", fontSize: 15, margin: "0 0 28px" }}>{sub}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
                type="button"
                className="btn btn--primary btn--full btn--lg"
                onClick={onRestart}
                style={{ fontSize: 16, padding: "13px 0" }}
            >
              {t("game.restart") || "Play Again"}
            </button>
            <button
                type="button"
                className="btn btn--ghost btn--full"
                onClick={onHome}
                style={{ fontSize: 14 }}
            >
              {t("common.home") || "Home"}
            </button>
          </div>
        </div>
      </div>
  );
};

// ─── Turn indicator ───────────────────────────────────────────────────────────

interface TurnIndicatorProps {
  activePlayer: 1 | 2;
  p1Token: string;
  p2Token: string;
  t: (key: string) => string;
}

const TurnIndicator: React.FC<TurnIndicatorProps> = ({ activePlayer, t }) => {
  const isP1 = activePlayer === 1;
  const label = isP1
      ? (t("pvp.p1turn") || "Player 1's Turn")
      : (t("pvp.p2turn") || "Player 2's Turn");
  const color = isP1 ? "#1e6bb8" : "#b83232";
  const dot   = isP1 ? "●" : "●";

  return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 14px",
        borderRadius: 999,
        background: `${color}18`,
        border: `1.5px solid ${color}55`,
        fontSize: 13,
        fontWeight: 700,
        color,
        letterSpacing: ".4px",
        transition: "all .3s",
        userSelect: "none",
      }}>
        <span style={{ fontSize: 10, color }}>{dot}</span>
        {label}
      </div>
  );
};

// ─── Main Game component ──────────────────────────────────────────────────────

const Game: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t }    = useI18n();

  const st = (location.state as LocationState | null) ?? null;

  const username  = useMemo(() => st?.username ?? localStorage.getItem("username") ?? "", [st]);
  const initBot   = useMemo<BotId>(() => st?.botId ?? "random_bot", [st]);
  const initSize  = useMemo(() => st?.boardSize ?? 7, [st]);
  const gameMode  = useMemo(() => st?.mode ?? "bot", [st]);
  const isPvp     = gameMode === "player";

  useEffect(() => { if (!username) navigate("/", { replace: true }); }, [username, navigate]);

  const logout = () => { localStorage.removeItem("username"); navigate("/", { replace: true }); };

  const [yen,          setYen]          = useState<any>(null);
  const [botId]                         = useState<BotId>(initBot);
  const [boardSize]                     = useState<number>(initSize);
  const [selected,     setSelected]     = useState<{ row: number; col: number } | null>(null);
  const [busy,         setBusy]         = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [gameStarted,  setGameStarted]  = useState(false);

  // PvP: which human player's turn (1 = P1/Blue, 2 = P2/Red)
  const [pvpActivePlayer, setPvpActivePlayer] = useState<1 | 2>(1);
  // PvP result overlay
  const [pvpResult, setPvpResult] = useState<{ winner: "p1" | "p2" | "draw" } | null>(null);

  const [fixedPlayers, setFixedPlayersState] = useState<[string, string] | null>(null);
  const fixedPlayersRef = useRef<[string, string] | null>(null);
  const setFixedPlayers = (p: [string, string]) => { fixedPlayersRef.current = p; setFixedPlayersState(p); };

  const [winOverlay, setWinOverlay] = useState<{ winner: string; edges: WinningEdge[] } | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const headerRef      = useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(0);
  const { w: winW, h: winH } = useWindowSize();

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const upd = () => setHeaderH(el.getBoundingClientRect().height);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => { if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current); }, []);

  const extractPlayers = (y: any): [string, string] => {
    const p = y?.players;
    return Array.isArray(p) && p.length >= 2 ? [String(p[0]), String(p[1])] : ["B", "R"];
  };

  const actualBoardSize = yen?.size ?? boardSize;
  const layoutMatrix    = useMemo(() => (yen?.layout ? parseLayout(yen.layout) : []), [yen]);
  const humanToken      = useMemo(() => fixedPlayers ? fixedPlayers[0] : (yen?.players?.[0] ? String(yen.players[0]) : "B"), [yen, fixedPlayers]);
  const botToken        = useMemo(() => fixedPlayers ? fixedPlayers[1] : (yen?.players?.[1] ? String(yen.players[1]) : "R"), [yen, fixedPlayers]);

  // In PvP, P1 uses humanToken (Blue), P2 uses botToken (Red)
  const p1Token = humanToken;
  const p2Token = botToken;

  const padPx = useMemo(() => Math.round(Math.max(10, Math.min(22, winW * 0.025))), [winW]);

  const boardPx = useMemo(() => {
    const byW = Math.floor(winW - padPx * 2);
    const byH = Math.floor(winH - headerH - padPx * 3 - 36);
    return Math.max(200, Math.min(640, byW, byH));
  }, [winW, winH, headerH, padPx]);

  const boardWidth  = 540;
  const padding     = 50;
  const usableWidth = boardWidth - padding * 2;
  const cellSpacing = actualBoardSize > 1 ? usableWidth / (actualBoardSize - 1) : 0;
  const rowHeight   = cellSpacing * 0.85;
  const r           = useMemo(() => Math.max(4.5, Math.min(8.5, cellSpacing * 0.12)), [cellSpacing]);

  const clearPendingFinish = () => {
    if (finishTimerRef.current !== null) { window.clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
  };

  // ── PvB finish handler ───────────────────────────────────────────────────
  const applyFinishFromGateway = (payload: any, players: [string, string]) => {
    const finished = typeof payload?.finished === "boolean" ? payload.finished : false;
    if (!finished) return;

    const winnerRaw = payload?.winner ?? null;
    const winner    = winnerRaw == null ? null : String(winnerRaw);
    const edges     = normalizeEdges(payload?.winning_edges);

    if (winner && edges.length > 0) setWinOverlay({ winner, edges });
    else setWinOverlay(null);

    clearPendingFinish();
    const youWin = winner ? winner === players[0] : false;

    finishTimerRef.current = window.setTimeout(() => {
      navigate("/game/finished", {
        replace: true,
        state: {
          result: winner ? (youWin ? "win" : "lost") : "draw",
          opponent: gameMode === "bot" ? botId : "player",
        },
      });
    }, winner ? 900 : 350);
  };

  // ── PvP finish handler ───────────────────────────────────────────────────
  const applyPvpFinish = (payload: any, players: [string, string]) => {
    const finished = typeof payload?.finished === "boolean" ? payload.finished : false;
    if (!finished) return;

    const winnerRaw = payload?.winner ?? null;
    const winner    = winnerRaw == null ? null : String(winnerRaw);
    const edges     = normalizeEdges(payload?.winning_edges);

    if (winner && edges.length > 0) setWinOverlay({ winner, edges });

    if (!winner) {
      setPvpResult({ winner: "draw" });
    } else if (winner === players[0]) {
      setPvpResult({ winner: "p1" });
    } else {
      setPvpResult({ winner: "p2" });
    }
  };

  // ── New game ─────────────────────────────────────────────────────────────
  const newGame = async () => {
    setBusy(true);
    setError(null);
    setWinOverlay(null);
    setPvpResult(null);
    clearPendingFinish();
    fixedPlayersRef.current = null;
    setFixedPlayersState(null);
    setPvpActivePlayer(1);
    setSelected(null);

    try {
      const res  = await fetch(`${API_URL}/game/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: boardSize }),
      });
      const data = await readGatewayResponse(res);
      if (!res.ok || !data.ok) throw new Error(!data.ok ? data.error : "Game creation failed");

      const nextYen = (data as any).yen;
      const p = extractPlayers(nextYen);
      setFixedPlayers(p);
      setYen(nextYen);
      setGameStarted(true);

      if (isPvp) applyPvpFinish(data, p);
      else       applyFinishFromGateway(data, p);
    } catch (e: any) {
      setError(e?.message ?? "Game creation failed");
    } finally {
      setBusy(false);
    }
  };

  // ── PvB move ─────────────────────────────────────────────────────────────
  const sendMove = async (override?: { row: number; col: number } | null) => {
    const target = override ?? selected;
    if (!target || !yen || busy) return;
    const rrow = layoutMatrix[target.row];
    if (!rrow || rrow[target.col] !== ".") return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/game/pvb/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yen, bot: botId, row: target.row, col: target.col }),
      });
      const data = await readGatewayResponse(res);
      if (!res.ok || !data.ok) throw new Error(!data.ok ? data.error : "Backend error");

      const nextYen = (data as any).yen;
      const p: [string, string] = fixedPlayersRef.current ?? extractPlayers(nextYen);
      if (!fixedPlayersRef.current) setFixedPlayers(p);

      setYen(nextYen);
      setSelected(null);
      applyFinishFromGateway(data, p);
    } catch (e: any) {
      setError(e?.message ?? "Backend error");
    } finally {
      setBusy(false);
    }
  };

  // ── PvP move ─────────────────────────────────────────────────────────────
  const sendPvpMove = async (target: { row: number; col: number }) => {
    if (!yen || busy || pvpResult) return;
    const rrow = layoutMatrix[target.row];
    if (!rrow || rrow[target.col] !== ".") return;

    setBusy(true);
    setError(null);

    // Determine which token the active player uses
    const activeToken = pvpActivePlayer === 1 ? p1Token : p2Token;

    try {
      const res = await fetch(`${API_URL}/game/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yen, row: target.row, col: target.col, player: activeToken }),
      });
      const data = await readGatewayResponse(res);
      if (!res.ok || !data.ok) throw new Error(!data.ok ? data.error : "Backend error");

      const nextYen = (data as any).yen;
      const p: [string, string] = fixedPlayersRef.current ?? extractPlayers(nextYen);
      if (!fixedPlayersRef.current) setFixedPlayers(p);

      setYen(nextYen);
      setSelected(null);

      const finished = typeof (data as any).finished === "boolean" ? (data as any).finished : false;
      if (finished) {
        applyPvpFinish(data, p);
      } else {
        // Switch turns
        setPvpActivePlayer(prev => (prev === 1 ? 2 : 1));
      }
    } catch (e: any) {
      setError(e?.message ?? "Backend error");
    } finally {
      setBusy(false);
    }
  };

  if (!username) return null;

  const overlayStroke = (token: string) => {
    if (token === humanToken) return "#1e6bb8";
    if (token === botToken)   return "#b83232";
    return "#111";
  };

  // ── Cell click handlers ──────────────────────────────────────────────────
  const handleCellClick = (ri: number, ci: number, cell: string) => {
    if (cell !== "." || busy || !yen) return;

    if (isPvp) {
      // In PvP, single-click selects; double-click commits (handled separately)
      // But we can also just commit on click for better UX
      setSelected({ row: ri, col: ci });
    } else {
      setSelected({ row: ri, col: ci });
    }
  };

  const handleCellDoubleClick = (ri: number, ci: number, cell: string) => {
    if (cell !== "." || busy || !yen) return;

    if (isPvp) {
      sendPvpMove({ row: ri, col: ci });
    } else {
      sendMove({ row: ri, col: ci });
    }
  };

  // In PvP, a cell is clickable only on the active player's turn
  const isCellClickable = (cell: string, _ri: number, _ci: number): boolean => {
    if (cell !== "." || !yen || busy) return false;
    if (pvpResult) return false; // game over
    return true;
  };

  return (
      <div className="game-page">
        <Navbar username={username} onLogout={logout} />

        {/* PvP result overlay */}
        {isPvp && pvpResult && (
            <PvpResultOverlay
                winner={pvpResult.winner}
                onRestart={newGame}
                onHome={() => navigate("/home", { state: { username } })}
                t={t}
            />
        )}

        <main className="game-main">
          {/* Toolbar */}
          <div ref={headerRef} className="game-toolbar">
            <button
                type="button"
                className="btn btn--outline"
                style={{ padding: "8px 14px", fontSize: 13 }}
                onClick={() => navigate("/home", { state: { username } })}
            >
              ← {t("game.back")}
            </button>

            {/* PvP turn indicator */}
            {isPvp && gameStarted && !pvpResult && (
                <TurnIndicator
                    activePlayer={pvpActivePlayer}
                    p1Token={p1Token}
                    p2Token={p2Token}
                    t={t}
                />
            )}

            {/* PvB bot label */}
            {!isPvp && gameMode === "bot" && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: ".5px", textTransform: "uppercase" }}>
                  vs {botId.replaceAll("_", " ")}
                </span>
            )}

            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: ".5px", textTransform: "uppercase" }}>
              {boardSize}×{boardSize}
            </span>

            <button
                type="button"
                className="btn btn--primary"
                style={{ padding: "8px 16px", fontSize: 13 }}
                onClick={newGame}
                disabled={busy}
            >
              {gameStarted ? t("game.restart") ?? "New Game" : t("game.new") ?? "Start"}
            </button>

            {/* Send button — PvB only */}
            {!isPvp && gameStarted && (
                <button
                    type="button"
                    className="btn btn--outline"
                    style={{ padding: "8px 14px", fontSize: 13 }}
                    onClick={() => sendMove(null)}
                    disabled={!selected || busy || !yen}
                >
                  {busy ? t("game.sending") : t("game.send")}
                </button>
            )}

            {/* Confirm button — PvP only */}
            {isPvp && gameStarted && !pvpResult && (
                <button
                    type="button"
                    className="btn btn--outline"
                    style={{ padding: "8px 14px", fontSize: 13 }}
                    onClick={() => { if (selected) sendPvpMove(selected); }}
                    disabled={!selected || busy || !yen}
                >
                  {busy ? t("game.sending") : (t("pvp.confirm") || "Confirm")}
                </button>
            )}
          </div>

          {error && (
              <p className="msg msg--error" style={{ textAlign: "center" }}>{error}</p>
          )}

          {!gameStarted && (
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                color: "var(--muted)",
              }}>
                <span style={{ fontSize: 48 }}>{isPvp ? "👥" : "🎮"}</span>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16, letterSpacing: ".5px" }}>
                  {isPvp
                      ? (t("pvp.pressStart") || "Two players — press Start to begin")
                      : (t("game.pressStart") ?? "Press Start to begin")}
                </p>
              </div>
          )}

          {gameStarted && (
              <div
                  className="game-board-wrap"
                  style={{ width: `${boardPx}px`, height: `${boardPx}px` }}
              >
                <svg
                    viewBox={`0 0 ${boardWidth} ${boardWidth}`}
                    width="100%"
                    height="100%"
                    preserveAspectRatio="xMidYMid meet"
                    style={{ display: "block", touchAction: "manipulation" }}
                >
                  {/* Win overlay edges */}
                  {winOverlay?.edges?.map(([[r1, c1], [r2, c2]], i) => {
                    const row1 = layoutMatrix[r1];
                    const row2 = layoutMatrix[r2];
                    if (!row1 || !row2) return null;
                    const ox1 = padding + ((actualBoardSize - row1.length) * cellSpacing) / 2;
                    const ox2 = padding + ((actualBoardSize - row2.length) * cellSpacing) / 2;
                    return (
                        <line
                            key={`we-${i}`}
                            x1={ox1 + c1 * cellSpacing}
                            y1={padding + r1 * rowHeight}
                            x2={ox2 + c2 * cellSpacing}
                            y2={padding + r2 * rowHeight}
                            stroke={overlayStroke(winOverlay.winner)}
                            strokeWidth={Math.max(3, r * 0.9)}
                            strokeLinecap="round"
                            opacity={0.85}
                        />
                    );
                  })}

                  {/* Cells */}
                  {layoutMatrix.map((row, ri) => {
                    const offsetX = padding + ((actualBoardSize - row.length) * cellSpacing) / 2;
                    return row.map((cell, ci) => {
                      const x = offsetX + ci * cellSpacing;
                      const y = padding + ri * rowHeight;

                      // ── Fill logic ──────────────────────────────────────
                      let fill = "#b0aa9f";
                      if (cell === humanToken) fill = "#1e6bb8";
                      if (cell === botToken)   fill = "#b83232";

                      const isSelected = !!selected && selected.row === ri && selected.col === ci;
                      if (isSelected && cell === ".") {
                        // Tint selected cell based on active player in PvP
                        fill = isPvp
                            ? (pvpActivePlayer === 1 ? "#2a82d4" : "#d44040")
                            : "#d4782a";
                      }

                      const clickable = isCellClickable(cell, ri, ci);

                      return (
                          <circle
                              key={`${ri}-${ci}`}
                              cx={x} cy={y} r={r}
                              fill={fill}
                              stroke="#5a5650"
                              strokeWidth={isSelected ? 2 : 1.2}
                              onClick={() => { if (!clickable) return; handleCellClick(ri, ci, cell); }}
                              onDoubleClick={() => { if (!clickable) return; handleCellDoubleClick(ri, ci, cell); }}
                              style={{
                                cursor: clickable ? "pointer" : "default",
                                filter: isSelected ? "brightness(1.2)" : undefined,
                              }}
                          />
                      );
                    });
                  })}
                </svg>
              </div>
          )}

          {/* PvP legend — shown during an active game */}
          {isPvp && gameStarted && !pvpResult && (
              <div style={{
                display: "flex",
                gap: 24,
                justifyContent: "center",
                marginTop: 8,
                fontSize: 13,
                color: "var(--muted)",
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#1e6bb8", display: "inline-block" }} />
                  {t("pvp.player1") || "Player 1"}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#b83232", display: "inline-block" }} />
                  {t("pvp.player2") || "Player 2"}
                </span>
              </div>
          )}
        </main>
      </div>
  );
};

export default Game;
