import React from "react";
import { useI18n } from "./i18n/I18nProvider";

const LanguageToggle: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { lang, setLang } = useI18n();
  return (
    <div className={`lang-toggle ${className}`.trim()} role="group" aria-label="Language">
      <button
        type="button"
        className={`lang-btn${lang === "es" ? " is-active" : ""}`}
        onClick={() => setLang("es")}
        aria-pressed={lang === "es"}
      >ES</button>
      <button
        type="button"
        className={`lang-btn${lang === "en" ? " is-active" : ""}`}
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
      >EN</button>
    </div>
  );
};

export default LanguageToggle;
