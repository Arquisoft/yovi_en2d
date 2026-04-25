import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Game from "../Game";
import { I18nProvider } from "../i18n/I18nProvider";

console.log('Game:', Game);

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderGame(
    usernameFromState: string | null = "Pablo",
    mode: "bot" | "player" = "bot",
    botId = "random_bot",
    boardSize = 3
) {
  localStorage.clear();
  if (usernameFromState) localStorage.setItem("username", usernameFromState);

  return render(
      <I18nProvider>
        <MemoryRouter
            initialEntries={[
              {
                pathname: "/game",
                state: usernameFromState
                    ? { username: usernameFromState, mode, botId, boardSize }
                    : undefined,
              },
            ]}
        >
          <Game />
        </MemoryRouter>
      </I18nProvider>
  );
}

/** YEN with a 3×3 empty board */
const EMPTY_3x3_YEN = {
  size: 3,
  players: ["B", "R"],
  layout: ".../.../..",
};

/** Resolved fetch for a successful new-game */
function newGameFetch(yen = EMPTY_3x3_YEN) {
  return {
    ok: true,
    text: async () => JSON.stringify({ ok: true, yen }),
  } as unknown as Response;
}

/** Resolved fetch for a successful move */
function moveFetch(
    yen: object,
    finished = false,
    winner: string | null = null,
    winning_edges: any[] = []
) {
  return {
    ok: true,
    text: async () =>
        JSON.stringify({ ok: true, yen, finished, winner, winning_edges }),
  } as unknown as Response;
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mockNavigate.mockReset();

  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.useRealTimers();
});

// ── Original tests ─────────────────────────────────────────────────────────────

describe("Game component", () => {
  test("creates new game successfully", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () =>
          JSON.stringify({
            ok: true,
            yen: {
              size: 7,
              players: ["B", "R"],
              layout: "......./......./......./......./......./......./.......",
            },
          }),
    } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });
  });

  test("shows plain text error if new game response is not json", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Plain backend error",
    } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    expect(await screen.findByText(/Plain backend error/i)).toBeInTheDocument();
  });

  test("shows error if new game fails", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      text: async () =>
          JSON.stringify({
            ok: false,
            error: "Game server unavailable",
          }),
    } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    expect(await screen.findByText(/Game server unavailable/i)).toBeInTheDocument();
  });

  test("enables send button after selecting a cell", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () =>
          JSON.stringify({
            ok: true,
            yen: {
              size: 7,
              players: ["B", "R"],
              layout: "......./......./......./......./......./......./.......",
            },
          }),
    } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    const circles = document.querySelectorAll("circle");
    await user.click(circles[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Enviar jugada|Send move/i })).not.toBeDisabled();
    });
  });

  test("sends move successfully", async () => {
    const user = userEvent.setup();

    global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
              JSON.stringify({
                ok: true,
                yen: {
                  size: 7,
                  players: ["B", "R"],
                  layout: "......./......./......./......./......./......./.......",
                },
              }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
              JSON.stringify({
                ok: true,
                yen: {
                  size: 7,
                  players: ["B", "R"],
                  layout: "B....../......./......./......./......./......./.......",
                },
              }),
        } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    const circles = document.querySelectorAll("circle");
    await user.click(circles[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Enviar jugada|Send move/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /Enviar jugada|Send move/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  test("sends move on double click", async () => {
    const user = userEvent.setup();

    global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
              JSON.stringify({
                ok: true,
                yen: {
                  size: 7,
                  players: ["B", "R"],
                  layout: "......./......./......./......./......./......./.......",
                },
              }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
              JSON.stringify({
                ok: true,
                yen: {
                  size: 7,
                  players: ["B", "R"],
                  layout: "B....../......./......./......./......./......./.......",
                },
              }),
        } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    const circles = document.querySelectorAll("circle");
    await user.dblClick(circles[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  test("shows backend error when move fails", async () => {
    const user = userEvent.setup();

    global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
              JSON.stringify({
                ok: true,
                yen: {
                  size: 7,
                  players: ["B", "R"],
                  layout: "......./......./......./......./......./......./.......",
                },
              }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          text: async () =>
              JSON.stringify({
                ok: false,
                error: "Backend error",
              }),
        } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    const circles = document.querySelectorAll("circle");
    await user.click(circles[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Enviar jugada|Send move/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /Enviar jugada|Send move/i }));

    expect(await screen.findByText(/Backend error/i)).toBeInTheDocument();
  });

  test("navigates back to home when back button is clicked", async () => {
    const user = userEvent.setup();

    renderGame();

    await user.click(screen.getByRole("button", { name: /Volver a Home|Back To Home/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/home", { state: { username: "Pablo" } });
  });

  test("redirects to root when username is missing", async () => {
    renderGame("", "");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });
});

// ── PvB: Win / finish flow ─────────────────────────────────────────────────────

describe("PvB – win / finish flow", () => {
  test("shows win overlay when server returns finished=true with winner and edges", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const winYen = { ...EMPTY_3x3_YEN, layout: "BBB/RR./R." };
    global.fetch = vi
        .fn()
        .mockResolvedValueOnce(newGameFetch())
        .mockResolvedValueOnce(
            moveFetch(winYen, true, "B", [
              [[0, 0], [0, 1]],
              [[0, 1], [0, 2]],
            ])
        );

    renderGame();
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    await user.dblClick(document.querySelectorAll("circle")[0]);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    await waitFor(() => {
      const lines = document.querySelectorAll("line");
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  test("navigates to /game/finished after win timeout", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const winYen = { ...EMPTY_3x3_YEN, layout: "BBB/RR./R." };
    global.fetch = vi
        .fn()
        .mockResolvedValueOnce(newGameFetch())
        .mockResolvedValueOnce(moveFetch(winYen, true, "B", [[[0, 0], [0, 1]]]));

    renderGame();
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));
    await user.dblClick(document.querySelectorAll("circle")[0]);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    act(() => vi.advanceTimersByTime(1000));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
          "/game/finished",
          expect.objectContaining({ replace: true })
      );
    });
  });

  test("navigates to /game/finished with result=lost when bot wins", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const winYen = { ...EMPTY_3x3_YEN, layout: "B../RRR/B." };
    global.fetch = vi
        .fn()
        .mockResolvedValueOnce(newGameFetch())
        .mockResolvedValueOnce(moveFetch(winYen, true, "R", [[[1, 0], [1, 1]]]));

    renderGame();
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));
    await user.dblClick(document.querySelectorAll("circle")[0]);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    act(() => vi.advanceTimersByTime(1000));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
          "/game/finished",
          expect.objectContaining({
            state: expect.objectContaining({ result: "lost" }),
          })
      );
    });
  });

  test("navigates to /game/finished with draw when finished and no winner", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const drawYen = { ...EMPTY_3x3_YEN, layout: "BRB/RBR/BR" };
    global.fetch = vi
        .fn()
        .mockResolvedValueOnce(newGameFetch())
        .mockResolvedValueOnce(moveFetch(drawYen, true, null, []));

    renderGame();
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));
    await user.dblClick(document.querySelectorAll("circle")[0]);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    act(() => vi.advanceTimersByTime(500));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
          "/game/finished",
          expect.objectContaining({ replace: true })
      );
    });
  });
});

// ── PvB: Cell selection edge cases ────────────────────────────────────────────

describe("PvB – cell interaction edge cases", () => {
  test("clicking an occupied cell does not enable the send button", async () => {
    const user = userEvent.setup();

    const occupiedYen = { ...EMPTY_3x3_YEN, layout: "B../.../.." };
    global.fetch = vi.fn().mockResolvedValueOnce(newGameFetch(occupiedYen));

    renderGame();
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    const sendBtn = screen.getByRole("button", { name: /Enviar jugada|Send move/i });

    // First circle is occupied by "B"
    await user.click(document.querySelectorAll("circle")[0]);

    expect(sendBtn).toBeDisabled();
  });

  test("send button stays disabled when no cell is selected", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce(newGameFetch());

    renderGame();
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    expect(screen.getByRole("button", { name: /Enviar jugada|Send move/i })).toBeDisabled();
  });

  test("restarting a game resets selection and board", async () => {
    const user = userEvent.setup();

    global.fetch = vi
        .fn()
        .mockResolvedValueOnce(newGameFetch())
        .mockResolvedValueOnce(newGameFetch());

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    // Select a cell
    await user.click(document.querySelectorAll("circle")[1]);
    await waitFor(() =>
        expect(screen.getByRole("button", { name: /Enviar jugada|Send move/i })).not.toBeDisabled()
    );

    // Restart
    await user.click(screen.getByRole("button", { name: /Nueva partida|Restart/i }));

    await waitFor(() =>
        expect(screen.getByRole("button", { name: /Enviar jugada|Send move/i })).toBeDisabled()
    );
  });
});

// ── PvP mode ──────────────────────────────────────────────────────────────────

describe("PvP mode", () => {
  test("renders turn indicator for player 1 after starting", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce(newGameFetch());

    renderGame("Pablo", "player");
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    expect(screen.getByText(/Player 1|p1turn/i)).toBeInTheDocument();
  });

  test("switches turn to player 2 after player 1 confirms a move", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce(newGameFetch());

    renderGame("Pablo", "player");
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    await user.click(document.querySelectorAll("circle")[0]);
    await user.click(screen.getByRole("button", { name: /Confirm|pvp\.confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/Player 2|p2turn/i)).toBeInTheDocument();
    });
  });

  test("double-clicking a cell in PvP applies the move immediately", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce(newGameFetch());

    renderGame("Pablo", "player");
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    await user.dblClick(document.querySelectorAll("circle")[0]);

    await waitFor(() => {
      expect(screen.getByText(/Player 2|p2turn/i)).toBeInTheDocument();
    });
  });

  test("confirm button is disabled when no cell is selected in PvP", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce(newGameFetch());

    renderGame("Pablo", "player");
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    expect(screen.getByRole("button", { name: /Confirm|pvp\.confirm/i })).toBeDisabled();
  });

  test("shows draw overlay when board is full with no winner", async () => {
    const user = userEvent.setup();

    // One empty cell left; playing it won't create a Y-win
    const nearDrawYen = {
      size: 3,
      players: ["B", "R"],
      layout: "BRB/RBR/B.",
    };

    global.fetch = vi.fn().mockResolvedValueOnce(newGameFetch(nearDrawYen));

    renderGame("Pablo", "player");
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    const circles = document.querySelectorAll("circle");
    await user.dblClick(circles[circles.length - 1]);

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });
  });

  test("PvP restart button calls fetch again to start a new game", async () => {
    const user = userEvent.setup();

    global.fetch = vi
        .fn()
        .mockResolvedValueOnce(newGameFetch())
        .mockResolvedValueOnce(newGameFetch());

    renderGame("Pablo", "player");
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    await user.click(screen.getByRole("button", { name: /Nueva partida|Restart/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  test("shows PvP Player 1 wins overlay on size-1 board", async () => {
    const user = userEvent.setup();

    // Size-1 board: single cell touches all three Y-board sides simultaneously
    const singleCellYen = { size: 1, players: ["B", "R"], layout: "." };
    global.fetch = vi.fn().mockResolvedValueOnce(newGameFetch(singleCellYen));

    renderGame("Pablo", "player", "random_bot", 1);
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    // P1 plays the only cell → instant win
    await user.dblClick(document.querySelectorAll("circle")[0]);

    await waitFor(() => {
      expect(screen.getByText(/Player 1 Wins|p1wins/i)).toBeInTheDocument();
    });
  });

  test("home button on PvP win overlay navigates to /home", async () => {
    const user = userEvent.setup();

    const singleCellYen = { size: 1, players: ["B", "R"], layout: "." };
    global.fetch = vi.fn().mockResolvedValueOnce(newGameFetch(singleCellYen));

    renderGame("Pablo", "player", "random_bot", 1);
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    await user.dblClick(document.querySelectorAll("circle")[0]);

    await waitFor(() => {
      expect(screen.getByText(/Player 1 Wins|p1wins/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Home|common\.home/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/home", { state: { username: "Pablo" } });
  });

  test("play again button on PvP win overlay restarts the game", async () => {
    const user = userEvent.setup();

    const singleCellYen = { size: 1, players: ["B", "R"], layout: "." };
    global.fetch = vi
        .fn()
        .mockResolvedValueOnce(newGameFetch(singleCellYen))
        .mockResolvedValueOnce(newGameFetch(singleCellYen));

    renderGame("Pablo", "player", "random_bot", 1);
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    await user.dblClick(document.querySelectorAll("circle")[0]);

    await waitFor(() => {
      expect(screen.getByText(/Player 1 Wins|p1wins/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Play Again|game\.restart/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
