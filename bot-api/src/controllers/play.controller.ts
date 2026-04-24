import { Request, Response } from "express";
import {
    botService,
    ALLOWED_LOCAL_BOT_IDS,
    ALLOWED_REMOTE_BOT_URLS,
} from "../services/bot.service";

/**
 * 🔒 Resolve safe bot id from allowlists only
 */
function resolveSafeBotId(botId: string | undefined): string | null {
    if (!botId) return "random_bot";

    // ✅ local bots
    if (ALLOWED_LOCAL_BOT_IDS.has(botId)) {
        return botId;
    }

    // ✅ remote bots
    if (ALLOWED_REMOTE_BOT_URLS.has(botId)) {
        return botId;
    }

    return null;
}

class PlayController {
    async playOnce(req: Request, res: Response) {
        try {
            const rawPosition = req.query.position;
            const rawBotId = req.query.bot_id as string | undefined;

            if (typeof rawPosition !== "string") {
                return res.status(400).json({ error: "position required" });
            }

            const safeBotId = resolveSafeBotId(rawBotId);

            if (safeBotId === null) {
                return res.status(400).json({ error: "invalid bot_id" });
            }

            let position: any;
            try {
                position = JSON.parse(rawPosition);
            } catch {
                return res.status(400).json({ error: "position is not valid JSON" });
            }

            const result = await botService.getMove(safeBotId, position);

            res.json(result);
        } catch (err: any) {
            console.error("play failed:", err?.message || err);
            res.status(500).json({ error: "play failed" });
        }
    }
}

export const playController = new PlayController();