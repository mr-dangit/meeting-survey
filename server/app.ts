import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";
import type { MeetingRepository, ResponseRepository } from "./domain/repositories.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerSurveyRoutes } from "./routes/survey.js";

type BuildAppOptions = {
  config: AppConfig;
  meetings: MeetingRepository;
  responses: ResponseRepository;
};

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
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

  await app.register(cookie, { secret: options.config.sessionSecret });

  app.get("/api/health", async () => ({ status: "ok" }));
  await registerAdminRoutes(app, { config: options.config, meetings: options.meetings });
  await registerSurveyRoutes(app, { meetings: options.meetings, responses: options.responses });

  return app;
}
