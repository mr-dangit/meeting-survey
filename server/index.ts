import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { PostgresMeetingRepository, PostgresResponseRepository } from "./db/postgres-repositories.js";

async function start() {
  const config = loadConfig(process.env);
  const pool = createPool(config.databaseUrl);
  const app = await buildApp({
    config,
    meetings: new PostgresMeetingRepository(pool),
    responses: new PostgresResponseRepository(pool)
  });
  app.addHook("onClose", async () => pool.end());

  await app.listen({ host: "0.0.0.0", port: config.port });
}

void start();
