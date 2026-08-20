import path from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db } from "./index";
import { seed } from "./seed";

/** Migrar + sembrar al primer acceso, para que la app nunca corra contra
 *  una base sin esquema. Idempotente y cacheado por proceso. */
const globalForBootstrap = globalThis as unknown as {
  __apexReady?: boolean;
};

export function ensureDb() {
  if (globalForBootstrap.__apexReady) return db;
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  seed();
  globalForBootstrap.__apexReady = true;
  return db;
}
