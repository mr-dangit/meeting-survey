import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { buildRuntime } from "./runtime.js";

async function loadProductionApp(): Promise<FastifyInstance> {
  const config = loadConfig(process.env);
  const pool = createPool(config.databaseUrl, { max: 1 });
  return buildRuntime(config, pool);
}

export function createVercelHandler(
  loadApp: () => Promise<FastifyInstance> = loadProductionApp
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  let appPromise: Promise<FastifyInstance> | undefined;

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    appPromise ??= loadApp().then(async (app) => {
      await app.ready();
      return app;
    });
    const app = await appPromise;
    app.server.emit("request", request, response);
  };
}
