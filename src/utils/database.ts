import { Storage } from "@ionic/storage";

import { decode, encode } from "../utils/encoding";

const storage = { db: undefined as Storage | undefined };

export default function database() {
  database.initialize();
  return storage.db;
}

database.initialize = async function () {
  if (!storage.db) {
    storage.db = new Storage();
    storage.db = await storage.db.create();
  }
  return storage.db;
};

database.write = async function <T>(key: string, value: T, pretty = false) {
  const data = encode(value, pretty);
  const db = await database.initialize();
  return await db?.set(key, data);
};

database.read = async function <T>(key: string): Promise<T | undefined> {
  const db = await database.initialize();
  const data = await db?.get(key);
  return decode(data);
};

database.clear = async function () {
  const db = await database.initialize();
  await db?.clear();
};
