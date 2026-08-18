import { DataType, newDb } from "pg-mem";
import type { DbPool } from "../domain/repositories.js";
import { runMigrations } from "../db/migrations.js";
import {
  PostgresMeetingRepository,
  PostgresResponseRepository
} from "../db/postgres-repositories.js";

export async function createTestDatabase(): Promise<{
  pool: DbPool;
  meetings: PostgresMeetingRepository;
  responses: PostgresResponseRepository;
}> {
  const db = newDb();
  db.public.registerFunction({
    name: "char_length",
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (value: string) => value.length
  });
  const pool = new (db.adapters.createPg().Pool)() as DbPool;
  await runMigrations(pool);

  return {
    pool,
    meetings: new PostgresMeetingRepository(pool),
    responses: new PostgresResponseRepository(pool)
  };
}
