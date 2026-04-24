import axios from "axios";

/**
 * 🔒 Local copy of the allowlist — gamey.client owns its own taint boundary
 * so SonarQube sees the URL constructed from a non-tainted origin in this file.
 */
const SAFE_BOT_IDS = new Set<string>([
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
 * 🔒 Returns a value whose origin is the Set literal in this file,
 * not the caller's string — breaks the taint chain at the sink file.
 */
function resolveSafeBotId(botId: string): string {
    for (const trusted of SAFE_BOT_IDS) {
        if (trusted === botId) return trusted;
    }
    throw new Error(`Unknown bot id: ${botId}`);
}

class GameyClient {
    async chooseBotMove(botId: string, yen: any) {
        const BASE_URL = process.env.GAMEY_BASE_URL || "http://gamey:4000";

        // 🔒 Re-resolve here so the value concatenated into the URL
        // originates from SAFE_BOT_IDS, not the function argument
        const safeBotId = resolveSafeBotId(botId);

        const res = await axios.post(
            `${BASE_URL}/v1/ybot/choose/${safeBotId}`,
            yen
        );

        return res.data;
    }
}

export const gameyClient = new GameyClient();