import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cron from "node-cron";
import {
  cache,
  dbClient,
  fetchAndCache,
  increaseDayCount,
  isAdmin,
  sendMessageToGroup,
  setAdmin,
  setDayCount,
  setGroup,
} from "./services";
import axios from "axios";

dotenv.config();
export const { DOCUMENT_ID, TOKEN, SERVER_URL, CONNECTION_STRING } =
  process.env;
export const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;
const WEBHOOK_URL = SERVER_URL + URI;
const port = process.env.PORT || 3000;

const app: Express = express();
app.use(bodyParser.json());

const init = async () => {
  try {
    const res = await axios.get(
      `${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`
    );
    console.info(res.data);

    await fetchAndCache();
  } catch (err) {
    console.log(err);
    //   await sendMessageToAdmin(`INIT FAILED\n${err}`);
  }
};

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

const COMMANDS = {
  setCount: "setCount",
  setGroup: "setGroup",
  setAdmin: "setAdmin",
};

app.post(URI, async (req: Request, res: Response) => {
  const message = req.body.message;
  if (!message) return res.send();
  const messageId: number = message.message_id;
  const chatId: number = message.chat.id;
  const senderId: number = message.from.id;
  const text: string = `${message.text}`.trim();
  console.log(`TEXT`, text);

  if (!text || !messageId || !chatId || !senderId || !isAdmin(senderId)) {
    res.send();
  }
  try {
    if (text.includes(`${COMMANDS.setCount} `)) {
      const count = Number(text.replace(`${COMMANDS.setCount} `, "").trim());
      const isIdValid = !isNaN(count);
      if (isIdValid) {
        await setDayCount(count);
      }
    }
    if (text.includes(COMMANDS.setGroup)) {
      const isGroup = message.chat.type === "group";

      if (isGroup) {
        await setGroup(chatId);
      }
    }

    if (text.includes(COMMANDS.setAdmin)) {
      const toBeAdminId = message.reply_to_message.from.id;
      const isIdValid = !isNaN(toBeAdminId);
      console.log(toBeAdminId);

      if (isIdValid) {
        await setAdmin(toBeAdminId);
      }
    }
  } catch (err) {
  } finally {
    res.send();
  }

  res.send();

  // await sendMessage(chatId, "bruh");
});

app.listen(port, async () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);

  await init();
});
