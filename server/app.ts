import staticPlugin from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";
import type { MeetingRepository, ResponseRepository } from "./domain/repositories.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerReportRoutes } from "./routes/report.js";
import { registerSurveyRoutes } from "./routes/survey.js";

export type BuildAppOptions = {
  config: AppConfig;
  meetings: MeetingRepository;
  responses: ResponseRepository;
  staticRoot?: string;
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

  // A bodyless request may still declare a JSON content-type — browsers and proxies both do it.
  // Fastify's default parser answers that with a 400, which surfaces as a delete that fails for no
  // stated reason, so an empty body is read as "no body" instead.
  app.addContentTypeParser<string>(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      if (body.trim() === "") return done(null, undefined);
      try {
        done(null, JSON.parse(body));
      } catch {
        // Keeps Fastify's own code so the routes' safe-message handlers still recognise it.
        done(
          Object.assign(new Error("Invalid JSON body."), {
            statusCode: 400,
            code: "FST_ERR_CTP_INVALID_JSON_BODY"
          }),
          undefined
        );
      }
    }
  );

  app.get("/api/health", async () => ({ status: "ok" }));
  await registerAdminRoutes(app, { meetings: options.meetings });
  await registerSurveyRoutes(app, { meetings: options.meetings, responses: options.responses });
  await registerReportRoutes(app, { meetings: options.meetings, responses: options.responses });

  if (options.staticRoot) {
    await app.register(staticPlugin, { root: options.staticRoot, wildcard: false });
    // `wildcard: false` makes @fastify/static enumerate the directory once at registration, so a
    // rebuild while the process runs leaves the new content-hashed filenames without a route. This
    // route resolves each asset off disk per request instead, which is what lets a rebuilt bundle be
    // served without restarting: the alternative was a 404 for every asset the running process had
    // not seen at startup, and a blank page for anyone holding the freshly built index.html.
    app.get<{ Params: { "*": string } }>("/assets/*", async (request, reply) => {
      // sendFile resolves within staticRoot and rejects paths that climb out of it, so the caller
      // cannot reach beyond the built client directory.
      return reply.sendFile(`assets/${request.params["*"]}`);
    });
    // SPA fallback for hash routes. API paths stay a hard 404 rather than being answered with HTML.
    app.get("/*", async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "Not found." });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}
