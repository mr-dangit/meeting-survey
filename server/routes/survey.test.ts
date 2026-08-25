import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ResponseRepository } from "../domain/repositories.js";
import { MeetingService } from "../services/meeting-service.js";
import { createTestDatabase } from "../testing/database.js";

const config = {
  nodeEnv: "test" as const,
  host: "127.0.0.1",
  port: 3001,
  databaseUrl: "postgresql://unused"
};

describe("survey routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let repositories: Awaited<ReturnType<typeof createTestDatabase>>;
  let meeting: Awaited<ReturnType<MeetingService["create"]>>["meeting"];
  let surveyAccess: string;

  beforeEach(async () => {
    repositories = await createTestDatabase();
    const created = await new MeetingService(repositories.meetings).create({
      title: "Weekly investment review",
      chairLabel: "Meeting chair",
      meetingAt: new Date("2026-08-18T08:00:00.000Z"),
      invitedCount: 5
    });
    meeting = created.meeting;
    surveyAccess = created.surveyAccess;
    app = await buildApp({
      config,
      meetings: repositories.meetings,
      responses: repositories.responses
    });
  });

  afterEach(async () => {
    await app.close();
    await repositories.pool.end();
  });

  it("returns only public meeting context for a valid shared survey link", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/survey",
      headers: { "x-survey-access": surveyAccess }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: meeting.id,
      title: "Weekly investment review",
      chairLabel: "Meeting chair",
      meetingAt: "2026-08-18T08:00:00.000Z",
      status: "open"
    });
    expect(response.body).not.toContain("invitedCount");
    expect(response.body).not.toContain("surveySecretHash");
    expect(response.body).not.toContain("reportSecretHash");
  });

  it("returns the safe not-found error for missing survey access", async () => {
    const response = await app.inject({ method: "GET", url: "/api/survey" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Survey not found." });
  });

  it("returns the safe not-found error for invalid survey access", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/survey/responses",
      headers: { "x-survey-access": "not-the-survey-secret" },
      payload: { usefulness: 4, actionability: 5, necessity: 3 }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Survey not found." });
  });

  it("stores a valid response and returns no stored row", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/survey/responses",
      headers: { "x-survey-access": surveyAccess, "user-agent": "never-store-this" },
      payload: {
        usefulness: 4,
        actionability: 5,
        necessity: 3,
        comment: "End with a decision recap."
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ status: "recorded" });
    expect(response.json().responseId).toEqual(expect.any(String));
    const stored = await repositories.responses.listForMeeting(meeting.id);
    expect(stored).toMatchObject([
      { usefulness: 4, actionability: 5, necessity: 3, comment: "End with a decision recap." }
    ]);
    expect(JSON.stringify(stored)).not.toContain(surveyAccess);
    expect(JSON.stringify(stored)).not.toContain("never-store-this");
  });

  it("accepts repeated valid submissions through the same shared link", async () => {
    for (const usefulness of [2, 5]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/survey/responses",
        headers: { "x-survey-access": surveyAccess },
        payload: { usefulness, actionability: 4, necessity: 3 }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ status: "recorded" });
    }

    expect(await repositories.responses.listForMeeting(meeting.id)).toHaveLength(2);
  });

  describe("revising an already-filed response", () => {
    async function fileResponse() {
      const created = await app.inject({
        method: "POST",
        url: "/api/survey/responses",
        headers: { "x-survey-access": surveyAccess },
        payload: { usefulness: 2, actionability: 2, necessity: 2, comment: "First take." }
      });
      return created.json().responseId as string;
    }

    it("replaces the original answers instead of filing a second response", async () => {
      const responseId = await fileResponse();

      const revised = await app.inject({
        method: "PUT",
        url: `/api/survey/responses/${responseId}`,
        headers: { "x-survey-access": surveyAccess },
        payload: { usefulness: 5, actionability: 4, necessity: 5, comment: "Changed my mind." }
      });

      expect(revised.statusCode).toBe(200);
      expect(revised.json()).toEqual({ status: "recorded", responseId });
      const stored = await repositories.responses.listForMeeting(meeting.id);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        id: responseId,
        usefulness: 5,
        actionability: 4,
        necessity: 5,
        comment: "Changed my mind."
      });
    });

    it("keeps the original submission time so a revision is not a fresh submission", async () => {
      const responseId = await fileResponse();
      const [before] = await repositories.responses.listForMeeting(meeting.id);

      await app.inject({
        method: "PUT",
        url: `/api/survey/responses/${responseId}`,
        headers: { "x-survey-access": surveyAccess },
        payload: { usefulness: 3, actionability: 3, necessity: 3 }
      });

      const [after] = await repositories.responses.listForMeeting(meeting.id);
      expect(after.submittedAt.toISOString()).toBe(before.submittedAt.toISOString());
    });

    it("refuses a response belonging to another meeting without revealing it exists", async () => {
      const responseId = await fileResponse();
      const other = await new MeetingService(repositories.meetings).create({
        title: "Unrelated meeting",
        chairLabel: "Another chair",
        meetingAt: new Date("2026-08-19T08:00:00.000Z"),
        invitedCount: 3
      });

      const revised = await app.inject({
        method: "PUT",
        url: `/api/survey/responses/${responseId}`,
        headers: { "x-survey-access": other.surveyAccess },
        payload: { usefulness: 1, actionability: 1, necessity: 1 }
      });

      expect(revised.statusCode).toBe(404);
      expect(revised.json()).toEqual({ error: "Survey not found." });
      const stored = await repositories.responses.listForMeeting(meeting.id);
      expect(stored[0]).toMatchObject({ usefulness: 2, comment: "First take." });
    });

    it("rejects a revision without valid survey access", async () => {
      const responseId = await fileResponse();

      const revised = await app.inject({
        method: "PUT",
        url: `/api/survey/responses/${responseId}`,
        headers: { "x-survey-access": "not-the-survey-secret" },
        payload: { usefulness: 5, actionability: 5, necessity: 5 }
      });

      expect(revised.statusCode).toBe(404);
      expect(revised.json()).toEqual({ error: "Survey not found." });
    });

    it("rejects a revision after the survey closes", async () => {
      const responseId = await fileResponse();
      await repositories.meetings.setStatus(meeting.id, "closed", new Date());

      const revised = await app.inject({
        method: "PUT",
        url: `/api/survey/responses/${responseId}`,
        headers: { "x-survey-access": surveyAccess },
        payload: { usefulness: 5, actionability: 5, necessity: 5 }
      });

      expect(revised.statusCode).toBe(409);
      expect(revised.json()).toEqual({ error: "This survey is closed." });
    });

    it("rejects a malformed response id and out-of-range ratings", async () => {
      const responseId = await fileResponse();

      const badId = await app.inject({
        method: "PUT",
        url: "/api/survey/responses/not-a-uuid",
        headers: { "x-survey-access": surveyAccess },
        payload: { usefulness: 5, actionability: 5, necessity: 5 }
      });
      const badRating = await app.inject({
        method: "PUT",
        url: `/api/survey/responses/${responseId}`,
        headers: { "x-survey-access": surveyAccess },
        payload: { usefulness: 9, actionability: 5, necessity: 5 }
      });

      expect(badId.statusCode).toBe(400);
      expect(badRating.statusCode).toBe(400);
      expect(badRating.json()).toEqual({ error: "Check the survey answers and try again." });
    });

    it("reports an unknown response id as not found", async () => {
      const revised = await app.inject({
        method: "PUT",
        url: "/api/survey/responses/20000000-0000-4000-8000-000000000001",
        headers: { "x-survey-access": surveyAccess },
        payload: { usefulness: 5, actionability: 5, necessity: 5 }
      });

      expect(revised.statusCode).toBe(404);
      expect(revised.json()).toEqual({ error: "Survey not found." });
    });
  });

  it("rejects responses after the survey closes", async () => {
    await repositories.meetings.setStatus(meeting.id, "closed", new Date());

    const response = await app.inject({
      method: "POST",
      url: "/api/survey/responses",
      headers: { "x-survey-access": surveyAccess },
      payload: { usefulness: 4, actionability: 5, necessity: 3 }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "This survey is closed." });
    expect(await repositories.responses.listForMeeting(meeting.id)).toEqual([]);
  });

  it.each([
    { usefulness: 0, actionability: 5, necessity: 3 },
    { usefulness: 4, actionability: 6, necessity: 3 },
    { usefulness: 4.5, actionability: 5, necessity: 3 }
  ])("rejects ratings outside the required integer range", async (payload) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/survey/responses",
      headers: { "x-survey-access": surveyAccess },
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Check the survey answers and try again." });
  });

  it("rejects a comment longer than 1,000 characters", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/survey/responses",
      headers: { "x-survey-access": surveyAccess },
      payload: { usefulness: 4, actionability: 5, necessity: 3, comment: "x".repeat(1001) }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Check the survey answers and try again." });
  });

  it("returns the safe validation error for malformed JSON submissions", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/survey/responses",
      headers: {
        "content-type": "application/json",
        "x-survey-access": surveyAccess
      },
      payload: "{\"usefulness\":4"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Check the survey answers and try again." });
  });

  it("returns a safe unavailable error when response persistence fails", async () => {
    await app.close();
    const unavailableResponses: ResponseRepository = {
      create: async () => {
        throw new Error("database unavailable");
      },
      update: async () => {
        throw new Error("database unavailable");
      },
      listForMeeting: repositories.responses.listForMeeting.bind(repositories.responses)
    };
    app = await buildApp({
      config,
      meetings: repositories.meetings,
      responses: unavailableResponses
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/survey/responses",
      headers: { "x-survey-access": surveyAccess },
      payload: { usefulness: 4, actionability: 5, necessity: 3 }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "Feedback could not be saved. Please try again." });
  });
});
