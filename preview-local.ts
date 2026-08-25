// Local-only preview: runs the real Fastify app against an in-memory database.
// No Supabase credentials involved. Untracked — delete when finished.
import path from "node:path";
import { createTestDatabase } from "./server/testing/database.js";
import { buildRuntime } from "./server/runtime.js";
import { hashAccessSecret } from "./server/domain/security.js";

const config = {
  nodeEnv: "development" as const,
  host: "127.0.0.1",
  port: 4310,
  databaseUrl: "postgresql://in-memory"
};

const { pool, meetings } = await createTestDatabase();
const now = new Date();

// A meeting as it exists in Supabase from before the change: hashes only.
await meetings.create({
  id: "10000000-0000-4000-8000-000000000001",
  title: "Legacy meeting (created before this change)",
  chairLabel: "Amelia Tan",
  meetingAt: new Date("2026-08-12T09:30:00.000Z"),
  invitedCount: 8,
  status: "open",
  surveySecretHash: hashAccessSecret("legacy-survey"),
  reportSecretHash: hashAccessSecret("legacy-report"),
  surveySecret: null,
  reportSecret: null,
  createdAt: now,
  updatedAt: now
});

// A meeting created after the change: secrets retained and retrievable.
await meetings.create({
  id: "10000000-0000-4000-8000-000000000002",
  title: "New meeting (created after this change)",
  chairLabel: "Meeting chair",
  meetingAt: new Date("2026-08-20T02:00:00.000Z"),
  invitedCount: 5,
  status: "open",
  surveySecretHash: hashAccessSecret("new-survey-secret"),
  reportSecretHash: hashAccessSecret("new-report-secret"),
  surveySecret: "new-survey-secret",
  reportSecret: "new-report-secret",
  createdAt: now,
  updatedAt: now
});

const app = await buildRuntime(config, pool, path.resolve(process.cwd(), "dist/client"));
await app.listen({ host: "127.0.0.1", port: config.port });
console.log(`Preview on http://127.0.0.1:${config.port}/#/admin`);
