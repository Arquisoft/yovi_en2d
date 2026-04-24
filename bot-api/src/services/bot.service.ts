import axios from "axios";
import { gameyClient } from "../clients/gamey.client";

export type BotResponse =
    | { coords: { x: number; y: number; z: number } }
    | { action: string };

// Allowlist of trusted remote bot base URLs.
// Only URLs present here may be used as remote bot endpoints (fixes Sonar S5144).
// Add entries as needed; never derive them from user-supplied input at runtime.
const ALLOWED_REMOTE_BOT_URLS = new Set<string>(
    (process.env.ALLOWED_REMOTE_BOT_URLS ?? "")
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean)
);

/**
 * Returns the URL only if it is in the static allowlist.
 * Throws otherwise, giving Sonar a clear sanitisation point (S5144).
 */
function assertAllowedRemoteUrl(url: string): string {
    if (!ALLOWED_REMOTE_BOT_URLS.has(url)) {
        throw new Error("Remote bot URL is not in the allowlist");
    }
    return url;
}

/**
 * Strips characters that could be used for log injection (newlines, CRs,
 * ANSI escape sequences) and truncates to a safe length (fixes Sonar S5145).
 */
function sanitizeForLog(value: unknown, maxLength = 200): string {
    const raw = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    return raw
        .replace(/[\r\n\t]/g, " ")          // no newline injection
        .replace(/\x1b\[[0-9;]*m/g, "")     // strip ANSI colour codes
        .slice(0, maxLength);
}

class BotService {
    async getMove(botId: string | undefined, yen: any): Promise<BotResponse> {
        const id = botId || "random_bot";

        try {
            // Remote bot — only allowed if the base URL is in the static allowlist.
            if (id.startsWith("http")) {
                const safeBaseUrl = assertAllowedRemoteUrl(id);
                const res = await axios.get(`${safeBaseUrl}/play`, {
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
            // Sanitise before logging to prevent log injection (Sonar S5145).
            const detail = sanitizeForLog(err?.response?.data ?? err?.message ?? "unknown error");
            console.error("Bot error:", detail);
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