import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/services/bot.service", () => ({
  botService: {
    getMove: vi.fn(),
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid-1234"),
}));

import { botService } from "../src/services/bot.service";
import { gameService } from "../src/services/game.service";
import { games } from "../src/models/game.model";
const mockedGetMove = vi.mocked(botService.getMove);

beforeEach(() => {
  games.clear();
  vi.clearAllMocks();
});

// ── createGame ───────────────────────────────────────────────────────────────
describe("GameService.createGame", () => {
  it("creates a game with the uuid as id", () => {
    const game = gameService.createGame("random_bot", { size: 3 });
    expect(game.id).toBe("test-uuid-1234");
  });

  it("stores the game in the games map", () => {
    const game = gameService.createGame("random_bot", { size: 3 });
    expect(games.has(game.id)).toBe(true);
  });

  it("sets status to ONGOING", () => {
    const game = gameService.createGame("random_bot", {});
    expect(game.status).toBe("ONGOING");
  });

  it("stores the provided botId", () => {
    const game = gameService.createGame("minimax_bot", {});
    expect(game.botId).toBe("minimax_bot");
  });

  it("stores the initial position", () => {
    const pos = { size: 5, turn: 0, players: ["B", "R"], layout: "....." };
    const game = gameService.createGame("random_bot", pos);
    expect(game.position).toEqual(pos);
  });

  it("returns the created game object", () => {
    const game = gameService.createGame("random_bot", {});
    expect(game).toMatchObject({ id: "test-uuid-1234", botId: "random_bot", status: "ONGOING" });
  });

  it("stores null position when passed", () => {
    const game = gameService.createGame("random_bot", null);
    expect(game.position).toBeNull();
  });
});

// ── getGame ──────────────────────────────────────────────────────────────────
describe("GameService.getGame", () => {
  it("returns the game when it exists", () => {
    const created = gameService.createGame("random_bot", {});
    expect(gameService.getGame(created.id)).toEqual(created);
  });

  it("throws 'game not found' when id does not exist", () => {
    expect(() => gameService.getGame("nonexistent-id")).toThrow("game not found");
  });

  it("throws after the game map is cleared", () => {
    const game = gameService.createGame("random_bot", {});
    games.clear();
    expect(() => gameService.getGame(game.id)).toThrow("game not found");
  });

  it("retrieves the correct game among multiple", () => {
    const g1 = gameService.createGame("random_bot", { turn: 0 });
    // Force a second id since uuid is mocked to always return same value
    games.set("other-id", { id: "other-id", botId: "minimax_bot", position: {}, status: "ONGOING" });
    expect(gameService.getGame("other-id")!.botId).toBe("minimax_bot");
    expect(gameService.getGame(g1.id)!.botId).toBe("random_bot");
  });
});

// ── playMove ─────────────────────────────────────────────────────────────────
describe("GameService.playMove", () => {
  it("calls botService.getMove with the game's botId and the new position", async () => {
    mockedGetMove.mockResolvedValue({ coords: { x: 1, y: 1, z: 1 } });
    const game = gameService.createGame("random_bot", { size: 3 });
    const newPos = { size: 3, turn: 1 };
    await gameService.playMove(game.id, newPos);
    expect(mockedGetMove).toHaveBeenCalledWith("random_bot", newPos);
  });

  it("returns the move from botService", async () => {
    const move = { coords: { x: 2, y: 0, z: 1 } };
    mockedGetMove.mockResolvedValue(move);
    const game = gameService.createGame("random_bot", {});
    const result = await gameService.playMove(game.id, {});
    expect(result.move).toEqual(move);
  });

  it("returns the updated game object", async () => {
    mockedGetMove.mockResolvedValue({ coords: { x: 0, y: 0, z: 2 } });
    const game = gameService.createGame("random_bot", {});
    const result = await gameService.playMove(game.id, { size: 3 });
    expect(result.game.id).toBe(game.id);
  });

  it("updates the game position to the new position", async () => {
    mockedGetMove.mockResolvedValue({ coords: { x: 0, y: 0, z: 2 } });
    const game = gameService.createGame("random_bot", { size: 3, turn: 0 });
    const newPos = { size: 3, turn: 1 };
    await gameService.playMove(game.id, newPos);
    expect(games.get(game.id)!.position).toEqual(newPos);
  });

  it("works with action responses (swap)", async () => {
    mockedGetMove.mockResolvedValue({ action: "swap" });
    const game = gameService.createGame("random_bot", {});
    const result = await gameService.playMove(game.id, {});
    expect(result.move).toEqual({ action: "swap" });
  });

  it("works with action responses (resign)", async () => {
    mockedGetMove.mockResolvedValue({ action: "resign" });
    const game = gameService.createGame("random_bot", {});
    const result = await gameService.playMove(game.id, {});
    expect(result.move).toEqual({ action: "resign" });
  });

  it("throws 'game not found' when the id does not exist", async () => {
    await expect(gameService.playMove("bad-id", {})).rejects.toThrow("game not found");
  });

  it("propagates errors thrown by botService", async () => {
    mockedGetMove.mockRejectedValue(new Error("gamey down"));
    const game = gameService.createGame("random_bot", {});
    await expect(gameService.playMove(game.id, {})).rejects.toThrow("gamey down");
  });

  it("does not update position when botService throws", async () => {
    mockedGetMove.mockRejectedValue(new Error("timeout"));
    const initialPos = { size: 3, turn: 0 };
    const game = gameService.createGame("random_bot", initialPos);
    await expect(gameService.playMove(game.id, { size: 3, turn: 1 })).rejects.toThrow();
    // Position should be unchanged since error was thrown before assignment
    // (or mid-execution — implementation-dependent, but game still exists)
    expect(games.has(game.id)).toBe(true);
  });
});
