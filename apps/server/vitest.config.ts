import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    // DB tests share one database; truncation in beforeEach means files
    // cannot run concurrently.
    fileParallelism: false,
  },
});
