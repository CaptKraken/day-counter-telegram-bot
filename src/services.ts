import axios from "axios";
import { MongoClient, ObjectId, WithId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();
const { TOKEN, CONNECTION_STRING, DOCUMENT_ID } = process.env;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
export const dbClient = new MongoClient(`${CONNECTION_STRING}`);

type DBSchema = {
  _id: ObjectId;
  chat_id: number;
  admins: number[];
  day_count: number;
};

export type Cache = DBSchema | undefined;

export let cache: Cache;

export const isAdmin = (senderId: number) => cache?.admins.includes(senderId);

export const fetchAndCache = async () => {
  try {
    await dbClient.connect();
    if (DOCUMENT_ID) {
      const document = await findOneDocument(DOCUMENT_ID);
      if (document) {
        //@ts-ignore
        cache = document;
      }
    }
  } catch (err) {
    throw new Error(`function: "fetchAndCache"\nError:\n${err}`);
  } finally {
    await dbClient.close();
  }
};

export const findOneDocument = async (documentId: string) => {
  try {
    if (documentId) {
      const document = await dbClient
        .db("day-count-db")
        .collection("data")
        .findOne({ _id: new ObjectId(documentId) });
      return document;
    }
  } catch (err) {
    throw new Error(
      `function: "findOneDocument"\nDOCUMENT_ID: ${documentId}\nError:\n${err},`
    );
  }
};

export const increaseDayCount = async () => {
  try {
    await dbClient.connect();
    const collection = await dbClient
      .db("day-count-db")
      .collection("data")
      .findOneAndUpdate(
        { _id: new ObjectId(DOCUMENT_ID) },
        { $inc: { day_count: 1 } }
      );
    if (collection.ok) {
      const updated = {
        ...collection.value,
        day_count: (collection?.value?.day_count || 0) + 1,
      };
      //@ts-ignore
      cache = updated;
      return updated;
    } else {
      return null;
    }
  } catch (err) {
    throw new Error(`function: "increaseDayCount"\nError:\n${err}`);
  } finally {
    await dbClient.close();
  }
};

export const setDayCount = async (dayCount: number) => {
  try {
    await dbClient.connect();
    const collection = await dbClient
      .db("day-count-db")
      .collection("data")
      .findOneAndUpdate(
        { _id: new ObjectId(DOCUMENT_ID) },
        {
          $set: { day_count: dayCount },
        },
        {
          upsert: true,
        }
      );
    // @ts-ignore
    cache = { ...collection.value, day_count: dayCount };
  } catch (err) {
    throw new Error(`function: "setDayCount"\nError:\n${err}`);
  } finally {
    await dbClient.close();
  }
};

export const setGroup = async (groupId: number) => {
  try {
    await dbClient.connect();
    const collection = await dbClient
      .db("day-count-db")
      .collection("data")
      .findOneAndUpdate(
        { _id: new ObjectId(DOCUMENT_ID) },
        {
          $set: { chat_id: groupId },
        },
        {
          upsert: true,
        }
      );
    // @ts-ignore
    cache = { ...collection.value, chat_id: groupId };
  } catch (err) {
    throw new Error(`function: "setGroup"\nError:\n${err}`);
  } finally {
    await dbClient.close();
  }
};

export const sendMessage = async (chat_id: number, message: string) => {
  if (!chat_id || !message) return;
  try {
    const res = await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id,
      text: message,
    });
    console.log(res.data);
  } catch (err) {
    throw new Error(
      `function: "sendMessage"\nchat_id: ${chat_id}\nmessage: ${message}\n${err}`
    );
  }
};

export const setAdmin = async (senderId: number) => {
  try {
    await dbClient.connect();
    await dbClient
      .db("day-count-db")
      .collection("data")
      .updateOne(
        { _id: new ObjectId(DOCUMENT_ID) },
        {
          $push: { admins: senderId },
        }
      );
    await fetchAndCache();
  } catch (err) {
    throw new Error(`function: "setGroup"\nError:\n${err}`);
  } finally {
    await dbClient.close();
  }
};

export const removeAdmin = async (senderId: number) => {
  try {
    await dbClient.connect();
    await dbClient
      .db("day-count-db")
      .collection("data")
      .updateOne(
        { _id: new ObjectId(DOCUMENT_ID) },
        {
          $pull: { admins: senderId },
        }
      );
    await fetchAndCache();
  } catch (err) {
    throw new Error(`function: "setGroup"\nError:\n${err}`);
  } finally {
    await dbClient.close();
  }
};

export const sendMessageToGroup = async (message: string) => {
  try {
    if (!cache?.chat_id) await fetchAndCache();
    cache?.chat_id && (await sendMessage(cache?.chat_id, message));
  } catch (err) {
    throw new Error(
      `function: "sendMessageToGroup"\nmessage: ${message}\nError:\n${err}`
    );
  }
};
