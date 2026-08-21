import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createTestDatabase } from "../testing/database.js";

const config = {
  nodeEnv: "test" as const,
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
