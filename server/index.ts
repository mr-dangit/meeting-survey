import path from "node:path";

import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { buildRuntime } from "./runtime.js";

async function start() {
  const config = loadConfig(process.env);
  const pool = createPool(config.databaseUrl);
  const app = await buildRuntime(config, pool, path.resolve(process.cwd(), "dist/client"));
  app.addHook("onClose", async () => pool.end());

  await app.listen({ host: "0.0.0.0", port: config.port });
}

void start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
