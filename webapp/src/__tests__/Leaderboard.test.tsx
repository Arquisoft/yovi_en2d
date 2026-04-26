import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Leaderboard from "../Leaderboard";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderLeaderboard(username: string | null = "Pablo") {
  localStorage.clear();
  if (username) localStorage.setItem("username", username);

  return render(
    <I18nProvider>
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/leaderboard",
            state: username ? { username } : undefined,
          },
        ]}
      >
        <Leaderboard />
      </MemoryRouter>
    </I18nProvider>
  );
}

const SAMPLE_LEADERBOARD = [
  { username: "Alice",  wins: 10, losses: 2, total: 12, winRate: 83 },
  { username: "Bob",    wins: 7,  losses: 5, total: 12, winRate: 58 },
  { username: "Carlos", wins: 5,  losses: 8, total: 13, winRate: 38 },
  { username: "Diana",  wins: 3,  losses: 1, total: 4,  winRate: 75 },
];

function mockLeaderboardFetch(leaderboard = SAMPLE_LEADERBOARD) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, leaderboard }),
  } as unknown as Response);
}

function mockLeaderboardFetchError(error = "Failed to load leaderboard") {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    json: async () => ({ success: false, error }),
  } as unknown as Response);
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mockNavigate.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ── Rendering & initial state ─────────────────────────────────────────────────

describe("Leaderboard component", () => {
  test("renders the title and subtitle", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
      expect(screen.getByText(/LEADERBOARD|CLASIFICACIÓN/i)).toBeInTheDocument();
    });
  });

  test("redirects to root when username is missing", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, leaderboard: [] }),
    } as unknown as Response);

    renderLeaderboard(null);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  test("shows loading state initially", () => {
    global.fetch = vi.fn().mockReturnValueOnce(new Promise(() => {}));
    renderLeaderboard();

    expect(screen.getByText(/loading|cargando/i)).toBeInTheDocument();
  });

  test("renders all players after fetch resolves", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Carlos")).toBeInTheDocument();
      expect(screen.getByText("Diana")).toBeInTheDocument();
    });
  });

  test("shows empty state message when leaderboard is empty", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, leaderboard: [] }),
    } as unknown as Response);

    renderLeaderboard();

    await waitFor(() => {
      expect(screen.getByText(/No data yet|Sin datos/i)).toBeInTheDocument();
    });
  });

  test("shows error message when fetch fails with server error", async () => {
    mockLeaderboardFetchError("Failed to load leaderboard");
    renderLeaderboard();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load leaderboard/i)).toBeInTheDocument();
    });
  });

  test("shows network error message when fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));
    renderLeaderboard();

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });
});

// ── My rank banner ────────────────────────────────────────────────────────────

describe("Leaderboard – my rank banner", () => {
  test("shows the current user's rank banner when user is in the leaderboard", async () => {
    mockLeaderboardFetch();
    renderLeaderboard("Alice");

    await waitFor(() => {
      // The banner shows (you) / (tú) next to the username
      expect(screen.getByText(/you|tú/i)).toBeInTheDocument();
    });
  });

  test("shows medal emoji when user is in the top 3", async () => {
    mockLeaderboardFetch();
    renderLeaderboard("Alice"); // Alice is rank 1

    await waitFor(() => {
      // 🥇 appears at least once (rank banner + table row)
      expect(document.body.textContent).toContain("🥇");
    });
  });

  test("shows numeric rank when user is outside top 3", async () => {
    mockLeaderboardFetch();
    renderLeaderboard("Diana"); // Diana is rank 4

    await waitFor(() => {
      expect(screen.getByText(/#4/i)).toBeInTheDocument();
    });
  });

  test("does not show rank banner when user has no leaderboard entry", async () => {
    mockLeaderboardFetch();
    renderLeaderboard("Stranger"); // not in the sample data

    await waitFor(() => {
      // No (you) badge should appear
      expect(screen.queryByText(/\(you\)|\(tú\)/i)).not.toBeInTheDocument();
    });
  });

  test("rank banner shows correct wins, losses, and win rate for the current user", async () => {
    mockLeaderboardFetch();
    renderLeaderboard("Bob"); // 7W 5L 58%

    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("58%")).toBeInTheDocument();
    });
  });
});

// ── Podium ────────────────────────────────────────────────────────────────────

describe("Leaderboard – podium", () => {
  test("renders podium when there are 3 or more entries", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
      // All three medal emojis should appear (podium + table rows)
      expect(document.body.textContent).toContain("🥇");
      expect(document.body.textContent).toContain("🥈");
      expect(document.body.textContent).toContain("🥉");
    });
  });

  test("does not render podium when there are fewer than 3 entries", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        leaderboard: [
          { username: "Alice", wins: 5, losses: 1, total: 6, winRate: 83 },
          { username: "Bob",   wins: 2, losses: 3, total: 5, winRate: 40 },
        ],
      }),
    } as unknown as Response);

    renderLeaderboard();

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    // 🥉 should NOT appear (only 2 players)
    expect(document.body.textContent).not.toContain("🥉");
  });

  test("top player (rank 1) appears in the podium center", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
      // Alice has most wins so she should be rank 1
      expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    });
  });
});

// ── Sorting ───────────────────────────────────────────────────────────────────

describe("Leaderboard – sort metrics", () => {
  test("renders all four sort metric buttons", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Most Wins|Más Victorias/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Win Rate|% Victorias/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Most Active|Más Activo/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Most Losses|Más Derrotas/i })).toBeInTheDocument();
    });
  });

  test("clicking Win Rate button re-sorts entries by winRate descending", async () => {
    const user = userEvent.setup();
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => screen.getByText("Alice"));

    await user.click(screen.getByRole("button", { name: /Win Rate|% Victorias/i }));

    await waitFor(() => {
      // After sorting by winRate: Alice(83%) > Diana(75%) > Bob(58%) > Carlos(38%)
      const entries = screen.getAllByText(/\d+%/);
      // The first % value rendered in the table should be 83%
      expect(entries[0].textContent).toContain("83");
    });
  });

  test("clicking Most Losses button re-sorts entries by losses descending", async () => {
    const user = userEvent.setup();
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => screen.getByText("Alice"));

    await user.click(screen.getByRole("button", { name: /Most Losses|Más Derrotas/i }));

    // Carlos has 8 losses — should appear first
    await waitFor(() => {
      const rows = screen.getAllByText(/Carlos|Bob|Alice|Diana/);
      expect(rows[0].textContent).toContain("Carlos");
    });
  });

  test("clicking Most Active button re-sorts entries by total games descending", async () => {
    const user = userEvent.setup();
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => screen.getByText("Alice"));

    await user.click(screen.getByRole("button", { name: /Most Active|Más Activo/i }));

    // Carlos has 13 total games — should appear first
    await waitFor(() => {
      const rows = screen.getAllByText(/Carlos|Bob|Alice|Diana/);
      expect(rows[0].textContent).toContain("Carlos");
    });
  });

  test("default sort is by wins descending", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
      // Alice has 10 wins — should be listed first
      const rows = screen.getAllByText(/Alice|Bob|Carlos|Diana/);
      expect(rows[0].textContent).toContain("Alice");
    });
  });
});

// ── Table rows ────────────────────────────────────────────────────────────────

describe("Leaderboard – table rows", () => {
  test("shows medal emoji for ranks 1, 2, and 3", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
      expect(document.body.textContent).toContain("🥇");
      expect(document.body.textContent).toContain("🥈");
      expect(document.body.textContent).toContain("🥉");
    });
  });

  test("shows numeric rank for entries beyond position 3", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
      expect(screen.getByText("#4")).toBeInTheDocument();
    });
  });

  test("highlights current user row with 'you' badge", async () => {
    mockLeaderboardFetch();
    renderLeaderboard("Bob");

    await waitFor(() => {
      expect(screen.getByText(/^you$|^tú$/i)).toBeInTheDocument();
    });
  });

  test("does not show 'you' badge for other users", async () => {
    mockLeaderboardFetch();
    renderLeaderboard("Alice");

    await waitFor(() => screen.getByText("Bob"));

    // Only one "you" badge — next to Alice, not Bob
    const badges = screen.queryAllByText(/^you$|^tú$/i);
    expect(badges.length).toBe(1);
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe("Leaderboard – navigation", () => {
  test("fetch is called once on mount", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/leaderboard"));
  });

  test("logout clears localStorage and navigates to root", async () => {
    const user = userEvent.setup();
    mockLeaderboardFetch();
    renderLeaderboard("Pablo");

    await waitFor(() => screen.getByText(/LEADERBOARD|CLASIFICACIÓN/i));

    await user.click(screen.getByRole("button", { name: /logout|cerrar sesión/i }));

    expect(localStorage.getItem("username")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
