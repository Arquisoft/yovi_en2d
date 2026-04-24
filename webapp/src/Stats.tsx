import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.tsx";
import { useI18n } from "./i18n/I18nProvider";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

type GameEntry = {
    _id: string;
    username: string;
    opponent: string;
    result: "win" | "loss";
    score: number;
    date: string;
};

type StatsData = {
    username: string;
    stats: { wins: number; losses: number };
    total: number;
    games: GameEntry[];
};

const Stats: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useI18n();

    const username = useMemo(() => {
        const st = (location.state as { username?: string } | null) ?? null;
        return st?.username ?? localStorage.getItem("username") ?? "";
    }, [location.state]);

    useEffect(() => {
        if (!username) navigate("/", { replace: true });
    }, [username, navigate]);

    const [data, setData] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!username) return;
        setLoading(true);
        setError(null);
        fetch(`${API_URL}/history/${encodeURIComponent(username)}`)
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setData(json);
                else setError(json.error ?? t("stats.noGames"));
            })
            .catch(() => setError(t("stats.noGames")))
            .finally(() => setLoading(false));
    }, [username, t]);

    const logout = () => {
        localStorage.removeItem("username");
        navigate("/", { replace: true });
    };

    if (!username) return null;

    const winRate =
        data && data.total > 0
            ? Math.round((data.stats.wins / data.total) * 100)
            : 0;

    return (
        <div className="page" style={{ padding: "20px", background: "var(--bg)" }}>
            <Navbar username={username} onLogout={logout} />

            <main className="page-main" style={{ maxWidth: 900, margin: "0 auto" }}>
                <h1
                    style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: 36,
                        letterSpacing: 2,
                        textAlign: "center",
                        marginBottom: 32,
                        color: "var(--accent)",
                    }}
                >
                    {t("stats.title")}
                </h1>

                {loading && (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                        <span style={{ fontSize: 32 }}>⏳</span>
                        <p style={{ fontWeight: 700, marginTop: 8 }}>{t("stats.loading")}</p>
                    </div>
                )}

                {error && (
                    <p style={{ color: "var(--danger)", textAlign: "center", fontWeight: 700 }}>
                        {error}
                    </p>
                )}

                {!loading && !error && data && (
                    <>
                        {/* Summary Cards */}
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                gap: 20,
                                flexWrap: "wrap",
                                marginBottom: 32,
                            }}
                        >
                            <StatCard emoji="🎮" label={t("stats.played")} value={data.total} color="#001f5b" />
                            <StatCard emoji="🏆" label={t("stats.wins")} value={data.stats.wins} color="#1a75ff" />
                            <StatCard emoji="💀" label={t("stats.losses")} value={data.stats.losses} color="#ff3b3b" />
                            <StatCard
                                emoji="📈"
                                label={t("stats.winRate")}
                                value={`${winRate}%`}
                                color={winRate >= 50 ? "#1a75ff" : "#ff3b3b"}
                            />
                        </div>

                        {/* Win/Loss Bar */}
                        {data.total > 0 && (
                            <div
                                style={{
                                    background: "white",
                                    borderRadius: 12,
                                    padding: 20,
                                    marginBottom: 32,
                                    maxWidth: 700,
                                    marginLeft: "auto",
                                    marginRight: "auto",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginBottom: 8,
                                        fontWeight: 700,
                                        fontSize: 14,
                                        color: "#555",
                                    }}
                                >
                  <span>
                    🏆 {data.stats.wins} {t("stats.wins")}
                  </span>
                                    <span>
                    {data.stats.losses} {t("stats.losses")} 💀
                  </span>
                                </div>
                                <div
                                    style={{
                                        height: 24,
                                        borderRadius: 12,
                                        background: "#ff3b3b33",
                                        overflow: "hidden",
                                        display: "flex",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${winRate}%`,
                                            background: "#1a75ff",
                                            transition: "width .6s ease",
                                            borderRadius: "12px 0 0 12px",
                                        }}
                                    />
                                    <div style={{ flex: 1 }} />
                                </div>
                            </div>
                        )}

                        {/* History Table */}
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                                <thead>
                                <tr style={{ background: "#f0f0f0" }}>
                                    <th
                                        style={{
                                            padding: "12px 16px",
                                            textAlign: "left",
                                            color: "#001f5b",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {t("stats.col.result")}
                                    </th>
                                    <th
                                        style={{
                                            padding: "12px 16px",
                                            textAlign: "left",
                                            color: "#001f5b",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {t("stats.col.opponent")}
                                    </th>
                                    <th
                                        style={{
                                            padding: "12px 16px",
                                            textAlign: "left",
                                            color: "#001f5b",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {t("stats.col.date")}
                                    </th>
                                </tr>
                                </thead>
                                <tbody>
                                {data.games.map((game, i) => (
                                    <tr key={game._id} style={{ background: i % 2 === 0 ? "white" : "#f9f9f9" }}>
                                        <td
                                            style={{
                                                padding: "12px 16px",
                                                fontWeight: 700,
                                                color: game.result === "win" ? "#1a75ff" : "#ff3b3b",
                                            }}
                                        >
                                            {game.result === "win" ? t("stats.win") : t("stats.loss")}
                                        </td>
                                        <td style={{ padding: "12px 16px" }}>{game.opponent}</td>
                                        <td style={{ padding: "12px 16px", color: "#555" }}>
                                            {new Date(game.date).toLocaleDateString(undefined, {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};

const StatCard: React.FC<{
    emoji: string;
    label: string;
    value: string | number;
    color: string;
}> = ({ emoji, label, value, color }) => (
    <div
        style={{
            flex: "1 1 120px",
            minWidth: 120,
            background: "white",
            borderRadius: 12,
            padding: 18,
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            transition: "transform .2s, box-shadow .2s",
        }}
        className="stat-card"
    >
        <div style={{ fontSize: 28, marginBottom: 6 }}>{emoji}</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color, marginBottom: 4 }}>
            {value}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>
            {label}
        </div>
    </div>
);

export default Stats;