import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.tsx";
import { useI18n } from "./i18n/I18nProvider";

type Mode = "bot" | "player" | null;
type BotId = "random_bot" | "heuristic_bot" | "minimax_bot" | "alfa_beta_bot" | "monte_carlo_hard" | "monte_carlo_extreme";

const BOT_OPTIONS: { value: BotId; labelKey: string }[] = [
  { value: "random_bot",         labelKey: "game.bot.random"    },
  { value: "heuristic_bot",      labelKey: "game.bot.heuristic"},
  { value: "minimax_bot",        labelKey: "game.bot.minimax"   },
  { value: "alfa_beta_bot",      labelKey: "game.bot.alfabeta"  },
  { value: "monte_carlo_hard",   labelKey: "game.bot.mcHard"    },
  { value: "monte_carlo_extreme",labelKey: "game.bot.mcExtreme" },
];

const BOARD_SIZES = [5, 7, 9, 11];

const Home: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { t }     = useI18n();

  const username = useMemo(() => {
    const st = (location.state as { username?: string } | null) ?? null;
    return st?.username ?? localStorage.getItem("username") ?? "";
  }, [location.state]);

  useEffect(() => {
    if (!username) navigate("/", { replace: true });
  }, [username, navigate]);

  const [mode,      setMode]      = useState<Mode>(null);
  const [botId,     setBotId]     = useState<BotId>("random_bot");
  const [boardSize, setBoardSize] = useState<number>(7);

  const logout = () => {
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  };

  const handlePlay = () => {
    if (!mode) return;
    navigate("/game", {
      state: {
        username,
        mode,
        botId:     mode === "bot" ? botId : undefined,
        boardSize,
      },
    });
  };

  const selectMode = (m: Mode) => setMode(prev => (prev === m ? null : m));

  if (!username) return null;

  return (
      <div className="page" style={{ padding: "20px", minHeight: "100vh", background: "var(--bg)" }}>
        <Navbar username={username} onLogout={logout} />

        <main className="page-main" style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>

          {/* Welcome Banner */}
          <div style={{
            textAlign: "center",
            padding: "20px 16px",
            background: "var(--surface)",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            width: "100%",
          }}>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: "var(--accent)", margin: 0 }}>
              Welcome, <span style={{ color: "#ff3b3b" }}>{username}</span>!
            </h1>
            <p style={{ fontSize: 16, color: "#555", marginTop: 6 }}>
              Choose your opponent and start the game.
            </p>
          </div>

          {/* Play Options (Bot / Player) */}
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
            <button
                type="button"
                className={`play-card${mode === "bot" ? " is-selected" : ""}`}
                onClick={() => selectMode("bot")}
                style={{
                  flex: "1 1 250px",
                  padding: "36px 24px",
                  fontSize: 28,
                  minHeight: 200,
                  borderRadius: 16,
                  transition: "transform .2s, box-shadow .2s",
                  cursor: "pointer"
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-6px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <div className="play-card__icon" style={{ fontSize: 64 }}>🤖</div>
              <span className="play-card__title" style={{ fontSize: 20 }}>{t("home.card.bots") ?? "Game against bots"}</span>
            </button>

            <button
                type="button"
                className={`play-card${mode === "player" ? " is-selected" : ""}`}
                onClick={() => selectMode("player")}
                style={{
                  flex: "1 1 250px",
                  padding: "36px 24px",
                  fontSize: 28,
                  minHeight: 200,
                  borderRadius: 16,
                  transition: "transform .2s, box-shadow .2s",
                  cursor: "pointer"
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-6px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <div className="play-card__icon" style={{ fontSize: 64 }}>👥</div>
              <span className="play-card__title" style={{ fontSize: 20 }}>{t("home.card.players") ?? "Game against players"}</span>
            </button>
          </div>

          {/* Instructions / Tips */}
          <div style={{
            background: "var(--surface)",
            border: "2px solid var(--border)",
            borderRadius: 12,
            padding: 20,
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            maxWidth: 700
          }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--accent)", marginBottom: 12 }}>
              How to Play
            </h2>
            <p style={{ fontSize: 16, color: "#555", margin: 0 }}>
              Click on a square to select it. Confirm your choice to make your move. Beat your opponent and climb the leaderboard!
            </p>
          </div>

          {/* Recent Games / Placeholder */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 16,
            width: "100%",
          }}>
            {[1,2,3,4].map(i => (
                <div key={i} style={{
                  background: "var(--surface2)",
                  borderRadius: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  padding: 20,
                  textAlign: "center",
                  fontSize: 16,
                  color: "#555",
                  fontWeight: 600,
                }}>
                  Recent Game {i}
                </div>
            ))}
          </div>

          {/* Config panel — shown when a mode is selected */}
          {mode && (
              <div className="config-panel" style={{ width: "100%", maxWidth: 700 }}>
                <p className="config-panel__title">
                  {mode === "bot"
                      ? (t("home.config.botTitle") ?? "BOT SETTINGS")
                      : (t("home.config.playerTitle") ?? "MATCH SETTINGS")}
                </p>

                {/* Bot selector — only for bot mode */}
                {mode === "bot" && (
                    <div className="config-row">
                      <label className="config-label" htmlFor="bot-select">
                        {t("home.config.bot") ?? "Bot"}
                      </label>
                      <select
                          id="bot-select"
                          className="form-select"
                          value={botId}
                          onChange={e => setBotId(e.target.value as BotId)}
                          style={{ flex: 1, minWidth: 0 }}
                      >
                        {BOT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {t(opt.labelKey) ?? opt.value}
                            </option>
                        ))}
                      </select>
                    </div>
                )}

                {/* Board size — both modes */}
                <div className="config-row">
                  <label className="config-label" htmlFor="size-select">
                    {t("home.config.boardSize") ?? "Board size"}
                  </label>
                  <select
                      id="size-select"
                      className="form-select"
                      value={boardSize}
                      onChange={e => setBoardSize(Number(e.target.value))}
                      style={{ flex: 1, minWidth: 0 }}
                  >
                    {BOARD_SIZES.map(s => (
                        <option key={s} value={s}>{s}×{s}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 20 }}>
                  <button
                      type="button"
                      className="btn btn--primary btn--full btn--lg"
                      onClick={handlePlay}
                  >
                    {t("home.start") ?? "PLAY"}
                  </button>
                </div>
              </div>
          )}

        </main>
      </div>
  );
};

export default Home;