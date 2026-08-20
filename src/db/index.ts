import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const DB_PATH =
  process.env.APEX_DB_PATH ?? path.join(process.cwd(), "data", "apex.db");

/** El dev server de Next recarga módulos en caliente; sin este cache se
 *  abriría un handle nuevo de SQLite en cada recarga. */
const globalForDb = globalThis as unknown as {
  __apexDb?: ReturnType<typeof createDb>;
};

function createDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db = globalForDb.__apexDb ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.__apexDb = db;

export { schema, DB_PATH };
