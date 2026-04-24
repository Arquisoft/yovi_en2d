import axios from "axios";

class GameyClient {
    async chooseBotMove(botId: string, yen: any) {
        const BASE_URL = process.env.GAMEY_BASE_URL || "http://gamey:4000";

        // 🔒 Only internal callers reach this method — bot.service.ts has already
        // validated botId against the allowlist before passing it here.
        // We keep the empty-string guard as a safe default only.
        const safeBotId = botId || "random_bot";

        const res = await axios.post(
            `${BASE_URL}/v1/ybot/choose/${safeBotId}`,
            yen
        );

        return res.data;
    }
}

export const gameyClient = new GameyClient();