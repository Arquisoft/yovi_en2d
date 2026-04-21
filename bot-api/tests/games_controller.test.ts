import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app";


vi.mock("../src/services/bot.service", () => ({
  botService: {
    getMove: vi.fn(),
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "fixed-uuid"),
}));

import { botService } from "../src/services/bot.service";
import { games } from "../src/models/game.model";

const mockedGetMove = botService.getMove as ReturnType<typeof vi.fn>;

const INITIAL_POSITION = { size: 3, turn: 0, players: ["B", "R"], layout: "./B./..." };

beforeEach(() => {
  games.clear();
  vi.clearAllMocks();
});

// ── POST /games ──────────────────────────────────────────────────────────────
describe("POST /games", () => {
  it("returns 201 on successful creation", async () => {
    const res = await request(app)
      .post("/games")
      .send({ botId: "random_bot", position: INITIAL_POSITION });
    expect(res.status).toBe(201);
  });

  it("returns the created game with the mocked uuid", async () => {
    const res = await request(app)
      .post("/games")
      .send({ botId: "random_bot", position: INITIAL_POSITION });
    expect(res.body.id).toBe("fixed-uuid");
  });

  it("returns the correct botId in the response", async () => {
    const res = await request(app)
      .post("/games")
      .send({ botId: "minimax_bot", position: {} });
    expect(res.body.botId).toBe("minimax_bot");
  });

  it("returns ONGOING status", async () => {
    const res = await request(app)
      .post("/games")
      .send({ botId: "random_bot", position: {} });
    expect(res.body.status).toBe("ONGOING");
  });

  it("stores the initial position in the returned game", async () => {
    const res = await request(app)
      .post("/games")
      .send({ botId: "random_bot", position: INITIAL_POSITION });
    expect(res.body.position).toEqual(INITIAL_POSITION);
  });

  it("stores the game in the in-memory map", async () => {
    await request(app).post("/games").send({ botId: "random_bot", position: {} });
    expect(games.has("fixed-uuid")).toBe(true);
  });

  it("works with an empty position object", async () => {
    const res = await request(app)
      .post("/games")
      .send({ botId: "random_bot", position: {} });
    expect(res.status).toBe(201);
  });

  it("works with different bot IDs", async () => {
    for (const botId of ["random_bot", "minimax_bot", "alfa_beta_bot"]) {
      games.clear();
      const res = await request(app).post("/games").send({ botId, position: {} });
      expect(res.body.botId).toBe(botId);
    }
  });
});

// ── GET /games/:id ───────────────────────────────────────────────────────────
describe("GET /games/:id", () => {
  it("returns 200 and the game when it exists", async () => {
    await request(app).post("/games").send({ botId: "random_bot", position: {} });
    const res = await request(app).get("/games/fixed-uuid");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("fixed-uuid");
  });

  it("returns the full game object", async () => {
    await request(app)
      .post("/games")
      .send({ botId: "random_bot", position: INITIAL_POSITION });
    const res = await request(app).get("/games/fixed-uuid");
    expect(res.body).toMatchObject({
      id: "fixed-uuid",
      botId: "random_bot",
      status: "ONGOING",
      position: INITIAL_POSITION,
    });
  });

  it("returns 500 when game id does not exist", async () => {
    const res = await request(app).get("/games/does-not-exist");
    expect(res.status).toBe(500);
  });
});

// ── POST /games/:id/play ─────────────────────────────────────────────────────
describe("POST /games/:id/play", () => {
  it("returns 200 on a valid play", async () => {
    mockedGetMove.mockResolvedValue({ coords: { x: 1, y: 1, z: 1 } });
    await request(app).post("/games").send({ botId: "random_bot", position: {} });
    const res = await request(app)
      .post("/games/fixed-uuid/play")
      .send({ position: { size: 3, turn: 1 } });
    expect(res.status).toBe(200);
  });

  it("returns the move from botService in the response", async () => {
    mockedGetMove.mockResolvedValue({ coords: { x: 1, y: 1, z: 1 } });
    await request(app).post("/games").send({ botId: "random_bot", position: {} });
    const res = await request(app)
      .post("/games/fixed-uuid/play")
      .send({ position: {} });
    expect(res.body.move).toEqual({ coords: { x: 1, y: 1, z: 1 } });
  });

  it("returns the updated game object alongside the move", async () => {
    mockedGetMove.mockResolvedValue({ coords: { x: 0, y: 0, z: 2 } });
    await request(app).post("/games").send({ botId: "random_bot", position: {} });
    const res = await request(app)
      .post("/games/fixed-uuid/play")
      .send({ position: { size: 3 } });
    expect(res.body.game).toBeDefined();
    expect(res.body.game.id).toBe("fixed-uuid");
  });

  it("calls botService with the game's botId and the new position", async () => {
    mockedGetMove.mockResolvedValue({ coords: { x: 1, y: 1, z: 1 } });
    await request(app).post("/games").send({ botId: "random_bot", position: {} });
    const newPos = { size: 3, turn: 1 };
    await request(app).post("/games/fixed-uuid/play").send({ position: newPos });
    expect(mockedGetMove).toHaveBeenCalledWith("random_bot", newPos);
  });

  it("passes through action:swap in the move response", async () => {
    mockedGetMove.mockResolvedValue({ action: "swap" });
    await request(app).post("/games").send({ botId: "random_bot", position: {} });
    const res = await request(app)
      .post("/games/fixed-uuid/play")
      .send({ position: {} });
    expect(res.status).toBe(200);
    expect(res.body.move).toEqual({ action: "swap" });
  });

  it("passes through action:resign in the move response", async () => {
    mockedGetMove.mockResolvedValue({ action: "resign" });
    await request(app).post("/games").send({ botId: "random_bot", position: {} });
    const res = await request(app)
      .post("/games/fixed-uuid/play")
      .send({ position: {} });
    expect(res.body.move).toEqual({ action: "resign" });
  });

  it("returns 500 when game id does not exist", async () => {
    const res = await request(app)
      .post("/games/nonexistent/play")
      .send({ position: {} });
    expect(res.status).toBe(500);
  });

  it("returns 500 when botService throws", async () => {
    mockedGetMove.mockRejectedValue(new Error("bot crashed"));
    await request(app).post("/games").send({ botId: "random_bot", position: {} });
    const res = await request(app)
      .post("/games/fixed-uuid/play")
      .send({ position: {} });
    expect(res.status).toBe(500);
  });
});

// ── GET /health ──────────────────────────────────────────────────────────────
describe("GET /health", () => {
  it("returns 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("returns OK text", async () => {
    const res = await request(app).get("/health");
    expect(res.text).toBe("OK");
  });
});

// ── unknown routes ───────────────────────────────────────────────────────────
describe("unknown routes", () => {
  it("returns 404 for GET /nonexistent", async () => {
    const res = await request(app).get("/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 404 for POST /nonexistent", async () => {
    const res = await request(app).post("/nonexistent").send({});
    expect(res.status).toBe(404);
  });
});
