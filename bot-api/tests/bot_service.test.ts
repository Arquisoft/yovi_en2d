// ✅ MUST be before imports
process.env.ALLOWED_REMOTE_BOT_URLS = "http://my-bot:5000";

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