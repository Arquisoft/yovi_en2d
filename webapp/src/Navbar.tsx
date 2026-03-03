import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import type { Lang } from "./i18n/translations";

type NavbarProps = {
  username?: string | null;
  onLogout?: () => void;
};

const Navbar: React.FC<NavbarProps> = ({ username, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang, t } = useI18n();

  const go = (path: string) => navigate(path);

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <button className="navbar__brand" onClick={() => go("/home")} type="button" aria-label="Ir a Home">
          <span className="navbar__brandDot" aria-hidden="true" />
          {t("app.brand")}
        </button>

        <div className="navbar__right">
          <div className="navbar__user" aria-label="Usuario actual">
            👤 {t("common.user")}: {username || "—"}
          </div>

          <select
            className="lang-select"
            aria-label={t("common.language")}
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>

          <nav className="navbar__actions" aria-label="Navegación principal">
            <button
              type="button"
              className="navbtn"
              aria-current={location.pathname === "/home" ? "page" : undefined}
              onClick={() => go("/home")}
            >
              {t("common.home")}
            </button>

            <button
              type="button"
              className="navbtn"
              aria-current={location.pathname === "/game" ? "page" : undefined}
              onClick={() => go("/game")}
            >
              {t("common.game")}
            </button>

            <button type="button" className="navbtn navbtn--danger" onClick={onLogout}>
              {t("common.logout")}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navbar;