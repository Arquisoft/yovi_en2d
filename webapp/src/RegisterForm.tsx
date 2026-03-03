import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import type { Lang } from "./i18n/translations";

const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const { lang, setLang, t } = useI18n();

  const [username, setUsername] = useState("");
  const [responseMessage, setResponseMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setResponseMessage(null);
    setError(null);

    if (!username.trim()) {
      setError(t("register.error.empty"));
      return;
    }

    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
      const res = await fetch(`${API_URL}/createuser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();

      if (res.ok) {
        setResponseMessage(data.message);
        localStorage.setItem("username", username);
        navigate("/home", { state: { username } });
      } else {
        setError(data.error || t("register.error.server"));
      }
    } catch (err: any) {
      setError(err.message || t("register.error.network"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <form onSubmit={handleSubmit} className="register-form" aria-label="Registro de usuario">

        <div className="register-toprow">
          <span style={{ fontWeight: 900, opacity: 0.95 }}>{t("register.title")}</span>

          <select
            className="lang-select"
            aria-label={t("common.language")}
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="username">{t("register.label")}</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="form-input"
            placeholder={t("register.placeholder")}
            autoComplete="nickname"
          />
        </div>

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? t("register.loading") : t("register.button")}
        </button>

        {responseMessage && (
          <div className="success-message" style={{ marginTop: 8 }}>
            {responseMessage}
          </div>
        )}

        {error && (
          <div className="error-message" style={{ marginTop: 8 }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default RegisterForm;