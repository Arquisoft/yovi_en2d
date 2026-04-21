import axios from "axios";
import { gameyClient } from "../clients/gamey.client";

export type BotResponse =
    | { coords: { x: number; y: number; z: number } }
    | { action: string };

class BotService {
    async getMove(botId: string | undefined, yen: any): Promise<BotResponse> {
        const id = botId || "random_bot";

        try {
            // Remote bot
            if (id.startsWith("http")) {
                const res = await axios.get(`${id}/play`, {
                    params: {
                        position: JSON.stringify(yen),
                    },
                });

                return this.normalize(res.data);
            }

            // Local bot
            const res = await gameyClient.chooseBotMove(id, yen);

            return this.normalize(res);
        } catch (err: any) {
            console.error("Bot error:", err?.response?.data || err.message);
            throw err;
        }
    }

    normalize(data: any): BotResponse {
        if (!data) throw new Error("Empty bot response");

        if (typeof data.action === "string") {
            return { action: data.action };
        }

        if (data.coords && typeof data.coords.x === "number") {
            return { coords: data.coords };
        }

        if (typeof data.x === "number") {
            return { coords: { x: data.x, y: data.y, z: data.z } };
        }

        throw new Error("Invalid bot response: " + JSON.stringify(data));
    }
}

export const botService = new BotService();