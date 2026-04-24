import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app";

// ✅ Mock WITH allowlists (important)
vi.mock("../src/services/bot.service", () => ({
  botService: {
    getMove: vi.fn(),
  },
  ALLOWED_LOCAL_BOT_IDS: new Set([
    "random_bot",
    "minimax_bot",
  ]),
  ALLOWED_REMOTE_BOT_URLS: new Set([
    "http://my-bot:5000",
  ]),
}));

import { botService } from "../src/services/bot.service";

const mockedGetMove = botService.getMove as ReturnType<typeof vi.fn>;

const VALID_YEN = JSON.stringify({
  size: 3,
  turn: 0,
  players: ["B", "R"],
  layout: "./B./...",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /play", () => {
  // ── missing / invalid input ────────────────────────────────────────────────
  it("returns 400 when position query param is missing", async () => {
    const res = await request(app).get("/play");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("position required");
  });

  it("returns 400 when position is not valid JSON", async () => {
    const res = await request(app).get("/play").query({ position: "not-json{{" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("position is not valid JSON");
  });

  it("returns 400 for a bare string position", async () => {
    const res = await request(app).get("/play").query({ position: "hello" });
    expect(res.status).toBe(400);
  });

  // ── coords response ────────────────────────────────────────────────────────
  it("returns coords response directly from botService", async () => {
    mockedGetMove.mockResolvedValue({ coords: { x: 1, y: 1, z: 0 } });
    const res = await request(app).get("/play").query({ position: VALID_YEN });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ coords: { x: 1, y: 1, z: 0 } });
  });

  it("returns action:swap response directly from botService", async () => {
    mockedGetMove.mockResolvedValue({ action: "swap" });
    const res = await request(app).get("/play").query({ position: VALID_YEN });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ action: "swap" });
  });

  it("returns action:resign response directly from botService", async () => {
    mockedGetMove.mockResolvedValue({ action: "resign" });
    const res = await request(app).get("/play").query({ position: VALID_YEN });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ action: "resign" });
  });

  // ── bot_id forwarding ──────────────────────────────────────────────────────
  it("forwards bot_id query param to botService", async () => {
    mockedGetMove.mockResolvedValue({ coords: { x: 0, y: 0, z: 2 } });

    await request(app)
        .get("/play")
        .query({ position: VALID_YEN, bot_id: "minimax_bot" });

    expect(mockedGetMove).toHaveBeenCalledWith(
        "minimax_bot",
        expect.any(Object)
    );
  });

  it("defaults to random_bot when bot_id not provided", async () => {
    mockedGetMove.mockResolvedValue({ coords: { x: 0, y: 0, z: 2 } });

    await request(app).get("/play").query({ position: VALID_YEN });

    expect(mockedGetMove).toHaveBeenCalledWith(
        "random_bot",
        expect.any(Object)
    );
  });

  it("passes the parsed YEN object (not a string) to botService", async () => {
    mockedGetMove.mockResolvedValue({ coords: { x: 1, y: 0, z: 2 } });

    await request(app).get("/play").query({ position: VALID_YEN });

    const [, calledYen] = mockedGetMove.mock.calls[0];
    expect(typeof calledYen).toBe("object");
    expect(calledYen).toHaveProperty("size", 3);
    expect(calledYen).toHaveProperty("layout", "./B./...");
  });

  // ── error handling ─────────────────────────────────────────────────────────
  it("returns 500 when botService throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedGetMove.mockRejectedValue(new Error("gamey unavailable"));

    const res = await request(app).get("/play").query({ position: VALID_YEN });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("play failed");

    consoleSpy.mockRestore();
  });

  it("logs the error message when botService throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedGetMove.mockRejectedValue(new Error("timeout"));

    await request(app).get("/play").query({ position: VALID_YEN });

    expect(consoleSpy).toHaveBeenCalledWith("play failed:", "timeout");

    consoleSpy.mockRestore();
  });

  it("returns 500 with error field for any internal failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedGetMove.mockRejectedValue(new Error("any error"));

    const res = await request(app).get("/play").query({ position: VALID_YEN });

    expect(res.body).toHaveProperty("error", "play failed");

    consoleSpy.mockRestore();
  });
});