import axios from "axios";
import { gameyClient } from "../clients/gamey.client";
// The response shape for a move: either coordinates or a special action.
export type BotResponse =
    | { coords: { x: number; y: number; z: number } }
    | { action: string };

class BotService {
    async getMove(botId: string | undefined, yen: any): Promise<BotResponse> {
        // Fall back to a real bot name registered in gamey
        const id = botId || "random_bot";

        try {
            // Remote bot: delegate to another /play endpoint
            if (id.startsWith("http")) {
                const res = await axios.get(`${id}/play`, {
                    params: {
                        position: JSON.stringify(yen)
                    }
                });

                return this.normalize(res.data);
            }

            // Local bot: call gamey's choose endpoint
            const res = await gameyClient.chooseBotMove(id, yen);

            return this.normalize(res);
        } catch (err: any) {
            console.error(
                "Bot error:",
                err?.response?.data || err.message
            );
            throw err;
        }
    }

    /**
     * Normalises whatever gamey (or a remote bot) returns into our unified
     * BotResponse shape.
     *
     * Gamey's /v1/ybot/choose response: { api_version, bot_id, coords: {x,y,z} }
     * Remote /play response (coords):   { coords: {x,y,z} }
     * Remote /play response (action):   { action: "swap" | "resign" | ... }
     * Legacy flat coords:               { x, y, z }
     */
    normalize(data: any): BotResponse {
        if (!data) throw new Error("Empty bot response");

        // Action response (swap, resign, …)
        if (typeof data.action === "string") {
            return { action: data.action };
        }

        // Wrapped coords: { coords: { x, y, z } }  ← gamey's shape and remote shape
        if (data.coords && typeof data.coords.x === "number") {
            return { coords: data.coords };
        }

        // Flat coords: { x, y, z }  ← legacy / alternative shape
        if (typeof data.x === "number") {
            return { coords: { x: data.x, y: data.y, z: data.z } };
        }

        throw new Error("Invalid bot response: " + JSON.stringify(data));
    }
}

export const botService = new BotService();