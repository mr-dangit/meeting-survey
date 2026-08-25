import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MeetingRepository } from "../domain/repositories.js";
import { MeetingService } from "../services/meeting-service.js";

const createMeetingSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    chairLabel: z.string().trim().min(1).max(120),
    meetingAt: z.iso.datetime(),
    invitedCount: z.number().int().min(1).max(10_000)
  })
  .strict();
const updateStatusSchema = z.object({ status: z.enum(["open", "closed"]) }).strict();
const idSchema = z.object({ id: z.string().uuid() }).strict();

type AdminRoutesOptions = {
  meetings: MeetingRepository;
};

// Testing build: the administrator routes are open. There is no login because there is no real
// data behind them. Add authentication again before pointing this at a production database.
export async function registerAdminRoutes(app: FastifyInstance, options: AdminRoutesOptions): Promise<void> {
  const service = new MeetingService(options.meetings);

  app.get("/api/admin/meetings", async () => service.list());

  app.post("/api/admin/meetings", async (request, reply) => {
    const parsed = createMeetingSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Check the meeting details and try again." });

    const created = await service.create({
      ...parsed.data,
      meetingAt: new Date(parsed.data.meetingAt)
    });
    return reply.code(201).send(created);
  });

  app.get("/api/admin/meetings/:id/access", async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Check the meeting reference and try again." });

    const access = await service.access(params.data.id);
    if (!access) return reply.code(404).send({ error: "Access links are not available for this meeting." });
    return access;
  });

  app.patch("/api/admin/meetings/:id/status", async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    const body = updateStatusSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "Check the meeting status and try again." });
    }

    const meeting = await service.setStatus(params.data.id, body.data.status);
    if (!meeting) return reply.code(404).send({ error: "Meeting not found." });
    return meeting;
  });

  app.delete("/api/admin/meetings/:id", async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Check the meeting reference and try again." });

    const deleted = await service.delete(params.data.id);
    if (!deleted) return reply.code(404).send({ error: "Meeting not found." });
    return reply.code(204).send();
  });
}
