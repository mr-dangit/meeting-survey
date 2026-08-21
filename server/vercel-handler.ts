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

function restoreRewrittenApiPath(request: IncomingMessage): void {
  if (!request.url) return;

  const url = new URL(request.url, "http://localhost");
  if (url.pathname !== "/api/server") return;

  const path = url.searchParams.get("path");
  if (!path) return;

  url.searchParams.delete("path");
  const query = url.searchParams.toString();
  request.url = `/api/${path.replace(/^\/+/, "")}${query ? `?${query}` : ""}`;
}

export function createVercelHandler(
  loadApp: () => Promise<FastifyInstance> = loadProductionApp
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  let appPromise: Promise<FastifyInstance> | undefined;

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    // Cache the app across invocations on a warm instance, but never cache a failure: a rejected
    // promise kept here would make one transient start-up error (database unreachable, missing
    // environment variable) permanent for the life of the instance.
    appPromise ??= loadApp()
      .then(async (app) => {
        await app.ready();
        return app;
      })
      .catch((error: unknown) => {
        appPromise = undefined;
        throw error;
      });
    const app = await appPromise;
    restoreRewrittenApiPath(request);
    app.server.emit("request", request, response);
  };
}
