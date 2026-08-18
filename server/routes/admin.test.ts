import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createTestDatabase } from "../testing/database.js";

const config = {
  nodeEnv: "test" as const,
  port: 3001,
  databaseUrl: "postgresql://unused",
  adminPassphrase: "test-admin-passphrase",
  sessionSecret: "test-session-secret-at-least-32-characters"
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

  async function login(): Promise<string> {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/session",
      payload: { passphrase: config.adminPassphrase }
    });

    expect(response.statusCode).toBe(204);
    return response.cookies.find((item) => item.name === "admin_session")!.value;
  }

  it("requires login and creates unrelated hashed access secrets", async () => {
    const unauthenticated = await app.inject({ method: "GET", url: "/api/admin/meetings" });
    expect(unauthenticated.statusCode).toBe(401);

    const cookie = await login();
    const created = await app.inject({
      method: "POST",
      url: "/api/admin/meetings",
      cookies: { admin_session: cookie },
      payload: {
        title: "Weekly investment review",
        chairLabel: "Meeting chair",
        meetingAt: "2026-08-18T08:00:00.000Z",
        invitedCount: 5
      }
    });

    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.surveyAccess).not.toBe(body.reportAccess);
    expect(JSON.stringify(await repositories.meetings.list())).not.toContain(body.surveyAccess);
    expect(JSON.stringify(await repositories.meetings.list())).not.toContain(body.reportAccess);
  });

  it("rejects invalid passphrases and clears the administrator session on logout", async () => {
    const invalid = await app.inject({
      method: "POST",
      url: "/api/admin/session",
      payload: { passphrase: "wrong-admin-passphrase" }
    });
    expect(invalid.statusCode).toBe(401);

    const cookie = await login();
    const logout = await app.inject({
      method: "DELETE",
      url: "/api/admin/session",
      cookies: { admin_session: cookie }
    });
    expect(logout.statusCode).toBe(204);
    expect(logout.headers["set-cookie"]).toContain("Max-Age=0");
  });

  it("rejects invalid invited counts", async () => {
    const cookie = await login();
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/meetings",
      cookies: { admin_session: cookie },
      payload: {
        title: "Weekly investment review",
        chairLabel: "Meeting chair",
        meetingAt: "2026-08-18T08:00:00.000Z",
        invitedCount: 0
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("lists only the administrator meeting view model", async () => {
    const cookie = await login();
    const created = await app.inject({
      method: "POST",
      url: "/api/admin/meetings",
      cookies: { admin_session: cookie },
      payload: {
        title: "Weekly investment review",
        chairLabel: "Meeting chair",
        meetingAt: "2026-08-18T08:00:00.000Z",
        invitedCount: 5
      }
    });
    const body = created.json();

    const listed = await app.inject({
      method: "GET",
      url: "/api/admin/meetings",
      cookies: { admin_session: cookie }
    });

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

  it("closes and reopens a meeting", async () => {
    const cookie = await login();
    const created = await app.inject({
      method: "POST",
      url: "/api/admin/meetings",
      cookies: { admin_session: cookie },
      payload: {
        title: "Weekly investment review",
        chairLabel: "Meeting chair",
        meetingAt: "2026-08-18T08:00:00.000Z",
        invitedCount: 5
      }
    });
    const id = created.json().meeting.id;

    const closed = await app.inject({
      method: "PATCH",
      url: `/api/admin/meetings/${id}/status`,
      cookies: { admin_session: cookie },
      payload: { status: "closed" }
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json()).toEqual(expect.objectContaining({ id, status: "closed" }));

    const reopened = await app.inject({
      method: "PATCH",
      url: `/api/admin/meetings/${id}/status`,
      cookies: { admin_session: cookie },
      payload: { status: "open" }
    });
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json()).toEqual(expect.objectContaining({ id, status: "open" }));
  });

  it("uses signed strict secure cookies in production", async () => {
    const productionApp = await buildApp({
      config: { ...config, nodeEnv: "production" },
      meetings: repositories.meetings,
      responses: repositories.responses
    });
    try {
      const response = await productionApp.inject({
        method: "POST",
        url: "/api/admin/session",
        payload: { passphrase: config.adminPassphrase }
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers["set-cookie"]).toMatch(/admin_session=authenticated\.[^;]+; Path=\/; HttpOnly; Secure; SameSite=Strict/);
    } finally {
      await productionApp.close();
    }
  });
});
