import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";

export async function buildApp(options: { config: AppConfig }): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      redact: [
        "req.headers.x-survey-access",
        "req.headers.x-report-access",
        "req.body",
        "res.body"
      ]
    }
  });

  await app.register(cookie);

  app.get("/api/health", async () => ({ status: "ok" }));

  return app;
}
