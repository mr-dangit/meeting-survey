import { loadConfig } from "../config.js";
import { runMigrations } from "./migrations.js";
import { createPool } from "./pool.js";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL ?? config.databaseUrl;
  const pool = createPool(migrationDatabaseUrl, { max: 1 });

  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}

void main();
