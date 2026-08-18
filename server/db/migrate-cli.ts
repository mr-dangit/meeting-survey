import { loadConfig } from "../config.js";
import { runMigrations } from "./migrations.js";
import { createPool } from "./pool.js";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const pool = createPool(config.databaseUrl);

  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}

void main();
