import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { MeetingRepository, ResponseRepository } from "../domain/repositories.js";
import {
  submissionSchema,
  SurveyClosedError,
  SurveyNotFoundError,
  SurveyService
} from "../services/survey-service.js";

const responseIdSchema = z.object({ id: z.string().uuid() }).strict();

type SurveyRoutesOptions = {
  meetings: MeetingRepository;
  responses: ResponseRepository;
};

function surveyAccess(headers: Record<string, string | string[] | undefined>): string | undefined {
  const value = headers["x-survey-access"];
  return typeof value === "string" ? value : undefined;
}

function sendSurveyError(error: unknown, reply: { code(statusCode: number): { send(payload: object): unknown } }) {
  if (error instanceof SurveyNotFoundError) {
    return reply.code(404).send({ error: "Survey not found." });
  }
  if (error instanceof SurveyClosedError) {
    return reply.code(409).send({ error: "This survey is closed." });
  }
  return reply.code(503).send({ error: "Feedback could not be saved. Please try again." });
}

function handleSurveySubmissionError(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
) {
  if (error.code === "FST_ERR_CTP_INVALID_JSON_BODY") {
    return reply.code(400).send({ error: "Check the survey answers and try again." });
  }
  return reply.send(error);
}

export async function registerSurveyRoutes(app: FastifyInstance, options: SurveyRoutesOptions): Promise<void> {
  const service = new SurveyService(options.meetings, options.responses);

  app.get("/api/survey", async (request, reply) => {
    try {
      return await service.getSurvey(surveyAccess(request.headers));
    } catch (error) {
      return sendSurveyError(error, reply);
    }
  });

  app.post(
    "/api/survey/responses",
    { errorHandler: handleSurveySubmissionError },
    async (request, reply) => {
      const parsed = submissionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Check the survey answers and try again." });
      }

      try {
        const result = await service.submit(surveyAccess(request.headers), parsed.data);
        return reply.code(201).send(result);
      } catch (error) {
        return sendSurveyError(error, reply);
      }
    }
  );

  // Revising a response the submitter already filed. Without this the receipt's "Edit response"
  // could only POST again, which filed a second response and double-counted that attendee.
  app.put(
    "/api/survey/responses/:id",
    { errorHandler: handleSurveySubmissionError },
    async (request, reply) => {
      const params = responseIdSchema.safeParse(request.params);
      const parsed = submissionSchema.safeParse(request.body);
      if (!params.success || !parsed.success) {
        return reply.code(400).send({ error: "Check the survey answers and try again." });
      }

      try {
        return await service.revise(surveyAccess(request.headers), params.data.id, parsed.data);
      } catch (error) {
        return sendSurveyError(error, reply);
      }
    }
  );
}
