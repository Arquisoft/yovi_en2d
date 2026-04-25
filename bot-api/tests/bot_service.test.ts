import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../src/clients/gamey.client", () => ({
    gameyClient: {
        chooseBotMove: vi.fn(),
    },
}));

vi.mock("axios", () => ({
    default: {
        get: vi.fn(),
    },
}));

import axios from "axios";
import { gameyClient } from "../src/clients/gamey.client";
import { botService, ALLOWED_LOCAL_BOT_IDS } from "../src/services/bot.service";

const mockedChooseBotMove = vi.mocked(gameyClient.chooseBotMove);
const mockedGet = vi.mocked(axios.get);

beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOWED_REMOTE_BOT_URLS = "http://my-bot:5000,http://other-bot:6000";
});

afterEach(() => {
    delete process.env.ALLOWED_REMOTE_BOT_URLS;
});

// ── normalize ────────────────────────────────────────────────────────────────
describe("BotService.normalize", () => {
    it("throws on null/undefined input", () => {
        expect(() => botService.normalize(null)).toThrow("Empty bot response");
        expect(() => botService.normalize(undefined)).toThrow("Empty bot response");
    });

    it("returns { action } when data.action is a string", () => {
        expect(botService.normalize({ action: "swap" })).toEqual({ action: "swap" });
    });

    it("returns { coords } when data.coords.x is a number", () => {
        const coords = { x: 1, y: 2, z: 3 };
        expect(botService.normalize({ coords })).toEqual({ coords });
    });

    it("wraps flat x/y/z into coords", () => {
        expect(botService.normalize({ x: 1, y: 2, z: 3 })).toEqual({
            coords: { x: 1, y: 2, z: 3 },
        });
    });

    it("throws on unrecognised shape", () => {
        expect(() => botService.normalize({ foo: "bar" })).toThrow("Invalid bot response");
    });

    it("prefers action over coords when both are present", () => {
        expect(botService.normalize({ action: "pass", coords: { x: 1, y: 2, z: 3 } })).toEqual({
            action: "pass",
        });
    });

    it("ignores action field when it is not a string", () => {
        expect(botService.normalize({ action: 42, coords: { x: 0, y: 0, z: 0 } })).toEqual({
            coords: { x: 0, y: 0, z: 0 },
        });
    });

    it("throws when coords exists but coords.x is not a number", () => {
        expect(() => botService.normalize({ coords: { x: "oops", y: 2, z: 3 } })).toThrow(
            "Invalid bot response"
        );
    });

    it("returns { action } for an empty string action", () => {
        expect(botService.normalize({ action: "" })).toEqual({ action: "" });
    });

    it("preserves zero coords correctly", () => {
        expect(botService.normalize({ x: 0, y: 0, z: 0 })).toEqual({
            coords: { x: 0, y: 0, z: 0 },
        });
    });
});

// ── getAllowedRemoteBotUrls — runtime env changes ─────────────────────────────
describe("getAllowedRemoteBotUrls — runtime env changes", () => {
    it("picks up a URL added after import", async () => {
        process.env.ALLOWED_REMOTE_BOT_URLS = "http://late-bot:9000";
        mockedGet.mockResolvedValue({ data: { action: "go" } });
        await expect(botService.getMove("http://late-bot:9000", {})).resolves.toEqual({
            action: "go",
        });
    });

    it("rejects a URL that was removed from the env", async () => {
        process.env.ALLOWED_REMOTE_BOT_URLS = "";
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("http://my-bot:5000", {})).rejects.toThrow(
            "Remote bot URL is not in the allowlist"
        );
        expect(mockedGet).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it("handles an unset env var gracefully (empty allowlist)", async () => {
        delete process.env.ALLOWED_REMOTE_BOT_URLS;
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("http://my-bot:5000", {})).rejects.toThrow(
            "Remote bot URL is not in the allowlist"
        );
        consoleSpy.mockRestore();
    });

    it("trims whitespace around URLs in the env var", async () => {
        process.env.ALLOWED_REMOTE_BOT_URLS = "  http://padded-bot:8000  ";
        mockedGet.mockResolvedValue({ data: { action: "ok" } });
        await expect(botService.getMove("http://padded-bot:8000", {})).resolves.toEqual({
            action: "ok",
        });
    });

    it("ignores empty entries caused by trailing commas", async () => {
        process.env.ALLOWED_REMOTE_BOT_URLS = "http://my-bot:5000,,";
        mockedGet.mockResolvedValue({ data: { action: "ok" } });
        await expect(botService.getMove("http://my-bot:5000", {})).resolves.toEqual({
            action: "ok",
        });
    });
});

// ── ALLOWED_LOCAL_BOT_IDS ─────────────────────────────────────────────────────
describe("ALLOWED_LOCAL_BOT_IDS", () => {
    it("contains all expected bots", () => {
        const expected = [
            "random_bot",
            "smart_bot",
            "heuristic_bot",
            "minimax_bot",
            "alfa_beta_bot",
            "monte_carlo_hard",
            "monte_carlo_extreme",
            "monte_carlo_bot",
        ];
        for (const id of expected) {
            expect(ALLOWED_LOCAL_BOT_IDS.has(id)).toBe(true);
        }
    });

    it("does not contain arbitrary ids", () => {
        expect(ALLOWED_LOCAL_BOT_IDS.has("evil_bot")).toBe(false);
        expect(ALLOWED_LOCAL_BOT_IDS.has("")).toBe(false);
    });
});

// ── getMove — local bots ─────────────────────────────────────────────────────
describe("BotService.getMove — local bots", () => {
    it("defaults to random_bot when botId is undefined", async () => {
        mockedChooseBotMove.mockResolvedValue({ x: 1, y: 2, z: 3 });
        const result = await botService.getMove(undefined, {});
        expect(mockedChooseBotMove).toHaveBeenCalledWith("random_bot", {});
        expect(result).toEqual({ coords: { x: 1, y: 2, z: 3 } });
    });

    it("defaults to random_bot when botId is empty string", async () => {
        mockedChooseBotMove.mockResolvedValue({ action: "pass" });
        await botService.getMove("", {});
        expect(mockedChooseBotMove).toHaveBeenCalledWith("random_bot", {});
    });

    it("routes a valid local bot id to gameyClient", async () => {
        mockedChooseBotMove.mockResolvedValue({ action: "swap" });
        const result = await botService.getMove("smart_bot", { board: [] });
        expect(mockedChooseBotMove).toHaveBeenCalledWith("smart_bot", { board: [] });
        expect(result).toEqual({ action: "swap" });
    });

    it("passes the yen payload to gameyClient unchanged", async () => {
        const yen = { board: [1, 2, 3], turn: 5 };
        mockedChooseBotMove.mockResolvedValue({ x: 0, y: 0, z: 0 });
        await botService.getMove("minimax_bot", yen);
        expect(mockedChooseBotMove).toHaveBeenCalledWith("minimax_bot", yen);
    });

    it("throws and logs when an unknown local bot id is given", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("evil_bot", {})).rejects.toThrow("Invalid local bot id");
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it("normalizes a coords response from gameyClient", async () => {
        mockedChooseBotMove.mockResolvedValue({ coords: { x: 3, y: 1, z: 0 } });
        const result = await botService.getMove("heuristic_bot", {});
        expect(result).toEqual({ coords: { x: 3, y: 1, z: 0 } });
    });

    it("works for every bot in the allowlist", async () => {
        mockedChooseBotMove.mockResolvedValue({ action: "move" });
        for (const botId of ALLOWED_LOCAL_BOT_IDS) {
            await expect(botService.getMove(botId, {})).resolves.toEqual({ action: "move" });
        }
    });

    it("throws when gameyClient rejects", async () => {
        mockedChooseBotMove.mockRejectedValue(new Error("network failure"));
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("random_bot", {})).rejects.toThrow("network failure");
        consoleSpy.mockRestore();
    });

    it("throws when gameyClient returns an invalid response shape", async () => {
        mockedChooseBotMove.mockResolvedValue({ weird: true });
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("random_bot", {})).rejects.toThrow("Invalid bot response");
        consoleSpy.mockRestore();
    });

    it("throws when gameyClient returns null", async () => {
        mockedChooseBotMove.mockResolvedValue(null);
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("random_bot", {})).rejects.toThrow("Empty bot response");
        consoleSpy.mockRestore();
    });
});

// ── getMove — remote bots ────────────────────────────────────────────────────
describe("BotService.getMove — remote bots", () => {
    it("calls the trusted URL from the allowlist, not user-supplied input", async () => {
        mockedGet.mockResolvedValue({ data: { action: "go" } });
        const result = await botService.getMove("http://my-bot:5000", { board: [] });
        expect(mockedGet).toHaveBeenCalledWith(
            "http://my-bot:5000/play",
            expect.objectContaining({ params: { position: JSON.stringify({ board: [] }) } })
        );
        expect(result).toEqual({ action: "go" });
    });

    it("supports a second allowed remote bot URL", async () => {
        mockedGet.mockResolvedValue({ data: { x: 4, y: 5, z: 6 } });
        const result = await botService.getMove("http://other-bot:6000", {});
        expect(mockedGet).toHaveBeenCalledWith(
            "http://other-bot:6000/play",
            expect.anything()
        );
        expect(result).toEqual({ coords: { x: 4, y: 5, z: 6 } });
    });

    it("rejects a URL not in the allowlist", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("http://evil.com/hack", {})).rejects.toThrow(
            "Remote bot URL is not in the allowlist"
        );
        expect(mockedGet).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it("serialises the yen payload as JSON in the query params", async () => {
        const yen = { board: [0, 1, 2], turn: 3 };
        mockedGet.mockResolvedValue({ data: { action: "ok" } });
        await botService.getMove("http://my-bot:5000", yen);
        expect(mockedGet).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ params: { position: JSON.stringify(yen) } })
        );
    });

    it("throws and logs on a remote HTTP error", async () => {
        const axiosError = Object.assign(new Error("502"), {
            response: { data: "Bad Gateway" },
        });
        mockedGet.mockRejectedValue(axiosError);
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("http://my-bot:5000", {})).rejects.toThrow("502");
        expect(consoleSpy).toHaveBeenCalledWith(
            "Bot error:",
            expect.stringContaining("Bad Gateway")
        );
        consoleSpy.mockRestore();
    });

    it("normalizes a coords response from the remote bot", async () => {
        mockedGet.mockResolvedValue({ data: { coords: { x: 9, y: 8, z: 7 } } });
        const result = await botService.getMove("http://my-bot:5000", {});
        expect(result).toEqual({ coords: { x: 9, y: 8, z: 7 } });
    });

    it("throws when the remote bot returns an empty body", async () => {
        mockedGet.mockResolvedValue({ data: null });
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("http://my-bot:5000", {})).rejects.toThrow(
            "Empty bot response"
        );
        consoleSpy.mockRestore();
    });
});

// ── getMove — error logging (sanitizeForLog) ──────────────────────────────────
describe("BotService.getMove — error log sanitization", () => {
    it("strips ANSI escape codes from logged error messages", async () => {
        const err = Object.assign(new Error("fail"), {
            message: "\x1b[31mred error\x1b[0m",
        });
        mockedChooseBotMove.mockRejectedValue(err);
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("random_bot", {})).rejects.toThrow();
        const logged: string = consoleSpy.mock.calls[0][1];
        expect(logged).not.toMatch(/\x1b\[/);
        expect(logged).toContain("red error");
        consoleSpy.mockRestore();
    });

    it("replaces newlines in logged error messages", async () => {
        const err = Object.assign(new Error("line1\nline2"), {
            message: "line1\nline2",
        });
        mockedChooseBotMove.mockRejectedValue(err);
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("random_bot", {})).rejects.toThrow();
        const logged: string = consoleSpy.mock.calls[0][1];
        expect(logged).not.toContain("\n");
        consoleSpy.mockRestore();
    });

    it("truncates very long error messages to 200 chars", async () => {
        const longMsg = "x".repeat(500);
        const err = Object.assign(new Error(longMsg), { message: longMsg });
        mockedChooseBotMove.mockRejectedValue(err);
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("random_bot", {})).rejects.toThrow();
        const logged: string = consoleSpy.mock.calls[0][1];
        expect(logged.length).toBeLessThanOrEqual(200);
        consoleSpy.mockRestore();
    });

    it("logs response data from axios error when present", async () => {
        const err = Object.assign(new Error("Remote err"), {
            response: { data: { reason: "invalid position" } },
        });
        mockedGet.mockRejectedValue(err);
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("http://my-bot:5000", {})).rejects.toThrow();
        const logged: string = consoleSpy.mock.calls[0][1];
        expect(logged).toContain("invalid position");
        consoleSpy.mockRestore();
    });

    it("falls back to 'unknown error' when err has no message or response", async () => {
        mockedChooseBotMove.mockRejectedValue({});
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(botService.getMove("random_bot", {})).rejects.toBeTruthy();
        const logged: string = consoleSpy.mock.calls[0][1];
        expect(logged).toContain("unknown error");
        consoleSpy.mockRestore();
    });
});