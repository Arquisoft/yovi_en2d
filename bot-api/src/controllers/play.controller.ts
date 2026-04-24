import { Request, Response } from "express";
import {
    botService,
    ALLOWED_LOCAL_BOT_IDS,
    ALLOWED_REMOTE_BOT_URLS,
} from "../services/bot.service";

/**
 * 🔒 Resolve safe bot id from allowlists only.
 * Returns the value FROM the allowlist data structure (not the user input)
 * so the taint chain is broken at the controller level.
 */
function resolveSafeBotId(botId: string | undefined): string | null {
    if (!botId) return "random_bot";

    // ✅ Local bots — iterate to find and return the trusted value from the Set
    for (const trusted of ALLOWED_LOCAL_BOT_IDS) {
        if (trusted === botId) return trusted; // origin is the Set literal, not user input
    }

    // ✅ Remote bots — return the Map's stored value, not the user string
    const trustedUrl = ALLOWED_REMOTE_BOT_URLS.get(botId);
    if (trustedUrl !== undefined) return trustedUrl;

    return null;
}

/**
 * 🔒 Prevent log injection in controller error handler
 */
function sanitizeErrorForLog(err: unknown, maxLength = 200): string {
    const raw =
        err instanceof Error
            ? err.message
            : typeof err === "string"
                ? err
                : JSON.stringify(err) ?? "unknown";
    return raw
        .replace(/[\r\n\t]/g, " ")
        .replace(/\x1b\[[0-9;]*m/g, "")
        .slice(0, maxLength);
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
            // 🔒 sanitize before logging — never log raw user-controlled data
            console.error("play failed:", sanitizeErrorForLog(err));
            res.status(500).json({ error: "play failed" });
        }
    }
}

export const playController = new PlayController();