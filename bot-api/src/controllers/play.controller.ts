import { Request, Response } from "express";
import { botService } from "../services/bot.service";
class PlayController {
    async playOnce(req: Request, res: Response) {
        try {
            const rawPosition = req.query.position;
            const botId = req.query.bot_id as string | undefined;

            if (typeof rawPosition !== "string") {
                return res.status(400).json({ error: "position required" });
            }

            let position: any;
            try {
                position = JSON.parse(rawPosition);
            } catch {
                return res.status(400).json({ error: "position is not valid JSON" });
            }

            // getMove returns { coords } or { action } — pass it through directly
            const result = await botService.getMove(botId, position);

            res.json(result);
        } catch (err: any) {
            console.error("play failed:", err?.message || err);
            res.status(500).json({ error: "play failed" });
        }
    }
}

export const playController = new PlayController();
