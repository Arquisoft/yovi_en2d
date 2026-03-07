import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Game from "../Game";
import { I18nProvider } from "../i18n/I18nProvider";

function renderGame() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[{ pathname: "/game", state: { username: "Pablo" } }]}>
        <Game />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("Game component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("username", "Pablo");

    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("renders title and action buttons", () => {
    renderGame();

    expect(
      screen.getByRole("heading", { name: /GameY/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Nueva partida|New game/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Enviar jugada|Send move/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Volver a Home|Back To Home/i })
    ).toBeInTheDocument();
  });

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

    await user.click(
      screen.getByRole("button", { name: /Nueva partida|New game/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });
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

    await user.click(
      screen.getByRole("button", { name: /Nueva partida|New game/i })
    );

    expect(
      await screen.findByText(/Game server unavailable/i)
    ).toBeInTheDocument();
  });

  test("does not send move without selection", () => {
    renderGame();

    const sendButton = screen.getByRole("button", {
      name: /Enviar jugada|Send move/i,
    });

    expect(sendButton).toBeDisabled();
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

    await user.click(
      screen.getByRole("button", { name: /Nueva partida|New game/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    const circles = document.querySelectorAll("circle");
    await user.click(circles[0]);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Enviar jugada|Send move/i })
      ).not.toBeDisabled();
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
      })
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
      });

    renderGame();

    await user.click(
      screen.getByRole("button", { name: /Nueva partida|New game/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    const circles = document.querySelectorAll("circle");
    await user.click(circles[0]);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Enviar jugada|Send move/i })
      ).not.toBeDisabled();
    });

    await user.click(
      screen.getByRole("button", { name: /Enviar jugada|Send move/i })
    );

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
      })
      .mockResolvedValueOnce({
        ok: false,
        text: async () =>
          JSON.stringify({
            ok: false,
            error: "Backend error",
          }),
      });

    renderGame();

    await user.click(
      screen.getByRole("button", { name: /Nueva partida|New game/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    const circles = document.querySelectorAll("circle");
    await user.click(circles[0]);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Enviar jugada|Send move/i })
      ).not.toBeDisabled();
    });

    await user.click(
      screen.getByRole("button", { name: /Enviar jugada|Send move/i })
    );

    expect(
      await screen.findByText(/Backend error/i)
    ).toBeInTheDocument();
  });
});