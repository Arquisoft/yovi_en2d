import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.tsx";
import { useI18n } from "./i18n/I18nProvider";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

type SortMetric = "wins" | "winRate" | "total" | "losses";

type RankEntry = {
  username: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  lastGame?: string;
};

const MEDALS = ["🥇", "🥈", "🥉"];

const Avatar: React.FC<{ username: string; size?: number }> = ({ username, size = 36 }) => {
  const colors = ["#1e6bb8", "#b83232", "#1a7a4a", "#7b35b8", "#b87a1e", "#1e8ab8"];
  const color = colors[username.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Bebas Neue', sans-serif", fontSize: size * 0.38,
      letterSpacing: 1, flexShrink: 0, userSelect: "none",
    }}>
      {username.slice(0, 2).toUpperCase()}
    </div>
  );
};

const WinBar: React.FC<{ winRate: number; size?: "sm" | "md" }> = ({ winRate, size = "md" }) => (
  <div style={{ width: "100%", height: size === "sm" ? 4 : 6, background: "#e8e8f0", borderRadius: 99, overflow: "hidden" }}>
    <div style={{
      width: `${winRate}%`, height: "100%",
      background: winRate >= 60 ? "#1a7a4a" : winRate >= 40 ? "#1e6bb8" : "#b83232",
      borderRadius: 99, transition: "width 0.6s ease",
    }} />
  </div>
);

const METRICS: { key: SortMetric; label: string; emoji: string; desc: string }[] = [
  { key: "wins",    label: "Most Wins",      emoji: "🏆", desc: "Total wins" },
  { key: "winRate", label: "Win Rate",        emoji: "📈", desc: "Win %" },
  { key: "total",   label: "Most Active",     emoji: "🎮", desc: "Total games" },
  { key: "losses",  label: "Most Losses",     emoji: "💀", desc: "Total losses" },
];

const Leaderboard: React.FC = () => {
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

  const [entries, setEntries] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMetric, setSortMetric] = useState<SortMetric>("wins");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/leaderboard`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setEntries(data.leaderboard ?? []);
        else setError(data.error ?? "Failed to load leaderboard");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (sortMetric === "winRate") return b.winRate - a.winRate;
      if (sortMetric === "total")   return b.total - a.total;
      if (sortMetric === "losses")  return b.losses - a.losses;
      return b.wins - a.wins;
    });
  }, [entries, sortMetric]);

  const myRank = useMemo(() => sorted.findIndex(e => e.username === username) + 1, [sorted, username]);
  const me = useMemo(() => sorted.find(e => e.username === username) ?? null, [sorted, username]);

  const logout = () => { localStorage.removeItem("username"); navigate("/", { replace: true }); };
  if (!username) return null;

  return (
    <div className="page" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar username={username} onLogout={logout} />

      <main className="page-main" style={{ maxWidth: 800, margin: "0 auto", padding: "28px 20px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 6 }}>🏆</div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: "var(--accent)", margin: "0 0 6px", letterSpacing: 3 }}>
            {t("leaderboard.title") || "LEADERBOARD"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 15, margin: 0 }}>
            {t("leaderboard.subtitle") || "Who reigns supreme?"}
          </p>
        </div>

        {/* My rank banner */}
        {!loading && !error && me && (
          <div style={{
            background: "var(--surface)", border: "2px solid var(--accent)", borderRadius: 12,
            padding: "14px 20px", marginBottom: 24,
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "var(--accent)", minWidth: 40, textAlign: "center" }}>
              {myRank > 0 ? (myRank <= 3 ? MEDALS[myRank - 1] : `#${myRank}`) : "—"}
            </span>
            <Avatar username={me.username} size={40} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>{me.username} <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>(you)</span></p>
              <div style={{ marginTop: 4, maxWidth: 180 }}>
                <WinBar winRate={me.winRate} size="sm" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, textAlign: "center" }}>
              {[
                { label: "W", value: me.wins, color: "#1a7a4a" },
                { label: "L", value: me.losses, color: "#b83232" },
                { label: "%", value: `${me.winRate}%`, color: "var(--text)" },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sort metric picker */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {METRICS.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => setSortMetric(m.key)}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "2px solid",
                borderColor: sortMetric === m.key ? "var(--accent)" : "var(--border2)",
                background: sortMetric === m.key ? "var(--accent)" : "var(--surface)",
                color: sortMetric === m.key ? "#fff" : "var(--text)",
                fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all .15s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span>{m.emoji}</span> {m.label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <p style={{ fontWeight: 700 }}>{t("stats.loading") || "Loading…"}</p>
          </div>
        )}

        {error && (
          <p style={{ color: "var(--danger)", textAlign: "center", fontWeight: 700, padding: 20 }}>{error}</p>
        )}

        {!loading && !error && (
          <>
            {/* Podium — top 3 */}
            {sorted.length >= 3 && (
              <div style={{
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                gap: 12, marginBottom: 32, padding: "0 20px",
              }}>
                {/* 2nd */}
                <PodiumCard entry={sorted[1]} rank={2} metric={sortMetric} isMe={sorted[1]?.username === username} />
                {/* 1st */}
                <PodiumCard entry={sorted[0]} rank={1} metric={sortMetric} isMe={sorted[0]?.username === username} />
                {/* 3rd */}
                <PodiumCard entry={sorted[2]} rank={3} metric={sortMetric} isMe={sorted[2]?.username === username} />
              </div>
            )}

            {/* Full table */}
            {sorted.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <p style={{ fontWeight: 700 }}>{t("leaderboard.empty") || "No data yet. Play some games!"}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sorted.map((entry, i) => {
                  const isMe = entry.username === username;
                  const rank = i + 1;
                  return (
                    <div key={entry.username} style={{
                      background: isMe ? "#c0392b08" : "var(--surface)",
                      border: `2px solid ${isMe ? "var(--accent)" : "var(--border2)"}`,
                      borderRadius: 12, padding: "12px 18px",
                      display: "flex", alignItems: "center", gap: 14,
                      transition: "transform .15s",
                    }}
                      onMouseEnter={e => { if (!isMe) (e.currentTarget as HTMLDivElement).style.transform = "translateX(2px)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; }}
                    >
                      {/* Rank */}
                      <div style={{ minWidth: 36, textAlign: "center" }}>
                        {rank <= 3
                          ? <span style={{ fontSize: 22 }}>{MEDALS[rank - 1]}</span>
                          : <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--muted)" }}>#{rank}</span>
                        }
                      </div>

                      <Avatar username={entry.username} size={38} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{entry.username}</span>
                          {isMe && <span style={{ fontSize: 10, background: "#c0392b20", color: "#c0392b", padding: "1px 6px", borderRadius: 99, fontWeight: 700 }}>you</span>}
                        </div>
                        <WinBar winRate={entry.winRate} size="sm" />
                      </div>

                      {/* Stats */}
                      <div style={{ display: "flex", gap: 16, textAlign: "center", flexShrink: 0 }}>
                        <StatPill label="W" value={entry.wins} highlight={sortMetric === "wins"} color="#1a7a4a" />
                        <StatPill label="L" value={entry.losses} highlight={sortMetric === "losses"} color="#b83232" />
                        <StatPill label="%" value={`${entry.winRate}%`} highlight={sortMetric === "winRate"} color="#1e6bb8" />
                        <StatPill label="🎮" value={entry.total} highlight={sortMetric === "total"} color="var(--muted)" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const StatPill: React.FC<{ label: string; value: string | number; highlight: boolean; color: string }> = ({ label, value, highlight, color }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: highlight ? 20 : 17, color: highlight ? color : "var(--muted)", transition: "all .2s" }}>{value}</div>
    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{label}</div>
  </div>
);

const PodiumCard: React.FC<{ entry: RankEntry; rank: 1 | 2 | 3; metric: SortMetric; isMe: boolean }> = ({ entry, rank, metric, isMe }) => {
  const heights = { 1: 130, 2: 100, 3: 80 };
  const podiumColors = { 1: "#f5c518", 2: "#adb5bd", 3: "#cd7f32" };
  const metricValue = metric === "winRate" ? `${entry.winRate}%` : metric === "wins" ? `${entry.wins}W` : metric === "total" ? `${entry.total}` : `${entry.losses}L`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: rank === 1 ? "0 0 160px" : "0 0 130px" }}>
      <Avatar username={entry.username} size={rank === 1 ? 52 : 42} />
      <p style={{ fontWeight: 700, fontSize: rank === 1 ? 15 : 13, margin: "6px 0 2px", textAlign: "center", color: isMe ? "var(--accent)" : "var(--text)" }}>
        {entry.username}{isMe && " 👤"}
      </p>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: podiumColors[rank], margin: "0 0 6px" }}>{metricValue}</p>
      <div style={{
        width: "100%", height: heights[rank],
        background: podiumColors[rank],
        borderRadius: "8px 8px 0 0",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 10,
        border: isMe ? "2px solid var(--accent)" : "none",
      }}>
        <span style={{ fontSize: rank === 1 ? 32 : 24 }}>{MEDALS[rank - 1]}</span>
      </div>
    </div>
  );
};

export default Leaderboard;
