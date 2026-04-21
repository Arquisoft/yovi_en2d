import { describe, it, expect, beforeEach } from "vitest";
import { games, Game } from "../src/models/game.model";

describe("games Map", () => {
  beforeEach(() => games.clear());

  it("starts empty after clear", () => {
    expect(games.size).toBe(0);
  });

  it("can store and retrieve a game by id", () => {
    const game: Game = { id: "abc", botId: "random_bot", position: {}, status: "ONGOING" };
    games.set(game.id, game);
    expect(games.get("abc")).toEqual(game);
  });

  it("can store a game with ONGOING status", () => {
    const game: Game = { id: "1", botId: "b", position: null, status: "ONGOING" };
    games.set(game.id, game);
    expect(games.get("1")!.status).toBe("ONGOING");
  });

  it("can store a game with FINISHED status", () => {
    const game: Game = { id: "2", botId: "b", position: null, status: "FINISHED" };
    games.set(game.id, game);
    expect(games.get("2")!.status).toBe("FINISHED");
  });

  it("returns undefined for a missing key", () => {
    expect(games.get("nonexistent")).toBeUndefined();
  });

  it("can overwrite an existing game", () => {
    const game: Game = { id: "x", botId: "b1", position: {}, status: "ONGOING" };
    games.set(game.id, game);
    games.set(game.id, { ...game, status: "FINISHED" });
    expect(games.get("x")!.status).toBe("FINISHED");
  });

  it("can store multiple games independently", () => {
    const g1: Game = { id: "g1", botId: "b1", position: { turn: 0 }, status: "ONGOING" };
    const g2: Game = { id: "g2", botId: "b2", position: { turn: 1 }, status: "FINISHED" };
    games.set(g1.id, g1);
    games.set(g2.id, g2);
    expect(games.size).toBe(2);
    expect(games.get("g1")).toEqual(g1);
    expect(games.get("g2")).toEqual(g2);
  });

  it("can delete a game", () => {
    const game: Game = { id: "del", botId: "b", position: {}, status: "ONGOING" };
    games.set(game.id, game);
    games.delete(game.id);
    expect(games.get("del")).toBeUndefined();
  });

  it("stores complex position objects", () => {
    const position = { size: 7, turn: 0, players: ["B", "R"], layout: "B/.R./....." };
    const game: Game = { id: "complex", botId: "minimax_bot", position, status: "ONGOING" };
    games.set(game.id, game);
    expect(games.get("complex")!.position).toEqual(position);
  });

  it("stores null position", () => {
    const game: Game = { id: "null-pos", botId: "b", position: null, status: "ONGOING" };
    games.set(game.id, game);
    expect(games.get("null-pos")!.position).toBeNull();
  });
});
