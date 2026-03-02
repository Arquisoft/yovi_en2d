import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

type NavbarProps = {
  username?: string | null;
  onLogout?: () => void;
};

const Navbar: React.FC<NavbarProps> = ({ username, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const go = (path: string) => navigate(path);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="nav">
      <button className="nav__brand" onClick={() => go("/home")} type="button">
        GameY
      </button>

      <div className="nav__right">
        {username ? <span className="nav__user">👤 {username}</span> : <span className="nav__user">👤 Invitado</span>}

        <div className="nav__actions">
          <button
            type="button"
            className={`nav__btn ${isActive("/home") ? "nav__btn--active" : ""}`}
            onClick={() => go("/home")}
          >
            Home
          </button>

          <button
            type="button"
            className={`nav__btn ${isActive("/game") ? "nav__btn--active" : ""}`}
            onClick={() => go("/game")}
          >
            Game
          </button>

          <button
            type="button"
            className="nav__btn nav__btn--danger"
            onClick={() => (onLogout ? onLogout() : go("/"))}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;