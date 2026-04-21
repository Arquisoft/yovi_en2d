import { describe, it, expect, vi, beforeEach } from "vitest";

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
import { botService } from "../src/services/bot.service";

const mockedChooseBotMove = vi.mocked(gameyClient.chooseBotMove);
const mockedGet = vi.mocked(axios.get);

beforeEach(() => {
    vi.clearAllMocks();
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
});

// ── getMove – local bot ──────────────────────────────────────────────────────
describe("BotService.getMove (local bot)", () => {
    it("calls gameyClient.chooseBotMove with the botId and position", async () => {
        mockedChooseBotMove.mockResolvedValue({ coords: { x: 1, y: 0, z: 2 } });
        await botService.getMove("random_bot", { size: 3 });
        expect(mockedChooseBotMove).toHaveBeenCalledWith("random_bot", { size: 3 });
    });

    it("defaults to random_bot when botId is undefined", async () => {
        mockedChooseBotMove.mockResolvedValue({ coords: { x: 0, y: 0, z: 0 } });
        await botService.getMove(undefined, {});
        expect(mockedChooseBotMove).toHaveBeenCalledWith("random_bot", {});
    });

    it("returns normalized coords response", async () => {
        mockedChooseBotMove.mockResolvedValue({ coords: { x: 1, y: 2, z: 3 } });
        const result = await botService.getMove("random_bot", {});
        expect(result).toEqual({ coords: { x: 1, y: 2, z: 3 } });
    });

    it("returns normalized action response", async () => {
        mockedChooseBotMove.mockResolvedValue({ action: "resign" });
        const result = await botService.getMove("random_bot", {});
        expect(result).toEqual({ action: "resign" });
    });

    it("propagates errors from gameyClient", async () => {
        mockedChooseBotMove.mockRejectedValue(new Error("gamey down"));
        await expect(botService.getMove("random_bot", {})).rejects.toThrow("gamey down");
    });
});

// ── getMove – remote bot (http) ──────────────────────────────────────────────
describe("BotService.getMove (remote bot via http)", () => {
    it("calls axios.get with /play and serialized position", async () => {
        mockedGet.mockResolvedValue({ data: { coords: { x: 1, y: 0, z: 2 } } });
        const pos = { size: 3, turn: 1 };
        await botService.getMove("http://my-bot:5000", pos);
        expect(mockedGet).toHaveBeenCalledWith("http://my-bot:5000/play", {
            params: { position: JSON.stringify(pos) },
        });
    });

    it("returns normalized response from remote bot", async () => {
        mockedGet.mockResolvedValue({ data: { action: "swap" } });
        const result = await botService.getMove("http://my-bot:5000", {});
        expect(result).toEqual({ action: "swap" });
    });

    it("propagates errors from remote bot", async () => {
        mockedGet.mockRejectedValue(new Error("timeout"));
        await expect(botService.getMove("http://my-bot:5000", {})).rejects.toThrow("timeout");
    });
});