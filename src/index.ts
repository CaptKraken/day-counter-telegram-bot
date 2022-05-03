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
  removeAdmin,
  sendDisappearingMessage,
  sendDisappearingMessageToGroup,
  sendMessage,
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

// keep the heroku app alive
setInterval(function () {
  axios.get(`${SERVER_URL}`);
}, 600000); // every 10 minutes

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
        await sendMessageToGroup(`ថ្ងៃ ${doc.day_count}`);
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
  removeAdmin: "removeAdmin",
};

app.post(URI, async (req: Request, res: Response) => {
  const message = req.body.message;
  if (!message) return res.send();
  const messageId: number = message.message_id;
  const chatId: number = message.chat.id;
  const senderId: number = message.from.id;
  const text: string = `${message.text}`.trim();

  console.log(message);

  if (!text || !messageId || !chatId || !senderId || !isAdmin(senderId)) {
    res.send();
  }
  try {
    if (text.includes(`${COMMANDS.setCount} `)) {
      const count = Number(text.replace(`${COMMANDS.setCount} `, "").trim());
      const isIdValid = !isNaN(count);
      if (isIdValid) {
        await setDayCount(count);
        await sendDisappearingMessageToGroup(
          `[BOT]: Day count set to ${count}.`
        );
      }
    }
    if (text.includes(COMMANDS.setGroup)) {
      const isGroup = message.chat.type === "group";

      if (isGroup) {
        await setGroup(chatId);
        await sendDisappearingMessageToGroup(
          `[BOT]: This group has been set to the default.`
        );
      }
    }

    if (text.includes(COMMANDS.setAdmin)) {
      const toBeAdminId = message.reply_to_message.from.id;
      const isIdValid = !isNaN(toBeAdminId);

      if (isIdValid) {
        await setAdmin(toBeAdminId);
        await sendDisappearingMessageToGroup(
          `[BOT]: ID ${toBeAdminId} ADDED TO ADMIN LIST.`
        );
      }
    }

    if (text.includes(COMMANDS.removeAdmin)) {
      const toBeRemovedId = message.reply_to_message.from.id;
      const isIdValid = !isNaN(toBeRemovedId);

      if (isIdValid) {
        await removeAdmin(toBeRemovedId);
        await sendDisappearingMessageToGroup(
          `[BOT]: ID ${toBeRemovedId} REMOVED FROM ADMIN LIST.`
        );
      }
    }
  } catch (err) {
    await sendMessage(Number(cache?.admins[0]), `${err}`);
  } finally {
    res.send();
  }
});

app.listen(port, async () => {
  console.log(`⚡️[server]: Server is running on port ${port}`);
  await init();
});
