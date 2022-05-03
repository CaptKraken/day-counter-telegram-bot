import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cron from "node-cron";
import {
  cache,
  dbClient,
  fetchAndCache,
  increaseDayCount,
  sendMessageToGroup,
} from "./services";

dotenv.config();
export const { DOCUMENT_ID, TOKEN, SERVER_URL, CONNECTION_STRING } =
  process.env;
export const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;
const WEBHOOK_URL = SERVER_URL + URI;
const port = process.env.PORT || 5000;

const app: Express = express();
app.use(bodyParser.json());

const everydayAtFiveAM: string = "00 05 * * *";
cron.schedule(
  everydayAtFiveAM,
  async function () {
    try {
      // connnect to db
      await dbClient.connect();
      // increases the day count in db
      const doc = await increaseDayCount();
      // send message to the group
      if (doc) {
        await sendMessageToGroup(`ថ្ងៃ ${doc["day_count"]}`);
      }
      // refresh the cache
      await fetchAndCache();
    } catch (err) {
      console.error(`Cron Job Error\nerror: ${err}`);
    } finally {
      await dbClient.close();
    }
  },
  {
    timezone: "Asia/Phnom_Penh",
  }
);

app.get("/", (req: Request, res: Response) => {
  res.json({ alive: true });
});

app.post(URI, async (req: Request, res: Response) => {
  const message = req.body.message || req.body.edited_message;
  if (!message) return res.send();
  const messageId: number = message.message_id;
  const chatId: number = message.chat.id;
  const senderId: number = message.from.id;
  console.log(message);
  res.send();

  // await sendMessage(chatId, "bruh");
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});
