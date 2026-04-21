// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// mock axios BEFORE importing module
vi.mock("axios", () => ({
    default: {
        post: vi.fn(),
    },
}));

import axios from "axios";
import { gameyClient } from "../src/clients/gamey.client";
const mockedPost = vi.mocked(axios.post);

describe("gameyClient.chooseBotMove", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.GAMEY_BASE_URL;
    });

    it("uses default BASE_URL when env is not set", async () => {
        mockedPost.mockResolvedValue({ data: "ok" });

        await gameyClient.chooseBotMove("bot1", { move: "x" });

        expect(mockedPost).toHaveBeenCalledWith(
            expect.stringContaining("http"),
            expect.any(Object)
        );
    });

    it("uses GAMEY_BASE_URL from environment", async () => {
        process.env.GAMEY_BASE_URL = "http://test-url";

        mockedPost.mockResolvedValue({ data: "ok" });

        await gameyClient.chooseBotMove("bot1", { move: "x" });

        expect(mockedPost).toHaveBeenCalledWith(
            expect.stringContaining("http://test-url"),
            expect.any(Object)
        );
    });

    it("includes botId in URL", async () => {
        mockedPost.mockResolvedValue({ data: "ok" });

        await gameyClient.chooseBotMove("bot123", { move: "x" });

        expect(mockedPost).toHaveBeenCalledWith(
            expect.stringContaining("bot123"),
            expect.any(Object)
        );
    });

    it("falls back to random_bot when botId is empty", async () => {
        mockedPost.mockResolvedValue({ data: "ok" });

        await gameyClient.chooseBotMove("", { move: "x" });

        expect(mockedPost).toHaveBeenCalledWith(
            expect.stringContaining("random_bot"),
            expect.any(Object)
        );
    });

    it("returns axios response data", async () => {
        mockedPost.mockResolvedValue({
            data: { success: true },
        });

        const result = await gameyClient.chooseBotMove("bot1", { move: "x" });

        expect(result).toEqual({ success: true });
    });

    it("passes body unchanged", async () => {
        mockedPost.mockResolvedValue({ data: {} });

        const body = { move: "rock", meta: { speed: 10 } };

        await gameyClient.chooseBotMove("bot1", body);

        expect(mockedPost).toHaveBeenCalledWith(
            expect.any(String),
            body
        );
    });

    it("propagates errors from axios", async () => {
        mockedPost.mockRejectedValue(new Error("fail"));

        await expect(
            gameyClient.chooseBotMove("bot1", { move: "x" })
        ).rejects.toThrow("fail");
    });
});