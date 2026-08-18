import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import type { AppConfig } from "./config.js";
import type { DbPool } from "./domain/repositories.js";
import {
  PostgresMeetingRepository,
  PostgresResponseRepository
} from "./db/postgres-repositories.js";

export async function buildRuntime(
  config: AppConfig,
  pool: DbPool,
  staticRoot?: string
): Promise<FastifyInstance> {
  return buildApp({
    config,
    meetings: new PostgresMeetingRepository(pool),
    responses: new PostgresResponseRepository(pool),
    staticRoot
  });
}
