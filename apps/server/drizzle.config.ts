import { defineConfig } from "drizzle-kit";

import { env } from "./src/env.js";

export default defineConfig({
  dialect: "postgresql",
  // an explicit file list, not a directory glob, so *.test.ts is never picked up
  schema: [
    "./src/db/schema/auth.ts",
    "./src/db/schema/enums.ts",
    "./src/db/schema/devices.ts",
    "./src/db/schema/rooms.ts",
    "./src/db/schema/membership.ts",
    "./src/db/schema/fixes.ts",
    "./src/db/schema/precision.ts",
  ],
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
