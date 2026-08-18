import type { FastifyInstance } from "fastify";
import type { MeetingRepository, ResponseRepository } from "../domain/repositories.js";
import { ReportNotFoundError, ReportService } from "../services/report-service.js";

type ReportRoutesOptions = { meetings: MeetingRepository; responses: ResponseRepository };

export async function registerReportRoutes(app: FastifyInstance, options: ReportRoutesOptions) {
  const service = new ReportService(options.meetings, options.responses);
  app.get("/api/report", async (request, reply) => {
    const value = request.headers["x-report-access"];
    const access = typeof value === "string" ? value : undefined;
    try {
      return await service.getReport(access);
    } catch (error) {
      if (error instanceof ReportNotFoundError) {
        return reply.code(404).send({ error: "Report not found." });
      }
      return reply.code(503).send({ error: "Report could not be loaded. Please try again." });
    }
  });
}
