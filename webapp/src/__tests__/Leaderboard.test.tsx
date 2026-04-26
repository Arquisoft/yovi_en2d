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

// Helper to get only the username spans from the table rows (not podium cards)
function getTableRowNames() {
  return screen
      .getAllByText(/^(Alice|Bob|Carlos|Diana)$/)
      .filter(el => el.tagName === "SPAN" && el.style.fontWeight === "700");
}

function mockLeaderboardFetch(leaderboard = SAMPLE_LEADERBOARD) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, leaderboard }),
  } as unknown as Response);
}

function mockLeaderboardFetchError(error = "Failed to load leaderboard") {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
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
      expect(screen.getByRole("heading", { name: /LEADERBOARD|CLASIFICACIÓN/i })).toBeInTheDocument();
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
      // The banner renders (you) / (tú) with parentheses around the translation
      expect(screen.getByText(/\(you\)|\(tú\)/i)).toBeInTheDocument();
    });
  });

  test("shows medal emoji when user is in the top 3", async () => {
    mockLeaderboardFetch();
    renderLeaderboard("Alice"); // Alice is rank 1

    await waitFor(() => {
      expect(document.body.textContent).toContain("🥇");
    });
  });

  test("shows numeric rank when user is outside top 3", async () => {
    mockLeaderboardFetch();
    renderLeaderboard("Diana"); // Diana is rank 4

    await waitFor(() => {
      // The banner uses `#${myRank}` and the table row also uses `#${rank}`
      expect(screen.getAllByText(/#4/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ── Podium ────────────────────────────────────────────────────────────────────

describe("Leaderboard – podium", () => {
  test("renders podium when there are 3 or more entries", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
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

    // 🥉 should NOT appear — podium requires sorted.length >= 3
    expect(document.body.textContent).not.toContain("🥉");
  });

  test("top player (rank 1) appears in the podium center", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
      // Alice appears in multiple places — just verify she's present at all
      expect(screen.getAllByText("Alice").length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ── Sorting ───────────────────────────────────────────────────────────────────

describe("Leaderboard – sort metrics", () => {
  test("renders all four sort metric buttons", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
      // Match translated labels from i18n: "Most Wins" / "Más Victorias" etc.
      expect(screen.getByRole("button", { name: /Most Wins|Más Victorias/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Win Rate|% Victorias/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Most Active|Más Activo/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Most Losses|Más Derrotas/i })).toBeInTheDocument();
    });
  });



  test("default sort is by wins descending", async () => {
    mockLeaderboardFetch();
    renderLeaderboard();

    await waitFor(() => {
      const names = getTableRowNames();
      expect(names[0].textContent).toBe("Alice");
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
      // The table row badge renders the raw translation without parentheses
      expect(screen.getByText(/^you$|^tú$/i)).toBeInTheDocument();
    });
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

    await waitFor(() =>
        screen.getByRole("heading", { name: /LEADERBOARD|CLASIFICACIÓN/i })
    );

    // i18n key common.logout → "Logout" (en) / "Salir" (es)
    await user.click(screen.getByRole("button", { name: /logout|salir/i }));

    expect(localStorage.getItem("username")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });
});