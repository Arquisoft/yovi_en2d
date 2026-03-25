import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.tsx";
import { useI18n } from "./i18n/I18nProvider";

type Mode = "bot" | "player" | null;
type BotId = "random_bot" | "heuristic_bot" | "minimax_bot" | "alfa_beta_bot" | "monte_carlo_hard" | "monte_carlo_extreme";

const BOT_OPTIONS: { value: BotId; labelKey: string }[] = [
  { value: "random_bot",         labelKey: "game.bot.random"    },
  { value: "heuristic_bot",          labelKey: "game.bot.heuristic"},
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

  const selectMode = (m: Mode) => {
    setMode(prev => (prev === m ? null : m));   // toggle off if same
  };

  if (!username) return null;

  return (
    <div className="page">
      <Navbar username={username} onLogout={logout} />

      <main className="page-main">
        {/* Top username line */}
        <div className="home-header">
          <span className="home-username">{username}</span>
        </div>

        <h1 className="play-section-title">{t("home.play") ?? "PLAY"}</h1>

        {/* Two cards */}
        <div className="play-cards">
          <button
            type="button"
            className={`play-card${mode === "bot" ? " is-selected" : ""}`}
            onClick={() => selectMode("bot")}
            aria-pressed={mode === "bot"}
          >
            <div className="play-card__icon" aria-hidden="true">🤖</div>
            <span className="play-card__title">{t("home.card.bots") ?? "Game against bots"}</span>
          </button>

          <button
            type="button"
            className={`play-card${mode === "player" ? " is-selected" : ""}`}
            onClick={() => selectMode("player")}
            aria-pressed={mode === "player"}
          >
            <div className="play-card__icon" aria-hidden="true">👥</div>
            <span className="play-card__title">{t("home.card.players") ?? "Game against players"}</span>
          </button>
        </div>

        {/* Config panel — shown when a mode is selected */}
        {mode && (
          <div className="config-panel">
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
