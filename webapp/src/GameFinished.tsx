import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.tsx";
import { useI18n } from "./i18n/I18nProvider";

type FinishedState = { result?: "win" | "lost" | "draw" };

const RESULT_MAP = {
  win:  { emoji: "🏆", colorKey: "--ok"     },
  lost: { emoji: "💀", colorKey: "--danger"  },
  draw: { emoji: "🤝", colorKey: "--muted"   },
};

const GameFinished: React.FC = () => {
  const { t }    = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const username = useMemo(() => localStorage.getItem("username") ?? "", []);
  const st = (location.state as FinishedState | null) ?? null;

  useEffect(() => {
    if (!username) navigate("/", { replace: true });
    if (!st?.result) navigate("/game", { replace: true });
  }, [username, st?.result, navigate]);

  const logout = () => { localStorage.removeItem("username"); navigate("/", { replace: true }); };
  if (!username || !st?.result) return null;

  const result = st.result;
  const meta   = RESULT_MAP[result];

  const textMap: Record<string, string> = {
    win:  t("game.finished.win"),
    lost: t("game.finished.lost"),
    draw: t("game.finished.draw"),
  };

  return (
    <div className="finished-page">
      <Navbar username={username} onLogout={logout} />

      <div className="finished-body">
        <div className="finished-card">
          <div className="finished-emoji">{meta.emoji}</div>
          <h1 className="finished-title" style={{ color: `var(${meta.colorKey})` }}>
            {textMap[result]}
          </h1>
          <p className="finished-sub">
            {result === "win"  ? (t("game.finished.winSub")  ?? "Well played!") :
             result === "lost" ? (t("game.finished.lostSub") ?? "Better luck next time.") :
                                 (t("game.finished.drawSub") ?? "So close!")}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              type="button"
              className="btn btn--primary btn--full btn--lg"
              onClick={() => navigate("/game", { replace: true, state: { username } })}
            >
              {t("game.finished.back") ?? "Play Again"}
            </button>
            <button
              type="button"
              className="btn btn--outline btn--full"
              onClick={() => navigate("/home", { state: { username } })}
            >
              {t("common.home") ?? "Home"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameFinished;
