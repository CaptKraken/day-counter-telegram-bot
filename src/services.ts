import axios from "axios";
import { MongoClient, ObjectId } from "mongodb";
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

/**
 * fetch the whole document and set them to the cache variable.
 */
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

/**
 * finds one document with the given document id
 * @param {string} documentId a document id
 * @returns Document | null
 */
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

/**
 * increases day count in the database
 * @returns Document | null
 */
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

/**
 * sets day count in the database
 * @param {number} dayCount count
 */
export const setDayCount = async (dayCount: number): Promise<void> => {
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

/**
 * sets group to the default chat_id in the database
 * @param {number} groupId chat_id
 */
export const setGroup = async (groupId: number): Promise<void> => {
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

/**
 * sets admin to the list in the database
 * @param {number} userId user id
 */
export const setAdmin = async (userId: number): Promise<void> => {
  try {
    await dbClient.connect();
    await dbClient
      .db("day-count-db")
      .collection("data")
      .updateOne(
        { _id: new ObjectId(DOCUMENT_ID) },
        {
          $push: { admins: userId },
        }
      );
    await fetchAndCache();
  } catch (err) {
    throw new Error(`function: "setGroup"\nError:\n${err}`);
  } finally {
    await dbClient.close();
  }
};

/**
 * removes admin from the list in the database
 * @param {number} userId user id
 */
export const removeAdmin = async (userId: number): Promise<void> => {
  try {
    await dbClient.connect();
    await dbClient
      .db("day-count-db")
      .collection("data")
      .updateOne(
        { _id: new ObjectId(DOCUMENT_ID) },
        {
          $pull: { admins: userId },
        }
      );
    await fetchAndCache();
  } catch (err) {
    throw new Error(`function: "setGroup"\nError:\n${err}`);
  } finally {
    await dbClient.close();
  }
};

/**
 * sends a message to the given group with the given message
 * @param {number} chat_id chat id
 * @param {string} message message to be sent
 */
export const sendMessage = async (
  chat_id: number,
  message: string
): Promise<any | undefined> => {
  if (!chat_id || !message) return;
  try {
    const res = await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id,
      text: message,
    });
    if (res.data.ok) {
      return res.data.result;
    }
  } catch (err) {
    throw new Error(
      `function: "sendMessage"\nchat_id: ${chat_id}\nmessage: ${message}\n${err}`
    );
  }
};

/**
 * deletes a message to the given group with the given message
 * @param {number} chat_id chat id
 * @param {number} message_id message id
 */
export const deleteMessage = async (chat_id: number, message_id: number) => {
  if (!chat_id || !message_id) return;
  try {
    const res = await axios.post(`${TELEGRAM_API}/deleteMessage`, {
      chat_id,
      message_id,
    });
    if (res.data.ok) {
      return res.data.result;
    }
  } catch (err) {
    throw new Error(
      `function: "deleteMessage"\nchat_id: ${chat_id}\nmessage_id: ${message_id}\n${err}`
    );
  }
};

/**
 * sends and deletes a message to the given chat
 * @param {number} chat_id chat id
 * @param {string} message message to be sent
 * @param {number} seconds delay in seconds
 */
export const sendDisappearingMessage = async (
  chat_id: number,
  message: string,
  seconds: number = 5
): Promise<void> => {
  const result = await sendMessage(
    chat_id,
    `${message}\nThis message will be deleted in ${seconds} seconds.`
  );
  const sentMessageId = result.message_id;
  if (!sentMessageId) return;
  setTimeout(async () => {
    await deleteMessage(chat_id, sentMessageId);
  }, seconds * 1000);
};

/**
 * sends then deletes to the default group
 * @param {string} message message to be sent
 * @param {number} seconds delay in seconds
 */
export const sendDisappearingMessageToGroup = async (
  message: string,
  seconds: number = 5
): Promise<void> => {
  if (!cache?.chat_id) await fetchAndCache();
  if (cache?.chat_id) {
    await sendDisappearingMessage(cache.chat_id, message, seconds);
  }
};

/**
 * sends a message to the default group
 * @param message message to be sent
 * @returns
 */
export const sendMessageToGroup = async (message: string) => {
  try {
    if (!cache?.chat_id) await fetchAndCache();
    if (cache?.chat_id) {
      return await sendMessage(cache?.chat_id, message);
    }
  } catch (err) {
    throw new Error(
      `function: "sendMessageToGroup"\nmessage: ${message}\nError:\n${err}`
    );
  }
};
