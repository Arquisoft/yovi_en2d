import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";

type FinishedState = {
  result?: "win" | "lost" | "draw";
};

const GameFinished: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const username = useMemo(() => localStorage.getItem("username") ?? "", []);
  const st = (location.state as FinishedState | null) ?? null;

  useEffect(() => {
    if (!username) navigate("/", { replace: true });
    if (!st?.result) navigate("/game", { replace: true });
  }, [username, st?.result, navigate]);

  const logout = () => {
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  };

  if (!username || !st?.result) return null;

  const text =
    st.result === "win" ? "Game Finished: You win" : st.result === "lost" ? "Game Finished: You lost" : "Game Finished: Draw";

  return (
    <div className="page">
      <Navbar username={username} onLogout={logout} />

      <main style={{ padding: 30, fontFamily: "system-ui", textAlign: "center" }}>
        <h1 style={{ marginTop: 40 }}>{text}</h1>

        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => navigate("/game", { replace: true })}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              background: "#A52019",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            Back to game
          </button>
        </div>
      </main>
    </div>
  );
};

export default GameFinished;