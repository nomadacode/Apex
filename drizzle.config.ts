import path from "node:path";

import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url:
      process.env.APEX_DB_PATH ??
      path.join(process.cwd(), "data", "apex.db"),
  },
} satisfies Config;
