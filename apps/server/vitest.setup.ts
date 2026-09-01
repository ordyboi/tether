import path from "node:path";

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../../.env"));
} catch {
  // .env is optional locally when running against CI-provided env vars
}
