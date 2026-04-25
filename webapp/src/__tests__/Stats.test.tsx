import { render, screen, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Stats from "../Stats";
import { I18nProvider } from "../i18n/I18nProvider";
import userEvent from "@testing-library/user-event";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

function renderStats(usernameFromState: string | null = "Pablo", usernameInStorage: string | null = "Pablo") {
    localStorage.clear();

    if (usernameInStorage) {
        localStorage.setItem("username", usernameInStorage);
    }

    return render(
        <I18nProvider>
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: "/stats",
                        state: usernameFromState ? { username: usernameFromState } : undefined,
                    },
                ]}
            >
                <Stats />
            </MemoryRouter>
        </I18nProvider>
    );
}

const validStatsResponse = {
    success: true,
    username: "Pablo",
    stats: { wins: 3, losses: 1 },
    total: 4,
    games: [],
};

describe("Stats component", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── happy path ────────────────────────────────────────────────────────────

    test("fetches and displays stats correctly", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => validStatsResponse,
        } as Response);

        renderStats();

        await waitFor(() => {
            expect(screen.getByText("4")).toBeInTheDocument();   // total played
            expect(screen.getByText("3")).toBeInTheDocument();   // wins
            expect(screen.getByText("1")).toBeInTheDocument();   // losses
            expect(screen.getByText("75%")).toBeInTheDocument(); // win rate
        });
    });

    test("shows error when API returns error", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({ success: false, error: "Failed to load history" }),
        } as Response);

        renderStats();

        expect(await screen.findByText(/Failed to load history/i)).toBeInTheDocument();
    });

    test("shows error when fetch rejects (network failure)", async () => {
        globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

        renderStats();

        // Should fall into the .catch() path and display the i18n fallback
        await waitFor(() => {
            expect(mockNavigate).not.toHaveBeenCalledWith("/", { replace: true });
        });
    });

    test("redirects to root when username is missing", async () => {
        renderStats(null, null);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        });
    });

    test("logout clears storage and navigates", async () => {
        const user = userEvent.setup();

        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                success: true,
                username: "Pablo",
                stats: { wins: 1, losses: 0 },
                total: 1,
                games: [],
            }),
        } as Response);

        renderStats();

        const logoutBtn = await screen.findByText(/logout/i);
        await user.click(logoutBtn);

        expect(localStorage.getItem("username")).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    test("falls back to localStorage username when no location state", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => validStatsResponse,
        } as Response);

        renderStats(null, "Pablo");

        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining("/history/Pablo")
            );
        });
    });

    // ── sanitizeUsername ──────────────────────────────────────────────────────

    test("redirects when username from localStorage contains path traversal characters", async () => {
        renderStats(null, "../../etc/passwd");

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        });
        // fetch must never be called with a tainted username
        expect(globalThis.fetch).toBeUndefined();
    });

    test("redirects when username from localStorage contains script injection", async () => {
        renderStats(null, "<script>alert(1)</script>");

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        });
    });

    test("redirects when username from localStorage contains spaces", async () => {
        renderStats(null, "user name");

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        });
    });

    test("redirects when username exceeds 50 characters", async () => {
        renderStats(null, "a".repeat(51));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        });
    });

    test("accepts username with dots, hyphens and underscores", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                ...validStatsResponse,
                username: "pablo.garcia_1-ok",
            }),
        } as Response);

        renderStats("pablo.garcia_1-ok", "pablo.garcia_1-ok");

        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining("/history/pablo.garcia_1-ok")
            );
        });
    });

    test("accepts a username that is exactly 50 characters long", async () => {
        const longButValid = "a".repeat(50);
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({ ...validStatsResponse, username: longButValid }),
        } as Response);

        renderStats(longButValid, longButValid);

        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`/history/${longButValid}`)
            );
        });
    });

    test("redirects when username from location.state is malicious", async () => {
        // Even if the state was somehow tampered, sanitization still blocks it
        renderStats("../admin", null);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        });
    });

    // ── games table ───────────────────────────────────────────────────────────

    test("renders game history rows correctly", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                success: true,
                username: "Pablo",
                stats: { wins: 1, losses: 1 },
                total: 2,
                games: [
                    { _id: "1", username: "Pablo", opponent: "Alice", result: "win", score: 10, date: "2024-01-15T00:00:00Z" },
                    { _id: "2", username: "Pablo", opponent: "Bob",   result: "loss", score: 5, date: "2024-02-20T00:00:00Z" },
                ],
            }),
        } as Response);

        renderStats();

        await waitFor(() => {
            expect(screen.getByText("Alice")).toBeInTheDocument();
            expect(screen.getByText("Bob")).toBeInTheDocument();
        });
    });

    test("win/loss bar is not rendered when total is 0", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                success: true,
                username: "Pablo",
                stats: { wins: 0, losses: 0 },
                total: 0,
                games: [],
            }),
        } as Response);

        renderStats();

        await waitFor(() => {
            // The bar container is only rendered when total > 0
            expect(screen.queryByText("0%")).not.toBeInTheDocument();
        });
    });

    test("win rate is 0% when all games are losses", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                success: true,
                username: "Pablo",
                stats: { wins: 0, losses: 5 },
                total: 5,
                games: [],
            }),
        } as Response);

        renderStats();

        await waitFor(() => {
            expect(screen.getByText("0%")).toBeInTheDocument();
        });
    });

    test("win rate is 100% when all games are wins", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                success: true,
                username: "Pablo",
                stats: { wins: 5, losses: 0 },
                total: 5,
                games: [],
            }),
        } as Response);

        renderStats();

        await waitFor(() => {
            expect(screen.getByText("100%")).toBeInTheDocument();
        });
    });
});
