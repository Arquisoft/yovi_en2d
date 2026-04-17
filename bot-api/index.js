import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const GAMEY_URL = process.env.GAMEY_URL || "http://gamey:4000";

async function callBot(bot, yen) {
    // remote bot (other universities)
    if (bot.startsWith("http")) {
        const res = await axios.post(`${bot}/v1/ybot/choose`, yen);
        return normalizeCoords(res.data);
    }

    // local bot (Gamey registry)
    const res = await axios.post(
        `${GAMEY_URL}/v1/ybot/choose/${bot}`,
        yen
    );

    return normalizeCoords(res.data);
}

function normalizeCoords(data) {
    return data.coords || data;
}

app.post("/bot/move", async (req, res) => {
    const { bot, yen } = req.body;

    try {
        const coords = await callBot(bot, yen);
        res.json({ success: true, coords });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, error: "Bot failed" });
    }
});

app.post("/bot/bvb", async (req, res) => {
    const { yen, bot1, bot2 } = req.body;

    if (!yen || !bot1 || !bot2) {
        return res.status(400).json({ error: "Missing data" });
    }

    try {
        // BOT 1 MOVE
        const move1 = await callBot(bot1, yen);

        // apply bot1 move through game engine
        const afterBot1 = await axios.post(
            `${GAMEY_URL}/v1/game/apply`,
            {
                yen,
                row: move1.row,
                col: move1.col
            }
        );

        const yenAfterBot1 = afterBot1.data.yen;

        // BOT 2 MOVE
        const move2 = await callBot(bot2, yenAfterBot1);

        const final = await axios.post(
            `${GAMEY_URL}/v1/game/apply`,
            {
                yen: yenAfterBot1,
                row: move2.row,
                col: move2.col
            }
        );

        return res.json(final.data);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "BvB failed" });
    }
});

app.get("/bots", async (req, res) => {
    try {
        const response = await axios.get(`${GAMEY_URL}/v1/ybot/info`);
        res.json(response.data);
    } catch {
        res.json({ bots: [] });
    }
});

app.listen(6000, () => {
    console.log("Bot API running on port 6000");
});