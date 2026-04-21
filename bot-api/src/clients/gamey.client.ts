import axios from "axios";

class GameyClient {
    async chooseBotMove(botId: string, yen: any) {
        const BASE_URL = process.env.GAMEY_BASE_URL || "http://gamey:4000";

        const safeBotId = botId || "random_bot";

        const res = await axios.post(
            `${BASE_URL}/v1/ybot/choose/${safeBotId}`,
            yen
        );

        return res.data;
    }
}

export const gameyClient = new GameyClient();