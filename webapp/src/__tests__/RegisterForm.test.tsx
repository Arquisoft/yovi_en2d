import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RegisterForm from "../RegisterForm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom";
import { I18nProvider } from "../i18n/I18nProvider";

function renderWithProviders() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("shows validation error when username is empty", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn();

    renderWithProviders();

    await user.click(
      screen.getByRole("button", { name: /¡vamos!|let’s go!|let's go!/i })
    );

    expect(global.fetch).not.toHaveBeenCalled();

    expect(
      await screen.findByText(
        /please enter a username|por favor, introduce un nombre de usuario/i
      )
    ).toBeInTheDocument();
  });

  test("submits username and displays response", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Hello Pablo! Welcome to the course!" }),
    } as Response);

    renderWithProviders();

    await user.type(screen.getByRole("textbox"), "Pablo");

    await user.click(
      screen.getByRole("button", { name: /¡vamos!|let’s go!|let's go!/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(localStorage.getItem("username")).toBe("Pablo");
    });
  });
});