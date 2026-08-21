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
    // A failure closing the pool must not mask why the migration itself failed.
    await pool.end().catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
