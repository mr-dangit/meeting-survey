import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createTestDatabase } from "../testing/database.js";

const config = {
  nodeEnv: "test" as const,
  host: "127.0.0.1",
  port: 3001,
  databaseUrl: "postgresql://unused"
};

describe("administrator routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let repositories: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    repositories = await createTestDatabase();
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

  function createMeeting(payload: Record<string, unknown> = {}) {
    return app.inject({
      method: "POST",
      url: "/api/admin/meetings",
      payload: {
        title: "Weekly investment review",
        chairLabel: "Meeting chair",
        meetingAt: "2026-08-18T08:00:00.000Z",
        invitedCount: 5,
        ...payload
      }
    });
  }

  it("creates unrelated access secrets without a login", async () => {
    const created = await createMeeting();

    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.surveyAccess).not.toBe(body.reportAccess);
    const [stored] = await repositories.meetings.list();
    expect(stored.surveySecretHash).not.toBe(body.surveyAccess);
    expect(stored.reportSecretHash).not.toBe(body.reportAccess);
    expect(stored.surveySecret).toBe(body.surveyAccess);
    expect(stored.reportSecret).toBe(body.reportAccess);
  });

  describe("deleting a meeting", () => {
    it("removes the meeting, its responses, and its access links", async () => {
      const created = await createMeeting();
      const { meeting, surveyAccess, reportAccess } = created.json();
      await app.inject({
        method: "POST",
        url: "/api/survey/responses",
        headers: { "x-survey-access": surveyAccess },
        payload: { usefulness: 4, actionability: 4, necessity: 4, comment: "Worth keeping." }
      });
      expect(await repositories.responses.listForMeeting(meeting.id)).toHaveLength(1);

      const deleted = await app.inject({ method: "DELETE", url: `/api/admin/meetings/${meeting.id}` });

      expect(deleted.statusCode).toBe(204);
      expect(await repositories.meetings.list()).toEqual([]);
      // The responses foreign key cascades, so the feedback goes with the meeting.
      expect(await repositories.responses.listForMeeting(meeting.id)).toEqual([]);
      // Both secret links stop resolving.
      const survey = await app.inject({
        method: "GET",
        url: "/api/survey",
        headers: { "x-survey-access": surveyAccess }
      });
      const report = await app.inject({
        method: "GET",
        url: "/api/report",
        headers: { "x-report-access": reportAccess }
      });
      expect(survey.statusCode).toBe(404);
      expect(report.statusCode).toBe(404);
    });

    it("leaves other meetings untouched", async () => {
      const kept = (await createMeeting({ title: "Keep me" })).json();
      const doomed = (await createMeeting({ title: "Delete me" })).json();

      const deleted = await app.inject({
        method: "DELETE",
        url: `/api/admin/meetings/${doomed.meeting.id}`
      });

      expect(deleted.statusCode).toBe(204);
      const remaining = await repositories.meetings.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(kept.meeting.id);
    });

    it("answers 404 for a meeting that does not exist", async () => {
      const deleted = await app.inject({
        method: "DELETE",
        url: "/api/admin/meetings/20000000-0000-4000-8000-000000000001"
      });

      expect(deleted.statusCode).toBe(404);
      expect(deleted.json()).toEqual({ error: "Meeting not found." });
    });

    // The browser's fetch wrapper used to label every request as JSON, body or not. Fastify's
    // default parser answered a bodyless DELETE with 400 FST_ERR_CTP_EMPTY_JSON_BODY, so the
    // button reported "Bad Request" while every test that skipped the header passed.
    it("deletes when the request declares a JSON content-type but sends no body", async () => {
      const { meeting } = (await createMeeting()).json();

      const deleted = await app.inject({
        method: "DELETE",
        url: `/api/admin/meetings/${meeting.id}`,
        headers: { "content-type": "application/json" }
      });

      expect(deleted.statusCode).toBe(204);
      expect(await repositories.meetings.list()).toEqual([]);
    });

    it("rejects a malformed meeting reference", async () => {
      const deleted = await app.inject({ method: "DELETE", url: "/api/admin/meetings/not-a-uuid" });

      expect(deleted.statusCode).toBe(400);
      expect(deleted.json()).toEqual({ error: "Check the meeting reference and try again." });
    });
  });

  it("no longer exposes an administrator session endpoint", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/admin/session",
      payload: { passphrase: "anything" }
    });
    expect(login.statusCode).toBe(404);

    const logout = await app.inject({ method: "DELETE", url: "/api/admin/session" });
    expect(logout.statusCode).toBe(404);
  });

  it("rejects invalid invited counts", async () => {
    const response = await createMeeting({ invitedCount: 0 });

    expect(response.statusCode).toBe(400);
  });

  it("lists only the administrator meeting view model", async () => {
    const body = (await createMeeting()).json();

    const listed = await app.inject({ method: "GET", url: "/api/admin/meetings" });

    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual([
      expect.objectContaining({
        id: body.meeting.id,
        title: "Weekly investment review",
        chairLabel: "Meeting chair",
        meetingAt: "2026-08-18T08:00:00.000Z",
        invitedCount: 5,
        status: "open"
      })
    ]);
    expect(listed.body).not.toContain("surveySecretHash");
    expect(listed.body).not.toContain("reportSecretHash");
    expect(listed.body).not.toContain(body.surveyAccess);
    expect(listed.body).not.toContain(body.reportAccess);
  });

  it("returns the stored access links for a saved meeting", async () => {
    const body = (await createMeeting()).json();

    const access = await app.inject({
      method: "GET",
      url: `/api/admin/meetings/${body.meeting.id}/access`
    });
    expect(access.statusCode).toBe(200);
    expect(access.json()).toEqual({
      surveyAccess: body.surveyAccess,
      reportAccess: body.reportAccess
    });

    const missing = await app.inject({
      method: "GET",
      url: "/api/admin/meetings/10000000-0000-4000-8000-000000000009/access"
    });
    expect(missing.statusCode).toBe(404);
  });

  it("closes and reopens a meeting", async () => {
    const id = (await createMeeting()).json().meeting.id;

    const closed = await app.inject({
      method: "PATCH",
      url: `/api/admin/meetings/${id}/status`,
      payload: { status: "closed" }
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json()).toEqual(expect.objectContaining({ id, status: "closed" }));

    const reopened = await app.inject({
      method: "PATCH",
      url: `/api/admin/meetings/${id}/status`,
      payload: { status: "open" }
    });
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json()).toEqual(expect.objectContaining({ id, status: "open" }));
  });
});
