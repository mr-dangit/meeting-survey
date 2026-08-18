import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createTestDatabase } from "./testing/database.js";

describe("server foundation", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  const pools: Array<{ end(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    await Promise.all(pools.splice(0).map((pool) => pool.end()));
  });

  it("reports health without exposing configuration", async () => {
    const repositories = await createTestDatabase();
    pools.push(repositories.pool);
    const app = await buildApp({
      config: {
        nodeEnv: "test",
        port: 3001,
        databaseUrl: "postgresql://unused",
        adminPassphrase: "test-admin-passphrase",
        sessionSecret: "test-session-secret-at-least-32-characters"
      },
      meetings: repositories.meetings,
      responses: repositories.responses
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    expect(response.body).not.toContain("test-admin-passphrase");
  });

  it("rejects missing production secrets", () => {
    expect(() => loadConfig({ NODE_ENV: "production", DATABASE_URL: "postgresql://db" })).toThrow(
      /ADMIN_PASSPHRASE/
    );
  });
});
