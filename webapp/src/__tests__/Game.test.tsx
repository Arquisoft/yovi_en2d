import { render, screen, waitFor } from "@testing-library/react";
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
    renderGame(null);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });
});

// ── PvB: Win / finish flow ─────────────────────────────────────────────────────

describe("PvB – win / finish flow", () => {
  // FIX: Don't use fake timers for the overlay check — just verify the win
  // lines appear after the move response. Fake timers block Promise resolution
  // in jsdom when combined with async fetch mocks, causing timeouts.
  test("shows win overlay when server returns finished=true with winner and edges", async () => {
    const user = userEvent.setup();

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

  // FIX: Use real timers but with a generous waitFor timeout so the 900ms
  // navigate timeout fires naturally without blocking microtasks.
  test("navigates to /game/finished after win timeout", async () => {
    const user = userEvent.setup();

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

    await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith(
              "/game/finished",
              expect.objectContaining({ replace: true })
          );
        },
        { timeout: 3000 }
    );
  });

  test("navigates to /game/finished with result=lost when bot wins", async () => {
    const user = userEvent.setup();

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

    await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith(
              "/game/finished",
              expect.objectContaining({
                state: expect.objectContaining({ result: "lost" }),
              })
          );
        },
        { timeout: 3000 }
    );
  });

  test("navigates to /game/finished with draw when finished and no winner", async () => {
    const user = userEvent.setup();

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

    await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith(
              "/game/finished",
              expect.objectContaining({ replace: true })
          );
        },
        { timeout: 3000 }
    );
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

  // FIX: After gameStarted=true the button renders t("game.restart") = "New Game",
  // not "Nueva partida" or "Restart". Match "New Game" instead.
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

    // After game starts, the toolbar button shows t("game.restart") = "New Game"
    await user.click(screen.getByRole("button", { name: /^New Game$|^Nueva partida$/i }));

    await waitFor(() =>
        expect(screen.getByRole("button", { name: /Enviar jugada|Send move/i })).toBeDisabled()
    );
  });
});

// ── PvP mode ──────────────────────────────────────────────────────────────────

describe("PvP mode", () => {
  // FIX: "Player 1" appears in both the TurnIndicator ("Player 1's Turn") and
  // the legend ("Player 1"). Use a more specific matcher for the turn indicator.
  test("renders turn indicator for player 1 after starting", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce(newGameFetch());

    renderGame("Pablo", "player");
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    // The TurnIndicator renders "Player 1's Turn" — be specific to avoid
    // matching the "Player 1" legend entry as well.
    expect(screen.getByText(/Player 1's Turn|Turno del Jugador 1/i)).toBeInTheDocument();
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
      // Match the turn indicator text specifically (includes "'s Turn" suffix)
      expect(screen.getByText(/Player 2's Turn|Turno del Jugador 2/i)).toBeInTheDocument();
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
      expect(screen.getByText(/Player 2's Turn|Turno del Jugador 2/i)).toBeInTheDocument();
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

  // FIX: After gameStarted=true the toolbar button shows "New Game" (game.restart),
  // not "Nueva partida" or "Restart". Match the actual rendered text.
  test("PvP restart button calls fetch again to start a new game", async () => {
    const user = userEvent.setup();

    global.fetch = vi
        .fn()
        .mockResolvedValueOnce(newGameFetch())
        .mockResolvedValueOnce(newGameFetch());

    renderGame("Pablo", "player");
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    // After game started, toolbar shows t("game.restart") = "New Game".
    // There may be multiple "New Game" buttons (toolbar + overlay in other tests),
    // but here no overlay is shown, so getAllByRole + [0] is safe; or use exact match.
    const newGameBtns = screen.getAllByRole("button", { name: /^New Game$|^Nueva partida$/i });
    await user.click(newGameBtns[0]);

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
      expect(screen.getByText(/Player 1 Wins!|¡Jugador 1 gana!/i)).toBeInTheDocument();
    });
  });

  // FIX: Multiple buttons match /Home/i (nav link, logo button, overlay button,
  // back button). Scope the click to the overlay "Home" button specifically
  // by finding it within the overlay container or using getAllByRole + last match.
  test("home button on PvP win overlay navigates to /home", async () => {
    const user = userEvent.setup();

    const singleCellYen = { size: 1, players: ["B", "R"], layout: "." };
    global.fetch = vi.fn().mockResolvedValueOnce(newGameFetch(singleCellYen));

    renderGame("Pablo", "player", "random_bot", 1);
    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => expect(document.querySelectorAll("circle").length).toBeGreaterThan(0));

    await user.dblClick(document.querySelectorAll("circle")[0]);

    await waitFor(() => {
      expect(screen.getByText(/Player 1 Wins!|¡Jugador 1 gana!/i)).toBeInTheDocument();
    });

    // The overlay "Home" button has class "btn--ghost btn--full".
    // Use getAllByRole and find the ghost-style one (last among "Home"-named buttons
    // since the overlay renders after the header/nav).
    const homeBtns = screen.getAllByRole("button", { name: /^Home$|^common\.home$/i });
    const overlayHomeBtn = homeBtns[homeBtns.length - 1];
    await user.click(overlayHomeBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/home", { state: { username: "Pablo" } });
  });

  // FIX: The overlay "Play Again" button renders t("game.restart") = "New Game",
  // not "Play Again". Match "New Game" and pick the one inside the overlay.
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
      expect(screen.getByText(/Player 1 Wins!|¡Jugador 1 gana!/i)).toBeInTheDocument();
    });

    // The overlay's primary button renders t("game.restart") = "New Game"
    // (class: btn--primary btn--full btn--lg). Multiple "New Game" buttons exist;
    // pick the large overlay one via its distinctive classes.
    const allNewGameBtns = screen.getAllByRole("button", { name: /^New Game$|^Nueva partida$/i });
    // The overlay button has btn--lg class; it's the one NOT in the toolbar.
    const overlayPlayAgainBtn = allNewGameBtns.find(
        (btn) => btn.classList.contains("btn--lg")
    );
    expect(overlayPlayAgainBtn).toBeDefined();
    await user.click(overlayPlayAgainBtn!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
