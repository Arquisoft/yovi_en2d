import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.tsx";
import { useI18n } from "./i18n/I18nProvider";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

type FriendStatus = "none" | "pending_sent" | "pending_received" | "friends";

type UserProfile = {
  username: string;
  email?: string;
  createdAt?: string;
  stats?: { wins: number; losses: number; total: number; winRate: number };
  friendStatus?: FriendStatus;
};

type FriendRequest = {
  _id: string;
  from: string;
  to: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
};

type Group = {
  _id: string;
  name: string;
  description?: string;
  owner: string;
  members: string[];
  createdAt: string;
};

const API = {
  searchUsers: (q: string, me: string) =>
    fetch(`${API_URL}/users/search?q=${encodeURIComponent(q)}&me=${encodeURIComponent(me)}`).then(r => r.json()),
  getProfile: (username: string, me: string) =>
    fetch(`${API_URL}/users/profile/${encodeURIComponent(username)}?me=${encodeURIComponent(me)}`).then(r => r.json()),
  getFriends: (username: string) =>
    fetch(`${API_URL}/friends/${encodeURIComponent(username)}`).then(r => r.json()),
  getRequests: (username: string) =>
    fetch(`${API_URL}/friends/requests/${encodeURIComponent(username)}`).then(r => r.json()),
  sendRequest: (from: string, to: string) =>
    fetch(`${API_URL}/friends/request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from, to }) }).then(r => r.json()),
  respondRequest: (id: string, action: "accept" | "reject") =>
    fetch(`${API_URL}/friends/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: id, action }) }).then(r => r.json()),
  removeFriend: (username: string, friend: string) =>
    fetch(`${API_URL}/friends/remove`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, friend }) }).then(r => r.json()),
  getGroups: (username: string) =>
    fetch(`${API_URL}/groups/${encodeURIComponent(username)}`).then(r => r.json()),
  createGroup: (name: string, description: string, owner: string) =>
    fetch(`${API_URL}/groups`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description, owner }) }).then(r => r.json()),
  joinGroup: (groupId: string, username: string) =>
    fetch(`${API_URL}/groups/${groupId}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) }).then(r => r.json()),
  leaveGroup: (groupId: string, username: string) =>
    fetch(`${API_URL}/groups/${groupId}/leave`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) }).then(r => r.json()),
  searchGroups: (q: string) =>
    fetch(`${API_URL}/groups/search?q=${encodeURIComponent(q)}`).then(r => r.json()),
};

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar: React.FC<{ username: string; size?: number }> = ({ username, size = 40 }) => {
  const colors = ["#1e6bb8", "#b83232", "#1a7a4a", "#7b35b8", "#b87a1e", "#1e8ab8"];
  const color = colors[username.charCodeAt(0) % colors.length];
  const initials = username.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Bebas Neue', sans-serif", fontSize: size * 0.38,
      letterSpacing: 1, flexShrink: 0, userSelect: "none",
    }}>
      {initials}
    </div>
  );
};

// ── Group Avatar ─────────────────────────────────────────────────────────────
const GroupAvatar: React.FC<{ name: string; size?: number }> = ({ name, size = 40 }) => {
  const colors = ["#2c7be5", "#6b48ff", "#00b274", "#e5630d", "#cc3a7a"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "10px",
      background: color, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, flexShrink: 0, userSelect: "none",
    }}>
      👥
    </div>
  );
};

// ── WinRate Bar ───────────────────────────────────────────────────────────────
const WinRateBar: React.FC<{ wins: number; losses: number }> = ({ wins, losses }) => {
  const total = wins + losses;
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
        <span>🏆 {wins}W</span>
        <span>{pct}%</span>
        <span>{losses}L 💀</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#f0f0f5", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct >= 50 ? "#1e6bb8" : "#b83232", borderRadius: 3, transition: "width .5s ease" }} />
      </div>
    </div>
  );
};

// ── Profile Modal ─────────────────────────────────────────────────────────────
interface ProfileModalProps {
  username: string;
  me: string;
  onClose: () => void;
  onStatusChange: () => void;
  t: (k: string) => string;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ username, me, onClose, onStatusChange, t }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    API.getProfile(username, me)
      .then(d => d.success ? setProfile(d.profile) : null)
      .finally(() => setLoading(false));
  }, [username, me]);

  const handleFriendAction = async () => {
    if (!profile) return;
    setActionBusy(true);
    try {
      if (profile.friendStatus === "none") {
        await API.sendRequest(me, username);
        setProfile(p => p ? { ...p, friendStatus: "pending_sent" } : p);
        onStatusChange();
      } else if (profile.friendStatus === "friends") {
        await API.removeFriend(me, username);
        setProfile(p => p ? { ...p, friendStatus: "none" } : p);
        onStatusChange();
      }
    } finally {
      setActionBusy(false);
    }
  };

  const friendLabel = () => {
    switch (profile?.friendStatus) {
      case "friends":          return t("social.removeFriend") || "Remove Friend";
      case "pending_sent":     return t("social.pending") || "Request Sent";
      case "pending_received": return t("social.accept") || "Accept Request";
      default:                 return t("social.addFriend") || "Add Friend";
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--surface)", borderRadius: 16,
        padding: "32px 28px", width: "100%", maxWidth: 400,
        border: "2px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        animation: "modalPop .3s cubic-bezier(.34,1.56,.64,1)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <style>{`@keyframes modalPop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>⏳ Loading…</div>
        ) : profile ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <Avatar username={profile.username} size={72} />
              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, margin: "0 0 2px", letterSpacing: 1 }}>{profile.username}</h2>
                {profile.createdAt && (
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                    {t("social.memberSince") || "Member since"} {new Date(profile.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
                  </p>
                )}
              </div>
              {profile.friendStatus === "friends" && (
                <span style={{ background: "#1e6bb820", color: "#1e6bb8", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, letterSpacing: .5 }}>
                  ✓ {t("social.friends") || "Friends"}
                </span>
              )}
            </div>

            {profile.stats && (
              <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 12 }}>
                  {[
                    { label: t("stats.played") || "Played", value: profile.stats.total },
                    { label: t("stats.wins") || "Wins", value: profile.stats.wins },
                    { label: t("stats.losses") || "Losses", value: profile.stats.losses },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "var(--accent)" }}>{s.value}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .5 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <WinRateBar wins={profile.stats.wins} losses={profile.stats.losses} />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {username !== me && (
                <button
                  type="button"
                  className={`btn btn--full ${profile.friendStatus === "friends" ? "btn--outline" : profile.friendStatus === "pending_sent" ? "btn--outline" : "btn--primary"}`}
                  onClick={handleFriendAction}
                  disabled={actionBusy || profile.friendStatus === "pending_sent"}
                  style={{ fontSize: 14 }}
                >
                  {actionBusy ? "…" : friendLabel()}
                </button>
              )}
              <button type="button" className="btn btn--outline btn--full" onClick={onClose} style={{ fontSize: 14 }}>
                {t("social.close") || "Close"}
              </button>
            </div>
          </>
        ) : (
          <p style={{ textAlign: "center", color: "var(--muted)" }}>User not found</p>
        )}
      </div>
    </div>
  );
};

// ── Group Detail Modal ────────────────────────────────────────────────────────
interface GroupModalProps {
  group: Group;
  me: string;
  onClose: () => void;
  onGroupsChange: () => void;
  onViewProfile: (username: string) => void;
  t: (k: string) => string;
}

const GroupModal: React.FC<GroupModalProps> = ({ group, me, onClose, onGroupsChange, onViewProfile, t }) => {
  const [busy, setBusy] = useState(false);
  const isMember = group.members.includes(me);
  const isOwner = group.owner === me;

  const handleJoinLeave = async () => {
    setBusy(true);
    try {
      if (isMember) {
        await API.leaveGroup(group._id, me);
      } else {
        await API.joinGroup(group._id, me);
      }
      onGroupsChange();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--surface)", borderRadius: 16,
        padding: "32px 28px", width: "100%", maxWidth: 440,
        border: "2px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        animation: "modalPop .3s cubic-bezier(.34,1.56,.64,1)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <style>{`@keyframes modalPop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <GroupAvatar name={group.name} size={64} />
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, margin: "0 0 4px", letterSpacing: 1 }}>{group.name}</h2>
            {group.description && <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{group.description}</p>}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ background: "var(--surface2)", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: "var(--muted)" }}>
              👑 {group.owner}
            </span>
            <span style={{ background: "var(--surface2)", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: "var(--muted)" }}>
              {group.members.length} members
            </span>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Members</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
            {group.members.map(member => (
              <div key={member} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 8, background: "var(--surface2)",
                cursor: "pointer",
              }}
                onClick={() => { onViewProfile(member); onClose(); }}
              >
                <Avatar username={member} size={32} />
                <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{member}</span>
                {member === group.owner && (
                  <span style={{ fontSize: 10, background: "#c0392b20", color: "#c0392b", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>Owner</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!isOwner && (
            <button
              type="button"
              className={`btn btn--full ${isMember ? "btn--outline" : "btn--primary"}`}
              onClick={handleJoinLeave}
              disabled={busy}
              style={{ fontSize: 14 }}
            >
              {busy ? "…" : isMember ? (t("social.leaveGroup") || "Leave Group") : (t("social.joinGroup") || "Join Group")}
            </button>
          )}
          <button type="button" className="btn btn--outline btn--full" onClick={onClose} style={{ fontSize: 14 }}>
            {t("social.close") || "Close"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Create Group Modal ────────────────────────────────────────────────────────
interface CreateGroupModalProps {
  me: string;
  onClose: () => void;
  onCreated: () => void;
  t: (k: string) => string;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ me, onClose, onCreated, t }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { setError("Group name is required"); return; }
    setBusy(true);
    setError(null);
    try {
      const data = await API.createGroup(name.trim(), description.trim(), me);
      if (data.success) { onCreated(); onClose(); }
      else setError(data.error || "Failed to create group");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--surface)", borderRadius: 16,
        padding: "32px 28px", width: "100%", maxWidth: 400,
        border: "2px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        animation: "modalPop .3s cubic-bezier(.34,1.56,.64,1)",
      }}>
        <style>{`@keyframes modalPop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, margin: "0 0 20px", letterSpacing: 1 }}>
          {t("social.createGroup") || "Create Group"}
        </h2>

        <div className="form-group">
          <label className="form-label">{t("social.groupName") || "Group Name"}</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. The Champions"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={40}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t("social.groupDesc") || "Description (optional)"}</label>
          <input
            type="text"
            className="form-input"
            placeholder="A short description…"
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={120}
          />
        </div>

        {error && <p className="msg msg--error">{error}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn--primary btn--full" onClick={handleCreate} disabled={busy}>
            {busy ? "…" : t("social.createGroup") || "Create Group"}
          </button>
          <button type="button" className="btn btn--outline btn--full" onClick={onClose}>
            {t("social.close") || "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Social Component ────────────────────────────────────────────────────
const Social: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const username = useMemo(() => {
    const st = (location.state as { username?: string } | null) ?? null;
    return st?.username ?? localStorage.getItem("username") ?? "";
  }, [location.state]);

  useEffect(() => { if (!username) navigate("/", { replace: true }); }, [username, navigate]);

  const [tab, setTab] = useState<"friends" | "search" | "requests" | "groups">("friends");
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [groupSearchQ, setGroupSearchQ] = useState("");
  const [groupSearchResults, setGroupSearchResults] = useState<Group[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [profileModal, setProfileModal] = useState<string | null>(null);
  const [groupModal, setGroupModal] = useState<Group | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);

  const loadFriends = useCallback(() => {
    if (!username) return;
    setFriendsLoading(true);
    Promise.all([
      API.getFriends(username),
      API.getRequests(username),
      API.getGroups(username),
    ]).then(([fr, rq, gr]) => {
      if (fr.success) setFriends(fr.friends ?? []);
      if (rq.success) setRequests(rq.requests ?? []);
      if (gr.success) setGroups(gr.groups ?? []);
    }).finally(() => setFriendsLoading(false));
  }, [username]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  // Debounced user search
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const data = await API.searchUsers(searchQ, username).catch(() => null);
      setSearchResults(data?.success ? data.users : []);
      setSearchLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQ, username]);

  // Debounced group search
  useEffect(() => {
    if (!groupSearchQ.trim()) { setGroupSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setGroupSearchLoading(true);
      const data = await API.searchGroups(groupSearchQ).catch(() => null);
      setGroupSearchResults(data?.success ? data.groups : []);
      setGroupSearchLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [groupSearchQ]);

  const handleRespond = async (id: string, action: "accept" | "reject") => {
    setRequestBusy(id);
    await API.respondRequest(id, action).catch(() => null);
    setRequestBusy(null);
    loadFriends();
  };

  const pendingReceived = requests.filter(r => r.to === username && r.status === "pending");

  const logout = () => { localStorage.removeItem("username"); navigate("/", { replace: true }); };
  if (!username) return null;

  const tabs = [
    { key: "friends" as const,  label: t("social.tab.friends")  || "Friends",     badge: friends.length },
    { key: "requests" as const, label: t("social.tab.requests") || "Requests",    badge: pendingReceived.length },
    { key: "groups" as const,   label: t("social.tab.groups")   || "Groups",      badge: groups.length },
    { key: "search" as const,   label: t("social.tab.search")   || "Find Players", badge: 0 },
  ];

  return (
    <div className="page" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar username={username} onLogout={logout} />

      {profileModal && (
        <ProfileModal
          username={profileModal}
          me={username}
          onClose={() => setProfileModal(null)}
          onStatusChange={loadFriends}
          t={t}
        />
      )}

      {groupModal && (
        <GroupModal
          group={groupModal}
          me={username}
          onClose={() => setGroupModal(null)}
          onGroupsChange={loadFriends}
          onViewProfile={u => setProfileModal(u)}
          t={t}
        />
      )}

      {showCreateGroup && (
        <CreateGroupModal
          me={username}
          onClose={() => setShowCreateGroup(false)}
          onCreated={loadFriends}
          t={t}
        />
      )}

      <main className="page-main" style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, color: "var(--accent)", margin: "0 0 4px", letterSpacing: 2 }}>
            {t("social.title") || "COMMUNITY"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 15, margin: 0 }}>
            {t("social.subtitle") || "Connect with other players"}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "2px solid var(--border2)", borderRadius: 10, padding: 4, marginBottom: 24, maxWidth: 600, margin: "0 auto 24px" }}>
          {tabs.map(tab_ => (
            <button
              key={tab_.key}
              type="button"
              onClick={() => setTab(tab_.key)}
              style={{
                flex: 1, padding: "8px 6px", borderRadius: 7, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 12, letterSpacing: .4,
                background: tab === tab_.key ? "var(--accent)" : "transparent",
                color: tab === tab_.key ? "#fff" : "var(--muted)",
                transition: "all .15s", position: "relative",
              }}
            >
              {tab_.label}
              {tab_.badge > 0 && (
                <span style={{
                  position: "absolute", top: 4, right: 6,
                  background: tab === tab_.key ? "#fff" : "var(--accent)",
                  color: tab === tab_.key ? "var(--accent)" : "#fff",
                  borderRadius: 999, fontSize: 10, fontWeight: 700,
                  padding: "1px 5px", lineHeight: 1.4,
                }}>{tab_.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Friends Tab */}
        {tab === "friends" && (
          <div>
            {friendsLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>⏳ {t("stats.loading") || "Loading…"}</div>
            ) : friends.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--muted)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
                <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>{t("social.noFriends") || "No friends yet"}</p>
                <p style={{ fontSize: 14, margin: 0 }}>{t("social.searchHint") || "Search for players to add them!"}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {friends.map(f => (
                  <div key={f.username} style={{
                    background: "var(--surface)", border: "2px solid var(--border2)", borderRadius: 12,
                    padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
                    cursor: "pointer", transition: "border-color .15s, transform .15s",
                  }}
                    onClick={() => setProfileModal(f.username)}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLDivElement).style.transform = "translateX(2px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border2)"; (e.currentTarget as HTMLDivElement).style.transform = ""; }}
                  >
                    <Avatar username={f.username} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 2px", color: "var(--text)" }}>{f.username}</p>
                      {f.stats && (
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                          {f.stats.total} {t("stats.played") || "games"} · {f.stats.wins}W {f.stats.losses}L
                        </p>
                      )}
                    </div>
                    {f.stats && (
                      <div style={{ width: 80 }}>
                        <WinRateBar wins={f.stats.wins} losses={f.stats.losses} />
                      </div>
                    )}
                    <span style={{ fontSize: 18, color: "var(--border2)" }}>›</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {tab === "requests" && (
          <div>
            {pendingReceived.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--muted)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{t("social.noRequests") || "No pending requests"}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {pendingReceived.map(req => (
                  <div key={req._id} style={{
                    background: "var(--surface)", border: "2px solid var(--border2)", borderRadius: 12,
                    padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
                  }}>
                    <Avatar username={req.from} size={44} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 2px" }}>{req.from}</p>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                        {new Date(req.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn--primary"
                        style={{ padding: "7px 14px", fontSize: 13 }}
                        disabled={requestBusy === req._id}
                        onClick={() => handleRespond(req._id, "accept")}
                      >
                        {requestBusy === req._id ? "…" : t("social.accept") || "Accept"}
                      </button>
                      <button
                        type="button"
                        className="btn btn--outline"
                        style={{ padding: "7px 14px", fontSize: 13 }}
                        disabled={requestBusy === req._id}
                        onClick={() => handleRespond(req._id, "reject")}
                      >
                        {t("social.reject") || "Decline"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Groups Tab */}
        {tab === "groups" && (
          <div>
            {/* My groups */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, margin: 0, color: "var(--text)", letterSpacing: 1 }}>
                {t("social.myGroups") || "My Groups"}
              </h3>
              <button type="button" className="btn btn--primary" style={{ padding: "8px 16px", fontSize: 13 }}
                onClick={() => setShowCreateGroup(true)}>
                + {t("social.createGroup") || "Create Group"}
              </button>
            </div>

            {friendsLoading ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>⏳</div>
            ) : groups.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--muted)", marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
                <p style={{ fontWeight: 700, margin: 0 }}>{t("social.noGroups") || "You're not in any groups yet"}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
                {groups.map(g => (
                  <div key={g._id} style={{
                    background: "var(--surface)", border: "2px solid var(--border2)", borderRadius: 12,
                    padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
                    cursor: "pointer", transition: "border-color .15s, transform .15s",
                  }}
                    onClick={() => setGroupModal(g)}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLDivElement).style.transform = "translateX(2px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border2)"; (e.currentTarget as HTMLDivElement).style.transform = ""; }}
                  >
                    <GroupAvatar name={g.name} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 2px" }}>{g.name}</p>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                        {g.members.length} members · {t("social.owner") || "Owner"}: {g.owner}
                      </p>
                    </div>
                    {g.owner === username && (
                      <span style={{ fontSize: 10, background: "#c0392b20", color: "#c0392b", padding: "3px 10px", borderRadius: 999, fontWeight: 700 }}>Owner</span>
                    )}
                    <span style={{ fontSize: 18, color: "var(--border2)" }}>›</span>
                  </div>
                ))}
              </div>
            )}

            {/* Find groups */}
            <div style={{ borderTop: "2px solid var(--border2)", paddingTop: 20 }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, margin: "0 0 12px", color: "var(--text)", letterSpacing: 1 }}>
                {t("social.findGroups") || "Find Groups"}
              </h3>
              <div style={{ position: "relative", marginBottom: 16 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t("social.searchGroupsPlaceholder") || "Search groups…"}
                  value={groupSearchQ}
                  onChange={e => setGroupSearchQ(e.target.value)}
                  style={{ width: "100%", paddingLeft: 40 }}
                />
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</span>
              </div>

              {groupSearchLoading && <div style={{ textAlign: "center", color: "var(--muted)" }}>⏳</div>}

              {groupSearchResults.length > 0 && (
                <div style={{ display: "grid", gap: 10 }}>
                  {groupSearchResults.map(g => {
                    const isMember = g.members.includes(username);
                    return (
                      <div key={g._id} style={{
                        background: "var(--surface)", border: "2px solid var(--border2)", borderRadius: 12,
                        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                        cursor: "pointer", transition: "border-color .15s",
                      }}
                        onClick={() => setGroupModal(g)}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border2)"}
                      >
                        <GroupAvatar name={g.name} size={40} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 700, fontSize: 14, margin: "0 0 1px" }}>{g.name}</p>
                          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{g.members.length} members</p>
                        </div>
                        {isMember && <span style={{ fontSize: 11, background: "#1e6bb820", color: "#1e6bb8", padding: "3px 10px", borderRadius: 999, fontWeight: 700 }}>✓ Joined</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search Tab */}
        {tab === "search" && (
          <div>
            <div style={{ marginBottom: 20, position: "relative" }}>
              <input
                type="text"
                className="form-input"
                placeholder={t("social.searchPlaceholder") || "Search by username…"}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                style={{ width: "100%", paddingLeft: 40, fontSize: 15 }}
                autoFocus
              />
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</span>
            </div>

            {searchLoading && (
              <div style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>⏳</div>
            )}

            {!searchLoading && searchQ && searchResults.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--muted)" }}>
                <p style={{ fontWeight: 700 }}>{t("social.noResults") || "No players found"}</p>
              </div>
            )}

            {searchResults.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                {searchResults.map(u => (
                  <div key={u.username} style={{
                    background: "var(--surface)", border: "2px solid var(--border2)", borderRadius: 12,
                    padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                    cursor: "pointer", transition: "border-color .15s",
                  }}
                    onClick={() => setProfileModal(u.username)}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border2)"}
                  >
                    <Avatar username={u.username} size={40} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, margin: "0 0 1px" }}>{u.username}</p>
                      {u.stats && (
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{u.stats.total} games played</p>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                      background: u.friendStatus === "friends" ? "#1e6bb820" : u.friendStatus?.startsWith("pending") ? "#f5a62320" : "var(--surface2)",
                      color: u.friendStatus === "friends" ? "#1e6bb8" : u.friendStatus?.startsWith("pending") ? "#c67d00" : "var(--muted)",
                    }}>
                      {u.friendStatus === "friends" ? "✓ " + (t("social.friends") || "Friends")
                        : u.friendStatus === "pending_sent" ? t("social.pending") || "Pending"
                        : u.friendStatus === "pending_received" ? t("social.accept") || "Accept"
                        : ""}
                    </span>
                    <span style={{ fontSize: 18, color: "var(--border2)" }}>›</span>
                  </div>
                ))}
              </div>
            )}

            {!searchQ && (
              <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--muted)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{t("social.typeToSearch") || "Type to find players"}</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Social;
