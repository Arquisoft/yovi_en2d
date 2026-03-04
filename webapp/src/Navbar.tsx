import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";

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

          <div className="lang-toggle" role="group" aria-label={t("common.language")}>
            <button
              type="button"
              className={`lang-btn ${lang === "es" ? "is-active" : ""}`}
              onClick={() => setLang("es")}
              aria-pressed={lang === "es"}
            >
              ES
            </button>

            <button
              type="button"
              className={`lang-btn ${lang === "en" ? "is-active" : ""}`}
              onClick={() => setLang("en")}
              aria-pressed={lang === "en"}
            >
              EN
            </button>
          </div>

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