import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";

type LocationState = {
  username?: string;
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const username = useMemo(() => {
    const state = (location.state as LocationState | null) ?? null;
    return state?.username ?? localStorage.getItem("username") ?? "";
  }, [location.state]);

  useEffect(() => {
    if (!username) navigate("/", { replace: true });
  }, [username, navigate]);

  const startGame = () => {
    navigate("/game", { state: { username } });
  };

  const logout = () => {
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  };

  if (!username) return null;

  return (
    <div className="page">
      <Navbar username={username} onLogout={logout} />

      <main className="container">
        <section className="hero">
          <div className="hero__badge">🎮 Bienvenido</div>
          <h1 className="hero__title">Hola, {username}</h1>
          <p className="hero__subtitle">
            Listo para jugar una partida rápida contra el bot. Desde aquí arrancas el Game y también puedes comprobar conexión.
          </p>

          <div className="hero__actions">
            <button className="btn btn--primary" onClick={startGame} type="button">
              Empezar partida
            </button>
            <button className="btn btn--ghost" onClick={logout} type="button">
              Cambiar usuario
            </button>
          </div>
        </section>

        <section className="grid">
          <article className="card">
            <h3 className="card__title">⚡ Inicio rápido</h3>
            <p className="card__text">Entra al tablero y crea una partida nueva con un clic.</p>
            <button className="btn btn--secondary" onClick={startGame} type="button">
              Ir al Game
            </button>
          </article>

          <article className="card">
            <h3 className="card__title">🧠 Próximamente</h3>
            <p className="card__text">Modo smart bot, historial de partidas, ranking y ajustes.</p>
            <button className="btn btn--disabled" type="button" disabled>
              En construcción
            </button>
          </article>

          <article className="card">
            <h3 className="card__title">🛠️ Tips</h3>
            <ul className="card__list">
              <li>Si entras sin usuario, te mandará al registro.</li>
              <li>El nombre se guarda en localStorage.</li>
              <li>Logout borra el usuario y reinicia el flujo.</li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
};

export default Home;