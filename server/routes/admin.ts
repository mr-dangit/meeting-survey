import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import { passphraseMatches } from "../domain/security.js";
import type { MeetingRepository } from "../domain/repositories.js";
import { MeetingService } from "../services/meeting-service.js";

const loginSchema = z.object({ passphrase: z.string() }).strict();
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
  config: AppConfig;
  meetings: MeetingRepository;
};

function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  const session = request.cookies.admin_session;
  if (!session) {
    void reply.code(401).send({ error: "Administrator login required." });
    return false;
  }

  const unsigned = request.unsignCookie(session);
  if (!unsigned.valid || unsigned.value !== "authenticated") {
    void reply.code(401).send({ error: "Administrator login required." });
    return false;
  }

  return true;
}

function sessionCookieOptions(config: AppConfig) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: config.nodeEnv === "production",
    signed: true,
    path: "/"
  };
}

export async function registerAdminRoutes(app: FastifyInstance, options: AdminRoutesOptions): Promise<void> {
  const service = new MeetingService(options.meetings);

  app.post("/api/admin/session", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success || !passphraseMatches(parsed.data.passphrase, options.config.adminPassphrase)) {
      return reply.code(401).send({ error: "Invalid administrator passphrase." });
    }

    reply.setCookie("admin_session", "authenticated", sessionCookieOptions(options.config));
    return reply.code(204).send();
  });

  app.delete("/api/admin/session", async (_request, reply) => {
    reply.clearCookie("admin_session", sessionCookieOptions(options.config));
    return reply.code(204).send();
  });

  app.get("/api/admin/meetings", async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    return service.list();
  });

  app.post("/api/admin/meetings", async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    const parsed = createMeetingSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Check the meeting details and try again." });

    const created = await service.create({
      ...parsed.data,
      meetingAt: new Date(parsed.data.meetingAt)
    });
    return reply.code(201).send(created);
  });

  app.patch("/api/admin/meetings/:id/status", async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    const params = idSchema.safeParse(request.params);
    const body = updateStatusSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "Check the meeting status and try again." });
    }

    const meeting = await service.setStatus(params.data.id, body.data.status);
    if (!meeting) return reply.code(404).send({ error: "Meeting not found." });
    return meeting;
  });
}
