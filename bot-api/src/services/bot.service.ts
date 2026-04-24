import axios from "axios";
import { gameyClient } from "../clients/gamey.client";

export type BotResponse =
    | { coords: { x: number; y: number; z: number } }
    | { action: string };

/**
 * ✅ Local bot allowlist (used by gateway/gamey)
 */
export const ALLOWED_LOCAL_BOT_IDS = new Set<string>([
    "random_bot",
    "smart_bot",
    "heuristic_bot",
    "minimax_bot",
    "alfa_beta_bot",
    "monte_carlo_hard",
    "monte_carlo_extreme",
    "monte_carlo_bot",
]);

/**
 /**
 * ✅ Remote bot allowlist (from env)
 * Key   = the identifier callers pass in (may equal the URL)
 * Value = the canonical trusted URL from config — this is what we build requests from
 */
export const ALLOWED_REMOTE_BOT_URLS = new Map<string, string>(
    (process.env.ALLOWED_REMOTE_BOT_URLS ?? "")
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean)
        .map((u) => [u, u])   // key and value are the same; value is what matters
);

/**
 * 🔒 Returns the trusted URL from the allowlist map.
 * By returning map.get() rather than the user-supplied string,
 * the returned value is no longer tainted in SonarQube's data-flow model.
 */
function resolveTrustedRemoteUrl(id: string): string {
    const trusted = ALLOWED_REMOTE_BOT_URLS.get(id);
    if (trusted === undefined) {
        throw new Error("Remote bot URL is not in the allowlist");
    }
    return trusted;  // ← origin is the Map, not user input
}
/**
 * 🔒 Prevent log injection
 */
function sanitizeForLog(value: unknown, maxLength = 200): string {
    const raw = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    return raw
        .replace(/[\r\n\t]/g, " ")
        .replace(/\x1b\[[0-9;]*m/g, "")
        .slice(0, maxLength);
}

class BotService {
    async getMove(botId: string | undefined, yen: any): Promise<BotResponse> {
        const id = botId || "random_bot";

        try {
            // ✅ Remote bot (strict allowlist)
            if (id.startsWith("http")) {
                const trustedUrl = resolveTrustedRemoteUrl(id);   // taint chain broken here

                const res = await axios.get(`${trustedUrl}/play`, {
                    params: {
                        position: JSON.stringify(yen),
                    },
                });

                return this.normalize(res.data);
            }

            // ✅ Local bot (strict allowlist)
            if (!ALLOWED_LOCAL_BOT_IDS.has(id)) {
                throw new Error("Invalid local bot id");
            }

            const res = await gameyClient.chooseBotMove(id, yen);
            return this.normalize(res);

        } catch (err: any) {
            const detail = sanitizeForLog(
                err?.response?.data ?? err?.message ?? "unknown error"
            );
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