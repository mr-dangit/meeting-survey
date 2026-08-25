import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createTestDatabase } from "./testing/database.js";

describe("server foundation", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  const pools: Array<{ end(): Promise<void> }> = [];
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    await Promise.all(pools.splice(0).map((pool) => pool.end()));
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  it("reports health without exposing configuration", async () => {
    const repositories = await createTestDatabase();
    pools.push(repositories.pool);
    const app = await buildApp({
      config: {
        nodeEnv: "test",
        host: "127.0.0.1",
        port: 3001,
        databaseUrl: "postgresql://unused"
      },
      meetings: repositories.meetings,
      responses: repositories.responses
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });


  describe("serving the built client", () => {
    async function appWithStaticRoot() {
      const repositories = await createTestDatabase();
      pools.push(repositories.pool);
      const staticRoot = await mkdtemp(path.join(tmpdir(), "meeting-feedback-static-"));
      await writeFile(path.join(staticRoot, "index.html"), "<div id=\"root\"></div>");
      const app = await buildApp({
        config: {
          nodeEnv: "test",
          host: "127.0.0.1",
          port: 3001,
          databaseUrl: "postgresql://unused"
        },
        meetings: repositories.meetings,
        responses: repositories.responses,
        staticRoot
      });
      apps.push(app);
      cleanups.push(() => rm(staticRoot, { recursive: true, force: true }));
      return { app, staticRoot };
    }

    it("serves the client shell for a hash route entry point", async () => {
      const { app } = await appWithStaticRoot();

      const response = await app.inject({ method: "GET", url: "/" });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('id="root"');
    });

    // Regression: `wildcard: false` enumerates the asset directory once at registration, so a
    // rebuild while the process ran left the new content-hashed filenames unrouted, and every
    // visitor holding the rebuilt index.html got a blank page until someone restarted the process.
    it("serves an asset built after start-up so a rebuild does not need a restart", async () => {
      const { app, staticRoot } = await appWithStaticRoot();
      await mkdir(path.join(staticRoot, "assets"), { recursive: true });
      await writeFile(path.join(staticRoot, "assets", "index-rebuilt.js"), "export const rebuilt = true;");

      const response = await app.inject({ method: "GET", url: "/assets/index-rebuilt.js" });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("export const rebuilt = true;");
    });

    // The shell must never stand in for a missing module: HTML with a 200 where the browser expects
    // JavaScript renders a blank page and logs as a success.
    it("answers 404 for a missing asset instead of falling back to the client shell", async () => {
      const { app } = await appWithStaticRoot();

      const response = await app.inject({ method: "GET", url: "/assets/index-absent.js" });

      expect(response.statusCode).toBe(404);
      expect(response.body).not.toContain('id="root"');
    });

    it("still answers 404 for an unknown API route", async () => {
      const { app } = await appWithStaticRoot();

      const response = await app.inject({ method: "GET", url: "/api/nope" });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Not found." });
    });
  });

  it("rejects a missing database connection", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/DATABASE_URL/);
  });
});
